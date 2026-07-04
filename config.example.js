/**
 * MMM-EventCountdown – full module block for ~/MagicMirror/config/config.js
 *
 * Size uses CSS clamp(vmin) and scales automatically per browser/viewport.
 * Fine-tuning: size, scale, unitWidth, groupGap
 */
{
	module: "MMM-EventCountdown",
	position: "middle_center",
	config: {
		calendars: [{ name: "My Calendar", url: "${SECRET_CAL_URL_1}" }],
		allowedHosts: [],
		fetchInterval: 60000,
		customInterval: 1000,

		showLight: true,
		showColons: false,
		useUrgencyColors: true,

		size: "xlarge",          // small | medium | large | xlarge
		unitWidth: 2.8,          // column width (ch)
		groupGap: 0.5,           // gap between groups (ch)
		scale: 1,                // optional global size multiplier

		showDebugBorders: false,

		daysLabel: "DAYS",
		hoursLabel: "HOURS",
		minutesLabel: "MINUTES",
		secondsLabel: "SECONDS",
		noEventText: "NO SCHEDULED EVENT!",
		runningText: "is running",
		startsInText: "starts in",
	},
},
