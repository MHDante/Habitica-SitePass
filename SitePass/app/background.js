"use strict";
var Consts = {
    serverUrl: 'https://habitica.com/api/v3/',
    serverPathUser : 'user/',
    serverPathTask: 'tasks/sitepass',
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
    urlFilter: { urls: ["<all_urls>"], types: ["main_frame"] },
    opt_extraInfoSpec: ["blocking"],
    userDataKey: "USER_DATA",
    NotificationId : "sitepass_notification"
};

var Vars = {
    EditingSettings:false,
    RewardTask: Consts.RewardTemplate,
    Monies: 0,
    UserData: new UserSettings(),
    ServerResponse: 0
};

function UserSettings(copyFrom) {
    this.BlockedSites = copyFrom ? copyFrom.BlockedSites : {};
    this.Credentials = copyFrom ? copyFrom.Credentials :{uid:"",apiToken:""};
    this.PassDurationMins = copyFrom ? copyFrom.PassDurationMins : 10;
    this.PomoDurationMins = copyFrom ? copyFrom.PomoDurationMins : 18;
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

var callback = function (details) {
    var hostname = new URL(details.url).hostname;
    var site = Vars.UserData.GetBlockedSite(hostname);
    if (!site || site.passExpiry > Date.now()) return { cancel: false };
    FetchHabiticaData();
    if(TimerRunnig){
        alert(  "Stay Focused! " + site.hostname+" is blocked during pomodoro!");
        return { redirectUrl: "http://google.com/" };
    }
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
        site.passExpiry = Date.now() + Vars.UserData.PassDurationMins * 60 * 1000;
        return { cancel: false };
    } else {
        return { redirectUrl: "http://google.com/" };
    }
};

chrome.webRequest.onBeforeRequest.addListener(callback, Consts.urlFilter, Consts.opt_extraInfoSpec);

// ReSharper disable once PossiblyUnassignedProperty
chrome.storage.sync.get(Consts.userDataKey, function (result) { 
    if (result[Consts.userDataKey]) {
        Vars.UserData = new UserSettings(result[Consts.userDataKey]);
        FetchHabiticaData();
    }
});

function getData(silent, credentials, serverPath) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", Consts.serverUrl + serverPath, false);
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

function FetchHabiticaData() {
    var credentials = Vars.UserData.Credentials;
    var userObj = getData(false, credentials, Consts.serverPathUser);
    if (userObj == null) return;
    else Vars.Monies = userObj.data["stats"]["gp"];
    var tasksObj = getData(true, credentials, Consts.serverPathTask);
    if (tasksObj && tasksObj.data["alias"] == "sitepass") {
        Vars.RewardTask = tasksObj.data;
        UpdateTask(0, false);
        return;
    }

    UpdateTask(0, true);
}

function UpdateTask(cost, create) {
    
    Vars.RewardTask.value = cost;
    var xhr = new XMLHttpRequest();
    if (create) {
        xhr.open("POST", Consts.serverUrl + Consts.serverPathUserTasks, false);
    } else {
        xhr.open("PUT", Consts.serverUrl + Consts.serverPathTask, false);

    }
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.setRequestHeader("x-api-user", Vars.UserData.Credentials.uid);
        xhr.setRequestHeader("x-api-key", Vars.UserData.Credentials.apiToken);
        var data = { "data": Vars.RewardTask }
        xhr.send(JSON.stringify(Vars.RewardTask));
        Vars.RewardTask = JSON.parse(xhr.responseText).data;
    
}

function ConfirmPurchase(site) {
    UpdateTask(site.cost);
    var xhr = new XMLHttpRequest();
    xhr.open("POST", Consts.serverUrl + Consts.serverPathTask+"/score/down", false);
    xhr.setRequestHeader("x-api-user", Vars.UserData.Credentials.uid);
    xhr.setRequestHeader("x-api-key", Vars.UserData.Credentials.apiToken);
    xhr.send();
    Vars.Monies -= site.cost;

}

// ------------- pomodoro ---------------------------

var Timer = "00:00";
var TimerRunnig = false;
var interval;
//Start Pomodoro Timer - duration in seconds
function startTimer(duration) {  
    var timer = duration, minutes, seconds;
    TimerRunnig = true;
    interval = setInterval(function () {
        minutes = parseInt(timer / 60, 10)
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;
       
        Timer = minutes + ":" + seconds;
        console.log(Timer);

        //Show time on icon badge 
        chrome.browserAction.setBadgeText({
            text: Timer
        });
        
        
        //Block Site alredy opened
        var site = getCurrentTab()[0];
        var tabId = getCurrentTab()[1];
        let msg = {
            request:"block",
            content:"This Site is Blocked, Time Left: "+Timer
        }
        console.log(site,tabId,msg);
        if(Vars.UserData.GetBlockedSite(site)){
            chrome.tabs.sendMessage(tabId,msg);
        };
 


        //Times Up
        if (--timer < 0) {
            stopTimer();
            console.log("Time's Up");
            notify("Times Up","Pomodoro ended");
        }

    }, 1000);
}
//Stop Pomodoro Timer
function stopTimer(){
    TimerRunnig = false;
    clearInterval(interval);
    Timer = "00:00";
    chrome.browserAction.setBadgeText({
        text: ''
    });
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

//Get current tab id and current tab url host
var CurrentTab; //current working tab
var CurrentHost; //current working tab host
function getCurrentTab(){    
    chrome.tabs.query({'active': true, 'windowId': chrome.windows.WINDOW_ID_CURRENT},
    function(tabs){
        if(tabs[0]){
            CurrentTab = tabs[0];
        }
    }); 
    CurrentHost = new URL(CurrentTab.url).hostname;
    return [CurrentHost,CurrentTab.id]; 
}


