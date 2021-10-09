Node.prototype.AppendText = function (string) { this.appendChild(document.createTextNode(string)); }
Node.prototype.AppendBreak = function () { this.appendChild(document.createElement("br")); }

const BROWSER = getBrowser();
var browser = browser || chrome; //for firefox support (browser.runtime instead of chrome.runtime)
var Vars = {};
var Consts = {};
var CurrentTabHostname;
var updatedHabitica = false;
var HistoryChart;
var HistoryFromDay = 0;
var HistoryToDay = 7;
var HistoryPomodoroSelected = true;

// chrome.extension.getBackgroundPage() has issues in firefox 
//-------- background.js communication (with firefox support) -------//

var timerPort = chrome.runtime.connect({ name: "timer" });
timerPort.onMessage.addListener(function (response) {
    if (response.complete) {
        Vars = response.vars;
    }
});

/**
 * @param {*} functionName String
 * @param {*} args array with the function args
 */
async function runBackgroundFunction(functionName, args) {
    //FireFox
    if (BROWSER === "Mozilla Firefox") {
        var response = await browser.runtime.sendMessage({ sender: "popup", msg: "run_function", functionName: functionName, args: args });
        return response.result;
    }
    //Chromium
    else {
        try {
            var response = await sendMessagePromise({ sender: "popup", msg: "run_function", functionName: functionName, args: args });
            return response.result;
        }
        catch (e) {
            console.log(e)
            return e;
        }
    }
}

async function getBackgroundData() {
    //FireFox
    if (BROWSER === "Mozilla Firefox") {
        var response = await browser.runtime.sendMessage({ sender: "popup", msg: "get_data" });
        Vars = response.vars;
        Consts = response.consts;

    }
    //Chromium
    else {
        try {
            var response = await sendMessagePromise({ sender: "popup", msg: "get_data" });
            Vars = response.vars;
            Consts = response.consts;
        } catch (e) {
            console.log(e)
            return e;
        }
    }
}

async function updateBackgroundData() {
    //FireFox
    if (BROWSER === "Mozilla Firefox") {
        await browser.runtime.sendMessage({ sender: "popup", msg: "set_data", data: { vars: Vars } });
    }
    //Chromium
    else {
        try {
            await sendMessagePromise({ sender: "popup", msg: "set_data", data: { vars: Vars } });
        } catch (e) {
            console.log(e)
            return e;
        }
    }
}

/**
 * Promise wrapper for chrome.tabs.sendMessage (not returning promise bug in chrome)
 * @param item
 * @returns {Promise<any>}
 */
function sendMessagePromise(item) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(item, (response) => {
            console.log(item);
            console.log(response);
            if (response.complete) {
                resolve(response);
            } else {
                reject('Something wrong');
            }
        });
    });
}


//-------- background.js communication [END]-------------------------------


//----- on popup load -----//
document.addEventListener("DOMContentLoaded", async function () {
    await runBackgroundFunction("FetchHabiticaData", [true]);
    await getBackgroundData();
    console.log("Vars", Vars);
    onPopupPageLoad();
});

