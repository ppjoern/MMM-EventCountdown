const NodeHelper = require("node_helper");
const Log = require("logger");
const nodeIcal = require("node-ical");
const { URL } = require("url");

// Allowed calendar hosts (SSRF protection). Extend via allowedHosts in module config.
const DEFAULT_ALLOWED_HOSTS = [
	"calendar.google.com",
	"www.google.com",
	"outlook.office365.com",
	"outlook.live.com",
	"calendar.yahoo.com",
	"icloud.com",
	"caldav.icloud.com",
];

// Subdomain suffixes allowed when the base provider is trusted (e.g. p42-caldav.icloud.com).
const DEFAULT_ALLOWED_SUFFIXES = [
	".icloud.com",
];

// Block private/internal IP ranges (SSRF protection)
const BLOCKED_HOST_PATTERNS = [
	/^localhost$/i,
	/^127\./,
	/^10\./,
	/^172\.(1[6-9]|2\d|3[01])\./,
	/^192\.168\./,
	/^169\.254\./,
	/^0\./,
	/^\[::1\]$/,
	/^::1$/,
];

module.exports = NodeHelper.create({
	start () {
		Log.info("[MMM-EventCountdown] node_helper started – calendar fetch runs server-side.");
	},

	/**
	 * Resolve URL placeholders from config.
	 * Supports: "${SECRET_CAL_URL_1}", "**SECRET_CAL_URL_1**" (masked by the browser)
	 */
	resolveUrl (rawUrl) {
		if (!rawUrl || typeof rawUrl !== "string") return null;

		const masked = rawUrl.match(/^\*\*(SECRET_[A-Z0-9_]+)\*\*$/);
		if (masked) return process.env[masked[1]] || null;

		const envRef = rawUrl.match(/^\$\{([A-Z0-9_]+)\}$/);
		if (envRef) return process.env[envRef[1]] || null;

		return rawUrl;
	},

	/**
	 * Validate a calendar URL before fetching.
	 * Checks protocol, blocks private IPs, then matches host against the whitelist
	 * (exact hostname or allowed suffix such as .icloud.com).
	 */
	isUrlAllowed (urlString, allowedHosts, allowedSuffixes) {
		let parsed;
		try {
			parsed = new URL(urlString);
		} catch {
			Log.error("[MMM-EventCountdown] Invalid calendar URL (parse error).");
			return false;
		}

		if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
			Log.error("[MMM-EventCountdown] Only http/https URLs are allowed.");
			return false;
		}

		const host = parsed.hostname;
		if (BLOCKED_HOST_PATTERNS.some((p) => p.test(host))) {
			Log.error("[MMM-EventCountdown] Internal/private hosts are blocked (SSRF protection).");
			return false;
		}

		const hostAllowed = allowedHosts.includes(host)
			|| allowedSuffixes.some((suffix) => host.endsWith(suffix));

		if (!hostAllowed) {
			Log.error(`[MMM-EventCountdown] Host "${host}" is not in the allowedHosts whitelist.`);
			return false;
		}

		return true;
	},

	/**
	 * Fetch and parse an ICS feed. The URL is never logged.
	 * Uses AbortController so slow or stuck feeds cannot block the helper indefinitely.
	 */
	async fetchCalendar (calendarConfig, allowedHosts, allowedSuffixes) {
		const resolvedUrl = this.resolveUrl(calendarConfig.url);
		if (!resolvedUrl) {
			Log.error(`[MMM-EventCountdown] Could not resolve URL for calendar "${calendarConfig.name || "unnamed"}". Check config.env and SECRET_ variables.`);
			return [];
		}

		if (!this.isUrlAllowed(resolvedUrl, allowedHosts, allowedSuffixes)) {
			return [];
		}

		try {
			const controller = new AbortController();
			const timeoutMs = calendarConfig.fetchTimeout || 30000;
			const timeout = setTimeout(() => controller.abort(), timeoutMs);

			const response = await fetch(resolvedUrl, {
				signal: controller.signal,
				headers: { "User-Agent": "MagicMirror-MMM-EventCountdown" },
			});
			clearTimeout(timeout);

			if (!response.ok) {
				Log.error(`[MMM-EventCountdown] HTTP ${response.status} while fetching calendar "${calendarConfig.name || "unnamed"}".`);
				return [];
			}

			const icsData = await response.text();
			const parsed = nodeIcal.parseICS(icsData);
			return this.parseEvents(parsed);
		} catch (err) {
			if (err.name === "AbortError") {
				Log.error(`[MMM-EventCountdown] Timeout while fetching calendar "${calendarConfig.name || "unnamed"}".`);
			} else {
				Log.error(`[MMM-EventCountdown] Error fetching calendar "${calendarConfig.name || "unnamed"}": ${err.message}`);
			}
			return [];
		}
	},

	/**
	 * Convert node-ical objects into a uniform event format for the browser module.
	 * Full-day events are flagged here and filtered out later in the frontend.
	 */
	parseEvents (parsed) {
		const events = [];
		const now = Date.now();

		for (const key of Object.keys(parsed)) {
			const entry = parsed[key];
			if (!entry || entry.type !== "VEVENT") continue;

			const start = entry.start ? new Date(entry.start) : null;
			const end = entry.end ? new Date(entry.end) : start;
			if (!start || isNaN(start.getTime())) continue;

			// Skip events that ended more than 24 hours ago
			if (end && end.getTime() < now - 86400000) continue;

			// node-ical marks all-day events with datetype "date", or midnight-to-midnight spans
			const isFullDay = entry.datetype === "date" || (start.getHours() === 0 && start.getMinutes() === 0 && (!end || (end.getTime() - start.getTime()) >= 86400000));

			events.push({
				title: String(entry.summary || "Untitled"),
				startDate: Math.floor(start.getTime() / 1000),
				endDate: Math.floor((end ? end.getTime() : start.getTime()) / 1000),
				isFullDay,
			});
		}

		return events;
	},

	/** Fetch every configured calendar sequentially and merge the event lists. */
	async fetchAllCalendars (config) {
		const calendars = config.calendars || [];
		if (calendars.length === 0) {
			Log.warn("[MMM-EventCountdown] No calendars configured. Add URLs in config.js (see README).");
			return [];
		}

		const allowedHosts = [...DEFAULT_ALLOWED_HOSTS, ...(config.allowedHosts || [])];
		const allowedSuffixes = [...DEFAULT_ALLOWED_SUFFIXES];
		const allEvents = [];

		for (const cal of calendars) {
			const events = await this.fetchCalendar(cal, allowedHosts, allowedSuffixes);
			allEvents.push(...events);
		}

		return allEvents;
	},

	/** Browser asks for events → server fetches ICS → sends parsed list back via socket. */
	socketNotificationReceived (notification, payload) {
		if (notification === "FETCH_EVENTS") {
			this.fetchAllCalendars(payload)
				.then((events) => {
					this.sendSocketNotification("EVENTS", events);
				})
				.catch((err) => {
					Log.error(`[MMM-EventCountdown] Unexpected error: ${err.message}`);
					this.sendSocketNotification("EVENTS", []);
				});
		}
	},
});
