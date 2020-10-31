Node.prototype.AppendText = function (string) { this.appendChild(document.createTextNode(string)); }
Node.prototype.AppendBreak = function () { this.appendChild(document.createElement("br")); }

var background = chrome.extension.getBackgroundPage();
var Vars = background.Vars;
var Consts = background.Consts;
var CurrentTabHostname;
var updatedHabitica = false;
var HistoryChart;
var HistoryFromDay = 0;
var HistoryToDay = 7;
var HistoryPomodoroSelected = true;

//----- on popup load -----//
document.addEventListener("DOMContentLoaded", function () {

    background.FetchHabiticaData(true); //Fetch Habitica basic data when opening the popup

    //Custome pomodoro habits
    $("#customPomodoroTask").empty();
    $("#customSetTask").empty();
    for (var i in Vars.PomodoroTaskCustomList) {
        var title = Vars.PomodoroTaskCustomList[i].title;
        var taskId = Vars.PomodoroTaskCustomList[i].id;
        var option = document.createElement("option");
        option.value = taskId;
        option.innerHTML = title;
        $("#customPomodoroTask").append(option);
        $("#customSetTask").append(option.cloneNode(true));
    }

    //Sounds list
    for (var i in Consts.Sounds) {
        var FileName = Consts.Sounds[i];
        var option = document.createElement("option");
        option.value = FileName;
        option.innerHTML = FileName.split(".")[0];
        $("#pomodoroEndSound").append(option);
        $("#breakEndSound").append(option.cloneNode(true));
    }
    for (var i in Consts.AmbientSounds) {
        var FileName = Consts.AmbientSounds[i];
        var option = document.createElement("option");
        option.value = FileName;
        option.innerHTML = FileName.split(".")[0];
        $("#ambientSound").append(option);
    }

    //update settings
    CredentialFields();

    //On version update or install show info
    if (Vars.versionUpdate) {
        $("#VersionUpdate").show();
        $("#VersionUpdate .version").html("version " + chrome.runtime.getManifest().version);
    }
    $("#VersionUpdate .closeAlert").click(function () {
        $("#VersionUpdate").hide();
        Vars.versionUpdate = false;
    });

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

    $("#Dosh").append(Vars.Monies.toFixed(1));
    $("#MyHp").append(Vars.Hp.toFixed(0));

    //Update Timer display - Main Interval
    updateTimerDisplay();
    setInterval(function () {
        updateTimerDisplay();
        updateSiteExpireDisplay();
    }, 1000);

    //Credentials Error tip
    $(".credErrorTip").click(function () { credErrorTipAnimation() });

    //Pomodoro Button actions
    $("#PomoButton").click(function () {
        if (Vars.onBreak && !Vars.TimerRunnig) {
            background.startBreak();
        }
        else if (!Vars.TimerRunnig || Vars.onBreak || Vars.onBreakExtension) {
            if (Vars.PomoSetCounter == Vars.UserData.PomoSetNum) { //Set complete
                background.pomoReset();
            } else {//next pomodoro
                background.startPomodoro();
            }
        } else {
            background.pomodoroInterupted(true);
        }
    });

    //Menu
    $(".menu-item").change(function () {
        var selected = $(this).find("input");
        var menu_container = $(this).attr("menu-container-id");
        $(".menu-item label input").not(selected).attr("checked", false);
        $(".menu-container").hide();
        $(".menu-item").removeClass("selected");
        $("#SaveButton").hide();
        if ($(selected).is(':checked')) {
            $("#" + menu_container).fadeIn();
            $("#SaveButton").slideDown();
            $(this).addClass("selected");
        }
        if (menu_container == "Settings") {
            $("#SaveButton").html("<span>&#9998;&nbsp;</span>SAVE &nbsp;&nbsp;");
        } else {
            $("#SaveButton").html("CLOSE");
        }
    });

    //Pomodoro Quick Settings
    $("#QuickSettings").click(function () {
        $("#pomodoroSettings").show();
        $("#pomodoro").hide();
        $("#quickSet-PomoDuration").val(Vars.UserData.PomoDurationMins);
        $("#quickSet-BreakDuration").val(Vars.UserData.BreakDuration);
        $("#quickSet-LongBreakDuration").val(Vars.UserData.LongBreakDuration);
        $("#quickSet-PomoSetNum").val(Vars.UserData.PomoSetNum);
    });

    $("#quickSave").click(function () { //Quick setting save (ok button)
        $("#pomodoroSettings").hide();
        $("#pomodoro").show();
        $("#PomoDuration").val($("#quickSet-PomoDuration").val());
        $("#BreakDuration").val($("#quickSet-BreakDuration").val());
        $("#LongBreakDuration").val($("#quickSet-LongBreakDuration").val());
        $("#PomoSetNum").val($("#quickSet-PomoSetNum").val());
        updateCredentials();
    });

    //Take manual break in quick settings
    $("#quickSet-takeBreak").click(function () {
        background.takeBreak($("#quickSet-takeBreakDuration").val());
        $("#pomodoroSettings").hide();
        $("#pomodoro").show();
    });

    //Pomodoro X button (stop pomodoro during break)
    $("#PomoStop").click(function () {
        background.pomoReset();
    });

    //Pomodoro >> skip to break button
    $("#SkipToBreak").click(function () {
        background.skipToBreak();
    });


    //Refresh stats button
    $("#RefreshStats").click(function () {
        background.FetchHabiticaData();
        location.reload();
    });

    //Free pass schedule
    $("#addFreePassBlock").click(() => addFreePassTimeBlock(background.getWeekDay(), "00:00", "00:00"));

    //Vacation Mode Banner
    if (Vars.UserData.VacationMode || background.isFreePassTimeNow()) {
        $(".vacationBanner").show();
    }
    $("#VacationMode").click(function () {
        if (Vars.UserData.VacationMode) {
            $(".vacationBanner").show();
        } else {
            $(".vacationBanner").hide();
        }
    });

    //Hide Edit Options
    if (Vars.UserData.HideEdit) {
        $("#BlockLink").hide();
        $(".edit").hide();
        $(".delete").hide();
    }

    if (!Vars.UserData.ConnectHabitica) {
        $(".habitica-setting").fadeTo("slow", 0.3);
        $(".buy").hide();
        $(".edit").hide();
        $("#Footer").hide();
        $("#CredError").hide();
    }

    $("#ConnectHabitica").click(function () {
        if ($("#ConnectHabitica").is(':checked')) {
            $(".habitica-setting").fadeTo("slow", 1);
            $(".buy").show();
            $(".edit").show();
            $("#Footer").slideDown();
        } else {
            $(".habitica-setting").fadeTo("slow", 0.3);
            $(".buy").hide();
            $(".edit").hide();
            $("#Footer").slideUp();
        }
    });

    // Save Button
    $("#SaveButton").click(function () {
        updateCredentials();
        //Got over it.
        SaveUserSettings();
        if (updatedHabitica) {
            background.FetchHabiticaData();
        }
        location.reload();
    });

    //Habitica setting changed - longer save (full data fetch)
    $(".habitica-setting, .habitica-setting input,.habitica-setting select ").click(function () { updatedHabitica = true; });

    //Sounds
    $('#breakEndSound').on('change', function () {
        background.playSound(this.value, Vars.UserData.breakEndSoundVolume), false;
    });
    $('#pomodoroEndSound').on('change', function () {
        background.playSound(this.value, Vars.UserData.pomodoroEndSoundVolume, false);
    });
    $('#ambientSound').on('change', function () {
        playAmbientSample();
    });
    $('#pomodoroEndSoundVolume').mouseup(function () {
        background.playSound(Vars.UserData.pomodoroEndSound, Vars.UserData.pomodoroEndSoundVolume, false);
    });
    $('#breakEndSoundVolume').mouseup(function () {
        background.playSound(Vars.UserData.breakEndSound, Vars.UserData.breakEndSoundVolume, false);
    });
    $('#ambientSoundVolume').mouseup(function () {
        playAmbientSample();
    });

    //History Update
    const Canvas = document.getElementById('myChart').getContext('2d');
    HistoryChart = new Chart(Canvas, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: "",
                data: [],
                backgroundColor:"#87819091"
            }]
        },
        options: {
            scales: {
                yAxes: [{
                    ticks: {
                        beginAtZero: true
                    }
                }]
            }
        }
    });
    $("#MenuHistory").click(function () {
        updateHistory(); 
    });


});


