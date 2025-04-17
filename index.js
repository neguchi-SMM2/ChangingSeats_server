import express from 'express';
import cors from 'cors';
import supabase from './supabase.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 全座席の情報を取得
app.get('/api/seats', async (req, res) => {
  const { data, error } = await supabase
    .from('seats')
    .select('*')
    .order('seat', { ascending: true });
  if (error) return res.status(500).json({ error });
  res.json(data);
});

// 生徒が座席を登録
app.post('/api/seats', async (req, res) => {
  const { seat, name, number } = req.body;

  // 既にその座席が埋まっていないかチェック
  const { data: existing } = await supabase
    .from('seats')
    .select('*')
    .eq('seat', seat)
    .maybeSingle();

  if (existing) {
    return res.status(400).json({ error: 'その席はすでに埋まっています。' });
  }

  const { data, error } = await supabase
    .from('seats')
    .insert([{ seat, name, number }]);

  if (error) return res.status(500).json({ error });
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
