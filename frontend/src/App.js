import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';

const API_URL = 'https://collabcode-backend-8y1g.onrender.com';

function CreateRoom() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const createRoom = async () => {
    if (!userName) {
      setError('Please enter your name');
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/rooms`, { method: 'POST' });
      const data = await res.json();
      navigate(`/room/${data.room_id}/${userName}`);
    } catch (err) {
      setError('Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoom = async () => {
    if (!userName) {
      setError('Please enter your name');
      return;
    }
    if (!roomId) {
      setError('Please enter a Room ID');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}`);
      if (res.status === 404) {
        setError('Room not found');
        return;
      }
      navigate(`/room/${roomId}/${userName}`);
    } catch (err) {
      setError('Failed to join room');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#1e1e1e', color: 'white' }}>
      <h1>CollabCode</h1>
      <div style={{ background: '#2d2d2d', padding: '40px', borderRadius: '10px', width: '400px' }}>
        <input
          type="text"
          placeholder="Your name"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          style={{ width: '100%', padding: '10px', marginBottom: '20px' }}
        />
        <input
          type="text"
          placeholder="Room ID (optional)"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          style={{ width: '100%', padding: '10px', marginBottom: '20px' }}
        />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button onClick={joinRoom} style={{ width: '100%', padding: '10px', marginBottom: '10px', background: '#4CAF50', color: 'white', cursor: 'pointer' }}>
          Join Room
        </button>
        <button onClick={createRoom} disabled={isCreating} style={{ width: '100%', padding: '10px', background: '#008CBA', color: 'white', cursor: 'pointer' }}>
          {isCreating ? 'Creating...' : 'Create New Room'}
        </button>
      </div>
    </div>
  );
}

function EditorRoom() {
  const { roomId, userName } = useParams();
  const [code, setCode] = useState('');
  const [users, setUsers] = useState([]);
  const [polling] = useState(true);  // Fixed: removed setPolling

  useEffect(() => {
    const joinRoom = async () => {
      try {
        const res = await fetch(`${API_URL}/api/rooms/${roomId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_name: userName })
        });
        const data = await res.json();
        setCode(data.content);
        setUsers(data.users);
      } catch (err) {
        console.error('Failed to join room:', err);
      }
    };
    joinRoom();
  }, [roomId, userName]);

  useEffect(() => {
    if (!polling) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/rooms/${roomId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_name: userName })
        });
        const data = await res.json();
        setUsers(data.users);
        if (data.content !== code) {
          setCode(data.content);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [roomId, userName, code, polling]);

  const handleCodeChange = async (value) => {
    setCode(value);
    try {
      await fetch(`${API_URL}/api/rooms/${roomId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: value, user_name: userName })
      });
    } catch (err) {
      console.error('Failed to update code:', err);
    }
  };

  useEffect(() => {
    return () => {
      fetch(`${API_URL}/api/rooms/${roomId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_name: userName })
      }).catch(() => {});
    };
  }, [roomId, userName]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#1e1e1e' }}>
      <div style={{ width: '250px', background: '#2d2d2d', padding: '20px', color: 'white' }}>
        <h4>Room: {roomId}</h4>
        <h4>Users Online ({users.length})</h4>
        <ul>
          {users.map(user => (
            <li key={user}>{user} {user === userName ? '(You)' : ''}</li>
          ))}
        </ul>
      </div>
      <div style={{ flex: 1 }}>
        <Editor
          height="100%"
          language="javascript"
          theme="vs-dark"
          value={code}
          onChange={handleCodeChange}
          options={{ fontSize: 14, minimap: { enabled: false } }}
        />
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CreateRoom />} />
        <Route path="/room/:roomId/:userName" element={<EditorRoom />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;