//----- Functions -----//

function AddSiteToTable(site, fadein) {
    var table = $("#SiteTable");
    var cost = site.cost;
    if (cost % 1 != 0) cost = cost.toFixed(2);

    var passExpiryElement = "";
    if (site.passExpiry) {
        if (site.passExpiry > Date.now()) {

            //Remaining time in minutes
            var remainingTime = background.getSitePassRemainingTime(site)
            passExpiryElement = '<br><span class="passExp" data-hostname=' + site.hostname + '>' + remainingTime + '</span>';
        }
    }

    var tbody = $(document.createElement("tbody"));
    tbody.attr("id", site.hostname);

    //Single Blocked wensite UI
    var html =
        '<tr class="reward-item">' +
        '<td class="gp">' +
        '<a class="buy" href="#">' +
        '<span class="gold_icon"></span><br>' + cost +
        '</a></td>' +
        '<td><div class="hostname">' + site.hostname + passExpiryElement + '</div></td>' +
        '<td><a class="edit" href="#"><img src="img/pencil.png"></a></td>' +
        '<td><a class="delete" href="#"><img src="img/trash.png"></a></td>' +
        '</tr>' +
        '<tr class="cost-input" style="display:none;">' +
        '<td style="white-space:nowrap;text-align:center;" colspan="4">' +
        '<label>Cost ' +
        '<input class="cost" type="text"maxlength="8" size="8" value="' + site.cost + '">' +
        '</label></td></tr>' +
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
    if (!Vars.UserData.ConnectHabitica) {
        $(".buy").hide();
        $(".edit").hide();
        $(".cost-input").hide();
    }
}

