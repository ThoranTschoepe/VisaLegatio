# backend/services/gemini_service.py - Gemini AI integration for visa categorization

import os
from typing import Optional, List, Literal
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from models import VisaType, ChatResponse

load_dotenv()

# Structured output schema for Gemini
class VisaCategorization(BaseModel):
    """Structured schema for visa categorization - enforced by LLM"""
    visa_type: Literal["tourist", "business", "student", "work", "family_visit", "transit", "unknown"] = Field(
        description="Type of visa based on user's intent"
    )
    response: str = Field(
        description="Helpful response guiding user toward application",
        max_length=500
    )
    confidence: float = Field(
        description="Confidence level between 0.0 and 1.0",
        ge=0.0,
        le=1.0
    )
    next_action: Literal["start_form", "continue_chat"] = Field(
        description="Whether to start the application form or continue chatting"
    )
    follow_up_questions: List[str] = Field(
        description="Suggested follow-up questions",
        max_items=3
    )

class GeminiService:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            self.client = genai.Client(api_key=api_key)
            self.model = "gemini-2.0-flash-exp"
            self.generate_content_config = types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=VisaCategorization,
            )
            self.enabled = True
        else:
            self.client = None
            self.model = None
            self.enabled = False
            print("Warning: GEMINI_API_KEY not found. Gemini integration disabled.")
    
    def categorize_visa_request(self, user_message: str) -> Optional[ChatResponse]:
        """Use Gemini to categorize user's visa request and generate a response"""
        
        if not self.enabled:
            return None
        
        prompt = """You are AVA, an AI visa assistant. Analyze the user message and categorize their visa needs.

Guidelines:
- Be friendly and professional
- If visa type is clear, suggest starting the application
- If unclear, ask clarifying questions
- Include relevant document requirements for identified visa types
- Mention typical processing times (tourist: 5-10 days, business: 7-15 days, student: 15-30 days, work: 20-45 days, family: 10-20 days, transit: 1-3 days)
"""
        
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=f"{prompt}\n\nUser message: {user_message}"),
                ],
            ),
        ]

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=contents,
                config=self.generate_content_config,
            )
            
            # Parse the structured response
            result = response.parsed
            
            # Map visa type string to enum
            visa_type_map = {
                "tourist": VisaType.TOURIST,
                "business": VisaType.BUSINESS,
                "student": VisaType.STUDENT,
                "work": VisaType.WORK,
                "family_visit": VisaType.FAMILY_VISIT,
                "transit": VisaType.TRANSIT
            }
            
            suggested_visa_type = visa_type_map.get(result.visa_type, None)
            
            return ChatResponse(
                response=result.response,
                suggested_visa_type=suggested_visa_type,
                next_action=result.next_action,
                confidence=result.confidence,
                follow_up_questions=result.follow_up_questions
            )
            
        except Exception as e:
            print(f"Gemini API error: {e}")
            return None
    

# Singleton instance
gemini_service = GeminiService()