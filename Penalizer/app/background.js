var Domains = [];
var Credentials = [];
var Monies = 0;
var PurchaseRewardTask = 
        {
            text: "SitePass",
            value: 0,
            notes: "Reward utilized by HabitRPG SitePass. Changes value depending on last accessed website.",
            id: "sitepass",
            type: "reward"
        };
var UserObj;

var accessDurationMins = 10;
var serverUrl = 'https://habitrpg.com:443/api/v2';
var serverPathUser = '/user';
var serverPathTasks = '/user/tasks';

function Domain(hostname, cost, passExpiry) {
    this.hostname = hostname;
    this.cost = cost;
    this.passExpiry = passExpiry;
}

var callback = function (details) {
    //alert(details.url);
    var hostname = new URL(details.url).hostname;
    var index = -1;
    for (var j = 0; j < Domains.length; j++) {
        if (Domains[j].hostname == hostname) {
            index = j;
            break;
        }
    }

    if (index > -1) {
        var domain = Domains[index];
        if (domain.passExpiry > Date.now()) {
            return { cancel: false };
        }
        if (domain.cost > Monies) {
            alert("You can't afford it!\nComplete some tasks and try again!");
            return { redirectUrl: "http://google.com/" };
        }
        var r = confirm("You're trying to Access " + domain.hostname + "!\nThis Will cost you " + domain.cost.toFixed(2) + " to access for " + accessDurationMins + " minutes!");
        if (r == true) {
            domain.passExpiry = Date.now() + accessDurationMins * 60 * 1000;
            return { cancel: false };
        } else {
            return { redirectUrl: "http://google.com/" };
        }
    };
    return { cancel: false };
};

var filter = {urls: ["<all_urls>"] , types: ["main_frame"] };

var opt_extraInfoSpec = ["blocking"];
chrome.webRequest.onBeforeRequest.addListener(
        callback, filter, opt_extraInfoSpec);

chrome.storage.sync.get("save", function (result) {
    console.log(typeof result.save);
    if (!(result.save instanceof Array)) {
        Domains = [];
    } else {
        Domains = result.save;
    }
});

chrome.storage.sync.get("creds", function (result) {
    
    console.log(typeof result.creds);
    if (!(result.creds instanceof Array)) {
        Credentials = ["", ""];
    } else {
        Credentials = result.creds;
    }
    FetchUserData();
});


function FetchUserData() {
    if (Credentials.length < 1 || Credentials[0] == "" || Credentials[1] == "")return;
    var xhr = new XMLHttpRequest();
    xhr.open("GET", serverUrl + serverPathUser, false);
    xhr.setRequestHeader("x-api-user", Credentials[0]);
    xhr.setRequestHeader("x-api-key", Credentials[1]);
    xhr.send();
    UserObj = JSON.parse(xhr.responseText);
    Monies = UserObj.stats.gp;
    var rewards = UserObj.rewards;
    if (rewards && rewards.constructor === Array) { //this might be replacable by one api call.
        for (var i = 0; i < rewards.length; i++) {
            if (rewards[i] && rewards[i].id == "SitePass") {
                PurchaseRewardTask == rewards[i];
                return;
            }
        }
    }
    UpdateTask(0,true);

}

function UpdateTask(cost, create) {
    
    PurchaseRewardTask.cost = cost;
    var xhr2 = new XMLHttpRequest();
    if (create) {
        xhr2.open("POST", serverUrl + serverPathTasks, false);
    } else {
        xhr2.open("PUT", serverUrl + serverPathTasks + "/sitepass", false);
    }
    xhr2.setRequestHeader("Content-Type", "application/json");
    xhr2.setRequestHeader("x-api-user", Credentials[0]);
    xhr2.setRequestHeader("x-api-key", Credentials[1]);
    xhr2.send(JSON.stringify(PurchaseRewardTask));
    PurchaseRewardTask = JSON.parse(xhr2.responseText);
}



function ConfirmPurchase(domain) {


}