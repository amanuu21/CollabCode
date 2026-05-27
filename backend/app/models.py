from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from app.database import Base

class Room(Base):
    __tablename__ = "rooms"
    
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(String(50), unique=True, index=True, nullable=False)
    files = Column(JSON, default={"index.js": "// Start coding here\nconsole.log('Hello World!');"})
    active_file = Column(String(100), default="index.js")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())