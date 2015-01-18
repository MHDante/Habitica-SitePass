var Domains = ["a", "b"];
var Credentials = ["a", "b"];

var DOMAINS_KEY = "DOMAINS_KEY";

// Run our kitten generation script as soon as the document's DOM is ready.

var callback = function (details) {
    //alert(details.url);
    var index = Domains.indexOf(new URL(details.url).hostname);
    if (index > -1) {
        alert("Site Blocked!");
        return { redirectUrl: 'http://google.com/gen_204' };
    };
    return { cancel: false };
};

var filter = {urls: ["<all_urls>"] , types: ["main_frame"] };

var opt_extraInfoSpec = ["blocking"];
chrome.webRequest.onBeforeRequest.addListener(
        callback, filter, opt_extraInfoSpec);





// ReSharper disable once PossiblyUnassignedProperty
chrome.storage.sync.get("save", function (result) {
    console.log(typeof result.save);
    if (!(result.save instanceof Array)) {
        Domains = [];
    } else {
        Domains = result.save;
    }
});


chrome.storage.sync.get("creds", function (result) {
    console.log(typeof result.creds);
    if (!(result.creds instanceof Array)) {
        Credentials = ["Not", "Set"];
    } else {
        Credentials = result.creds;
    }
});