function Toggle(obj) {
    if ($(obj).is(":visible")) {
        obj.fadeOut({
            complete: function () {
                $("tbody").each(function () {
                    $(this).find(".buy")
                        .html('<span class="gold_icon"></span><br>' + $(this).data("site").cost);
                });
            }
        });
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

    if (Vars.ServerResponse == 401 && Vars.UserData.ConnectHabitica) {
        $("#CredError").slideDown();
    }

    //Come on, Google!

    //Set Options according to UserData in background.js
    $("#UID").val(Vars.UserData.Credentials.uid);
    $("#APIToken").val(Vars.UserData.Credentials.apiToken);
    $("#Duration").val(Vars.UserData.PassDurationMins);
    $("#PomoDuration").val(Vars.UserData.PomoDurationMins);
    $("#BreakDuration").val(Vars.UserData.BreakDuration);
    $("#BreakExtention").val(Vars.UserData.BreakExtention);
    $("#LongBreakDuration").val(Vars.UserData.LongBreakDuration);
    $("#Whitelist").val(Vars.UserData.Whitelist);
    $("#PomoHabitPlus").prop('checked', Vars.UserData.PomoHabitPlus);
    $("#PomoHabitMinus").prop('checked', Vars.UserData.PomoHabitMinus);
    $("#ManualBreak").prop('checked', Vars.UserData.ManualBreak);
    $("#BreakFreePass").prop('checked', Vars.UserData.BreakFreePass);
    $("#BreakExtentionFails").prop('checked', Vars.UserData.BreakExtentionFails);
    $("#BreakExtentionNotify").prop('checked', Vars.UserData.BreakExtentionNotify);
    $("#HideEdit").prop('checked', Vars.UserData.HideEdit);
    $("#PomoSetNum").val(Vars.UserData.PomoSetNum);
    $("#PomoSetHabitPlus").prop('checked', Vars.UserData.PomoSetHabitPlus);
    $("#LongBreakNotify").prop('checked', Vars.UserData.LongBreakNotify);
    $("#VacationMode").prop('checked', Vars.UserData.VacationMode);
    $("#customPomodoroTaskEnabled").prop('checked', Vars.UserData.CustomPomodoroTask);
    $("#customSetTaskEnabled").prop('checked', Vars.UserData.CustomSetTask);
    $("#customPomodoroTask").val(Vars.UserData.PomodoroTaskId);
    $("#customSetTask").val(Vars.UserData.PomodoroSetTaskId);
    $("#ConnectHabitica").prop('checked', Vars.UserData.ConnectHabitica);
    $("#MuteBlockedSites").prop('checked', Vars.UserData.MuteBlockedSites);
    $("#TranspartOverlay").prop('checked', Vars.UserData.TranspartOverlay);
    $("#TickSound").prop('checked', Vars.UserData.TickSound);
    $("#showSkipToBreak").prop('checked', Vars.UserData.showSkipToBreak);
    $("#pomodoroEndSound").val(Vars.UserData.pomodoroEndSound);
    $("#breakEndSound").val(Vars.UserData.breakEndSound);
    $("#ambientSound").val(Vars.UserData.ambientSound);
    $("#pomodoroEndSoundVolume").val(Vars.UserData.pomodoroEndSoundVolume);
    $("#breakEndSoundVolume").val(Vars.UserData.breakEndSoundVolume);
    $("#ambientSoundVolume").val(Vars.UserData.ambientSoundVolume);
    $("#ManualNextPomodoro").prop('checked', Vars.UserData.ManualNextPomodoro);

    createFreePassTimeBlocks(Vars.UserData.FreePassTimes);

    //Update Pomodoros Today, reset on new day
    // today = new Date().setHours(0, 0, 0, 0);
    // if (Vars.PomodorosToday.date != today) {
    //     Vars.PomodorosToday.value = 0;
    //     Vars.PomodorosToday.date = today;
    // }

    // $("#PomoButton").attr("data-pomodoros", Vars.PomodorosToday.value);
    // $("#PomoToday").html(Vars.PomodorosToday.value);

    var dataToday = Vars.Histogram[background.getDate()];
    if (!dataToday) {
        background.setTodaysHistogram(0, 0);
        dataToday = Vars.Histogram[background.getDate()];
    }
    $("#PomoButton").attr("data-pomodoros", dataToday.pomodoros);

    //Update Options on change
    $("#UID").on("keyup", function () { updateCredentials(); });
    $("#APIToken").on("keyup", function () { updateCredentials(); });
    $("#Duration").on("keyup", function () { updateCredentials(); });
    $("#PomoDuration").on("keyup", function () { updateCredentials(); });
    $("#BreakDuration").on("keyup", function () { updateCredentials(); });
    $("#BreakExtention").on("keyup", function () { updateCredentials(); });
    $("#LongBreakDuration").on("keyup", function () { updateCredentials(); });
    $("#Whitelist").on("keyup", function () { updateCredentials(); });
    $("#PomoHabitPlus").click(function () { updateCredentials(); });
    $("#PomoHabitMinus").click(function () { updateCredentials(); });
    $("#ManualBreak").click(function () { updateCredentials(); });
    $("#BreakFreePass").click(function () { updateCredentials(); });
    $("#BreakExtentionFails").click(function () { updateCredentials(); });
    $("#BreakExtentionNotify").click(function () { updateCredentials(); });
    $("#HideEdit").click(function () { updateCredentials(); });
    $("#PomoSetNum").bind('keyup input change', function () { updateCredentials(); });
    $("#PomoSetHabitPlus").click(function () { updateCredentials(); });
    $("#LongBreakNotify").click(function () { updateCredentials(); });
    $("#VacationMode").click(function () { updateCredentials(); });
    $(".freePassBlock select").change(function () { updateCredentials(); });
    $(".freePassBlock input").change(function () { updateCredentials(); });
    $("#customPomodoroTask").click(function () { updateCredentials(); });
    $("#customSetTask").click(function () { updateCredentials(); });
    $("#customPomodoroTaskEnabled").click(function () { updateCredentials(); });
    $("#customSetTaskEnabled").click(function () { updateCredentials(); });
    $("#ConnectHabitica").click(function () { updateCredentials(); });
    $("#MuteBlockedSites").click(function () { updateCredentials(); });
    $("#TranspartOverlay").click(function () { updateCredentials(); });
    $("#TickSound").click(function () { updateCredentials(); });
    $("#showSkipToBreak").click(function () { updateCredentials(); });
    $("#pomodoroEndSound").click(function () { updateCredentials(); });
    $("#breakEndSound").click(function () { updateCredentials(); });
    $("#ambientSound").click(function () { updateCredentials(); });
    $("#pomodoroEndSoundVolume").mouseup(function () { updateCredentials(); });
    $("#breakEndSoundVolume").mouseup(function () { updateCredentials(); });
    $("#ambientSoundVolume").mouseup(function () { updateCredentials(); });
    $("#ManualNextPomodoro").click(function () { updateCredentials(); });
    //ugh.
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
        $("#BlockLink").html("<div class='unBlockSite'><span class='unblock_Icon small_icon'></span>Un-Block Site</div>");
    } else {
        $("#BlockLink").html("<div class='blockSite'><span class='block_Icon small_icon'></span>Block Site!</div>");
    }
    updateTimerDisplay();
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
    siterow.fadeOut({ complete: function () { siterow.remove() } });
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

    Vars.UserData.Credentials.uid = $("#UID").val();
    Vars.UserData.Credentials.apiToken = $("#APIToken").val();

    //TODO better code...
    var flDuration = parseFloat($("#Duration").val());
    if (!isNaN(flDuration)) Vars.UserData.PassDurationMins = flDuration;
    var pmDuration = parseFloat($("#PomoDuration").val());
    if (!isNaN(pmDuration)) Vars.UserData.PomoDurationMins = pmDuration;
    var brDuration = parseFloat($("#BreakDuration").val());
    if (!isNaN(brDuration)) Vars.UserData.BreakDuration = brDuration;
    var exDuration = parseFloat($("#BreakExtention").val());
    if (!isNaN(exDuration)) Vars.UserData.BreakExtention = exDuration;
    var pomoNum = parseFloat($("#PomoSetNum").val());
    if (!isNaN(pomoNum)) Vars.UserData.PomoSetNum = pomoNum;
    var longBr = parseFloat($("#LongBreakDuration").val());
    if (!isNaN(longBr)) Vars.UserData.LongBreakDuration = longBr;

    Vars.UserData.PomoHabitPlus = $("#PomoHabitPlus").prop('checked');
    Vars.UserData.PomoHabitMinus = $("#PomoHabitMinus").prop('checked');
    Vars.UserData.ManualBreak = $("#ManualBreak").prop('checked');
    Vars.UserData.BreakFreePass = $("#BreakFreePass").prop('checked');
    Vars.UserData.BreakExtentionFails = $("#BreakExtentionFails").prop('checked');
    Vars.UserData.BreakExtentionNotify = $("#BreakExtentionNotify").prop('checked');
    Vars.UserData.PomoSetHabitPlus = $("#PomoSetHabitPlus").prop('checked');
    Vars.UserData.LongBreakNotify = $("#LongBreakNotify").prop('checked');
    Vars.UserData.VacationMode = $("#VacationMode").prop('checked');
    Vars.UserData.CustomPomodoroTask = $("#customPomodoroTaskEnabled").prop('checked');
    Vars.UserData.CustomSetTask = $("#customSetTaskEnabled").prop('checked');
    Vars.UserData.HideEdit = $("#HideEdit").prop('checked');
    Vars.UserData.PomodoroSetTaskId = $("#customSetTask").val();
    Vars.UserData.PomodoroTaskId = $("#customPomodoroTask").val();
    Vars.UserData.ConnectHabitica = $("#ConnectHabitica").prop('checked');
    Vars.UserData.MuteBlockedSites = $("#MuteBlockedSites").prop('checked');
    Vars.UserData.TranspartOverlay = $("#TranspartOverlay").prop('checked');
    Vars.UserData.TickSound = $("#TickSound").prop('checked');
    Vars.UserData.showSkipToBreak = $("#showSkipToBreak").prop('checked');
    Vars.UserData.pomodoroEndSound = $("#pomodoroEndSound").val();
    Vars.UserData.breakEndSound = $("#breakEndSound").val();
    Vars.UserData.ambientSound = $("#ambientSound").val();
    Vars.UserData.pomodoroEndSoundVolume = $("#pomodoroEndSoundVolume").val();
    Vars.UserData.breakEndSoundVolume = $("#breakEndSoundVolume").val();
    Vars.UserData.ambientSoundVolume = $("#ambientSoundVolume").val();
    Vars.UserData.ManualNextPomodoro = $("#ManualNextPomodoro").prop('checked');
    Vars.UserData.Whitelist = $("#Whitelist").val();
    Vars.UserData.FreePassTimes = getFreePassTimes();
}

