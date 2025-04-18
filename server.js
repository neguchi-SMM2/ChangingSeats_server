const express = require("express");
const fs = require("fs");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = "./seats.json";

app.use(cors());
app.use(express.json());

// 初期化：ファイルがなければ空の座席40個分作る
if (!fs.existsSync(DATA_FILE)) {
  const emptyData = {};
  for (let i = 1; i <= 40; i++) {
    emptyData[i] = null;
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(emptyData, null, 2));
}

// 座席情報を取得
app.get("/seats", (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE));
  res.json(data);
});

// 生徒が座席に登録する
app.post("/register", (req, res) => {
  const { seat, name, studentId } = req.body;
  if (!seat || !name || !studentId) {
    return res.status(400).json({ message: "不正なデータです" });
  }

  const data = JSON.parse(fs.readFileSync(DATA_FILE));
  data[seat] = { name, studentId };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json({ message: "登録完了" });
});

// 先生が全座席をリセットする
app.post("/reset", (req, res) => {
  const newData = {};
  for (let i = 1; i <= 40; i++) {
    newData[i] = null;
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(newData, null, 2));
  res.json({ message: "全席リセットしました" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
