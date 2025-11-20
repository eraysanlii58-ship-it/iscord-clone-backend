import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE = 'https://iscord-clone-backend-two.vercel.app';

function App() {
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [isActive, setIsActive] = useState(!!localStorage.getItem('username'));

  // Çevrim içi kullanıcı sayısını her 2 saniyede bir güncelle
  useEffect(() => {
    if (!isActive) return;
    let interval = setInterval(() => {
      axios.get(`${API_BASE}/api/online-users`).then(res => {
        setOnlineCount(res.data.length);
      });
    }, 2000);
    // İlk yüklemede de çek
    axios.get(`${API_BASE}/api/online-users`).then(res => {
      setOnlineCount(res.data.length);
    });
    return () => clearInterval(interval);
  }, [isActive]);

  // Aktif olunca backend'e bildir
  const handleActivate = async () => {
    if (!username) return;
    try {
      await axios.post(`${API_BASE}/api/online-users`, { username });
      localStorage.setItem('username', username);
      setIsActive(true);
    } catch (e) {
      alert('Aktif olma sırasında bir hata oluştu.');
    }
  };

  useEffect(() => {
    axios.get(`${API_BASE}/api/channels`).then(res => setChannels(res.data));
  }, []);

  useEffect(() => {
    let interval;
    if (selectedChannel) {
      // İlk yüklemede hemen çek
      axios.get(`${API_BASE}/api/messages/${selectedChannel.id}`).then(res => setMessages(res.data));
      // Sonra her 2 saniyede bir çek
      interval = setInterval(() => {
        axios.get(`${API_BASE}/api/messages/${selectedChannel.id}`).then(res => setMessages(res.data));
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
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

  if (!isActive) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#23272a', color: '#fff', flexDirection: 'column' }}>
        <h2>İsminizi girin ve aktif olun</h2>
        <input value={username} onChange={e => setUsername(e.target.value)} style={{ padding: 8, borderRadius: 4, border: 'none', marginBottom: 12 }} placeholder="Kullanıcı adı" />
        <button onClick={handleActivate} style={{ padding: '8px 16px', borderRadius: 4, background: '#7289da', color: '#fff', border: 'none' }}>Aktif Ol</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial' }}>
      <div style={{ width: 200, background: '#23272a', color: '#fff', padding: 16 }}>
        <h3>Kanallar</h3>
        <div style={{ marginBottom: 12, fontSize: 14, color: '#43b581' }}>
          Çevrim içi: {onlineCount}
        </div>
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
            <input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  sendMessage();
                }
              }}
              style={{ flex: 1, marginRight: 8, padding: 8, borderRadius: 4, border: 'none' }}
              placeholder="Mesaj yaz..."
            />
            <button onClick={sendMessage} style={{ padding: '8px 16px', borderRadius: 4, background: '#7289da', color: '#fff', border: 'none' }}>Gönder</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
