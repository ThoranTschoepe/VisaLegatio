# Analytics Page – Goal & Logic

## Goal
Provide senior embassy officers with a high-level snapshot of operational throughput (application volume, approval rate, processing speed, pending queue) and supporting breakdowns (monthly trends, visa type distribution, performance by category). The view is descriptive only—it highlights performance but avoids fairness or compliance judgements.

## Current Demo Logic
- Uses static `mockData` inside `app/frontend/components/Embassy/AnalyticsDashboard.tsx`.
- Key metrics: total applications, approval rate, average processing time, pending count. Trends/variance below each card are hard-coded.
- Charts are rendered with simple div-based bars (no chart library). Monthly data shows applications vs. approvals/rejections.
- Visa distribution is a list of percentage rows with simple colored dots.
- Processing performance uses badge indicators to show average turnaround time by visa type.
- Export button is present but non-functional.

## Planned Data Sources
- `/api/analytics/dashboard`: aggregated application metrics with filters (date range, embassy, visa type).
- `/api/analytics/trends`: month-by-month throughput, approvals, rejections.
- `/api/analytics/processing`: average processing time per visa type, SLA compliance, backlog age.
- `/api/analytics/distribution`: counts and percentages per visa category, origin country, etc.

## Key Points to Keep
- Clear separation between operational metrics and fairness/bias analytics (those live on the bias monitoring page).
- Ability to add filters (date range, embassy office) at the top of the page once backend supports them.
- Export option should produce CSV/PDF summary (or be hidden until available).

