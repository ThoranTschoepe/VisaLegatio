# backend/routes/chat.py - AVA Chat API routes

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import json

from database import get_db, ChatMessage as ChatMessageDB
from models import ChatMessage, ChatResponse
from utils import generate_id
from services import gemini_service

router = APIRouter()

@router.post("/", response_model=ChatResponse)
async def chat_with_ava(message: ChatMessage, db: Session = Depends(get_db)):
    """Chat with AVA - AI Visa Assistant"""
    
    # Generate session ID if not provided
    session_id = message.session_id or generate_id("chat")
    
    # Save user message
    user_msg = ChatMessageDB(
        id=generate_id("msg"),
        session_id=session_id,
        message=message.message,
        sender="user"
    )
    db.add(user_msg)
    
    # Process message with AVA
    response = process_ava_message(message.message, session_id, db)
    
    # Save AVA response
    ava_msg = ChatMessageDB(
        id=generate_id("msg"),
        session_id=session_id,
        message=response.response,
        sender="ava",
        message_metadata=json.dumps({
            "suggested_visa_type": response.suggested_visa_type,
            "next_action": response.next_action,
            "confidence": response.confidence
        })
    )
    db.add(ava_msg)
    
    db.commit()
    
    return response

@router.get("/history/{session_id}")
async def get_chat_history(session_id: str, db: Session = Depends(get_db)):
    """Get chat history for a session"""
    
    messages = db.query(ChatMessageDB).filter(
        ChatMessageDB.session_id == session_id
    ).order_by(ChatMessageDB.timestamp.asc()).all()
    
    return [
        {
            "id": msg.id,
            "message": msg.message,
            "sender": msg.sender,
            "timestamp": msg.timestamp,
            "metadata": json.loads(msg.message_metadata) if msg.message_metadata else None
        }
        for msg in messages
    ]

def process_ava_message(message: str, session_id: str, db: Session) -> ChatResponse:
    """Process user message and generate AVA response using Gemini AI"""
    
    # Use Gemini for intelligent categorization
    gemini_response = gemini_service.categorize_visa_request(message)
    
    if gemini_response:
        return gemini_response
    
    # Fallback response if Gemini is unavailable
    return ChatResponse(
        response="I'm having trouble connecting to my AI service right now. Could you please tell me what type of visa you're looking for? For example: tourist, business, student, work, family visit, or transit visa.",
        next_action="continue_chat",
        confidence=0.3,
        follow_up_questions=[
            "I need a tourist visa",
            "I'm traveling for business",
            "I want to study abroad",
            "I'm visiting family"
        ]
    )