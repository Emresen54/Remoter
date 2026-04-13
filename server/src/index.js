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

// Random 6 digit token
const SESSION_TOKEN = Math.floor(100000 + Math.random() * 900000).toString();

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

function buildAdminHtml({ remoteUrl, token, qrDataUrl }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Remoter</title>
</head>
<body style="font-family: Arial; text-align: center; padding: 40px; background: #111; color: white;">
  <h1>Remoter Server Running</h1>
  <p>Open this URL on your phone:</p>
  <h2>${remoteUrl}</h2>

  <p>Token:</p>
  <h1>${token}</h1>

  <img src="${qrDataUrl}" width="250" />

</body>
</html>
  `;
}

// Socket
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.data.authenticated = false;

  socket.on("authenticate", (token) => {
    if (token !== SESSION_TOKEN) {
      socket.emit("auth_error", "Invalid token");
      socket.disconnect();
      return;
    }

    socket.data.authenticated = true;
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
});

// Server start
async function startServer() {
  const addresses = getLocalIPv4Addresses();
  const bestIP = pickBestAddress(addresses);

  const remoteUrl = `http://${bestIP.address}:${PORT}`;
  const adminUrl = `http://localhost:${PORT}/admin`;

  const qrDataUrl = await QRCode.toDataURL(remoteUrl);

  // Admin page
  app.get("/admin", (req, res) => {
    res.send(
      buildAdminHtml({
        remoteUrl,
        token: SESSION_TOKEN,
        qrDataUrl,
      })
    );
  });

  // Frontend serve
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
    console.log("==================================");
    console.log("");

    await open(adminUrl);
  });
}

startServer();