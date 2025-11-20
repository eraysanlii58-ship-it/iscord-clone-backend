
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const API_BASE = 'https://iscord-clone-backend-two.vercel.app'; // Heroku adresinizle değiştirin
const SOCKET_URL = API_BASE.replace(/\/api.*/, '');

function App() {
  const [channels, setChannels] = useState([]);
    // Sesli sohbet state
    const [inVoice, setInVoice] = useState(false);
    const [voiceUsers, setVoiceUsers] = useState([]);
    const [micOn, setMicOn] = useState(false);
    const localStream = useRef(null);
    const socketRef = useRef(null);
    const peersRef = useRef({}); // { peerId: RTCPeerConnection }
    const [remoteAudios, setRemoteAudios] = useState([]); // [{peerId, stream}]
      // WebRTC peer bağlantısı ve sinyalizasyon yönetimi
      useEffect(() => {
        if (!inVoice || !socketRef.current) return;
        const socket = socketRef.current;

        // Odaya katıldığında mevcut peer'ları al
        socket.on('peers-in-room', async (peerIds) => {
          for (const peerId of peerIds) {
            await createPeerConnection(peerId, true);
          }
        });

        // Offer al
        socket.on('webrtc-offer', async ({ from, offer }) => {
          await createPeerConnection(from, false, offer);
        });
        // Answer al
        socket.on('webrtc-answer', ({ from, answer }) => {
          const pc = peersRef.current[from];
          if (pc) pc.setRemoteDescription(new RTCSessionDescription(answer));
        });
        // ICE candidate al
        socket.on('webrtc-candidate', ({ from, candidate }) => {
          const pc = peersRef.current[from];
          if (pc && candidate) pc.addIceCandidate(new RTCIceCandidate(candidate));
        });

        return () => {
          socket.off('peers-in-room');
          socket.off('webrtc-offer');
          socket.off('webrtc-answer');
          socket.off('webrtc-candidate');
          // Peer bağlantılarını temizle
          Object.values(peersRef.current).forEach(pc => pc.close());
          peersRef.current = {};
          setRemoteAudios([]);
        };
      }, [inVoice]);

      // Peer bağlantısı oluşturucu
      const createPeerConnection = async (peerId, isInitiator, remoteOffer) => {
        if (peersRef.current[peerId]) return peersRef.current[peerId];
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peersRef.current[peerId] = pc;
        // Mikrofonu ekle
        if (localStream.current) {
          localStream.current.getTracks().forEach(track => pc.addTrack(track, localStream.current));
        }
        // ICE candidate gönder
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            socketRef.current.emit('webrtc-candidate', { to: peerId, from: socketRef.current.id, candidate: e.candidate });
          }
        };
        // Remote stream geldiğinde <audio> için state'e ekle
        pc.ontrack = (e) => {
          setRemoteAudios(prev => {
            // Aynı peerId için tekrar ekleme
            if (prev.some(a => a.peerId === peerId)) return prev;
            return [...prev, { peerId, stream: e.streams[0] }];
          });
        };
        if (isInitiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current.emit('webrtc-offer', { to: peerId, from: socketRef.current.id, offer });
        } else if (remoteOffer) {
          await pc.setRemoteDescription(new RTCSessionDescription(remoteOffer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socketRef.current.emit('webrtc-answer', { to: peerId, from: socketRef.current.id, answer });
        }
        return pc;
      };
    // Socket.io bağlantısı (yalnızca aktif kullanıcı için başlatılır)
    useEffect(() => {
      if (!isActive) return;
      if (!socketRef.current) {
        socketRef.current = io(SOCKET_URL);
      }
      const socket = socketRef.current;
      // Sesli oda kullanıcılarını dinle
      socket.on('voice-users', users => setVoiceUsers(users));
      return () => {
        socket.disconnect();
        socketRef.current = null;
      };
    }, [isActive]);

    // Sesli sohbete katıl/ayrıl
    const handleJoinVoice = async () => {
      if (!socketRef.current || !selectedChannel) return;
      // Mikrofonu açmadan odaya katılma
      if (!micOn) await handleToggleMic();
      socketRef.current.emit('join-voice', `channel-${selectedChannel.id}`, username);
      setInVoice(true);
    };
    const handleLeaveVoice = () => {
      if (!socketRef.current) return;
      socketRef.current.emit('leave-voice');
      setInVoice(false);
      setVoiceUsers([]);
      // Peer bağlantılarını kapat
      Object.values(peersRef.current).forEach(pc => pc.close());
      peersRef.current = {};
      setRemoteAudios([]);
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
        localStream.current = null;
      }
      setMicOn(false);
    };

    // Mikrofon aç/kapat
    const handleToggleMic = async () => {
      if (!micOn) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStream.current = stream;
          setMicOn(true);
        } catch (err) {
          alert('Mikrofon açılamadı: ' + err.message);
        }
      } else {
        if (localStream.current) {
          localStream.current.getTracks().forEach(track => track.stop());
          localStream.current = null;
        }
        setMicOn(false);
      }
    };
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
          <>
            {/* Sesli Sohbet Alanı */}
            <div style={{ padding: 16, borderTop: '1px solid #222', display: 'flex', alignItems: 'center', background: '#23272a' }}>
              <b>Sesli Sohbet:</b>
              {!inVoice ? (
                <button onClick={handleJoinVoice} style={{ marginLeft: 12, padding: '6px 12px', borderRadius: 4, background: '#43b581', color: '#fff', border: 'none' }}>Katıl</button>
              ) : (
                <>
                  <button onClick={handleLeaveVoice} style={{ marginLeft: 12, padding: '6px 12px', borderRadius: 4, background: '#f04747', color: '#fff', border: 'none' }}>Ayrıl</button>
                  <button onClick={handleToggleMic} style={{ marginLeft: 12, padding: '6px 12px', borderRadius: 4, background: micOn ? '#43b581' : '#7289da', color: '#fff', border: 'none' }}>{micOn ? 'Mikrofonu Kapat' : 'Mikrofonu Aç'}</button>
                  <span style={{ marginLeft: 16, color: '#fff' }}>Odada: {voiceUsers.join(', ') || 'Yalnızsınız'}</span>
                  {/* Diğer kullanıcıların sesi */}
                  {remoteAudios.map(({ peerId, stream }) => (
                    <audio key={peerId} autoPlay controls style={{ display: 'none' }} ref={el => { if (el && stream) el.srcObject = stream; }} />
                  ))}
                </>
              )}
            </div>
            {/* Mesaj Alanı */}
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
          </>
        )}
      </div>
    </div>
  );
}

export default App;
