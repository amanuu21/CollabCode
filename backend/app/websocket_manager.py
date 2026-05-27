import json
from typing import Dict, Set
from fastapi import WebSocket
from app.ot import Operation, apply_operation

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        self.room_cursors: Dict[str, Dict[str, dict]] = {}
        self.room_documents: Dict[str, str] = {}
    
    async def connect(self, websocket: WebSocket, room_id: str, user_name: str):
        await websocket.accept()
        
        if room_id not in self.active_connections:
            self.active_connections[room_id] = {}
            self.room_cursors[room_id] = {}
            self.room_documents[room_id] = ""
        
        self.active_connections[room_id][user_name] = websocket
        
        await websocket.send_json({
            "type": "init",
            "content": self.room_documents[room_id],
            "users": list(self.active_connections[room_id].keys())
        })
        
        await self.broadcast(room_id, {
            "type": "user_joined",
            "user": user_name,
            "users": list(self.active_connections[room_id].keys())
        }, exclude=user_name)
    
    def disconnect(self, room_id: str, user_name: str):
        if room_id in self.active_connections:
            if user_name in self.active_connections[room_id]:
                del self.active_connections[room_id][user_name]
            if room_id in self.room_cursors and user_name in self.room_cursors[room_id]:
                del self.room_cursors[room_id][user_name]
    
    async def broadcast(self, room_id: str, message: dict, exclude: str = None):
        if room_id not in self.active_connections:
            return
        
        for user_name, connection in self.active_connections[room_id].items():
            if user_name != exclude:
                try:
                    await connection.send_json(message)
                except:
                    pass
    
    async def handle_operation(self, room_id: str, user_name: str, operation_data: dict):
        op = Operation(
            type=operation_data["type"],
            position=operation_data["position"],
            chars=operation_data.get("chars"),
            length=operation_data.get("length")
        )
        
        self.room_documents[room_id] = apply_operation(self.room_documents[room_id], op)
        
        await self.broadcast(room_id, {
            "type": "operation",
            "operation": operation_data,
            "user": user_name
        })
    
    async def update_cursor(self, room_id: str, user_name: str, cursor_data: dict):
        self.room_cursors[room_id][user_name] = cursor_data
        
        await self.broadcast(room_id, {
            "type": "cursor_update",
            "user": user_name,
            "cursor": cursor_data
        }, exclude=user_name)

manager = ConnectionManager()