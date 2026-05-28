from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from sqlalchemy.orm import Session
from app.database import get_db, engine
from app.models import Base, Room
import uuid

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store data in memory
room_data = {}

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
    
    room_data[room_id] = {
        "content": "// Start coding here\nconsole.log('Hello World!');",
        "users": []
    }
    
    return {"room_id": room_id}

@app.get("/api/rooms/{room_id}")
def get_room(room_id: str, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"exists": True, "room_id": room.room_id}

@app.post("/api/rooms/{room_id}/join")
async def join_room(room_id: str, request: Request, db: Session = Depends(get_db)):
    try:
        body = await request.json()
        user_name = body.get("user_name")
    except:
        return {"error": "Invalid request"}
    
    room = db.query(Room).filter(Room.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room_id not in room_data:
        room_data[room_id] = {
            "content": room.files.get("index.js", "// Start coding here"),
            "users": []
        }
    
    if user_name and user_name not in room_data[room_id]["users"]:
        room_data[room_id]["users"].append(user_name)
    
    return {
        "content": room_data[room_id]["content"],
        "users": room_data[room_id]["users"]
    }

@app.post("/api/rooms/{room_id}/update")
async def update_code(room_id: str, request: Request, db: Session = Depends(get_db)):
    try:
        body = await request.json()
        content = body.get("content")
        user_name = body.get("user_name")
    except:
        return {"error": "Invalid request"}
    
    room = db.query(Room).filter(Room.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room_id not in room_data:
        room_data[room_id] = {"content": content, "users": []}
    
    room_data[room_id]["content"] = content
    
    # Save to database
    room.files = {"index.js": content}
    db.commit()
    
    return {"success": True, "content": content}

@app.post("/api/rooms/{room_id}/leave")
async def leave_room(room_id: str, request: Request):
    try:
        body = await request.json()
        user_name = body.get("user_name")
    except:
        return {"error": "Invalid request"}
    
    if room_id in room_data and user_name:
        if user_name in room_data[room_id]["users"]:
            room_data[room_id]["users"].remove(user_name)
    return {"success": True}