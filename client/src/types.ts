export type Player = {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  color: string;
  alive: boolean;
  kills: number;
  angle: number;
};
export type Bullet = { id: string; x: number; y: number; vx: number; vy: number; owner: string };
export type GameState = {
  roomCode: string;
  players: Player[];
  bullets: Bullet[];
  zone: { x: number; y: number; radius: number };
  phase: "waiting" | "playing" | "finished";
  winner: string | null;
};
