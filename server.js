const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

let seats = Array(42).fill(null);

const server = http.createServer((req, res) => {
  let filePath = './public';

  if (req.url === '/' || req.url === '/student') {
    filePath += '/student.html';
  } else if (req.url === '/teacher') {
    filePath += '/teacher.html';
  } else {
    res.writeHead(404);
    return res.end('Not found');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading file');
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  // 初期状態送信
  seats.forEach((name, index) => {
    if (name) {
      ws.send(JSON.stringify({ seat: index, name }));
    }
  });

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === "reset") {
      seats = Array(42).fill(null);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "reset" }));
        }
      });
    } else {
      // 座席登録
      seats[data.seat] = data.name;
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