function updateTimerDisplay() {
    $('#Time').html(Vars.Timer);
    if (Vars.onManualTakeBreak) {
        $("#Time").attr("data-pomodoros-set", "");
    } else {
        $("#Time").attr("data-pomodoros-set", Vars.PomoSetCounter + "/" + Vars.UserData.PomoSetNum);
    }

    $("#PomoButton").attr("data-pomodoros", Vars.Histogram[background.getDate()].pomodoros);

    if (Vars.onBreakExtension) { //---On Break Extension---
        $("#QuickSettings").hide();
        $(".unBlockSite").show();
        $('#pomodoro').css("background-color", "red");
        $('#pomodoro').css("color", "coral");
        tomatoSetClass("tomatoWarning");
        if (!Vars.onManualTakeBreak) {
            $("#PomoStop").show();
        }
        $("#SkipToBreak").hide();
    }
    else if (Vars.onBreak) {
        $(".unBlockSite").show();
        $("#QuickSettings").hide();
        if (Vars.TimerRunnig) { //---On Break---
            $('#pomodoro').css("background-color", "cornflowerblue");
            $('#pomodoro').css("color", "aqua");
            tomatoSetClass("tomatoBreak");
        }
        else {//---Manual Break---
            $('#pomodoro').css("background-color", "green");
            $('#pomodoro').css("color", "lightgreen");
            tomatoSetClass("tomatoWin");
        }
        if (!Vars.onManualTakeBreak) {
            $("#PomoStop").fadeIn();
        } else {
            $("#PomoStop").hide();
        }
        $("#SkipToBreak").hide();
        $("#SiteTable tbody").toggleClass('blocked', false);
    }
    else if (Vars.TimerRunnig) { //---Pomodoro running---
        $(".unBlockSite").hide();
        $('#pomodoro').css("background-color", "green");
        $('#pomodoro').css("color", "lightgreen");
        tomatoSetClass("tomatoProgress");
        $("#SiteTable tbody").toggleClass('blocked', true);
        $("#PomoStop").hide();
        $("#QuickSettings").hide();

        if (Vars.UserData.showSkipToBreak) {
            $("#SkipToBreak").show();
        } else {
            $("#SkipToBreak").hide();
        }
    } else { //---pomodoro not running---
        $(".unBlockSite").show();
        $("#QuickSettings").show();
        $('#pomodoro').css("background-color", "#8ccff1")
        $('#pomodoro').css("color", "#553889");
        tomatoSetClass("tomatoWait");
        $("#SiteTable tbody").toggleClass('blocked', false);
        $("#PomoStop").hide();
        $("#SkipToBreak").hide();
    }
}

