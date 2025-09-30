# backend/utils.py - Enhanced utility functions with organized document structure
import random
import string
import json
import hashlib
import os
import shutil
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from PIL import Image, ImageDraw, ImageFont
import io
import base64
from pathlib import Path
from database import (
    get_db_session,
    User,
    Application,
    Document,
    FlaggedDocument,
    Officer,
    StatusUpdate,
    BiasReview,
    ReviewAudit,
    FlagCategory,
    DecisionCategory,
    FlagDecisionRule,
    BiasMonitoringSnapshot,
    BiasInfluenceAttribute,
    BiasInfluenceModel,
    BiasInfluenceFactor,
    BiasReviewCadence,
)
from models import Question, QuestionValidation


def seed_flag_catalog(db: Session) -> Dict[str, FlagCategory]:
    """Ensure canonical flag/decision catalog entries exist for the flagging workflow."""

    categories_seed = [
        {
            "code": "document_gap",
            "label": "Document Gap",
            "description": "Missing, expired, or incomplete applicant documentation.",
        },
        {
            "code": "identity_mismatch",
            "label": "Identity Mismatch",
            "description": "Inconsistent identity attributes across documents or suspected identity fraud.",
        },
        {
            "code": "document_authenticity",
            "label": "Document Authenticity",
            "description": "Potential tampering or unverifiable document security features.",
        },
        {
            "code": "financial_concern",
            "label": "Financial Concern",
            "description": "Questions around funding sources, income stability, or affordability thresholds.",
        },
        {
            "code": "travel_intent_risk",
            "label": "Travel Intent Risk",
            "description": "Purpose of travel, itinerary, or sponsorship details appear inconsistent.",
        },
        {
            "code": "compliance_alert",
            "label": "Compliance Alert",
            "description": "Potential regulatory, sanctions, or security-list conflicts requiring escalation.",
        },
    ]

    decisions_seed = [
        {
            "code": "clear_to_proceed",
            "label": "Clear to Proceed",
            "description": "Senior reviewer confirms the flag is resolved with no further action.",
            "severity": "low",
        },
        {
            "code": "request_clarification",
            "label": "Request Clarification",
            "description": "Ask the frontline officer for additional narrative context before closing.",
            "severity": "medium",
        },
        {
            "code": "request_additional_docs",
            "label": "Request Additional Documents",
            "description": "Require the applicant to supply specific evidence before progressing.",
            "severity": "medium",
        },
        {
            "code": "issue_conditional_approval",
            "label": "Issue Conditional Approval",
            "description": "Allow the case to move forward with monitoring conditions noted.",
            "severity": "medium",
        },
        {
            "code": "escalate_to_policy",
            "label": "Escalate to Policy",
            "description": "Engage policy or legal experts for interpretation before a final decision.",
            "severity": "high",
        },
        {
            "code": "escalate_to_security",
            "label": "Escalate to Security & Compliance",
            "description": "Transfer to security/compliance specialists for immediate risk handling.",
            "severity": "critical",
        },
        {
            "code": "overturn_flag",
            "label": "Overturn Flag",
            "description": "Senior reviewer disagrees with the flag and clears it from the record.",
            "severity": "low",
        },
        {
            "code": "refer_for_training",
            "label": "Refer for Training",
            "description": "Flag indicates a coaching opportunity for frontline reviewers.",
            "severity": "low",
        },
    ]

    compatibility_seed = {
        ("document_gap", "clear_to_proceed"): False,
        ("document_gap", "request_clarification"): False,
        ("document_gap", "request_additional_docs"): True,
        ("document_gap", "issue_conditional_approval"): False,
        ("document_gap", "overturn_flag"): False,
        ("document_gap", "refer_for_training"): False,
        ("identity_mismatch", "clear_to_proceed"): False,
        ("identity_mismatch", "request_additional_docs"): True,
        ("identity_mismatch", "request_clarification"): False,
        ("identity_mismatch", "escalate_to_policy"): False,
        ("identity_mismatch", "escalate_to_security"): False,
        ("identity_mismatch", "overturn_flag"): False,
        ("identity_mismatch", "refer_for_training"): False,
        ("document_authenticity", "clear_to_proceed"): False,
        ("document_authenticity", "request_additional_docs"): True,
        ("document_authenticity", "escalate_to_policy"): False,
        ("document_authenticity", "escalate_to_security"): False,
        ("financial_concern", "clear_to_proceed"): False,
        ("financial_concern", "request_clarification"): False,
        ("financial_concern", "request_additional_docs"): True,
        ("financial_concern", "issue_conditional_approval"): False,
        ("financial_concern", "escalate_to_policy"): False,
        ("financial_concern", "refer_for_training"): False,
        ("travel_intent_risk", "clear_to_proceed"): False,
        ("travel_intent_risk", "request_clarification"): False,
        ("travel_intent_risk", "request_additional_docs"): True,
        ("travel_intent_risk", "issue_conditional_approval"): False,
        ("travel_intent_risk", "escalate_to_policy"): False,
        ("travel_intent_risk", "overturn_flag"): False,
        ("travel_intent_risk", "refer_for_training"): False,
        ("compliance_alert", "clear_to_proceed"): False,
        ("compliance_alert", "escalate_to_policy"): False,
        ("compliance_alert", "escalate_to_security"): False,
        ("compliance_alert", "overturn_flag"): False,
    }

    category_lookup: Dict[str, FlagCategory] = {}
    for entry in categories_seed:
        category = (
            db.query(FlagCategory)
            .filter(FlagCategory.code == entry["code"])
            .one_or_none()
        )
        if not category:
            category = FlagCategory(**entry)
            db.add(category)
            db.flush()
        else:
            category.label = entry["label"]
            category.description = entry["description"]
        category_lookup[category.code] = category

    decision_lookup: Dict[str, DecisionCategory] = {}
    for entry in decisions_seed:
        decision = (
            db.query(DecisionCategory)
            .filter(DecisionCategory.code == entry["code"])
            .one_or_none()
        )
        if not decision:
            decision = DecisionCategory(**entry)
            db.add(decision)
            db.flush()
        else:
            decision.label = entry["label"]
            decision.description = entry["description"]
            decision.severity = entry["severity"]
        decision_lookup[decision.code] = decision

    existing_rules = (
        db.query(FlagDecisionRule)
        .join(FlagCategory, FlagDecisionRule.flag_category_id == FlagCategory.id)
        .join(DecisionCategory, FlagDecisionRule.decision_id == DecisionCategory.id)
        .all()
    )

    pending_rules = compatibility_seed.copy()

    for rule in existing_rules:
        key = (rule.flag_category.code, rule.decision_category.code)
        if key in compatibility_seed:
            rule.requires_follow_up = compatibility_seed[key]
            pending_rules.pop(key, None)
        else:
            db.delete(rule)

    for (flag_code, decision_code), requires_follow_up in pending_rules.items():
        category = category_lookup.get(flag_code)
        decision = decision_lookup.get(decision_code)
        if not category or not decision:
            continue
        db.add(
            FlagDecisionRule(
                flag_category_id=category.id,
                decision_id=decision.id,
                requires_follow_up=requires_follow_up,
            )
        )

    db.flush()
    return category_lookup


def generate_id(prefix: str = "") -> str:
    """Generate a unique ID with optional prefix"""
    timestamp = str(int(datetime.now().timestamp() * 1000))[-8:]
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    
    if prefix:
        return f"{prefix}-{timestamp}-{random_part}"
    return f"{timestamp}-{random_part}"

def hash_password(password: str) -> str:
    """Simple password hashing for demo (use proper hashing in production)"""
    return hashlib.sha256(password.encode()).hexdigest()

def create_demo_passport_pdf(name: str, passport_number: str, nationality: str) -> bytes:
    """Create a simple demo passport PDF"""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Title
    p.setFont("Helvetica-Bold", 20)
    p.drawString(100, height - 100, "PASSPORT")
    
    # Passport details
    p.setFont("Helvetica", 12)
    y_position = height - 150
    
    details = [
        ("Full Name:", name),
        ("Passport Number:", passport_number),
        ("Nationality:", nationality),
        ("Date of Birth:", "01/01/1990"),
        ("Issue Date:", "01/01/2020"),
        ("Expiry Date:", "01/01/2030"),
        ("Place of Birth:", "Demo City")
    ]
    
    for label, value in details:
        p.drawString(100, y_position, f"{label} {value}")
        y_position -= 20
    
    # Add some official-looking elements
    p.setFont("Helvetica-Oblique", 10)
    p.drawString(100, 100, "This is a demonstration document for VisaLegatio demo purposes only.")
    
    p.showPage()
    p.save()
    buffer.seek(0)
    return buffer.getvalue()

