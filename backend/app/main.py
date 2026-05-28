from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database import get_db, engine
from app.models import Base, Room
import uuid
import json

Base.metadata.create_all(bind=engine)

app = FastAPI()

# Updated CORS settings with your specific Vercel URLs
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://collabcode.vercel.app",
        "https://collab-code.vercel.app",
        "https://collab-code-git-main-amanuel-s-projects4.vercel.app",
        "https://collab-code-k4d0uvitt-amanuel-s-projects4.vercel.app",
        "https://*.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_connections = {}
room_files = {}
room_active_file = {}

@app.get("/")
def root():
    return {"message": "CollabCode API Running"}

@app.post("/api/rooms")
def create_room(db: Session = Depends(get_db)):
    room_id = str(uuid.uuid4())[:8]
    new_room = Room(
        room_id=room_id,
        files={"index.js": "// Start coding here\nconsole.log('Hello World!');"},
        active_file="index.js"
    )
    db.add(new_room)
    db.commit()
    return {"room_id": room_id}

@app.get("/api/rooms/{room_id}")
def get_room(room_id: str, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"exists": True, "room_id": room.room_id}

@app.websocket("/ws/{room_id}/{user_name}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_name: str, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.room_id == room_id).first()
    if not room:
        await websocket.close(code=1008, reason="Room not found")
        return
    
    await websocket.accept()
    
    if room_id not in active_connections:
        active_connections[room_id] = {}
        room_files[room_id] = room.files if room.files else {"index.js": "// Start coding here\nconsole.log('Hello World!');"}
        room_active_file[room_id] = room.active_file if room.active_file else "index.js"
    
    active_connections[room_id][user_name] = websocket
    
    await websocket.send_json({
        "type": "init",
        "files": room_files[room_id],
        "active_file": room_active_file[room_id],
        "users": list(active_connections[room_id].keys())
    })
    
    for name, conn in active_connections[room_id].items():
        if name != user_name:
            try:
                await conn.send_json({
                    "type": "user_joined",
                    "user": user_name,
                    "users": list(active_connections[room_id].keys())
                })
            except:
                pass
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "operation":
                filename = message.get("filename", room_active_file[room_id])
                room_files[room_id][filename] = message["content"]
                
                room.files = room_files[room_id]
                db.commit()
                
                for name, conn in active_connections[room_id].items():
                    if name != user_name:
                        try:
                            await conn.send_json({
                                "type": "operation",
                                "filename": filename,
                                "content": message["content"],
                                "user": user_name
                            })
                        except:
                            pass
            
            elif message["type"] == "switch_file":
                room_active_file[room_id] = message["filename"]
                room.active_file = message["filename"]
                db.commit()
                
                for name, conn in active_connections[room_id].items():
                    if name != user_name:
                        try:
                            await conn.send_json({
                                "type": "file_switched",
                                "filename": message["filename"],
                                "user": user_name
                            })
                        except:
                            pass
            
            elif message["type"] == "new_file":
                filename = message["filename"]
                room_files[room_id][filename] = "// New file\n"
                room.files = room_files[room_id]
                db.commit()
                
                for name, conn in active_connections[room_id].items():
                    try:
                        await conn.send_json({
                            "type": "file_created",
                            "filename": filename,
                            "user": user_name
                        })
                    except:
                        pass
                            
    except WebSocketDisconnect:
        if room_id in active_connections:
            if user_name in active_connections[room_id]:
                del active_connections[room_id][user_name]
            
            for name, conn in active_connections[room_id].items():
                try:
                    await conn.send_json({
                        "type": "user_left",
                        "user": user_name,
                        "users": list(active_connections[room_id].keys())
                    })
                except:
                    pass
            
            if len(active_connections[room_id]) == 0:
                del active_connections[room_id]
                del room_files[room_id]
                del room_active_file[room_id]