const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let seatsByClass = {}; // className => [seat array]

function getSeats(className) {
  if (!seatsByClass[className]) {
    seatsByClass[className] = Array(42).fill(null);
  }
  return seatsByClass[className];
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      const className = data.className;
      if (!className) return;

      const seats = getSeats(className);

      if (data.type === "getSeats") {
        ws.send(JSON.stringify({ type: "seats", data: seats, className }));
      } else if (data.type === "reset") {
        seatsByClass[className] = Array(42).fill(null);
        broadcast({ type: "reset", className });
      } else if (data.type === "delete") {
        seats[data.seat] = null;
        broadcast({ delete: data.seat, className });
      } else if (typeof data.seat === "number" && data.name) {
        if (!seats[data.seat]) {
          seats[data.seat] = data.name;
          broadcast({ seat: data.seat, name: data.name, className });
        }
      }
    } catch (err) {
      console.error("Invalid message:", err);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
