const WebSocket = require('ws');
const fs = require('fs');
const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

let socket = null;
let proxies = [];
let currentProxyIndex = 0;

// Load user ID
const userId = fs.readFileSync('userId.txt', 'utf8').trim();
if (!userId) {
    console.log("User not logged in.");
    process.exit();
}

// Load proxies from file
function loadProxies() {
    if (fs.existsSync('proxies.txt')) {
        proxies = fs.readFileSync('proxies.txt', 'utf8').split('\n').filter(Boolean);
        console.log(`Loaded ${proxies.length} proxies.`);
    } else {
        console.log("No proxies found. Connecting without proxy.");
    }
}

// Get the next proxy in the list (cycling)
function getNextProxy() {
    if (proxies.length === 0) return null; // No proxies, return null
    const proxy = proxies[currentProxyIndex];
    currentProxyIndex = (currentProxyIndex + 1) % proxies.length; // Move to the next proxy
    return proxy;
}

// Determine the correct proxy agent based on the proxy URL
function createProxyAgent(proxyUrl) {
    if (!proxyUrl) return null; // No proxy, no agent

    try {
        const protocol = new URL(proxyUrl).protocol;
        if (protocol === 'http:') {
            return new HttpProxyAgent(proxyUrl); // HTTP proxy
        } else if (protocol === 'https:') {
            return new HttpsProxyAgent(proxyUrl); // HTTPS proxy
        } else if (protocol.startsWith('socks')) {
            return new SocksProxyAgent(proxyUrl); // SOCKS proxy
        } else {
            console.error("Unsupported proxy protocol:", protocol);
            return null;
        }
    } catch (error) {
        console.error("Invalid proxy URL:", proxyUrl);
        return null;
    }
}

function connectWebSocket() {
    if (socket) return;

    const version = "v0.2";
    const url = "wss://secure.ws.teneo.pro";
    const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userId)}&version=${encodeURIComponent(version)}`;

    // Get the next proxy for this connection attempt
    const proxyUrl = getNextProxy();
    const agent = createProxyAgent(proxyUrl);
    const options = agent ? { agent } : {};
    console.log(`Connecting to WebSocket ${proxyUrl ? "with proxy " + proxyUrl : "directly"}...`);

    socket = new WebSocket(wsUrl, options);

    socket.on('open', () => {
        console.log("WebSocket connection established.");
    });

    socket.on('message', (data) => {
        console.log("Received message:", JSON.parse(data));
    });

    socket.on('close', () => {
        console.log("WebSocket disconnected. Attempting to reconnect...");
        socket = null;
        setTimeout(connectWebSocket, 5000); // Attempt reconnection after delay
    });

    socket.on('error', (error) => {
        console.error("WebSocket error:", error);
        socket.close(); // Close the connection on error to trigger reconnection with next proxy
    });
}

// Load proxies and start WebSocket connection
loadProxies();
connectWebSocket();
