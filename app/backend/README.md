# VisaLegatio Backend API

## Quick Start for Hackathon

### 1. Setup
```bash
# Navigate to backend folder
cd backend

# Install dependencies (add numpy if you want live influence coefficients)
pip install -r requirements.txt
pip install numpy  # optional but recommended for /bias-influence/leaderboard

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
- `GET /api/bias-monitoring/sample` - Deterministic rejection sampling feed
- `GET /api/bias-monitoring/cadence` - Risk-band review cadence table
- `GET /api/bias-monitoring/overview` - Latest monitoring snapshot (auto-refreshes)
- `POST /api/bias-monitoring/snapshot` - Manual snapshot trigger
- `GET /api/bias-influence/leaderboard` - Logistic influence leaderboard (requires numpy + scikit-learn)
- `GET /api/bias-influence/attributes` - Attribute glossary used in the leaderboard

### 6. Database
- SQLite database (`visaverge.db`) created automatically
- Demo data seeded on first run
- No additional setup required!

### 7. Custom event dataset
- Edit `docs/event_seed.json` to curate applications, influence attributes, and cadence rows for demos.
- On startup the seed loader merges this file, so you can tailor the storyline without touching code.
- Supports `bias_cases`, `attributes`, `cadence`, and `influence` (model + factors) to fully mock the monitoring experience.
- Remove or rename the file if you want to fall back to the baked-in defaults.

## Architecture
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - Database ORM
- **SQLite** - Zero-config database
- **Pydantic** - Data validation and serialization
