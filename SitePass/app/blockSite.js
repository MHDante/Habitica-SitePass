
console.log("Habitica SitePass Running");

var blockRequest = "block";
var unBlockRequest = "unblock";
var pageBody = document.body
var siteBlocked = false;

var imageURL = chrome.extension.getURL("/img/siteKeeper.png");
injectStyles('.blockedSite:after { background-image:url("'+imageURL+'"); }');

chrome.runtime.onMessage.addListener(gotMessage);

function gotMessage(message,sender,sendRequest){
    //console.log(message.content);
    if(message.request == blockRequest){
        blockSiteOverlay(message.content);
        siteBlocked = true;
    }else if(message.request == unBlockRequest){
        unblockSiteOverlay();
        siteBlocked = false;
    }
}

function blockSiteOverlay(content){
    var blockOverlayClass = ' blockedSite';
    pageBody.setAttribute('data-html', content);
    if(!siteBlocked){
        pageBody.className = pageBody.className.replace( blockOverlayClass, '' );
        pageBody.className = pageBody.className + blockOverlayClass;
        // $(".blockedSite").append("<div>123456</div>");
    }
    
}

function unblockSiteOverlay(){
    var blockOverlayClass = ' blockedSite';
    pageBody.className = pageBody.className.replace( blockOverlayClass, '' );
}

function injectStyles(rule) {
    var div = $("<div />", {
      html: '&shy;<style>' + rule + '</style>'
    }).appendTo("body");    
  }

 

