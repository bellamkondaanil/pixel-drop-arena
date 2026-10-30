# PIXEL DROP — Mini Battle Royale (rebuilt)

A small multiplayer top-down arena built with React, TypeScript, Canvas, Node.js and Socket.IO.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in two browser windows. Create a room in one window and join with the four-character code in the other.

Production test:

```bash
npm run typecheck
npm run build
npm start
```

Open `http://localhost:3000`.

## Deploy on Render

This repository includes `render.yaml`. Push the complete project to GitHub, then in Render choose **New + → Blueprint** and select the repository. Keep the service on the Free plan.

Build: `npm install && npm run build`
Start: `npm start`
Health check: `/health`
Node: `22`

The server serves the React build and Socket.IO from the same HTTP server. The client connects to the same origin, avoiding a hard-coded localhost or a separate WebSocket host.

## Controls

- WASD or arrow keys: move
- Mouse: aim
- Click or Space: shoot
- Share the room code to invite another player

This is a compact starter implementation. It includes server-authoritative movement, basic shooting, health, a shrinking zone, room codes, and rematch. It is not a production anti-cheat or matchmaking system.
