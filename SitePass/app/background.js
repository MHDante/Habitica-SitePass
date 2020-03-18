"use strict";
var Consts = {
    xClientHeader: "5a8238ab-1819-4f7f-a750-f23264719a2d-HabiticaPomodoroSiteKeeper",
    serverUrl: 'https://habitica.com/api/v3/',
    serverPathUser: 'user/',
    serverPathTask: 'tasks/sitepass',
    serverPathPomodoroHabit: 'tasks/sitepassPomodoro',
    serverPathPomodoroSetHabit: 'tasks/sitepassPomodoroSet',
    serverPathUserTasks: 'tasks/user',
    RewardTemplate: {
        text: "SitePass",
        value: 0,
        notes: "Reward utilized by Habitica SiteKeeper." +
            " Changes value depending on last accessed website.",
        alias: "sitepass",
        type: "reward"
    },
    PomodoroHabitTemplate: {
        text: ":tomato: Pomodoro",
        type: "habit",
        alias: "sitepassPomodoro",
        notes: "Habit utilized by Habitica SiteKeeper. " +
            "Change the difficulty manualy according to your needs.",
        priority: 1
    },
    PomodoroSetHabitTemplate: {
        text: ":tomato::tomato::tomato: Pomodoro Combo!",
        type: "habit",
        alias: "sitepassPomodoroSet",
        notes: "Habit utilized by Habitica SiteKeeper. " +
            "Change the difficulty manualy according to your needs.",
        down: false,
        priority: 1.5
    },
    userDataKey: "USER_DATA",
    PomodorosTodayDataKey: "PomodorosToday",
    NotificationId: "sitepass_notification",
};

var Vars = {
    EditingSettings: false,
    RewardTask: Consts.RewardTemplate,
    PomodoroTaskId: null,
    PomodoroSetTaskId: null,
    PomodorosToday: {
        value: 0,
        date: 0
    },
    Monies: 0,
    Exp: 0,
    Hp: 0,
    UserData: new UserSettings(),
    ServerResponse: 0,
    Timer: "00:00",
    TimerValue: 0, //in seconds
    TimerRunnig: false,
    onBreak: false,
    onBreakExtension: false,
    PomoSetCounter: 0
};


function UserSettings(copyFrom) {
    this.BlockedSites = copyFrom ? copyFrom.BlockedSites : {};
    this.Credentials = copyFrom ? copyFrom.Credentials : {
        uid: "",
        apiToken: ""
    };
    this.PassDurationMins = copyFrom ? copyFrom.PassDurationMins : 30;
    this.PomoDurationMins = copyFrom ? copyFrom.PomoDurationMins : 25;
    this.PomoHabitPlus = copyFrom ? copyFrom.PomoHabitPlus : false; //Hit + on habit when pomodoro done
    this.PomoHabitMinus = copyFrom ? copyFrom.PomoHabitMinus : false; //Hit - on habit when pomodoro is interupted
    this.BreakDuration = copyFrom ? copyFrom.BreakDuration : 5;
    this.ManualBreak = copyFrom ? copyFrom.ManualBreak : true;
    this.BreakFreePass = copyFrom ? copyFrom.BreakFreePass : false;
    this.BreakExtention = copyFrom ? copyFrom.BreakExtention : 2;
    this.BreakExtentionFails = copyFrom ? copyFrom.BreakExtentionFails : false;
    this.BreakExtentionNotify = copyFrom ? copyFrom.BreakExtentionNotify : false;
    this.PomoSetNum = copyFrom ? copyFrom.PomoSetNum : 4;
    this.PomoSetHabitPlus = copyFrom ? copyFrom.PomoSetHabitPlus : false;
    this.LongBreakDuration = copyFrom ? copyFrom.LongBreakDuration : 30;
    this.LongBreakNotify = copyFrom ? copyFrom.LongBreakNotify : false;
    this.VacationMode = copyFrom ? copyFrom.VacationMode : false;

    this.GetBlockedSite = function (hostname) {
        return this.BlockedSites[hostname];
    }
    this.RemoveBlockedSite = function (site) {
        if (site.hostname) {
            delete this.BlockedSites[site.hostname];
        } else
            delete this.BlockedSites[site];
    };
    this.AddBlockedSite = function (hostname, cost, passExpiry) {
        this.BlockedSites[hostname] = new BlockedSite(hostname, cost, passExpiry);
        return this.BlockedSites[hostname];
    }

}

