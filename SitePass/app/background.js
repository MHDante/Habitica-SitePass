"use strict";
var Consts = {
    xClientHeader: "5a8238ab-1819-4f7f-a750-f23264719a2d-HabiticaPomodoroSiteKeeper",
    serverUrl: 'https://habitica.com/api/v3/',
    serverPathUser : 'user/',
    serverPathTask: 'tasks/sitepass',
    serverPathPomodoroHabit:'tasks/sitepassPomodoro',
    serverPathUserTasks: 'tasks/user',
    RewardTemplate :
        {
            text: "SitePass",
            value: 0,
            notes:  "Reward utilized by Habitica SitePass."+
                    " Changes value depending on last accessed website.",
            alias: "sitepass",
            type: "reward"
        },
    PomodoroHabitTemplate :
    {
        text: ":tomato: Pomodoro",
        type: "habit",
        alias: "sitepassPomodoro",
        notes:  "Habit utilized by Habitica SitePass. "+
                "Please change the difficulty manualy according to your needs.",
        priority: 1
    },
    urlFilter: { urls: ["<all_urls>"], types: ["main_frame"] },
    opt_extraInfoSpec: ["blocking"],
    userDataKey: "USER_DATA",
    PomodorosTodayDataKey:"PomodorosToday",
    NotificationId : "sitepass_notification",
    ProtectedStopDuration : 10 //Don't fail pomodoro if stoped in the first x seconds
};

var Vars = {
    EditingSettings:false,
    RewardTask: Consts.RewardTemplate,
    PomodoroTaskId:null,
    PomodorosToday:{value:0,date:0},
    Monies: 0,
    Exp: 0,
    Hp: 0,
    UserData: new UserSettings(),
    ServerResponse: 0,
    Timer: "00:00",
    TimerValue: 0, //in seconds
    TimerRunnig:false,
    onBreak:false,
    onBreakExtension:false
};

