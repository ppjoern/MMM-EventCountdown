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
		unitWidth: 2.8,            // Spaltenbreite in Zeichenbreiten (ch)
		daysLabel: "DAYS",
		hoursLabel: "HOURS",
		minutesLabel: "MINUTES",
		secondsLabel: "SECONDS",
		size: "medium",            // "small" | "medium" | "large" | "xlarge"
		valueSize: null,           // Feste Größe – nur bei einem Display, sonst null
		scale: 1,                  // Manueller Faktor auf clamp-Größe (Fallback)
		scaleBrowser: null,        // Optional nur großer Screen (>1920px)
		scaleHdmi: null,           // Optional nur kleiner Screen (Pi/HDMI)
		showDebugBorders: false,
		groupGap: 0.5,
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
			wrapper.setAttribute("data-ec-debug", "1");
			this.ensureDebugStyles();
			wrapper.appendChild(this.createDebugBadge());
		}
		wrapper.style.setProperty("--ec-gap", `${Number.isFinite(groupGap) ? groupGap : 0.5}ch`);
		const unitWidth = Number(this.config.unitWidth);
		wrapper.style.setProperty("--ec-unit-width", `${Number.isFinite(unitWidth) ? unitWidth : 2.8}ch`);
		if (this.config.valueSize) {
			wrapper.style.setProperty("--ec-value-fluid", this.config.valueSize);
			wrapper.style.setProperty("--ec-scale", "1");
		} else {
			wrapper.style.setProperty("--ec-scale", String(this.getScale()));
		}

		if (!this.eventState.hasEvent) {
			wrapper.appendChild(this.el("div", "event-countdown__title light thin", this.config.noEventText));
			return wrapper;
		}

		const isRunning = this.eventState.isRunning;
		const now = Math.floor(Date.now() / 1000);
		const timeDiff = isRunning
			? this.eventState.endDate - now
			: this.eventState.startDate - now;
		const color = this.getCountdownColor(timeDiff, isRunning);

		wrapper.appendChild(this.el("div", "event-countdown__title light thin", (this.eventState.title || "").toUpperCase()));
		wrapper.appendChild(this.el("div", "event-countdown__subtitle light thin",
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
		if (this.config.showColons) {
			timer.classList.add("event-countdown__timer--colons");
		}

		for (let i = 0; i < 3; i++) {
			if (i > 0 && this.config.showColons) {
				const sep = document.createElement("div");
				sep.className = "event-countdown__sep";
				const colon = this.el("span", "event-countdown__colon thin", ":");
				colon.style.color = color;
				sep.appendChild(colon);
				timer.appendChild(sep);
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

	isDebugBorders () {
		try {
			if (typeof window !== "undefined" && window.location) {
				if (/[?&]debugBorders=1(?:&|$)/.test(window.location.search)) return true;
				if (window.localStorage && window.localStorage.getItem("MMM-EventCountdown-debug") === "1") {
					return true;
				}
			}
		} catch (e) {
			// localStorage blockiert (Safari privat etc.)
		}

		const cfg = this.config.showDebugBorders;
		return cfg === true || cfg === "true" || cfg === 1 || cfg === "1";
	},

	createDebugBadge () {
		const badge = document.createElement("div");
		badge.className = "event-countdown__debug-badge";
		badge.textContent = "DEBUG RAHMEN AN";
		badge.setAttribute("aria-hidden", "true");
		return badge;
	},

	/**
	 * Globales <style> ins Dokument – höhere Spezifität als MagicMirror-main.css
	 */
	ensureDebugStyles () {
		const id = "mmm-eventcountdown-debug-style";
		const existing = document.getElementById(id);
		if (existing) existing.remove();

		const style = document.createElement("style");
		style.id = id;
		// outline statt border → verändert keine Zellbreite (kein Überlappen)
		style.textContent = `
			.module.MMM-EventCountdown .event-countdown__debug-badge {
				display: block !important;
				margin: 0 auto 8px !important;
				padding: 6px 12px !important;
				width: fit-content !important;
				color: #000 !important;
				background: #ffff00 !important;
				outline: 3px solid #ff0000 !important;
				font-size: 16px !important;
				font-weight: 700 !important;
				line-height: 1.2 !important;
				letter-spacing: 0.05em !important;
				text-transform: uppercase !important;
			}
			.module.MMM-EventCountdown .event-countdown--debug {
				outline: 4px solid #ffff00 !important;
				outline-offset: 4px !important;
			}
			.module.MMM-EventCountdown .event-countdown--debug .event-countdown__timer {
				outline: 3px solid #ff9900 !important;
				outline-offset: 2px !important;
			}
			.module.MMM-EventCountdown .event-countdown--debug .event-countdown__column {
				outline: 3px solid #ff2222 !important;
				outline-offset: 1px !important;
				background: rgba(255, 0, 0, 0.12) !important;
			}
			.module.MMM-EventCountdown .event-countdown--debug .event-countdown__value {
				outline: 2px solid #00ccff !important;
				outline-offset: 0 !important;
				background: rgba(0, 204, 255, 0.1) !important;
			}
			.module.MMM-EventCountdown .event-countdown--debug .event-countdown__label {
				outline: 2px solid #00ff66 !important;
				outline-offset: 0 !important;
				background: rgba(0, 255, 102, 0.1) !important;
			}
			.module.MMM-EventCountdown .event-countdown--debug .event-countdown__title {
				outline: 2px solid #ff66ff !important;
			}
			.module.MMM-EventCountdown .event-countdown--debug .event-countdown__subtitle {
				outline: 2px solid #cc66ff !important;
			}
		`;
		document.head.appendChild(style);
	},

	/**
	 * Manueller Skalierungsfaktor (--ec-scale). Responsive Größe kommt aus CSS clamp().
	 */
	getScale () {
		const specific = this.isSmallScreen() ? this.config.scaleHdmi : this.config.scaleBrowser;
		const specificNum = Number(specific);
		if (specific != null && Number.isFinite(specificNum) && specificNum > 0) {
			return specificNum;
		}

		const fallback = Number(this.config.scale);
		return Number.isFinite(fallback) && fallback > 0 ? fallback : 1;
	},

	isSmallScreen () {
		const screenH = window.screen ? window.screen.height : 0;
		const screenW = window.screen ? window.screen.width : 0;
		return Math.max(screenH, screenW) <= 1920;
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