function BlockedSite(hostname, cost, passExpiry) {
    this.hostname = hostname;
    this.cost = cost;
    this.passExpiry = passExpiry;
}

//Checks the hostname and block it if the user dosent have enough gold or pomodoro is active
function checkBlockedHostname(siteUrl) {
    var hostname = siteUrl.hostname;
    //free pass during break session, or Vacation Mode and not in pomodoro session
    var freePass = (Vars.UserData.BreakFreePass && Vars.onBreak && Vars.TimerRunnig) || (Vars.UserData.VacationMode && (!Vars.TimerRunnig || Vars.onBreak));
    var site = Vars.UserData.GetBlockedSite(hostname);
    var pomodoro = Vars.TimerRunnig && !Vars.onBreak;
    if (!site || site.passExpiry > Date.now() || pomodoro || site.cost == 0 || freePass) {
        return {
            block: false,
            redirectUrl: null
        }; //do not block
    };

    var url = new URL(siteUrl);
    var urlParams = new URLSearchParams(url.search);

    FetchHabiticaData();
    if (site.cost > Vars.Monies) {
        urlParams.set("habiticaSiteKeeperPage", "noPass");
        url.search = urlParams.toString();
        return {
            block: true,
            payToPass: false,
            redirectUrl: url.toString()
        } //block website - can't afford
    }
    urlParams.set("habiticaSiteKeeperPage", "payToPass");
    urlParams.set("cost", site.cost.toFixed(2));
    urlParams.set("gold", Vars.Monies.toFixed(2));
    urlParams.set("time", Vars.UserData.PassDurationMins);
    urlParams.set("paid", "false");
    url.search = urlParams.toString();
    return {
        block: true,
        payToPass: true,
        redirectUrl: url.toString()
    } //block website - pay to pass
}

var callbackTabActive = function (details) {
    chrome.tabs.get(details.tabId, function callback(tab) {
        chrome.tabs.insertCSS({
            file: "pageOverlay.css"
        });
        mainSiteBlockFunction(tab);
    });
};

var callbackTabUpdate = function (tabId) {
    chrome.tabs.get(tabId, function callback(tab) {
        chrome.tabs.insertCSS({
            file: "pageOverlay.css"
        });
        mainSiteBlockFunction(tab);
    });
};

function mainSiteBlockFunction(tab) {
    if (!Vars.TimerRunnig || Vars.onBreak) {
        unblockSiteOverlay(tab);
        var site = new URL(tab.url);

        //Pay to pass or can't afford page
        var urlParams = new URLSearchParams(site.search);
        var siteKeeperPage = urlParams.get("habiticaSiteKeeperPage");  

        //block
        if (siteKeeperPage === "payToPass" || siteKeeperPage === "noPass") {
            
            var paid = urlParams.get("paid");
            var goToHost = site.hostname;
            var goToSite = Vars.UserData.GetBlockedSite(goToHost);

            if (paid === "false" || siteKeeperPage === "noPass"){
                var imageURLPayToPass = chrome.extension.getURL("/img/siteKeeper2.png");
                var imageURLNoPass = chrome.extension.getURL("/img/siteKeeper3.png");
                chrome.tabs.insertCSS({
                    code: `
                    #payToPass:after { background-image:url("` + imageURLPayToPass + `"); }
                    #noPass:after { background-image:url("` + imageURLNoPass + `"); }
                    `
                });
                chrome.tabs.executeScript({
                    file:'pageOverlay.js'
                });
             }
            //confirm payment
            else if (paid === "true" && siteKeeperPage === "payToPass") {
                ConfirmPurchase(goToSite);
                var passDurationMiliSec = Vars.UserData.PassDurationMins * 60 * 1000;
                goToSite.passExpiry = Date.now() + passDurationMiliSec;   
                var url = site;
                chrome.tabs.remove(tab.id);
                urlParams.delete("habiticaSiteKeeperPage"); 
                urlParams.delete("cost"); 
                urlParams.delete("time"); 
                urlParams.delete("paid"); 
                urlParams.delete("gold"); 
                url.search = urlParams.toString();
                chrome.tabs.create({url:url.toString()});
            }
        }
        //check
        else{
            var checkSite = checkBlockedHostname(site);
            if (!checkSite.block) return;  
            chrome.tabs.update(tab.id, {
                url: checkSite.redirectUrl
            });
        }

        //Check if the user is not on the same site for longer than passDuration
        var passDurationMiliSec = Vars.UserData.PassDurationMins * 60 * 1000
        setTimeout(function (arg) {
            mainSiteBlockFunction(arg);
        }, passDurationMiliSec, tab);

    }
}



