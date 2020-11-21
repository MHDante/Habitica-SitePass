"use strict";
var Consts = {
    xClientHeader: "5a8238ab-1819-4f7f-a750-f23264719a2d-HabiticaPomodoroSiteKeeper",
    serverUrl: 'https://habitica.com/api/v3/',
    serverPathUser: 'user/',
    serverPathTask: 'tasks/sitepass',
    serverPathPomodoroHabit: 'tasks/sitepassPomodoro',
    serverPathPomodoroSetHabit: 'tasks/sitepassPomodoroSet',
    serverPathUserTasks: 'tasks/user',
    serverPathUserHabits: 'tasks/user?type=habits',
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
    HistogramDataKey: "Histogram",
    NotificationId: "sitepass_notification",
    Sounds: ["Sound1.mp3", "Sound2.mp3", "Sound3.wav", "Sound4.wav", "Sound5.mp3", "Sound6.wav", "Sound7.wav", "Sound8.wav", "Sound9.mp3"],
    AmbientSounds: ["Ambient Clock.flac", "Ambient Rain.wav", "Ambient Crickets.mp3", "Ambient Birds.wav"],
    POMODORO_DONE_TEXT: "GOOD!"
};

var Vars = {
    RewardTask: Consts.RewardTemplate,
    PomodoroTaskId: null,
    PomodoroSetTaskId: null,
    PomodoroTaskCustomList: [],
    Histogram: {}, //Histogram example: {2020-29-10:{pomodoros:3,minutes:75,weekday:Thursday},2020-30-10:{pomodoros:2,minutes:50,weekday:Friday}}
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
    PomoSetCounter: 0,
    onManualTakeBreak: false,
    versionUpdate: false,
    ambientSound: null
};