def create_demo_photo(name: str) -> bytes:
    """Create a simple demo passport photo"""
    # Create a 400x500 image (passport photo ratio)
    img = Image.new('RGB', (400, 500), color='white')
    draw = ImageDraw.Draw(img)
    
    # Draw a simple face placeholder
    # Background
    draw.rectangle([50, 50, 350, 450], fill='lightblue')
    
    # Face circle
    draw.ellipse([150, 150, 250, 250], fill='peachpuff', outline='black', width=2)
    
    # Eyes
    draw.ellipse([170, 180, 185, 195], fill='black')
    draw.ellipse([215, 180, 230, 195], fill='black')
    
    # Nose
    draw.polygon([(200, 200), (195, 215), (205, 215)], fill='black')
    
    # Mouth
    draw.arc([180, 220, 220, 240], 0, 180, fill='black', width=2)
    
    # Add name at bottom
    try:
        # Try to use a better font
        font = ImageFont.truetype("arial.ttf", 20)
    except:
        # Fallback to default font
        font = ImageFont.load_default()
    
    draw.text((200, 460), name, fill='black', font=font, anchor='mm')
    
    # Convert to bytes
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=90)
    buffer.seek(0)
    return buffer.getvalue()

def create_demo_bank_statement(name: str, balance: str = "15,750.00") -> bytes:
    """Create a demo bank statement PDF"""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Header
    p.setFont("Helvetica-Bold", 16)
    p.drawString(100, height - 80, "DEMO BANK")
    p.setFont("Helvetica", 12)
    p.drawString(100, height - 100, "123 Banking Street, Demo City")
    
    # Account holder
    p.setFont("Helvetica-Bold", 14)
    p.drawString(100, height - 140, "ACCOUNT STATEMENT")
    
    p.setFont("Helvetica", 12)
    y_pos = height - 180
    
    account_info = [
        ("Account Holder:", name),
        ("Account Number:", "****-****-1234"),
        ("Statement Period:", "January 1, 2024 - March 31, 2024"),
        ("Current Balance:", f"${balance}"),
        ("Account Type:", "Checking Account")
    ]
    
    for label, value in account_info:
        p.drawString(100, y_pos, f"{label} {value}")
        y_pos -= 20
    
    # Transaction history
    y_pos -= 40
    p.setFont("Helvetica-Bold", 12)
    p.drawString(100, y_pos, "Recent Transactions:")
    y_pos -= 20
    
    p.setFont("Helvetica", 10)
    transactions = [
        ("2024-03-30", "Salary Deposit", "+$5,250.00"),
        ("2024-03-28", "Grocery Store", "-$89.50"),
        ("2024-03-25", "Online Transfer", "-$200.00"),
        ("2024-03-22", "ATM Withdrawal", "-$100.00"),
        ("2024-03-20", "Restaurant", "-$45.75")
    ]
    
    for date, description, amount in transactions:
        p.drawString(100, y_pos, f"{date}  {description:30} {amount:>12}")
        y_pos -= 15
    
    # Footer
    p.setFont("Helvetica-Oblique", 8)
    p.drawString(100, 80, "This is a demonstration document for VisaLegatio demo purposes only.")
    
    p.showPage()
    p.save()
    buffer.seek(0)
    return buffer.getvalue()

def create_demo_invitation_letter(applicant_name: str, company: str, visa_type: str) -> bytes:
    """Create a demo invitation letter PDF"""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Header
    p.setFont("Helvetica-Bold", 16)
    p.drawString(100, height - 80, company.upper())
    p.setFont("Helvetica", 12)
    p.drawString(100, height - 100, "123 Business Avenue, Demo City, Germany")
    p.drawString(100, height - 115, "Email: info@democompany.de | Phone: +49-123-456-789")
    
    # Date
    p.drawString(100, height - 150, f"Date: {datetime.now().strftime('%B %d, %Y')}")
    
    # Recipient
    p.drawString(100, height - 190, "To Whom It May Concern:")
    
    # Letter content
    y_pos = height - 230
    p.setFont("Helvetica", 11)
    
    if visa_type == "business":
        content = [
            f"We hereby invite {applicant_name} to visit our company in Germany for business purposes.",
            "",
            "Purpose of visit: Business meetings and conference attendance",
            "Duration of stay: 7 days",
            "Accommodation: Will be arranged by our company",
            "Financial responsibility: All expenses will be covered by our organization",
            "",
            f"We confirm that {applicant_name} is a valued business partner and we look forward",
            "to their visit to discuss future collaboration opportunities.",
            "",
            "Please do not hesitate to contact us if you require any additional information."
        ]
    elif visa_type == "student":
        content = [
            f"We are pleased to confirm that {applicant_name} has been accepted for admission",
            "to our educational program at Technical University of Munich.",
            "",
            "Program: Master's in Computer Science",
            "Duration: 24 months",
            "Start date: September 2024",
            "Tuition: Covered by scholarship",
            "",
            f"We confirm that all academic requirements have been met and we look forward",
            f"to welcoming {applicant_name} to our institution.",
        ]
    else:  # family visit or general
        content = [
            f"We hereby invite {applicant_name} to visit us in Germany.",
            "",
            "Purpose of visit: Family visit/Tourism",
            "Duration of stay: 14 days",
            "Accommodation: Will be provided at our residence",
            "Financial support: We will cover all expenses during the stay",
            "",
            f"We take full responsibility for {applicant_name} during their visit.",
        ]
    
    for line in content:
        p.drawString(100, y_pos, line)
        y_pos -= 15
    
    # Signature
    y_pos -= 30
    p.drawString(100, y_pos, "Sincerely,")
    y_pos -= 40
    p.drawString(100, y_pos, "Demo Company Representative")
    p.drawString(100, y_pos - 15, "Managing Director")
    
    # Footer
    p.setFont("Helvetica-Oblique", 8)
    p.drawString(100, 60, "This is a demonstration document for VisaLegatio demo purposes only.")
    
    p.showPage()
    p.save()
    buffer.seek(0)
    return buffer.getvalue()

def create_demo_employment_letter(employee_name: str) -> bytes:
    """Create a demo employment letter PDF"""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Header
    p.setFont("Helvetica-Bold", 16)
    p.drawString(100, height - 80, "TECH SOLUTIONS INC.")
    p.setFont("Helvetica", 12)
    p.drawString(100, height - 100, "456 Technology Drive, Demo City")
    p.drawString(100, height - 115, "Email: hr@techsolutions.com | Phone: +1-555-123-4567")
    
    # Date
    p.drawString(100, height - 150, f"Date: {datetime.now().strftime('%B %d, %Y')}")
    
    # Title
    p.setFont("Helvetica-Bold", 14)
    p.drawString(100, height - 190, "EMPLOYMENT VERIFICATION LETTER")
    
    # Content
    y_pos = height - 230
    p.setFont("Helvetica", 11)
    
    content = [
        "To Whom It May Concern:",
        "",
        f"This letter confirms that {employee_name} is employed with Tech Solutions Inc.",
        "as a Senior Software Engineer since January 15, 2020.",
        "",
        "Employment Details:",
        "• Position: Senior Software Engineer",
        "• Department: Software Development",
        "• Employment Type: Full-time",
        "• Annual Salary: $85,000",
        "• Employment Status: Active",
        "",
        f"{employee_name} is a valued member of our team and has been granted",
        "permission to travel for business purposes. Their position will be held",
        "during their absence.",
        "",
        "If you require any additional information, please contact our HR department."
    ]
    
    for line in content:
        p.drawString(100, y_pos, line)
        y_pos -= 15
    
    # Signature
    y_pos -= 30
    p.drawString(100, y_pos, "Sincerely,")
    y_pos -= 40
    p.drawString(100, y_pos, "Jane Smith")
    p.drawString(100, y_pos - 15, "Human Resources Director")
    p.drawString(100, y_pos - 30, "Tech Solutions Inc.")
    
    # Footer
    p.setFont("Helvetica-Oblique", 8)
    p.drawString(100, 60, "This is a demonstration document for VisaLegatio demo purposes only.")
    
    p.showPage()
    p.save()
    buffer.seek(0)
    return buffer.getvalue()

