# Monitoring & Review Audit – Implementation Notes

## Overview
The demo consists of two senior-officer surfaces:
- **Bias Monitoring (`app/frontend/components/Embassy/BiasMonitoringPanel.tsx`)** – sampling stats + influence leaderboard.
- **Review-of-Review Audit (`app/frontend/components/Embassy/ReviewAudit.tsx`)** – live queue, detail panel, and decision submission.

Both currently consume mock data. Backend APIs already exist (`/api/bias-monitoring/sample`, `/api/bias-monitoring/overview`, `/api/review-audit/*`) but return seeded/ephemeral data. Moving beyond the demo requires replacing the mock wiring with live API payloads and persisting officer decisions.

## Frontend Structure
### Bias Monitoring Panel
- Fetches:
  - `/api/bias-monitoring/sample` → cases + review statistics (deterministic sampling inside a window).
  - `/api/bias-monitoring/overview` → snapshot metrics + alerts (auto-refreshes when stale).
  - `/api/bias-influence/leaderboard` → drivers/buffers computed via logistic regression (falls back with warnings when prerequisites missing).
  - `/api/bias-influence/attributes` → glossary of model features.
  - `/api/bias-monitoring/cadence` → risk-band review latency benchmarks.
- Displays:
  - Summary cards (total rejected, sampled, reviewed, flagged findings).
  - Sample table (applications with status badges).
  - Influence leaderboard (live data when modelling succeeds; otherwise surfaces backend warnings).
  - Risk-adjusted review cadence table with optional fallbacks when analytics unavailable.

### Review Audit UI
- `ReviewAudit.tsx` unifies the audit queue experience across breakpoints, loading `/api/flags/catalog` once, caching the decision matrix, and applying compatibility rules per flag.
- The earlier demo shells (`ReviewAuditListDemo`, `ReviewAuditDemo`) have been retired; check git history if you need the mock-only reference.

## Backend TODOs
1. **Monitoring data**
   - Implement actual logistic-regression job generating driver/buffer weights (per doc `bias_influence_model.md`).
   - Replace demo leaderboard data with API response (likely `/api/bias-monitoring/influence`).
   - Feed alerts + patterns using persisted analytics (currently seeded).

2. **Audit queue**
   - Update `/api/review-audit/queue` to support new filter parameters (`status=pending/resolved`).
   - Persist senior comments (`review_audit` table) and return them in detail view.
   - Implement pagination/limit for large queues.

3. **Form submission**
   - Ensure `ReviewAudit.tsx` mutation flow covers validation, comment requirements, and audit history persistence.

4. **Governance card**
   - Provide metrics (pending count, overdue count) so the dashboard card surfaces real numbers.

5. **General clean-up**
   - Remove unused demo components once live implementations replace them.
   - Ensure timestamps are stored timezone-aware to avoid UTC deprecation warnings.

## Data Flow Diagram (high level)
```
Seeded DB ─┬─> /api/bias-monitoring/sample ─┬─> BiasMonitoringPanel
           │                            └─> Officer review submission
           │
           └─> /api/bias-monitoring/overview ──> BiasMonitoringPanel cards/alerts

Review audit DB → /api/review-audit/* → ReviewAudit submission
```

## Next Steps Checklist
- [ ] Design influence API response format (driver/buffer arrays with percent & meta).
- [ ] Wire `InfluenceLeaderboard` to use live data once ready.
- [ ] Add automated UI/regression coverage once `ReviewAudit.tsx` is fully wired to live data.
- [ ] Persist senior comments/decisions in database.
- [ ] Document production runbook (cron job scheduling, model retraining alerts).

---
