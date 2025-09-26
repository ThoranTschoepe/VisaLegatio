# Bias Monitoring Backend Handoff

This note documents what the embassy bias monitoring frontend currently expects so the backend team can replace the mock data with live services.

Use it as the source of truth for the REST payloads, aggregation logic, and background jobs required to support the Bias Monitoring page (dashboard → BiasMonitoringPanel.tsx and InfluenceLeaderboard.tsx).

## 1. Endpoints to Implement

- `GET /api/bias-review/sample`: provides the rejection sample table and headline statistics.
- `GET /api/bias-monitoring/overview`: supplies the snapshot metadata and high-level metric cards.
- `GET /api/bias-monitoring/history` *(optional for later charts)*: returns past snapshots so the UI can show trends.
- `POST /api/bias-monitoring/snapshot` *(admin trigger)*: refreshes monitoring metrics on demand.
- `GET /api/bias-influence/leaderboard`: replaces `biasInfluenceMock.ts` for the Influence Leaderboard (drivers vs buffers).
- `GET /api/bias-influence/attributes`: returns the attribute catalog glossary.
- `GET /api/bias-review/cadence`: replaces the static risk-band cadence table.

The `/api` prefix is already baked into the frontend API client (`api.ts`). The backend should mount these under the same prefix or configure the proxy accordingly.

## 2. Data Contracts

### 2.1 Bias Review Sample (`GET /bias-review/sample`)

**Query params**

- `sample_rate` *(optional number)* — fraction of rejections to sample (defaults to 1 for full sample).
- `days_back` *(optional number)* — rolling window length in days (defaults to 30).

**Response payload**

```
{
  "cases": BiasReviewCase[],
  "statistics": BiasReviewStatistics
}
```

- `BiasReviewCase`
  - `application`: `{ id, applicantName, visaType, status, submittedAt?, country, riskScore, documentsCount }`
  - `rejectionReason`: string
  - `aiConfidence`: number *(0–1)*
  - `reviewed`: boolean
  - `reviewResult?`: `'justified' | 'biased' | 'uncertain'`
  - `reviewNotes?`: string
  - `reviewedBy?`: string officer id or name
  - `reviewedAt?`: ISO timestamp
  - `auditStatus`: string badge (e.g. `pending_audit`, `cleared`)
