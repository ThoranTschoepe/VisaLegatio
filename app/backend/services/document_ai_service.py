import os
import base64
from typing import Optional
from pathlib import Path
from datetime import datetime
import json

# Document processing imports - using Gemini Vision instead of OCR
try:
    import pypdfium2  # type: ignore
except ImportError:  # pragma: no cover - optional dependency for demo environment
    pypdfium2 = None

# Google Gemini AI
try:
    from google import genai  # type: ignore
    from google.genai import types  # type: ignore
except ImportError:  # pragma: no cover - optional dependency for demo environment
    genai = None  # type: ignore
    types = None  # type: ignore
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# Simplified Pydantic schemas for Gemini API (following official docs)
class DocumentClassification(BaseModel):
    document_type: str
    confidence: float
    is_correct_type: bool

class ExtractedData(BaseModel):
    text_content: str
    dates: list[str]
    amounts: list[str]
    names: list[str]

class DetectedProblem(BaseModel):
    problem_type: str
    severity: str
    description: str
    suggestion: str

class DocumentAnalysis(BaseModel):
    classification: DocumentClassification
    extracted_data: ExtractedData
    problems: list[DetectedProblem]
    overall_confidence: float
    is_authentic: bool
    processing_time_ms: int

class DocumentAIService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        dependencies_ready = self.api_key and genai is not None and types is not None and pypdfium2 is not None

        if dependencies_ready:
            self.client = genai.Client(api_key=self.api_key)
            self.model = "gemini-2.5-flash"
            self.enabled = True
            print("🤖 Document AI Service initialized with Gemini Vision")
        else:
            self.client = None
            self.model = None
            self.enabled = False
            if not self.api_key:
                print("⚠️ GEMINI_API_KEY not found. Document AI disabled.")
            else:
                print("⚠️ Gemini or PDF dependencies missing. Document AI disabled for this environment.")

    async def analyze_document(
        self, 
        file_path: Path, 
        expected_doc_type: str,
        application_context: Optional[dict] = None
    ) -> Optional[DocumentAnalysis]:
        """
        Comprehensive AI analysis of uploaded document
        """
        if not self.enabled:
            return None
            
        start_time = datetime.now()
        
        try:
            # Extract text content from document
            text_content = await self._extract_text_content(file_path)
            
            # Prepare document for vision analysis
            image_data = await self._prepare_document_for_vision(file_path)
            
            # Perform AI analysis
            analysis_result = await self._perform_gemini_analysis(
                image_data, 
                text_content, 
                expected_doc_type, 
                application_context
            )
            
            # Calculate processing time
            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
            analysis_result.processing_time_ms = processing_time
            
            return analysis_result
            
        except Exception as e:
            print(f"❌ Document AI analysis failed: {e}")
            return None

    async def _extract_text_content(self, file_path: Path) -> str:
        """Extract text using Gemini Vision instead of OCR"""
        # We'll let Gemini Vision handle all text extraction
        # This method is kept for compatibility but returns empty string
        # since Gemini will analyze the image/PDF directly
        return ""


    async def _prepare_document_for_vision(self, file_path: Path) -> Optional[str]:
        """Prepare document image for Gemini Vision API"""
        try:
            file_ext = file_path.suffix.lower()
            print(f"📷 Preparing document for vision: {file_path} (type: {file_ext})")
            
            if file_ext == '.pdf':
                if not pypdfium2:
                    print("⚠️ pypdfium2 not available. Skipping PDF preview generation.")
                    return None
                # Convert first page of PDF to image using pypdfium2 (already available)
                print("🔄 Converting PDF to image...")
                pdf = pypdfium2.PdfDocument(file_path)
                if len(pdf) > 0:
                    page = pdf.get_page(0)
                    # Render page to image
                    bitmap = page.render(scale=2.0)  # Higher resolution
                    image = bitmap.to_pil()
                    
                    # Convert to base64
                    import io
                    buffer = io.BytesIO()
                    image.save(buffer, format='PNG')
                    image_data = base64.b64encode(buffer.getvalue()).decode('utf-8')
                    print(f"✅ PDF converted to image, base64 length: {len(image_data)}")
                    return image_data
                else:
                    print("❌ PDF has no pages")
                    
            elif file_ext in ['.jpg', '.jpeg', '.png']:
                # Read image and convert to base64
                print("🔄 Processing image file...")
                with open(file_path, 'rb') as image_file:
                    image_data = base64.b64encode(image_file.read()).decode('utf-8')
                print(f"✅ Image processed, base64 length: {len(image_data)}")
                return image_data
            else:
                print(f"❌ Unsupported file type: {file_ext}")
            
        except Exception as e:
            import traceback
            print(f"❌ Image preparation failed with detailed error:")
            print(f"   Error type: {type(e).__name__}")
            print(f"   Error message: {str(e)}")
            print(f"   Full traceback:")
            traceback.print_exc()
            
        return None

    async def _perform_gemini_analysis(
        self, 
        image_data: Optional[str], 
        text_content: str, 
        expected_doc_type: str,
        application_context: Optional[dict]
    ) -> DocumentAnalysis:
        """Use Gemini AI to analyze document content and image"""
        
        # Create analysis prompt
        prompt = self._create_analysis_prompt(expected_doc_type, application_context)
        
        # Prepare content for Gemini - prioritize image analysis over text
        if image_data:
            # Use Gemini Vision to analyze the image directly
            print("🔄 Creating content parts with image data for Gemini Vision...")
            try:
                # Decode base64 back to bytes for Gemini API
                image_bytes = base64.b64decode(image_data)
                content_parts = [
                    types.Part.from_text(text=prompt),
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type="image/png"
                    )
                ]
                print("✅ Content parts created successfully")
            except Exception as e:
                print(f"❌ Failed to create image content part: {e}")
                # Fall back to text-only
                content_parts = [types.Part.from_text(text=f"{prompt}\n\nNo image data available")]
        else:
            # Fallback to text-only analysis if no image
            print("ℹ️ No image data available, using text-only analysis")
            content_parts = [types.Part.from_text(text=f"{prompt}\n\nExtracted Text:\n{text_content}")]
        
        contents = [
            types.Content(
                role="user",
                parts=content_parts
            )
        ]
        
        try:
            # Configure response format with simplified schema
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=DocumentAnalysis,
            )
            
            print(f"🔍 Attempting Gemini API call with model: {self.model}")
            print(f"📊 Content parts: {len(content_parts)} parts")
            
            response = self.client.models.generate_content(
                model=self.model,
                contents=contents,
                config=config,
            )
            
            print(f"✅ Gemini API call successful")
            return response.parsed
            
        except Exception as e:
            import traceback
            print(f"❌ Gemini analysis failed with detailed error:")
            print(f"   Error type: {type(e).__name__}")
            print(f"   Error message: {str(e)}")
            print(f"   Full traceback:")
            traceback.print_exc()
            
            # Return basic analysis as fallback
            return self._create_fallback_analysis(text_content, expected_doc_type)

    def _create_analysis_prompt(self, expected_doc_type: str, context: Optional[dict]) -> str:
        """Create comprehensive analysis prompt for Gemini"""
        
        context_info = ""
        applicant_name = "Unknown"
        visa_type = "Unknown"
        destination_country = "Germany"
        purpose_of_travel = "Unknown"
        
        if context:
            context_info = f"Application Context: {json.dumps(context, indent=2)}\n"
            applicant_name = context.get('applicant_name', 'Unknown')
            visa_type = context.get('visa_type', 'Unknown')
            destination_country = context.get('destination_country', 'Germany')
            purpose_of_travel = context.get('purpose_of_travel', 'Unknown')
        
        return f"""You are a specialized AI assistant supporting embassy visa officers in document verification. Your analysis helps identify potential concerns requiring officer attention, but officers make all final decisions.

CASE INFORMATION:
- Expected Document: {expected_doc_type}
- Applicant: {applicant_name}
- Visa Type: {visa_type}
- Destination: {destination_country}
- Purpose: {purpose_of_travel}
{context_info}

ANALYSIS FRAMEWORK:

1. DOCUMENT CLASSIFICATION:
   - Identify actual document type vs expected
   - Classification confidence (0.0-1.0)
   - Document format compliance

2. CRITICAL DATA EXTRACTION:
   - All readable text content
   - Names (verify against applicant name: {applicant_name})
   - Dates (check validity, expiry, recency)
   - Financial amounts (balances, salaries, costs)
   - Official references (passport numbers, account numbers, etc.)

3. VISA-SPECIFIC RISK ASSESSMENT:
   Identify concerns that could affect visa approval:

   AUTHENTICITY CONCERNS (Critical/High severity):
   - Document tampering, alterations, or forgeries
   - Inconsistent fonts, layouts, or formatting
   - Missing security features, watermarks, or official stamps
   - Photo manipulation or replacement indicators

   COMPLIANCE ISSUES (High/Medium severity):
   - Expired documents (passport, insurance, etc.)
   - Insufficient validity periods (passport <6 months remaining)
   - Missing required fields or signatures
   - Incorrect document format or unofficial sources

   FINANCIAL RED FLAGS (High/Medium severity):
   - Insufficient funds for visa type
   - Negative account balances
   - Unexplained large deposits or suspicious transactions
   - Income inconsistent with stated employment

   TRAVEL PATTERN CONCERNS (Critical/High severity):
   - One-way tickets without return arrangements (especially for {purpose_of_travel} visits)
   - Destinations not matching stated purpose (check if {destination_country} aligns with {purpose_of_travel})
   - Travel dates conflicting with other documents
   - Frequent previous visa violations or overstays

   RELATIONSHIP/PURPOSE VERIFICATION (Medium severity):
   - Weak ties between inviter and applicant
   - Vague or inconsistent purpose statements
   - Missing host verification or contact details
   - Employment letters lacking specific details

   DOCUMENT QUALITY ISSUES (Low/Medium severity):
   - Poor image quality affecting readability
   - Incomplete or cropped documents
   - Multiple versions or conflicting information
   - Unofficial translations or certifications

4. SPECIFIC DOCUMENT CHECKS:

   PASSPORT:
   - Validity period (minimum 6 months remaining)
   - Name consistency with application
   - Previous visa stamps or travel history
   - Photo authenticity and condition

   BANK STATEMENT:
   - Account balance vs visa requirements
   - Transaction patterns (regular income, large withdrawals)
   - Statement period coverage (typically 3-6 months)
   - Bank letterhead and official seals

   INVITATION LETTER:
   - Host credentials and relationship proof
   - Specific visit details and duration
   - Financial responsibility commitments
   - Official letterhead and signatures

   EMPLOYMENT LETTER:
   - Job title, salary, and employment duration
   - Company verification details
   - Leave approval for travel dates
   - Official company letterhead and signatures

   FLIGHT ITINERARY:
   - Round-trip vs one-way booking concerns
   - Travel dates matching visa application
   - Booking confirmation vs reservation
   - Destination consistency with purpose

   INSURANCE:
   - Coverage amounts meeting visa requirements
   - Validity period covering entire stay
   - Geographic coverage including destination
   - Policy terms and exclusions

5. OFFICER RECOMMENDATIONS:
   For each concern identified:
   - Severity: critical/high/medium/low
   - Description: Clear, specific issue
   - Suggestion: Specific verification steps or follow-up actions

IMPORTANT: Focus on actionable concerns that help officers make informed decisions. Avoid generic observations - highlight specific issues that could impact visa approval or require additional verification."""

    def _create_fallback_analysis(self, text_content: str, expected_doc_type: str) -> DocumentAnalysis:
        """Create basic analysis when AI is unavailable"""
        
        # Basic text analysis
        has_content = bool(text_content.strip())
        word_count = len(text_content.split()) if text_content else 0
        
        problems = []
        if not has_content:
            problems.append(DetectedProblem(
                problem_type="no_text_content",
                severity="high",
                description="No readable text found in document",
                suggestion="Ensure document is clear and readable, try rescanning"
            ))
        elif word_count < 10:
            problems.append(DetectedProblem(
                problem_type="insufficient_content", 
                severity="medium",
                description="Document contains very little text content",
                suggestion="Verify document is complete and readable"
            ))
        
        return DocumentAnalysis(
            classification=DocumentClassification(
                document_type=expected_doc_type,
                confidence=0.3,
                is_correct_type=True
            ),
            extracted_data=ExtractedData(
                text_content=text_content,
                dates=[],
                amounts=[],
                names=[]
            ),
            problems=problems,
            overall_confidence=0.3,
            is_authentic=has_content,
            processing_time_ms=0
        )

    def get_document_requirements(self, doc_type: str) -> dict:
        """Get specific requirements for document type"""
        requirements = {
            "passport": {
                "required_fields": ["full_name", "date_of_birth", "passport_number", "expiry_date", "issuing_country"],
                "validity_period": "at least 6 months from travel date",
                "quality_requirements": ["clear photo page", "readable text", "no damage"]
            },
            "bank_statement": {
                "required_fields": ["account_holder", "account_number", "balance", "bank_name", "statement_period"],
                "min_balance": "varies by visa type",
                "period": "last 3-6 months",
                "quality_requirements": ["official letterhead", "bank stamps/signatures"]
            },
            "invitation_letter": {
                "required_fields": ["inviter_details", "invitee_details", "purpose", "duration", "contact_info"],
                "format": "official letterhead",
                "signatures": "required from inviter"
            }
        }
        
        return requirements.get(doc_type, {})

# Global service instance
document_ai_service = DocumentAIService()
