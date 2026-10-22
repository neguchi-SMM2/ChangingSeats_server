const express = require("express");
const { json } = require("express/lib/response");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let seatsByClass = {}; 
const requestQueues = {}; 
const processingFlags = {}; 
let wani = false;

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

function getRandomNullIndex(list) {
  const nullIndices = list
    .map((v, i) => v === null ? i : -1)
    .filter(i => i !== -1);
  if (nullIndices.length === 0) return undefined;
  const randomIndex = Math.floor(Math.random() * nullIndices.length);
  return nullIndices[randomIndex];
}

function getRandomNullIndexExcluding(list, excludedIndex = null) {
  const nullIndices = list
    .map((v, i) => (v === null && i !== excludedIndex) ? i : -1)
    .filter(i => i !== -1);
  if (nullIndices.length === 0) return undefined;
  const randomIndex = Math.floor(Math.random() * nullIndices.length);
  return nullIndices[randomIndex];
}

function getRandomNullIndexInRange(list, start = 0, end = 17) {
  const nullIndices = [];
  for (let i = start; i <= end; i++) {
    if (list[i] === null) {
      nullIndices.push(i);
    }
  }
  if (nullIndices.length === 0) return undefined;
  const randomIndex = Math.floor(Math.random() * nullIndices.length);
  return nullIndices[randomIndex];
}

function getRandomNullIndexInRangeExcluding(list, start = 0, end = 17, excludedIndex = null) {
  const nullIndices = [];
  for (let i = start; i <= end; i++) {
    if (list[i] === null && i !== excludedIndex) {
      nullIndices.push(i);
    }
  }
  if (nullIndices.length === 0) return undefined;
  const randomIndex = Math.floor(Math.random() * nullIndices.length);
  return nullIndices[randomIndex];
}

function isSeat2ReservedForWani(seats, name) {
  if (!wani) return false;
  if (name === "わーにー") return false;
  return !seats.every((seat, index) => index === 2 || seat !== null);
}

function enqueueRequest(className, ws, data) {
  if (!requestQueues[className]) requestQueues[className] = [];
  requestQueues[className].push({ ws, data });

  if (!processingFlags[className]) {
    processNextRequest(className);
  }
}

function processNextRequest(className) {
  const queue = requestQueues[className];
  if (!queue || queue.length === 0) {
    processingFlags[className] = false;
    return;
  }

  processingFlags[className] = true;
  const { ws, data } = queue.shift();

  const seats = getSeats(className);
  let index = data.type === "random_front"
    ? getRandomNullIndexInRange(seats)
    : getRandomNullIndex(seats);

  if (wani && data.name === "わーにー" && (data.type === "random" || data.type === "random_front")) {
    index = 2;
  } else if (wani && data.name !== "わーにー" && index === 2) {
    const allOtherSeatsFilled = seats.every((seat, seatIndex) => seatIndex === 2 || seat !== null);
    if (!allOtherSeatsFilled) {
      index = data.type === "random_front"
        ? getRandomNullIndexInRangeExcluding(seats, 0, 17, 2)
        : getRandomNullIndexExcluding(seats, 2);
    }
  }

  if (typeof index === "number" && data.name && !seats[index] && !seats.includes(data.name)) {
    seats[index] = data.name;
    broadcast({ seat: index, name: data.name, className });
    console.log(`${data.name} was set in seat number ${index}. className: ${className}`);
  }

  setTimeout(() => processNextRequest(className), 0);
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
        console.log(`received getSeats. className: ${className}`);
      } else if (data.type === "reset") {
        seatsByClass[className] = Array(42).fill(null);
        broadcast({ type: "reset", className });
        console.log(`reset seats. className: ${className}`);
      } else if (data.type === "wani") {
        wani = true;
        console.log(`ワニシステム作動中(解除不可)`);
      } else if (data.type === "delete") {
        seats[data.seat] = null;
        broadcast({ delete: data.seat, className });
        console.log(`deleted seat number ${data.seat} data. className: ${className}`);
      } else if (data.type === "random" || data.type === "random_front") {
        if (wani && data.name === "わーにー") {
          if (!seats[2] && !seats.includes(data.name)) {
            seats[2] = data.name;
            broadcast({ seat: 2, name: data.name, className });
            console.log(`wani override: ${data.name} was set in seat number 2. className: ${className}`);
          }
          return;
        }

        enqueueRequest(className, ws, data);
      } else if (data.type === "all_set") {
        seatsByClass[className] = data.name;
        broadcast({ type: "seats", data: data.name, className });
        console.log(`${className} was set.`);
      } else if (typeof data.seat === "number" && data.name) {
        if (wani && data.seat === 2 && data.name !== "わーにー" && !seats.every((seat, index) => index === 2 || seat !== null)) {
          console.log(`wani blocked: ${data.name} cannot sit in seat 2 while other seats still have room. className: ${className}`);
          return;
        }

        if (!seats[data.seat]) {
          seats[data.seat] = data.name;
          broadcast({ seat: data.seat, name: data.name, className });
          console.log(`${data.name} was set in seat number ${data.seat}. className: ${className}`);
        }
      } else {
        console.log(`${data.type} is unknown datatype.`);
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
