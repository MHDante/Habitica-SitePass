Node.prototype.AppendText = function (string) { this.appendChild(document.createTextNode(string)); }
Node.prototype.AppendBreak = function () { this.appendChild(document.createElement("br")); }


var background = chrome.extension.getBackgroundPage();
var Vars = background.Vars;
var Consts = background.Consts;

document.addEventListener("DOMContentLoaded", function () {

    getCurrentTabUrl(function (url) {
        UpdateBlockCommand(url);

        var table = $("#SiteTable");
        var blockedSites = Vars.UserData.BlockedSites;
        for (var site in blockedSites) {
            if (blockedSites.hasOwnProperty(site)) {

                var cost = blockedSites[site].cost;
                if (cost % 1 != 0) cost = cost.toFixed(2);

                var row = $(document.createElement("tr"));
                row.addClass("reward-item");

                var html =
                    '<td class="gp">' +
                        '<a id ="Buy" href="#">' +
                            '<span class="shop_gold"></span><br>' + cost +
                        '</a>' +
                    '</td>' +
                    '<td>' + blockedSites[site].hostname + '</td>' +
                    '<td><a id ="Edit" href="#"><img src="img/pencil.png"></a></td>' +
                    '<td><a id ="Delete" href="#"><img src="img/trash.png"></a></td>';
                row.html(html);

                var row2 = $(document.createElement("tr"));
                row2.addClass("cost-input");

                var html2 = '<td /><td style="white-space:nowrap;text-align:center;"><label>Cost <input type="text"maxlength="8" size="8"></label></td><td/><td/>';
                row2.html(html2);
                var input = row2.find('input');
                input.on("keyup", CreateDelegate(updateSiteCost, { site: blockedSites[site], cost: input }));
                input.on("keypress", CostSubmit(row2));
                row2.hide();




                row.find('#Buy').click(CreateDelegate(chrome.tabs.create, "http://" + blockedSites[site].hostname));
                row.find('#Edit').click(CreateDelegate(Toggle, row2));
                row.find('#Delete').click(CreateDelegate(removeSite, blockedSites[site]));
                table.append(row);
                table.append(row2);
                table.append("<tr><td></td><tr>");
            }
        }
        CredentialFields();
        $("#Dosh").append(Vars.Monies.toFixed(2));
    });
});
function Toggle(obj) {
    obj.fadeToggle();
}
function CostSubmit(r) {
    return function (e) {
        if (e.which == 13) {
            SaveUserSettings();
            r.fadeOut();
            return false;    //<---- Add this line
        }
    }
}

function CredentialFields() {
    var div = $("#Credentials");
    if (Vars.ServerResponse == 401) {
        $("#CredError").slideDown();
        div.show();
    } else {
        var label = $("#AdvSettings");
        var checkbox = label.find("input");
        label.show();
        checkbox.prop("checked", Vars.EditingSettings);
        if (checkbox.prop("checked")) div.slideDown();

        checkbox.click(function () {
            if (checkbox.prop("checked")) div.slideDown();
            else {
                div.slideUp();
                Vars.EditingSettings = false;
            }
        });
    }
    //Come on, Google!

    $("#UID").val(Vars.UserData.Credentials.uid);
    $("#APIToken").val(Vars.UserData.Credentials.apiToken);
    $("#Duration").val(Vars.UserData.PassDurationMins);


    $("#UID").on("keyup", function () { updateCredentials(); });
    $("#APIToken").on("keyup", function () { updateCredentials(); });
    $("#Duration").on("keyup", function () { updateCredentials(); });
    //ugh.

    $("#SaveButton").click(function () {
        updateCredentials();
        Vars.EditingSettings = false;
        if (Vars.UserData.Credentials.uid == "3e595299-3d8a-4a10-bfe0-88f555e4aa0c") {
            alert("I might have a small crush on you.");
        }
        SaveUserSettings();
        background.FetchHabitRPGData();

    });
}

function CreateDelegate(onclick, param1) {
    return function () { onclick(param1); }
}

function NewTab(url) {
    return function () { chrome.tabs.create({ url: url }); }
}
function fuck(param1) {
    alert(param1);
}

function UpdateBlockCommand(currentSiteUrl) {
    var hostname = new URL(currentSiteUrl).hostname;
    var currentSite = Vars.UserData.GetBlockedSite(hostname);
    if (currentSite) {
        $("#BlockLink").text("Un-Block Site!");
        $("#BlockLink").click(function () {
            Vars.UserData.RemoveBlockedSite(hostname);
            SaveUserSettings();
        });

    } else {
        $("#BlockLink").text("Block Site!");
        $("#BlockLink").click(function () {
            currentSite = Vars.UserData.AddBlockedSite(hostname, 0, Date.now());
            //updateSiteCost(currentSite);
            SaveUserSettings();
        });
    }
}
function SaveUserSettings() {
    var dataPack = {}
    dataPack[Consts.userDataKey] = Vars.UserData;
    location.reload(true);
    // ReSharper disable once PossiblyUnassignedProperty
    chrome.storage.sync.set(dataPack, function () { });
}

function updateSiteCost(siteAndCost) {

    var selection = parseFloat(siteAndCost.cost.val());
    if (!isNaN(selection) && selection >= 0) {
        siteAndCost.site.cost = selection;
    }
}
function removeSite(site) {
        Vars.UserData.RemoveBlockedSite(site.hostname);
        SaveUserSettings();
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
function updateCredentials() {
    Vars.EditingSettings = true;
    Vars.UserData.Credentials.uid = $("#UID").val();
    Vars.UserData.Credentials.apiToken = $("#APIToken").val();
    var flDuration = parseFloat($("#Duration").val());
    if (!isNaN(flDuration)) Vars.UserData.PassDurationMins = flDuration;
}