var TOMATO_CLASSES = ["tomatoProgress", "tomatoWait", "tomatoBreak", "tomatoWin", "tomatoWarning"];
function tomatoSetClass(className) {
    TOMATO_CLASSES.forEach(function (entry) {
        $('.tomato').toggleClass(entry, false);
    });
    $('.tomato').toggleClass(className, true);
}

function credErrorTipAnimation() {
    $("#MenuSettings label input").prop("checked", true).change();
    $("#MenuHabiticaSettings").prop("checked", true).change();
    $('.connect-habitica-animate').animate(
        {
            fontSize: "20px"
        }, 700);
    $('.connect-habitica-animate').animate(
        {
            fontSize: "14px"
        }, 700);
}

function updateSiteExpireDisplay() {
    $(".passExp").each(function () {
        var hostname = $(this).attr("data-hostname")
        var site = Vars.UserData.GetBlockedSite(hostname);
        var time = background.getSitePassRemainingTime(site);
        if (time) {
            $(this).html(time);
        } else {
            $(this).remove();
        }

    });
}

var ambientSampleTimeout;
function playAmbientSample() {
    clearTimeout(ambientSampleTimeout);
    background.stopAmbientSound();
    setTimeout(function () {
        background.playSound(Vars.UserData.ambientSound, Vars.UserData.ambientSoundVolume, true);
    }, 100);
    ambientSampleTimeout = setTimeout(function () { background.stopAmbientSound(); }, 3000);
}

