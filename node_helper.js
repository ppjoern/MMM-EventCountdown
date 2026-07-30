const NodeHelper = require("node_helper");
const Log = require("logger");
const nodeIcal = require("node-ical");
const {
	DEFAULT_ALLOWED_HOSTS,
	DEFAULT_ALLOWED_SUFFIXES,
	resolveUrl,
	isUrlAllowed,
	parseEvents,
	fetchWithValidatedRedirects,
} = require("./lib/calendar.js");

module.exports = NodeHelper.create({
	start () {
		Log.info("[MMM-EventCountdown] node_helper started – calendar fetch runs server-side.");
	},

	/**
	 * Fetch and parse an ICS feed. The URL is never logged.
	 * Uses AbortController so slow or stuck feeds cannot block the helper indefinitely.
	 */
	async fetchCalendar (calendarConfig, allowedHosts, allowedSuffixes) {
		const resolvedUrl = resolveUrl(calendarConfig.url);
		if (!resolvedUrl) {
			Log.error(`[MMM-EventCountdown] Could not resolve URL for calendar "${calendarConfig.name || "unnamed"}". Check config.env and SECRET_ variables.`);
			return { ok: false, events: [] };
		}

		const allowed = isUrlAllowed(resolvedUrl, allowedHosts, allowedSuffixes);
		if (!allowed.ok) {
			if (allowed.reason === "parse") {
				Log.error("[MMM-EventCountdown] Invalid calendar URL (parse error).");
			} else if (allowed.reason === "protocol") {
				Log.error("[MMM-EventCountdown] Only http/https URLs are allowed.");
			} else if (allowed.reason === "blocked") {
				Log.error("[MMM-EventCountdown] Internal/private hosts are blocked (SSRF protection).");
			} else if (allowed.reason === "whitelist") {
				Log.error(`[MMM-EventCountdown] Host "${allowed.host}" is not in the allowedHosts whitelist.`);
			}
			return { ok: false, events: [] };
		}

		const controller = new AbortController();
		const timeoutMs = calendarConfig.fetchTimeout || 30000;
		const timeout = setTimeout(() => controller.abort(), timeoutMs);

		try {
			const fetched = await fetchWithValidatedRedirects(resolvedUrl, {
				signal: controller.signal,
				headers: { "User-Agent": "MagicMirror-MMM-EventCountdown" },
			}, allowedHosts, allowedSuffixes);

			if (!fetched.ok) {
				if (fetched.reason === "redirect" || fetched.reason === "redirect-limit") {
					Log.error(`[MMM-EventCountdown] Redirect blocked while fetching calendar "${calendarConfig.name || "unnamed"}".`);
				} else if (fetched.reason === "whitelist") {
					Log.error(`[MMM-EventCountdown] Redirect target host "${fetched.host}" is not allowed.`);
				} else if (fetched.reason === "blocked") {
					Log.error("[MMM-EventCountdown] Redirect target blocked (SSRF protection).");
				}
				return { ok: false, events: [] };
			}

			const response = fetched.response;
			if (!response.ok) {
				Log.error(`[MMM-EventCountdown] HTTP ${response.status} while fetching calendar "${calendarConfig.name || "unnamed"}".`);
				return { ok: false, events: [] };
			}

			const icsData = await response.text();
			const parsed = nodeIcal.parseICS(icsData);
			return { ok: true, events: parseEvents(parsed) };
		} catch (err) {
			if (err.name === "AbortError") {
				Log.error(`[MMM-EventCountdown] Timeout while fetching calendar "${calendarConfig.name || "unnamed"}".`);
			} else {
				Log.error(`[MMM-EventCountdown] Error fetching calendar "${calendarConfig.name || "unnamed"}": ${err.message}`);
			}
			return { ok: false, events: [] };
		} finally {
			clearTimeout(timeout);
		}
	},

	/** Fetch every configured calendar sequentially and merge the event lists. */
	async fetchAllCalendars (config) {
		const calendars = config.calendars || [];
		if (calendars.length === 0) {
			Log.warn("[MMM-EventCountdown] No calendars configured. Add URLs in config.js (see README).");
			return { ok: true, events: [] };
		}

		const allowedHosts = [...DEFAULT_ALLOWED_HOSTS, ...(config.allowedHosts || [])];
		const allowedSuffixes = [...DEFAULT_ALLOWED_SUFFIXES];
		const allEvents = [];
		let hadSuccessfulFetch = false;

		for (const cal of calendars) {
			const result = await this.fetchCalendar(cal, allowedHosts, allowedSuffixes);
			if (result.ok) {
				hadSuccessfulFetch = true;
				allEvents.push(...result.events);
			}
		}

		return {
			ok: hadSuccessfulFetch,
			events: allEvents,
		};
	},

	/** Browser asks for events → server fetches ICS → sends parsed list back via socket. */
	socketNotificationReceived (notification, payload) {
		if (notification === "FETCH_EVENTS") {
			this.fetchAllCalendars(payload)
				.then((result) => {
					this.sendSocketNotification("EVENTS", result);
				})
				.catch((err) => {
					Log.error(`[MMM-EventCountdown] Unexpected error: ${err.message}`);
					this.sendSocketNotification("EVENTS", { ok: false, events: [] });
				});
		}
	},
});
