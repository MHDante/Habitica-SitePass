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
    userDataKey : "USER_DATA"
};

var Vars = {
    RewardTask: Consts.RewardTemplate,
    Monies: 0,
    UserData: new UserSettings()
};

function UserSettings() {
    this.BlockedSites = {};
    this.Credentials = {uid:"",apiToken:""};
    this.PassDurationMins = 10;
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
    this.isAllowed = function() { return this.passExpiry > Date.now() };
}

var callback = function(details) {
    var site = Vars.UserData.GetBlockedSite(new URL(details.url).hostname);
    if (!site || site.isAllowed) return { cancel: false };

    if (site.cost > Monies) {
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

chrome.storage.sync.get(Consts.userDataKey, function (result) { 
    if (result.Credentials) {
        Vars.UserData = result[Consts.userDataKey];
        FetchHabitRPGData();
    }
});

function FetchHabitRPGData() {

    if (!Credentials||
        Credentials.uid == "" ||
        Credentials.apiToken == "") return;

    var xhr = new XMLHttpRequest();
    xhr.open("GET", serverUrl + serverPathUser, false);
    xhr.setRequestHeader("x-api-user", Credentials[0]);
    xhr.setRequestHeader("x-api-key", Credentials[1]);
    xhr.send();
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
    
    Vars.RewardTask.cost = cost;
    var xhr2 = new XMLHttpRequest();
    if (create) {
        xhr2.open("POST", serverUrl + serverPathTasks, false);
    } else {
        xhr2.open("PUT", serverUrl + serverPathTasks + "/sitepass", false);
    }
    xhr2.setRequestHeader("Content-Type", "application/json");
    xhr2.setRequestHeader("x-api-user", Credentials[0]);
    xhr2.setRequestHeader("x-api-key", Credentials[1]);
    xhr2.send(JSON.stringify(Vars.RewardTask));
    Vars.RewardTask = JSON.parse(xhr2.responseText);
}



function ConfirmPurchase(site) {


}