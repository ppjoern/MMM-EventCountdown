const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
	computeEventPhase,
	formatCountdown,
	getCountdownColor,
	getTrafficLightIndex,
	normalizeDisplayConfig,
	THRESHOLD_20M,
	THRESHOLD_1H,
} = require("../lib/countdown.js");

describe("computeEventPhase", () => {
	it("counts down to start before the event", () => {
		const result = computeEventPhase(1000, 1600, 2200);
		assert.equal(result.isRunning, false);
		assert.equal(result.timeDiff, 600);
	});

	it("counts down to end while the event runs", () => {
		const result = computeEventPhase(1500, 1000, 2000);
		assert.equal(result.isRunning, true);
		assert.equal(result.timeDiff, 500);
	});

	it("detects running at exact start boundary", () => {
		const result = computeEventPhase(1000, 1000, 2000);
		assert.equal(result.isRunning, true);
	});
});

describe("formatCountdown", () => {
	const labels = {
		daysLabel: "DAYS",
		hoursLabel: "HOURS",
		minutesLabel: "MINUTES",
		secondsLabel: "SECONDS",
	};

	it("shows days, hours, and minutes above 24 h", () => {
		const result = formatCountdown(90000, labels);
		assert.deepEqual(result.values, ["01", "01", "00"]);
		assert.deepEqual(result.labels, ["DAYS", "HOURS", "MINUTES"]);
	});

	it("shows hours, minutes, and seconds under 24 h", () => {
		const result = formatCountdown(3661, labels);
		assert.deepEqual(result.values, ["01", "01", "01"]);
		assert.deepEqual(result.labels, ["HOURS", "MINUTES", "SECONDS"]);
	});
});

describe("getCountdownColor", () => {
	it("returns white when urgency colors are disabled", () => {
		assert.equal(getCountdownColor(100, false, false), "#ffffff");
	});

	it("returns green while running", () => {
		assert.equal(getCountdownColor(60, true, true), "#00ff00");
	});

	it("uses yellow between 20 min and 1 h", () => {
		assert.equal(getCountdownColor(THRESHOLD_20M + 1, false, true), "#ffff00");
		assert.equal(getCountdownColor(THRESHOLD_1H - 1, false, true), "#ffff00");
	});

	it("does not flash green at exactly 20 min", () => {
		assert.notEqual(getCountdownColor(THRESHOLD_20M, false, true), "#00ff00");
		assert.equal(getCountdownColor(THRESHOLD_20M, false, true), "#ff9966");
	});

	it("keeps green at exactly 1 h", () => {
		assert.equal(getCountdownColor(THRESHOLD_1H, false, true), "#00ff00");
	});

	it("uses dark orange at 5 min or less", () => {
		assert.equal(getCountdownColor(300, false, true), "#ff6600");
	});
});

describe("getTrafficLightIndex", () => {
	it("maps remaining minutes to image index", () => {
		assert.equal(getTrafficLightIndex(240), 5);
		assert.equal(getTrafficLightIndex(180), 4);
		assert.equal(getTrafficLightIndex(0), 2);
	});
});

describe("normalizeDisplayConfig", () => {
	it("falls back to safe defaults for invalid values", () => {
		const result = normalizeDisplayConfig({
			size: "huge",
			groupGap: "x",
			unitWidth: null,
			scale: -1,
			fontWeight: "heavy",
			showDebugBorders: "1",
		});
		assert.deepEqual(result, {
			size: "medium",
			groupGap: 0.5,
			unitWidth: 2.8,
			scale: 1,
			fontWeight: "thin",
			showDebugBorders: true,
		});
	});
});
