const nodeIcal = require("node-ical");
const { URL } = require("url");

const DEFAULT_ALLOWED_HOSTS = [
	"calendar.google.com",
	"www.google.com",
	"outlook.office365.com",
	"outlook.live.com",
	"calendar.yahoo.com",
	"icloud.com",
	"caldav.icloud.com",
];

const DEFAULT_ALLOWED_SUFFIXES = [
	".icloud.com",
];

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

const EXPAND_LOOKBACK_MS = 86400000;
const EXPAND_LOOKAHEAD_MS = 365 * 86400000;
const MAX_REDIRECTS = 5;

/**
 * Resolve URL placeholders from config.
 * Supports: "${SECRET_CAL_URL_1}", "**SECRET_CAL_URL_1**" (masked by the browser)
 */
function resolveUrl (rawUrl, env = process.env) {
	if (!rawUrl || typeof rawUrl !== "string") {
		return null;
	}

	const masked = rawUrl.match(/^\*\*(SECRET_[A-Z0-9_]+)\*\*$/);
	if (masked) {
		return env[masked[1]] || null;
	}

	const envRef = rawUrl.match(/^\$\{([A-Z0-9_]+)\}$/);
	if (envRef) {
		return env[envRef[1]] || null;
	}

	return rawUrl;
}

/**
 * Validate a calendar URL before fetching.
 */
function isUrlAllowed (urlString, allowedHosts, allowedSuffixes, blockedPatterns = BLOCKED_HOST_PATTERNS) {
	let parsed;
	try {
		parsed = new URL(urlString);
	} catch {
		return { ok: false, reason: "parse" };
	}

	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
		return { ok: false, reason: "protocol" };
	}

	const host = parsed.hostname;
	if (blockedPatterns.some((pattern) => pattern.test(host))) {
		return { ok: false, reason: "blocked" };
	}

	const hostAllowed = allowedHosts.includes(host)
		|| allowedSuffixes.some((suffix) => host.endsWith(suffix));

	if (!hostAllowed) {
		return { ok: false, reason: "whitelist", host };
	}

	return { ok: true, parsed };
}

function isFullDayEvent (entry, start, end) {
	if (entry.isFullDay === true) {
		return true;
	}
	if (entry.datetype === "date") {
		return true;
	}
	if (!start) {
		return false;
	}
	return start.getHours() === 0
		&& start.getMinutes() === 0
		&& (!end || (end.getTime() - start.getTime()) >= 86400000);
}

function toDate (value) {
	if (!value) {
		return null;
	}
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}
	if (typeof value === "number" || typeof value === "string") {
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}
	if (typeof value.epochMilliseconds === "number") {
		return new Date(value.epochMilliseconds);
	}
	if (typeof value.valueOf === "function") {
		const parsed = new Date(value.valueOf());
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}
	return null;
}

function toEventRecord (title, startValue, endValue, isFullDay) {
	const start = toDate(startValue);
	const end = toDate(endValue) || start;
	if (!start) {
		return null;
	}

	return {
		title: String(title || "Untitled"),
		startDate: Math.floor(start.getTime() / 1000),
		endDate: Math.floor(end.getTime() / 1000),
		isFullDay,
	};
}

function expandEventInstances (entry, nowMs) {
	if (!entry.rrule || typeof nodeIcal.expandRecurringEvent !== "function") {
		return [entry];
	}

	try {
		const instances = nodeIcal.expandRecurringEvent(entry, {
			from: new Date(nowMs - EXPAND_LOOKBACK_MS),
			to: new Date(nowMs + EXPAND_LOOKAHEAD_MS),
			expandOngoing: true,
		});
		return instances.length > 0 ? instances : [entry];
	} catch {
		return [entry];
	}
}

/**
 * Convert node-ical objects into a uniform event format for the browser module.
 * Expands recurring events (RRULE) into upcoming instances.
 */
function parseEvents (parsed, nowMs = Date.now()) {
	const events = [];

	for (const key of Object.keys(parsed)) {
		const entry = parsed[key];
		if (!entry || entry.type !== "VEVENT") {
			continue;
		}

		const instances = expandEventInstances(entry, nowMs);

		for (const instance of instances) {
			const start = toDate(instance.start);
			const end = toDate(instance.end) || start;

			if (end && end.getTime() < nowMs - EXPAND_LOOKBACK_MS) {
				continue;
			}

			const isFullDay = isFullDayEvent(instance, start, end);
			const record = toEventRecord(instance.summary || entry.summary, start, end, isFullDay);
			if (record) {
				events.push(record);
			}
		}
	}

	return events;
}

/**
 * Block private/internal hosts on redirect targets (SSRF via redirect).
 */
function isRedirectTargetSafe (urlString, blockedPatterns = BLOCKED_HOST_PATTERNS) {
	let parsed;
	try {
		parsed = new URL(urlString);
	} catch {
		return { ok: false, reason: "parse" };
	}

	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
		return { ok: false, reason: "protocol" };
	}

	if (blockedPatterns.some((pattern) => pattern.test(parsed.hostname))) {
		return { ok: false, reason: "blocked" };
	}

	return { ok: true };
}

/**
 * Fetch a calendar URL. The initial URL must pass the full SSRF allowlist;
 * redirect hops only block private/internal targets (calendar CDNs vary by provider).
 */
async function fetchCalendarResponse (urlString, fetchOptions = {}, allowedHosts, allowedSuffixes) {
	const allowed = isUrlAllowed(urlString, allowedHosts, allowedSuffixes);
	if (!allowed.ok) {
		return { ok: false, reason: allowed.reason, host: allowed.host };
	}

	let currentUrl = urlString;

	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const response = await fetch(currentUrl, {
			...fetchOptions,
			redirect: "manual",
		});

		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get("location");
			if (!location) {
				return { ok: false, reason: "redirect" };
			}
			currentUrl = new URL(location, currentUrl).href;
			const safe = isRedirectTargetSafe(currentUrl);
			if (!safe.ok) {
				return { ok: false, reason: safe.reason };
			}
			continue;
		}

		return { ok: true, response };
	}

	return { ok: false, reason: "redirect-limit" };
}

module.exports = {
	DEFAULT_ALLOWED_HOSTS,
	DEFAULT_ALLOWED_SUFFIXES,
	BLOCKED_HOST_PATTERNS,
	resolveUrl,
	isUrlAllowed,
	parseEvents,
	isRedirectTargetSafe,
	fetchCalendarResponse,
};
