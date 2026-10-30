import express from "express";
import { createServer } from "node:http";
import { Server, Socket } from "socket.io";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Player = { id: string; name: string; x: number; y: number; hp: number; color: string; alive: boolean; kills: number; angle: number; inputX: number; inputY: number };
type Bullet = { id: string; x: number; y: number; vx: number; vy: number; owner: string; life: number };
type Room = { code: string; players: Map<string, Player>; bullets: Bullet[]; phase: "waiting" | "playing" | "finished"; winner: string | null; zone: { x: number; y: number; radius: number }; startedAt: number };
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: "/socket.io",
  cors: { origin: true, methods: ["GET", "POST"] },
  transports: ["websocket", "polling"]
});
const PORT = Number(process.env.PORT || 3000);
const WORLD = 900;
const COLORS = ["#ff5d73", "#56c7ff", "#ffd166", "#a78bfa", "#66d19e", "#ff9f43", "#f472d0", "#a3e635"];
const rooms = new Map<string, Room>();
const playerRoom = new Map<string, string>();
const randomCode = () => randomBytes(2).toString("hex").toUpperCase();
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function publicState(room: Room) {
  return {
    roomCode: room.code,
    players: [...room.players.values()].map(({ inputX, inputY, ...p }) => p),
    bullets: room.bullets.map(({ life, ...b }) => b),
    zone: room.zone,
    phase: room.phase,
    winner: room.winner
  };
}
function broadcast(room: Room) { io.to(room.code).emit("game-state", publicState(room)); }
function makePlayer(socket: Socket, name: string, index: number): Player {
  const angle = index / 8 * Math.PI * 2;
  return {
    id: socket.id, name: (name || "Player").slice(0, 16), x: 450 + Math.cos(angle) * 230,
    y: 450 + Math.sin(angle) * 230, hp: 100, color: COLORS[index % COLORS.length],
    alive: true, kills: 0, angle: 0, inputX: 0, inputY: 0
  };
}
function removePlayer(socket: Socket) {
  const code = playerRoom.get(socket.id);
  if (!code) return;
  const room = rooms.get(code);
  playerRoom.delete(socket.id);
  socket.leave(code);
  if (!room) return;
  room.players.delete(socket.id);
  if (room.players.size === 0) rooms.delete(code);
  else {
    if (room.phase === "playing" && [...room.players.values()].filter(p => p.alive).length <= 1) finish(room);
    broadcast(room);
  }
}
function finish(room: Room) {
  room.phase = "finished";
  room.winner = [...room.players.values()].find(p => p.alive)?.name ?? null;
  broadcast(room);
}

app.get("/health", (_req, res) => res.status(200).json({ ok: true, service: "pixel-drop-arena" }));
app.get("/api/health", (_req, res) => res.json({ ok: true }));
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, "../../dist/client");
app.use(express.static(clientDist));
app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));

