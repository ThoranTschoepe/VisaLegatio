# Review-of-Review Audit Console – Demo Notes

This document explains the intent behind the `app/frontend/components/Embassy/BiasAuditQueue.tsx` page and outlines how senior officers should interact with the current demo UI.

## What Lands in the Audit Console?
The queue aggregates bias reviews that already received an initial officer assessment but still require senior oversight:

- **Bias-positive calls** – Any review marked "biased" by the first officer is escalated automatically so leads can confirm the finding, decide remediation, or trigger retraining tasks.
- **Uncertain decisions** – Reviews labelled "uncertain" on high-impact visa categories (or ones the system flags as sensitive) are surfaced for a final determination.
- **Policy-sensitive justifications** – Even when an officer records "justified", if the case matches risk flags (repeat pattern, high-profile applicant, diplomatic keyword), the workflow can push it upstream for double-checking.
- **Time-based escalations** – Reviews that linger in a pending state beyond the SLA are promoted to the audit queue to avoid stagnation.

Senior staff can still filter to "All" if they want to browse the entire backlog, but the default view keeps the focus on items that most need attention.

## Demo UI Walkthrough
1. **Header Summary (future enhancement)** – We plan to add quick stats such as "Pending audits", "Overturned this week", and "Oldest pending age" so leads immediately see workload. These cards are not yet implemented.
2. **Queue Cards** – The demo list uses cards with filters (e.g., "Needs attention", "Resolved") above the list. Each card surfaces:
   - Applicant identity, visa type, country, and risk score.
   - Flagged time (relative and exact) plus the initial reviewer.
   - Current audit status badge and a one-line summary of the escalation reason.
3. **Detail Drawer** – Selecting a card opens the inspection panel with:
   - Original notes, AI highlights, and applicant metadata.
   - Senior decision options (`validated`, `overturned`, `escalated`, `training_needed`) and a comment textarea recorded in the audit log.
   - Audit history timeline so officers can see previous actions on the same review.

Upcoming improvements include decision checklists, comment templates, and post-decision follow-ups (notify policy, tag for retraining, etc.).

## Filters & Workflow Considerations
- **Status Filter:** Provide quick toggles for `pending`, `validated`, `escalated`, `all` so leads can change perspective easily.
- **Age Filter:** Highlight reviews older than a configurable threshold (e.g., 5 days) to prioritise stale items.
- **Attribute Filters:** We can reuse influence-model data to surface filters like "High driver factor" or "High buffer factor" for cross-team investigations.

## Design Principles
- **No Aggregate Judgement:** Similar to the bias monitoring view, the audit console does not declare whether the overall process is fair. It only surfaces cases that need senior scrutiny.
- **Explainability:** Every audit action records a rationale (`notes`, optional checklists). The goal is to have reproducible audit trails for policy teams and compliance audits.
- **Extensibility:** The queue is driven by backend routing rules; adding new escalation paths (e.g., manual escalations, union grievances) should happen server-side without rewriting the front-end.

## Next Steps
- Add a metrics banner summarising pending/validated/overturned counts.
- Implement comment templates and decision checklists.
- Support bulk triage (approve/overturn multiple similar cases) where policy allows.
- Integrate with the bias influence model to show why a case was escalated (e.g., top driver factor).
- Provide export/print capability for audit reports.

---
