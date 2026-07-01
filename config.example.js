/**
 * MMM-EventCountdown – vollständiger Modul-Block für ~/MagicMirror/config/config.js
 *
 * Größe: rein CSS clamp(vmin) – skaliert pro Browser automatisch.
 * Feintuning: size, scale / scaleBrowser / scaleHdmi, unitWidth, groupGap
 */
{
	module: "MMM-EventCountdown",
	position: "middle_center",
	config: {
		calendars: [{ name: "Mein Kalender", url: "${SECRET_CAL_URL_1}" }],
		allowedHosts: [],
		fetchInterval: 60000,
		customInterval: 1000,

		showLight: true,
		showColons: false,
		useUrgencyColors: true,

		size: "xlarge",          // small | medium | large | xlarge
		unitWidth: 2.8,          // Spaltenbreite (ch)
		groupGap: 0.5,           // Abstand zwischen Gruppen (ch)
		scale: 1,                // optional: globaler Faktor
		// scaleBrowser: 1,      // optional: nur großer Screen
		// scaleHdmi: 1.1,       // optional: nur Pi/HDMI

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
