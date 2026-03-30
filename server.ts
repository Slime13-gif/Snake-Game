import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("duckpond.db");
const JWT_SECRET = process.env.JWT_SECRET || "quack-secret-key";

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    high_score INTEGER DEFAULT 0,
    skins TEXT DEFAULT 'default'
  );
  
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    score INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

interface Player {
  id: string;
  name: string;
  color: string;
  skinId: string;
  head: { x: number, y: number };
  angle: number;
  score: number;
  isDead: boolean;
  isBoosting: boolean;
  trail: { x: number, y: number }[];
}

interface Lobby {
  id: number;
  name: string;
  allowGuest: boolean;
  hasBots: boolean;
  players: Map<string, Player>;
  bots: Player[];
}

const lobbies: Lobby[] = [
  { id: 1, name: "Genel Göl (Herkes)", allowGuest: true, hasBots: true, players: new Map(), bots: [] },
  { id: 2, name: "Hesaplı Göl (Botlu)", allowGuest: false, hasBots: true, players: new Map(), bots: [] },
  { id: 3, name: "Sadece İnsanlar", allowGuest: false, hasBots: false, players: new Map(), bots: [] },
];

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });
  const PORT = 3000;

  app.use(express.json());

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // API Routes
  app.post("/api/register", async (req, res) => {
    const { username, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
      const info = stmt.run(username, hashedPassword);
      res.status(201).json({ message: "User created", userId: info.lastInsertRowid });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(500).json({ error: "Server error" });
      }
    }
  });

  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username, highScore: user.high_score, skins: user.skins });
  });

  app.post("/api/scores", authenticateToken, (req: any, res) => {
    const { score } = req.body;
    const userId = req.user.id;

    db.prepare("INSERT INTO scores (user_id, score) VALUES (?, ?)").run(userId, score);

    const user = db.prepare("SELECT high_score FROM users WHERE id = ?").get(userId) as any;
    if (score > user.high_score) {
      db.prepare("UPDATE users SET high_score = ? WHERE id = ?").run(score, userId);
    }

    res.json({ success: true });
  });

  app.post("/api/skins", authenticateToken, (req: any, res) => {
    const { skins } = req.body;
    const userId = req.user.id;
    db.prepare("UPDATE users SET skins = ? WHERE id = ?").run(skins, userId);
    res.json({ success: true });
  });

  app.get("/api/leaderboard", (req, res) => {
    const leaderboard = db.prepare(`
      SELECT username as name, high_score as score 
      FROM users 
      ORDER BY high_score DESC 
      LIMIT 10
    `).all();
    res.json(leaderboard);
  });

  // Socket.io Logic
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join_lobby", ({ lobbyId, playerName, skinId, color, token }) => {
      const lobby = lobbies.find(l => l.id === lobbyId);
      if (!lobby) return socket.emit("error", "Lobi bulunamadı");

      // Check auth requirements
      if (!lobby.allowGuest && !token) {
        return socket.emit("error", "Bu lobiye girmek için hesap açmalısın");
      }

      // Join room
      socket.join(`lobby_${lobbyId}`);
      
      const player: Player = {
        id: socket.id,
        name: playerName,
        color: color,
        skinId: skinId,
        head: { x: 1500, y: 1500 }, // Default spawn
        angle: 0,
        score: 0,
        isDead: false,
        isBoosting: false,
        trail: []
      };

      lobby.players.set(socket.id, player);
      
      // Broadcast to others in lobby
      socket.to(`lobby_${lobbyId}`).emit("player_joined", player);
      
      // Send current state to player
      socket.emit("lobby_state", {
        players: Array.from(lobby.players.values()),
        bots: lobby.bots
      });
    });

    socket.on("update_player", ({ lobbyId, head, angle, score, isBoosting, trail }) => {
      const lobby = lobbies.find(l => l.id === lobbyId);
      if (!lobby) return;

      const player = lobby.players.get(socket.id);
      if (player) {
        player.head = head;
        player.angle = angle;
        player.score = score;
        player.isBoosting = isBoosting;
        player.trail = trail;

        // Broadcast update to others
        socket.to(`lobby_${lobbyId}`).emit("player_updated", player);
      }
    });

    socket.on("disconnect", () => {
      lobbies.forEach(lobby => {
        if (lobby.players.has(socket.id)) {
          lobby.players.delete(socket.id);
          io.to(`lobby_${lobby.id}`).emit("player_left", socket.id);
        }
      });
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