//Switching and updating tabs
chrome.tabs.onActivated.addListener(callbackTabActive);
chrome.tabs.onUpdated.addListener(callbackTabUpdate);

// ReSharper disable once PossiblyUnassignedProperty
chrome.storage.sync.get(Consts.userDataKey, function (result) {
    if (result[Consts.userDataKey]) {
        Vars.UserData = new UserSettings(result[Consts.userDataKey]);
        FetchHabiticaData();
    }
});

//Set Pomodoros Today from storage
chrome.storage.sync.get(Consts.PomodorosTodayDataKey, function (result) {
    if (result[Consts.PomodorosTodayDataKey]) {
        Vars.PomodorosToday = result[Consts.PomodorosTodayDataKey];
    }
});


// ----- Habitica Api general call ----- //
function callAPI(method, route, postData) {
    return callHabiticaAPI(Consts.serverUrl + route, Consts.xClientHeader, Vars.UserData.Credentials, method, postData);
}

function getData(silent, credentials, serverPath) {
    var xhr = getHabiticaData(Consts.serverUrl + serverPath, Consts.xClientHeader, credentials);
    Vars.ServerResponse = xhr.status;
    if (xhr.status == 401) {
        chrome.notifications.create(Consts.NotificationId, {
                type: "basic",
                iconUrl: "img/icon.png",
                title: "Habitica SitePass Credentials Error",
                message: "Click on the gold coin icon in the top right of your browser to set your credentials."
            },
            function () {});
        return null;
    } else if (xhr.status != 200) {
        if (!silent) {
            chrome.notifications.create(Consts.NotificationId, {
                    type: "basic",
                    iconUrl: "img/icon.png",
                    title: "Habitica SitePass Connection Error",
                    message: "The service might be temporarily unavailable. Contact the developer if it persists. Error =" +
                        xhr.status
                },
                function () {});
        }
        return null;
    }
    return JSON.parse(xhr.responseText);
}

function FetchHabiticaData(skipTasks) {
    var credentials = Vars.UserData.Credentials;
    var userObj = getData(false, credentials, Consts.serverPathUser);
    if (userObj == null) return;
    else {
        Vars.Monies = userObj.data["stats"]["gp"];
        Vars.Exp = userObj.data["stats"]["exp"];
        Vars.Hp = userObj.data["stats"]["hp"];
    }
    if (!skipTasks) {
        var tasksObj;

        //get pomodoro task id
        tasksObj = getData(true, credentials, Consts.serverPathPomodoroHabit);
        if (tasksObj && tasksObj.data["alias"] == Consts.PomodoroHabitTemplate.alias) {
            Vars.PomodoroTaskId = tasksObj.data.id;
        } else {
            var result = CreatePomodoroHabit();
            if (result.error) {
                notify("ERROR", result.error);
            } else {
                Vars.PomodoroTaskId = result;
            }

        }

        //get pomodoro Set task id
        tasksObj = getData(true, credentials, Consts.serverPathPomodoroSetHabit);
        if (tasksObj && tasksObj.data["alias"] == Consts.PomodoroSetHabitTemplate.alias) {
            Vars.PomodoroSetTaskId = tasksObj.data.id;
        } else {
            var result = CreatePomodoroSetHabit();
            if (result.error) {
                notify("ERROR", result.error);
            } else {
                Vars.PomodoroSetTaskId = result;
            }

        }

        //Reward task update/create
        tasksObj = getData(true, credentials, Consts.serverPathTask);
        if (tasksObj && tasksObj.data["alias"] == "sitepass") {
            Vars.RewardTask = tasksObj.data;
            UpdateRewardTask(0, false);
            return;
        }
        UpdateRewardTask(0, true);
    }
}

