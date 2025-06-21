# backend/routes/chat.py - AVA Chat API routes

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import json
import re
from typing import Dict, List

from database import get_db, ChatMessage as ChatMessageDB
from models import ChatMessage, ChatResponse, VisaType
from utils import generate_id

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
    """Process user message and generate AVA response"""
    
    message_lower = message.lower()
    
    # Greeting responses
    if any(word in message_lower for word in ["hi", "hello", "hey", "start"]):
        return ChatResponse(
            response="Hi! I'm AVA, your AI visa assistant. I can help you find the right visa and guide you through the application process. What type of travel are you planning? 🛂✈️",
            next_action="continue_chat",
            confidence=1.0
        )
    
    # Tourist visa detection
    if any(word in message_lower for word in ["tourist", "vacation", "holiday", "sightsee", "leisure", "travel"]):
        return ChatResponse(
            response="Perfect! For a tourist visa, you'll typically need a passport, bank statements, travel insurance, and a travel itinerary. The process usually takes 5-10 business days. Would you like me to start your application?",
            suggested_visa_type=VisaType.TOURIST,
            next_action="start_form",
            confidence=0.9,
            follow_up_questions=["How long do you plan to stay?", "Which country are you visiting?"]
        )
    
    # Business visa detection
    if any(word in message_lower for word in ["business", "work", "conference", "meeting", "company", "trade"]):
        return ChatResponse(
            response="Great! For a business visa, you'll need an invitation letter from the company, your employment details, and proof of business activities. This typically takes 7-15 business days. Shall we begin your application?",
            suggested_visa_type=VisaType.BUSINESS,
            next_action="start_form",
            confidence=0.85,
            follow_up_questions=["Do you have an invitation letter?", "What type of business activities?"]
        )
    
    # Student visa detection
    if any(word in message_lower for word in ["student", "study", "university", "college", "education", "course"]):
        return ChatResponse(
            response="Excellent! For a student visa, you'll need an acceptance letter from your educational institution, proof of finances, and academic transcripts. Processing takes 15-30 business days. Ready to start?",
            suggested_visa_type=VisaType.STUDENT,
            next_action="start_form",
            confidence=0.92,
            follow_up_questions=["Do you have an acceptance letter?", "What are you planning to study?"]
        )
    
    # Work visa detection
    if any(word in message_lower for word in ["work visa", "employment", "job", "employer", "hire"]):
        return ChatResponse(
            response="I can help with your work visa! You'll need a job offer letter, employer sponsorship, and proof of qualifications. Processing typically takes 20-45 business days. Let's get started!",
            suggested_visa_type=VisaType.WORK,
            next_action="start_form",
            confidence=0.88,
            follow_up_questions=["Do you have a job offer?", "What type of work will you be doing?"]
        )
    
    # Family visit detection
    if any(word in message_lower for word in ["family", "visit", "relative", "spouse", "parent", "child"]):
        return ChatResponse(
            response="I understand you want to visit family! You'll need an invitation from your family member, proof of relationship, and financial documentation. Processing typically takes 10-20 business days. Let's get started!",
            suggested_visa_type=VisaType.FAMILY_VISIT,
            next_action="start_form",
            confidence=0.88,
            follow_up_questions=["Who are you visiting?", "What's your relationship to them?"]
        )
    
    # Transit visa detection
    if any(word in message_lower for word in ["transit", "layover", "connecting", "stopover"]):
        return ChatResponse(
            response="For transit visas, you'll need your onward ticket and passport. Transit visas are usually processed within 1-3 business days. Would you like to apply?",
            suggested_visa_type=VisaType.TRANSIT,
            next_action="start_form",
            confidence=0.95,
            follow_up_questions=["How long is your layover?", "What's your final destination?"]
        )
    
    # Country-specific responses
    countries = extract_countries(message_lower)
    if countries:
        country = countries[0].title()
        return ChatResponse(
            response=f"I can help you with your visa for {country}! What's the purpose of your visit? Are you traveling for tourism, business, study, or another reason?",
            next_action="continue_chat",
            confidence=0.8,
            follow_up_questions=[
                f"Tourism in {country}",
                f"Business in {country}",
                f"Study in {country}"
            ]
        )
    
    # Help and guidance
    if any(word in message_lower for word in ["help", "guide", "what", "how", "need"]):
        return ChatResponse(
            response="I'm here to help! I can assist you with:\n\n• Finding the right visa type for your travel\n• Explaining document requirements\n• Guiding you through the application process\n• Checking your eligibility\n\nWhat would you like to know more about?",
            next_action="continue_chat",
            confidence=0.7,
            follow_up_questions=[
                "What visa types are available?",
                "What documents do I need?",
                "How long does processing take?"
            ]
        )
    
    # Default response
    return ChatResponse(
        response="I want to make sure I understand your needs correctly. Could you tell me more about your travel plans? For example:\n\n• What country are you planning to visit?\n• What's the purpose of your trip?\n• How long do you plan to stay?\n\nThis will help me recommend the right visa type for you! 🌍",
        next_action="continue_chat",
        confidence=0.5,
        follow_up_questions=[
            "I need a tourist visa",
            "I'm traveling for business",
            "I'm visiting family",
            "I'm going to study"
        ]
    )

def extract_countries(text: str) -> List[str]:
    """Extract country names from text"""
    countries = [
        "germany", "france", "spain", "italy", "netherlands", "uk", "united kingdom",
        "usa", "united states", "canada", "australia", "japan", "china", "india",
        "brazil", "mexico", "russia", "south africa", "egypt", "turkey"
    ]
    
    found_countries = []
    for country in countries:
        if country in text:
            found_countries.append(country)
    
    return found_countries