def create_demo_travel_insurance() -> bytes:
    """Create a demo travel insurance PDF"""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Header
    p.setFont("Helvetica-Bold", 16)
    p.drawString(100, height - 80, "DEMO TRAVEL INSURANCE")
    p.setFont("Helvetica", 12)
    p.drawString(100, height - 100, "789 Insurance Boulevard, Demo City")
    
    # Policy details
    p.setFont("Helvetica-Bold", 14)
    p.drawString(100, height - 140, "TRAVEL INSURANCE CERTIFICATE")
    
    y_pos = height - 180
    p.setFont("Helvetica", 11)
    
    policy_info = [
        ("Policy Number:", "TI-2024-567890"),
        ("Insured Person:", "Demo Traveler"),
        ("Coverage Period:", "March 1, 2024 - April 30, 2024"),
        ("Destination:", "Germany"),
        ("Coverage Amount:", "$100,000 USD"),
        ("Medical Coverage:", "$50,000 USD"),
        ("Emergency Evacuation:", "$1,000,000 USD")
    ]
    
    for label, value in policy_info:
        p.drawString(100, y_pos, f"{label} {value}")
        y_pos -= 20
    
    y_pos -= 20
    p.setFont("Helvetica-Bold", 12)
    p.drawString(100, y_pos, "Coverage Includes:")
    y_pos -= 20
    
    coverage = [
        "• Medical expenses due to illness or accident",
        "• Emergency medical evacuation",
        "• Trip cancellation and interruption",
        "• Personal liability coverage",
        "• 24/7 emergency assistance"
    ]
    
    p.setFont("Helvetica", 10)
    for item in coverage:
        p.drawString(100, y_pos, item)
        y_pos -= 15
    
    # Footer
    p.setFont("Helvetica-Oblique", 8)
    p.drawString(100, 80, "This is a demonstration document for VisaLegatio demo purposes only.")
    
    p.showPage()
    p.save()
    buffer.seek(0)
    return buffer.getvalue()

def create_demo_flight_itinerary() -> bytes:
    """Create a demo flight itinerary PDF"""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Header
    p.setFont("Helvetica-Bold", 16)
    p.drawString(100, height - 80, "DEMO AIRLINES")
    p.setFont("Helvetica", 12)
    p.drawString(100, height - 100, "Flight Confirmation & Itinerary")
    
    # Booking details
    p.setFont("Helvetica-Bold", 14)
    p.drawString(100, height - 140, "BOOKING CONFIRMATION")
    
    y_pos = height - 180
    p.setFont("Helvetica", 11)
    
    booking_info = [
        ("Confirmation Code:", "DA123456"),
        ("Passenger Name:", "Demo Traveler"),
        ("Booking Date:", datetime.now().strftime("%B %d, %Y")),
        ("Total Amount:", "$850.00 USD")
    ]
    
    for label, value in booking_info:
        p.drawString(100, y_pos, f"{label} {value}")
        y_pos -= 20
    
    # Flight details
    y_pos -= 20
    p.setFont("Helvetica-Bold", 12)
    p.drawString(100, y_pos, "FLIGHT DETAILS:")
    y_pos -= 30
    
    # Outbound flight
    p.setFont("Helvetica-Bold", 11)
    p.drawString(100, y_pos, "OUTBOUND FLIGHT")
    y_pos -= 20
    
    p.setFont("Helvetica", 10)
    outbound = [
        "Flight: DA 1234",
        "Date: March 15, 2024",
        "Departure: 10:30 AM - Demo City Airport (DCA)",
        "Arrival: 2:45 PM - Berlin Brandenburg Airport (BER)",
        "Duration: 8h 15m (1 stop)",
        "Seat: 14A"
    ]
    
    for detail in outbound:
        p.drawString(120, y_pos, detail)
        y_pos -= 15
    
    # Return flight
    y_pos -= 20
    p.setFont("Helvetica-Bold", 11)
    p.drawString(100, y_pos, "RETURN FLIGHT")
    y_pos -= 20
    
    p.setFont("Helvetica", 10)
    return_flight = [
        "Flight: DA 5678",
        "Date: March 29, 2024",
        "Departure: 4:20 PM - Berlin Brandenburg Airport (BER)",
        "Arrival: 11:35 PM - Demo City Airport (DCA)",
        "Duration: 9h 15m (1 stop)",
        "Seat: 12B"
    ]
    
    for detail in return_flight:
        p.drawString(120, y_pos, detail)
        y_pos -= 15
    
    # Footer
    p.setFont("Helvetica-Oblique", 8)
    p.drawString(100, 60, "This is a demonstration document for VisaLegatio demo purposes only.")
    
    p.showPage()
    p.save()
    buffer.seek(0)
    return buffer.getvalue()

def create_organized_documents_for_application(
    db: Session,
    app_id: str,
    visa_type: str,
    applicant_name: str,
    completion_level: str,
    specific_doc_types: Optional[List[str]] = None,
) -> List[Document]:
    """Create demo documents for an application in organized folder structure"""
    
    # Document requirements by visa type - UPDATED
    requirements = {
        "business": {
            "mandatory": ["passport", "invitation_letter"],
            "optional": ["employment_letter", "bank_statement"]
        },
        "tourist": {
            "mandatory": ["passport", "bank_statement"],
            "optional": ["travel_insurance", "flight_itinerary", "invitation_letter"]
        },
        "student": {
            "mandatory": ["passport", "invitation_letter", "bank_statement"],
            "optional": ["employment_letter"]
        },
        "work": {
            "mandatory": ["passport", "employment_letter", "invitation_letter"],
            "optional": ["bank_statement"]
        },
        "family_visit": {
            "mandatory": ["passport", "invitation_letter"],
            "optional": ["bank_statement", "employment_letter"]
        },
        "transit": {
            "mandatory": ["passport", "flight_itinerary"],
            "optional": []
        }
    }
    
    req = requirements.get(visa_type, requirements["business"])
    
    # Determine which documents to create based on completion level or explicit request
    if specific_doc_types:
        docs_to_create = specific_doc_types
    else:
        docs_to_create: List[str] = []

        if completion_level == "complete":
            # All mandatory + some optional
            docs_to_create = req["mandatory"] + req["optional"][:1]
        elif completion_level == "partial":
            # Some mandatory documents
            docs_to_create = req["mandatory"][:1]  # Just passport for partial
        elif completion_level == "minimal":
            # Just one document
            docs_to_create = req["mandatory"][:1]
        else:
            docs_to_create = []
        # "none" creates no documents
    
    # Create organized directory structure: uploads/app_id/
    app_uploads_dir = Path("uploads") / app_id
    app_uploads_dir.mkdir(parents=True, exist_ok=True)
    
    # Create actual document files and database records
    created_docs = []
    
    for doc_type in docs_to_create:
        try:
            existing_doc = (
                db.query(Document)
                .filter(Document.application_id == app_id, Document.type == doc_type)
                .first()
            )
            if existing_doc:
                created_docs.append(existing_doc)
                continue

            # Generate document content based on type
            if doc_type == "passport":
                # Create passport PDF that includes photo page
                content = create_demo_passport_pdf(applicant_name, f"PA{random.randint(100000, 999999)}", "Demo Country")
                filename = f"passport.pdf"
            elif doc_type == "bank_statement":
                content = create_demo_bank_statement(applicant_name)
                filename = f"bank_statement.pdf"
            elif doc_type == "invitation_letter":
                content = create_demo_invitation_letter(applicant_name, "Demo Company GmbH", visa_type)
                filename = f"invitation_letter.pdf"
            elif doc_type == "employment_letter":
                content = create_demo_employment_letter(applicant_name)
                filename = f"employment_letter.pdf"
            elif doc_type == "travel_insurance":
                content = create_demo_travel_insurance()
                filename = f"travel_insurance.pdf"
            elif doc_type == "flight_itinerary":
                content = create_demo_flight_itinerary()
                filename = f"flight_itinerary.pdf"
            else:
                continue  # Skip unknown document types
            
            # Save file to organized uploads directory
            file_path = app_uploads_dir / filename
            with open(file_path, 'wb') as f:
                f.write(content)
            
            # Create database record with relative path
            doc_id = generate_id("doc")
            document = Document(
                id=doc_id,
                application_id=app_id,
                name=filename,
                type=doc_type,
                size=len(content),
                verified=True,  # All demo docs are pre-verified
                uploaded_at=datetime.utcnow() - timedelta(hours=random.randint(1, 48)),
                file_path=f"uploads/{app_id}/{filename}"  # Store relative path
            )
            
            db.add(document)
            created_docs.append(document)
            
            print(f"📄 Created {doc_type} document: {file_path} ({len(content)} bytes)")
            
        except Exception as e:
            print(f"❌ Error creating {doc_type} document: {e}")
            continue
    
    return created_docs

def calculate_risk_score(visa_type: str, answers: Dict[str, Any]) -> int:
    """Calculate risk score based on visa type and answers"""
    
    # Base scores by visa type
    base_scores = {
        "tourist": 5,
        "business": 10,
        "student": 15,
        "work": 20,
        "family_visit": 8,
        "transit": 3
    }
    
    score = base_scores.get(visa_type, 10)
    
    # Duration factor
    duration = int(answers.get("duration", 0))
    if duration > 90:
        score += 15
    elif duration > 30:
        score += 10
    elif duration > 7:
        score += 5
    
    # Country factor (simplified)
    high_risk_countries = ["country_x", "country_y"]  # Demo placeholder
    if answers.get("destination_country", "").lower() in high_risk_countries:
        score += 20
    
    # Employment status
    if answers.get("employment_status") == "unemployed":
        score += 10
    
    # Previous visa violations (mock check)
    if answers.get("previous_violations", False):
        score += 25
    
    # Add some randomness for demo variety
    score += random.randint(0, 10)
    
    return min(max(score, 0), 100)