function UpdateRewardTask(cost, create) {
    Vars.RewardTask.value = cost;
    var xhr = new XMLHttpRequest();
    if (create) {
        xhr.open("POST", Consts.serverUrl + Consts.serverPathUserTasks, false);
    } else {
        xhr.open("PUT", Consts.serverUrl + Consts.serverPathTask, false);

    }
    xhr.setRequestHeader('x-client', Consts.xClientHeader);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("x-api-user", Vars.UserData.Credentials.uid);
    xhr.setRequestHeader("x-api-key", Vars.UserData.Credentials.apiToken);
    var data = {
        "data": Vars.RewardTask
    }
    xhr.send(JSON.stringify(Vars.RewardTask));
    Vars.RewardTask = JSON.parse(xhr.responseText).data;

}

function CreatePomodoroHabit() {
    var data = JSON.stringify(Consts.PomodoroHabitTemplate);
    var p = JSON.parse(callAPI("POST", Consts.serverPathUserTasks, data));
    if (p.success != true) {
        return {
            error: 'Failed to Create Pomodoro Habit task'
        };
    } else {
        return p.data.id;
    }
}

function CreatePomodoroSetHabit() {
    var data = JSON.stringify(Consts.PomodoroSetHabitTemplate);
    var p = JSON.parse(callAPI("POST", Consts.serverPathUserTasks, data));
    if (p.success != true) {
        return {
            error: 'Failed to Create Pomodoro Set Habit task'
        };
    } else {
        return p.data.id;
    }
}

function ConfirmPurchase(site) {
    UpdateRewardTask(site.cost);
    callAPI("POST", Consts.serverPathTask + "/score/down");
    Vars.Monies -= site.cost;
}

//direction 'up' or 'down'
function ScoreHabit(habitId, direction) {
    var p = JSON.parse(callAPI("POST", '/tasks/' + habitId + '/score/' + direction));
    if (p.success != true) {
        return {
            error: 'Failed to score task ' + habitId + ', doublecheck its ID'
        };
    }
    return {
        lvl: p.data.lvl,
        hp: p.data.hp,
        exp: p.data.exp,
        mp: p.data.mp,
        gp: p.data.gp
    };
}

// ------------- Pomodoro Timer ---------------------------

var timerInterval; //Used for timer interval in startTimer() function.

/**
 * Start Timer: 
 * @param {int} duration the duration in seconds.
 * @param {function} duringTimerFunction this function runs every second while the timer runs.
 * @param {function} endTimerFunction this function runs when timer reachs 00:00.
 */
function startTimer(duration, duringTimerFunction, endTimerFunction) {
    var timer = duration,
        minutes, seconds;
    var duringTimer = function () {
        duringTimerFunction()
    };
    var endTimer = function () {
        endTimerFunction()
    };

    timerInterval = setInterval(function () {

        Vars.Timer = secondsToTimeString(timer);
        Vars.TimerValue = timer;

        duringTimer();

        //Times Up
        if (--timer < 0) {
            endTimer();
        }

    }, 1000);
}

//Convert seconds to time string, for example: 65 -> "01:05"
function secondsToTimeString(seconds) {
    var minutes = parseInt(seconds / 60, 10)
    var seconds = parseInt(seconds % 60, 10);
    minutes = minutes < 10 ? "0" + minutes : minutes;
    seconds = seconds < 10 ? "0" + seconds : seconds;
    return minutes + ":" + seconds;
}