function UserSettings(copyFrom) {
    //Get User Setting from copyFrom , or set default user settings
    this.BlockedSites = copyFrom ? copyFrom.BlockedSites : {};
    this.Whitelist = copyFrom ? copyFrom.Whitelist : "";
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
    this.FreePassTimes = copyFrom ? copyFrom.FreePassTimes : [];
    this.CustomPomodoroTask = copyFrom ? copyFrom.CustomPomodoroTask : false;
    this.CustomSetTask = copyFrom ? copyFrom.CustomSetTask : false;
    this.PomodoroSetTaskId = copyFrom ? copyFrom.PomodoroSetTaskId : null;
    this.PomodoroTaskId = copyFrom ? copyFrom.PomodoroTaskId : null;
    this.HideEdit = copyFrom ? copyFrom.HideEdit : false;
    this.ConnectHabitica = copyFrom ? copyFrom.ConnectHabitica : true;
    this.MuteBlockedSites = copyFrom ? copyFrom.MuteBlockedSites : true;
    this.TranspartOverlay = copyFrom ? copyFrom.TranspartOverlay : true;
    this.TickSound = copyFrom ? copyFrom.TickSound : false;
    this.showSkipToBreak = copyFrom ? copyFrom.showSkipToBreak : false;
    this.pomodoroEndSound = copyFrom ? copyFrom.pomodoroEndSound : "None";
    this.breakEndSound = copyFrom ? copyFrom.breakEndSound : "None";
    this.ambientSound = copyFrom ? copyFrom.ambientSound : "None";
    this.pomodoroEndSoundVolume = copyFrom ? copyFrom.pomodoroEndSoundVolume : 0.5;
    this.breakEndSoundVolume = copyFrom ? copyFrom.breakEndSoundVolume : 0.5;
    this.ambientSoundVolume = copyFrom ? copyFrom.ambientSoundVolume : 0.5;
    this.ManualNextPomodoro = copyFrom ? copyFrom.ManualNextPomodoro : false;

    //returns site object {hostname, cost, passExpiry} or false
    this.GetBlockedSite = function (hostname) {
        return this.BlockedSites[hostname];
    }

    this.GetSiteCost = function (site) {
        return site.cost;
    }

    this.GetSiteHostName = function (site) {
        return site.hostname;
    }

    this.GetSitePassExpiry = function (site) {
        return site.passExpiry;
    }

    this.isSitePassExpired = function (site) {
        return site.passExpiry <= Date.now();
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

// Runs on version update / Install
chrome.runtime.onInstalled.addListener(function () {
    Vars.versionUpdate = true;
});

function BlockedSite(hostname, cost, passExpiry) {
    this.hostname = hostname;
    this.cost = cost;
    this.passExpiry = passExpiry;
}

// Checks the hostname and block it if the user dosent have enough gold or pomodoro is active.
// Returns Json object:
// if site not blocked: {block:false}
// if site is blocked and affordable: {block:true, payToPass: true, cost:string , hostname:string ,passTime:string}
// if site is blocked and not affordable {block:true, payToPass: false, hostname:string}
function checkBlockedUrl(siteUrl) {

    var hostname = siteUrl.hostname;

    //free pass during break session, or Vacation Mode and not in pomodoro session
    var freePass = ((Vars.UserData.BreakFreePass && Vars.onBreak && Vars.TimerRunnig) || ((Vars.UserData.VacationMode || isFreePassTimeNow()) && (!Vars.TimerRunnig || Vars.onBreak)));
    var site = Vars.UserData.GetBlockedSite(hostname);
    var pomodoro = Vars.TimerRunnig && !Vars.onBreak;

    var unblocked = { block: false };

    if (!site || freePass) {
        return unblocked;
    }

    if (Vars.UserData.ConnectHabitica && site && !pomodoro) {
        if (site.passExpiry > Date.now() || site.cost == 0) {
            return unblocked;
        }
    }

    if (!Vars.UserData.ConnectHabitica && !pomodoro) {
        return unblocked;
    }

    if (isInWhiteList(siteUrl)) {
        return unblocked;
    }

    if (site.cost > Vars.Monies || !Vars.UserData.ConnectHabitica) {
        return {
            block: true,
            payToPass: false,
            hostname: hostname
        } //block website - can't afford
    } else return {
        block: true,
        payToPass: true,
        cost: site.cost.toFixed(2),
        hostname: hostname,
        passTime: Vars.UserData.PassDurationMins
    } //block website - pay to pass
}

function isInWhiteList(siteUrl) {
    var whitelist = Vars.UserData.Whitelist.split('\n');
    for (var i = 0; i < whitelist.length; i++) {
        var line = whitelist[i];
        if (line[0] === '/' && line[line.length - 1] === '/') {
            var re = new RegExp(line.substring(1, line.length - 1));
            if (re.test(siteUrl.toString())) {
                return true;
            }
        }
        if (line === siteUrl.toString()) {
            return true;
        }
    }
    return false;
}

var callbackTabActive = function (details) {
    chrome.tabs.get(details.tabId, function callback(tab) {
        chrome.tabs.insertCSS({
            file: "pageOverlay.css"
        });
        mainSiteBlockFunction(tab);

        //Pass Expiry time badge
        if (!Vars.TimerRunnig) {
            var siteUrl = new URL(tab.url);
            var site = Vars.UserData.GetBlockedSite(siteUrl.hostname);
            showPayToPassTimerBadge(site);
        }
    });
};

function callbackTabUpdate(tabId) {
    chrome.tabs.get(tabId, function callback(tab) {
        //css insert
        chrome.tabs.insertCSS({
            file: "pageOverlay.css"
        });
        mainSiteBlockFunction(tab);
        //Pass Expiry time badge
        if (!Vars.TimerRunnig) {
            var siteUrl = new URL(tab.url);
            var site = Vars.UserData.GetBlockedSite(siteUrl.hostname);
            showPayToPassTimerBadge(site);
        }
    });
}


function mainSiteBlockFunction(tab) {
    if (!Vars.TimerRunnig || Vars.onBreak) {
        unblockSiteOverlay(tab);
        var siteUrl = new URL(tab.url);
        var checkSite = checkBlockedUrl(siteUrl);

        //block - Pay to pass or can't afford page
        if (checkSite.block == true) {

            //pay to pass 
            if (checkSite.payToPass == true) {
                payToPassOverlay(tab, checkSite);
            }

            //can't afford
            else {
                cantAffordOverlay(tab, checkSite);
            }
            return;
        }

        //Check if the user is not on the same site for longer than passDuration
        var passDurationMiliSec = Vars.UserData.PassDurationMins * 60 * 1000
        setTimeout(function (arg) {
            mainSiteBlockFunction(arg);
        }, passDurationMiliSec, tab);

        muteBlockedtabs();
    }

}


var passInterval;
//Shows the time until the paid site is blocked again
function showPayToPassTimerBadge(site) {

    clearInterval(passInterval);

    passInterval = setInterval(function () {
        passIntervalFuction();
    }, 1000);

    var passIntervalFuction = function () {
        if (site && !Vars.TimerRunnig) {
            var remainingTime = getSitePassRemainingTime(site);
            if (remainingTime) {
                chrome.browserAction.setBadgeBackgroundColor({
                    color: "#F18E02"
                });
                chrome.browserAction.setBadgeText({
                    text: remainingTime
                });
            } else {
                if (Vars.Timer !=  Consts.POMODORO_DONE_TEXT) {
                    chrome.browserAction.setBadgeText({
                        text: ''
                    });
                }
                clearInterval(passInterval);
            }
        } else {
            if (Vars.Timer !=  Consts.POMODORO_DONE_TEXT) {
                chrome.browserAction.setBadgeText({
                    text: ''
                });
            }
            clearInterval(passInterval);
        }
    }


}

//Create "Pay X coins To Visit" site overlay
function payToPassOverlay(tab, siteData) {
    var opacity = Vars.UserData.TranspartOverlay ? "0.85" : "1";
    var imageURLPayToPass = chrome.extension.getURL("/img/siteKeeper2.png");
    chrome.tabs.insertCSS({
        code: `
        .payToPass:after { background-image:url("` + imageURLPayToPass + `"); }
        .payToPass::before {background-color:rgba(0,0,0,`+ opacity + `)!important}`
    });

    chrome.tabs.executeScript(tab.id, {
        file: 'pageOverlay.js'
    }, function (tab) {
        chrome.tabs.executeScript(tab.id, {
            code: `
            document.getElementById("payToPass_btn").style.display = 'block';
            document.getElementById("SitekeeperOverlay").style.display = 'block';
            document.getElementById("SitekeeperOverlay").setAttribute("data-html","You're trying to Access ` + siteData.hostname + `\\n Pay ` + siteData.cost + ` Gold to access for ` + siteData.passTime + ` Minutes ");
            document.getElementById("SitekeeperOverlay").className = "payToPass"; `
        });
    });
}

//Create "Cant Afford To Visit" site overlay
function cantAffordOverlay(tab, siteData) {
    var opacity = Vars.UserData.TranspartOverlay ? "0.85" : "1";
    var imageURLNoPass = chrome.extension.getURL("/img/siteKeeper3.png");
    chrome.tabs.insertCSS({
        code: `
        .noPass:after { background-image:url("` + imageURLNoPass + `"); }
        .noPass::before {background-color:rgba(0,0,0,`+ opacity + `)}`
    });

    chrome.tabs.executeScript(tab.id, {
        file: 'pageOverlay.js'
    }, function (tab) {
        chrome.tabs.executeScript(tab.id, {
            code: `
            document.getElementById("SitekeeperOverlay").style.display = 'block'; 
            document.getElementById("payToPass_btn").style.display = 'none';
            document.getElementById("SitekeeperOverlay").setAttribute("data-html","You can't afford to visit ` + siteData.hostname + `\\n You shall not pass! ");
            document.getElementById("SitekeeperOverlay").className = "noPass"; `
        });
    });
}


//Switching and updating tabs
chrome.tabs.onActivated.addListener(callbackTabActive);
chrome.tabs.onUpdated.addListener(function (tabid, changeinfo, tab) {
    var url = tab.url;
    if (url !== undefined && changeinfo.status == "complete") {
        callbackTabUpdate(tabid);
    }
});

// ReSharper disable once PossiblyUnassignedProperty
chrome.storage.sync.get(Consts.userDataKey, function (result) {
    if (result[Consts.userDataKey]) {
        Vars.UserData = new UserSettings(result[Consts.userDataKey]);
        FetchHabiticaData();
    }
});


//Set Histogram from storage
chrome.storage.sync.get(Consts.HistogramDataKey, function (result) {
    if (result[Consts.HistogramDataKey]) {
        Vars.Histogram = result[Consts.HistogramDataKey];
    }
});

//Mute all tabs with blocked sites, unmute other tabs.
function muteBlockedtabs() {
    var pomodoro = Vars.TimerRunnig && !Vars.onBreak;
    if (Vars.UserData.MuteBlockedSites) {
        chrome.tabs.getAllInWindow(null, function (tabs) {
            for (var i = 0; i < tabs.length; i++) {
                var hostname = new URL(tabs[i].url).hostname;
                var site = Vars.UserData.GetBlockedSite(hostname);
                if (!site) {
                    chrome.tabs.update(tabs[i].id, {
                        "muted": false
                    });
                }
                else if (isInWhiteList(tabs[i].url)) {
                    chrome.tabs.update(tabs[i].id, {
                        "muted": false
                    });
                }
                else if (checkBlockedUrl(site).block || pomodoro) {
                    chrome.tabs.update(tabs[i].id, {
                        "muted": true
                    });
                } else {
                    chrome.tabs.update(tabs[i].id, {
                        "muted": false
                    });
                }
            }
        });
    }
}

// ----- Habitica Api general call ----- //
function callAPI(method, route, postData) {
    if (!Vars.UserData.ConnectHabitica) {
        return null;
    }
    return callHabiticaAPI(Consts.serverUrl + route, Consts.xClientHeader, Vars.UserData.Credentials, method, postData);
}

function getData(silent, credentials, serverPath) {
    if (!Vars.UserData.ConnectHabitica) {
        return null;
    }
    var xhr = getHabiticaData(Consts.serverUrl + serverPath, Consts.xClientHeader, credentials);
    Vars.ServerResponse = xhr.status;
    if (xhr.status == 401) {
        console.log("Habitica Credentials Error 404");
        return null;
    } else if (xhr.status != 200) {
        if (!silent) {
            chrome.notifications.create(Consts.NotificationId, {
                type: "basic",
                iconUrl: "img/icon.png",
                title: "Habitica Connection Error",
                message: "The service might be temporarily unavailable. Contact the developer if it persists. Error =" +
                    xhr.status
            },
                function () { });
        }
        return null;
    }
    return JSON.parse(xhr.responseText);
}

function FetchHabiticaData(skipTasks) {
    var credentials = Vars.UserData.Credentials;
    var userObj = getData(true, credentials, Consts.serverPathUser);
    if (userObj == null) return;
    else {
        Vars.Monies = userObj.data["stats"]["gp"];
        Vars.Exp = userObj.data["stats"]["exp"];
        Vars.Hp = userObj.data["stats"]["hp"];
    }
    if (!skipTasks) {
        var tasksObj;

        //get custom pomodoro tasks list (all habits)
        var allHabits;
        allHabits = getData(true, credentials, Consts.serverPathUserHabits);
        console.log(allHabits);
        if (allHabits.success) {
            Vars.PomodoroTaskCustomList = [];
            for (var i in allHabits.data) {
                var title = allHabits.data[i].text;
                var id = allHabits.data[i].id;
                Vars.PomodoroTaskCustomList.push({
                    title,
                    id
                });
            }
            console.log(Vars.PomodoroTaskCustomList);
        }

        //get pomodoro task id
        if (!Vars.UserData.CustomPomodoroTask) {
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
        } else {
            Vars.PomodoroTaskId = Vars.UserData.PomodoroTaskId;
        }

        //get pomodoro Set task id
        if (!Vars.UserData.CustomSetTask) {
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
        } else {
            Vars.PomodoroSetTaskId = Vars.UserData.PomodoroSetTaskId;
        }

        //Reward task update/create
        tasksObj = getData(true, credentials, Consts.serverPathTask);
        if (tasksObj && tasksObj.data["alias"] == "sitepass") {
            Vars.RewardTask = tasksObj.data;
            //UpdateRewardTask(0, false);
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

//Confirm Purchase
chrome.runtime.onMessage.addListener(function (message) {
    if (message.msg == "Confirm_Purchase" && message.sender == "HabiticaPomodoro") {
        var site = Vars.UserData.GetBlockedSite(message.hostname);
        console.log('confirming Purchase for ' + site.hostname);
        ConfirmPurchase(site);
    }
});

function ConfirmPurchase(site) {
    UpdateRewardTask(site.cost, false);
    var p = JSON.parse(callAPI("POST", Consts.serverPathTask + "/score/down"));
    if (p.success != true) {
        notify("ERROR", 'Failed to pay ' + site.cost + 'coins for ' + site.hostname + ' in Habitica');
    } else {
        Vars.Monies -= site.cost;
        var passDurationMiliSec = Vars.UserData.PassDurationMins * 60 * 1000;
        site.passExpiry = Date.now() + passDurationMiliSec;
    }
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

//--------------- Hot Keys -------------------------------
chrome.commands.onCommand.addListener(function (command) {
    if (command === "PomodoroHotKey") {
        ActivatePomodoro();
    }
});

function ActivatePomodoro(){
    if (Vars.onBreak && !Vars.TimerRunnig) {
        startBreak();
    }
    else if (!Vars.TimerRunnig || Vars.onBreak || Vars.onBreakExtension) {
        if (Vars.PomoSetCounter == Vars.UserData.PomoSetNum) { //Set complete
            pomoReset();
        } else {//next pomodoro
            startPomodoro();
        }
    } else {
        pomodoroInterupted(true);
    }
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
    var timer = duration;
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


function getSitePassRemainingTime(site) {
    if (site.passExpiry - Date.now() <= 0) {
        return false;
    }
    var seconds = (site.passExpiry - Date.now()) / 1000;
    return secondsToTimeString(seconds);
}


//start pomodoro session - duration in seconds
function startPomodoro() {
    stopTimer();
    var duration = 60 * Vars.UserData.PomoDurationMins;
    Vars.TimerRunnig = true;
    Vars.onBreak = false;
    startTimer(duration, duringPomodoro, pomodoroEnds);
    muteBlockedtabs();
    playSound(Vars.UserData.ambientSound, Vars.UserData.ambientSoundVolume, true);
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

    if (Vars.ambientSound && Vars.ambientSound.paused) {
        playSound(Vars.UserData.ambientSound, Vars.UserData.ambientSoundVolume, true);
    }
}

function setTodaysHistogram(pomodoros, minutes) {
    Vars.Histogram[getDate()] = { pomodoros: pomodoros, minutes: minutes, weekday: getWeekDay() };

    //update storage
    var storageKeyVal = {}; //{key: value} for chrome.storage.sync.set
    storageKeyVal[Consts.HistogramDataKey] = Vars.Histogram; // {HistogramDataKey : Vars.Histogram}
    chrome.storage.sync.set(storageKeyVal, function () {
        console.log('updated Todays Histogram ' + JSON.stringify(data));
    });
}

function increasePomodorosToday() {
    var todaysData = Vars.Histogram[getDate()];
    if (todaysData) {
        setTodaysHistogram(todaysData.pomodoros + 1, todaysData.minutes + Vars.UserData.PomoDurationMins);
    } else {
        setTodaysHistogram(1, Vars.UserData.PomoDurationMins);
    }
}

function clearHistogram() {
    Vars.Histogram = {};
    //update storage
    var storageKeyVal = {}; //{key: value} for chrome.storage.sync.set
    storageKeyVal[Consts.HistogramDataKey] = Vars.Histogram; // {HistogramDataKey : Vars.Histogram}
    chrome.storage.sync.set(storageKeyVal, function () {
        console.log('updated Todays Histogram ' + JSON.stringify(data));
    });
}

//runs When Pomodoro Timer Ends
function pomodoroEnds() {

    stopTimer();
    stopAmbientSound();
    increasePomodorosToday();
    var title = "Time's Up"
    var msg = "Pomodoro ended." + "\n" + "You have done " + Vars.Histogram[getDate()].pomodoros + " today!"; //default msg if habit not enabled
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

    Vars.PomoSetCounter++; //Update set counter

    if (setComplete) {
        title = "Pomodoro Set Complete!";
    }
    if (Vars.UserData.ManualBreak) {
        manualBreak();
    } else {
        startBreak();
    }

    //Badge
    chrome.browserAction.setBadgeBackgroundColor({
        color: "green"
    });
    chrome.browserAction.setBadgeText({
        text: "\u2713"
    });

    //notify
    notify(title, msg);

    //play sound
    playSound(Vars.UserData.pomodoroEndSound, Vars.UserData.pomodoroEndSoundVolume, false);
}

//start break session - duration in seconds
function startBreak() {
    stopTimer();
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

//take manual break (in popup quick setting) - duration in seconds
function takeBreak(duration) {
    stopTimer();
    Vars.PomoSetCounter = Vars.UserData.PomoSetNum;
    Vars.onManualTakeBreak = true;
    Vars.TimerRunnig = true;
    Vars.onBreak = true;
    startTimer(60 * duration, duringBreak, breakEnds);
}

//start break session - duration in seconds
function manualBreak() {
    stopTimer();
    Vars.TimerRunnig = false;
    Vars.onBreak = true;
    Vars.Timer = Consts.POMODORO_DONE_TEXT;
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
    var onManualTakeBreak = Vars.onManualTakeBreak
    stopTimer();
    var msg;

    //Long break
    if (Vars.PomoSetCounter == Vars.UserData.PomoSetNum) {
        msg = onManualTakeBreak ? "Break is 0ver" : "Long Break is over";
        pomoReset();
        if (Vars.UserData.LongBreakNotify) {
            notifyHabitica(msg);
        }
    }

    //Break Extension on end
    else {
        msg = "Back to work";
        startBreakExtension(Vars.UserData.BreakExtention * 60);
    }

    //notify
    notify("Time's Up", msg);
    //play sound
    playSound(Vars.UserData.breakEndSound, Vars.UserData.breakEndSoundVolume, false);
}

//start break session - duration in seconds
function startBreakExtension(duration) {
    stopTimer();
    Vars.TimerRunnig = true;
    Vars.onBreakExtension = true;
    Vars.onBreak = true;
    var endFunc = Vars.UserData.ManualNextPomodoro ? pomodoroInterupted : (() => { pomodoroInterupted(true) });
    startTimer(duration, duringBreakExtension, endFunc);
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
function pomodoroInterupted(breakPomoStreak) {

    stopAmbientSound();

    var failedBreakExtension = Vars.UserData.BreakExtentionFails && Vars.onBreakExtension;
    var breakExtensionZero = !Vars.UserData.BreakExtentionFails && (Vars.UserData.BreakExtention == 0);
    if (breakPomoStreak) {
        pomoReset();
    } else {
        pauseTimer();
        Vars.Timer = "GO!";
    }

    if (breakExtensionZero) {
        return;
    }

    if (Vars.UserData.PomoHabitMinus || failedBreakExtension) {
        FetchHabiticaData(true);
        var result = ScoreHabit(Vars.PomodoroTaskId, 'down');
        var msg = "";
        if (!result.error) {
            var deltaHp = (result.hp - Vars.Hp).toFixed(2);
            msg = "You Lost Health: " + deltaHp;
            FetchHabiticaData(true);
        } else {
            msg = "ERROR: " + result.error;
        }
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
    Vars.onManualTakeBreak = false;

}

//Pause timer
function pauseTimer() {
    clearInterval(timerInterval);
}

//Stop timer - reset to start position
function pomoReset() {
    stopAmbientSound();
    stopTimer();
    Vars.PomoSetCounter = 0; //Reset Pomo set Count
}

//End pomodoro and start a break
function skipToBreak() {
    stopAmbientSound();
    stopTimer();
    var title = "Time's Up";
    var msg = "Take a break";
    Vars.PomoSetCounter++; //Updae set counter
    startBreak();
    notify(title, msg);
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

//Block Site With Timer Overlay
function blockSiteOverlay(tab) {
    var opacity = Vars.UserData.TranspartOverlay ? "0.85" : "1";
    var url = new URL(tab.url);
    var message = "Stay Focused! Time Left: " + Vars.Timer;
    if (Vars.UserData.GetBlockedSite(url.hostname) && !isInWhiteList(url)) {
        chrome.tabs.executeScript({
            code: `
            document.body.classList.add('blockedSite');
            document.body.setAttribute('data-html',"` + message + `");            
            `
        });
        var imageURL = chrome.extension.getURL("/img/siteKeeper.png");
        chrome.tabs.insertCSS({
            code: `
            .blockedSite:after {background-image:url("` + imageURL + `");}
            .blockedSite:before{background-color:rgba(0,0,0,`+ opacity + `)}
            `
        });
    };
}

//Remove Overlay from current Blocked Site
function unblockSiteOverlay(tab) {
    chrome.tabs.executeScript(tab.id, {
        code: `document.body.className = document.body.className.replace( "blockedSite", '' );
            var blockElementExists = document.getElementById("SitekeeperOverlay");
            if(blockElementExists){
                document.getElementById("SitekeeperOverlay").style.display = 'none'; 
            }
            `
    });
}

//Sends Private Message to the user in Habitica (Used as notification in the mobile app!)
function notifyHabitica(msg) {
    var data = {
        message: msg,
        toUserId: Vars.UserData.Credentials.uid
    };
    callAPI("POST", 'members/send-private-message', JSON.stringify(data));
}

function playSound(soundFileName, volume, loop) {
    if (soundFileName != "None") {
        var myAudio = new Audio(chrome.runtime.getURL("audio/" + soundFileName)) || false;
        if (myAudio) {
            myAudio.volume = volume;
            myAudio.play();
        }
        if (loop && Vars.ambientSound != myAudio) {
            stopAmbientSound();
            Vars.ambientSound = myAudio;
            myAudio.loop = true;    
        }
    }
}

function stopAmbientSound() {
    if (Vars.ambientSound) {
        Vars.ambientSound.pause();
        Vars.ambientSound.currentTime = 0;
    }
}

//returns the current date, "yyyy-mm-dd" format
function getDate() {
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    var yyyy = today.getFullYear();
    //today = mm + '/' + dd + '/' + yyyy;
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

function isFreePassTimeNow() {
    var freePassTimes = Vars.UserData.FreePassTimes;
    for (let i = 0; i < freePassTimes.length; i++) {
        const freePass = freePassTimes[i]
        if (freePass.day == getWeekDay()) {
            if (isTimeBetween(freePass.fromTime, freePass.toTime)) {
                return true;
            }
        }
    }
    return false;
}