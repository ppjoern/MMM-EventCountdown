/* global Module, MMMECCountdown */

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
		fontWeight: "thin",          // "thin" | "medium" | "bold" – countdown digits only
		noEventText: "NO SCHEDULED EVENT!",
		runningText: "is running",
		startsInText: "starts in",
	},

	updateTimer: null,
	fetchTimer: null,
	suspended: false,
	display: null,

	getCountdownLib () {
		return window.MMMECCountdown;
	},

	/** Start periodic calendar fetch (server) and DOM refresh (browser). */
	start () {
		const lib = this.getCountdownLib();
		if (!lib) {
			console.error("[MMM-EventCountdown] lib/countdown.js not loaded – check getScripts path.");
			return;
		}
		const { normalizeDisplayConfig } = lib;
		this.eventState = {
			title: null,
			startDate: null,
			endDate: null,
			hasEvent: false,
		};
		this.display = normalizeDisplayConfig(this.config);

		this.requestEvents();
		this.fetchTimer = setInterval(() => this.requestEvents(), this.config.fetchInterval);
		this.updateTimer = setInterval(() => this.updateDom(), this.config.customInterval);
	},

	/** Clear timers when MagicMirror unloads the module. */
	stop () {
		if (this.fetchTimer) clearInterval(this.fetchTimer);
		if (this.updateTimer) clearInterval(this.updateTimer);
		this.fetchTimer = null;
		this.updateTimer = null;
	},

	/** Pause DOM updates while the module is hidden. */
	suspend () {
		this.suspended = true;
		if (this.updateTimer) {
			clearInterval(this.updateTimer);
			this.updateTimer = null;
		}
	},

	/** Resume DOM updates when the module becomes visible again. */
	resume () {
		if (!this.suspended) {
			return;
		}
		this.suspended = false;
		this.updateTimer = setInterval(() => this.updateDom(), this.config.customInterval);
		this.updateDom();
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
	 * Keeps the last known good event when a fetch fails.
	 */
	processEvents (payload) {
		if (payload && payload.ok === false) {
			return;
		}

		const events = Array.isArray(payload) ? payload : payload?.events;
		if (!Array.isArray(events) || events.length === 0) {
			this.eventState.hasEvent = false;
			this.eventState.title = null;
			this.eventState.startDate = null;
			this.eventState.endDate = null;
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
			this.eventState.title = null;
			this.eventState.startDate = null;
			this.eventState.endDate = null;
			this.updateDom();
			return;
		}

		const next = filtered[0];
		this.eventState.title = next.title;
		this.eventState.startDate = next.startDate;
		this.eventState.endDate = next.endDate;
		this.eventState.hasEvent = true;

		this.updateDom();
	},

	getStyles () {
		return ["MMM-EventCountdown.css"];
	},

	getScripts () {
		return [this.file("lib/countdown.js")];
	},

	getDom () {
		const lib = this.getCountdownLib();
		if (!lib) {
			const fallback = document.createElement("div");
			fallback.className = "event-countdown__title light thin";
			fallback.textContent = this.config.noEventText;
			return fallback;
		}
		const {
			computeEventPhase,
			formatCountdown,
			getCountdownColor,
			normalizeDisplayConfig,
		} = lib;
		const display = this.display || normalizeDisplayConfig(this.config);
		const wrapper = document.createElement("div");
		wrapper.className = `event-countdown event-countdown--${display.size}`;

		if (this.isDebugBorders()) {
			wrapper.classList.add("event-countdown--debug");
			wrapper.setAttribute("data-ec-debug", "1");
			wrapper.appendChild(this.createDebugBadge());
		}

		wrapper.style.setProperty("--ec-gap", `${display.groupGap}ch`);
		wrapper.style.setProperty("--ec-unit-width", `${display.unitWidth}ch`);
		if (this.config.valueSize) {
			wrapper.style.setProperty("--ec-value-fluid", this.config.valueSize);
			wrapper.style.setProperty("--ec-scale", "1");
		} else {
			wrapper.style.setProperty("--ec-scale", String(display.scale));
		}
		this.applyFontWeight(wrapper, display.fontWeight);

		if (!this.eventState.hasEvent) {
			wrapper.appendChild(this.el("div", "event-countdown__title light thin", this.config.noEventText));
			return wrapper;
		}

		const now = Math.floor(Date.now() / 1000);
		const { isRunning, timeDiff } = computeEventPhase(
			now,
			this.eventState.startDate,
			this.eventState.endDate,
		);
		const color = getCountdownColor(timeDiff, isRunning, this.config.useUrgencyColors);
		const countdown = formatCountdown(timeDiff, this.config);

		wrapper.appendChild(this.el("div", "event-countdown__title light thin", (this.eventState.title || "").toUpperCase()));
		wrapper.appendChild(this.el("div", "event-countdown__subtitle light thin",
			isRunning ? this.config.runningText : this.config.startsInText));

		const timer = document.createElement("div");
		timer.className = "event-countdown__timer";
		if (this.config.showColons) {
			timer.classList.add("event-countdown__timer--colons");
		}

		for (let i = 0; i < 3; i++) {
			if (i > 0 && this.config.showColons) {
				const sep = document.createElement("div");
				sep.className = "event-countdown__sep";
				const colon = this.el("span", "event-countdown__colon", ":");
				colon.style.color = color;
				sep.appendChild(colon);
				timer.appendChild(sep);
			}

			const column = document.createElement("div");
			column.className = "event-countdown__column";

			const value = this.el("span", "event-countdown__value", countdown.values[i]);
			value.style.color = color;
			column.appendChild(value);
			column.appendChild(this.el("span", "event-countdown__label light dimmed", countdown.labels[i]));
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

		const lib = this.getCountdownLib();
		if (!lib) {
			return false;
		}
		const display = this.display || lib.normalizeDisplayConfig(this.config);
		return display.showDebugBorders;
	},

	createDebugBadge () {
		const badge = document.createElement("div");
		badge.className = "event-countdown__debug-badge";
		badge.textContent = "DEBUG BORDERS ON";
		badge.setAttribute("aria-hidden", "true");
		return badge;
	},

	/** Apply font-weight modifier for countdown digits (thin | medium | bold). */
	applyFontWeight (wrapper, fontWeight) {
		wrapper.classList.add(`event-countdown--weight-${fontWeight}`);
	},

	/**
	 * Traffic-light image under the countdown (images/lights_r*.png / lights_g*.png).
	 * Index 1–5 maps to remaining minutes: ≤3 min uses r2–r4, otherwise r5/g5.
	 */
	createTrafficLight (timeDiff, isRunning) {
		const lib = this.getCountdownLib();
		const lightIndex = lib ? lib.getTrafficLightIndex(timeDiff) : 5;
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
});