def calculate_approval_probability(risk_score: int, documents: List[Dict] = None) -> int:
    """Calculate approval probability based on risk score and documents"""
    
    if documents is None:
        documents = []
    
    # Base probability (inverse of risk)
    probability = 100 - risk_score
    
    # Document completeness factor
    if documents:
        verified_docs = sum(1 for doc in documents if doc.get("verified", False))
        total_docs = len(documents)
        doc_completeness = (verified_docs / total_docs) * 100 if total_docs > 0 else 0
        
        # Average with document completeness
        probability = (probability + doc_completeness) / 2
    
    # Keep in realistic range
    return max(min(int(probability), 95), 60)

def get_form_questions(visa_type: str, current_answers: Dict[str, Any] = None) -> List[Question]:
    """Get dynamic form questions based on visa type and current answers"""
    
    if current_answers is None:
        current_answers = {}
    
    # Base questions for all visa types
    base_questions = [
        Question(
            id="applicant_name",
            text="What is your full name?",
            type="text",
            required=True
        ),
        Question(
            id="destination_country",
            text="Which country are you applying to visit?",
            type="select",
            options=["Germany", "France", "Spain", "Italy", "Netherlands", "United Kingdom", "Other"],
            required=True
        ),
        Question(
            id="nationality",
            text="What is your nationality?",
            type="text",
            required=True
        ),
        Question(
            id="passport_number",
            text="Passport number",
            type="text",
            required=True,
            validation=QuestionValidation(
                pattern="^[A-Z0-9]{6,9}$",
                message="Please enter a valid passport number"
            )
        ),
        Question(
            id="email",
            text="Email address",
            type="text",
            required=True,
            validation=QuestionValidation(
                pattern="^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$",
                message="Please enter a valid email address"
            )
        ),
        Question(
            id="phone",
            text="Phone number",
            type="text",
            required=True
        )
    ]
    
    # Visa type specific questions
    visa_specific_questions = {
        "tourist": [
            Question(
                id="travel_purpose",
                text="What is the main purpose of your visit?",
                type="select",
                options=["Sightseeing", "Visiting friends/family", "Cultural events", "Medical treatment"],
                required=True
            ),
            Question(
                id="duration",
                text="How many days do you plan to stay?",
                type="number",
                required=True,
                validation=QuestionValidation(
                    min=1,
                    max=90,
                    message="Tourist stays are typically 1-90 days"
                )
            ),
            Question(
                id="accommodation",
                text="Where will you be staying?",
                type="select",
                options=["Hotel", "Airbnb", "With friends/family", "Hostel", "Other"],
                required=True
            ),
            Question(
                id="return_ticket",
                text="Do you have a return ticket?",
                type="select",
                options=["Yes", "No"],
                required=True
            )
        ],
        
        "business": [
            Question(
                id="business_purpose",
                text="What type of business activities?",
                type="select",
                options=["Conference/Meeting", "Training", "Negotiations", "Site visit", "Trade fair"],
                required=True
            ),
            Question(
                id="company_name",
                text="What is your company name?",
                type="text",
                required=True
            ),
            Question(
                id="invitation_company",
                text="Name of the inviting company/organization",
                type="text",
                required=True
            ),
            Question(
                id="duration",
                text="Duration of business visit (days)?",
                type="number",
                required=True,
                validation=QuestionValidation(
                    min=1,
                    max=30,
                    message="Business visits are typically 1-30 days"
                )
            ),
            Question(
                id="employment_letter",
                text="Do you have an employment letter from your company?",
                type="select",
                options=["Yes", "No"],
                required=True
            )
        ],
        
        "student": [
            Question(
                id="institution_name",
                text="Name of educational institution",
                type="text",
                required=True
            ),
            Question(
                id="study_level",
                text="Level of study",
                type="select",
                options=["Bachelor's degree", "Master's degree", "PhD", "Exchange program", "Language course"],
                required=True
            ),
            Question(
                id="study_duration",
                text="Duration of studies (months)",
                type="number",
                required=True,
                validation=QuestionValidation(
                    min=1,
                    max=60,
                    message="Study duration typically 1-60 months"
                )
            ),
            Question(
                id="acceptance_letter",
                text="Do you have an acceptance letter?",
                type="select",
                options=["Yes", "No"],
                required=True
            ),
            Question(
                id="financial_support",
                text="How will you finance your studies?",
                type="select",
                options=["Personal funds", "Scholarship", "Family support", "Student loan", "Other"],
                required=True
            )
        ],
        
        "work": [
            Question(
                id="job_title",
                text="Job title/position",
                type="text",
                required=True
            ),
            Question(
                id="employer_name",
                text="Employer company name",
                type="text",
                required=True
            ),
            Question(
                id="contract_duration",
                text="Contract duration (months)",
                type="number",
                required=True,
                validation=QuestionValidation(
                    min=1,
                    max=60,
                    message="Work contracts typically 1-60 months"
                )
            ),
            Question(
                id="work_permit",
                text="Do you have a work permit?",
                type="select",
                options=["Yes", "No", "Applied"],
                required=True
            ),
            Question(
                id="salary",
                text="Annual salary (in EUR)",
                type="number",
                required=True,
                validation=QuestionValidation(
                    min=20000,
                    message="Please enter annual salary"
                )
            )
        ],
        
        "family_visit": [
            Question(
                id="relationship",
                text="Relationship to person you're visiting",
                type="select",
                options=["Spouse", "Parent", "Child", "Sibling", "Grandparent", "Other family"],
                required=True
            ),
            Question(
                id="host_name",
                text="Name of person you're visiting",
                type="text",
                required=True
            ),
            Question(
                id="visit_duration",
                text="Duration of visit (days)",
                type="number",
                required=True,
                validation=QuestionValidation(
                    min=1,
                    max=180,
                    message="Family visits typically 1-180 days"
                )
            ),
            Question(
                id="invitation_letter",
                text="Do you have an invitation letter?",
                type="select",
                options=["Yes", "No"],
                required=True
            ),
            Question(
                id="host_status",
                text="Immigration status of your host",
                type="select",
                options=["Citizen", "Permanent resident", "Temporary resident", "Student", "Other"],
                required=True
            )
        ],
        
        "transit": [
            Question(
                id="final_destination",
                text="What is your final destination?",
                type="text",
                required=True
            ),
            Question(
                id="transit_duration",
                text="How long is your layover (hours)?",
                type="number",
                required=True,
                validation=QuestionValidation(
                    min=1,
                    max=24,
                    message="Transit typically 1-24 hours"
                )
            ),
            Question(
                id="onward_ticket",
                text="Do you have an onward ticket?",
                type="select",
                options=["Yes", "No"],
                required=True
            )
        ]
    }
    
    # Combine base questions with visa-specific questions
    questions = base_questions + visa_specific_questions.get(visa_type, [])
    
    return questions