function addFreePassTimeBlock(day, fromTime, toTime) {
    var block = $(`
    <div class="freePassBlock">
        <select name="weekday">
                <option value="Monday">Monday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
                <option value="Sunday">Sunday</option>
        </select>
        <input value="${fromTime}" name="fromTime" type="time"> -
        <input value="${toTime}" name="toTime" type="time">
        <span class="trash_icon small_icon"></span>
    </div>
     `)
    block.find('select[name="weekday"]').val(day);
    $("#freePassBlocks").append(block);
    block.hide().fadeIn(function () {
        updateCredentials();
    });

    block.find(".trash_icon").click(function () {
        $(this).closest('.freePassBlock').fadeOut(function () {
            $(this).remove();
            updateCredentials();
        });
    });
}

//data is array of {day:'weekday name',fromTime:'hh:mm',toTime:'hh:mm'} objects
function createFreePassTimeBlocks(data) {
    if (data) {
        for (let i = 0; i < data.length; i++) {
            addFreePassTimeBlock(data[i].day, data[i].fromTime, data[i].toTime);
        }
    }
}

//returns array of objects {day:'weekday name',fromTime:'hh:mm',toTime:'hh:mm'}
function getFreePassTimes() {
    var times = [];
    $("#freePassBlocks .freePassBlock").each(function () {
        var day = $(this).find("select[name='weekday']").val();
        var fromTime = $(this).find("input[name='fromTime']").val();
        var toTime = $(this).find("input[name='toTime']").val();
        times.push({
            day: day,
            fromTime: fromTime,
            toTime: toTime
        });
    });
    return times;
}

