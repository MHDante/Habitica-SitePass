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
    $("#Dosh").append(Vars.Monies.toFixed(1));
    $("#MyHp").append(Vars.Hp.toFixed(0));

    //Start Pomodoro Timer
    $("#PomoButton").click(function () {
        var seconds = 60 * Vars.UserData.PomoDurationMins;
        if(!Vars.TimerRunnig){
            background.startPomodoro(seconds);
        }else{
            background.stopTimer();
            background.pomodoroInterupted();   
        }
    });
    //Update Timer display
    updateTimerDisplay();
    setInterval(function () {
        updateTimerDisplay();
    }, 1000);
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
                    '<span class="gold_icon"></span><br>' + cost +
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
                    .html('<span class="gold_icon"></span><br>' + $(this).data("site").cost);
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
    $("#PomoDuration").val(Vars.UserData.PomoDurationMins);
    $("#PomoHabitPlus").prop('checked', Vars.UserData.PomoHabitPlus);
    $("#PomoHabitMinus").prop('checked', Vars.UserData.PomoHabitMinus);
    $("#PomoProtectedStop").prop('checked', Vars.UserData.PomoProtectedStop);
    
    //Update Pomodoros Today
    today = new Date().setHours(0,0,0,0);
    if(Vars.PomodorosToday.date!= today){
        Vars.PomodorosToday.value=0;
        Vars.PomodorosToday.date = today;
    } 
    $("#PomoButton").attr("data-pomodoros",Vars.PomodorosToday.value);

    $("#UID").on("keyup", function () { updateCredentials(); });
    $("#APIToken").on("keyup", function () { updateCredentials(); });
    $("#Duration").on("keyup", function () { updateCredentials(); });
    $("#PomoDuration").on("keyup", function () { updateCredentials(); });
    $("#PomoHabitPlus").click(function () { updateCredentials(); });
    $("#PomoHabitMinus").click(function () { updateCredentials(); });
    $("#PomoProtectedStop").click(function () { updateCredentials(); });
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
    var pmDuration = parseFloat($("#PomoDuration").val());
    if (!isNaN(pmDuration)) Vars.UserData.PomoDurationMins = pmDuration;
    Vars.UserData.PomoHabitPlus = $("#PomoHabitPlus").prop('checked');
    Vars.UserData.PomoHabitMinus = $("#PomoHabitMinus").prop('checked');
    Vars.UserData.PomoProtectedStop = $("#PomoProtectedStop").prop('checked');
}

function updateTimerDisplay(){
    $('#Time').html(Vars.Timer);
    var time = Vars.Timer.split(':');
    var seconds = parseInt(time[0])*60+parseInt(time[1]);
    var duration = Vars.UserData.PomoDurationMins*60;

    if(Vars.TimerRunnig){ //Pomodoro running
        $('#pomodoro').css("background-color", "green"); 
        $('#pomodoro').css("color", "lightgreen");
        if(duration-seconds <= Consts.ProtectedStopDuration && Vars.UserData.PomoProtectedStop){
            tomatoSetClass("tomatoProgressStart");
        }else{
            tomatoSetClass("tomatoProgress");
        }
        $("#SiteTable tbody").toggleClass('blocked',true);
    }else{ //pomodoro not running
        $('#pomodoro').css("background-color", "#2995CD")
        $('#pomodoro').css("color", "#36205D");
        tomatoSetClass("tomatoWait"); 
        $("#SiteTable tbody").toggleClass('blocked',false);
        $("#PomoButton").attr("data-pomodoros",Vars.PomodorosToday.value);
    }
}

var TOMATO_CLASSES = ["tomatoProgress","tomatoProgressStart","tomatoWait"];
function tomatoSetClass(className){
    TOMATO_CLASSES.forEach(function(entry) {
        $('.tomato').toggleClass(entry, false);
    });
    $('.tomato').toggleClass(className, true);
}

