
console.log("Habitica SitePass Running");

var blockRequest = "block";
var unBlockRequest = "unblock";

chrome.runtime.onMessage.addListener(gotMessage);

function gotMessage(message,sender,sendRequest){
    console.log(message.content);
    if(message.request == blockRequest){
        blockSiteOverlay(message.content);
    }else if(message.request == unBlockRequest){

    }
}

function blockSiteOverlay(content){
    var pageBody = document.body 
    var blockOverlayClass = 'blockedSite';
    pageBody.className = pageBody.className.replace( blockOverlayClass, '' );
    pageBody.className = pageBody.className + blockOverlayClass;
    pageBody.setAttribute('data-html', content);
}