//start pomodoro session - duration in seconds
function startPomodoro() {
    var duration = 60 * Vars.UserData.PomoDurationMins;
    Vars.TimerRunnig = true;
    Vars.onBreak = false;
    startTimer(duration, duringPomodoro, pomodoroEnds);
}

//runs during pomodoro session
function duringPomodoro() {
    //Show time on icon badge 
    chrome.browserAction.setBadgeBackgroundColor({
        color: "green"
    });
    chrome.browserAction.setBadgeText({
        text: Vars.Timer
    });
    //Block current tab if necessary
    CurrentTab(blockSiteOverlay);
}


//runs When Pomodoro Timer Ends
function pomodoroEnds() {
    stopTimer();
    var title = "Time's Up"
    var msg = "Pomodoro ended." + "\n" + "You have done " + Vars.PomodorosToday.value + " today!"; //default msg if habit not enabled
    var setComplete = Vars.PomoSetCounter >= Vars.UserData.PomoSetNum - 1;

    //If Pomodoro / Pomodoro Set Habit + is enabled
    if (Vars.UserData.PomoHabitPlus || (setComplete && Vars.UserData.PomoSetHabitPlus)) {
        FetchHabiticaData(true);
        var result = (setComplete && Vars.UserData.PomoSetHabitPlus) ? ScoreHabit(Vars.PomodoroSetTaskId, 'up') : ScoreHabit(Vars.PomodoroTaskId, 'up');
        if (!result.error) {
            var deltaGold = (result.gp - Vars.Monies).toFixed(2);
            var deltaExp = (result.exp - Vars.Exp).toFixed(2);
            msg = "You Earned Gold: +" + deltaGold + "\n" + "You Earned Exp: +" + deltaExp;
            FetchHabiticaData(true);
        } else {
            msg = "ERROR: " + result.error;
        }
    }
    //update Pomodoros today
    Vars.PomodorosToday.value++;
    var Pomodoros = {};
    Pomodoros[Consts.PomodorosTodayDataKey] = Vars.PomodorosToday;
    chrome.storage.sync.set(Pomodoros, function () {
        console.log('PomodorosToday is set to ' + JSON.stringify(Pomodoros));
    });

    Vars.PomoSetCounter++; //Updae set counter

    if (setComplete) {
        title = "Pomodoro Set Complete!";
    }
    if (Vars.UserData.ManualBreak) {
        manualBreak();
    } else {
        startBreak();
    }

    //notify
    notify(title, msg);
}

//start break session - duration in seconds
function startBreak() {
    var duration;
    if (Vars.PomoSetCounter == Vars.UserData.PomoSetNum) {
        duration = 60 * Vars.UserData.LongBreakDuration
    } else {
        duration = 60 * Vars.UserData.BreakDuration;
    }
    stopTimer();
    Vars.TimerRunnig = true;
    Vars.onBreak = true;
    startTimer(duration, duringBreak, breakEnds);
}

//start break session - duration in seconds
function manualBreak() {
    stopTimer();
    Vars.TimerRunnig = false;
    Vars.onBreak = true;
    Vars.Timer = "Nice!";
}

//runs during Break session
function duringBreak() {
    //Show time on icon badge 
    chrome.browserAction.setBadgeBackgroundColor({
        color: "blue"
    });
    chrome.browserAction.setBadgeText({
        text: Vars.Timer
    });
}

//runs when Break session ends
function breakEnds() {
    stopTimer();
    var msg;
    if (Vars.PomoSetCounter == Vars.UserData.PomoSetNum) {
        msg = "Long Break is over";
        pomoReset();
        if (Vars.UserData.LongBreakNotify) {
            notifyHabitica("Long Break is over");
        }
    } else {
        msg = "Back to work";
        startBreakExtension(Vars.UserData.BreakExtention * 60);
    }
    //notify
    notify("Time's Up", msg);
}

//start break session - duration in seconds
function startBreakExtension(duration) {
    stopTimer();
    Vars.TimerRunnig = true;
    Vars.onBreakExtension = true;
    Vars.onBreak = true;
    startTimer(duration, duringBreakExtension, pomodoroInterupted);
    if (Vars.UserData.BreakExtentionNotify) {
        notifyHabitica("Back to work! " + secondsToTimeString(Vars.UserData.BreakExtention * 60) + " minutes left for Break Extension.");
    }
}

