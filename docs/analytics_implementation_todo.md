# Analytics Page – Implementation Notes

## Frontend (AnalyticsDashboard.tsx)
- Replace inline `mockData` with fetcher (e.g., `useEffect + api.getAnalytics`).
- Add loading & error states for each section.
- Introduce filter controls (date range, embassy) wired to query params passed to endpoint.
- Swap div-based bar charts for a charting library (Recharts, Chart.js) to add tooltips, legends, and responsive visuals.
- Hook up export button to new endpoint or client-side CSV builder.
- Ensure the new governance card triggers `setCurrentView('analytics')` so this page receives real data.

## Backend TODOs
1. `/api/analytics/dashboard`
   - Aggregated totals: applications, approvals, pending, average processing time.
   - Accept filters (date range, embassy ID, visa type).
   - Return recent-change metrics (period-over-period comparisons).
2. `/api/analytics/trends`
   - Monthly stats for applications, approvals, rejections (used for trends chart).
3. `/api/analytics/distribution`
   - Visa type or country breakdown (counts, percentages).
4. `/api/analytics/processing`
   - Average SLA by visa type, backlog counts, urgent queue.
5. Export endpoint (CSV/Excel) generating the report requested from the UI.

## Integration Steps
- Define shared TypeScript types for analytics payloads (`app/frontend/types`).
- Update `api.getAnalytics` to call the new endpoints and combine results as needed.
- Add caching/circuit breaker to backend to avoid heavy DB hits on every load.
- Document how analytics ties into nightly ETL or cron jobs (if pre-computed).

---
Author: Codex demo (September 2024)
