function callHabiticaAPI(serverPathUrl,xClientHeader,credentials,method,postData) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, serverPathUrl, false);
    xhr.setRequestHeader('x-client', xClientHeader);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('x-api-user', credentials.uid);
    xhr.setRequestHeader('x-api-key', credentials.apiToken);
    if (typeof postData !== 'undefined') xhr.send(postData);
    else xhr.send();
    return (xhr.responseText);
}

function getHabiticaData(serverPathUrl,xClientHeader,credentials){
    var xhr = new XMLHttpRequest();
    xhr.open("GET", serverPathUrl, false);
    xhr.setRequestHeader('x-client', xClientHeader);
    xhr.setRequestHeader("x-api-user", credentials.uid);
    xhr.setRequestHeader("x-api-key", credentials.apiToken);
    try {
        xhr.send();
    } catch (e) {

    }
    return xhr;
}