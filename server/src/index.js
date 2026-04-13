require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const os = require("os");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");
const open = require("open").default;
const { Server } = require("socket.io");
const { handleCommand } = require("./inputController");

const app = express();
app.use(cors());

const server = http.createServer(app);

const PORT = Number(process.env.PORT || 3001);
let SESSION_TOKEN = generateToken();
let connectedClients = 0;

const io = new Server(server, {
  cors: { origin: "*" },
  transports: ["websocket"],
});

function generateToken() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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
    source.find((i) => i.address.startsWith("192.168.1.")) ||
    source.find((i) => i.address.startsWith("192.168.0.")) ||
    source.find((i) => i.address.startsWith("10.")) ||
    source.find((i) => i.address.startsWith("172.")) ||
    source[0] ||
    { address: "localhost", name: "localhost" }
  );
}

function resolveDistPath() {
  const candidate1 = path.join(process.cwd(), "web", "dist");
  const candidate2 = path.join(__dirname, "../../web/dist");

  if (fs.existsSync(path.join(candidate1, "index.html"))) {
    return candidate1;
  }

  return candidate2;
}

function buildAdminHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Remoter Admin</title>

<style>
body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #0f0f0f;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.card {
  background: #181818;
  padding: 30px;
  border-radius: 20px;
  width: 100%;
  max-width: 820px;
  border: 1px solid #2a2a2a;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
}

h1 {
  margin: 0 0 10px 0;
  font-size: 34px;
}

.status {
  display: inline-block;
  color: #8ee0a4;
  background: #17381f;
  padding: 8px 14px;
  border-radius: 999px;
  margin-bottom: 18px;
  font-weight: 700;
  font-size: 14px;
}

.subtitle {
  margin: 0 0 20px 0;
  color: #b7b7b7;
  line-height: 1.5;
}

.connection {
  margin: 0 0 18px 0;
  color: #d7d7d7;
  font-size: 15px;
}

.grid {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 20px;
}

.panel {
  background: #131313;
  padding: 20px;
  border-radius: 15px;
  border: 1px solid #2a2a2a;
  margin-bottom: 16px;
}

.label {
  color: #888;
  font-size: 12px;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.value {
  font-size: 20px;
  font-weight: bold;
  word-break: break-all;
}

.token {
  font-size: 34px;
  letter-spacing: 2px;
}

.buttons {
  margin-top: 15px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

button {
  flex: 1;
  min-width: 120px;
  padding: 12px;
  border: none;
  border-radius: 10px;
  background: #2b2b2b;
  color: white;
  cursor: pointer;
  font-size: 14px;
}

button:hover {
  background: #3a3a3a;
}

.qr-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.qr {
  background: white;
  padding: 14px;
  border-radius: 14px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.qr img {
  width: 200px;
  height: 200px;
}

.qr-url {
  font-size: 13px;
  color: #aaa;
  text-align: center;
  word-break: break-word;
  max-width: 220px;
}

.small {
  margin-top: 12px;
  color: #bdbdbd;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}

@media (max-width: 760px) {
  .card {
    margin: 16px;
    padding: 22px;
  }

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
  <div class="status">Server Working</div>
  <h1>Remoter Admin</h1>
  <p class="subtitle">
    Open the remote page on your phone or tablet. QR opens the page with the token included.
  </p>

  <div class="connection" id="connStatus">Loading...</div>

  <div class="grid">
    <div>
      <div class="panel">
        <div class="label">Connection URL</div>
        <div class="value" id="url">Loading...</div>
      </div>

      <div class="panel">
        <div class="label">Session Token</div>
        <div class="value token" id="token">------</div>
      </div>

      <div class="buttons">
        <button onclick="copyValue('url')">Copy URL</button>
        <button onclick="copyValue('token')">Copy Token</button>
        <button onclick="openRemotePage()">Open Remote Page</button>
      </div>
    </div>

    <div class="qr-panel">
      <div class="label">QR Code</div>
      <div class="qr-wrapper">
        <div class="qr">
          <img id="qr" />
        </div>
        <div class="qr-url" id="qrUrlText"></div>
      </div>
      <div class="small" id="qrUrlText"></div>
    </div>
  </div>
</div>

<script>
let remoteUrlCache = "";

async function load() {
  try {
    const res = await fetch("/api/server-info");
    const data = await res.json();

    remoteUrlCache = data.remoteUrl;

    document.getElementById("url").textContent = data.remoteUrl;
    document.getElementById("token").textContent = data.token;
    document.getElementById("qr").src = data.qrDataUrl;
    document.getElementById("qrUrlText").textContent = data.qrConnectUrl;

    document.getElementById("connStatus").textContent =
      data.connectedClients > 0
        ? data.connectedClients + " device connected"
        : "Waiting for connection";
  } catch (err) {
    document.getElementById("connStatus").textContent = "Failed to load server info";
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

load();
setInterval(load, 2000);
</script>
</body>
</html>
`;
}

io.on("connection", (socket) => {
  socket.data.authenticated = false;

  socket.on("authenticate", (token) => {
    if (token !== SESSION_TOKEN) {
      socket.emit("auth_error", "Invalid token");
      socket.disconnect();
      return;
    }

    socket.data.authenticated = true;
    connectedClients++;
    socket.emit("auth_ok");
  });

  socket.on("remote_command", async (payload) => {
    if (!socket.data.authenticated) return;

    try {
      await handleCommand(payload);
    } catch (err) {
      console.error(err.message);
    }
  });

  socket.on("disconnect", () => {
    if (socket.data.authenticated) {
      connectedClients = Math.max(0, connectedClients - 1);
    }
  });
});

async function startServer() {
  const addresses = getLocalIPv4Addresses();
  const bestIP = pickBestAddress(addresses);

  const remoteUrl = `http://${bestIP.address}:${PORT}`;
  const qrConnectUrl = `${remoteUrl}/?token=${SESSION_TOKEN}`;
  const adminUrl = `http://localhost:${PORT}/admin`;
  const qrDataUrl = await QRCode.toDataURL(qrConnectUrl);

  app.get("/api/server-info", (req, res) => {
    res.json({
      remoteUrl,
      qrConnectUrl,
      token: SESSION_TOKEN,
      connectedClients,
      qrDataUrl,
    });
  });

  app.get("/admin", (req, res) => {
    res.send(buildAdminHtml());
  });

  const distPath = resolveDistPath();

  app.use(express.static(distPath));

  app.use((req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  server.listen(PORT, "0.0.0.0", async () => {
    console.log("Remoter started");
    console.log("URL:", remoteUrl);
    console.log("Token:", SESSION_TOKEN);

    await open(adminUrl);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});