const SECONDS_PER_DAY = 86400;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

const THRESHOLD_24H = SECONDS_PER_DAY;
const THRESHOLD_1H = SECONDS_PER_HOUR;
const THRESHOLD_20M = 20 * SECONDS_PER_MINUTE;
const THRESHOLD_5M = 5 * SECONDS_PER_MINUTE;

const VALID_SIZES = new Set(["small", "medium", "large", "xlarge"]);
const VALID_FONT_WEIGHTS = new Set(["thin", "medium", "bold"]);

/**
 * Derive running state and remaining seconds from timestamps.
 * Computed at render time so transitions stay in sync with the countdown tick.
 */
function computeEventPhase (now, startDate, endDate) {
	const isRunning = now >= startDate && now <= endDate;
	const timeDiff = isRunning ? endDate - now : startDate - now;
	return { isRunning, timeDiff };
}

function padTwo (n) {
	return String(n).padStart(2, "0");
}

/**
 * Format countdown digits and labels for the three-column display.
 */
function formatCountdown (timeDiff, labels) {
	const diffDaysNum = Math.floor(timeDiff / SECONDS_PER_DAY);

	if (diffDaysNum > 0) {
		return {
			values: [
				padTwo(diffDaysNum),
				padTwo(Math.floor((timeDiff % SECONDS_PER_DAY) / SECONDS_PER_HOUR)),
				padTwo(Math.floor((timeDiff % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)),
			],
			labels: [labels.daysLabel, labels.hoursLabel, labels.minutesLabel],
		};
	}

	return {
		values: [
			padTwo(Math.floor((timeDiff % SECONDS_PER_DAY) / SECONDS_PER_HOUR)),
			padTwo(Math.floor((timeDiff % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)),
			padTwo(Math.floor(timeDiff % SECONDS_PER_MINUTE)),
		],
		labels: [labels.hoursLabel, labels.minutesLabel, labels.secondsLabel],
	};
}

/**
 * Urgency color for countdown digits (priority-ordered thresholds, gap-free).
 */
function getCountdownColor (timeDiff, isRunning, useUrgencyColors = true) {
	if (!useUrgencyColors) {
		return "#ffffff";
	}
	if (isRunning) {
		return "#00ff00";
	}
	if (timeDiff <= THRESHOLD_5M) {
		return "#ff6600";
	}
	if (timeDiff <= THRESHOLD_20M && timeDiff > THRESHOLD_5M) {
		return "#ff9966";
	}
	if (timeDiff < THRESHOLD_1H && timeDiff > THRESHOLD_20M) {
		return "#ffff00";
	}
	if (timeDiff < THRESHOLD_24H) {
		return "#00ff00";
	}
	return "#ffffff";
}

/** Traffic-light image index (1–5) from remaining minutes. */
function getTrafficLightIndex (timeDiff) {
	const remainMinutes = Math.max(0, Math.floor(timeDiff / SECONDS_PER_MINUTE));
	return Math.min(5, Math.max(1, remainMinutes <= 3 ? remainMinutes + 1 : 5));
}

function coerceBoolean (value) {
	return value === true || value === "true" || value === 1 || value === "1";
}

/**
 * Normalize display-related config once at module start (not on every DOM tick).
 */
function normalizeDisplayConfig (config) {
	const size = VALID_SIZES.has(config.size) ? config.size : "medium";
	const groupGap = Number(config.groupGap);
	const unitWidth = Number(config.unitWidth);
	const scale = Number(config.scale);

	return {
		size,
		groupGap: Number.isFinite(groupGap) ? groupGap : 0.5,
		unitWidth: Number.isFinite(unitWidth) ? unitWidth : 2.8,
		scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
		fontWeight: VALID_FONT_WEIGHTS.has(config.fontWeight) ? config.fontWeight : "thin",
		showDebugBorders: coerceBoolean(config.showDebugBorders),
	};
}

const api = {
	computeEventPhase,
	formatCountdown,
	getCountdownColor,
	getTrafficLightIndex,
	normalizeDisplayConfig,
	THRESHOLD_24H,
	THRESHOLD_1H,
	THRESHOLD_20M,
	THRESHOLD_5M,
};

if (typeof module !== "undefined" && module.exports) {
	module.exports = api;
}
if (typeof window !== "undefined") {
	window.MMMECCountdown = api;
}
