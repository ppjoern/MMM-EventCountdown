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
		daysLabel: "DAYS",
		hoursLabel: "HOURS",
		minutesLabel: "MINUTES",
		secondsLabel: "SECONDS",
		size: "medium",            // "small" | "medium" | "large"
		groupGap: "1ch",           // Abstand zwischen Zahlengruppen (z. B. "1ch", "0.5ch")
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
		wrapper.className = `event-countdown event-countdown--${size}`;

		if (!this.eventState.hasEvent) {
			const table = document.createElement("table");
			table.className = "tableCountdown";

			const headRow = document.createElement("tr");
			const headCell = document.createElement("th");
			headCell.className = "light tableHead";
			headCell.colSpan = 3;
			headCell.textContent = this.config.noEventText;
			headRow.appendChild(headCell);
			table.appendChild(headRow);

			wrapper.appendChild(table);
			return wrapper;
		}

		const isRunning = this.eventState.isRunning;
		const eventStart = this.eventState.startDate;
		const eventEnd = this.eventState.endDate;
		const now = Math.floor(Date.now() / 1000);
		const timeDiff = isRunning ? eventEnd - now : eventStart - now;
		const color = this.getCountdownColor(timeDiff, isRunning);
		const colCount = this.config.showColons ? 5 : 3;

		const diffDaysNum = Math.floor(timeDiff / 86400);
		let diffDays = diffDaysNum;
		let diffHours = Math.floor((timeDiff % 86400) / 3600);
		let diffMinutes = Math.floor((timeDiff % 3600) / 60);
		let diffSeconds = Math.floor(timeDiff % 60);

		if (diffDays < 10) diffDays = "0" + diffDays;
		if (diffHours < 10) diffHours = "0" + diffHours;
		if (diffMinutes < 10) diffMinutes = "0" + diffMinutes;
		if (diffSeconds < 10) diffSeconds = "0" + diffSeconds;

		const table = document.createElement("table");
		table.className = "tableCountdown";

		const headRow = document.createElement("tr");
		const headCell = document.createElement("th");
		headCell.className = "light tableHead";
		headCell.colSpan = colCount;
		headCell.textContent = (this.eventState.title || "").toUpperCase();
		headRow.appendChild(headCell);
		table.appendChild(headRow);

		const titleRow = document.createElement("tr");
		const titleCell = document.createElement("td");
		titleCell.className = "light dimmed tableFooterlow";
		titleCell.colSpan = colCount;
		titleCell.textContent = isRunning ? this.config.runningText : this.config.startsInText;
		titleRow.appendChild(titleCell);
		table.appendChild(titleRow);

		let values;
		let labels;
		if (diffDaysNum > 0) {
			values = [diffDays, diffHours, diffMinutes];
			labels = [this.config.daysLabel, this.config.hoursLabel, this.config.minutesLabel];
		} else {
			values = [diffHours, diffMinutes, diffSeconds];
			labels = [this.config.hoursLabel, this.config.minutesLabel, this.config.secondsLabel];
		}

		const timeRow = document.createElement("tr");
		for (let i = 0; i < 3; i++) {
			if (i > 0 && this.config.showColons) {
				const colonCell = document.createElement("td");
				colonCell.className = "tableColon thin";
				colonCell.textContent = ":";
				colonCell.style.color = color;
				timeRow.appendChild(colonCell);
			}

			const valueCell = document.createElement("td");
			valueCell.className = "tableTime thin";
			valueCell.textContent = values[i];
			valueCell.style.color = color;
			timeRow.appendChild(valueCell);
		}
		table.appendChild(timeRow);

		const labelRow = document.createElement("tr");
		for (let i = 0; i < 3; i++) {
			if (i > 0 && this.config.showColons) {
				const colonSpacer = document.createElement("td");
				colonSpacer.className = "tableColonSpacer";
				labelRow.appendChild(colonSpacer);
			}

			const labelCell = document.createElement("td");
			labelCell.className = "tableFooter light dimmed";
			labelCell.textContent = labels[i];
			labelRow.appendChild(labelCell);
		}
		table.appendChild(labelRow);

		if (this.config.showLight) {
			const remainMinutes = Math.max(0, Math.floor(timeDiff / 60));
			const lightIndex = Math.min(5, Math.max(1, remainMinutes <= 3 ? remainMinutes + 1 : 5));
			const prefix = isRunning ? "lights_g" : "lights_r";
			const lightHeight = 85;

			const lightRow = document.createElement("tr");
			lightRow.className = "tableTime";
			const lightCell = document.createElement("td");
			lightCell.className = "tableHead";
			lightCell.colSpan = colCount;

			const img = document.createElement("img");
			img.src = `modules/MMM-EventCountdown/images/${prefix}${lightIndex}.png`;
			img.height = lightHeight;
			img.alt = isRunning ? "Event läuft" : "Countdown";
			lightCell.appendChild(img);

			lightRow.appendChild(lightCell);
			table.appendChild(lightRow);
		}

		wrapper.appendChild(table);
		return wrapper;
	},

	getCountdownColor (timeDiff, isRunning) {
		if (isRunning) return "#00ff00";
		if (timeDiff <= 300) return "#ff6600";
		if (timeDiff <= 1200) return "#ff9966";
		if (timeDiff <= 3600) return "#ffff00";
		if (timeDiff < 86400) return "#00ff00";
		return "#ffffff";
	},
});
