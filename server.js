const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const fs = require("fs");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const SEATS_FILE = "seats.json";

// 初期座席ファイルの用意
if (!fs.existsSync(SEATS_FILE)) {
  const initialSeats = Array(40).fill(null); // 0〜39番
  fs.writeFileSync(SEATS_FILE, JSON.stringify(initialSeats, null, 2));
}

// 座席データの読み書き
const readSeats = () => JSON.parse(fs.readFileSync(SEATS_FILE));
const writeSeats = (data) => fs.writeFileSync(SEATS_FILE, JSON.stringify(data, null, 2));

// WebSocket接続
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "seats", data: readSeats() }));

  ws.on("message", (message) => {
    const { type, seatIndex, name, number } = JSON.parse(message);

    if (type === "update") {
      const seats = readSeats();
      seats[seatIndex] = { name, number };
      writeSeats(seats);

      // 全クライアントに送信
      const payload = JSON.stringify({ type: "seats", data: seats });
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    }
  });
});

app.get("/seats", (req, res) => {
  res.json(readSeats());
});

app.post("/reset", (req, res) => {
  const newSeats = Array(40).fill(null);
  writeSeats(newSeats);

  const payload = JSON.stringify({ type: "seats", data: newSeats });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });

  res.json({ success: true });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