- `BiasReviewStatistics`
  - `totalRejected`: integer (total rejections in window)
  - `sampleSize`: integer (# cases sampled)
  - `reviewedCount`: integer (# cases with `reviewed=true`)
  - `biasDetectedCount`: integer (# cases with `reviewResult === 'biased'`)
  - `biasRate`: number *(0–1)*
  - `commonBiasPatterns`: string[] (ordered list of top patterns for the summary chips)

### 2.2 Monitoring Overview (`GET /bias-monitoring/overview`)

**Query params**

- `days_back` *(optional number)* — matches the sample window.

**Response payload**

```
BiasMonitoringSnapshot {
  snapshotId: string,
  generatedAt: string | null,
  metrics: {
    totalRejected: number,
    sampledCount: number,
    reviewedCount: number,
    biasDetectedCount: number,
    biasRate: number,
    biasByCountry: Record<string, number>,
    biasByVisaType: Record<string, number>,
    auditStatusBreakdown: Record<string, number>,
    commonBiasPatterns: string[],
    alerts: string[],
    windowDays: number
  }
}
```

The `metrics.windowDays` value feeds the “Snapshot window” copy, while `generatedAt` becomes the timestamp in the header.

### 2.3 Influence Leaderboard (`GET /bias-influence/leaderboard`)

Replaces `biasInfluenceMock.ts` → `biasFactorScores` export.

```
{
  "factors": [
    {
      "attributeId": string,
      "displayLabel": string,
      "coefficient": number,
      "oddsRatio": number,
      "sampleShare": number,
      "pValue": number,
      "delta": number,
      "direction": "driver" | "buffer"
    }
  ],
  "model": {
    "sampleSize": number,
    "auc": number,
    "refreshedAt": string
  }
}
```

The component derives its own weight/percentage using the same formula from the doc (`InfluenceLeaderboard.tsx`). `delta` indicates trend movement vs the prior window. `direction` should be set based on the sign of the coefficient (`driver` for positive, `buffer` for negative).

### 2.4 Attribute Catalog (`GET /bias-influence/attributes`)

Returns structured metadata for each factor so the glossary card can be built dynamically.

```
{
  "categories": [
    {
      "id": string,
      "title": string,
      "attributes": [
        {
          "id": string,
          "label": string,
          "explanation": string
        }
      ]
    }
  ]
}
```

### 2.5 Risk-Adjusted Review Cadence (`GET /bias-review/cadence`)

Provides the data for the table that benchmarks review effort by automated risk score band.

```
{
  "bands": [
    {
      "interval": string,      // e.g. "0-25 (low risk)"
      "reviewTime": string,    // human-readable median review time
      "viewTime": string,      // human-readable per-document time
      "cases": number,         // optional count to show weight in future
      "updatedAt": string
    }
  ]
}
```

The frontend currently only renders `interval`, `reviewTime`, and `viewTime`. Supplying extra fields allows future enhancements without another contract change.

## 3. Backend Work Items

1. **Persistence model**
   - Store bias review decisions with audit metadata (`review_result`, `notes`, `reviewedBy`, `reviewedAt`, `auditStatus`).
   - Maintain application snapshots at the time of review (visa type, country, risk score, document count) so the sample table is reproducible.
   - Persist influence metadata in dedicated tables (`bias_influence_models`, `bias_influence_factors`, `bias_influence_attributes`) so the leaderboard can be served without re-training.
   - Keep cadence benchmarks in `bias_review_cadence` for quick lookup by the monitoring panel.

2. **Sampling service**
   - Given `days_back` and `sample_rate`, query rejection decisions, apply random or stratified sampling, and aggregate summary statistics.
   - Compute `biasRate`, `commonBiasPatterns`, and per-case `aiConfidence` if the operational model provides it.

3. **Monitoring snapshot job**
   - Nightly task to aggregate metrics into `bias_monitoring_snapshots` (one row per window).
   - Persist `biasByCountry`, `biasByVisaType`, and `auditStatusBreakdown` as JSON for quick retrieval.
   - Record `alerts` (e.g., threshold breaches) that need to be surfaced in the UI banner.

4. **Influence model pipeline**
   - Train logistic regression (or chosen alternative) on reviewed cases with labelled bias outcomes.
   - Persist coefficients, odds ratios, sample share, p-values, and trend deltas (comparison to previous coefficients).
   - Expose the latest model metadata and factor list through `/bias-influence/leaderboard`.
   - Serve the attribute glossary from the same source of truth used during feature engineering.

5. **Cadence analytics**
   - Aggregate review cycle telemetry: median review duration and per-document view time by risk band.
   - Surface through `/bias-review/cadence`; include `updatedAt` for freshness.

6. **Authentication / officer context** *(if not already in place)*
   - Ensure endpoints support officer scoping (e.g., filter by embassy or role where required).

## 4. Demo data overrides

- The backend seed script reads `docs/event_seed.json` on startup. When present it injects:
  - `bias_cases` to pre-populate review samples with consistent narratives.
  - `attributes` (countries of origin, wealth levels, document quantity, invitation letter, etc.) for the glossary table.
  - `cadence` rows for risk-band review timing benchmarks.
  - `influence` (model metadata + factors) so the leaderboard displays curated drivers/buffers without needing scikit-learn/numpy at demo time.
- Remove or rename the file to fall back to the baked-in defaults.
- Deterministic sampling ensures `/bias-review/sample` returns the same subset within a window, matching the seeded scenarios during presentations.

## 4. Frontend Integration Checklist

- Replace imports of `biasInfluenceMock.ts` with responses from the new `/bias-influence/*` endpoints once they are live.
- Swap the mock cadence array in `BiasMonitoringPanel.tsx` with the payload from `/bias-review/cadence`.
- Update `api.ts` to call the real endpoints and remove any temporary transformations when the backend matches the contract above.
- Add loading/error states if backend responses become paginated or include additional metadata.

Delivering the endpoints with these contracts will allow the monitoring page to drop all mocked content and reflect real-time operational data.

## 5. Implementation Notes (current backend)

- Sampling is deterministic per application/window using a stable hash so repeated calls during a window return the same subset until a new snapshot is produced.
- `/bias-monitoring/overview` auto-refreshes snapshots when the cached window is older than 12 hours; manual POSTs still force regeneration.
- Influence leaderboard training requires `scikit-learn` and (optionally) `numpy`. If the libraries or reviewed sample size are missing, the API responds with an empty `factors` array plus a `warnings` list describing the constraint.
- Attribute glossary values are sourced from `bias_influence_attributes`; when no rows exist the backend falls back to the default config shipped in `app/frontend/data/biasInfluenceMock.ts`.
- Cadence analytics aggregate persisted bands in `bias_review_cadence`, populated by demo seed data so the UI has immediate content after bootstrap.
