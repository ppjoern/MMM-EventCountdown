/**
 * MMM-EventCountdown – Modul-Block zum Einfügen in ~/MagicMirror/config/config.js
 *
 * Voraussetzung in config.env:
 *   SECRET_CAL_URL_1="https://calendar.google.com/calendar/ical/.../basic.ics"
 *
 * Voraussetzung in config.js (Root-Level):
 *   hideConfigSecrets: true,
 */
{
	module: "MMM-EventCountdown",
	position: "middle_center", // top_bar | top_left | top_center | top_right | upper_third | middle_center | lower_third | bottom_left | bottom_center | bottom_right | ...
	header: "",                // optional: Überschrift über dem Modul
	classes: "",               // optional: zusätzliche CSS-Klassen für den Modul-Container
	disabled: false,

	config: {
		// --- Kalender (URLs in config.env, NICHT hier!) ---
		calendars: [
			{
				name: "Mein Kalender",
				url: "${SECRET_CAL_URL_1}",
				fetchTimeout: 30000, // optional: Timeout pro Kalender-Abruf in ms
			},
			// {
			// 	name: "Arbeit",
			// 	url: "${SECRET_CAL_URL_2}",
			// },
		],
		allowedHosts: [], // Zusätzliche erlaubte Kalender-Domains, z. B. ["mein-server.example.com"]

		// --- Aktualisierung ---
		fetchInterval: 60000,  // Kalender neu laden (ms) – Standard: 60 Sekunden
		customInterval: 1000,  // Countdown-Anzeige aktualisieren (ms) – Standard: 1 Sekunde

		// --- Darstellung ---
		showLight: true,        // Ampel-Grafik anzeigen
		showColons: false,      // true = 05:23:45  |  false = 052345 (kompakt, wie Original)
		useUrgencyColors: true, // true = Original-Farben je nach Restzeit | false = immer weiß
		unitWidth: 2.5,         // Feste Breite jeder Zahlengruppe (in "0"-Breiten)
		size: "medium",         // "small" | "medium" | "large"
		groupGap: 1,        // Abstand zwischen Zahlengruppen in "0"-Breiten (1 = eine Null breit)

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
