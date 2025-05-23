const express = require("express");
const { json } = require("express/lib/response");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let seatsByClass = {}; 
let studentsName = {}; 
const requestQueues = {}; 
const processingFlags = {}; 

function getSeats(className) {
  if (!seatsByClass[className]) {
    seatsByClass[className] = Array(42).fill(null);
  }
  return seatsByClass[className];
}

function getStudentsName(className) {
  if (!studentsName[className]) {
    studentsName[className] = array(42).fill(null); 
  }
  return studentsName[className];
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
      const names = getStudentsName(className);

      if (data.type === "getSeats") {
        ws.send(JSON.stringify({ type: "seats", data: seats, className }));
        console.log(`received getSeats. className: ${className}`);
      } else if (data.type === "reset") {
        seatsByClass[className] = Array(42).fill(null);
        broadcast({ type: "reset", className });
        console.log(`reset seats. className: ${className}`);
      } else if (data.type === "delete") {
        seats[data.seat] = null;
        broadcast({ delete: data.seat, className });
        console.log(`deleted seat number ${data.seat} data. className: ${className}`);
      } else if (data.type === "random" || data.type === "random_front") {
        enqueueRequest(className, ws, data);
      } else if (typeof data.seat === "number" && data.name) {
        if (!seats[data.seat]) {
          seats[data.seat] = data.name;
          broadcast({ seat: data.seat, name: data.name, className });
          console.log(`${data.name} was set in seat number ${data.seat}. className: ${className}`);
        }
      } else if (data.type === "getStudentsName") {
        ws.send(JSON.stringify({ type: "names", data: names, className })); 
        console.log(`received getSeats. className: ${className}`); 
      } else if (data.type === "registerName") {
        if (!names[data.name]) {
          names[names.length] = data.name; 
          console.log(`${data.name} was registered in className ${className}`);
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