function onPopupPageLoad() {

    //Link to app store by browser in feedback section
    setBrowserReviewLink();

    //Custome pomodoro habits
    $("#customPomodoroTask").empty();
    $("#customSetTask").empty();
    for (var i in Vars.PomodoroTaskCustomList) {
        const title = Vars.PomodoroTaskCustomList[i].title;
        const taskId = Vars.PomodoroTaskCustomList[i].id;
        const option = document.createElement("option");
        option.value = taskId;
        option.innerHTML = title;
        $("#customPomodoroTask").append(option);
        $("#customSetTask").append(option.cloneNode(true));
    }

    //Sounds list
    for (var i in Consts.Sounds) {
        const FileName = Consts.Sounds[i];
        const option = document.createElement("option");
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
        $('#welcomeInfo').hide();
        var currentSite = Vars.UserData.BlockedSites[CurrentTabHostname];
        if (currentSite) {
            removeSite(currentSite);
        }
        else {
            currentSite = { hostname: CurrentTabHostname, cost: 0, passExpiry: Date.now() }
            Vars.UserData.BlockedSites[CurrentTabHostname] = currentSite;
            AddSiteToTable(currentSite, true);
            SaveUserSettings();
            UpdateBlockCommand();
        }
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
    }, 250);

    //Credentials Error tip
    $(".credErrorTip").click(function () { credErrorTipAnimation() });

    //Pomodoro Button actions
    $("#PomoButton").click(function () {
        runBackgroundFunction("ActivatePomodoro");
    });

    //Menu
    $(".menu-item").change(function () {
        window.scrollTo(0, 0);
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
        var duration = $("#quickSet-takeBreakDuration").val();
        runBackgroundFunction("takeBreak", [duration]);
        $("#pomodoroSettings").hide();
        $("#pomodoro").show();
    });

    //Pomodoro X button (stop pomodoro during break)
    $("#PomoStop").click(function () {
        runBackgroundFunction("pomoReset");
    });

    //Pomodoro >> skip to break button
    $("#SkipToBreak").click(function () {
        runBackgroundFunction("skipToBreak");
    });


    //Refresh stats button
    $("#RefreshStats").click(function () {
        runBackgroundFunction("FetchHabiticaData", []).then(location.reload());
    });

    //Free pass schedule
    $("#addFreePassBlock").click(() => addFreePassTimeBlock(getWeekDay(), "00:00", "00:00"));

    //Vacation Mode Banner
    runBackgroundFunction("isFreePassTimeNow", []).then((response) => {
        if (Vars.UserData.VacationMode || response == true) {
            $(".vacationBanner").show();
        }
    });

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

    //block table message
    var tbl = $('#SiteTable');
    if ($('#SiteTable tr').length == 0) {
        tbl.append(`<p id="welcomeInfo">Navigate to the sites you want to block during Pomodoro and click on 'Block Site'.<br><br> If Habitia is connected, choose a cost for visiting the site (cost 0 is blocked only during Pomodoro).</p>`);
    }

    // Save Button
    $("#SaveButton").click(function () {
        updateCredentials();
        //Got over it.
        SaveUserSettings();
        if (updatedHabitica) {
            runBackgroundFunction("FetchHabiticaData", []).then(location.reload());
        }
        location.reload();
    });

    //Habitica setting changed - longer save (full data fetch)
    $(".habitica-setting, .habitica-setting input,.habitica-setting select ").click(function () { updatedHabitica = true; });

    //Sounds
    $('#breakEndSound').on('change', function () {
        runBackgroundFunction("playSound", [this.value, Vars.UserData.breakEndSoundVolume, false]);
    });

    $('#pomodoroEndSound').on('change', function () {
        runBackgroundFunction("playSound", [this.value, Vars.UserData.pomodoroEndSoundVolume, false]);
    });

    $('#ambientSound').on('change', function () {
        runBackgroundFunction("playAmbientSample");
    });

    $('#pomodoroEndSoundVolume').mouseup(function () {
        runBackgroundFunction("playSound", [Vars.UserData.pomodoroEndSound, Vars.UserData.pomodoroEndSoundVolume, false]);
    });

    $('#breakEndSoundVolume').mouseup(function () {
        runBackgroundFunction("playSound", [Vars.UserData.breakEndSound, Vars.UserData.breakEndSoundVolume, false]);
    });

    $('#ambientSoundVolume').mouseup(function () {
        runBackgroundFunction("playAmbientSample");
    });

    //History Update
    const Canvas = document.getElementById('HistoryChart').getContext('2d');
    HistoryChart = new Chart(Canvas, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: "",
                data: [],
                backgroundColor: "#87819091"
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

    $('body').removeClass("loading");
}

//----- Functions -----//