io.on("connection", (socket: Socket) => {
  socket.emit("server-ready", { id: socket.id });
  socket.on("create-room", ({ name }: { name?: string } = {}) => {
    removePlayer(socket);
    let code = randomCode();
    while (rooms.has(code)) code = randomCode();
    const room: Room = { code, players: new Map(), bullets: [], phase: "waiting", winner: null, zone: { x: 450, y: 450, radius: 420 }, startedAt: 0 };
    room.players.set(socket.id, makePlayer(socket, name || "Player", 0));
    rooms.set(code, room); playerRoom.set(socket.id, code); socket.join(code);
    socket.emit("room-joined", { roomCode: code }); broadcast(room);
  });
  socket.on("join-room", ({ roomCode, name }: { roomCode?: string; name?: string } = {}) => {
    const code = (roomCode || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) { socket.emit("game-error", "Room not found. Ask the host to create a new room."); return; }
    if (room.players.size >= 8) { socket.emit("game-error", "This room is full (8 players maximum)."); return; }
    if (room.phase !== "waiting") { socket.emit("game-error", "This match has already started."); return; }
    removePlayer(socket);
    room.players.set(socket.id, makePlayer(socket, name || "Player", room.players.size));
    playerRoom.set(socket.id, code); socket.join(code);
    if (room.players.size >= 2) { room.phase = "playing"; room.startedAt = Date.now(); }
    socket.emit("room-joined", { roomCode: code }); broadcast(room);
  });
  socket.on("move", ({ x, y }: { x?: number; y?: number } = {}) => {
    const code = playerRoom.get(socket.id); const room = code ? rooms.get(code) : undefined;
    const p = room?.players.get(socket.id);
    if (!p || !p.alive || room?.phase !== "playing") return;
    p.inputX = clamp(Number(x) || 0, -1, 1); p.inputY = clamp(Number(y) || 0, -1, 1);
  });
  socket.on("shoot", ({ angle }: { angle?: number } = {}) => {
    const code = playerRoom.get(socket.id); const room = code ? rooms.get(code) : undefined;
    const p = room?.players.get(socket.id);
    if (!p || !p.alive || room?.phase !== "playing" || room.bullets.filter(b => b.owner === socket.id).length >= 5) return;
    const a = Number(angle) || 0; p.angle = a;
    room.bullets.push({ id: randomBytes(6).toString("hex"), x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22, vx: Math.cos(a) * 10, vy: Math.sin(a) * 10, owner: socket.id, life: 75 });
  });
  socket.on("rematch", () => {
    const code = playerRoom.get(socket.id); const room = code ? rooms.get(code) : undefined;
    if (!room || room.phase !== "finished") return;
    let i = 0;
    for (const p of room.players.values()) {
      const angle = i++ / Math.max(1, room.players.size) * Math.PI * 2;
      p.x = 450 + Math.cos(angle) * 230; p.y = 450 + Math.sin(angle) * 230;
      p.hp = 100; p.alive = true; p.kills = 0; p.inputX = 0; p.inputY = 0;
    }
    room.bullets = []; room.phase = room.players.size >= 2 ? "playing" : "waiting";
    room.winner = null; room.zone.radius = 420; room.startedAt = Date.now(); broadcast(room);
  });
  socket.on("leave-room", () => removePlayer(socket));
  socket.on("disconnect", () => removePlayer(socket));
});

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.phase !== "playing") continue;
    const elapsed = (Date.now() - room.startedAt) / 1000;
    room.zone.radius = Math.max(115, 420 - Math.max(0, elapsed - 15) * 2.5);
    for (const p of room.players.values()) {
      if (!p.alive) continue;
      const length = Math.hypot(p.inputX, p.inputY) || 1;
      p.x = clamp(p.x + p.inputX / length * 4.2, 20, WORLD - 20);
      p.y = clamp(p.y + p.inputY / length * 4.2, 20, WORLD - 20);
      if (Math.hypot(p.x - room.zone.x, p.y - room.zone.y) > room.zone.radius) p.hp -= 0.25;
      if (p.hp <= 0) p.alive = false;
    }
    for (const b of room.bullets) {
      b.x += b.vx; b.y += b.vy; b.life--;
      for (const p of room.players.values()) {
        if (!p.alive || p.id === b.owner) continue;
        if (Math.hypot(p.x - b.x, p.y - b.y) < 21) {
          p.hp -= 25; b.life = 0;
          if (p.hp <= 0) {
            p.alive = false;
            const killer = room.players.get(b.owner);
            if (killer) killer.kills++;
          }
          break;
        }
      }
    }
    room.bullets = room.bullets.filter(b => b.life > 0 && b.x >= 0 && b.x <= WORLD && b.y >= 0 && b.y <= WORLD);
    if ([...room.players.values()].filter(p => p.alive).length <= 1) finish(room);
    else broadcast(room);
  }
}, 50);

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`PIXEL DROP server listening on ${PORT}`);
  console.log("Socket.IO ready at /socket.io");
});
