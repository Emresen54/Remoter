require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const os = require("os");
const path = require("path");
const QRCode = require("qrcode");
const open = require("open").default;
const { Server } = require("socket.io");
const { handleCommand } = require("./inputController");

const app = express();
app.use(cors());

const server = http.createServer(app);

const PORT = Number(process.env.PORT || 3001);
let SESSION_TOKEN = Math.floor(100000 + Math.random() * 900000).toString();
let connectedClients = 0;

const io = new Server(server, {
  cors: { origin: "*" },
  transports: ["websocket"],
});

function getLocalIPv4Addresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      const isIPv4 = net.family === "IPv4" || net.family === 4;

      if (!isIPv4 || net.internal) continue;

      addresses.push({
        name: name.toLowerCase(),
        address: net.address,
      });
    }
  }

  return addresses;
}

function pickBestAddress(addresses) {
  const filtered = addresses.filter((item) => {
    const n = item.name;

    if (
      n.includes("virtual") ||
      n.includes("vmware") ||
      n.includes("vbox") ||
      n.includes("hyper-v") ||
      n.includes("vethernet") ||
      n.includes("loopback") ||
      n.includes("bluetooth")
    ) {
      return false;
    }

    return true;
  });

  const source = filtered.length > 0 ? filtered : addresses;

  return (
    source.find((item) => item.address.startsWith("192.168.1.")) ||
    source.find((item) => item.address.startsWith("192.168.0.")) ||
    source.find((item) => item.address.startsWith("10.")) ||
    source.find((item) => item.address.startsWith("172.")) ||
    source[0] ||
    { address: "localhost", name: "localhost" }
  );
}

