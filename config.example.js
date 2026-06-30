/**
 * MMM-EventCountdown – vollständiger Modul-Block für ~/MagicMirror/config/config.js
 *
 * In config.env (geheime URL):
 *   SECRET_CAL_URL_1="https://calendar.google.com/calendar/ical/.../basic.ics"
 *
 * In config.js (Root-Level):
 *   hideConfigSecrets: true,
 */
{
	module: "MMM-EventCountdown",
	position: "middle_center",
	header: "",
	classes: "",
	disabled: false,

	config: {
		// --- Kalender (echte URLs in config.env, hier nur Verweis!) ---
		calendars: [
			{
				name: "Mein Kalender",
				url: "${SECRET_CAL_URL_1}",
				fetchTimeout: 30000,
			},
			// {
			// 	name: "Arbeit",
			// 	url: "${SECRET_CAL_URL_2}",
			// 	fetchTimeout: 30000,
			// },
		],
		allowedHosts: [],

		// --- Aktualisierung ---
		fetchInterval: 60000,
		customInterval: 1000,

		// --- Darstellung ---
		showLight: true,
		showColons: false,
		useUrgencyColors: true,
		unitWidth: 2.5,
		size: "medium",
		groupGap: 1,
		showDebugBorders: false,

		// --- Beschriftungen ---
		daysLabel: "DAYS",
		hoursLabel: "HOURS",
		minutesLabel: "MINUTES",
		secondsLabel: "SECONDS",
		noEventText: "NO SCHEDULED EVENT!",
		runningText: "is running",
		startsInText: "starts in",
	},
},
