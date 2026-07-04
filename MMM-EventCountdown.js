/* global Module */

/**
 * MMM-EventCountdown – countdown to the next calendar event.
 *
 * Calendar URLs do NOT belong here. Configure them in:
 *   ~/MagicMirror/config/config.env  →  SECRET_CAL_URL_1="https://..."
 *   ~/MagicMirror/config/config.js   →  calendars: [{ url: "${SECRET_CAL_URL_1}" }]
 *
 * See README.md for the full setup guide.
 */
Module.register("MMM-EventCountdown", {

	defaults: {
		// --- Calendar (URLs – see README) ---
		calendars: [
			// Example – put the real URL in config.env as SECRET_CAL_URL_1:
			// { name: "My Calendar", url: "${SECRET_CAL_URL_1}" }
		],
		allowedHosts: [],          // Extra domains for the SSRF whitelist
		fetchInterval: 60 * 1000,  // How often the server reloads calendars (ms)
		customInterval: 1000,      // Countdown tick interval (ms)

		// --- Display ---
		showLight: false,
		showColons: false,         // Colons between groups (e.g. 05:23:45)
		useUrgencyColors: true,    // true = urgency colors | false = always white
		unitWidth: 2.8,            // Column width in character units (ch)
		daysLabel: "DAYS",
		hoursLabel: "HOURS",
		minutesLabel: "MINUTES",
		secondsLabel: "SECONDS",
		size: "medium",            // "small" | "medium" | "large" | "xlarge"
		valueSize: null,           // Fixed font size – only for a single display
		scale: 1,                  // Manual multiplier on the clamp-based size
		showDebugBorders: false,
		groupGap: 0.5,
		noEventText: "NO SCHEDULED EVENT!",
		runningText: "is running",
		startsInText: "starts in",
	},

	// Keep event data separate from this.config (secrets must not appear in /config)
	eventState: {
		title: null,
		startDate: null,
		endDate: null,
		isRunning: false,
		hasEvent: false,
	},

	updateTimer: null,
	fetchTimer: null,

	/** Start periodic calendar fetch (server) and DOM refresh (browser). */
	start () {
		this.requestEvents();
		this.fetchTimer = setInterval(() => this.requestEvents(), this.config.fetchInterval);
		this.updateTimer = setInterval(() => this.updateDom(), this.config.customInterval);
	},

	/** Clear timers when MagicMirror unloads the module. */
	stop () {
		if (this.fetchTimer) clearInterval(this.fetchTimer);
		if (this.updateTimer) clearInterval(this.updateTimer);
	},

	/** Ask the server-side node_helper to fetch calendar events. */
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
	 * Pick the next relevant event from the fetched list.
	 * Skips all-day entries and events that already ended; keeps events still running.
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
				// Include upcoming events and events currently in progress
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
		this.eventState.isRunning = now >= next.startDate && now <= next.endDate;

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

		// Layout tokens consumed by MMM-EventCountdown.css (--ec-gap, --ec-unit-width, --ec-scale)
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
		// Count down to start while waiting; count down to end while the event runs
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
		// More than 24 h left → show days/hours/minutes; otherwise hours/minutes/seconds
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
			// Colon sits inside groupGap width so spacing is not doubled (see CSS)
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

	/** Safe DOM helper – always uses textContent to avoid XSS from calendar titles. */
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
			// localStorage blocked (private browsing, etc.)
		}

		const cfg = this.config.showDebugBorders;
		return cfg === true || cfg === "true" || cfg === 1 || cfg === "1";
	},

	createDebugBadge () {
		const badge = document.createElement("div");
		badge.className = "event-countdown__debug-badge";
		badge.textContent = "DEBUG BORDERS ON";
		badge.setAttribute("aria-hidden", "true");
		return badge;
	},

	/**
	 * Inject high-specificity debug styles (outline avoids layout shift).
	 * Kept in JS so it reliably overrides MagicMirror's global CSS.
	 */
	ensureDebugStyles () {
		const id = "mmm-eventcountdown-debug-style";
		const existing = document.getElementById(id);
		if (existing) existing.remove();

		const style = document.createElement("style");
		style.id = id;
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

	/** Manual scale factor applied via --ec-scale. Base size comes from CSS clamp(). */
	getScale () {
		const scale = Number(this.config.scale);
		return Number.isFinite(scale) && scale > 0 ? scale : 1;
	},

	/**
	 * Traffic-light image under the countdown (images/lights_r*.png / lights_g*.png).
	 * Index 1–5 maps to remaining minutes: ≤3 min uses r2–r4, otherwise r5/g5.
	 */
	createTrafficLight (timeDiff, isRunning) {
		const remainMinutes = Math.max(0, Math.floor(timeDiff / 60));
		// 4 min → index 5, 3 min → 4, 2 min → 3, 1 min → 2, 0 min → 2 (clamped)
		const lightIndex = Math.min(5, Math.max(1, remainMinutes <= 3 ? remainMinutes + 1 : 5));
		const prefix = isRunning ? "lights_g" : "lights_r";

		const wrap = document.createElement("div");
		wrap.className = "event-countdown__light";
		const img = document.createElement("img");
		img.className = "event-countdown__light-img";
		img.src = `modules/MMM-EventCountdown/images/${prefix}${lightIndex}.png`;
		img.alt = isRunning ? "Event in progress" : "Countdown";
		wrap.appendChild(img);
		return wrap;
	},

	/**
	 * Urgency colors for countdown digits (original ppjoern logic).
	 * Uses sequential if-blocks – later conditions override earlier ones.
	 */
	getCountdownColor (timeDiff, isRunning) {
		if (!this.config.useUrgencyColors) {
			return "#ffffff";
		}

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
