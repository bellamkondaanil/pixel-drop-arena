import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { GameState } from "./types";

const WORLD = 900;
const COLORS = ["#ff5d73", "#56c7ff", "#ffd166", "#a78bfa", "#66d19e", "#ff9f43", "#f472d0", "#a3e635"];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const keys = useRef<Record<string, boolean>>({});
  const pointer = useRef({ x: WORLD / 2, y: WORLD / 2 });
  const stateRef = useRef<GameState | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomInput, setRoomInput] = useState(new URLSearchParams(location.search).get("room") || "");
  const [name, setName] = useState("Player");
  const [error, setError] = useState("");
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [mobileFire, setMobileFire] = useState(false);

  useEffect(() => {
    const socket = io({ transports: ["polling", "websocket"], reconnection: true, reconnectionAttempts: Infinity });
    socketRef.current = socket;
    socket.on("connect", () => { setConnected(true); setError(""); });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (err) => setError(`Connection problem: ${err.message}`));
    socket.on("game-state", (next: GameState) => { stateRef.current = next; setGame(next); });
    socket.on("game-error", (message: string) => setError(message));
    socket.on("room-joined", (payload: { roomCode: string }) => {
      setRoomInput(payload.roomCode);
      history.replaceState({}, "", `?room=${payload.roomCode}`);
      setScreen("game");
    });
    return () => { socket.disconnect(); };
  }, []);

  const createRoom = useCallback(() => {
    setError("");
    socketRef.current?.emit("create-room", { name: name.trim() || "Player" });
  }, [name]);
  const joinRoom = useCallback(() => {
    const code = roomInput.trim().toUpperCase();
    if (!code) { setError("Enter a room code first."); return; }
    setError("");
    socketRef.current?.emit("join-room", { roomCode: code, name: name.trim() || "Player" });
  }, [name, roomInput]);

  useEffect(() => {
    if (screen !== "game") return;
    const down = (e: KeyboardEvent) => {
      if (["w","a","s","d","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) e.preventDefault();
      keys.current[e.key.toLowerCase()] = true;
      if (e.key === " ") socketRef.current?.emit("shoot", { angle: aimAngle() });
    };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    const aimAngle = () => {
      const canvas = canvasRef.current;
      const me = stateRef.current?.players.find(p => p.id === socketRef.current?.id);
      if (!canvas || !me) return 0;
      const rect = canvas.getBoundingClientRect();
      const mx = (pointer.current.x - rect.left) / rect.width * WORLD;
      const my = (pointer.current.y - rect.top) / rect.height * WORLD;
      return Math.atan2(my - me.y, mx - me.x);
    };
    const mouseMove = (e: MouseEvent) => { pointer.current = { x: e.clientX, y: e.clientY }; };
    const click = () => socketRef.current?.emit("shoot", { angle: aimAngle() });
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("mousemove", mouseMove);
    canvasRef.current?.addEventListener("click", click);
    const timer = window.setInterval(() => {
      const k = keys.current;
      const x = Number(!!k.d || !!k.arrowright) - Number(!!k.a || !!k.arrowleft);
      const y = Number(!!k.s || !!k.arrowdown) - Number(!!k.w || !!k.arrowup);
      socketRef.current?.emit("move", { x, y });
    }, 50);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("mousemove", mouseMove);
      canvasRef.current?.removeEventListener("click", click);
    };
  }, [screen]);

  useEffect(() => {
    if (screen !== "game") return;
    let frame = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const s = stateRef.current;
      if (canvas && ctx && s) {
        const scale = canvas.width / WORLD;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#171c2b"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "rgba(255,255,255,.055)"; ctx.lineWidth = 1;
        for (let i = 0; i <= WORLD; i += 50) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, WORLD); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(WORLD, i); ctx.stroke();
        }
        ctx.save();
        ctx.fillStyle = "rgba(4,7,15,.56)";
        ctx.beginPath(); ctx.rect(0, 0, WORLD, WORLD); ctx.arc(s.zone.x, s.zone.y, s.zone.radius, 0, Math.PI * 2, true); ctx.fill("evenodd");
        ctx.strokeStyle = "#8ce6a1"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(s.zone.x, s.zone.y, s.zone.radius, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        for (const b of s.bullets) {
          ctx.fillStyle = "#ffe08a"; ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();
        }
        for (const p of s.players) {
          ctx.globalAlpha = p.alive ? 1 : .25;
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = p.id === socketRef.current?.id ? "#fff" : "#111"; ctx.lineWidth = p.id === socketRef.current?.id ? 4 : 2; ctx.stroke();
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.angle) * 27, p.y + Math.sin(p.angle) * 27); ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#fff"; ctx.font = "13px system-ui"; ctx.textAlign = "center"; ctx.fillText(p.name, p.x, p.y - 27);
          ctx.fillStyle = "#40232a"; ctx.fillRect(p.x - 19, p.y + 23, 38, 5);
          ctx.fillStyle = "#73e6a1"; ctx.fillRect(p.x - 19, p.y + 23, 38 * Math.max(0, p.hp) / 100, 5);
        }
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [screen]);

  const fire = () => socketRef.current?.emit("shoot", { angle: 0 });
  const leave = () => { socketRef.current?.emit("leave-room"); setScreen("home"); setGame(null); stateRef.current = null; history.replaceState({}, "", location.pathname); };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">✦</span><span>PIXEL <b>DROP</b></span></div>
        <div className={`connection ${connected ? "online" : "offline"}`}><i />{connected ? "SERVER CONNECTED" : "CONNECTING..."}</div>
      </header>
      {screen === "home" ? (
        <section className="hero">
          <div className="eyebrow">8 PLAYERS · ONE ARENA · LAST ONE STANDING</div>
          <h1>DROP IN.<br/><span>FIGHT TO SURVIVE.</span></h1>
          <p className="intro">A fast, retro-inspired multiplayer battle royale. Create a private arena and invite your friends.</p>
          <div className="panel lobby-panel">
            <label>YOUR CALLSIGN</label>
            <input value={name} maxLength={16} onChange={e => setName(e.target.value)} placeholder="Enter player name"/>
            <button className="primary" onClick={createRoom} disabled={!connected}>CREATE NEW ARENA</button>
            <div className="or"><span/> OR JOIN A FRIEND <span/></div>
            <div className="join-row"><input value={roomInput} maxLength={4} onChange={e => setRoomInput(e.target.value.toUpperCase())} placeholder="ROOM CODE"/><button onClick={joinRoom} disabled={!connected}>JOIN</button></div>
            {error && <p className="error">{error}</p>}
            <p className="fineprint">No account needed · 2–8 players · Free to play</p>
          </div>
          <div className="controls-note"><span>W A S D</span> MOVE <span>CLICK / SPACE</span> SHOOT <span>MOUSE</span> AIM</div>
        </section>
      ) : (
        <section className="game-layout">
          <div className="game-heading"><div><div className="eyebrow">PRIVATE ARENA</div><h2>ROOM {game?.roomCode || roomInput}</h2></div><button className="ghost" onClick={leave}>LEAVE ARENA</button></div>
          <div className="arena-wrap"><canvas ref={canvasRef} width={900} height={900} aria-label="Battle arena"/></div>
          <div className="game-footer">
            <span>{game?.phase === "waiting" ? "WAITING FOR PLAYERS..." : game?.phase === "finished" ? `WINNER: ${game.winner || "—"}` : "SURVIVE THE SHRINKING ZONE"}</span>
            <span>{game?.players.filter(p => p.alive).length || 0} PLAYERS ALIVE</span>
          </div>
          <div className="roster">{game?.players.map(p => <div className="roster-item" key={p.id}><i style={{background:p.color}}/><span>{p.name}</span><b>{p.kills} KILLS</b><small>{p.hp} HP</small></div>)}</div>
          <div className="mobile-controls"><button onTouchStart={()=>keys.current.w=true} onTouchEnd={()=>keys.current.w=false}>▲</button><button onTouchStart={()=>keys.current.a=true} onTouchEnd={()=>keys.current.a=false}>◀</button><button onTouchStart={()=>keys.current.s=true} onTouchEnd={()=>keys.current.s=false}>▼</button><button onTouchStart={()=>keys.current.d=true} onTouchEnd={()=>keys.current.d=false}>▶</button><button className="fire" onClick={()=>setMobileFire(!mobileFire)} onTouchStart={fire}>FIRE</button></div>
          {game?.phase === "waiting" && <p className="waiting-hint">Share the room code with friends. The match starts when at least two players join.</p>}
          {game?.phase === "finished" && <button className="primary" onClick={()=>socketRef.current?.emit("rematch")}>PLAY AGAIN</button>}
          {error && <p className="error">{error}</p>}
        </section>
      )}
      <footer>PIXEL DROP <span>•</span> BUILT FOR THE ARENA</footer>
    </main>
  );
}
