import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SERVER_URL = `http://${window.location.hostname}:3001`;
const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get("token") || "";

export default function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Unconnected");
  const [token, setToken] = useState(tokenFromUrl);
  const [text, setText] = useState("");
  const [lastSentText, setLastSentText] = useState("");

  const isTrackingRef = useRef(false);
  const gestureModeRef = useRef("move");
  const lastPointRef = useRef({ x: 0, y: 0 });
  const lastTwoFingerCenterRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  const connectToServer = (customToken) => {
    const finalToken = (customToken ?? token).trim();

    if (!finalToken) {
      setStatus("Token required");
      return;
    }

    if (socket) {
      socket.disconnect();
    }

    const newSocket = io(SERVER_URL, {
      autoConnect: true,
      transports: ["websocket"],
    });

    newSocket.on("connect", () => {
      setStatus("Connected to server, authenticating...");
      newSocket.emit("authenticate", finalToken);
    });

    newSocket.on("auth_ok", () => {
      setConnected(true);
      setStatus("Connected");
    });

    newSocket.on("auth_error", (msg) => {
      setConnected(false);
      setStatus(`Auth error: ${msg}`);
      newSocket.disconnect();
    });

    newSocket.on("disconnect", () => {
      setConnected(false);
      setStatus("Unconnected");
    });

    newSocket.on("command_error", (msg) => {
      setStatus(`Command error: ${msg}`);
    });

    setSocket(newSocket);
  };

  useEffect(() => {
    if (tokenFromUrl) {
      setStatus("Token detected in URL, connecting...");
      connectToServer(tokenFromUrl);
    }
  }, []);

  const disconnectFromServer = () => {
    if (socket) {
      socket.disconnect();
    }
    setConnected(false);
    setStatus("Unconnected");
  };

  const sendCommand = (type, data = {}) => {
    if (!socket || !connected) return;
    socket.emit("remote_command", { type, data });
  };

  const getTwoFingerCenter = (touches) => {
    const t1 = touches[0];
    const t2 = touches[1];

    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    };
  };

  const handlePointerDown = (e) => {
    if (!connected) return;

    isTrackingRef.current = true;
    gestureModeRef.current = "move";
    lastPointRef.current = {
      x: e.clientX,
      y: e.clientY,
    };
  };

  const handlePointerMove = (e) => {
    if (!connected) return;
    if (!isTrackingRef.current) return;
    if (gestureModeRef.current !== "move") return;

    const dx = e.clientX - lastPointRef.current.x;
    const dy = e.clientY - lastPointRef.current.y;

    lastPointRef.current = {
      x: e.clientX,
      y: e.clientY,
    };

    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      sendCommand("move", {
        dx: Math.round(dx),
        dy: Math.round(dy),
      });
    }
  };

  const handlePointerUp = () => {
    isTrackingRef.current = false;
    gestureModeRef.current = "move";
  };

  const handleTouchStart = (e) => {
    if (!connected) return;

    if (e.touches.length === 2) {
      gestureModeRef.current = "scroll";
      isTrackingRef.current = false;
      lastTwoFingerCenterRef.current = getTwoFingerCenter(e.touches);
    }
  };

  const handleTouchMove = (e) => {
    if (!connected) return;

    if (e.touches.length === 2) {
      e.preventDefault();

      gestureModeRef.current = "scroll";
      isTrackingRef.current = false;

      const currentCenter = getTwoFingerCenter(e.touches);
      const dy = currentCenter.y - lastTwoFingerCenterRef.current.y;

      lastTwoFingerCenterRef.current = currentCenter;

      if (Math.abs(dy) > 1) {
        sendCommand("scroll", {
          dy: Math.round(dy),
        });
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length === 0) {
      isTrackingRef.current = false;
      gestureModeRef.current = "move";
    } else if (e.touches.length === 1) {
      gestureModeRef.current = "move";
    }
  };

  const sendText = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    sendCommand("type_text", { text });
    setLastSentText(text);
    setText("");
  };

  const restoreLastText = () => {
    if (!lastSentText) return;
    setText(lastSentText);
  };

  const sendKey = (key) => {
    sendCommand("press_key", { key });
  };

  return (
    <div className="app">
      <div className="topbar">
        <h1>Remoter</h1>

        <div className="connection-box">
          <input
            type="password"
            placeholder="Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />

          {!connected ? (
            <button onClick={() => connectToServer()}>Connect</button>
          ) : (
            <button onClick={disconnectFromServer}>Disconnect</button>
          )}
        </div>

        <div className={`status ${connected ? "connected" : "unconnected"}`}>
          {status}
        </div>
      </div>

      <div className={`layout ${!connected ? "disabled" : ""}`}>
        <section className="keyboard-panel">
          <h2>Keyboard</h2>

          <textarea
            className="text-input"
            placeholder={connected ? "Text senden..." : "Not connected"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!connected}
          />

          <div className="text-actions">
            <button className="send-btn" onClick={sendText} disabled={!connected}>
              Send Text
            </button>

            <button
              className="restore-btn"
              onClick={restoreLastText}
              disabled={!connected || !lastSentText}
            >
              Restore Last Text
            </button>
          </div>

          <div className="key-grid">
            <button onClick={() => sendKey("enter")} disabled={!connected}>
              Enter
            </button>
            <button onClick={() => sendKey("backspace")} disabled={!connected}>
              Backspace
            </button>
            <button onClick={() => sendKey("space")} disabled={!connected}>
              Space
            </button>
            <button onClick={() => sendKey("tab")} disabled={!connected}>
              Tab
            </button>
            <button onClick={() => sendKey("escape")} disabled={!connected}>
              Esc
            </button>
          </div>
        </section>

        <section className="mouse-panel">
          <h2>Mouse</h2>

          <div className="click-row">
            <button
              className="click-btn left"
              onClick={() => sendCommand("left_click")}
              disabled={!connected}
            >
              Left
            </button>

            <button
              className="click-btn right"
              onClick={() => sendCommand("right_click")}
              disabled={!connected}
            >
              Right
            </button>
          </div>

          <div
            className="touchpad"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {connected ? "Touchpad / 2-Finger Scroll" : "Not connected"}
          </div>
        </section>
      </div>
    </div>
  );
}