function UserSettings(copyFrom) {
    this.BlockedSites = copyFrom ? copyFrom.BlockedSites : {};
    this.Credentials = copyFrom ? copyFrom.Credentials :{uid:"",apiToken:""};
    this.PassDurationMins = copyFrom ? copyFrom.PassDurationMins : 10;
    this.PomoDurationMins = copyFrom ? copyFrom.PomoDurationMins : 25;
    this.PomoHabitPlus = copyFrom ? copyFrom.PomoHabitPlus :false; //Hit + on habit when pomodoro done
    this.PomoHabitMinus = copyFrom ? copyFrom.PomoHabitMinus :false; //Hit - on habit when pomodoro is interupted
    this.PomoProtectedStop = copyFrom ? copyFrom.PomoProtectedStop :false;
    this.BreakDuration = copyFrom ? copyFrom.BreakDuration :5;
    this.ManualBreak = copyFrom ? copyFrom.ManualBreak :true;
    this.BreakFreePass = copyFrom ? copyFrom.BreakFreePass :false;
    this.BreakExtention = copyFrom ? copyFrom.BreakExtention :1;
    this.BreakExtentionFails = copyFrom ? copyFrom.BreakExtentionFails :false;
    
    this.GetBlockedSite = function (hostname) {
        return this.BlockedSites[hostname];
    }
    this.RemoveBlockedSite = function (site) {
        if (site.hostname) {
            delete this.BlockedSites[site.hostname];
        }else
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
function checkAndBlockHostname(hostname){
    
    var freePass = Vars.UserData.BreakFreePass && Vars.onBreak && Vars.TimerRunnig; //free pass during break session
    var site = Vars.UserData.GetBlockedSite(hostname);
    var pomodoro = Vars.TimerRunnig && !Vars.onBreak;
    if (!site || site.passExpiry > Date.now() || pomodoro || site.cost == 0 || freePass) return { cancel: false };
    FetchHabiticaData();
    if (site.cost > Vars.Monies) {
        alert(  "You can't afford to visit " + site.hostname + " !\n" +
                "Complete some tasks and try again!");
        return { redirectUrl: "http://google.com/" };
    }
    var r = confirm("You're trying to Access " + site.hostname + "!\n" +
        "It will cost you " + site.cost.toFixed(2) +
        " to access for " + Vars.UserData.PassDurationMins + " minutes!");
    if (r) {
        ConfirmPurchase(site);
        var passDurationMiliSec = Vars.UserData.PassDurationMins * 60 * 1000
        site.passExpiry = Date.now() + passDurationMiliSec;
        return { cancel: false , confirmPurchase:true};
    } else {
        return { redirectUrl: "http://google.com/" };
    }
}

var callbackwebRequest = function (details) {
    var hostname = new URL(details.url).hostname;
    var checkSite = checkAndBlockHostname(hostname);
    var confirmPurchase = checkSite.confirmPurchase;
    if(confirmPurchase){
        //Check if the user is not on the same site for longer than passDuration
        var passDurationMiliSec = Vars.UserData.PassDurationMins * 60 * 1000
        setTimeout(function(arg){ 
            callbackTabActive(arg); 
            }, passDurationMiliSec,{tabId: details.tabId});
            delete checkSite.confirmPurchase;
    }
    return checkSite;
};

var callbackTabActive = function (details) {
    chrome.tabs.get(details.tabId, function callback(tab){
        console.log(Vars.onBreak);
        if(!Vars.TimerRunnig || Vars.onBreak){
            unblockSiteOverlay(tab);
            var hostname = new URL(tab.url).hostname;
            var checkSite = checkAndBlockHostname(hostname);
            var redirectUrl = checkSite.redirectUrl;
            var confirmPurchase = checkSite.confirmPurchase;
            if(redirectUrl){
                chrome.tabs.update(tab.id, {url:redirectUrl});
            }else if (confirmPurchase){
                //Check if the user is not on the same site for longer than passDuration
               var passDurationMiliSec = Vars.UserData.PassDurationMins * 60 * 1000 
               setTimeout(function(arg){ 
                callbackTabActive(arg); 
                }, passDurationMiliSec,details);
            }
        }
    });    
};

//Entering a new url 
chrome.webRequest.onBeforeRequest.addListener(callbackwebRequest, Consts.urlFilter, Consts.opt_extraInfoSpec);

//Switching tabs
chrome.tabs.onActivated.addListener(callbackTabActive);

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

//Habitica Api general call
function callAPI(method, route, postData) {
	var xhr = new XMLHttpRequest();
    xhr.open(method, Consts.serverUrl + route, false);
    xhr.setRequestHeader('x-client', Consts.xClientHeader);
	xhr.setRequestHeader('Content-Type', 'application/json');
	xhr.setRequestHeader('x-api-user', Vars.UserData.Credentials.uid);
	xhr.setRequestHeader('x-api-key', Vars.UserData.Credentials.apiToken);
	if (typeof postData !== 'undefined')  xhr.sendend(postData);
	else                                  xhr.send();
	return (xhr.responseText);
}

function getData(silent, credentials, serverPath) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", Consts.serverUrl + serverPath, false);
    xhr.setRequestHeader('x-client', Consts.xClientHeader);
    xhr.setRequestHeader("x-api-user", credentials.uid);
    xhr.setRequestHeader("x-api-key", credentials.apiToken);
    try {
        xhr.send();
    } catch (e) {

    }
    Vars.ServerResponse = xhr.status;
    if (xhr.status == 401) {
        chrome.notifications.create(Consts.NotificationId,
            {
                type: "basic",
                iconUrl: "img/icon.png",
                title: "Habitica SitePass Credentials Error",
                message: "Click on the gold coin icon in the top right of your browser to set your credentials."
            },
            function () { });
        return null;
    } else if (xhr.status != 200) {
        if (!silent) {
            chrome.notifications.create(Consts.NotificationId,
                {
                    type: "basic",
                    iconUrl: "img/icon.png",
                    title: "Habitica SitePass Connection Error",
                    message: "The service might be temporarily unavailable. Contact @MHDante if it persists. Error =" +
                        xhr.status
                },
                function() {});
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
    if(!skipTasks){
        var tasksObj;
        //get pomodoro task id
        tasksObj = getData(true, credentials, Consts.serverPathPomodoroHabit);
        if (tasksObj && tasksObj.data["alias"] == "sitepassPomodoro") {
            Vars.PomodoroTaskId = tasksObj.data.id;
        }else{
            var result = CreatePomodoroHabit();
            if(result.error){
                notify("ERROR",result.error);
            }else{
                Vars.PomodoroTaskId = result;
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
        var data = { "data": Vars.RewardTask }
        xhr.send(JSON.stringify(Vars.RewardTask));
        Vars.RewardTask = JSON.parse(xhr.responseText).data;
    
}

function CreatePomodoroHabit() {
    var data = JSON.stringify(Consts.PomodoroHabitTemplate);
    var p = JSON.parse(callAPI("POST", Consts.serverPathUserTasks,data));
    if (p.success != true) {
        return {error:'Failed to Create Pomodoro Habit task'};
    }else{
        return p.data.id;
     }
}

function ConfirmPurchase(site) {
    UpdateRewardTask(site.cost);
    callAPI("POST",Consts.serverPathTask+"/score/down");
    Vars.Monies -= site.cost;
}

//direction 'up' or 'down'
function ScoreHabit(habitId,direction){
    var p = JSON.parse(callAPI("POST", '/tasks/' + habitId + '/score/' + direction));
    if (p.success != true) {
        return {error:'Failed to score task ' + habitId + ', doublecheck its ID'};
    }
    return { lvl: p.data.lvl, hp: p.data.hp, exp: p.data.exp, mp: p.data.mp, gp: p.data.gp };
}

// ------------- pomodoro ---------------------------

var timerInterval; //Used for timer interval in startTimer() function.

/**
 * Start Timer: 
 * @param {int} duration the duration in seconds.
 * @param {function} duringTimerFunction this function runs every second while the timer runs.
 * @param {function} endTimerFunction this function runs when timer reachs 00:00.
 */
function startTimer(duration,duringTimerFunction,endTimerFunction) { 
    var timer = duration, minutes, seconds;
    var duringTimer = function () { duringTimerFunction() };
    var endTimer = function () { endTimerFunction() };

    timerInterval = setInterval(function () {
        minutes = parseInt(timer / 60, 10)
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;
       
        Vars.Timer = minutes + ":" + seconds;
        Vars.TimerValue = minutes*60+seconds;
        
        duringTimer();
       
        //Times Up
        if (--timer < 0) {
            endTimer();
        }

    }, 1000);
}

//start pomodoro session - duration in seconds
function startPomodoro(duration){
    Vars.TimerRunnig = true;
    Vars.onBreak = false;
    startTimer(duration,duringPomodoro,pomodoroEnds);
}

//runs during pomodoro session
function duringPomodoro(){
    //Show time on icon badge 
    chrome.browserAction.setBadgeBackgroundColor({color: "green"});
    chrome.browserAction.setBadgeText({ text: Vars.Timer });
    //Block current tab if necessary
    CurrentTab(blockSiteOverlay);
}


//runs When Pomodoro Timer Ends
function pomodoroEnds(){
    stopTimer();
    var msg ="Pomodoro ended."+"\n"+"You have done "+Vars.PomodorosToday.value+" today!";
    //If Pomodoro Habit + is enabled
    if(Vars.UserData.PomoHabitPlus){
        FetchHabiticaData(true);
        var result = ScoreHabit(Vars.PomodoroTaskId,'up');
        if(!result.error){
            var deltaGold = (result.gp-Vars.Monies).toFixed(2);
            var deltaExp = (result.exp-Vars.Exp).toFixed(2);
            msg = "You Earned Gold: +" +deltaGold +"\n"+"You Earned Exp: +"+deltaExp;
            FetchHabiticaData(true);
        }else{
            msg = "ERROR: "+result.error;
        }
    }
    //update Pomodoros today
    Vars.PomodorosToday.value ++;
    var Pomodoros =  {};
    Pomodoros[Consts.PomodorosTodayDataKey] = Vars.PomodorosToday;
    chrome.storage.sync.set(Pomodoros, function() {
        console.log('PomodorosToday is set to ' + JSON.stringify(Pomodoros));
    });
    //notify
    notify("Time's Up", msg);
    if(Vars.UserData.ManualBreak){
        manualBreak();
    }else{
        startBreak(Vars.UserData.BreakDuration*60);
    }
}

//start break session - duration in seconds
function startBreak(duration){
    stopTimer();
    Vars.TimerRunnig = true;
    Vars.onBreak = true;
    startTimer(duration,duringBreak,breakEnds);
}

//start break session - duration in seconds
function manualBreak(){
    stopTimer();
    Vars.TimerRunnig = false;
    Vars.onBreak = true;
}

//runs during Break session
function duringBreak(){
    //Show time on icon badge 
    chrome.browserAction.setBadgeBackgroundColor({color: "blue"});
    chrome.browserAction.setBadgeText({ text: Vars.Timer });
}

//runs when Break session ends
function breakEnds(){
    stopTimer();
    var msg ="Back to work";
    //notify
    notify("Time's Up", msg);
    startBreakExtension(Vars.UserData.BreakExtention*60);
}

//start break session - duration in seconds
function startBreakExtension(duration){
    stopTimer();
    Vars.TimerRunnig = true;
    Vars.onBreakExtension=true;
    Vars.onBreak=true;
    startTimer(duration,duringBreakExtension,pomodoroInterupted);
}

//runs during Break session
function duringBreakExtension(){
    //Show time on icon badge 
    chrome.browserAction.setBadgeBackgroundColor({color: "red"});
    chrome.browserAction.setBadgeText({ text: Vars.Timer });
}

//runs when pomodoro is interupted (stoped before timer ends/break extension over)
function pomodoroInterupted(){
   var protectedStop = Vars.UserData.PomoProtectedStop;
   var duration = (Vars.UserData.PomoDurationMins*60)-Vars.TimerValue;
   var portectedStopActivated = protectedStop && duration <= Consts.ProtectedStopDuration && !Vars.onBreakExtension;
   var failedBreakExtension = Vars.UserData.BreakExtentionFails && Vars.onBreakExtension;
   var breakExtensionZero = !Vars.UserData.BreakExtentionFails && (Vars.UserData.BreakExtention == 0);
   stopTimer();
   if(portectedStopActivated || breakExtensionZero){
        return;
   }
   if(Vars.UserData.PomoHabitMinus || failedBreakExtension){
        FetchHabiticaData();
        var result = ScoreHabit(Vars.PomodoroTaskId,'down');
        var msg = "";
        if(!result.error){
            var deltaHp = (result.hp-Vars.Hp).toFixed(2);
            msg = "You Lost Health: "+deltaHp;
            FetchHabiticaData();
        }else{
            msg = "ERROR: "+result.error;
        }
        console.log(msg);
        notify("Pomodoro Failed!", msg);
    }  
}

//Stop timer - reset to start position
function stopTimer(){
    
    clearInterval(timerInterval);
    Vars.Timer = "00:00";
    chrome.browserAction.setBadgeText({
        text: ''
    });

    CurrentTab(unblockSiteOverlay); //if current tab is blocked, unblock it
    CurrentTab(function(tab){callbackTabActive({tabId: tab.id})}); //ConfirmPurchase check
    
    Vars.TimerRunnig = false;
    Vars.onBreak = false;
    Vars.onBreakExtension = false;

}

//Create Chrome Notification
function notify(title,message, callback) {
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
function CurrentTab(func){    
    chrome.tabs.query({'active': true, 'windowId': chrome.windows.WINDOW_ID_CURRENT},
    function(tabs){
        if(tabs[0]){
            func(tabs[0]);
        }
    });
}

//Block Site With Overlay
function blockSiteOverlay(tab){
    var site = new URL(tab.url).hostname;
    var tabId = tab.id;
    var message = "Stay Focused! Time Left: "+Vars.Timer;
    let msg = {
        request:"block",
        content:message
    }
    if(Vars.UserData.GetBlockedSite(site)){
        chrome.tabs.sendMessage(tabId,msg);
    };
}

//Remove Overlay from current Blocked Site
function unblockSiteOverlay(tab){
    var site = new URL(tab.url).hostname;
    var tabId = tab.id;
    let msg = {
        request:"unblock"
    }
    if(Vars.UserData.GetBlockedSite(site)){
        chrome.tabs.sendMessage(tabId,msg);
    };
}


