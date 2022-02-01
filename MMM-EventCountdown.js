Module.register("MMM-EventCountdown",{
	// Default module config.
	defaults: {
		event: "Year 2030",
		date: "2031-01-01",
		showDays: true,
		customInterval: 1000,
		daysLabel: 'DAYS',
		hoursLabel: 'HOURS',
		minutesLabel: 'MINUTES',
		secondsLabel: 'SECONDS',
		isRunning: false,
		startDate: 1893456000 , 	// 01.01.2030 00:00:00
		endDate: 1956527999,		// 31.12.2031 23:59:59
		showLight: true,
	},

	// set update interval
	start: function() {
		var self = this;
		self.getEvents();
		setInterval(function() {
			self.getEvents();
			self.updateDom(); 	// no speed defined, so it updates instantly.
		}, 
		this.config.customInterval); 
	},

	updateDate: function(events) {
		//Log.info(events);
		var now = moment().format("X")	// now = Unix timestamp for current time
		events.sort((a, b) => a.startDate.localeCompare(b.startDate))
		if (typeof events[0] !== 'undefined') {	// if type of events is not undefined
				this.config.event = events[0].title;	// title of the next event
				this.config.startDate = events[0].startDate;	// start of the next event
				this.config.endDate = events[0].endDate;	// end of the next event
				//Log.info('Event Startdate :' + events[0].startDate);
				//Log.info('Event Enddate :' + events[0].endDate);
				if ((now >= events[0].startDate) && (now <= events[0].endDate)) {	// event is running
						this.config.isRunning = true;
						//Log.info('isRunning:' + this.config.isRunning);
				} else if (now <= events[0].startDate) {	// next event is not started
						this.config.isRunning = false;
						//Log.info('isRunning:' + this.config.isRunning);
				}
			} else if (typeof events[0] !== 'undefined') {
				this.config.event = events[0].title;
				this.config.startDate = events[0].startDateJ;
		};	
		this.updateDom();	// no speed defined, so it updates instantly.
	},

	getEvents: function() {
		var self = this;
		var now = moment().format("X");
		var filterFn = (event) => {
			// Do not consider all-day events. Consider only future or current events
			if ((event.isFullday !== true) && (event.startDate > now) || (event.endDate > now)) return true
			};
		var callbackFn = (events) => {
			this.updateDate(events)
		};
		this.sendNotification("CALEXT2_EVENT_QUERY", {filter:filterFn, callback:callbackFn})
	},

	getStyles: function() {
		return ["MMM-EventCountdown.css"]
	},

	getDom: function() {	// Update function
		var self = this;
		var event = this.config.event;
		var isRunning = this.config.isRunning;
		var eventStart = this.config.startDate;
		var eventEnd = this.config.endDate;
		
		var now = Math.floor(new Date().getTime() / 1000);
		//Log.info('Seconds since 1970 ' + now);

		//Countdown calculation until the start or until the end
		switch (isRunning){
			case true:
				var timeDiff = eventEnd - now;
				break;
			case false:
				var timeDiff = eventStart - now;
				var duration = eventEnd - eventStart;
				break;
		};
		//Log.info('timeDiff: ' + timeDiff);

		var diffDays = Math.floor(timeDiff / (60 * 60 * 24));
		var diffHours = Math.floor((timeDiff % (60 * 60 * 24)) / (60 * 60));
		var diffMinutes = Math.floor((timeDiff % (60 * 60)) / (60));
		var diffSeconds = Math.floor((timeDiff % 60));

		var wrapper = document.createElement("div"); //div container build

		var wrapperTable = document.createElement("table"); 
		wrapperTable.className = "table";

		var titleRow = document.createElement("tr");
		titleRow.className = "align-center bright light tHead";

		var titleCell = document.createElement("td");
		titleCell.className ="tHead";

		var withDays = (this.config.showDays === true && diffDays >= 1);	// Show the days or not, if not the days are added to the hours
		//Log.info('withDays ' + withDays);

		if (withDays === true) { titleCell.colSpan = "4"; }		// Connect 4 columns
		if (withDays === false) { titleCell.colSpan = "3"; }	// Connect 3 columns

		var currentEvent = this.config.event;
		currentEvent = currentEvent.toUpperCase();

		switch (isRunning){
			case true:
				titleCell.innerHTML += "'" + currentEvent + "' is running";
				break;
			case false:
				titleCell.innerHTML += "'" + currentEvent + "' starts in";
				break;
			default:
				titleCell.innerHTML = "No scheduled event!";	// if no event is entered in the calendar
				break;
		};

		titleRow.appendChild(titleCell);
		wrapperTable.appendChild(titleRow);

		if (withDays === false) {
			diffHours = diffHours + (diffDays * 24);
		};

		var timeRow = document.createElement("tr");

		if (withDays === true) { 
			var daysCell = document.createElement("td");
			daysCell.className = "tTime timeFont thin";
			daysCell.innerHTML = diffDays;
			timeRow.appendChild(daysCell);
		};

		var hoursCell = document.createElement("td"); 
		var minutesCell = document.createElement("td");
		var secondsCell = document.createElement("td");

		hoursCell.className = "tTime timeFont thin";
		minutesCell.className = "tTime timeFont thin";
		secondsCell.className = "tTime timeFont thin";

		const remainTime1 = 60 * 60 * 24; 	// 24h
		const remainTime2 = 60 * 60 * 1; 	// 1h
		const remainTime3 = 60 * 20;		// 20min
		const remainTime4 = 60 * 5;			// 5min

		if ((timeDiff < remainTime1) && (isRunning === false)) {	//less than 24h
			var cellColor = "lime";
			if (withDays === true) { daysCell.style.color = cellColor; }
			hoursCell.style.color = cellColor;
			minutesCell.style.color = cellColor;
			secondsCell.style.color = cellColor;
		};

		if ((timeDiff < remainTime2) && (timeDiff > remainTime3) && (isRunning === false)) { 	// less than 1h and more than 20 minutes
			var cellColor = "yellow";
			if (withDays === true) { daysCell.style.color = cellColor; }
			hoursCell.style.color = cellColor;
			minutesCell.style.color = cellColor;
			secondsCell.style.color = cellColor;
		};

		if ((timeDiff < remainTime3) && (timeDiff > remainTime4) && (isRunning === false)) { 	// less than 20 minutes more than 5
			var cellColor = "orange";
			if (withDays === true) { daysCell.style.color = cellColor; }
			hoursCell.style.color = cellColor;
			minutesCell.style.color = cellColor;
			secondsCell.style.color = cellColor;
		};

		if (timeDiff <= remainTime4 && (isRunning === false)) { 	// less than 5 minutes
			var cellColor = "red";
			if (withDays === true) { daysCell.style.color = cellColor; }
			hoursCell.style.color = cellColor;
			minutesCell.style.color = cellColor;
			secondsCell.style.color = cellColor;
		};

		if ((diffMinutes < 10)) { diffMinutes = "0" + diffMinutes; }
		if ((diffSeconds < 10)) { diffSeconds = "0" + diffSeconds; }

		hoursCell.innerHTML = diffHours;
		minutesCell.innerHTML = diffMinutes;
		secondsCell.innerHTML = diffSeconds;

		timeRow.appendChild(hoursCell);
		timeRow.appendChild(minutesCell);
		timeRow.appendChild(secondsCell);
		wrapperTable.appendChild(timeRow);

		if (withDays === true) { 
			var bottomDaysCell = document.createElement("td");
			bottomDaysCell.className = "align-center tBottom small light dimmed";
			bottomDaysCell.innerHTML = this.config.daysLabel;
			wrapperTable.appendChild(bottomDaysCell);
		};

		var bottomHoursCell = document.createElement("td");
		var bottomMinutesCell = document.createElement("td");
		var bottomSecondsCell = document.createElement("td");

		bottomHoursCell.className = "align-center tBottom small light dimmed";
		bottomMinutesCell.className = "align-center tBottom small light dimmed";
		bottomSecondsCell.className = "align-center tBottom small light dimmed";

		bottomHoursCell.innerHTML = this.config.hoursLabel;
		bottomMinutesCell.innerHTML = this.config.minutesLabel;	
		bottomSecondsCell.innerHTML = this.config.secondsLabel;

		wrapperTable.appendChild(bottomHoursCell);
		wrapperTable.appendChild(bottomMinutesCell);
		wrapperTable.appendChild(bottomSecondsCell);

		// Integrate traffic light
		var showLight = this.config.showLight;

		if (showLight === true) {
				//Log.info ("ShowLight = true);
				var remainMinutes = Math.floor(timeDiff / 60); // Remaining minutes until event start

				var lightRow = document.createElement("tr");
				lightRow.className = "alight-right bright light tTime";	// Table row format preset

				var lightCell = document.createElement("td");
				lightCell.className = "tHead";

				if (withDays === true) { lightCell.colSpan = "4"; }  // Connect 4 columns
				if (withDays === false) { lightCell.colSpan = "3"; } // Connect 3 columns

				switch(isRunning){
					case true:
						//Log.info ('Is Running');
						//Log.info ("Remaining minutes " + remainMinutes);
						if (remainMinutes <= 3) {
							lightCell.innerHTML = "<img src='modules/MMM-EventCountdown/images/lights_g" + (remainMinutes + 1) + ".png' height='85'>";
							} else {
							lightCell.innerHTML = "<img src='modules/MMM-EventCountdown/images/lights_g5.png' height='85'>";	
						};
						break;

					case false:
						//Log.info ('Is Not Running');
						//Log.info ("Remaining minutes " + remainMinutes);
						if (remainMinutes <= 3) {
							lightCell.innerHTML = "<img src='modules/MMM-EventCountdown/images/lights_r" + (remainMinutes + 1) + ".png' height='85'>";
							} else {
							lightCell.innerHTML = "<img src='modules/MMM-EventCountdown/images/lights_r5.png' height='85'>";	
						};
						break;
				};	
		 		lightRow.appendChild(lightCell);
		 		wrapperTable.appendChild(lightRow);
		 	};
		wrapper.appendChild(wrapperTable);	//send to wrapper
		return wrapper;
	},
});
