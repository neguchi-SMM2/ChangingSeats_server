const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let seats = Array(42).fill(null);

// クライアントに座席データ送信
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// WebSocket処理
wss.on("connection", (ws) => {
  // 初期座席を送る
  ws.send(JSON.stringify({ type: "seats", data: seats }));

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "getSeats") {
        ws.send(JSON.stringify({ type: "seats", data: seats }));
      } else if (data.type === "reset") {
        seats = Array(42).fill(null);
        broadcast({ type: "reset" });
      } else if (data.type === "delete") {
        seats[data.seat] = null;
        broadcast({ delete: data.seat });
      } else if (typeof data.seat === "number" && data.name) {
        if (!seats[data.seat]) {
          seats[data.seat] = data.name;
          broadcast({ seat: data.seat, name: data.name });
        }
      }
    } catch (err) {
      console.error("Invalid message:", err);
    }
  });
});

// サーバー起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
