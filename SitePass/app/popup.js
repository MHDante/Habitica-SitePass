Node.prototype.AppendText = function (string) { this.appendChild(document.createTextNode(string)); }
Node.prototype.AppendBreak = function () { this.appendChild(document.createElement("br")); }


var background = chrome.extension.getBackgroundPage();
var Vars = background.Vars;
var Consts = background.Consts;
var CurrentTabHostname = 
document.addEventListener("DOMContentLoaded", function () {

    getCurrentTabUrl(function (url) {
        CurrentTabHostname = new URL(url).hostname;
        UpdateBlockCommand();
    });

    $("#BlockLink").click(function () {
        var currentSite = Vars.UserData.GetBlockedSite(CurrentTabHostname);
        if (currentSite) removeSite(currentSite);
        else {
            currentSite = Vars.UserData.AddBlockedSite(CurrentTabHostname, 0, Date.now());
            AddSiteToTable(currentSite, true);
            UpdateBlockCommand();
        }
        SaveUserSettings();
        return false;
    });

    var blockedSites = Vars.UserData.BlockedSites;
    for (var site in blockedSites) {
        if (blockedSites.hasOwnProperty(site)) {
            AddSiteToTable(blockedSites[site]);
        }
    }
    CredentialFields();
    $("#Dosh").append(Vars.Monies.toFixed(2));
    
});


function AddSiteToTable(site, fadein) {
    var table = $("#SiteTable");
    var cost = site.cost;
    if (cost % 1 != 0) cost = cost.toFixed(2);

    var tbody = $(document.createElement("tbody"));
    tbody.attr("id", site.hostname);
    var html =
        '<tr class="reward-item">' +
            '<td class="gp">' +
                '<a class="buy" href="#">' +
                    '<span class="shop_gold"></span><br>' + cost +
            '</a></td>' +
            '<td style="width:100%"><div class="hostname">' + site.hostname + '</div></td>' +
            '<td><a class="edit" href="#"><img src="img/pencil.png"></a></td>' +
            '<td><a class="delete" href="#"><img src="img/trash.png"></a></td>' +
        '</tr>' +
        '<tr class="cost-input" style="display:none;">' +
            '<td style="white-space:nowrap;text-align:center;" colspan="4">' +
                '<label>Cost ' +
                    '<input class="cost" type="text"maxlength="8" size="8" value="' + site.cost + '">' +
        '</label></td></tr>'+
        '<tr><td></td><tr>';

    tbody.html(html);
    

    tbody.data("site", site);
    var costRow = tbody.find('.cost-input');
    var input = costRow.find('.cost');
    input.on("keyup", CreateDelegate(updateSiteCost, { site: site, cost: input }));
    input.on("keypress", CostSubmit(costRow));
    tbody.find('.buy').click(CreateDelegate(chrome.tabs.create, { url: "http://" + site.hostname }));
    tbody.find('.edit').click(CreateDelegate(Toggle, costRow));
    tbody.find('.delete').click(CreateDelegate(removeSite, site));
    table.append(tbody);
    if (fadein) {
        Toggle(costRow);
        tbody.hide();
        tbody.fadeIn();
    }
}
function Toggle(obj) {
    if ($(obj).is(":visible")) {
        obj.fadeOut({ complete: function() {
            $("tbody").each(function () {
                $(this).find(".buy")
                    .html('<span class="shop_gold"></span><br>' + $(this).data("site").cost);
            });
        } });
    } else {
        obj.fadeIn();
        obj.find("input").select();
    }
}
function CostSubmit(r) {
    return function (e) {
        if (e.which == 13) {
            SaveUserSettings();
            Toggle(r);
            return false;   
        }
        return true;
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
        //Got over it.
        SaveUserSettings();
        background.FetchHabiticaData();
        location.reload();

    });
}

function CreateDelegate(onclick, param1) {
    return function () { onclick(param1); }
}

function NewTab(url) {
    return function () { chrome.tabs.create({ url: url }); }
}

function UpdateBlockCommand() {
    var currentSite = Vars.UserData.GetBlockedSite(CurrentTabHostname);

    if (currentSite) {
        $("#BlockLink").text("Un-Block Site!");
    } else {
        $("#BlockLink").text("Block Site!");
    }
}

function SaveUserSettings() {
    var dataPack = {}
    dataPack[Consts.userDataKey] = Vars.UserData;
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
    var siterow = $(document.getElementById(site.hostname));
    siterow.fadeOut({ complete: function() {siterow.remove()} });
    Vars.UserData.RemoveBlockedSite(site.hostname);
    SaveUserSettings();
    getCurrentTabUrl(function (url) {
        UpdateBlockCommand(url);
    });
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
