# Monitoring & Review Audit – Implementation Notes

## Overview
The demo consists of two senior-officer surfaces:
- **Bias Monitoring (`app/frontend/components/Embassy/BiasMonitoringPanel.tsx`)** – sampling stats + influence leaderboard.
- **Review-of-Review Audit (`app/frontend/components/Embassy/ReviewAuditListDemo.tsx` and `ReviewAuditDemo.tsx`)** – card list + detail drawer + decision actions.

Both currently consume mock data. Backend APIs already exist (`/api/bias-review/sample`, `/api/bias-monitoring/overview`, `/api/review-audit/*`) but return seeded/ephemeral data. Moving beyond the demo requires replacing the mock wiring with live API payloads and persisting officer decisions.

## Frontend Structure
### Bias Monitoring Panel
- Fetches:
  - `/api/bias-review/sample` → cases + review statistics (deterministic sampling inside a window).
  - `/api/bias-monitoring/overview` → snapshot metrics + alerts (auto-refreshes when stale).
  - `/api/bias-influence/leaderboard` → drivers/buffers computed via logistic regression (falls back with warnings when prerequisites missing).
  - `/api/bias-influence/attributes` → glossary of model features.
  - `/api/bias-review/cadence` → risk-band review latency benchmarks.
- Displays:
  - Summary cards (total rejected, sampled, reviewed, flagged findings).
  - Sample table (applications with status badges).
  - Influence leaderboard (live data when modelling succeeds; otherwise surfaces backend warnings).
  - Risk-adjusted review cadence table with optional fallbacks when analytics unavailable.

### Review Audit UI
- Large screens render `ReviewAuditListDemo` (card list + detail panel, form-only demo).
- Small screens fall back to `ReviewAuditDemo` (legacy single-pane interaction).
- Real queue component (`BiasAuditQueue.tsx`) is no longer used, but remains a reference implementation for API integration.

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
   - Hook `ReviewAuditListDemo` actions to real mutation endpoints (`/api/review-audit/{id}/decision`).
   - Validate comment field, store decision history.

4. **Governance card**
   - Provide metrics (pending count, overdue count) so the dashboard card surfaces real numbers.

5. **General clean-up**
   - Remove unused demo components once live implementations replace them.
   - Ensure timestamps are stored timezone-aware to avoid UTC deprecation warnings.

## Data Flow Diagram (high level)
```
Seeded DB ─┬─> /api/bias-review/sample ─┬─> BiasMonitoringPanel
           │                            └─> BiasReview (fairness queue)
           │
           └─> /api/bias-monitoring/overview ──> BiasMonitoringPanel cards/alerts

Review audit DB → /api/review-audit/* → (future) ReviewAuditListDemo submission
```

## Next Steps Checklist
- [ ] Design influence API response format (driver/buffer arrays with percent & meta).
- [ ] Wire `InfluenceLeaderboard` to use live data once ready.
- [ ] Replace ReviewAuditListDemo mock data with real queue fetch; remove legacy `BiasAuditQueue` once verified.
- [ ] Persist senior comments/decisions in database.
- [ ] Document production runbook (cron job scheduling, model retraining alerts).

---
