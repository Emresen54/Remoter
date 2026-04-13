# Remoter

Remoter is a lightweight remote control tool that allows you to control your PC from your phone, tablet, or another device via a browser.

## Features

- Touchpad-style mouse control
- Left / Right click support
- Two-finger scrolling
- Keyboard input (text + special keys)
- Fast text input via clipboard
- Token-based authentication
- Dynamic session token (changes on each start)
- Automatic local IP detection
- QR code connection
- Built-in admin panel
- Single-port architecture (no separate frontend server)

## How it works

1. Start the server on your PC
2. A browser window opens automatically (admin panel)
3. Scan the QR code or open the URL on your phone/tablet
4. Enter the session token
5. Control your PC remotely

## Tech Stack

- Node.js (server)
- Express
- Socket.IO (real-time communication)
- React (frontend)
- QRCode (connection sharing)

## Notes

- Works over local network (same Wi-Fi)
- Each session generates a new access token
- No installation required for client devices (browser-based)

## Status

V2 – Stable local remote control with admin UI and QR connection
