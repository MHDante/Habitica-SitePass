Node.prototype.AppendText = function (string) { this.appendChild(document.createTextNode(string)); }
Node.prototype.AppendBreak = function () { this.appendChild(document.createElement("br")); }

var background = chrome.extension.getBackgroundPage();
console.log(background);
var Vars = background.Vars;
var Consts = background.Consts;
var CurrentTabHostname; 

//----- on popup load -----//
document.addEventListener("DOMContentLoaded", function () {
   
    background.FetchHabiticaData(true); //Fetch Habitica basic data when opening the popup

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

    //Pomodoro Button actions
    $("#PomoButton").click(function () {
        if(Vars.onBreak && !Vars.TimerRunnig){
            background.stopTimer();
            background.startBreak();
        }
        else if(!Vars.TimerRunnig || Vars.onBreak || Vars.onBreakExtension){    
            if(Vars.PomoSetCounter == Vars.UserData.PomoSetNum){ //Set complete
                background.pomoReset();
            }else{//next pomodoro
                background.stopTimer();
                background.startPomodoro();
            } 
        }else{
            background.stopTimer();
            background.pomodoroInterupted();   
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
        Vars.EditingSettings = false;
    });
    
    //Take manual break in quick settings
    $("#quickSet-takeBreak").click(function () {
        background.takeBreak($("#quickSet-takeBreakDuration").val());
        $("#pomodoroSettings").hide();
        $("#pomodoro").show();
        Vars.EditingSettings = false;
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

    //Update Timer display
    updateTimerDisplay();
    setInterval(function () {
        updateTimerDisplay();
    }, 1000);

    //Vacation Mode Banner
    if(Vars.UserData.VacationMode){
        $(".vacationBanner").show();
    }

    //Hide Edit Options
    if(Vars.UserData.HideEdit){
        $("#BlockLink").hide();
        $(".edit").hide();
        $(".delete").hide();
    }

    if(!Vars.UserData.ConnectHabitica){
        $(".habitica-setting").fadeTo( "slow" , 0.3);
        $(".buy").hide();
        $(".edit").hide();
    }
    $("#ConnectHabitica").click(function() {
        if($("#ConnectHabitica").is(':checked')){
            $(".habitica-setting").fadeTo( "slow" , 1); 
            $(".buy").show();
            $(".edit").show();
        }else{
            $(".habitica-setting").fadeTo( "slow" , 0.3);
            $(".buy").hide();
            $(".edit").hide();
        }
    });

    //Custome pomodoro habits
    $("#customPomodoroTask").empty();
    $("#customSetTask").empty();
    for(var i in Vars.PomodoroTaskCustomList){
        var title = Vars.PomodoroTaskCustomList[i].title;
        var taskId = Vars.PomodoroTaskCustomList[i].id;
        var option = document.createElement("option");
        option.value = taskId;
        option.innerHTML = title;
        $("#customPomodoroTask").append(option);
        $("#customSetTask").append(option.cloneNode(true));
    }
    $("#customPomodoroTask").val(Vars.PomodoroTaskId);
    $("#customSetTask").val(Vars.PomodoroSetTaskId);
});


//----- Functions -----//

function AddSiteToTable(site, fadein) {
    var table = $("#SiteTable");
    var cost = site.cost;
    if (cost % 1 != 0) cost = cost.toFixed(2);

    var passExpiryElement = "";
    if(site.passExpiry){
        var passExpiry =  new Date(site.passExpiry);
        if(site.passExpiry>Date.now()){
            var hrs =  passExpiry.getHours();
            hrs = hrs < 10 ? "0" + hrs : hrs;
            var min = passExpiry.getMinutes();
            min = min < 10 ? "0" + min : min;
            passExpiryElement = '<br><span class="passExp">'+ hrs + ":" + min +'</span>'
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
            '<td style="width:100%"><div class="hostname">' + site.hostname + passExpiryElement +'</div></td>' +
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
    if(!Vars.UserData.ConnectHabitica){
        $(".buy").hide();
        $(".edit").hide(); 
        $(".cost-input").hide(); 
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
    if (Vars.ServerResponse == 401 && Vars.UserData.ConnectHabitica) {
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

    //Set Options according to UserData in background.js
    $("#UID").val(Vars.UserData.Credentials.uid);
    $("#APIToken").val(Vars.UserData.Credentials.apiToken);
    $("#Duration").val(Vars.UserData.PassDurationMins);
    $("#PomoDuration").val(Vars.UserData.PomoDurationMins);
    $("#BreakDuration").val(Vars.UserData.BreakDuration);
    $("#BreakExtention").val(Vars.UserData.BreakExtention);
    $("#LongBreakDuration").val(Vars.UserData.LongBreakDuration);
    $("#PomoHabitPlus").prop('checked', Vars.UserData.PomoHabitPlus);
    $("#PomoHabitMinus").prop('checked', Vars.UserData.PomoHabitMinus);
    $("#ManualBreak").prop('checked', Vars.UserData.ManualBreak);
    $("#BreakFreePass").prop('checked', Vars.UserData.BreakFreePass);
    $("#BreakExtentionFails").prop('checked', Vars.UserData.BreakExtentionFails);
    $("#BreakExtentionNotify").prop('checked', Vars.UserData.BreakExtentionNotify);
    $("#SoundNotify").prop('checked', Vars.UserData.SoundNotify);
    $("#HideEdit").prop('checked', Vars.UserData.HideEdit);
    $("#PomoSetNum").val(Vars.UserData.PomoSetNum);
    $("#PomoSetHabitPlus").prop('checked', Vars.UserData.PomoSetHabitPlus);
    $("#LongBreakNotify").prop('checked', Vars.UserData.LongBreakNotify);
    $("#VacationMode").prop('checked', Vars.UserData.VacationMode);
    $("#customPomodoroTaskEnabled").prop('checked',Vars.UserData.CustomPomodoroTask);
    $("#customSetTaskEnabled").prop('checked',Vars.UserData.CustomSetTask);
    $("#customPomodoroTask").val(Vars.UserData.PomodoroTaskId);
    $("#customSetTask").val(Vars.UserData.PomodoroSetTaskId);
    $("#ConnectHabitica").prop('checked',Vars.UserData.ConnectHabitica);
    $("#MuteBlockedSites").prop('checked',Vars.UserData.MuteBlockedSites);
    $("#TranspartOverlay").prop('checked',Vars.UserData.TranspartOverlay);
    $("#TickSound").prop('checked',Vars.UserData.TickSound);
    $("#showSkipToBreak").prop('checked',Vars.UserData.showSkipToBreak);

    //Update Pomodoros Today, reset on new day
    today = new Date().setHours(0,0,0,0);
    if(Vars.PomodorosToday.date!= today){
        Vars.PomodorosToday.value=0;
        Vars.PomodorosToday.date = today;
    } 
    $("#PomoButton").attr("data-pomodoros",Vars.PomodorosToday.value);
     

    //Update Options on change
    $("#UID").on("keyup", function () { updateCredentials(); });
    $("#APIToken").on("keyup", function () { updateCredentials(); });
    $("#Duration").on("keyup", function () { updateCredentials(); });
    $("#PomoDuration").on("keyup", function () { updateCredentials(); });
    $("#BreakDuration").on("keyup", function () { updateCredentials(); });
    $("#BreakExtention").on("keyup", function () { updateCredentials(); });
    $("#LongBreakDuration").on("keyup", function () { updateCredentials(); });
    $("#PomoHabitPlus").click(function () { updateCredentials(); });
    $("#PomoHabitMinus").click(function () { updateCredentials(); });
    $("#ManualBreak").click(function () { updateCredentials(); });
    $("#BreakFreePass").click(function () { updateCredentials(); });
    $("#BreakExtentionFails").click(function () { updateCredentials(); });
    $("#BreakExtentionNotify").click(function () { updateCredentials(); });
    $("#SoundNotify").click(function () { updateCredentials(); });
    $("#HideEdit").click(function () { updateCredentials(); });
    $("#PomoSetNum").bind('keyup input change', function(){updateCredentials();});
    $("#PomoSetHabitPlus").click(function () { updateCredentials(); });
    $("#LongBreakNotify").click(function () { updateCredentials(); });
    $("#VacationMode").click(function () { updateCredentials(); });
    $("#customPomodoroTask").click(function () { updateCredentials(); });
    $("#customSetTask").click(function () { updateCredentials(); });
    $("#customPomodoroTaskEnabled").click(function () { updateCredentials(); });
    $("#customSetTaskEnabled").click(function () { updateCredentials(); });
    $("#ConnectHabitica").click(function () { updateCredentials(); });
    $("#MuteBlockedSites").click(function () { updateCredentials(); });
    $("#TranspartOverlay").click(function () { updateCredentials(); });
    $("#TickSound").click(function () { updateCredentials(); });
    $("#showSkipToBreak").click(function () { updateCredentials(); });
    
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
        $("#BlockLink").html("<span class='unblock_Icon'></span>Un-Block Site!");
    } else {
        $("#BlockLink").html("<span class='block_Icon'></span>Block Site!");
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
    Vars.UserData.SoundNotify = $("#SoundNotify").prop('checked');
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
}

function updateTimerDisplay(){
    $('#Time').html(Vars.Timer);
    if(Vars.onManualTakeBreak){
        $("#Time").attr("data-pomodoros-set","");
    }else{
        $("#Time").attr("data-pomodoros-set",Vars.PomoSetCounter+"/"+Vars.UserData.PomoSetNum);
    }

    $("#PomoButton").attr("data-pomodoros",Vars.PomodorosToday.value);

    var time = Vars.Timer.split(':');
    //var seconds = parseInt(time[0])*60+parseInt(time[1]);
    //var duration = Vars.UserData.PomoDurationMins*60;

    if(Vars.onBreakExtension){
        $("#QuickSettings").hide();
        $('#pomodoro').css("background-color", "red");
        $('#pomodoro').css("color", "coral");
        tomatoSetClass("tomatoWarning");
        if(!Vars.onManualTakeBreak){
            $("#PomoStop").show();
        }
        $("#SkipToBreak").hide();
    }
    else if(Vars.onBreak){
        $("#QuickSettings").hide();
        if(Vars.TimerRunnig){ //---On Break---
            $('#pomodoro').css("background-color", "cornflowerblue");
            $('#pomodoro').css("color", "aqua");
            tomatoSetClass("tomatoBreak");
        }
        else{//---Manual Break---
            $('#pomodoro').css("background-color", "green");
            $('#pomodoro').css("color", "lightgreen");
            tomatoSetClass("tomatoWin");
        }
        if(!Vars.onManualTakeBreak){
            $("#PomoStop").show();
        }
        $("#SkipToBreak").hide();
        $("#SiteTable tbody").toggleClass('blocked',false);
    }
    else if(Vars.TimerRunnig){ //---Pomodoro running---
        $("#QuickSettings").show();
        $('#pomodoro').css("background-color", "green"); 
        $('#pomodoro').css("color", "lightgreen");
        tomatoSetClass("tomatoProgress");
        $("#SiteTable tbody").toggleClass('blocked',true);
        $("#PomoStop").hide();
        $("#QuickSettings").hide();
        if(Vars.UserData.showSkipToBreak){
            $("#SkipToBreak").show();
        } 
    }else{ //---pomodoro not running---
        $("#QuickSettings").show();
        $('#pomodoro').css("background-color", "#2995CD")
        $('#pomodoro').css("color", "#36205D");
        tomatoSetClass("tomatoWait"); 
        $("#SiteTable tbody").toggleClass('blocked',false);
        $("#PomoStop").hide();
        $("#SkipToBreak").hide();
        
    }
}

var TOMATO_CLASSES = ["tomatoProgress","tomatoWait","tomatoBreak","tomatoWin","tomatoWarning"];
function tomatoSetClass(className){
    TOMATO_CLASSES.forEach(function(entry) {
        $('.tomato').toggleClass(entry, false);
    });
    $('.tomato').toggleClass(className, true);
}

