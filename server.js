const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const SEAT_COUNT = 42;
const FRONT_END = 17;          // random_front の範囲 (0〜17)
const LAST_SEAT = 2;           // 他が全部埋まるまで使えない席
const KANI_NUM = 16;
const KANI_SEAT = 34;
const WANI_NUM = 39;
const WANI_SEAT = 40;

const seatsByClass = Object.create(null);
const numsByClass = Object.create(null);
const requestQueues = Object.create(null);
const processingFlags = Object.create(null);
let wani = false;
let kani = false;

function getSeats(className) {
  if (!seatsByClass[className]) {
    seatsByClass[className] = Array(SEAT_COUNT).fill(null);
  }
  return seatsByClass[className];
}

function getNums(className) {
  if (!numsByClass[className]) {
    numsByClass[className] = Array(SEAT_COUNT).fill(null);
  }
  return numsByClass[className];
}

function normalizeNum(num) {
  if (typeof num === "number") return num;
  if (typeof num === "string" && num.trim() !== "") {
    const converted = Number(num);
    if (Number.isFinite(converted)) return converted;
  }
  return num;
}

function isValidNum(num) {
  return Number.isInteger(num) && num >= 1 && num <= 40;
}

function isValidSeat(seat) {
  return Number.isInteger(seat) && seat >= 0 && seat < SEAT_COUNT;
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// 空席(null)からランダムに1つ選ぶ。範囲指定・除外席指定に対応
function pickRandomEmpty(list, { start = 0, end = list.length - 1, exclude = null } = {}) {
  const candidates = [];
  for (let i = start; i <= end; i++) {
    if (list[i] === null && i !== exclude) candidates.push(i);
  }
  if (candidates.length === 0) return undefined;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function allOtherSeatsAreFilled(seats) {
  return seats.every((seat, index) => index === LAST_SEAT || seat !== null);
}

function chooseSeat(seats, data) {
  if (kani && data.num === KANI_NUM && seats[KANI_SEAT] === null) return KANI_SEAT;
  if (wani && data.num === WANI_NUM && seats[WANI_SEAT] === null) return WANI_SEAT;

  const options = {};
  if (data.type === "random_front") options.end = FRONT_END;
  if (wani && !allOtherSeatsAreFilled(seats)) options.exclude = LAST_SEAT;
  return pickRandomEmpty(seats, options);
}

function enqueueRequest(className, data) {
  if (!requestQueues[className]) requestQueues[className] = [];
  requestQueues[className].push({ data });

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
  const { data } = queue.shift();

  try {
    const seats = getSeats(className);
    const nums = getNums(className);
    const index = chooseSeat(seats, data);

    if (
      typeof index === "number" &&
      typeof data.name === "string" && data.name &&
      seats[index] === null &&
      !seats.includes(data.name)
    ) {
      seats[index] = data.name;
      if (isValidNum(data.num)) {
        nums[index] = data.num;
      }
      broadcast({ seat: index, name: data.name, className });
      console.log(`${data.name} was set in seat number ${index}. className: ${className}`);
    }
  } catch (err) {
    console.error("Failed to process request:", err);
  }

  // 例外が起きても必ず次へ進む
  setTimeout(() => processNextRequest(className), 0);
}

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      const className = data && data.className;
      if (typeof className !== "string" || className === "") return;

      data.num = normalizeNum(data.num);

      const seats = getSeats(className);
      const nums = getNums(className);

      if (data.type === "getSeats") {
        ws.send(JSON.stringify({ type: "seats", data: seats, className }));
        console.log(`received getSeats. className: ${className}`);
      } else if (data.type === "exist") {
        const assignedNums = new Set(nums.filter(isValidNum));
        const unassignedNums = Array.from({ length: 40 }, (_, index) => index + 1)
          .filter(num => !assignedNums.has(num));
        ws.send(JSON.stringify({ type: "exist", data: unassignedNums, className }));
        console.log(`received exist. className: ${className}`);
      } else if (data.type === "reset") {
        seatsByClass[className] = Array(SEAT_COUNT).fill(null);
        numsByClass[className] = Array(SEAT_COUNT).fill(null);
        requestQueues[className] = [];
        broadcast({ type: "reset", className });
        console.log(`reset seats. className: ${className}`);
      } else if (data.type === "wani") {
        wani = true;
      } else if (data.type === "kantaro") {
        kani = true;
      } else if (data.type === "delete") {
        if (!isValidSeat(data.seat)) return;
        seats[data.seat] = null;
        nums[data.seat] = null;
        broadcast({ delete: data.seat, className });
        console.log(`deleted seat number ${data.seat} data. className: ${className}`);
      } else if (data.type === "random" || data.type === "random_front") {
        // kani / wani の特別処理は chooseSeat 内でキュー経由で行う
        enqueueRequest(className, data);
      } else if (data.type === "all_set") {
        if (!Array.isArray(data.name)) return;
        const normalized = Array.from({ length: SEAT_COUNT }, (_, i) => {
          const v = data.name[i];
          return typeof v === "string" && v !== "" ? v : null;
        });
        seatsByClass[className] = normalized;
        numsByClass[className] = Array(SEAT_COUNT).fill(null);
        broadcast({ type: "seats", data: normalized, className });
        console.log(`${className} was set.`);
      } else if (isValidSeat(data.seat) && typeof data.name === "string" && data.name) {
        if (kani && data.num === KANI_NUM && data.seat !== KANI_SEAT) {
          console.log(`kantaro blocked: ${data.name} must sit in seat ${KANI_SEAT}. className: ${className}`);
          return;
        }
        if (wani && data.seat === LAST_SEAT && !allOtherSeatsAreFilled(seats)) {
          console.log(`wani blocked: ${data.name} cannot sit in seat ${LAST_SEAT} while other seats still have room. className: ${className}`);
          return;
        }

        if (seats[data.seat] === null) {
          seats[data.seat] = data.name;
          if (isValidNum(data.num)) {
            nums[data.seat] = data.num;
          }
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
