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



document.addEventListener("DOMContentLoaded", function () {
    
    getCurrentTabUrl(function(url) {
        var domain = new URL(url).hostname;
        var index = -1;
        for (var j = 0; j < background.Domains.length; j++) {
            if (background.Domains[j].hostname == domain) {
                index = j;
                break;
            }
        }

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
                background.Domains.push(new background.Domain(domain, 0, Date.now()));
                updateDomainCost(background.Domains.length - 1)();
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
        var table = document.createElement("table");

        for (var i = 0; i < background.Domains.length; i++) {
            var tr = document.createElement("tr");
            tr.className = "reward-item";
            var buyLink = document.createElement("a");
            buyLink.href = "#";
            buyLink.onclick = openTab("http://"+background.Domains[i].hostname);
            var buy = document.createElement("td");
            buy.className = "gp";
            var span = document.createElement("span");
            span.className = "shop_gold";
            buy.appendChild(span);
            buy.appendChild(document.createElement("br"));
            var cost = background.Domains[i].cost;
            if (cost%1 != 0)cost = cost.toFixed(2);
            buy.appendChild(document.createTextNode(cost));
            buyLink.appendChild(buy);
            tr.appendChild(buyLink);

            var td = document.createElement("td");
            td.appendChild(document.createTextNode(background.Domains[i].hostname));
            tr.appendChild(td);

            td = document.createElement("td");
            var pencil = document.createElement("a");
            pencil.appendChild(document.createTextNode("\u270F"));
            pencil.onclick = updateDomainCost(i);
            pencil.href = "#";
            pencil.innerHTML = '<img src="img/pencil.png" />';
            td.appendChild(pencil);
            tr.appendChild(td);

            td = document.createElement("td");
            var trash = document.createElement("a");
            trash.appendChild(document.createTextNode("\uE017"));
            trash.onclick = removeDomain(i);
            trash.href = "#";
            trash.innerHTML = '<img src="img/trash.png" />';
            td.appendChild(trash);
            tr.appendChild(td);

            table.appendChild(tr);
            tr = document.createElement("tr");
            tr.innerHTML = "<td></td>";
            tr.style.height = 10;
            table.appendChild(tr);


        }
        document.body.appendChild(table);

        document.body.appendChild(document.createElement("br"));

        var div = document.createElement("div");
        div.innerHTML =
            '<div id="EmptyUID">If either field is empty, this extension does not work.</div>' +
            '<label for="uid">HabitRPG User ID:</label><br /><input id="uid" type="text" value="' + background.Credentials[0] + '"/></br>' +
            '<label for="apiToken">HabitRPG API Token:<br /></label><input id="apiToken" type="text" value="' + background.Credentials[1] + '"/></br>';
        var button = document.createElement("button");
        button.appendChild(document.createTextNode("Save"));
        button.onclick = updateCredentials;
        button.type = "submit";
        div.appendChild(button);
        document.body.appendChild(div);

        var p2 = document.createElement("h1");
        var dosh = document.createElement("span");
        dosh.className = "shop_gold";
        p2.appendChild(dosh);
        p2.appendChild(document.createTextNode(" : " + background.Monies.toFixed(2)));

        document.body.appendChild(p2);
    });
});

function openTab(oUrl) {
    return function() {
        chrome.tabs.create({ url: oUrl });
    }
}

function updateDomainCost(domainNumber) {
    return function() {
        var selection;
        do {
            selection = parseFloat(window.prompt("Enter a cost", 5));
        } while (isNaN(selection) || selection < 0);
        background.Domains[domainNumber].cost = selection;
        window.close();
        chrome.storage.sync.set({ 'save': background.Domains }, function () { });
    }
}
function removeDomain(index) {
    return function () {
        if (confirm("Are you sure you want to remove this block?")) {
            background.Domains.splice(index, 1);
            window.close();
            chrome.storage.sync.set({ 'save': background.Domains }, function() {});
        }
    }
}
function updateCredentials() {
    background.Credentials = [document.getElementById("uid").value, document.getElementById("apiToken").value];
    chrome.storage.sync.set({ 'creds': background.Credentials }, function () { });
    FetchUserData();
    if (background.Credentials[0] == "3e595299-3d8a-4a10-bfe0-88f555e4aa0c") {
        alert("I might have a small crush on you.");
    }
    window.close();

}
