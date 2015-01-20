Node.prototype.AppendText = function (string) { this.appendChild(document.createTextNode(string)); }
Node.prototype.AppendBreak = function () { this.appendChild(document.createElement("br")); }


var background = chrome.extension.getBackgroundPage();
var Vars = background.Vars;
var Consts = background.Consts;

document.addEventListener("DOMContentLoaded", function () {
    
    getCurrentTabUrl(function(url) {
        GenerateBlockCommand(url);
        document.body.AppendBreak();
        var para = document.createElement("p");
        para.appendChild(document.createTextNode("Blocked Sites:"));
        document.body.appendChild(para);

        var table = document.createElement("table");
        var blockedSites = Vars.UserData.BlockedSites;
        for (var site in blockedSites) {
            if (blockedSites.hasOwnProperty(site)) {
                var row = document.createElement("tr");
                row.className = "reward-item";

                row.appendChild(GenerateBuyButton(blockedSites[site]));

                var td = document.createElement("td");
                td.appendChild(document.createTextNode(blockedSites[site].hostname));
                row.appendChild(td);

                td = document.createElement("td");
                var pencil = CreateOnClickLink(updateSiteCost, blockedSites[site]);
                pencil.innerHTML = '<img src="img/pencil.png" />';
                td.appendChild(pencil);
                row.appendChild(td);

                td = document.createElement("td");
                var trash = CreateOnClickLink(removeSite, blockedSites[site]);
                trash.innerHTML = '<img src="img/trash.png" />';
                td.appendChild(trash);
                row.appendChild(td);

                table.appendChild(row);
                var divider = document.createElement("tr");
                divider.appendChild(document.createElement("td"));
                table.appendChild(divider);


            }
        }
        document.body.appendChild(table);
        document.body.AppendBreak();
        document.body.appendChild(GenerateCredentialFields());

        var dosh = document.createElement("h1");
        var coin = document.createElement("span");
        coin.className = "shop_gold";
        dosh.appendChild(coin);
        dosh.AppendText(" : " + Vars.Monies.toFixed(2));
        document.body.appendChild(dosh);
    });
});


function GenerateCredentialFields() {
    var div = document.createElement("div");
    div.innerHTML =
        '<div id="EmptyUID">If either field is empty, this extension does not work.</div>' +
        '<label for="uid">HabitRPG User ID:</label><br /><input id="uid" type="text" value="' + Vars.UserData.Credentials.uid + '"/></br>' +
        '<label for="apiToken">HabitRPG API Token:<br /></label><input id="apiToken" type="text" value="' + Vars.UserData.Credentials.apiToken + '"/></br>';
    var button = document.createElement("button");
    button.AppendText("Save");
    button.onclick = updateCredentials;
    button.type = "submit";
    div.appendChild(button);
    return div;
}
function CreateOnClickLink(onclick, param1) {
    var a = document.createElement("a");
    a.href = "#";
    a.onclick = function () { onclick(param1); }
    return a;
}

function GenerateBuyButton(site) {
    var buyLink = CreateOnClickLink(chrome.tabs.create, { url: "http://" + site.hostname });
    var buyButton = document.createElement("td");
    buyButton.className = "gp";
    var coin = document.createElement("span");
    coin.className = "shop_gold";
    buyButton.appendChild(coin);
    buyButton.AppendBreak();
    var cost = site.cost;
    if (cost % 1 != 0) cost = cost.toFixed(2);
    buyButton.AppendText(cost);
    buyLink.appendChild(buyButton);
    return buyLink;
}
function GenerateBlockCommand(currentSiteUrl) {
    var hostname = new URL(currentSiteUrl).hostname;
    var currentSite = Vars.UserData.GetBlockedSite(hostname);
    var link = document.createElement("a");
    if (currentSite) {
        link.AppendText("Un-Block Site!");
        link.onclick = function () {
            Vars.UserData.RemoveBlockedSite(hostname);
            SaveUserSettings();
        }
    } else {
        link.AppendText("Block Site!");
        link.onclick = function () {
            currentSite = Vars.UserData.AddBlockedSite(hostname, 0, Date.now());
            updateSiteCost(currentSite);
            SaveUserSettings();
        }
    }
    link.href = "#";
    document.body.appendChild(link);
}
function SaveUserSettings() {
    var dataPack = {}
    window.close();
    dataPack[Consts.userDataKey] = Vars.UserData;
// ReSharper disable once PossiblyUnassignedProperty
    chrome.storage.sync.set(dataPack, function () { });
    background.FetchHabitRPGData();
}

function updateSiteCost(site) {
        var selection = parseFloat(window.prompt("Enter a cost", site.cost));
        if (!isNaN(selection) && selection >= 0) {
            site.cost = selection;
            SaveUserSettings();
        }
}
function removeSite(site) {
    return function () {
        if (confirm("Are you sure you want to remove this block?")) {
            Vars.UserData.RemoveBlockedSite(site.hostname);
            SaveUserSettings();
        }
    }
}
function updateCredentials() {
    Vars.UserData.Credentials.uid = document.getElementById("uid").value;
    Vars.UserData.Credentials.apiToken = document.getElementById("apiToken").value;
    SaveUserSettings();
    background.FetchHabitRPGData();
    if (Vars.UserData.Credentials.uid == "3e595299-3d8a-4a10-bfe0-88f555e4aa0c") {
        alert("I might have a small crush on you.");
    }

}
function getCurrentTabUrl(callback) {
    var queryInfo = {
        active: true,
        currentWindow: true
    };
    chrome.tabs.query(queryInfo, function (tabs) {
        var tab = tabs[0];
        var url = tab.url;
        console.assert(typeof url == 'string', 'tab.url should be a string');
        callback(url);
    });
}
