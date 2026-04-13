# Remoter

Remoter is a lightweight remote control tool that lets you control your PC from your phone, tablet, or another device using a browser.

## Features

- Touchpad-style mouse control
- Left / Right click support
- Two-finger scrolling
- Keyboard input (text + special keys)
- Fast text input via clipboard
- Clear-after-send text behavior
- Restore last sent text
- Token-based authentication
- Dynamic session token (changes on each start)
- Automatic local IP detection
- QR code connection
- QR auto-connect (token included in URL)
- Built-in admin dashboard
- Live connection status (connected devices)
- Copy URL / Copy Token buttons
- Single-port architecture (no separate frontend server)

## How it works

1. Start the server on your PC
2. Admin page opens automatically
3. Scan the QR code OR open the URL manually
4. If opened via QR → connects automatically
5. If opened manually → enter token
6. Control your PC remotely

## Tech Stack

- Node.js (server)
- Express
- Socket.IO
- React
- QRCode

## Notes

- Works over local network (same Wi-Fi)
- Each session generates a new token
- QR code contains the token for faster connection
- No installation required for client devices

## Status

V4 – Stable version with QR auto-connect, admin UI, and improved UX
