// Online kullanıcılar (isim listesi)
let onlineUsers = [];

// Online kullanıcı ekle
app.post('/api/online-users', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username gerekli' });
  if (!onlineUsers.includes(username)) {
    onlineUsers.push(username);
  }
  res.json({ success: true });
});

// Online kullanıcıları getir
app.get('/api/online-users', (req, res) => {
  res.json(onlineUsers);
});
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Dummy data
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

// User endpoints
app.get('/api/users', (req, res) => {
  res.json(users);
});

// Channel endpoints
app.get('/api/channels', (req, res) => {
  res.json(channels);
});

// Message endpoints
app.get('/api/messages/:channelId', (req, res) => {
  const channelId = parseInt(req.params.channelId);
  const channelMessages = messages.filter(m => m.channelId === channelId);
  res.json(channelMessages);
});


app.post('/api/messages', (req, res) => {
  const { channelId, userId, text } = req.body;
  const newMsg = {
    id: messages.length + 1,
    channelId,
    userId,
    text,
    timestamp: Date.now()
  };
  messages.push(newMsg);
  res.status(201).json(newMsg);
});

app.get('/', (req, res) => {
  res.send('Discord benzeri backend API çalışıyor!');
});

export default app;
