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

### 5. Key Endpoints (by router)

**Applications** – `/api/applications`
- `GET /` – list applications (supports `status`, `search` filters)
- `GET /{application_id}` – fetch application with documents, flags, and history
- `POST /` – create a new application
- `PUT /{application_id}` – update status/notes for an application
- `POST /{application_id}/verify` – password-protected status fetch for applicants
- `GET /{visa_type}/questions` – dynamic form questions by visa type
- `GET /{visa_type}/requirements` – document requirements for a visa type
- `POST /{application_id}/documents` – notify the backend of uploaded documents (refreshes requirements)
- `POST /{application_id}/flag-document` – flag a document (validates `flagCategoryCode`)
- `POST /{application_id}/unflag-document` – resolve a document flag

**Documents** – `/api/documents`
- `POST /upload` – upload a document (streams to disk, triggers optional AI analysis)
- `GET /{visa_type}/requirements` – document requirements lookup (duplicate of applications helper for convenience)
- `GET /view/{application_id}/{document_name}` – inline file preview
- `GET /download/{application_id}/{document_name}` – force file download
- `GET /application/{application_id}` – list document metadata (legacy response model)
- `GET /list/{application_id}` – list document metadata (JSON payload used by frontend)
- `GET /files/{application_id}` – list file names residing on disk
- `PUT /{document_id}/verify` – mark a document as verified
- `DELETE /{application_id}/{document_type}` – remove a document by type

**Review Audit** – `/api/review-audit`
- `GET /queue` – pending + historical audit queue (includes allowed decisions)
- `GET /{review_id}` – detailed bias review context with audit history
- `POST /{review_id}/decision` – submit a senior decision (`decision_code`, notes)

**Flags** – `/api/flags`
- `GET /catalog` – canonical flag categories, decision options, and compatibility matrix

**Bias Monitoring** – `/api/bias-monitoring`
- `GET /sample` – deterministic rejection sampling feed
- `GET /cadence` – risk-band review cadence table
- `POST /review/{application_id}` – submit a frontline bias review
- `GET /overview` – latest monitoring snapshot
- `GET /history` – paginated monitoring history
- `POST /snapshot` – manual snapshot trigger

**Analytics** – `/api/analytics`
- `GET /dashboard` – high-level analytics dashboard data
- `GET /metrics/summary` – summary KPI metrics

**Officers** – `/api/officers`
- `POST /login` – officer authentication
- `GET /profile/{officer_id}` – officer profile lookup

**Chat** – `/api/chat`
- `POST /` – chat with AVA
- `GET /history/{session_id}` – retrieve chat history for a session
### Flag Catalog & Review Audit Flow
- Flags now map to `flag_categories` (e.g. `document_gap`, `identity_mismatch`, `document_authenticity`, `financial_concern`, `travel_intent_risk`, `compliance_alert`).
- Senior outcomes are configured via `decision_categories` (e.g. `clear_to_proceed`, `request_additional_docs`, `escalate_to_policy`, `escalate_to_security`, `overturn_flag`, `refer_for_training`).
- Compatibility rules live in `flag_decision_rules`; the backend validates any submitted decision against this matrix.
- Frontend clients should call `/api/flags/catalog` at startup, cache the response, and drive decision dropdowns from `matrix[flagCode]`.
- Legacy payloads using `decision` are still accepted but will be normalized to `decision_code` server-side.

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