function sumOfArray(array){
    var total = 0;
    for (var i = 0; i < array.length; i++) {
        array[i] = Number(array[i]);
        total += array[i] << 0;
    }
    return total;
}

function updateHistory(){
    var dataToday = Vars.Histogram[background.getDate()];
        if (!dataToday) {
            background.setTodaysHistogram(0, 0);
            dataToday = Vars.Histogram[background.getDate()];
        }
        $("#PomoToday").html(dataToday.pomodoros);
        $("#MinutesToday").html(dataToday.minutes.toFixed(1));

        var totalPomodoros = 0;
        var totalMinutes = 0;
        var dataSize = 0;
        var chartData = { dates: [], pomodoros: [], minutes: [] };
        for (var key in Vars.Histogram) {
            dataSize++;
            if (Vars.Histogram.hasOwnProperty(key)) {
                var data = Vars.Histogram[key];
                totalPomodoros += Number(data.pomodoros);
                totalMinutes += Number(data.minutes);
                chartData.dates.push(key);
                chartData.pomodoros.push(data.pomodoros);
                chartData.minutes.push(data.minutes);
            }
        }
        $("#PomoTotal").html(totalPomodoros);
        $("#MinutesTotal").html(totalMinutes.toFixed(1));
        $("#PomoAvg").html((totalPomodoros / dataSize).toFixed(1));
        $("#MinutesAvg").html((totalMinutes / dataSize).toFixed(1));

        udateHistoryTable(HistoryChart,chartData.dates,chartData.pomodoros,"Pomodoros");

        $("#HistoryChartShowPomodoros").click(function(){
            udateHistoryTable(HistoryChart,chartData.dates,chartData.pomodoros,"Pomodoros");
            HistoryPomodoroSelected = true;
        });
        $("#HistoryChartShowMinutes").click(function(){
            udateHistoryTable(HistoryChart,chartData.dates,chartData.minutes,"Minutes");
            HistoryPomodoroSelected = false;
        });
        $("#DownloadHistogram").click(function(){
            //downloadObjectAsJson
            var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(Vars.Histogram));
            this.setAttribute("href",dataStr);
            this.setAttribute("download","Histogram.json");
        });

        $("#ImportHistogram").click(function(){
            //downloadObjectAsJson
            var files = document.getElementById('selectHistogramFile').files;
            console.log(files);
            if (files.length <= 0) {
              return false;
            }
            
            var fr = new FileReader();
            
            fr.onload = function(e) { 
            console.log(e);
              var result = JSON.parse(e.target.result);
              Vars.Histogram = result;
            }
            fr.readAsText(files.item(0));
            location.reload();
        });

        $("#ClearHistogram").click(function(){
            background.clearHistogram();
            location.reload();
        }); 
        
        $("#HistoryChartNext").click(function(){
            HistoryFromDay = HistoryFromDay + 7;
            HistoryToDay = HistoryToDay + 7;
            if(HistoryFromDay >= chartData.dates.length -7 ||  HistoryToDay >= chartData.dates.length ){
                HistoryFromDay = chartData.dates.length - 8;
                HistoryToDay = chartData.dates.length -1 ;
            }
            if(HistoryPomodoroSelected){
                udateHistoryTable(HistoryChart,chartData.dates,chartData.pomodoros,"Pomodoros");
            }else{
                udateHistoryTable(HistoryChart,chartData.dates,chartData.minutes,"Minutes");
            }
        });  
        $("#HistoryCharPrev").click(function(){
            HistoryFromDay = HistoryFromDay - 7;
            HistoryToDay = HistoryToDay - 7;
            if(HistoryFromDay <= 0 ||  HistoryToDay <=0 ){
                HistoryFromDay = 0;
                HistoryToDay = 7;
            }
            if(HistoryPomodoroSelected){
                udateHistoryTable(HistoryChart,chartData.dates,chartData.pomodoros,"Pomodoros");
            }else{
                udateHistoryTable(HistoryChart,chartData.dates,chartData.minutes,"Minutes");
            }
        });   

}

function udateHistoryTable (Chart,datesArary,dataArray,label){
    Chart.data.labels = datesArary.slice(HistoryFromDay, HistoryToDay);
    Chart.data.datasets[0].data = dataArray.slice(HistoryFromDay, HistoryToDay);
    Chart.data.datasets[0].label = label;
    $("#HistoryChartTotal").html(`Total ${label} in chart: ${sumOfArray(dataArray.slice(HistoryFromDay, HistoryToDay))}`);
    Chart.update();
}





