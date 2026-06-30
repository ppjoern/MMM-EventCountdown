/* global Module, Log, moment */

/**
 * MMM-EventCountdown – Countdown zum nächsten Kalender-Event.
 *
 * Kalender-URLs gehören NICHT hierher, sondern in:
 *   ~/MagicMirror/config/config.env  →  SECRET_CAL_URL_1="https://..."
 *   ~/MagicMirror/config/config.js   →  calendars: [{ url: "${SECRET_CAL_URL_1}" }]
 *
 * Siehe README.md für die vollständige Anleitung.
 */
Module.register("MMM-EventCountdown", {

	defaults: {
		// --- Kalender-Konfiguration (URLs siehe README!) ---
		calendars: [
			// Beispiel – echte URL in config.env als SECRET_CAL_URL_1 hinterlegen:
			// { name: "Mein Kalender", url: "${SECRET_CAL_URL_1}" }
		],
		allowedHosts: [],          // Zusätzliche erlaubte Domains für SSRF-Whitelist
		fetchInterval: 60 * 1000,  // Wie oft der Server Kalender neu lädt (ms)
		customInterval: 1000,      // Wie oft der Countdown aktualisiert wird (ms)

		// --- Anzeige ---
		showLight: false,
		daysLabel: "DAYS",
		hoursLabel: "HOURS",
		minutesLabel: "MINUTES",
		secondsLabel: "SECONDS",
		size: "medium",            // "small" | "medium" | "large"

		// --- Fallback wenn kein Event gefunden ---
		event: "Kein Event",
		date: "2031-01-01",
		startDate: 1893452400,
		endDate: 1924988400,
	},

	// Event-State getrennt von this.config halten (Sicherheit: keine Daten in /config)
	eventState: {
		title: null,
		startDate: null,
		endDate: null,
		isRunning: false,
		hasEvent: false,
	},

	updateTimer: null,
	fetchTimer: null,

	start () {
		this.requestEvents();
		this.fetchTimer = setInterval(() => this.requestEvents(), this.config.fetchInterval);
		this.updateTimer = setInterval(() => this.updateDom(), this.config.customInterval);
	},

	stop () {
		if (this.fetchTimer) clearInterval(this.fetchTimer);
		if (this.updateTimer) clearInterval(this.updateTimer);
	},

	/**
	 * Fordert Events vom serverseitigen node_helper an.
	 * Die Kalender-URLs werden mitgeschickt (ggf. maskiert als **SECRET_...**),
	 * der node_helper löst sie serverseitig über process.env auf.
	 */
	requestEvents () {
		this.sendSocketNotification("FETCH_EVENTS", {
			calendars: this.config.calendars,
			allowedHosts: this.config.allowedHosts,
		});
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "EVENTS") {
			this.processEvents(payload);
		}
	},

	/**
	 * Filtert und wählt das nächste relevante Event aus.
	 */
	processEvents (events) {
		if (!Array.isArray(events) || events.length === 0) {
			this.eventState.hasEvent = false;
			this.updateDom();
			return;
		}

		const now = Math.floor(Date.now() / 1000);

		const filtered = events
			.filter((event) => {
				if (event.isFullDay) return false;
				return event.startDate > now || event.endDate > now;
			})
			.sort((a, b) => a.startDate - b.startDate);

		if (filtered.length === 0) {
			this.eventState.hasEvent = false;
			this.updateDom();
			return;
		}

		const next = filtered[0];
		this.eventState.title = next.title;
		this.eventState.startDate = next.startDate;
		this.eventState.endDate = next.endDate;
		this.eventState.hasEvent = true;

		if (now >= next.startDate && now <= next.endDate) {
			this.eventState.isRunning = true;
		} else {
			this.eventState.isRunning = false;
		}

		this.updateDom();
	},

	getStyles () {
		return ["MMM-EventCountdown.css"];
	},

	getDom () {
		const wrapper = document.createElement("div");
		wrapper.className = `event-countdown event-countdown--${this.config.size || "medium"}`;

		if (!this.eventState.hasEvent) {
			wrapper.appendChild(this.createTextElement("div", "event-countdown__title", "NO SCHEDULED EVENT!"));
			wrapper.appendChild(this.createTextElement("div", "event-countdown__subtitle", ""));
			return wrapper;
		}

		const isRunning = this.eventState.isRunning;
		const eventStart = this.eventState.startDate;
		const eventEnd = this.eventState.endDate;
		const now = Math.floor(Date.now() / 1000);

		const timeDiff = isRunning ? eventEnd - now : eventStart - now;

		// Titel – textContent statt innerHTML (XSS-Schutz)
		const titleEl = this.createTextElement("div", "event-countdown__title", (this.eventState.title || "").toUpperCase());
		wrapper.appendChild(titleEl);

		const subtitleText = isRunning ? "is running" : "starts in";
		wrapper.appendChild(this.createTextElement("div", "event-countdown__subtitle", subtitleText));

		const diffDays = Math.floor(timeDiff / 86400);
		const diffHours = Math.floor((timeDiff % 86400) / 3600);
		const diffMinutes = Math.floor((timeDiff % 3600) / 60);
		const diffSeconds = Math.floor(timeDiff % 60);

		const color = this.getCountdownColor(timeDiff, isRunning);

		const timerRow = document.createElement("div");
		timerRow.className = "event-countdown__timer";

		let values, labels;
		if (diffDays > 0) {
			values = [diffDays, diffHours, diffMinutes];
			labels = [this.config.daysLabel, this.config.hoursLabel, this.config.minutesLabel];
		} else {
			values = [diffHours, diffMinutes, diffSeconds];
			labels = [this.config.hoursLabel, this.config.minutesLabel, this.config.secondsLabel];
		}

		for (let i = 0; i < 3; i++) {
			timerRow.appendChild(this.createUnit(String(values[i]).padStart(2, "0"), labels[i], color));
		}

		wrapper.appendChild(timerRow);

		if (this.config.showLight) {
			wrapper.appendChild(this.createTrafficLight(timeDiff, isRunning));
		}

		return wrapper;
	},

	/**
	 * Erstellt ein Element mit textContent (kein innerHTML – XSS-sicher).
	 */
	createTextElement (tag, className, text) {
		const el = document.createElement(tag);
		el.className = className;
		el.textContent = text;
		return el;
	},

	createUnit (value, label, color) {
		const unit = document.createElement("div");
		unit.className = "event-countdown__unit";

		const valueEl = this.createTextElement("span", "event-countdown__value", value);
		valueEl.style.color = color;
		unit.appendChild(valueEl);

		unit.appendChild(this.createTextElement("span", "event-countdown__label", label));
		return unit;
	},

	getCountdownColor (timeDiff, isRunning) {
		if (isRunning) return "#ffffff";
		if (timeDiff <= 300) return "#ff6600";       // < 5 min
		if (timeDiff <= 1200) return "#ff9966";        // < 20 min
		if (timeDiff <= 3600) return "#ffff00";      // < 1 h
		if (timeDiff < 86400) return "#00ff00";      // < 24 h
		return "#ffffff";
	},

	createTrafficLight (timeDiff, isRunning) {
		const container = document.createElement("div");
		container.className = "event-countdown__light";

		const remainMinutes = Math.max(0, Math.floor(timeDiff / 60));
		const lightIndex = Math.min(5, Math.max(1, remainMinutes <= 3 ? remainMinutes + 1 : 5));
		const prefix = isRunning ? "lights_g" : "lights_r";

		const img = document.createElement("img");
		img.className = "event-countdown__light-img";
		img.alt = isRunning ? "Event läuft" : "Countdown";
		img.src = `modules/MMM-EventCountdown/images/${prefix}${lightIndex}.png`;

		container.appendChild(img);
		return container;
	},
});
