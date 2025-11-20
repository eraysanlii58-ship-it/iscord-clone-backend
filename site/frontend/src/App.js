import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE = 'https://iscord-clone-backend.vercel.app'; // Buraya Vercel'deki backend API adresinizi yazın

function App() {
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    axios.get(`${API_BASE}/api/channels`).then(res => setChannels(res.data));
  }, []);

  useEffect(() => {
    if (selectedChannel) {
      axios.get(`${API_BASE}/api/messages/${selectedChannel.id}`).then(res => setMessages(res.data));
    }
  }, [selectedChannel]);

  const sendMessage = () => {
    if (!newMessage || !selectedChannel) return;
    axios.post(`${API_BASE}/api/messages`, {
      channelId: selectedChannel.id,
      userId: 1, // Demo kullanıcı
      text: newMessage
    }).then(res => {
      setMessages([...messages, res.data]);
      setNewMessage('');
    });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial' }}>
      <div style={{ width: 200, background: '#23272a', color: '#fff', padding: 16 }}>
        <h3>Kanallar</h3>
        {channels.map(ch => (
          <div key={ch.id} style={{ margin: '8px 0', cursor: 'pointer', fontWeight: selectedChannel?.id === ch.id ? 'bold' : 'normal' }} onClick={() => setSelectedChannel(ch)}>
            #{ch.name}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, background: '#36393f', color: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <h3>{selectedChannel ? `#${selectedChannel.name}` : 'Bir kanal seçin'}</h3>
          {messages.map(msg => (
            <div key={msg.id} style={{ margin: '8px 0' }}>
              <b>Kullanıcı {msg.userId}:</b> {msg.text}
            </div>
          ))}
        </div>
        {selectedChannel && (
          <div style={{ padding: 16, borderTop: '1px solid #222', display: 'flex' }}>
            <input value={newMessage} onChange={e => setNewMessage(e.target.value)} style={{ flex: 1, marginRight: 8, padding: 8, borderRadius: 4, border: 'none' }} placeholder="Mesaj yaz..." />
            <button onClick={sendMessage} style={{ padding: '8px 16px', borderRadius: 4, background: '#7289da', color: '#fff', border: 'none' }}>Gönder</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

