"use strict";

//========== Time Functions =============

//returns the current date, "yyyy-mm-dd" format
function getDate() {
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = today.getFullYear();
    today = yyyy + '-' + mm + '-' + dd;
    return today;
}

//returns the current weekday
function getWeekDay() {
    var today = new Date();
    var weekdays = new Array(
        "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
    );
    var day = today.getDay();
    return weekdays[day];
}

//returns the current time in 24hrs format
function getTime() {
    var today = new Date();
    var time = today.getHours() + ":" + today.getMinutes();
    return time;
}

//input time str like "18:30", returns number of minutes since "00:00".
function getMinutes(str) {
    var time = str.split(':');
    return time[0] * 60 + time[1] * 1;
}

//Input: Time strings 'hh:mm' in 24hr format i.e. '23:28'
function isTimeBetween(fromTime, toTime) {

    if (fromTime == "" || toTime == "") {
        return false;
    }

    var nowMinutes = getMinutes(getTime());
    var startMinutes = getMinutes(fromTime);
    var endMinutes = getMinutes(toTime);

    if ((nowMinutes > startMinutes) && (nowMinutes < endMinutes)) {
        return true
    }
    return false;
}

//Convert seconds to time string, for example: 65 -> "01:05"
function secondsToTimeString(seconds) {
    var minutes = parseInt(seconds / 60, 10)
    var seconds = parseInt(seconds % 60, 10);
    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;
    return minutes + ":" + seconds;
}

//========== Site Blocker =============
function getSitePassRemainingTime(site) {
    if (site.passExpiry - Date.now() <= 0) {
        return false;
    }
    var seconds = (site.passExpiry - Date.now()) / 1000;
    return secondsToTimeString(seconds);
}
