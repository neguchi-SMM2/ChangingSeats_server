const express = require("express");
const fs = require("fs");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const DATA_FILE = "seats.json";

// seats.json が存在しない場合は初期化
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(Array(42).fill(null)));
}

// JSON 読み込み
function getSeats() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

// JSON 書き込み
function saveSeats(seats) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(seats));
}

// ミドルウェア
app.use(express.json());
app.use(express.static("public"));

// 全座席取得
app.get("/seats", (req, res) => {
  res.json(getSeats());
});

// 座席登録
app.post("/register", (req, res) => {
  const { seat, name, studentId } = req.body;
  const seats = getSeats();

  if (seats[seat]) return res.status(400).json({ error: "すでに登録済みです" });

  seats[seat] = name;
  saveSeats(seats);
  broadcast({ seat, name });
  res.json({ ok: true });
});

// 全リセット
app.post("/reset", (req, res) => {
  const seats = Array(42).fill(null);
  saveSeats(seats);
  broadcast({ type: "reset" });
  res.json({ ok: true });
});

// 指定の席を削除（WebSocket 経由）
function handleDelete(seatIndex) {
  const seats = getSeats();
  seats[seatIndex] = null;
  saveSeats(seats);
  broadcast({ delete: seatIndex });
}

// WebSocket接続管理
wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      if (typeof data.delete === "number") {
        handleDelete(data.delete);
      }
    } catch (err) {
      console.error("Invalid WebSocket message:", err);
    }
  });
});

// ブロードキャスト送信
function broadcast(data) {
  const str = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(str);
    }
  });
}

// サーバー起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
