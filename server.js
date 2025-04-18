const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const express = require("express");
const http = require("http");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const DATA_FILE = path.join(__dirname, "seats.json");

// 初期化
if (!fs.existsSync(DATA_FILE)) {
  const empty = Array(40).fill(null);
  fs.writeFileSync(DATA_FILE, JSON.stringify(empty));
}

function loadSeats() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveSeats(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data));
}

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "init", data: loadSeats() }));

  ws.on("message", (msg) => {
    let parsed;
    try {
      parsed = JSON.parse(msg);
    } catch (e) {
      return;
    }

    if (parsed.type === "update") {
      const seats = loadSeats();
      seats[parsed.index] = parsed.data;
      saveSeats(seats);

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "update", index: parsed.index, data: parsed.data }));
        }
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
