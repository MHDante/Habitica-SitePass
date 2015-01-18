// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
var background = chrome.extension.getBackgroundPage();

function getCurrentTabUrl(callback) {
    var queryInfo = {
        active: true,
        currentWindow: true
    };
    chrome.tabs.query(queryInfo, function (tabs) {
        var tab = tabs[0];
        var url = tab.url;
        console.assert(typeof url == 'string', 'tab.url should be a string');
        callback(url);
    });
}

function removeDomain(index) {
    return function() {
        background.Domains.splice(index, 1);
        window.close();
        chrome.storage.sync.set({ 'save': background.Domains }, function () { });

    }
}

document.addEventListener("DOMContentLoaded", function () {
    getCurrentTabUrl(function(url) {
        console.log("2");
        var domain = new URL(url).hostname;
        var index = background.Domains.indexOf(domain);
        var link = document.createElement("a");
        var node;
        if (index > -1) {
            node = document.createTextNode("Un-Block Site!");
            link.onclick = function() {
                background.Domains.splice(index, 1);
                window.close();
                chrome.storage.sync.set({ 'save': background.Domains }, function () { });
                

            }
        } else {
            node = document.createTextNode("Block Site!");
            link.onclick = function () {
                background.Domains.push(domain);
                window.close();
                chrome.storage.sync.set({ 'save': background.Domains }, function () { });
                
            }

        }
        link.appendChild(node);
        document.body.appendChild(link);
        link.href = "#";


        document.body.appendChild(document.createElement("br"));
        var para = document.createElement("p");
        para.appendChild(document.createTextNode("Blocked Sites:"));
        document.body.appendChild(para);
        var ul = document.createElement("ul");
        for (var i = 0; i < background.Domains.length; i++) {
            var li = document.createElement("li");
            var a = document.createElement("a");
            a.appendChild(document.createTextNode(background.Domains[i]));
            a.onclick = removeDomain(i);
            a.href = "#";
            li.appendChild(a);
            ul.appendChild(li);
        }
        document.body.appendChild(ul);

        document.body.appendChild(document.createElement("br"));

        var div = document.createElement("div");
        div.innerHTML =
            '<div id="EmptyUID">If either field is empty, this extension does not work.</div>' +
            '<label for="uid">HabitRPG User ID:</label><input id="uid" type="text" value="' + background.Credentials[0] + '"/></br>' +
            '<label for="apiToken">HabitRPG API Token:</label><input id="apiToken" type="text" value="' + background.Credentials[1] + '"/></br>';
        var button = document.createElement("button");
        button.appendChild(document.createTextNode("Save"));
        button.onclick = updateCredentials;
        button.type = "submit";
        div.appendChild(button);
        document.body.appendChild(div);

    });
});

function updateCredentials() {
    background.Credentials = [document.getElementById("uid").value, document.getElementById("apiToken").value];
    chrome.storage.sync.set({ 'creds': background.Credentials }, function () { });
    window.close();
}