def seed_demo_data():
    """Seed database with demo data and organized document files"""
    
    db = get_db_session()
    
    try:
        category_lookup = seed_flag_catalog(db)

        # Check if data already exists
        if db.query(Officer).count() > 0:
            print("📄 Demo data already exists, but checking for organized document files...")
            
            # Check if organized document files exist
            demo_app_ids = ["VSV-240101-A1B2", "VSV-240102-C3D4", "VSV-240103-E5F6", "VSV-240104-G7H8"]
            
            files_exist = False
            for app_id in demo_app_ids:
                app_dir = Path("uploads") / app_id
                if app_dir.exists() and any(app_dir.iterdir()):
                    files_exist = True
                    break
            
            if files_exist:
                print("📄 Organized demo document files already exist, skipping file creation...")
                return
            else:
                print("📄 Demo data exists but organized files missing, creating document files...")
        
        # Install required dependencies
        try:
            from reportlab.pdfgen import canvas
            from PIL import Image
        except ImportError:
            print("📦 Installing required packages for document generation...")
            import subprocess
            import sys
            
            packages = ["reportlab", "Pillow"]
            for package in packages:
                try:
                    subprocess.check_call([sys.executable, "-m", "pip", "install", package])
                    print(f"✅ Installed {package}")
                except subprocess.CalledProcessError:
                    print(f"❌ Failed to install {package} - documents will be basic")
        
        # Clear existing uploads directory and recreate
        uploads_dir = Path("uploads")
        if uploads_dir.exists():
            shutil.rmtree(uploads_dir)
            print("🗑️  Cleared existing uploads directory")
        
        uploads_dir.mkdir(exist_ok=True)
        print("📁 Created fresh uploads directory")
        
        # Create demo officers if they don't exist
        if db.query(Officer).count() == 0:
            officers = [
                Officer(
                    id="maria.schmidt",
                    name="Officer Maria Schmidt",
                    email="maria@embassy.gov",
                    role="Senior Consular Officer",
                    embassy_id="us_berlin",
                    password_hash="demo123"  # In real app, use proper password hashing
                ),
                Officer(
                    id="john.davis",
                    name="Officer John Davis",
                    email="john@embassy.gov",
                    role="Consular Officer",
                    embassy_id="us_berlin",
                    password_hash="demo123"
                ),
                Officer(
                    id="admin",
                    name="Administrator",
                    email="admin@embassy.gov",
                    role="System Administrator",
                    embassy_id="us_berlin",
                    password_hash="admin"
                )
            ]
            
            for officer in officers:
                db.add(officer)
        
        # Create demo users and applications with FIXED IDs and organized documents
        demo_applications = [
            {
                "id": "VSV-240101-A1B2",  # Fixed ID for demo
                "user_id": "user-sarah-johnson",
                "applicant_name": "Sarah Johnson",
                "visa_type": "business",
                "status": "officer_review",
                "country": "United States",
                "demo_password": "DEMO123",  # Demo password
                "document_completion": "complete",  # All required docs + some optional
                "flags": [
                    {
                        "document_type": "invitation_letter",
                        "flag_type": "travel_intent_risk",
                        "reason": "Invitation letter references multi-month stay; confirm itinerary.",
                        "resolved": False,
                        "flagged_days_ago": 2,
                        "flagged_by_officer_id": "maria.schmidt",
                    }
                ],
                "answers": {
                    "applicant_name": "Sarah Johnson",
                    "destination_country": "United States",
                    "business_purpose": "Conference/Meeting",
                    "company_name": "Tech Solutions Inc.",
                    "invitation_company": "Berlin Tech Conference",
                    "duration": "7",
                    "email": "sarah.johnson@techsolutions.com",
                    "phone": "+1-555-0123",
                    "nationality": "American",
                    "passport_number": "US1234567"
                }
            },
            {
                "id": "VSV-240102-C3D4",  # Fixed ID for demo
                "user_id": "user-miguel-rodriguez",
                "applicant_name": "Miguel Rodriguez",
                "visa_type": "tourist",
                "status": "document_review",
                "country": "Spain",
                "demo_password": "DEMO456",  # Demo password
                "document_completion": "partial",  # Some docs missing
                "flags": [
                    {
                        "document_type": "passport",
                        "flag_type": "document_authenticity",
                        "reason": "Glare on biometric data page prevents validation; request rescan.",
                        "resolved": False,
                        "flagged_days_ago": 1,
                        "flagged_by_officer_id": "maria.schmidt",
                    }
                ],
                "answers": {
                    "applicant_name": "Miguel Rodriguez",
                    "destination_country": "Spain",
                    "travel_purpose": "Sightseeing",
                    "duration": "14",
                    "accommodation": "Hotel",
                    "email": "miguel.rodriguez@email.com",
                    "phone": "+34-666-123456",
                    "nationality": "Spanish",
                    "passport_number": "ES9876543"
                }
            },
            {
                "id": "VSV-240103-E5F6",  # Fixed ID for demo
                "user_id": "user-anna-chen",
                "applicant_name": "Anna Chen",
                "visa_type": "student",
                "status": "background_check",
                "country": "China",
                "demo_password": "DEMO789",  # Demo password
                "document_completion": "complete",  # All docs uploaded
                "answers": {
                    "applicant_name": "Anna Chen",
                    "destination_country": "China",
                    "institution_name": "Technical University of Munich",
                    "study_level": "Master's degree",
                    "study_duration": "24",
                    "email": "anna.chen@student.tum.de",
                    "phone": "+86-138-0013-8000",
                    "nationality": "Chinese",
                    "passport_number": "CN5555666"
                }
            },
            {
                "id": "VSV-240104-G7H8",  # Fixed ID for demo
                "user_id": "user-james-wilson",
                "applicant_name": "James Wilson",
                "visa_type": "work",
                "status": "submitted",
                "country": "United Kingdom",
                "demo_password": "DEMO999",  # Demo password
                "document_completion": "minimal",  # Just started uploading
                "answers": {
                    "applicant_name": "James Wilson",
                    "destination_country": "United Kingdom",
                    "job_title": "Software Engineer",
                    "employer_name": "German Tech Corp",
                    "contract_duration": "36",
                    "email": "james.wilson@germantech.de",
                    "phone": "+44-20-7946-0958",
                    "nationality": "British",
                    "passport_number": "GB7777888"
                }
            },
            {
                "id": "VSV-240105-J1K2",
                "user_id": "user-olivia-martinez",
                "applicant_name": "Olivia Martinez",
                "visa_type": "business",
                "status": "officer_review",
                "country": "Canada",
                "demo_password": "DEMO555",
                "document_completion": "complete",
                "answers": {
                    "applicant_name": "Olivia Martinez",
                    "destination_country": "Canada",
                    "business_purpose": "Client Onboarding",
                    "company_name": "Northern Consulting",
                    "invitation_company": "Munich FinTech Summit",
                    "duration": "10",
                    "email": "olivia.martinez@northern.ca",
                    "phone": "+1-416-555-7788",
                    "nationality": "Canadian",
                    "passport_number": "CA1122334"
                }
            },
            {
                "id": "VSV-240106-L3M4",
                "user_id": "user-hassan-ali",
                "applicant_name": "Hassan Ali",
                "visa_type": "student",
                "status": "officer_review",
                "country": "United Arab Emirates",
                "demo_password": "DEMO666",
                "document_completion": "complete",
                "answers": {
                    "applicant_name": "Hassan Ali",
                    "destination_country": "United Arab Emirates",
                    "institution_name": "RWTH Aachen University",
                    "study_level": "Master's degree",
                    "study_duration": "18",
                    "email": "hassan.ali@student.rwth.de",
                    "phone": "+971-50-123-4567",
                    "nationality": "Emirati",
                    "passport_number": "AE3344556"
                }
            }
        ]
        
        priority_cycle = ["high", "normal", "normal", "urgent"]

        for i, app_data in enumerate(demo_applications):
            # Create user with fixed ID if not exists
            existing_user = db.query(User).filter(User.id == app_data["user_id"]).first()
            if not existing_user:
                user = User(
                    id=app_data["user_id"],
                    email=app_data["answers"]["email"],
                    name=app_data["applicant_name"],
                    phone=app_data["answers"]["phone"],
                    nationality=app_data["country"]
                )
                db.add(user)
            
            # Add demo password hash to answers
            answers_with_password = app_data["answers"].copy()
            answers_with_password["access_password_hash"] = hash_password(app_data["demo_password"])
            
            # Calculate risk score
            risk_score = calculate_risk_score(app_data["visa_type"], answers_with_password)
            
            # Create application with fixed ID if not exists
            existing_app = db.query(Application).filter(Application.id == app_data["id"]).first()
            application = existing_app
            if not application:
                application = Application(
                    id=app_data["id"],  # Use fixed ID
                    user_id=app_data["user_id"],
                    visa_type=app_data["visa_type"],
                    status=app_data["status"],
                    priority=priority_cycle[i % len(priority_cycle)],
                    risk_score=risk_score,
                    answers=json.dumps(answers_with_password),
                    submitted_at=datetime.utcnow() - timedelta(days=random.randint(1, 5)),
                    approval_probability=calculate_approval_probability(risk_score),
                    assigned_officer_id="maria.schmidt" if i < 2 else "john.davis"
                )
                db.add(application)

            # Create organized demo documents with real files
            print(f"📄 Creating organized documents for {app_data['applicant_name']} ({app_data['document_completion']} completion)...")
            created_docs = create_organized_documents_for_application(
                db, 
                app_data["id"], 
                app_data["visa_type"], 
                app_data["applicant_name"],
                app_data["document_completion"]
            )

            print(f"✅ Created {len(created_docs)} documents in uploads/{app_data['id']}/ for {app_data['applicant_name']}")

            # Make newly added documents queryable within this session
            db.flush()
            all_docs_for_seed = (
                db.query(Document)
                .filter(Document.application_id == app_data["id"])
                .all()
            )
            document_lookup = {doc.type: doc for doc in all_docs_for_seed}

            # Create initial status update if not exists
            existing_status = db.query(StatusUpdate).filter(StatusUpdate.application_id == app_data["id"]).first()
            if not existing_status:
                status_update = StatusUpdate(
                    id=generate_id("status"),
                    application_id=app_data["id"],
                    status="submitted",
                    notes=f"Application submitted by {app_data['applicant_name']}",
                    timestamp=datetime.utcnow() - timedelta(days=random.randint(1, 5))
                )
                db.add(status_update)
                
                if app_data["status"] != "submitted":
                    current_status = StatusUpdate(
                        id=generate_id("status"),
                        application_id=app_data["id"],
                        status=app_data["status"],
                        notes=f"Status updated to {app_data['status']}",
                        officer_id="maria.schmidt" if i < 2 else "john.davis",
                        timestamp=datetime.utcnow() - timedelta(hours=random.randint(1, 24))
                    )
                    db.add(current_status)

            flag_specs = app_data.get("flags") or []
            if flag_specs:
                # Ensure application reflects flagged status
                if application.status != "flagged_for_review":
                    application.status = "flagged_for_review"

                documents_query = db.query(Document).filter(Document.application_id == app_data["id"])
                new_flag_records = []

                for flag_spec in flag_specs:
                    reason_text = flag_spec.get("reason")

                    existing_flag = (
                        db.query(FlaggedDocument)
                        .filter(
                            FlaggedDocument.application_id == app_data["id"],
                            FlaggedDocument.reason == reason_text,
                        )
                        .first()
                    )
                    if existing_flag:
                        continue

                    desired_type = flag_spec.get("document_type")
                    document = None
                    if desired_type:
                        if desired_type not in document_lookup:
                            extra_docs = create_organized_documents_for_application(
                                db,
                                app_data["id"],
                                app_data["visa_type"],
                                app_data["applicant_name"],
                                app_data.get("document_completion", "partial"),
                                specific_doc_types=[desired_type],
                            )
                            db.flush()
                            for extra_doc in extra_docs:
                                document_lookup[extra_doc.type] = extra_doc
                        
                        document = document_lookup.get(desired_type)
                        if not document:
                            document = documents_query.filter(Document.type == desired_type).first()
                    if not document:
                        document = next(iter(document_lookup.values()), None)
                    if not document:
                        document = documents_query.order_by(Document.uploaded_at.asc()).first()
                    if not document:
                        print(
                            f"⚠️  Skipping base flag seed for {app_data['id']} – no document found"
                        )
                        continue

                    flagged_days = flag_spec.get("flagged_days_ago")
                    flagged_at = (
                        datetime.utcnow() - timedelta(days=flagged_days)
                        if flagged_days is not None
                        else datetime.utcnow() - timedelta(days=1)
                    )

                    resolved = bool(flag_spec.get("resolved", False))
                    resolved_days = flag_spec.get("resolved_days_ago")
                    resolved_at = None
                    if resolved:
                        if resolved_days is not None:
                            resolved_at = datetime.utcnow() - timedelta(days=resolved_days)
                        else:
                            resolved_at = flagged_at + timedelta(days=1)

                    flagged_by = (
                        flag_spec.get("flagged_by_officer_id")
                        or application.assigned_officer_id
                        or "maria.schmidt"
                    )

                    flag_record = FlaggedDocument(
                        id=generate_id("flag"),
                        user_id=app_data["user_id"],
                        document_id=document.id,
                        application_id=app_data["id"],
                        reason=reason_text,
                        flagged_by_officer_id=flagged_by,
                        flagged_at=flagged_at,
                        resolved=resolved,
                        resolved_at=resolved_at,
                    )

                    flag_code = flag_spec.get("flag_type")
                    if flag_code and flag_code in category_lookup:
                        flag_record.category = category_lookup[flag_code]
                    elif flag_code:
                        print(
                            f"⚠️  Unknown flag category '{flag_code}' for {app_data['id']}, defaulting to document_gap"
                        )
                        flag_record.category = category_lookup.get("document_gap")
                    else:
                        flag_record.category = category_lookup.get("document_gap")

                    db.add(flag_record)
                    new_flag_records.append((flag_record, flagged_at, flagged_by))

                if new_flag_records:
                    officer_for_review = new_flag_records[0][2]
                    existing_bias_review = (
                        db.query(BiasReview)
                        .filter(BiasReview.application_id == app_data["id"])
                        .first()
                    )

                    if not existing_bias_review:
                        primary_reason = new_flag_records[0][0].reason or "Flag review required"
                        bias_review = BiasReview(
                            id=generate_id("biasreview"),
                            application_id=app_data["id"],
                            officer_id=officer_for_review,
                            result="uncertain",
                            notes=primary_reason,
                            ai_confidence=random.randint(60, 85),
                            audit_status="pending",
                            reviewed_at=datetime.utcnow() - timedelta(hours=random.randint(2, 12)),
                        )
                        db.add(bias_review)
                    else:
                        bias_review = existing_bias_review
                        if not bias_review.audit_status or bias_review.audit_status == "clear_to_proceed":
                            bias_review.audit_status = "pending"

                    for flag_record, _, _ in new_flag_records:
                        flag_record.bias_review = bias_review

                    existing_flag_status = (
                        db.query(StatusUpdate)
                        .filter(
                            StatusUpdate.application_id == app_data["id"],
                            StatusUpdate.status == "flagged_for_review",
                        )
                        .first()
                    )

                    if not existing_flag_status:
                        earliest_flag_time = min(record[1] for record in new_flag_records)
                        status_note = "Application flagged for senior review."
                        flag_status_update = StatusUpdate(
                            id=generate_id("status"),
                            application_id=app_data["id"],
                            status="flagged_for_review",
                            notes=status_note,
                            officer_id=new_flag_records[0][2],
                            timestamp=earliest_flag_time,
                        )
                        db.add(flag_status_update)

        # Demo bias review cases for monitoring UI (legacy sample data)
        demo_bias_cases = [
            {
                "application_id": "VSV-240201-BIAS1",
                "user_id": "user-ahmed-hassan",
                "applicant_name": "Ahmed Hassan",
                "visa_type": "tourist",
                "country": "Egypt",
                "risk_score": 65,
                "days_offset": 5,
                "rejection_reason": "High risk score due to country of origin and limited travel history",
                "review": {
                    "officer_id": "john.davis",
                    "result": "justified",
                    "notes": "Risk scoring aligns with policy; requesting supporting travel history.",
                    "ai_confidence": 68,
                    "audit_status": "clear_to_proceed",
                    "reviewed_days_ago": 2
                },
                "wealth_level": "middle",
                "document_quantity": "low",
                "invitation_letter": "no",
                "origin_country": "Egypt",
                "flags": [
                    {
                        "document_type": "passport",
                        "flag_type": "document_authenticity",
                        "reason": "Passport scan had glare on biographic page; authenticity recheck required.",
                        "resolved": True,
                        "flagged_days_ago": 6,
                        "resolved_days_ago": 4,
                    }
                ],
            },
            {
                "application_id": "VSV-240202-BIAS2",
                "user_id": "user-fatima-al-rashid",
                "applicant_name": "Fatima Al-Rashid",
                "visa_type": "student",
                "country": "Syria",
                "risk_score": 72,
                "days_offset": 4,
                "rejection_reason": "Insufficient financial documentation despite scholarship",
                "review": {
                    "officer_id": "john.davis",
                    "result": "biased",
                    "notes": "Applicant has a full scholarship. Financial requirements should be waived.",
                    "ai_confidence": 74,
                    "audit_status": "pending",
                    "reviewed_days_ago": 2
                },
                "wealth_level": "low",
                "document_quantity": "medium",
                "invitation_letter": "yes",
                "origin_country": "Syria",
                "flags": [
                    {
                        "document_type": "bank_statement",
                        "flag_type": "financial_concern",
                        "reason": "Bank statement shows balance volatility relative to scholarship coverage.",
                        "resolved": False,
                        "flagged_days_ago": 3,
                    }
                ],
            },
            {
                "application_id": "VSV-240203-BIAS3",
                "user_id": "user-vladimir-petrov",
                "applicant_name": "Vladimir Petrov",
                "visa_type": "business",
                "country": "Russia",
                "risk_score": 80,
                "days_offset": 6,
                "rejection_reason": "Geopolitical risk factors and incomplete documentation",
                "review": {
                    "officer_id": "maria.schmidt",
                    "result": "justified",
                    "notes": "Missing critical business documents. Rejection is warranted.",
                    "ai_confidence": 82,
                    "audit_status": "clear_to_proceed",
                    "reviewed_days_ago": 3,
                    "audit": {
                        "auditor_id": "maria.schmidt",
                        "decision": "clear_to_proceed",
                    "notes": "Double-checked documents; decision stands.",
                    "days_ago": 2
                    }
                },
                "wealth_level": "high",
                "document_quantity": "high",
                "invitation_letter": "yes",
                "origin_country": "Russia",
            },
            {
                "application_id": "VSV-240204-BIAS4",
                "user_id": "user-chen-wei",
                "applicant_name": "Chen Wei",
                "visa_type": "family_visit",
                "country": "China",
                "risk_score": 45,
                "days_offset": 7,
                "rejection_reason": "Name similarity to watchlist entry (false positive)",
                "review": {
                    "officer_id": "maria.schmidt",
                    "result": "biased",
                    "notes": "Manual verification cleared the watchlist match; rejection overturned.",
                    "ai_confidence": 71,
                    "audit_status": "pending",
                    "reviewed_days_ago": 1
                },
                "wealth_level": "middle",
                "document_quantity": "medium",
                "invitation_letter": "no",
                "origin_country": "China",
                "flags": [
                    {
                        "document_type": "passport",
                        "flag_type": "identity_mismatch",
                        "reason": "Biographic data cross-check flagged potential alias on watchlist.",
                        "resolved": False,
                        "flagged_days_ago": 2,
                    }
                ],
            },
            {
                "application_id": "VSV-240205-BIAS5",
                "user_id": "user-maria-gonzalez",
                "applicant_name": "Maria Gonzalez",
                "visa_type": "tourist",
                "country": "Mexico",
                "risk_score": 55,
                "days_offset": 8,
                "rejection_reason": "Previous overstay by family member",
                "review": {
                    "officer_id": "admin",
                    "result": "biased",
                    "notes": "Applicant should not be penalized for family member actions.",
                    "ai_confidence": 69,
                    "audit_status": "pending",
                    "reviewed_days_ago": 4
                },
                "wealth_level": "middle",
                "document_quantity": "high",
                "invitation_letter": "yes",
                "origin_country": "Mexico",
                "flags": [
                    {
                        "document_type": "invitation_letter",
                        "flag_type": "travel_intent_risk",
                        "reason": "Invitation letter wording suggests possible extended stay beyond visa term.",
                        "resolved": False,
                        "flagged_days_ago": 5,
                    }
                ],
            },
        ]

        attribute_seed = [
            {
                "id": "origin_colombia",
                "category_id": "origin_trends",
                "category_title": "Country of Origin",
                "label": "Origin · Colombia",
                "explanation": "Applications submitted by Colombian nationals in the monitoring window.",
                "feature": {
                    "type": "country_in",
                    "path": "nationality",
                    "values": ["Colombia"],
                },
            },
            {
                "id": "origin_kenya",
                "category_id": "origin_trends",
                "category_title": "Country of Origin",
                "label": "Origin · Kenya",
                "explanation": "Applications submitted by Kenyan nationals in the monitoring window.",
                "feature": {
                    "type": "country_in",
                    "path": "nationality",
                    "values": ["Kenya"],
                },
            },
            {
                "id": "origin_philippines",
                "category_id": "origin_trends",
                "category_title": "Country of Origin",
                "label": "Origin · Philippines",
                "explanation": "Applications submitted by Filipino nationals in the monitoring window.",
                "feature": {
                    "type": "country_in",
                    "path": "nationality",
                    "values": ["Philippines"],
                },
            },
            {
                "id": "doc_quantity_low",
                "category_id": "documentation",
                "category_title": "Document Quantity",
                "label": "Document Quantity · Low",
                "explanation": "Applications where the document intake remained below expected thresholds (self-declared).",
                "feature": {
                    "type": "answer_equals",
                    "path": "document_quantity",
                    "value": "low",
                },
            },
            {
                "id": "doc_quantity_high",
                "category_id": "documentation",
                "category_title": "Document Quantity",
                "label": "Document Quantity · High",
                "explanation": "Applications accompanied by comprehensive supporting documentation.",
                "feature": {
                    "type": "answer_equals",
                    "path": "document_quantity",
                    "value": "high",
                },
            },
            {
                "id": "wealth_level_low",
                "category_id": "wealth_profile",
                "category_title": "Wealth Level",
                "label": "Wealth Level · Low",
                "explanation": "Declared wealth level categorised as low in the intake questionnaire.",
                "feature": {
                    "type": "answer_equals",
                    "path": "wealth_level",
                    "value": "low",
                },
            },
            {
                "id": "wealth_level_middle",
                "category_id": "wealth_profile",
                "category_title": "Wealth Level",
                "label": "Wealth Level · Middle",
                "explanation": "Declared wealth level categorised as middle in the intake questionnaire.",
                "feature": {
                    "type": "answer_equals",
                    "path": "wealth_level",
                    "value": "middle",
                },
            },
            {
                "id": "wealth_level_high",
                "category_id": "wealth_profile",
                "category_title": "Wealth Level",
                "label": "Wealth Level · High",
                "explanation": "Declared wealth level categorised as high in the intake questionnaire.",
                "feature": {
                    "type": "answer_equals",
                    "path": "wealth_level",
                    "value": "high",
                },
            },
            {
                "id": "invitation_letter_yes",
                "category_id": "documentation",
                "category_title": "Document Quantity",
                "label": "Invitation Letter · Provided",
                "explanation": "Applicant supplied an invitation letter as part of the submission.",
                "feature": {
                    "type": "answer_equals",
                    "path": "invitation_letter",
                    "value": "yes",
                },
            },
            {
                "id": "invitation_letter_no",
                "category_id": "documentation",
                "category_title": "Document Quantity",
                "label": "Invitation Letter · Not Provided",
                "explanation": "Applicant did not include an invitation letter.",
                "feature": {
                    "type": "answer_equals",
                    "path": "invitation_letter",
                    "value": "no",
                },
            },
        ]

        cadence_seed = [
            {
                "interval": "0-25 (low risk)",
                "review_time": "8m median",
                "view_time": "1m 30s / document",
                "cases": 12,
            },
            {
                "interval": "25-50 (emerging risk)",
                "review_time": "18m median",
                "view_time": "3m 40s / document",
                "cases": 24,
            },
            {
                "interval": "50-70 (heightened risk)",
                "review_time": "46m median",
                "view_time": "7m 50s / document",
                "cases": 15,
            },
            {
                "interval": "70-100 (critical risk)",
                "review_time": "1h 32m median",
                "view_time": "14m 10s / document",
                "cases": 9,
            },
        ]

        seed_overrides_path = Path(__file__).resolve().parent.parent.parent / "docs" / "event_seed.json"
        override_influence = None

        if seed_overrides_path.exists():
            try:
                override_payload = json.loads(seed_overrides_path.read_text())
                demo_bias_cases = override_payload.get("bias_cases", demo_bias_cases)
                attribute_seed = override_payload.get("attributes", attribute_seed)
                cadence_seed = override_payload.get("cadence", cadence_seed)
                override_influence = override_payload.get("influence")
                print(f"📁 Loaded event seed overrides from {seed_overrides_path}")
            except Exception as override_error:
                print(f"⚠️  Failed to parse event seed overrides: {override_error}")

        now = datetime.utcnow()

        bias_document_cache: Dict[str, Dict[str, Document]] = {}

        for index, case in enumerate(demo_bias_cases):
            user_id = case["user_id"]
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                user = User(
                    id=user_id,
                    email=f"{user_id.replace('user-', '').replace('_', '.')}@demo.visa",
                    name=case["applicant_name"],
                    phone=f"+10000000{index:02d}",
                    nationality=case["country"]
                )
                db.add(user)

            application = db.query(Application).filter(Application.id == case["application_id"]).first()
            if not application:
                answers = {
                    "applicant_name": case["applicant_name"],
                    "nationality": case["country"],
                    "destination_country": case["country"],
                }
                if case.get("wealth_level"):
                    answers["wealth_level"] = case["wealth_level"]
                if case.get("document_quantity"):
                    answers["document_quantity"] = case["document_quantity"]
                if case.get("invitation_letter"):
                    answers["invitation_letter"] = case["invitation_letter"]
                if case.get("origin_country"):
                    answers["origin_country"] = case["origin_country"]
                application = Application(
                    id=case["application_id"],
                    user_id=user_id,
                    visa_type=case["visa_type"],
                    status="rejected",
                    priority="normal",
                    risk_score=case["risk_score"],
                    answers=json.dumps(answers),
                    submitted_at=now - timedelta(days=case["days_offset"] + 1),
                    updated_at=now - timedelta(days=case["days_offset"])
                )
                db.add(application)

                rejection_update = StatusUpdate(
                    id=generate_id("status"),
                    application_id=case["application_id"],
                    status="rejected",
                    notes=case["rejection_reason"],
                    officer_id="maria.schmidt",
                    timestamp=now - timedelta(days=case["days_offset"])
                )
                db.add(rejection_update)

            existing_doc_count = (
                db.query(Document)
                .filter(Document.application_id == case["application_id"])
                .count()
            )
            if existing_doc_count == 0:
                declared_quantity = (case.get("document_quantity") or "medium").lower()
                completion_map = {
                    "low": "minimal",
                    "medium": "partial",
                    "high": "complete",
                }
                completion_level = completion_map.get(declared_quantity, "partial")

                created_bias_docs = create_organized_documents_for_application(
                    db,
                    case["application_id"],
                    case["visa_type"],
                    case["applicant_name"],
                    completion_level,
                )
                db.flush()
                bias_document_cache[case["application_id"]] = {
                    doc.type: doc for doc in created_bias_docs
                }
            else:
                existing_docs = (
                    db.query(Document)
                    .filter(Document.application_id == case["application_id"])
                    .all()
                )
                bias_document_cache[case["application_id"]] = {
                    doc.type: doc for doc in existing_docs
                }

        # Seed bias reviews, audits, and an initial monitoring snapshot for demo purposes
        if db.query(BiasReview).count() == 0:
            bias_review_records = []

            for case in demo_bias_cases:
                review_data = case.get("review")
                if not review_data:
                    continue

                record = BiasReview(
                    id=generate_id("biasreview"),
                    application_id=case["application_id"],
                    officer_id=review_data["officer_id"],
                    result=review_data["result"],
                    notes=review_data["notes"],
                    ai_confidence=review_data.get("ai_confidence"),
                    audit_status=review_data.get("audit_status", "pending"),
                    reviewed_at=now - timedelta(days=review_data.get("reviewed_days_ago", 1))
                )
                db.add(record)
                bias_review_records.append((case, record, review_data))

            db.flush()

            # Optional audit follow-up for cleared cases
            for case, record, review_data in bias_review_records:
                audit_meta = review_data.get("audit")
                if not audit_meta:
                    continue
                audit_entry = ReviewAudit(
                    id=generate_id("biasaudit"),
                    bias_review_id=record.id,
                    auditor_id=audit_meta["auditor_id"],
                    decision=audit_meta.get("decision", "clear_to_proceed"),
                    notes=audit_meta.get("notes"),
                    created_at=now - timedelta(days=audit_meta.get("days_ago", 1))
                )
                db.add(audit_entry)

            # Attach demo flag records to bias reviews so the audit UI has realistic data
            for case, record, review_data in bias_review_records:
                flag_specs = case.get("flags") or []
                if not flag_specs:
                    continue

                document_lookup = bias_document_cache.get(case["application_id"], {})
                documents_query = (
                    db.query(Document)
                    .filter(Document.application_id == case["application_id"])
                )

                for flag_spec in flag_specs:
                    document = None
                    desired_type = flag_spec.get("document_type")
                    if desired_type:
                        if desired_type not in document_lookup:
                            extra_docs = create_organized_documents_for_application(
                                db,
                                case["application_id"],
                                case["visa_type"],
                                case["applicant_name"],
                                completion_level=case.get("document_quantity", "partial"),
                                specific_doc_types=[desired_type],
                            )
                            db.flush()
                            for extra_doc in extra_docs:
                                document_lookup[extra_doc.type] = extra_doc
                        document = document_lookup.get(desired_type)
                        if not document:
                            document = documents_query.filter(Document.type == desired_type).first()
                    if not document:
                        document = next(iter(document_lookup.values()), None)
                    if not document:
                        document = documents_query.order_by(Document.uploaded_at.asc()).first()
                    if not document:
                        print(
                            f"⚠️  Skipping flag seed for {case['application_id']} – no document found"
                        )
                        continue

                    flagged_days = flag_spec.get("flagged_days_ago")
                    flagged_at = (
                        now - timedelta(days=flagged_days)
                        if flagged_days is not None
                        else now - timedelta(days=case.get("days_offset", 3))
                    )

                    resolved = bool(flag_spec.get("resolved", False))
                    resolved_days = flag_spec.get("resolved_days_ago")
                    resolved_at = None
                    if resolved:
                        if resolved_days is not None:
                            resolved_at = now - timedelta(days=resolved_days)
                        else:
                            # Default to resolving a day after the flag for demo realism
                            resolved_at = flagged_at + timedelta(days=1)

                    flag_record = FlaggedDocument(
                        id=generate_id("flag"),
                        user_id=case["user_id"],
                        document_id=document.id,
                        application_id=case["application_id"],
                        reason=flag_spec.get("reason") or review_data.get("notes"),
                        flagged_by_officer_id=review_data.get("officer_id"),
                        flagged_at=flagged_at,
                        resolved=resolved,
                        resolved_at=resolved_at,
                        bias_review_id=record.id,
                    )

                    flag_code = flag_spec.get("flag_type")
                    if flag_code and flag_code in category_lookup:
                        flag_record.category = category_lookup[flag_code]
                    elif flag_code:
                        print(
                            f"⚠️  Unknown flag category '{flag_code}' for {case['application_id']}, defaulting to document_gap"
                        )
                        flag_record.category = category_lookup.get("document_gap")
                    else:
                        flag_record.category = category_lookup.get("document_gap")

                    db.add(flag_record)

        should_seed_snapshot = db.query(BiasMonitoringSnapshot).count() == 0

        if db.query(BiasInfluenceAttribute).count() == 0:
            for entry in attribute_seed:
                attribute_config = {
                    "label": entry["label"],
                    "explanation": entry["explanation"],
                    "feature": entry["feature"],
                }
                db.add(
                    BiasInfluenceAttribute(
                        id=entry["id"],
                        category_id=entry["category_id"],
                        category_title=entry["category_title"],
                        label=entry["label"],
                        explanation=entry["explanation"],
                        config=json.dumps(attribute_config),
                    )
                )

        if db.query(BiasReviewCadence).count() == 0:
            for cadence in cadence_seed:
                db.add(
                    BiasReviewCadence(
                        id=generate_id("cadence"),
                        interval=cadence["interval"],
                        review_time=cadence["review_time"],
                        view_time=cadence["view_time"],
                        cases=cadence.get("cases", 0),
                        updated_at=now,
                    )
                )

        db.flush()

        try:
            from services.bias_monitoring import BiasMonitoringService

            service = BiasMonitoringService(db)
            if should_seed_snapshot:
                service.enqueue_snapshot(30)

            if override_influence and override_influence.get("factors"):
                window_days = override_influence.get("model", {}).get("window_days", 30)
                model = BiasInfluenceModel(
                    id=generate_id("biasmodel"),
                    window_start=now - timedelta(days=window_days),
                    window_end=now,
                    window_days=window_days,
                    sample_size=override_influence.get("model", {}).get("sample_size", len(demo_bias_cases)),
                    auc=override_influence.get("model", {}).get("auc", 0.0),
                    refreshed_at=now,
                    model_metadata=json.dumps(override_influence.get("model", {}).get("metadata", {})),
                    warnings=json.dumps(override_influence.get("model", {}).get("warnings", [])),
                )
                db.add(model)
                db.flush()

                for factor in override_influence.get("factors", []):
                    db.add(
                        BiasInfluenceFactor(
                            id=generate_id("biasfactor"),
                            model_id=model.id,
                            attribute_id=factor.get("attribute_id"),
                            coefficient=float(factor.get("coefficient", 0.0)),
                            odds_ratio=float(factor.get("odds_ratio", 1.0)),
                            sample_share=float(factor.get("sample_share", 0.0)),
                            prevalence_weight=float(factor.get("prevalence_weight", 0.0)),
                            p_value=factor.get("p_value"),
                            delta=float(factor.get("delta", 0.0)),
                            direction=factor.get("direction", "driver"),
                            extra=json.dumps(
                                {
                                    "display_label": factor.get("display_label"),
                                    "confidence_weight": factor.get("confidence_weight"),
                                    "occurrences": factor.get("occurrences"),
                                }
                            ),
                        )
                    )
                print("📊 Injected event influence leaderboard from overrides")
            else:
                service.get_influence_leaderboard(30)
        except Exception as model_error:
            print(f"⚠️  Influence model seeding skipped: {model_error}")

        db.commit()
        print("\n✅ Demo data seeded successfully with organized document files!")
        print("📋 Demo Application Credentials:")
        print("   🏢 VSV-240101-A1B2 / DEMO123 (Business - Sarah Johnson) - Complete docs")
        print("   🏖️  VSV-240102-C3D4 / DEMO456 (Tourist - Miguel Rodriguez) - Partial docs")
        print("   🎓 VSV-240103-E5F6 / DEMO789 (Student - Anna Chen) - Complete docs")
        print("   💼 VSV-240104-G7H8 / DEMO999 (Work - James Wilson) - Minimal docs")
        print("\n📄 Document files organized in uploads/[application_id]/ directories")
        print("🔗 Documents are accessible via /uploads/[application_id]/[filename] URLs")
        print("📊 Bias monitoring endpoints ready: /api/bias-monitoring/overview, /api/bias-monitoring/cadence")
        print("📈 Influence leaderboard available at /api/bias-influence/leaderboard (install numpy + scikit-learn for coefficients)")

    except Exception as e:
        print(f"❌ Error seeding demo data: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()
