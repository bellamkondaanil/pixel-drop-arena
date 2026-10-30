# PIXEL DROP — Mini Battle Royale (rebuilt)

A small multiplayer top-down arena built with React, TypeScript, Canvas, Node.js and Socket.IO.

## Run locally

### Requirements
- Node.js 20+ and npm
- Visual Studio Code

### Steps to run in VS Code

1. Open the project folder in Visual Studio Code.
2. Open **Terminal → New Terminal**.
3. Run the following commands one by one:

```bash
cd C:\Users\Mahendramahe\Downloads\PIXEL-DROP-GITHUB-ROOT
node -v
npm -v
npm install
npm run dev
```

4. Open `http://localhost:5173` in your browser.
5. Open the game in two browser windows. Create a room in one window and join using the four-character room code in the other.

## Production build and test

Run these commands in the VS Code terminal:

```bash
npm run build
npm start
```

Open `http://localhost:3000` in your browser.

## Deploy on Render

This repository includes `render.yaml`. Push the complete project to GitHub, then in Render choose **New + → Blueprint** and select the repository. Keep the service on the Free plan.

- **Build:** `npm install && npm run build`
- **Start:** `npm start`
- **Health check:** `/health`
- **Node:** `22`

The server serves the React build and Socket.IO from the same HTTP server. The client connects to the same origin, avoiding a hard-coded localhost or a separate WebSocket host.

## Controls

- **WASD or arrow keys:** Move
- **Mouse:** Aim
- **Click or Space:** Shoot
- **Share the room code:** Invite another player

This is a compact starter implementation. It includes server-authoritative movement, basic shooting, health, a shrinking zone, room codes, and rematch. It is not a production anti-cheat or matchmaking system.
