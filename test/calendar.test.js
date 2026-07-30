const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const nodeIcal = require("node-ical");
const {
	resolveUrl,
	isUrlAllowed,
	parseEvents,
	DEFAULT_ALLOWED_HOSTS,
	DEFAULT_ALLOWED_SUFFIXES,
} = require("../lib/calendar.js");

describe("resolveUrl", () => {
	it("resolves ${SECRET_*} placeholders from env", () => {
		const url = resolveUrl("${SECRET_CAL_URL_1}", { SECRET_CAL_URL_1: "https://calendar.google.com/test.ics" });
		assert.equal(url, "https://calendar.google.com/test.ics");
	});

	it("resolves **SECRET_*** masked placeholders from env", () => {
		const url = resolveUrl("**SECRET_CAL_URL_2**", { SECRET_CAL_URL_2: "https://calendar.google.com/masked.ics" });
		assert.equal(url, "https://calendar.google.com/masked.ics");
	});

	it("returns raw URLs unchanged", () => {
		const url = resolveUrl("https://calendar.google.com/raw.ics", {});
		assert.equal(url, "https://calendar.google.com/raw.ics");
	});
});

describe("isUrlAllowed", () => {
	const allowedHosts = [...DEFAULT_ALLOWED_HOSTS];
	const allowedSuffixes = [...DEFAULT_ALLOWED_SUFFIXES];

	it("allows known calendar hosts over https", () => {
		const result = isUrlAllowed("https://calendar.google.com/calendar.ics", allowedHosts, allowedSuffixes);
		assert.equal(result.ok, true);
	});

	it("allows iCloud subdomains via suffix", () => {
		const result = isUrlAllowed("https://p42-caldav.icloud.com/published/2/test.ics", allowedHosts, allowedSuffixes);
		assert.equal(result.ok, true);
	});

	it("blocks private hosts", () => {
		const result = isUrlAllowed("https://192.168.1.10/calendar.ics", allowedHosts, allowedSuffixes);
		assert.equal(result.ok, false);
		assert.equal(result.reason, "blocked");
	});

	it("blocks unknown public hosts", () => {
		const result = isUrlAllowed("https://evil.example.com/calendar.ics", allowedHosts, allowedSuffixes);
		assert.equal(result.ok, false);
		assert.equal(result.reason, "whitelist");
	});
});

describe("parseEvents", () => {
	const nowMs = Date.parse("2026-07-30T12:00:00Z");

	it("skips events that ended more than 24 h ago", () => {
		const events = parseEvents({
			old: {
				type: "VEVENT",
				summary: "Past",
				start: new Date("2026-07-28T10:00:00Z"),
				end: new Date("2026-07-28T11:00:00Z"),
			},
		}, nowMs);
		assert.equal(events.length, 0);
	});

	it("flags all-day events", () => {
		const events = parseEvents({
			allday: {
				type: "VEVENT",
				summary: "Holiday",
				start: new Date("2026-07-31T00:00:00Z"),
				end: new Date("2026-08-01T00:00:00Z"),
				datetype: "date",
			},
		}, nowMs);
		assert.equal(events.length, 1);
		assert.equal(events[0].isFullDay, true);
	});

	it("expands weekly recurring events into upcoming instances", () => {
		const parsed = nodeIcal.parseICS(`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test-weekly@example.com
SUMMARY:Standup
DTSTART:20260701T090000Z
DTEND:20260701T093000Z
RRULE:FREQ=WEEKLY
END:VEVENT
END:VCALENDAR`);
		const events = parseEvents(parsed, nowMs);

		assert.ok(events.length >= 1);
		assert.ok(events.some((event) => event.startDate >= Math.floor(nowMs / 1000)));
	});

	it("allows redirect targets outside the calendar host allowlist", () => {
		const { isRedirectTargetSafe } = require("../lib/calendar.js");
		const result = isRedirectTargetSafe("https://calendar-pa.clients6.google.com/calendar.ics");
		assert.equal(result.ok, true);
	});
});
