"use strict";
var Consts = {
    serverUrl : 'https://habitrpg.com:443/api/v2',
    serverPathUser : '/user',
    serverPathTasks : '/user/tasks',
    RewardTemplate :
        {
            text: "SitePass",
            value: 0,
            notes:  "Reward utilized by HabitRPG SitePass."+
                    " Changes value depending on last accessed website.",
            id: "sitepass",
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
    FetchHabitRPGData();
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
        FetchHabitRPGData();
    }
});

function FetchHabitRPGData() {
    var credentials = Vars.UserData.Credentials;
    var xhr = new XMLHttpRequest();
    xhr.open("GET", Consts.serverUrl + Consts.serverPathUser, false);
    xhr.setRequestHeader("x-api-user", credentials.uid);
    xhr.setRequestHeader("x-api-key", credentials.apiToken);
    try {
        xhr.send();

    } catch (e) {
        xhr.status = 0;
    }
    Vars.ServerResponse = xhr.status;
    if (xhr.status == 401) {
        chrome.notifications.create(Consts.NotificationId,
            {
                type: "basic",
                iconUrl: "img/icon.png",
                title: "HabitRPG SitePass Credentials Error",
                message: "Click on the gold coin icon in the top right of your browser to set your credentials."
            },
            function () { });
        return;
    }else if ( xhr.status != 200) {
        chrome.notifications.create(Consts.NotificationId,
        {
            type: "basic",
            iconUrl: "img/icon.png",
            title: "HabitRPG SitePass Connection Error",
            message: "The service might be temporarily unavailable. Contact @MHDante if it persists. Error =" + xhr.status
    },
            function () { });
        return;
    }
    var userObj = JSON.parse(xhr.responseText);
    Vars.Monies = userObj["stats"]["gp"];
    //This might be replacable by one api call. But it seems wasteful to query the server again.
    var rewards = userObj["rewards"];
    if (rewards && rewards.constructor === Array) { 
        for (var i = 0; i < rewards.length; i++) {
            if (rewards[i] && rewards[i].id == "sitepass") {
                Vars.RewardTask = rewards[i];
                return;
            }
        }
    }
    UpdateTask(0,true);
}

function UpdateTask(cost, create) {
    
    Vars.RewardTask.value = cost;
    var xhr = new XMLHttpRequest();
    if (create) {
        xhr.open("POST", Consts.serverUrl + Consts.serverPathTasks, false);
    } else {
        xhr.open("PUT", Consts.serverUrl + Consts.serverPathTasks + "/sitepass", false);
    }
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("x-api-user", Vars.UserData.Credentials.uid);
    xhr.setRequestHeader("x-api-key", Vars.UserData.Credentials.apiToken);
    xhr.send(JSON.stringify(Vars.RewardTask));
    Vars.RewardTask = JSON.parse(xhr.responseText);
}

function ConfirmPurchase(site) {
    UpdateTask(site.cost);
    var xhr = new XMLHttpRequest();
    xhr.open("POST", Consts.serverUrl + Consts.serverPathTasks + "/sitepass/down", false);
    xhr.setRequestHeader("x-api-user", Vars.UserData.Credentials.uid);
    xhr.setRequestHeader("x-api-key", Vars.UserData.Credentials.apiToken);
    xhr.send();
    Vars.Monies -= site.cost;

}