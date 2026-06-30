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
		showColons: false,         // Doppelpunkte zwischen den Zahlengruppen (z. B. 05:23:45)
		useUrgencyColors: true,    // true = Original-Farben je nach Restzeit | false = immer weiß
		unitWidth: 2.5,            // Feste Breite jeder Zahlengruppe in "0"-Breiten (ch)
		daysLabel: "DAYS",
		hoursLabel: "HOURS",
		minutesLabel: "MINUTES",
		secondsLabel: "SECONDS",
		size: "medium",            // "small" | "medium" | "large"
		groupGap: 1,               // Abstand zwischen Zahlengruppen in "0"-Breiten (1ch)
		noEventText: "NO SCHEDULED EVENT!",
		runningText: "is running",
		startsInText: "starts in",

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
		const size = this.config.size || "medium";
		const groupGap = Number(this.config.groupGap);
		wrapper.className = `event-countdown event-countdown--${size}`;
		wrapper.style.setProperty("--countdown-group-gap", `${Number.isFinite(groupGap) ? groupGap : 1}ch`);
		const unitWidth = Number(this.config.unitWidth);
		wrapper.style.setProperty("--countdown-unit-width", `${Number.isFinite(unitWidth) ? unitWidth : 2.5}ch`);

		if (!this.eventState.hasEvent) {
			wrapper.appendChild(this.el("div", "event-countdown__title light", this.config.noEventText));
			return wrapper;
		}

		const isRunning = this.eventState.isRunning;
		const now = Math.floor(Date.now() / 1000);
		const timeDiff = isRunning
			? this.eventState.endDate - now
			: this.eventState.startDate - now;
		const color = this.getCountdownColor(timeDiff, isRunning);

		wrapper.appendChild(this.el("div", "event-countdown__title light", (this.eventState.title || "").toUpperCase()));
		wrapper.appendChild(this.el("div", "event-countdown__subtitle light dimmed",
			isRunning ? this.config.runningText : this.config.startsInText));

		const diffDaysNum = Math.floor(timeDiff / 86400);
		const pad = (n) => String(n).padStart(2, "0");

		let values;
		let labels;
		if (diffDaysNum > 0) {
			values = [pad(diffDaysNum), pad(Math.floor((timeDiff % 86400) / 3600)), pad(Math.floor((timeDiff % 3600) / 60))];
			labels = [this.config.daysLabel, this.config.hoursLabel, this.config.minutesLabel];
		} else {
			values = [
				pad(Math.floor((timeDiff % 86400) / 3600)),
				pad(Math.floor((timeDiff % 3600) / 60)),
				pad(Math.floor(timeDiff % 60)),
			];
			labels = [this.config.hoursLabel, this.config.minutesLabel, this.config.secondsLabel];
		}

		const timer = document.createElement("div");
		timer.className = "event-countdown__timer";

		for (let i = 0; i < 3; i++) {
			if (i > 0 && this.config.showColons) {
				const colon = this.el("span", "event-countdown__colon thin", ":");
				colon.style.color = color;
				timer.appendChild(colon);
			}

			const column = document.createElement("div");
			column.className = "event-countdown__column";

			const value = this.el("span", "event-countdown__value thin", values[i]);
			value.style.color = color;
			column.appendChild(value);
			column.appendChild(this.el("span", "event-countdown__label light dimmed", labels[i]));
			timer.appendChild(column);
		}

		wrapper.appendChild(timer);

		if (this.config.showLight) {
			wrapper.appendChild(this.createTrafficLight(timeDiff, isRunning));
		}

		return wrapper;
	},

	el (tag, className, text) {
		const node = document.createElement(tag);
		if (className) node.className = className;
		if (text !== undefined && text !== null) node.textContent = text;
		return node;
	},

	createTrafficLight (timeDiff, isRunning) {
		const remainMinutes = Math.max(0, Math.floor(timeDiff / 60));
		const lightIndex = Math.min(5, Math.max(1, remainMinutes <= 3 ? remainMinutes + 1 : 5));
		const prefix = isRunning ? "lights_g" : "lights_r";

		const wrap = document.createElement("div");
		wrap.className = "event-countdown__light";
		const img = document.createElement("img");
		img.className = "event-countdown__light-img";
		img.src = `modules/MMM-EventCountdown/images/${prefix}${lightIndex}.png`;
		img.alt = isRunning ? "Event läuft" : "Countdown";
		wrap.appendChild(img);
		return wrap;
	},

	getCountdownColor (timeDiff, isRunning) {
		if (!this.config.useUrgencyColors) {
			return "#ffffff";
		}

		// Original-Farblogik (ppjoern): aufeinanderfolgende if-Blöcke, letzter Treffer gewinnt
		const REMAINING_TIME_1 = 60 * 60 * 24;  // 24 h
		const REMAINING_TIME_2 = 60 * 60;       // 1 h
		const REMAINING_TIME_3 = 60 * 20;       // 20 min
		const REMAINING_TIME_4 = 60 * 5;        // 5 min
		let cellColor;

		if (timeDiff < REMAINING_TIME_1 && !isRunning) {
			cellColor = "#00ff00";
		}
		if (timeDiff < REMAINING_TIME_2 && timeDiff > REMAINING_TIME_3 && !isRunning) {
			cellColor = "#ffff00";
		}
		if (timeDiff < REMAINING_TIME_3 && timeDiff > REMAINING_TIME_4 && !isRunning) {
			cellColor = "#ff9966";
		}
		if (timeDiff <= REMAINING_TIME_4 && !isRunning) {
			cellColor = "#ff6600";
		}
		if (isRunning) {
			cellColor = "#ffffff";
		}

		return cellColor || "#ffffff";
	},
});