function generateToken() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildAdminHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Remoter Admin</title>
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #111;
      color: white;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .card {
      width: 100%;
      max-width: 820px;
      background: #181818;
      border: 1px solid #2f2f2f;
      border-radius: 20px;
      padding: 28px;
    }

    h1 {
      margin: 0 0 8px 0;
      font-size: 34px;
    }

    .subtitle {
      margin: 0 0 20px 0;
      color: #b7b7b7;
      line-height: 1.5;
    }

    .status-badge {
      display: inline-block;
      margin-bottom: 18px;
      padding: 8px 14px;
      border-radius: 999px;
      background: #17381f;
      color: #8ee0a4;
      font-weight: 700;
      font-size: 14px;
    }

    .live-status {
      margin: 0 0 22px 0;
      font-size: 15px;
      color: #d7d7d7;
    }

    .grid {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 20px;
    }

    .panel {
      background: #131313;
      border: 1px solid #2a2a2a;
      border-radius: 16px;
      padding: 18px;
      margin-bottom: 16px;
    }

    .label {
      font-size: 13px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }

    .value {
      font-size: 20px;
      font-weight: 700;
      word-break: break-all;
    }

    .token {
      font-size: 34px;
      letter-spacing: 0.12em;
    }

    .buttons {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    button {
      border: none;
      border-radius: 10px;
      background: #2b2b2b;
      color: white;
      padding: 12px 16px;
      font-size: 14px;
      cursor: pointer;
    }

    button:hover {
      background: #3a3a3a;
    }

    .qr-panel {
      background: #131313;
      border: 1px solid #2a2a2a;
      border-radius: 16px;
      padding: 18px;
      height: 100%;
    }

    .qr-box {
      background: white;
      border-radius: 16px;
      padding: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 260px;
    }

    .qr-box img {
      max-width: 100%;
      width: 240px;
      height: 240px;
      object-fit: contain;
    }

    .small {
      margin-top: 12px;
      color: #bdbdbd;
      font-size: 14px;
      line-height: 1.5;
      word-break: break-word;
    }

    @media (max-width: 760px) {
      .grid {
        grid-template-columns: 1fr;
      }

      .token {
        font-size: 28px;
      }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="status-badge">Server Working</div>
    <h1>Remoter Admin</h1>
    <p class="subtitle">
      Open the remote page on your phone or tablet, then enter the session token.
    </p>

    <p class="live-status" id="connectionStatus">Checking connection status...</p>

    <div class="grid">
      <div>
        <div class="panel">
          <div class="label">Connection URL</div>
          <div class="value" id="remoteUrl">Loading...</div>
        </div>

        <div class="panel">
          <div class="label">Session Token</div>
          <div class="value token" id="tokenValue">------</div>
        </div>

        <div class="buttons">
          <button onclick="copyValue('remoteUrl')">Copy URL</button>
          <button onclick="copyValue('tokenValue')">Copy Token</button>
          <button onclick="openRemotePage()">Open Remote Page</button>
        </div>
      </div>

      <div class="qr-panel">
        <div class="label">QR Code</div>
        <div class="qr-box">
          <img id="qrImage" alt="QR Code" />
        </div>
        <div class="small" id="qrUrlText"></div>
      </div>
    </div>
  </div>

  <script>
    let remoteUrlCache = "";

    async function loadServerInfo() {
      try {
        const res = await fetch("/api/server-info");
        const data = await res.json();

        remoteUrlCache = data.remoteUrl;

        document.getElementById("remoteUrl").textContent = data.remoteUrl;
        document.getElementById("tokenValue").textContent = data.token;
        document.getElementById("qrImage").src = data.qrDataUrl;
        document.getElementById("qrUrlText").textContent = data.remoteUrl;

        updateConnectionStatus(data.connectedClients);
      } catch (err) {
        document.getElementById("connectionStatus").textContent =
          "Failed to load server info";
      }
    }

    function updateConnectionStatus(count) {
      const el = document.getElementById("connectionStatus");

      if (count > 0) {
        el.textContent = count + " device connected";
      } else {
        el.textContent = "Waiting for connection";
      }
    }

    async function copyValue(id) {
      try {
        const text = document.getElementById(id).textContent;
        await navigator.clipboard.writeText(text);
        alert("Copied: " + text);
      } catch (err) {
        alert("Copy failed");
      }
    }

    function openRemotePage() {
      if (!remoteUrlCache) return;
      window.open(remoteUrlCache, "_blank");
    }

    loadServerInfo();
    setInterval(loadServerInfo, 2000);
  </script>
</body>
</html>
  `;
}

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.data.authenticated = false;

  socket.on("authenticate", (token) => {
    if (typeof token !== "string") {
      socket.emit("auth_error", "Invalid token format");
      socket.disconnect();
      return;
    }

    if (token.trim() !== SESSION_TOKEN) {
      socket.emit("auth_error", "Invalid token");
      socket.disconnect();
      return;
    }

    socket.data.authenticated = true;
    connectedClients += 1;
    socket.emit("auth_ok");
    console.log(`Client authenticated: ${socket.id}`);
  });

  socket.on("remote_command", async (payload) => {
    if (!socket.data.authenticated) return;

    try {
      await handleCommand(payload);
    } catch (error) {
      console.error("Command error:", error.message);
      socket.emit("command_error", error.message);
    }
  });

  socket.on("disconnect", () => {
    if (socket.data.authenticated) {
      connectedClients = Math.max(0, connectedClients - 1);
    }

    console.log(`Client disconnected: ${socket.id}`);
  });
});

async function startServer() {
  const addresses = getLocalIPv4Addresses();
  const bestIP = pickBestAddress(addresses);

  const remoteUrl = `http://${bestIP.address}:${PORT}`;
  const adminUrl = `http://localhost:${PORT}/admin`;
  const qrDataUrl = await QRCode.toDataURL(remoteUrl.trim());

  app.get("/api/server-info", (req, res) => {
    res.json({
      port: PORT,
      token: SESSION_TOKEN,
      remoteUrl,
      adminUrl,
      qrDataUrl,
      connectedClients,
    });
  });

  app.get("/admin", (req, res) => {
    res.send(buildAdminHtml());
  });

  const distPath = path.join(__dirname, "../../web/dist");
  app.use(express.static(distPath));

  app.use((req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  server.listen(PORT, "0.0.0.0", async () => {
    console.log("");
    console.log("==================================");
    console.log("     Remoter Server Started       ");
    console.log("==================================");
    console.log(`Port: ${PORT}`);
    console.log(`Token: ${SESSION_TOKEN}`);
    console.log(`URL: ${remoteUrl}`);
    console.log(`Admin: ${adminUrl}`);
    console.log("==================================");
    console.log("");

    await open(adminUrl);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
});