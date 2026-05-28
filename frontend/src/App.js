import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';

// Hardcoded API URLs - Replace with your actual Render backend URL
const API_URL = 'https://collabcode-backend-8y1g.onrender.com';
const WS_URL = 'wss://collabcode-backend-8y1g.onrender.com';

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
      console.error('Create room error:', err);
      setError('Failed to create room. Make sure backend is running.');
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
    
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}`);
      if (res.status === 404) {
        setError('Room not found. Please check the Room ID.');
        return;
      }
      navigate(`/room/${roomId}/${userName}`);
    } catch (err) {
      console.error('Join room error:', err);
      setError('Failed to join room. Make sure backend is running.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#1e1e1e', color: 'white' }}>
      <h1 style={{ marginBottom: '30px' }}>CollabCode</h1>
      <div style={{ background: '#2d2d2d', padding: '40px', borderRadius: '10px', width: '400px' }}>
        <input
          type="text"
          placeholder="Enter your name"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '5px', border: 'none', fontSize: '16px' }}
        />
        
        <input
          type="text"
          placeholder="Enter Room ID (to join existing room)"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '5px', border: 'none', fontSize: '16px' }}
        />
        
        {error && <p style={{ color: '#f44336', marginBottom: '15px', textAlign: 'center' }}>{error}</p>}
        
        <button 
          onClick={joinRoom} 
          style={{ width: '100%', padding: '12px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px', marginBottom: '10px' }}
        >
          Join Room
        </button>
        
        <button 
          onClick={createRoom} 
          disabled={isCreating}
          style={{ width: '100%', padding: '12px', background: '#008CBA', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' }}
        >
          {isCreating ? 'Creating...' : 'Create New Room'}
        </button>
      </div>
    </div>
  );
}

function EditorRoom() {
  const { roomId, userName } = useParams();
  const [files, setFiles] = useState({});
  const [activeFile, setActiveFile] = useState('');
  const [users, setUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const wsRef = useRef(null);
  const isRemoteUpdate = useRef(false);
  const editorRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const websocket = new WebSocket(`${WS_URL}/ws/${roomId}/${userName}`);
    wsRef.current = websocket;
    
    websocket.onopen = () => {
      console.log('Connected to server');
      setConnected(true);
    };
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received:', data.type);
      
      if (data.type === 'init') {
        setFiles(data.files);
        setActiveFile(data.active_file);
        setUsers(data.users);
      } else if (data.type === 'operation') {
        isRemoteUpdate.current = true;
        setFiles(prev => ({
          ...prev,
          [data.filename]: data.content
        }));
        setTimeout(() => {
          isRemoteUpdate.current = false;
        }, 100);
      } else if (data.type === 'user_joined') {
        setUsers(data.users);
      } else if (data.type === 'user_left') {
        setUsers(data.users);
      } else if (data.type === 'file_switched') {
        setActiveFile(data.filename);
      } else if (data.type === 'file_created') {
        setFiles(prev => ({ ...prev, [data.filename]: '// New file\n' }));
      }
    };
    
    websocket.onclose = () => {
      console.log('Disconnected from server');
      setConnected(false);
    };
    
    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [roomId, userName]);

  const sendContent = (filename, content) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !isRemoteUpdate.current) {
      wsRef.current.send(JSON.stringify({
        type: 'operation',
        filename: filename,
        content: content
      }));
    }
  };

  const handleEditorChange = (value) => {
    if (isRemoteUpdate.current) return;
    if (!value) return;
    
    setFiles(prev => ({ ...prev, [activeFile]: value }));
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      sendContent(activeFile, value);
    }, 100);
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
  };

  const switchFile = (filename) => {
    setActiveFile(filename);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'switch_file',
        filename: filename
      }));
    }
  };

  const createNewFile = () => {
    if (newFileName && !files[newFileName]) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'new_file',
          filename: newFileName
        }));
      }
      setFiles(prev => ({ ...prev, [newFileName]: '// New file\n' }));
      setActiveFile(newFileName);
      setNewFileName('');
      setShowNewFileInput(false);
    }
  };

  const getFileExtension = (filename) => {
    const ext = filename.split('.').pop();
    if (ext === 'js') return 'javascript';
    if (ext === 'py') return 'python';
    if (ext === 'html') return 'html';
    if (ext === 'css') return 'css';
    if (ext === 'json') return 'json';
    return 'javascript';
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#1e1e1e' }}>
      <div style={{ width: '250px', background: '#2d2d2d', padding: '20px', color: 'white', borderRight: '1px solid #444', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>Files</h3>
          <button 
            onClick={() => setShowNewFileInput(!showNewFileInput)}
            style={{ background: '#4CAF50', border: 'none', color: 'white', width: '25px', height: '25px', borderRadius: '3px', cursor: 'pointer', fontSize: '18px' }}
          >+</button>
        </div>
        
        {showNewFileInput && (
          <div style={{ marginBottom: '15px', display: 'flex', gap: '5px' }}>
            <input
              type="text"
              placeholder="filename.js"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createNewFile()}
              style={{ flex: 1, padding: '5px', borderRadius: '3px', border: 'none' }}
            />
            <button onClick={createNewFile} style={{ background: '#008CBA', border: 'none', color: 'white', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer' }}>Add</button>
          </div>
        )}
        
        {Object.keys(files).map(filename => (
          <div
            key={filename}
            onClick={() => switchFile(filename)}
            style={{
              padding: '8px 10px',
              marginBottom: '5px',
              borderRadius: '5px',
              cursor: 'pointer',
              background: activeFile === filename ? '#0e639c' : 'transparent',
              transition: 'background 0.2s'
            }}
          >
            📄 {filename}
          </div>
        ))}
        
        <hr style={{ margin: '20px 0', borderColor: '#444' }} />
        
        <h4>Room: {roomId}</h4>
        <div style={{ marginBottom: '10px' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: connected ? '#4CAF50' : '#f44336', marginRight: '8px' }}></span>
          {connected ? 'Connected' : 'Disconnected'}
        </div>
        <h4>Users Online ({users.length})</h4>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {users.map(user => (
            <li key={user} style={{ padding: '5px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#4CAF50', display: 'inline-block' }}></span>
              {user} {user === userName ? '(You)' : ''}
            </li>
          ))}
        </ul>
      </div>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeFile && files[activeFile] && (
          <>
            <div style={{ background: '#252526', padding: '8px 15px', borderBottom: '1px solid #444', color: 'white', fontSize: '14px' }}>
              📄 {activeFile}
            </div>
            <Editor
              height="100%"
              language={getFileExtension(activeFile)}
              theme="vs-dark"
              value={files[activeFile]}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </>
        )}
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