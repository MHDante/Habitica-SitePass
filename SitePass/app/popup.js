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
        GenerateCredentialFields();
        document.body.AppendBreak();

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
    
    if (Vars.ServerResponse == 401) {
        var p = document.createElement("p");
        p.style.color = "#FF0000";
        p.AppendText("Credential error! The extension is currently not updating HabitRPG!");
        document.body.appendChild(p);
        document.body.AppendBreak();
    } else {
        var checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = Vars.editingSettings;
        div.style.display = checkbox.checked ? "block" : "none";
        checkbox.onclick = function () { div.style.display = checkbox.checked ? "block" : "none"; };
        var chkLabel = document.createElement("label");
        chkLabel.appendChild(checkbox);
        chkLabel.AppendText("Show Advanced Settings");
        document.body.appendChild(chkLabel);
        document.body.AppendBreak();
    }
    
    var createTextField = function(text, value) {
        var field = document.createElement("input");
        field.type = "text";
        field.value = value;
        var label = document.createElement("label");
        label.AppendText(text);
        label.appendChild(field);
        return label;
    }

    var uid = createTextField("HabitRPG User ID:", Vars.UserData.Credentials.uid);
    var apiToken = createTextField("HabitRPG API Token:", Vars.UserData.Credentials.apiToken);
    var duration = createTextField("Pass Duration(In Minutes)", Vars.UserData.PassDurationMins);

    //Come on, Google!
    uid.onchange = function () { updateCredentials(uid.lastChild.value, apiToken.lastChild.value, duration.lastChild.value); };
    apiToken.onchange = function () { updateCredentials(uid.lastChild.value, apiToken.lastChild.value, duration.lastChild.value); };
    duration.onchange = function () { updateCredentials(uid.lastChild.value, apiToken.lastChild.value, duration.lastChild.value); };
    //ugh.
    //document.body.onunload = function () { chrome.extension.getBackgroundPage().updateCredentials(uid.lastChild.value, apiToken.lastChild.value, duration.lastChild.value); };

    div.appendChild(uid);
    div.AppendBreak();
    div.appendChild(apiToken);
    div.AppendBreak();
    div.appendChild(duration);
    div.AppendBreak();

    var button = document.createElement("button");
    button.AppendText("Save/Update");
    button.onclick = function () {
        Vars.editingSettings = false;
        updateCredentials(uid.lastChild.value, apiToken.lastChild.value, duration.lastChild.value);
        SaveUserSettings();
        background.FetchHabitRPGData();
        if (Vars.UserData.Credentials.uid == "3e595299-3d8a-4a10-bfe0-88f555e4aa0c") {
            alert("I might have a small crush on you.");
        }
    };
    button.type = "submit";
    div.appendChild(button);
    document.body.appendChild(div);
}

function CreateOnClickLink(onclick, param1) {
    var a = document.createElement("a");
    a.href = "#";
    a.onclick = function () { onclick(param1); }
    return a;
}

function fuck(param1) {
    alert(param1);
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
    if (confirm("Are you sure you want to remove this block?")) {
        Vars.UserData.RemoveBlockedSite(site.hostname);
        SaveUserSettings();
    }
}
function updateCredentials() {

}
function getCurrentTabUrl(callback) {
    var queryInfo = {
        active: true,
        currentWindow: true
    };
    chrome.tabs.query(queryInfo, function (tabs) {
        var tab = tabs[0];
        var url = tab.url;
        console.assert(typeof url == "string", "tab.url should be a string");
        callback(url);
    });
}
function updateCredentials(uid, apiToken, duration) {
    Vars.editingSettings = true;
    Vars.UserData.Credentials.uid = uid;
    Vars.UserData.Credentials.apiToken = apiToken;
    var flDuration = parseFloat(duration);
    if (!isNaN(flDuration)) Vars.UserData.PassDurationMins = duration;
}
