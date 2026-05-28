from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database import get_db, engine
from app.models import Base, Room
import uuid
import json

Base.metadata.create_all(bind=engine)

app = FastAPI()

# Allow all CORS for testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_connections = {}
room_documents = {}

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
    # Accept the connection first
    await websocket.accept()
    print(f"WebSocket connected: {room_id}/{user_name}")
    
    # Check if room exists in database
    room = db.query(Room).filter(Room.room_id == room_id).first()
    if not room:
        await websocket.send_json({"type": "error", "message": "Room not found"})
        await websocket.close()
        return
    
    # Initialize room if not exists in memory
    if room_id not in active_connections:
        active_connections[room_id] = {}
        room_documents[room_id] = room.files.get("index.js", "// Start coding here")
    
    # Add user to room
    active_connections[room_id][user_name] = websocket
    
    # Send initial data
    await websocket.send_json({
        "type": "init",
        "content": room_documents[room_id],
        "users": list(active_connections[room_id].keys())
    })
    
    # Notify others
    for name, conn in active_connections[room_id].items():
        if name != user_name:
            try:
                await conn.send_json({
                    "type": "user_joined",
                    "users": list(active_connections[room_id].keys())
                })
            except:
                pass
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "operation":
                # Update document
                room_documents[room_id] = message.get("content", room_documents[room_id])
                
                # Save to database
                room.files = {"index.js": room_documents[room_id]}
                db.commit()
                
                # Broadcast to all other users
                for name, conn in active_connections[room_id].items():
                    if name != user_name:
                        try:
                            await conn.send_json({
                                "type": "operation",
                                "content": room_documents[room_id],
                                "user": user_name
                            })
                        except:
                            pass
                                
    except WebSocketDisconnect:
        print(f"WebSocket disconnected: {room_id}/{user_name}")
        if room_id in active_connections:
            if user_name in active_connections[room_id]:
                del active_connections[room_id][user_name]
            
            # Notify others
            for name, conn in active_connections[room_id].items():
                try:
                    await conn.send_json({
                        "type": "user_left",
                        "users": list(active_connections[room_id].keys())
                    })
                except:
                    pass
            
            # Clean up empty room
            if len(active_connections[room_id]) == 0:
                del active_connections[room_id]