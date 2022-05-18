	Module.register("MMM-EventCountdown",{
	// Default module config.
	defaults: {
		event: "Year 2030",
		date: "2031-01-01",
		customInterval: 1000,
		daysLabel: 'DAYS',
		hoursLabel: 'HOURS',
		minutesLabel: 'MINUTES',
		secondsLabel: 'SECONDS',
		startDate: 1893452400 ,
		endDate: 1924988400,
		showLight: false,
		isRunning: false,
	},

	// set update interval
	start: function() {
		var self = this;
		self.getEvents();
		setInterval(function() {
			self.getEvents();
			self.updateDom(); // no speed defined, so it updates instantly.
		}, 
		this.config.customInterval); 
	},

	updateDate: function(events) {
		//Log.info(events);
		var now = moment().format("X") //(the number of seconds since the Unix Epoch 01.01.1970 0:00:00)
		events.sort((a, b) => a.startDate.localeCompare(b.startDate))
		if (typeof events[0] !== 'undefined') { 
				this.config.event 		= events[0].title;		//title of the next event
				this.config.startDate 	= events[0].startDate;	//start of next event
				this.config.endDate 	= events[0].endDate;	//end if next event
				//Log.info('Event Startdate :' + events[0].startDate);
				//Log.info('Event Enddate :' + events[0].endDate);

				if ((now >= events[0].startDate) && (now <= events[0].endDate)) { //event is running
						this.config.isRunning = true;
						//Log.info('isRunning:' + this.config.isRunning);
				} else if (now <= events[0].startDate) { //event not started
						this.config.isRunning = false;
						//Log.info('isRunning:' + this.config.isRunning);
				}

			} else if (typeof events[0] !== 'undefined') {
				this.config.event 		= events[0].title;
				this.config.startDate 	= events[0].startDateJ;
		};	
		this.updateDom(); // no speed defined, so it updates instantly.
	},

	getEvents: function() {
		var self = this;
		var now = moment().format("X");
		var filterFn = (event) => {
			// Do not consider all-day events. Only consider events that start in the future or are currently on.
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

	// Update function
	getDom: function() {
		var self = this;
		var isRunning = this.config.isRunning;
		var eventStart = this.config.startDate;
		var eventEnd = this.config.endDate;
		
		var now = Math.floor(new Date().getTime() / 1000);
		//Log.info('now <<current Time in Seconds since 1970>> ' + now);

		//Countdown calculation
		switch (isRunning){
			case true:
				var timeDiff = eventEnd - now;
				break;
			case false:
				var timeDiff = eventStart - now;
				var duration = eventEnd - eventStart;
				break;
		};
		Log.info('timeDiff: ' + timeDiff);

		var diffDays 	= Math.floor(timeDiff / (60 * 60 * 24));
		var diffHours 	= Math.floor(timeDiff % (60 * 60 * 24) / (60 * 60));
		var diffMinutes = Math.floor(timeDiff % (60 * 60) / 60);
		var diffSeconds = Math.floor(timeDiff % 60);

		var wrapper = document.createElement("div"); 						//build container for table

		var wrapperTable = document.createElement("tableCountdown"); 		//create table
			wrapperTable.className = "tableCountdown"; 						//styles for table

		var headRow = document.createElement("tr"); 						//neue Tabellenzeile
		var headCell = document.createElement("th"); 						//new Tablehead
			headCell.className ="light tableHead";							//Formatierungen fuer den Titel mit dem Event
			headCell.colSpan = "3"; 

		var titleRow = document.createElement("tr"); 						//neue Tabellenzeile
		var titleCell = document.createElement("td"); 						//neue Variable im Format Tabellendata
			titleCell.className ="light dimmed tableFooterlow"; 			//Formatierungen fuer 'starts' oder 'is running'
			titleCell.colSpan = "3";

		var currentEvent = this.config.event;
		currentEvent = currentEvent.toUpperCase();
		headCell.innerHTML += currentEvent

		switch (isRunning){
			case true:
				titleCell.innerHTML += "is running";
				break;
			case false:
				titleCell.innerHTML += "starts in";
				break;
			default:
				titleCell.innerHTML = "No scheduled event!"; //wenn kein Event im Kalender eingetragen ist
				break;
		};

		headRow.appendChild(headCell);
		titleRow.appendChild(titleCell);
		wrapperTable.appendChild(headRow);
		wrapperTable.appendChild(titleRow);

		var timeRow = document.createElement("tr"); //row for the countdown

		var countdownCell_1 = document.createElement("td"); 
		var countdownCell_2 = document.createElement("td");
		var countdownCell_3 = document.createElement("td");

		countdownCell_1.className = "tableTime thin";
		countdownCell_2.className = "tableTime thin";
		countdownCell_3.className = "tableTime thin";

		const REMAINING_TIME_1 = 60 * 60 * 24; 	// 24h
		const REMAINING_TIME_2 = 60 * 60 * 1; 	// 1h
		const REMAINING_TIME_3 = 60 * 20;		// 20min
		const REMAINING_TIME_4 = 60 * 5;		// 5min

		if ((timeDiff < REMAINING_TIME_1) && (isRunning === false)) { //less than 24h
			var cellColor = "#00ff00"; //Springgreen
		};

		if ((timeDiff < REMAINING_TIME_2) && (timeDiff > REMAINING_TIME_3) && (isRunning === false)) { //less than 1h and more than 20 minutes
			var cellColor = "#ffff00";
		};

		if ((timeDiff < REMAINING_TIME_3) && (timeDiff > REMAINING_TIME_4) && (isRunning === false)) { //less than 20 minutes more than 5
			var cellColor = "#ff9966";
		};

		if (timeDiff <= REMAINING_TIME_4 && (isRunning === false)) { //less than 5 minutes
			var cellColor = "#ff6600";
		};

		if (isRunning === true) { //if the event is eunning
			var cellColor = "#ffffff";
		};

			countdownCell_1.style.color = cellColor;
			countdownCell_2.style.color = cellColor;
			countdownCell_3.style.color = cellColor;

		if ((diffDays < 10)) { diffDays = "0" + diffDays;}
		if ((diffHours < 10)) { diffHours = "0" + diffHours;}
		if ((diffMinutes < 10)) { diffMinutes = "0" + diffMinutes; }
		if ((diffSeconds < 10)) { diffSeconds = "0" + diffSeconds; }

		if (diffDays > 0) {
			countdownCell_1.innerHTML = diffDays;
			countdownCell_2.innerHTML = diffHours;
			countdownCell_3.innerHTML = diffMinutes;	
		};

		if (diffDays < 1) {
			countdownCell_1.innerHTML = diffHours;
			countdownCell_2.innerHTML = diffMinutes;
			countdownCell_3.innerHTML = diffSeconds;	
		};
		
		timeRow.appendChild(countdownCell_1);
		timeRow.appendChild(countdownCell_2);
		timeRow.appendChild(countdownCell_3);
		wrapperTable.appendChild(timeRow);

		var labelCell_1 = document.createElement("td");
		var labelCell_2 = document.createElement("td");
		var labelCell_3 = document.createElement("td");

		labelCell_1.className = "tableFooter light dimmed";
		labelCell_2.className = "tableFooter light dimmed";
		labelCell_3.className = "tableFooter light dimmed";

		if (diffDays > 0) {
			labelCell_1.innerHTML = this.config.daysLabel + "<p>";
			labelCell_2.innerHTML = this.config.hoursLabel;	
			labelCell_3.innerHTML = this.config.minutesLabel;
		};

		if (diffDays < 1) {
			labelCell_1.innerHTML = this.config.hoursLabel + "<p>";
			labelCell_2.innerHTML = this.config.minutesLabel;	
			labelCell_3.innerHTML = this.config.secondsLabel;
		};

		wrapperTable.appendChild(labelCell_1);
		wrapperTable.appendChild(labelCell_2);
		wrapperTable.appendChild(labelCell_3);

		//traffic light integration
		var showLight = this.config.showLight;

		if (showLight === true) {
				//Log.info ("ShowLight true");
				var remainMinutes = Math.floor(timeDiff / 60); //Remaining Minutes until Event Start

				var lightRow = document.createElement("tr");
				lightRow.className = "tableTime"; //Formatvorgabe Tabellenzeile

				var lightCell = document.createElement("td");
				lightCell.className = "tableHead";

				lightCell.colSpan = "3";	//3 Spalten verbinden

				var lightHeight = 85; //height of the traffic light
				switch(isRunning){
					case true:
						//Log.info ('Is Running');
						if (remainMinutes <= 3) {
							lightCell.innerHTML = "<img src='modules/MMM-EventCountdown/images/lights_g" + (remainMinutes + 1) + ".png' height=" + lightHeight + "px>";
							} else {
							lightCell.innerHTML = "<img src='modules/MMM-EventCountdown/images/lights_g5.png' height=" + lightHeight + "px>";	
						};
						break;

					case false:
						//Log.info ('Is Not Running');
						//Log.info ("Remaining Minutes " + remainMinutes);
						if (remainMinutes <= 3) {
							lightCell.innerHTML = "<img src='modules/MMM-EventCountdown/images/lights_r" + (remainMinutes + 1) + ".png' height=" + lightHeight + "px>";
							} else {
							lightCell.innerHTML = "<img src='modules/MMM-EventCountdown/images/lights_r5.png' height=" + lightHeight + "px>";	
						};
						break;
				};	
		 		lightRow.appendChild(lightCell);
		 		wrapperTable.appendChild(lightRow);
		 	};
		wrapper.appendChild(wrapperTable);
		return wrapper;
	},
});
