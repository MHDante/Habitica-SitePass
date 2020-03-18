
//url params
var url = new URL(window.location.href);
var urlParams = new URLSearchParams(url.search);
var cost =urlParams.get("cost");
var time= urlParams.get("time");
var siteKeeperPage= urlParams.get("habiticaSiteKeeperPage");
//
if(!document.getElementById("payToPass") && siteKeeperPage === "payToPass"){
    msg = document.createElement('div');
    msg.setAttribute("id", "payToPass");
    document.body.append(msg);
    document.getElementById("payToPass").setAttribute("data-html","You're trying to Access " + window.location.hostname + "\n Pay "+cost+" Gold to access for "+time+" Minutes ");
    btn = document.createElement('button');
    btn.setAttribute("id", "payToPass_btn");
    btn.innerHTML = "Pay To Pass";  
    document.body.append(btn);
    btn.onclick = function(){goToPayPage()};

}

if(!document.getElementById("noPass") && siteKeeperPage === "noPass"){
    msg = document.createElement('div');
    msg.setAttribute("id", "noPass");
    document.body.append(msg);
    document.getElementById("noPass").setAttribute("data-html","You can't afford to visit " +  window.location.hostname +"\n You shall not pass!");
}


function goToPayPage(){
    urlParams.set("paid","true");
    url.search = urlParams.toString();
    location.href = url.toString();
}