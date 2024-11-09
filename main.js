const WebSocket = require('ws');
const fs = require('fs');
let socket = null;
let pingInterval;
let countdownInterval;
let potentialPoints = 0;
let countdown = "Calculating...";
let pointsTotal = 0;
let pointsToday = 0;

const RECONNECT_DELAY = 5000; // 5 seconds delay for reconnecting

function connectWebSocket() {
  if (socket) return;
  
  const userId = fs.readFileSync('userId.txt', 'utf8').trim();
  if (!userId) {
    console.log("User not logged in.");
    return;
  }

  const version = "v0.2";
  const url = "wss://secure.ws.teneo.pro";
  const wsUrl = `${url}/websocket?userId=${encodeURIComponent(userId)}&version=${encodeURIComponent(version)}`;
  socket = new WebSocket(wsUrl);

  socket.on('open', () => {
    console.log("WebSocket connection established.");
    const connectionTime = new Date().toISOString();
    fs.writeFileSync('lastUpdated.txt', connectionTime);
    startPinging();
    startCountdownAndPoints();
  });

  socket.on('message', (data) => {
    data = JSON.parse(data);
    console.log("Received message:", data);

    if (data.pointsTotal !== undefined && data.pointsToday !== undefined) {
      pointsTotal = data.pointsTotal;
      pointsToday = data.pointsToday;
      fs.writeFileSync('pointsData.json', JSON.stringify({
        pointsTotal,
        pointsToday,
        lastUpdated: new Date().toISOString()
      }));

      // Log the latest points update to the console
      console.log(`Latest Points Update - Total Points: ${pointsTotal}, Points Today: ${pointsToday}`);
    }
  });

  socket.on('close', () => {
    console.log("WebSocket disconnected. Attempting to reconnect...");
    socket = null;
    stopPinging();
    setTimeout(connectWebSocket, RECONNECT_DELAY); // Attempt reconnection after delay
  });

  socket.on('error', (error) => {
    console.error("WebSocket error:", error);
    socket.close(); // Close the connection on error to trigger reconnection
  });
}

function disconnectWebSocket() {
  if (socket) {
    socket.close();
    socket = null;
    stopPinging();
  }
}

function startPinging() {
  stopPinging();
  pingInterval = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "PING" }));
      console.log("Ping sent at:", new Date().toISOString());
      fs.writeFileSync('lastPingDate.txt', new Date().toISOString());
    }
  }, 10000);
}

function stopPinging() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

function startCountdownAndPoints() {
  clearInterval(countdownInterval);
  updateCountdownAndPoints();
  countdownInterval = setInterval(updateCountdownAndPoints, 1000);
}

function updateCountdownAndPoints() {
  const lastUpdated = fs.existsSync('lastUpdated.txt') ? fs.readFileSync('lastUpdated.txt', 'utf8') : null;
  if (lastUpdated) {
    const nextHeartbeat = new Date(lastUpdated);
    nextHeartbeat.setMinutes(nextHeartbeat.getMinutes() + 15);

    const now = new Date();
    const diff = nextHeartbeat.getTime() - now.getTime();

    if (diff > 0) {
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      countdown = `${minutes}m ${seconds}s`;

      const maxPoints = 25;
      const timeElapsed = now.getTime() - new Date(lastUpdated).getTime();
      const timeElapsedMinutes = timeElapsed / (60 * 1000);
      let newPoints = Math.min(maxPoints, (timeElapsedMinutes / 15) * maxPoints);
      newPoints = parseFloat(newPoints.toFixed(2));

      if (Math.random() < 0.1) {
        const bonus = Math.random() * 2;
        newPoints = Math.min(maxPoints, newPoints + bonus);
        newPoints = parseFloat(newPoints.toFixed(2));
      }

      potentialPoints = newPoints;
    } else {
      countdown = "Calculating...";
      potentialPoints = 25;
    }
  } else {
    countdown = "Calculating...";
    potentialPoints = 0;
  }

  console.log(`Countdown: ${countdown}, Potential Points: ${potentialPoints}`);
  fs.writeFileSync('pointsStatus.json', JSON.stringify({ potentialPoints, countdown }));
}

// Start WebSocket connection
connectWebSocket();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log("Shutting down...");
  disconnectWebSocket();
  clearInterval(countdownInterval);
  process.exit();
});