function AddSiteToTable(site, fadein) {
    var table = $("#SiteTable");
    var cost = site.cost;
    if (cost % 1 != 0) cost = cost.toFixed(2);

    var passExpiryElement = "";
    if (site.passExpiry) {
        if (site.passExpiry > Date.now()) {

            //Remaining time in minutes
            var remainingTime = getSitePassRemainingTime(site)
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
        '<td><a class="edit"><img src="img/pencil.png"></a></td>' +
        '<td><a class="delete"><img src="img/trash.png"></a></td>' +
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

    var dataToday = Vars.Histogram[getDate()];
    if (!dataToday) {
        // background.setTodaysHistogram(0, 0);
        runBackgroundFunction("setTodaysHistogram", [0, 0]).then(
            getBackgroundData().then(() => {
                dataToday = Vars.Histogram[getDate()];
                $("#PomoButton").attr("data-pomodoros", dataToday.pomodoros);
            })
        );
    } else {
        $("#PomoButton").attr("data-pomodoros", dataToday.pomodoros);
    }

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
    updateBackgroundData();
}

function CreateDelegate(onclick, param1) {
    return function () { onclick(param1); }
}

function NewTab(url) {
    return function () { chrome.tabs.create({ url: url }); }
}

function UpdateBlockCommand() {
    getBackgroundData().then(() => {
        var currentSite = Vars.UserData.BlockedSites[CurrentTabHostname];
        if (currentSite) {
            $("#BlockLink").html("<div class='unBlockSite'><span class='unblock_Icon small_icon'></span>Un-Block Site</div>");
        } else {
            $("#BlockLink").html("<div class='blockSite'><span class='block_Icon small_icon'></span>Block Site!</div>");
        }
        updateTimerDisplay();
    });
}

function SaveUserSettings() {
    var dataPack = {}
    dataPack[Consts.userDataKey] = Vars.UserData;
    // ReSharper disable once PossiblyUnassignedProperty
    chrome.storage.sync.set(dataPack, function () { });
    updateBackgroundData();
}

function updateSiteCost(siteAndCost) {
    var hostname = siteAndCost.site.hostname;
    var selection = parseFloat(siteAndCost.cost.val());
    if (!isNaN(selection) && selection >= 0 && Vars.UserData.BlockedSites[hostname]) {
        Vars.UserData.BlockedSites[hostname].cost = selection;
        siteAndCost.site.cost = selection;
    }
    updateBackgroundData();
}

function removeSite(site) {
    var siterow = $(document.getElementById(site.hostname));
    siterow.fadeOut({ complete: function () { siterow.remove() } });
    runBackgroundFunction("RemoveBlockedSite", [site]).then(() => {
        UpdateBlockCommand();
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

    updateBackgroundData();
}

function updateTimerDisplay() {
    timerPort.postMessage("sync");
    $('#Time').html(Vars.Timer);
    if (Vars.onManualTakeBreak) {
        $("#Time").attr("data-pomodoros-set", "--/--");
    } else {
        $("#Time").attr("data-pomodoros-set", Vars.PomoSetCounter + "/" + Vars.UserData.PomoSetNum);
    }

    $("#PomoButton").attr("data-pomodoros", Vars.Histogram[getDate()].pomodoros || 0);

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
        var site = Vars.UserData.BlockedSites[hostname];
        var time = getSitePassRemainingTime(site);
        if (time) {
            $(this).html(time);
        } else {
            $(this).remove();
        }

    });
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
    for (var i in data) {
        addFreePassTimeBlock(data[i].day, data[i].fromTime, data[i].toTime);
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

function sumOfArray(array) {
    var total = 0;
    for (var i = 0; i < array.length; i++) {
        array[i] = Number(array[i]);
        total += array[i] << 0;
    }
    return total;
}

function updateHistory() {

    var dataToday = Vars.Histogram[getDate()];
    if (!dataToday) {
        runBackgroundFunction("setTodaysHistogram", [0, 0]).then(
            getBackgroundData().then(() => {
                updateHistoryHTML();
            })
        );
    } else {
        updateHistoryHTML();
    }

    function updateHistoryHTML() {
        dataToday = Vars.Histogram[getDate()];
        $("#PomoToday").html(dataToday.pomodoros);
        var hrs = dataToday.minutes <= 0 ? 0 : (dataToday.minutes / 60).toFixed(1);
        $("#HoursToday").html(hrs);

        var totalPomodoros = 0;
        var totalHours = 0;
        var dataSize = 0;
        var chartData = { dates: [], pomodoros: [], hours: [], weekdays: [] };

        //collect data from histogram
        for (var key in Vars.Histogram) {
            dataSize++;
            if (Vars.Histogram.hasOwnProperty(key)) {
                var data = Vars.Histogram[key];
                var hrs = data.minutes <= 0 ? 0 : (data.minutes / 60).toFixed(1);
                totalPomodoros += Number(data.pomodoros);
                totalHours += Number(hrs);
                chartData.dates.push(`${key} (${data.weekday.slice(0, 2)})`);
                chartData.weekdays.push(data.weekday)
                chartData.pomodoros.push(data.pomodoros);
                chartData.hours.push(hrs);
            }
        }


        $("#PomoTotal").html(totalPomodoros);
        $("#HoursTotal").html(totalHours.toFixed(1));
        $("#PomoAvg").html((totalPomodoros / dataSize).toFixed(1));
        $("#HoursAvg").html((totalHours / dataSize).toFixed(1));

        HistoryFromDay = chartData.dates.length - 7 > 0 ? chartData.dates.length - 7 : 0;
        HistoryToDay = chartData.dates.length;
        udateHistoryTable(HistoryChart, chartData.dates, chartData.pomodoros, chartData.weekdays, "Pomodoros");

        $("#HistoryChartShowPomodoros").click(function () {
            udateHistoryTable(HistoryChart, chartData.dates, chartData.pomodoros, chartData.weekdays, "Pomodoros");
            HistoryPomodoroSelected = true;
        });
        $("#HistoryChartShowHours").click(function () {
            udateHistoryTable(HistoryChart, chartData.dates, chartData.hours, chartData.weekdays, "Hours");
            HistoryPomodoroSelected = false;
        });
        $("#DownloadHistogram").click(function () {
            //downloadObjectAsJson
            var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(Vars.Histogram));
            this.setAttribute("href", dataStr);
            this.setAttribute("download", "Histogram.json");
        });

        $("#ImportHistogram").click(function () {
            //downloadObjectAsJson
            var files = document.getElementById('selectHistogramFile').files;
            console.log(files);
            if (files.length <= 0) {
                return false;
            }

            var fr = new FileReader();

            fr.onload = function (e) {
                console.log(e);
                var result = JSON.parse(e.target.result);
                Vars.Histogram = result;
            }
            fr.readAsText(files.item(0));
            location.reload();
        });

        $("#ClearHistogram").click(function () {
            runBackgroundFunction("clearHistogram", []).then(location.reload());
        });

        $("#HistoryChartNext").click(function () {
            HistoryFromDay = HistoryFromDay + 7 > chartData.dates.length - 7 ? chartData.dates.length - 7 : HistoryFromDay + 7;
            HistoryToDay = HistoryToDay + 7 > chartData.dates.length ? chartData.dates.length : HistoryToDay + 7;
            if (HistoryPomodoroSelected) {
                udateHistoryTable(HistoryChart, chartData.dates, chartData.pomodoros, chartData.weekdays, "Pomodoros");
            } else {
                udateHistoryTable(HistoryChart, chartData.dates, chartData.hours, chartData.weekdays, "Hours");
            }
        });
        $("#HistoryCharPrev").click(function () {
            HistoryFromDay = HistoryFromDay - 7;
            HistoryToDay = HistoryToDay - 7;
            if (HistoryFromDay <= 0 || HistoryToDay <= 0) {
                HistoryFromDay = 0;
                HistoryToDay = 7;
            }
            if (HistoryPomodoroSelected) {
                udateHistoryTable(HistoryChart, chartData.dates, chartData.pomodoros, chartData.weekdays, "Pomodoros");
            } else {
                udateHistoryTable(HistoryChart, chartData.dates, chartData.hours, chartData.weekdays, "Hours");
            }
        });
    }

}

function udateHistoryTable(Chart, datesArary, dataArray, weekDaysArray, label) {

    var showDates = datesArary.slice(HistoryFromDay, HistoryToDay);
    var showData = dataArray.slice(HistoryFromDay, HistoryToDay);
    var showWeekDays = weekDaysArray.slice(HistoryFromDay, HistoryToDay);

    Chart.data.labels = showDates;
    Chart.data.datasets[0].data = showData;
    Chart.data.datasets[0].label = label;
    Chart.options.tooltips.callbacks.title = function (tooltipItem, data) {
        return tooltipItem[0].label + " " + showWeekDays[showDates.indexOf(tooltipItem[0].label)];
    }

    $("#HistoryChartTotal").html(`Sum: ${sumOfArray(showData)} | Avg: ${(sumOfArray(showData) / (HistoryToDay - HistoryFromDay)).toFixed(1)}`);
    Chart.update();
}

function setBrowserReviewLink() {
    var rateAndReviewLink = $("#rateAndReviewLink");
    if (BROWSER === "Mozilla Firefox") {
        rateAndReviewLink.attr("href", "https://addons.mozilla.org/he/firefox/addon/habitica-pomodoro-sitekeeper");
    } else if (BROWSER.includes("Microsoft Edge")) {
        rateAndReviewLink.attr("href", "https://microsoftedge.microsoft.com/addons/detail/habitica-pomodoro-sitekee/loclmeljcebbomgebpnbdmcmofmhoand");
    }
}

function getBrowser() {
    var sBrowser, sUsrAg = navigator.userAgent;

    // The order matters here, and this may report false positives for unlisted browsers.

    if (sUsrAg.indexOf("Firefox") > -1) {
        sBrowser = "Mozilla Firefox";
        // "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:61.0) Gecko/20100101 Firefox/61.0"
    } else if (sUsrAg.indexOf("SamsungBrowser") > -1) {
        sBrowser = "Samsung Internet";
        // "Mozilla/5.0 (Linux; Android 9; SAMSUNG SM-G955F Build/PPR1.180610.011) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/9.4 Chrome/67.0.3396.87 Mobile Safari/537.36
    } else if (sUsrAg.indexOf("Opera") > -1 || sUsrAg.indexOf("OPR") > -1) {
        sBrowser = "Opera";
        // "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36 OPR/57.0.3098.106"
    } else if (sUsrAg.indexOf("Trident") > -1) {
        sBrowser = "Microsoft Internet Explorer";
        // "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; .NET4.0C; .NET4.0E; Zoom 3.6.0; wbx 1.0.0; rv:11.0) like Gecko"
    } else if (sUsrAg.indexOf("Edge") > -1) {
        sBrowser = "Microsoft Edge (Legacy)";
        // "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36 Edge/16.16299"
    } else if (sUsrAg.indexOf("Edg") > -1) {
        sBrowser = "Microsoft Edge (Chromium)";
        // Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.64
    } else if (sUsrAg.indexOf("Chrome") > -1) {
        sBrowser = "Google Chrome or Chromium";
        // "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/66.0.3359.181 Chrome/66.0.3359.181 Safari/537.36"
    } else if (sUsrAg.indexOf("Safari") > -1) {
        sBrowser = "Apple Safari";
        // "Mozilla/5.0 (iPhone; CPU iPhone OS 11_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15E148 Safari/604.1 980x1306"
    } else {
        sBrowser = "unknown";
    }

    console.log(sBrowser);
    return sBrowser;
}




