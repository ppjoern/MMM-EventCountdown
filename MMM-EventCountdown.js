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
		size: "medium",            // "small" | "medium" | "large" | "xlarge"
		valueSize: null,           // nur bei EINEM festen Display, sonst null
		scale: 1,                  // Fallback, wenn scaleBrowser/scaleHdmi nicht gesetzt
		scaleBrowser: null,        // Manuell für 4K-Browser (Screen > 1920px), z. B. 0.9
		scaleHdmi: null,           // Manuell für Pi/HDMI (Screen ≤ 1920px), z. B. 1.2
		adaptiveScale: true,       // Auto-Boost nur für Pi/HDMI (kleiner Screen)
		showDebugBorders: false,   // true = dicke Rahmen um alle Layout-Zellen
		groupGap: 1,
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
		if (this.isDebugBorders()) {
			wrapper.classList.add("event-countdown--debug");
			this.applyDebugBorder(wrapper, "#ffff00", 4);
		}
		wrapper.style.setProperty("--countdown-group-gap", `${Number.isFinite(groupGap) ? groupGap : 1}ch`);
		const unitWidth = Number(this.config.unitWidth);
		wrapper.style.setProperty("--countdown-unit-width", `${Number.isFinite(unitWidth) ? unitWidth : 2.5}ch`);
		if (this.config.valueSize) {
			wrapper.style.setProperty("--countdown-value-size-base", this.config.valueSize);
			wrapper.style.setProperty("--countdown-client-scale", "1");
		} else {
			wrapper.style.setProperty("--countdown-client-scale", String(this.getClientScale()));
		}

		if (!this.eventState.hasEvent) {
			const title = this.el("div", "event-countdown__title light thin", this.config.noEventText);
			this.applyDebugBorder(title, "#ff66ff");
			wrapper.appendChild(title);
			return wrapper;
		}

		const isRunning = this.eventState.isRunning;
		const now = Math.floor(Date.now() / 1000);
		const timeDiff = isRunning
			? this.eventState.endDate - now
			: this.eventState.startDate - now;
		const color = this.getCountdownColor(timeDiff, isRunning);

		const titleEl = this.el("div", "event-countdown__title light thin", (this.eventState.title || "").toUpperCase());
		this.applyDebugBorder(titleEl, "#ff66ff");
		wrapper.appendChild(titleEl);

		const subtitleEl = this.el("div", "event-countdown__subtitle light dimmed",
			isRunning ? this.config.runningText : this.config.startsInText);
		this.applyDebugBorder(subtitleEl, "#cc66ff");
		wrapper.appendChild(subtitleEl);

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
		this.applyDebugBorder(timer, "#ff9900");

		for (let i = 0; i < 3; i++) {
			if (i > 0 && this.config.showColons) {
				const colon = this.el("span", "event-countdown__colon thin", ":");
				colon.style.color = color;
				this.applyDebugBorder(colon, "#ffffff");
				timer.appendChild(colon);
			}

			const column = document.createElement("div");
			column.className = "event-countdown__column";
			this.applyDebugBorder(column, "#ff3333");

			const value = this.el("span", "event-countdown__value thin", values[i]);
			value.style.color = color;
			this.applyDebugBorder(value, "#33ccff");
			column.appendChild(value);

			const label = this.el("span", "event-countdown__label light dimmed", labels[i]);
			this.applyDebugBorder(label, "#33ff66");
			column.appendChild(label);
			timer.appendChild(column);
		}

		wrapper.appendChild(timer);

		if (this.config.showLight) {
			const light = this.createTrafficLight(timeDiff, isRunning);
			this.applyDebugBorder(light, "#ffcc00");
			wrapper.appendChild(light);
		}

		return wrapper;
	},

	el (tag, className, text) {
		const node = document.createElement(tag);
		if (className) node.className = className;
		if (text !== undefined && text !== null) node.textContent = text;
		return node;
	},

	isDebugBorders () {
		return this.config.showDebugBorders === true || this.config.showDebugBorders === "true";
	},

	/**
	 * Inline-Rahmen – überlebt MagicMirror-Global-CSS (outline auf span funktioniert oft nicht).
	 */
	applyDebugBorder (node, color, widthPx = 3) {
		if (!this.isDebugBorders() || !node || !node.style) return;
		node.style.setProperty("border", `${widthPx}px solid ${color}`, "important");
		node.style.setProperty("box-sizing", "border-box", "important");
		if (node.tagName === "SPAN") {
			node.style.setProperty("display", "inline-block", "important");
			node.style.setProperty("min-width", "1ch", "important");
		}
	},

	/**
	 * Pi/HDMI meldet typisch ≤1080p Screen, 4K-Browser >1920px.
	 */
	isHdmiMirror () {
		const screenH = window.screen ? window.screen.height : 0;
		const screenW = window.screen ? window.screen.width : 0;
		return Math.max(screenH, screenW) <= 1920;
	},

	/**
	 * Manueller Faktor pro Display-Typ (scaleBrowser / scaleHdmi).
	 * Fallback: scale
	 */
	getManualScale () {
		const specific = this.isHdmiMirror() ? this.config.scaleHdmi : this.config.scaleBrowser;
		const specificNum = Number(specific);
		if (specific != null && Number.isFinite(specificNum) && specificNum > 0) {
			return specificNum;
		}

		const fallback = Number(this.config.scale);
		return Number.isFinite(fallback) && fallback > 0 ? fallback : 1;
	},

	/**
	 * Skalierung pro Browser-Fenster.
	 * adaptiveScale boostet nur Pi/HDMI; 4K-Browser nutzen scaleBrowser.
	 */
	getClientScale () {
		let scale = this.getManualScale();

		if (this.config.adaptiveScale === false || !this.isHdmiMirror()) {
			return scale;
		}

		const h = window.innerHeight;

		if (h <= 800) scale *= 2.4;
		else if (h <= 1080) scale *= 2.1;
		else if (h <= 1200) scale *= 1.75;

		return scale;
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
			cellColor = "#00ff00";
		}

		return cellColor || "#ffffff";
	},
});
