# Flagging & Review Audit Flow

## Current Flow
- **Officer Flagging**
  - An officer flags a document from Application Review (`POST /api/applications/{id}/flag-document`).
  - Backend creates/updates a `FlaggedDocument`, links it to the latest bias review, and stamps a status update.
  - `ensure_review_for_flagged_document` keeps a single pending `BiasReview` per application and syncs flags.

- **Bias Review vs. Review Audit**
- `BiasReview` captures the frontline reviewer’s stance on the case (e.g. “biased”, notes, AI confidence) and keeps the application in a “pending senior check” state. In the flagging workflow this record effectively acts as the “pending audit case” envelope—even though the name comes from the earlier bias-monitoring feature.
  - *Naming callout*: product copy still says “bias review” in analytics and historical exports. If we ever rename to `UpForAudit`/`ReviewCase`, expect a multi-layer refactor touching the ORM model, table name, API payloads, and front-end types.
- `ReviewAudit` records what the senior officer did *after* inspecting that review (validate, overturn, escalate) together with their justification. It’s an immutable history of senior actions layered on top of the original review.
- Keeping them separate lets us track both the reviewer’s rationale and the supervisory decision trail without overwriting each other.

**Renaming ideas**
- `BiasReview` → `ReviewCase`, `ReviewerAssessment`, or `EscalationReview` (emphasises the frontline decision awaiting oversight).
- `ReviewAudit` → `SeniorDecision`, `OversightRecord`, or `SupervisorAudit` (signals the supervisory nature of the entry).

- **Audit Queue Consumption**
  - `/api/review-audit/queue` shows pending reviews; each item includes live document metadata via `flag.document`.
  - Senior officers submit decisions (`POST /api/review-audit/{review_id}/decision`), producing `ReviewAudit` rows and optional `StatusUpdate`s for overturned/escalated outcomes.

- **Officer Visibility**
  - Senior comments live in `ReviewAudit.notes`; to surface them to the original officer we need front-end work (e.g. mount `ReviewAudit` on their timeline view or expose audit history inline).

## Open Questions
- Do we enforce one active `BiasReview` per application (or allow multiple historical reviews)?
- Should officer dashboards show senior audit comments automatically?
- What retention/policy applies to audit decisions (can they be edited, or only appended)?
- Senior handoff vs. advisory: we choose **advisory**—the originating officer keeps the case, senior reviewers inspect the flagged context and leave guidance/decisions without taking over the whole application.

## TODO
- Introduce a distinct application status (e.g. `flagged_for_review`) when a document flag is raised; revert once all flags resolve. *(Backend + officer UI complete; monitor for edge cases once analytics consume the new status.)*
- Surface the `ReviewAudit` console entry point within the officer Application Review flow so supervisors can jump in-context.

## Temporary Implementation Log
- **Prompt recap**: expand the review-audit system so flags and senior decisions come from configurable catalogs, enforceable through a backend-managed compatibility matrix, and surface allowed decisions to the frontend.
- **Step 1**: audited current models and bias-review flow (`FlaggedDocument`, `BiasReview`, `ReviewAudit`) to map existing relationships.
- **Step 2**: introduced canonical tables—`flag_categories`, `decision_categories`, `flag_decision_rules`—and wired `FlaggedDocument.flag_type` to the new FK helper, keeping property access for legacy code.
- **Step 3**: seeded baseline categories (`document_gap`, `identity_mismatch`, `document_authenticity`, `financial_concern`, `travel_intent_risk`, `compliance_alert`), decision options (e.g. `clear_to_proceed`, `request_additional_docs`, `escalate_to_security`), and compatibility rules via `seed_flag_catalog` inside `seed_demo_data`.
- **Follow-up tweak**: renamed the ORM class/table from `ReviewDecision`/`review_decisions` to `DecisionCategory`/`decision_categories` to stay symmetric with `FlagCategory`.
- **API alignment**: extended `flag-document` to accept/validate `flagCategoryCode`, exposed `allowedDecisions` plus a shared decision matrix in audit queue/detail payloads, enforced matrix validation during decision submission, and added `/api/flags/catalog` as the canonical source.
- **Regression coverage**: backend tests now cover invalid flag categories, disallowed decision submissions, and the `/api/flags/catalog` contract.
- **Cleanup guardrail**: unflagging the last document now removes the transient `BiasReview` (after detaching resolved flags) as long as no senior audits were recorded, keeping the audit trail intact.
- **Officer workflow**: the flag modal now fetches `/api/flags/catalog`, defaults to the existing category when re-opening a flag, and requires officers to pick a category before submitting (reason text remains as a freeform note).
- **Modal polish**: flag catalog loads inside the officer modal, and re-opening an existing flag now pulls fresh flag details (via `/api/applications/{id}`) so the remove option is always present.
- *(Remove this section once permanent documentation is in place.)*
- **Frontend wiring**: the senior-review `ReviewAudit` console now bootstraps `/api/flags/catalog`, caches the matrix, intersects allowed decisions per active flag, surfaces severity/follow-up hints in-line, and blocks submissions when no compatible decision remains.
- **UI polish**: refreshed the `ReviewAudit` queue with scrollable cards, summary stats, full-width decision tiles, and an expanded notes panel so flag context + compatibility metadata remain readable across screen sizes.
- **Backend flag lifecycle**: `/api/applications/*` now emits `flagged_for_review` when unresolved flags exist, includes `resolved_flag_history` with senior audit notes/decision labels, and returns `application_status` in flag/unflag responses so officers can surface the audit trail post-resolution.
- **Officer visibility**: Application Review now highlights senior audit decisions in document details and the decision sidebar, while the document flag modal surfaces the latest audit notes before reflagging; resolving a flag from the officer screen also refreshes audit context.
- **Decision catalog**: seed data aligns decisions with flag categories—for example `document_gap` exposes `request_additional_docs`/`issue_conditional_approval`, `identity_mismatch` surfaces `escalate_to_security` for potential fraud, and `compliance_alert` directs reviewers toward `escalate_to_policy` when policy guidance is required.

### Draft API Additions
- **Catalog**: `GET /api/flags/catalog` now returns `{ categories, decisions, matrix }` for the frontend to cache.
- **Flag creation**: `POST /api/applications/{id}/flag-document` accepts `flagCategoryCode` (defaults to `document_gap`) and rejects invalid codes.
- **Audit queue/detail**: `/api/review-audit/queue` and `/{id}` embed `allowed_decisions` per flag alongside a shared `decisionMatrix` with labels, severity, and follow-up flags.
- **Decision submission**: `/api/review-audit/{id}/decision` expects `decision_code`/`decision`, converts legacy values, and enforces matrix compatibility before persisting.
- **(Optional) Admin**: still pending—CRUD endpoints for categories/decisions/rules guarded behind feature flags.
