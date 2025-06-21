# backend/utils.py - Utility functions and demo data seeding

import random
import string
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from database import get_db_session, User, Application, Document, Officer, StatusUpdate
from models import Question, QuestionValidation

def generate_id(prefix: str = "") -> str:
    """Generate a unique ID with optional prefix"""
    timestamp = str(int(datetime.now().timestamp() * 1000))[-8:]
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    
    if prefix:
        return f"{prefix}-{timestamp}-{random_part}"
    return f"{timestamp}-{random_part}"

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
    """Seed database with demo data for hackathon presentation"""
    
    db = get_db_session()
    
    try:
        # Check if data already exists
        if db.query(Officer).count() > 0:
            print("Demo data already exists, skipping seeding...")
            return
        
        # Create demo officers
        officers = [
            Officer(
                id="maria.schmidt",
                name="Officer Maria Schmidt",
                email="maria@embassy.gov",
                role="Senior Consular Officer",
                embassy_id="us_berlin",
                password_hash="demo123"  # In real app, use proper hashing
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
        
        # Create demo users and applications
        demo_applications = [
            {
                "applicant_name": "Sarah Johnson",
                "visa_type": "business",
                "status": "officer_review",
                "country": "United States",
                "answers": {
                    "applicant_name": "Sarah Johnson",
                    "destination_country": "Germany",
                    "business_purpose": "Conference/Meeting",
                    "company_name": "Tech Solutions Inc.",
                    "invitation_company": "Berlin Tech Conference",
                    "duration": "7",
                    "email": "sarah.johnson@techsolutions.com",
                    "phone": "+1-555-0123"
                }
            },
            {
                "applicant_name": "Miguel Rodriguez",
                "visa_type": "tourist",
                "status": "document_review",
                "country": "Spain",
                "answers": {
                    "applicant_name": "Miguel Rodriguez",
                    "destination_country": "Germany",
                    "travel_purpose": "Sightseeing",
                    "duration": "14",
                    "accommodation": "Hotel",
                    "email": "miguel.rodriguez@email.com",
                    "phone": "+34-666-123456"
                }
            },
            {
                "applicant_name": "Anna Chen",
                "visa_type": "student",
                "status": "background_check",
                "country": "China",
                "answers": {
                    "applicant_name": "Anna Chen",
                    "destination_country": "Germany",
                    "institution_name": "Technical University of Munich",
                    "study_level": "Master's degree",
                    "study_duration": "24",
                    "email": "anna.chen@student.tum.de",
                    "phone": "+86-138-0013-8000"
                }
            },
            {
                "applicant_name": "James Wilson",
                "visa_type": "work",
                "status": "submitted",
                "country": "United Kingdom",
                "answers": {
                    "applicant_name": "James Wilson",
                    "destination_country": "Germany",
                    "job_title": "Software Engineer",
                    "employer_name": "German Tech Corp",
                    "contract_duration": "36",
                    "email": "james.wilson@germantech.de",
                    "phone": "+44-20-7946-0958"
                }
            }
        ]
        
        for i, app_data in enumerate(demo_applications):
            # Create user
            user_id = generate_id("user")
            user = User(
                id=user_id,
                email=app_data["answers"]["email"],
                name=app_data["applicant_name"],
                phone=app_data["answers"]["phone"],
                nationality=app_data["country"]
            )
            db.add(user)
            
            # Create application
            app_id = generate_id("VSV")
            risk_score = calculate_risk_score(app_data["visa_type"], app_data["answers"])
            
            application = Application(
                id=app_id,
                user_id=user_id,
                visa_type=app_data["visa_type"],
                status=app_data["status"],
                priority=["high", "normal", "normal", "urgent"][i],
                risk_score=risk_score,
                answers=json.dumps(app_data["answers"]),
                submitted_at=datetime.utcnow() - timedelta(days=random.randint(1, 5)),
                approval_probability=calculate_approval_probability(risk_score),
                assigned_officer_id="maria.schmidt" if i < 2 else "john.davis"
            )
            db.add(application)
            
            # Create demo documents
            doc_types = ["passport", "photo", "bank_statement", "invitation_letter"]
            for j, doc_type in enumerate(doc_types[:3 + i]):  # Varying number of documents
                document = Document(
                    id=generate_id("doc"),
                    application_id=app_id,
                    name=f"{doc_type.replace('_', ' ').title()}",
                    type=doc_type,
                    size=random.randint(100000, 2000000),  # 100KB - 2MB
                    verified=random.choice([True, True, False]),  # Mostly verified
                    uploaded_at=datetime.utcnow() - timedelta(hours=random.randint(1, 48))
                )
                db.add(document)
        
        db.commit()
        print("✅ Demo data seeded successfully!")
        
    except Exception as e:
        print(f"❌ Error seeding demo data: {e}")
        db.rollback()
    finally:
        db.close()