//runs during Break session
function duringBreakExtension() {
    //Show time on icon badge 
    chrome.browserAction.setBadgeBackgroundColor({
        color: "red"
    });
    chrome.browserAction.setBadgeText({
        text: Vars.Timer
    });
}

//runs when pomodoro is interupted (stoped before timer ends/break extension over)
function pomodoroInterupted() {
    var failedBreakExtension = Vars.UserData.BreakExtentionFails && Vars.onBreakExtension;
    var breakExtensionZero = !Vars.UserData.BreakExtentionFails && (Vars.UserData.BreakExtention == 0);
    pomoReset();
    if (breakExtensionZero) {
        return;
    }
    if (Vars.UserData.PomoHabitMinus || failedBreakExtension) {
        FetchHabiticaData();
        var result = ScoreHabit(Vars.PomodoroTaskId, 'down');
        var msg = "";
        if (!result.error) {
            var deltaHp = (result.hp - Vars.Hp).toFixed(2);
            msg = "You Lost Health: " + deltaHp;
            FetchHabiticaData();
        } else {
            msg = "ERROR: " + result.error;
        }
        console.log(msg);
        notify("Pomodoro Failed!", msg);
    }
}

//Stop timer
function stopTimer() {

    clearInterval(timerInterval);
    Vars.Timer = "00:00";
    chrome.browserAction.setBadgeText({
        text: ''
    });

    CurrentTab(unblockSiteOverlay); //if current tab is blocked, unblock it
    CurrentTab(mainSiteBlockFunction); //ConfirmPurchase check
    Vars.TimerRunnig = false;
    Vars.onBreak = false;
    Vars.onBreakExtension = false;

}

//Stop timer - reset to start position
function pomoReset() {
    stopTimer()
    Vars.PomoSetCounter = 0; //Reset Pomo set Count
}

//Create Chrome Notification
function notify(title, message, callback) {
    var options = {
        title: title,
        message: message,
        type: "basic", // Which type of notification to display - https://developer.chrome.com/extensions/notifications#type-TemplateType
        iconUrl: "img/icon.png" // A URL to the sender's avatar, app icon, or a thumbnail for image notifications.
    };
    // The first argument is the ID, if left blank it'll be automatically generated.
    // The second argument is an object of options. More here: https://developer.chrome.com/extensions/notifications#type-NotificationOptions
    return chrome.notifications.create("", options, callback);
}

//Run function(tab) on currentTab
function CurrentTab(func) {
    chrome.tabs.query({
            'active': true,
            'windowId': chrome.windows.WINDOW_ID_CURRENT
        },
        function (tabs) {
            if (tabs[0]) {
                func(tabs[0]);
            }
        });
}

//Block Site With Overlay
function blockSiteOverlay(tab) {
    var site = new URL(tab.url).hostname;
    var message = "Stay Focused! Time Left: " + Vars.Timer;
    if (Vars.UserData.GetBlockedSite(site)) {
        chrome.tabs.executeScript({
            code: `
            document.body.classList.add('blockedSite');
            document.body.setAttribute('data-html',"` + message + `");               
            `
        });
        var imageURL = chrome.extension.getURL("/img/siteKeeper.png");
        chrome.tabs.insertCSS({
            code: '.blockedSite:after { background-image:url("' + imageURL + '"); }'
        });
    };
}

//Remove Overlay from current Blocked Site
function unblockSiteOverlay(tab) {
    var site = new URL(tab.url).hostname;
    if (Vars.UserData.GetBlockedSite(site)) {
        chrome.tabs.executeScript({
            code: `document.body.className = document.body.className.replace( "blockedSite", '' );`
        });
    };
}

//Sends Private Message to the user in Habitica (Used as notification in the mobile app!)
function notifyHabitica(msg) {
    var data = {
        message: msg,
        toUserId: Vars.UserData.Credentials.uid
    };
    callAPI("POST", 'members/send-private-message', JSON.stringify(data));
}