import couchbase from 'couchbase';

let cluster, bucket, collection;
(async () => {
  cluster = await couchbase.connect(process.env.COUCHBASE_CONNSTR, {
    username: process.env.COUCHBASE_USER,
    password: process.env.COUCHBASE_PASS,
  });
  bucket = cluster.bucket(process.env.COUCHBASE_BUCKET);
  // Varsayılan kapsam ve koleksiyon (Capella Türkçe arayüzde _varsayılan olabilir, İngilizce _default)
  collection = bucket.scope('_varsayılan').collection('_varsayılan');
})();


import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
app.use(cors());
app.use(express.json());


// --- Ortak veri ---
let onlineUsers = [];
let users = [
  { id: 1, username: 'user1' },
  { id: 2, username: 'user2' }
];
let channels = [
  { id: 1, name: 'general' },
  { id: 2, name: 'random' }
];
let messages = [
  { id: 1, channelId: 1, userId: 1, text: 'Merhaba!', timestamp: Date.now() }
];

// --- REST API ---
app.post('/api/online-users', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username gerekli' });
  if (!onlineUsers.includes(username)) {
    onlineUsers.push(username);
  }
  res.json({ success: true });
});
app.get('/api/online-users', (req, res) => {
  res.json(onlineUsers);
});
app.get('/api/users', (req, res) => {
  res.json(users);
});
app.get('/api/channels', (req, res) => {
  res.json(channels);
});
app.get('/api/messages/:channelId', async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);
    // N1QL ile ilgili kanaldaki mesajları çek
    const query = `SELECT META().id, * FROM \`${process.env.COUCHBASE_BUCKET}\`._varsayılan._varsayılan
      WHERE channelId = $1 ORDER BY timestamp ASC`;
    const result = await cluster.query(query, { parameters: [channelId] });
    // Sonuçları sadeleştir
    const messages = result.rows.map(row => row._varsayılan);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Couchbase mesaj listeleme hatası', detail: err.message });
  }
});
app.post('/api/messages', async (req, res) => {
  try {
    const { channelId, userId, text } = req.body;
    const id = `message::${Date.now()}`;
    const newMsg = { channelId, userId, text, timestamp: Date.now() };
    await collection.insert(id, newMsg);
    res.status(201).json({ id, ...newMsg });
  } catch (err) {
    res.status(500).json({ error: 'Couchbase mesaj ekleme hatası', detail: err.message });
  }
});
app.get('/', (req, res) => {
  res.send('Discord benzeri backend API çalışıyor!');
});

// --- Socket.io ve sesli sohbet ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
let voiceUsers = {};
io.on('connection', (socket) => {
  socket.on('join-voice', (room, username) => {
    socket.join(room);
    voiceUsers[socket.id] = { room, username };
    const usersInRoom = Object.values(voiceUsers).filter(u => u.room === room).map(u => u.username);
    io.to(room).emit('voice-users', usersInRoom);
  });
  socket.on('leave-voice', () => {
    const user = voiceUsers[socket.id];
    if (user) {
      const room = user.room;
      delete voiceUsers[socket.id];
      const usersInRoom = Object.values(voiceUsers).filter(u => u.room === room).map(u => u.username);
      io.to(room).emit('voice-users', usersInRoom);
    }
  });
  socket.on('disconnect', () => {
    const user = voiceUsers[socket.id];
    if (user) {
      const room = user.room;
      delete voiceUsers[socket.id];
      const usersInRoom = Object.values(voiceUsers).filter(u => u.room === room).map(u => u.username);
      io.to(room).emit('voice-users', usersInRoom);
    }
  });
});

// Heroku veya klasik sunucu için server başlat


if (process.env.NODE_ENV !== 'production-vercel') {
  server.listen(PORT, () => {
    console.log('Backend + Socket.io ' + PORT + ' portunda çalışıyor');
  });
}


// --- TEKRAR EDEN TÜM KODLAR SİLİNDİ ---
// Sunucu başlatma ve export işlemi sadece bir kez yapılır:

// Heroku veya klasik sunucu için server başlat
const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'production-vercel') {
  server.listen(PORT, () => {
    console.log('Backend + Socket.io ' + PORT + ' portunda çalışıyor');
  });
}

// Vercel için sadece app export edilir
export default app;
