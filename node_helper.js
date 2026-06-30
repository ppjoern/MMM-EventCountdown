/* global Log */

/**
 * Server-seitiger Helper: Holt Kalender-Events per ICS-URL.
 *
 * WICHTIG – Wo die URLs hingehören:
 *   Die Kalender-URLs werden NIEMALS in dieser Datei eingetragen.
 *   Sie gehören in die MagicMirror-Hauptkonfiguration:
 *
 *   1) ~/MagicMirror/config/config.env  (empfohlen, nicht im Browser sichtbar)
 *      SECRET_CAL_URL_1="https://calendar.google.com/calendar/ical/DEINE-ID/private-abc123/basic.ics"
 *
 *   2) ~/MagicMirror/config/config.js  (Modul-Block, siehe README)
 *      calendars: [{ name: "Mein Kalender", url: "${SECRET_CAL_URL_1}" }]
 *
 *   3) In config.js zusätzlich setzen:
 *      hideConfigSecrets: true
 *
 * Dieser Helper läuft nur auf dem Server (Node.js) und löst SECRET_-Platzhalter
 * über process.env auf – die echten URLs erreichen den Browser nie.
 */

const NodeHelper = require("node_helper");
const nodeIcal = require("node-ical");
const { URL } = require("url");

// Erlaubte Kalender-Domains (SSRF-Schutz). Bei Bedarf in der Modul-Config erweitern.
const DEFAULT_ALLOWED_HOSTS = [
	"calendar.google.com",
	"www.google.com",
	"outlook.office365.com",
	"outlook.live.com",
	"calendar.yahoo.com",
];

// Private/Interne IP-Bereiche blockieren (SSRF-Schutz)
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
		Log.info("[MMM-EventCountdown] node_helper gestartet – Kalender-Fetch läuft serverseitig.");
	},

	/**
	 * Löst URL-Platzhalter aus der Config auf.
	 * Unterstützt: "${SECRET_CAL_URL_1}", "**SECRET_CAL_URL_1**" (maskiert vom Browser)
	 */
	resolveUrl (rawUrl) {
		if (!rawUrl || typeof rawUrl !== "string") return null;

		// Maskierte Form aus dem Browser: **SECRET_CAL_URL_1**
		const masked = rawUrl.match(/^\*\*(SECRET_[A-Z0-9_]+)\*\*$/);
		if (masked) return process.env[masked[1]] || null;

		// Config-Platzhalter: ${SECRET_CAL_URL_1} oder ${CAL_URL_1}
		const envRef = rawUrl.match(/^\$\{([A-Z0-9_]+)\}$/);
		if (envRef) return process.env[envRef[1]] || null;

		// Direkte URL (nicht empfohlen, aber unterstützt)
		return rawUrl;
	},

	/**
	 * Validiert eine Kalender-URL bevor sie abgerufen wird.
	 */
	isUrlAllowed (urlString, allowedHosts) {
		let parsed;
		try {
			parsed = new URL(urlString);
		} catch {
			Log.error("[MMM-EventCountdown] Ungültige Kalender-URL (Parse-Fehler).");
			return false;
		}

		if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
			Log.error("[MMM-EventCountdown] Nur http/https-URLs erlaubt.");
			return false;
		}

		const host = parsed.hostname;
		if (BLOCKED_HOST_PATTERNS.some((p) => p.test(host))) {
			Log.error("[MMM-EventCountdown] Interne/private Hosts sind blockiert (SSRF-Schutz).");
			return false;
		}

		if (allowedHosts.length > 0 && !allowedHosts.includes(host)) {
			Log.error(`[MMM-EventCountdown] Host "${host}" nicht in allowedHosts-Whitelist.`);
			return false;
		}

		return true;
	},

	/**
	 * Holt und parst einen ICS-Feed. URL wird NICHT geloggt.
	 */
	async fetchCalendar (calendarConfig, allowedHosts) {
		const resolvedUrl = this.resolveUrl(calendarConfig.url);
		if (!resolvedUrl) {
			Log.error(`[MMM-EventCountdown] URL für Kalender "${calendarConfig.name || "unbenannt"}" konnte nicht aufgelöst werden. Prüfe config.env und SECRET_-Variablen.`);
			return [];
		}

		if (!this.isUrlAllowed(resolvedUrl, allowedHosts)) {
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
				Log.error(`[MMM-EventCountdown] HTTP ${response.status} beim Abruf von Kalender "${calendarConfig.name || "unbenannt"}".`);
				return [];
			}

			const icsData = await response.text();
			const parsed = nodeIcal.parseICS(icsData);
			return this.parseEvents(parsed, calendarConfig.name);
		} catch (err) {
			if (err.name === "AbortError") {
				Log.error(`[MMM-EventCountdown] Timeout beim Abruf von Kalender "${calendarConfig.name || "unbenannt"}".`);
			} else {
				Log.error(`[MMM-EventCountdown] Fehler beim Abruf von Kalender "${calendarConfig.name || "unbenannt"}": ${err.message}`);
			}
			return [];
		}
	},

	/**
	 * Wandelt node-ical-Objekte in ein einheitliches Event-Format um.
	 */
	parseEvents (parsed, calendarName) {
		const events = [];
		const now = Date.now();

		for (const key of Object.keys(parsed)) {
			const entry = parsed[key];
			if (!entry || entry.type !== "VEVENT") continue;

			const start = entry.start ? new Date(entry.start) : null;
			const end = entry.end ? new Date(entry.end) : start;
			if (!start || isNaN(start.getTime())) continue;

			// Vergangene Events (älter als 24h) überspringen
			if (end && end.getTime() < now - 86400000) continue;

			const isFullDay = entry.datetype === "date" || (start.getHours() === 0 && start.getMinutes() === 0 && (!end || (end.getTime() - start.getTime()) >= 86400000));

			events.push({
				title: String(entry.summary || "Ohne Titel"),
				startDate: Math.floor(start.getTime() / 1000),
				endDate: Math.floor((end ? end.getTime() : start.getTime()) / 1000),
				isFullDay,
				calendarName: calendarName || "",
				location: String(entry.location || ""),
			});
		}

		return events;
	},

	async fetchAllCalendars (config) {
		const calendars = config.calendars || [];
		if (calendars.length === 0) {
			Log.warn("[MMM-EventCountdown] Keine Kalender konfiguriert. Trage URLs in config.js ein (siehe README).");
			return [];
		}

		const allowedHosts = [...DEFAULT_ALLOWED_HOSTS, ...(config.allowedHosts || [])];
		const allEvents = [];

		for (const cal of calendars) {
			const events = await this.fetchCalendar(cal, allowedHosts);
			allEvents.push(...events);
		}

		return allEvents;
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "FETCH_EVENTS") {
			this.fetchAllCalendars(payload)
				.then((events) => {
					this.sendSocketNotification("EVENTS", events);
				})
				.catch((err) => {
					Log.error(`[MMM-EventCountdown] Unerwarteter Fehler: ${err.message}`);
					this.sendSocketNotification("EVENTS", []);
				});
		}
	},
});
