# Bias Influence Model – Implementation Notes

This document captures the working assumptions behind the "Influence Leaderboard" used in the embassy bias monitoring demo. Treat it as architecture guidance for a future production implementation.

## Goal
Identify which pseudo-anonymous applicant attributes increase or decrease the odds that a rejection is flagged as potentially biased. Surface the results in a ranked UI that is easy for officers to interpret and track over time—without declaring whether the overall system is “fair” or “unfair”. The tool is descriptive, not a compliance verdict.

## Data Requirements
- Reviewed applications only (`review_result` available).
- Binary target: `biased` (1) vs `non-biased` (0). Applications marked "uncertain" can be treated as 0 or excluded based on sample size.
- Feature set describing each application at review time. Typical examples:
  - Region of origin (categorical, e.g., `origin_africa_west`, `origin_europe_north`).
  - Wealth tier proxy (categorical, derived from bank data or declared income).
  - Document density (numeric – number of documents submitted / required).
  - Travel history tier (categorical – none, regional, global).
  - Sponsor verification status, scholarship flag, prior visa history (binary flags).
  - Model risk score (numeric 0–100 bucketed if needed).
  - Visa type, urgency level, embassy office ID, etc.
- Time window: rolling 4–8 weeks balances freshness and sample size.

## Modelling Approach
1. **Feature Engineering**
   - Work in a feature definition file (e.g., `bias_config.json`). Document every attribute with:
     ```json
     {
       "id": "origin_africa_west",
       "label": "Origin Region · West Africa",
       "type": "categorical",
       "positive_interpretation": "▲ increases odds" 
     }
     ```
   - One-hot encode categorical attributes automatically using the config.
   - Scale/standardise numeric features (z-score) to make coefficients comparable.
   - Optionally include interaction terms when domain experts expect combined effects (e.g., origin × wealth).
2. **Model**
   - Logistic regression trained with L2 regularisation. Optimise with class balancing or weighting if the positive class is rare.
   - Consider fitting hierarchical/partial-pool models when data spans multiple embassies but share attributes.
3. **Outputs**
   - Coefficients (`β_i`) indicating log-odds contribution per feature.
   - Standard errors / p-values to measure confidence.
   - Model fit diagnostics (AUC, precision-recall) to monitor drift.

## Influence Score Calculation
-For each human-readable factor shown in the leaderboard (split by sign):
```
raw_i = |β_i| × prevalence_weight_i × confidence_weight_i
driver%_i = raw_i / Σ_{j in positive} raw_j × 100  (β_i > 0)
buffer%_i = raw_i / Σ_{j in negative} raw_j × 100  (β_i < 0)
```
- `|β_i|`: absolute coefficient magnitude (stronger effect → larger base weight).
- `prevalence_weight_i = sqrt(n_i / N)` where `n_i` is count of reviews containing the factor.
- `confidence_weight_i`: default 1; reduce towards 0 as p-value approaches the alert threshold (e.g., `max(0, 1 - p_i/0.1)`).
- Each column (drivers vs buffers) is separately normalised to 100% for readability.
- Track sign separately: arrows in the UI use `sign(β_i)` to show whether the factor increases (▲) or decreases (▼) bias odds.

## UI Mapping
- **Two Columns:** Drivers on the left (positive β) and Buffers on the right (negative β), each displaying labels, percent share, trend, odds ratio, sample share, and confidence.
- **Trend (Δscore):** Refit the model on the prior time window and subtract the previous score to highlight movement.
- **Extensible Config:** The component reads an attributes config list; adding a new factor is done by dropping a new entry in the config, recomputing the model, and redeploying. No UI logic changes required.
- **No Aggregate Verdict:** The UI intentionally omits an overall “bias rate” or judgement; it only visualises the relative influence of attributes so policy owners can decide on follow-up action.

### Current Demo Layout
- **Monitoring header** shows four numbers: total rejections in the window, sampled count, reviewed sample size, and flagged findings.
- **Sample table** lists the rejection sample (ID, visa type, country, risk, review badge) and links into the detail modal.
- **Influence & context column** combines the Influence Leaderboard (demo) with an Attribute catalog card. Analysts can move from high-level coefficients into a human-readable glossary without leaving the view, making it easier to brief stakeholders on why a factor appears.
- **Risk-adjusted review cadence** lives in the opposing column. It benchmarks typical turnaround times for rejection reviews across automated risk score bands (0-25, 25-50, 50-70, 70-100) so officers can spot workload imbalances as they inspect bias signals.

## Operational Workflow
1. Nightly job pulls reviewed cases from the operational database and refits the model.
2. Persist coefficients, metadata (timestamps, diagnostics) in a `bias_influence_models` table.
3. Expose a read API returning the current leaderboard, odds ratios, and trend deltas.
4. Trigger alerts when influence scores rise above policy thresholds or when model diagnostics degrade.

### Current implementation details
- API surface: `GET /api/bias-influence/leaderboard` (with optional `days_back`), `GET /api/bias-influence/attributes` for the glossary, and `GET /api/bias-review/cadence` for the companion risk-band table.
- The training pipeline prefers `scikit-learn` + `numpy`. When those dependencies or minimum sample sizes are missing, the endpoint responds with an empty `factors` array and populates `model.warnings` instead of raising errors.
- Feature metadata is stored in `bias_influence_attributes`, keeping the glossary in sync with the engineered feature set. If the table is empty the frontend falls back to the static config in `app/frontend/data/biasInfluenceMock.ts` for demo readability.
- Demo environments can bypass training entirely by supplying `docs/event_seed.json`, which seeds cases, attributes, cadence rows, and a mock influence model/factors for the leaderboard.

## Future Enhancements
- Calibrate with Bayesian logistic regression to produce full posterior distributions for coefficients.
- Apply SHAP values on tree-based models if we move beyond logistic regression but still want explainability.
- Add fairness-aware regularisation (e.g., equalised odds constraints) and compare leaderboards before/after mitigation.
- Localise the feature vocabulary per embassy while sharing a global schema.

---
Author: Codex demo (September 2024)
