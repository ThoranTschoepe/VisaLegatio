# VisaLegatio Backend API

## Quick Start for Hackathon

### 1. Setup
```bash
# Navigate to backend folder
cd backend

# Install dependencies
pip install -r requirements.txt

# Create uploads directory
mkdir uploads

# Run the server
python main.py
```

### 2. The API will be available at:
- **API Server**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/api/docs
- **Health Check**: http://localhost:8000/api/health

### 3. Demo Credentials
**Embassy Officers:**
- `maria.schmidt` / `demo123` (Senior Officer)
- `john.davis` / `demo123` (Standard Officer)  
- `admin` / `admin` (Administrator)

### 4. Frontend Integration
Update your frontend API calls to point to:
```javascript
const API_BASE = 'http://localhost:8000/api'
```

### 5. Key Endpoints
- `GET /api/applications` - Get all applications
- `POST /api/applications` - Create new application
- `PUT /api/applications/{id}` - Update application status
- `POST /api/chat` - Chat with AVA
- `POST /api/officers/login` - Officer authentication
- `GET /api/analytics` - Dashboard analytics

### 6. Database
- SQLite database (`visaverge.db`) created automatically
- Demo data seeded on first run
- No additional setup required!

## Architecture
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - Database ORM
- **SQLite** - Zero-config database
- **Pydantic** - Data validation and serialization