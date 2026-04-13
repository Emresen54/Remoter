require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { handleCommand } = require("./inputController");

const app = express();
app.use(cors());

const server = http.createServer(app);

const PORT = Number(process.env.PORT || 3001);
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error("ACCESS_TOKEN missing in .env");
  process.exit(1);
}

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.get("/", (req, res) => {
  res.send("Remoter server is running");
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.data.authenticated = false;

  socket.on("authenticate", (token) => {
    if (typeof token !== "string") {
      socket.emit("auth_error", "Invalid token format");
      socket.disconnect();
      return;
    }

    if (token !== ACCESS_TOKEN) {
      socket.emit("auth_error", "Invalid token");
      socket.disconnect();
      return;
    }

    socket.data.authenticated = true;
    socket.emit("auth_ok");
    console.log("Client authenticated:", socket.id);
  });

  socket.on("remote_command", async (payload) => {
    if (!socket.data.authenticated) {
      return;
    }

    try {
      await handleCommand(payload);
    } catch (error) {
      console.error("Command error:", error.message);
      socket.emit("command_error", error.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Remoter server listening on port ${PORT}`);
});