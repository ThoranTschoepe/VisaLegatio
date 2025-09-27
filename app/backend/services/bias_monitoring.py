"""Bias monitoring and influence analytics service layer."""

from __future__ import annotations

import hashlib
import json
import math
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Sequence, Tuple

try:  # numpy is optional; service will degrade gracefully if missing
    import numpy as np
except Exception:  # pragma: no cover - optional dependency
    np = None  # type: ignore
from sqlalchemy import and_, func
from sqlalchemy.orm import Session, joinedload

from database import (
    Application,
    BiasInfluenceAttribute,
    BiasInfluenceFactor,
    BiasInfluenceModel,
    BiasMonitoringSnapshot,
    BiasReview,
    BiasReviewCadence,
    Document,
    Officer,
    StatusUpdate,
)
from utils import generate_id

try:  # scikit-learn is the preferred implementation
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import roc_auc_score
except Exception:  # pragma: no cover - handled gracefully in runtime
    LogisticRegression = None  # type: ignore
    roc_auc_score = None  # type: ignore

try:  # Optional p-value calculation support
    from scipy.stats import norm
except Exception:  # pragma: no cover
    norm = None  # type: ignore


class BiasReviewSubmissionError(Exception):
    """Raised when a bias review submission fails validation."""

    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class BiasMonitoringService:
    """Encapsulates bias sampling, monitoring, and influence analytics."""

    SNAPSHOT_REFRESH_HOURS = 12
    MODEL_REFRESH_HOURS = 12
    MIN_MODEL_SAMPLE = 5

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Bias review sampling
    # ------------------------------------------------------------------
    def get_review_sample(self, sample_rate: float, days_back: int) -> Dict[str, Any]:
        sample_rate = max(0.0, min(sample_rate or 0.0, 1.0)) or 1.0
        days_back = max(1, days_back or 30)

        cutoff = datetime.utcnow() - timedelta(days=days_back)

        rejected_apps: List[Application] = (
            self.db.query(Application)
            .filter(
                and_(
                    Application.status == "rejected",
                    Application.updated_at >= cutoff,
                )
            )
            .all()
        )

        total_rejected = len(rejected_apps)
        if total_rejected == 0:
            return {
                "cases": [],
                "statistics": self._augment_keys(
                    {
                        "total_rejected": 0,
                        "sample_size": 0,
                        "reviewed_count": 0,
                        "bias_detected_count": 0,
                        "bias_rate": 0.0,
                        "common_bias_patterns": [],
                    }
                ),
            }

        sample_size = max(1, int(total_rejected * sample_rate))
        selected_apps = self._deterministic_sample(rejected_apps, sample_size, days_back)

        app_ids = [app.id for app in selected_apps]

        review_map = self._load_latest_reviews(app_ids)
        rejection_notes = self._load_rejection_notes(app_ids)
        document_counts = self._load_document_counts(app_ids)

        cases: List[Dict[str, Any]] = []
        for app in selected_apps:
            answers = json.loads(app.answers) if app.answers else {}
            review = review_map.get(app.id)
            documents_count = document_counts.get(app.id, 0)
            ai_confidence = (
                (review.ai_confidence / 100.0) if review and review.ai_confidence is not None else app.risk_score / 100.0
            )
            case_payload = {
                "application": self._augment_keys(
                    {
                        "id": app.id,
                        "applicant_name": answers.get("applicant_name", "Unknown"),
                        "visa_type": app.visa_type,
                        "status": app.status,
                        "submitted_at": app.submitted_at.isoformat() if app.submitted_at else None,
                        "country": answers.get("nationality", "Unknown"),
                        "risk_score": app.risk_score,
                        "documents_count": documents_count,
                    }
                ),
                "rejection_reason": rejection_notes.get(app.id, "No reason provided"),
                "ai_confidence": round(ai_confidence, 3),
                "reviewed": bool(review),
                "review_result": review.result if review else None,
                "review_notes": review.notes if review else None,
                "reviewed_by": review.officer_id if review else None,
                "reviewed_at": review.reviewed_at.isoformat() if review and review.reviewed_at else None,
                "audit_status": review.audit_status if review else "pending_audit",
            }
            cases.append(self._augment_keys(case_payload))

        statistics_payload = self._build_statistics(cases, total_rejected)

        return {
            "cases": cases,
            "statistics": statistics_payload,
        }

    def submit_review(self, application_id: str, review_data: Dict[str, Any]) -> Dict[str, Any]:
        """Persist a bias review decision and return the serialized record."""

        app = (
            self.db.query(Application)
            .filter(Application.id == application_id)
            .first()
        )
        if not app:
            raise BiasReviewSubmissionError(404, "Application not found")

        if app.status != "rejected":
            raise BiasReviewSubmissionError(400, "Can only review rejected applications")

        officer_id = review_data.get("officer_id")
        if officer_id:
            officer_exists = (
                self.db.query(Officer)
                .filter(Officer.id == officer_id)
                .first()
            )
            if not officer_exists:
                raise BiasReviewSubmissionError(404, "Reviewing officer not found")

        now = datetime.utcnow()
        existing_review = (
            self.db.query(BiasReview)
            .filter(BiasReview.application_id == application_id)
            .order_by(BiasReview.reviewed_at.desc())
            .first()
        )

        if existing_review:
            existing_review.result = review_data.get("result", existing_review.result)
            existing_review.notes = review_data.get("notes", existing_review.notes)
            existing_review.officer_id = officer_id or existing_review.officer_id
            existing_review.ai_confidence = review_data.get("ai_confidence", existing_review.ai_confidence)
            existing_review.reviewed_at = now
            existing_review.audit_status = "pending"
            existing_review.updated_at = now
            bias_review_record = existing_review
        else:
            if not officer_id:
                raise BiasReviewSubmissionError(400, "Officer ID is required for new reviews")
            bias_review_record = BiasReview(
                id=generate_id("biasreview"),
                application_id=application_id,
                officer_id=officer_id,
                result=review_data.get("result"),
                notes=review_data.get("notes"),
                ai_confidence=review_data.get("ai_confidence"),
                audit_status="pending",
                reviewed_at=now,
                created_at=now,
                updated_at=now,
            )
            self.db.add(bias_review_record)

        if review_data.get("result") == "biased":
            status_update = StatusUpdate(
                id=generate_id("status"),
                application_id=application_id,
                status="bias_review",
                notes=f"Potential bias detected in rejection: {review_data.get('notes')}",
                officer_id=officer_id,
                timestamp=now,
            )
            self.db.add(status_update)

        self.db.commit()
        self.db.refresh(bias_review_record)

        review_payload = self._augment_keys(
            {
                "id": bias_review_record.id,
                "result": bias_review_record.result,
                "notes": bias_review_record.notes,
                "officer_id": bias_review_record.officer_id,
                "reviewed_at": bias_review_record.reviewed_at.isoformat()
                if bias_review_record.reviewed_at
                else None,
                "audit_status": bias_review_record.audit_status,
                "ai_confidence": bias_review_record.ai_confidence,
            }
        )

        return {
            "message": "Bias review submitted successfully",
            "review": review_payload,
        }

    # ------------------------------------------------------------------
    # Monitoring snapshots
    # ------------------------------------------------------------------
    def get_or_create_snapshot(self, days_back: int) -> Dict[str, Any]:
        days_back = max(1, days_back or 30)
        freshness_cutoff = datetime.utcnow() - timedelta(hours=self.SNAPSHOT_REFRESH_HOURS)

        snapshot = (
            self.db.query(BiasMonitoringSnapshot)
            .filter(BiasMonitoringSnapshot.window_days == days_back)
            .order_by(BiasMonitoringSnapshot.generated_at.desc())
            .first()
        )

        if snapshot and snapshot.generated_at and snapshot.generated_at >= freshness_cutoff:
            return self._serialize_snapshot(snapshot)

        snapshot = self._create_snapshot(days_back)
        return self._serialize_snapshot(snapshot)

    def list_snapshots(self, limit: int = 10) -> List[Dict[str, Any]]:
        limit = max(1, min(limit or 10, 90))
        snapshots = (
            self.db.query(BiasMonitoringSnapshot)
            .order_by(BiasMonitoringSnapshot.generated_at.desc())
            .limit(limit)
            .all()
        )
        return [self._serialize_snapshot(snapshot) for snapshot in snapshots]

    def enqueue_snapshot(self, days_back: int) -> BiasMonitoringSnapshot:
        return self._create_snapshot(max(1, days_back or 30))

    # ------------------------------------------------------------------
    # Influence leaderboard & glossary
    # ------------------------------------------------------------------
    def get_influence_leaderboard(self, days_back: int) -> Dict[str, Any]:
        days_back = max(1, days_back or 30)
        now = datetime.utcnow()
        window_start = now - timedelta(days=days_back)
        freshness_cutoff = now - timedelta(hours=self.MODEL_REFRESH_HOURS)

        existing = (
            self.db.query(BiasInfluenceModel)
            .filter(BiasInfluenceModel.window_days == days_back)
            .order_by(BiasInfluenceModel.refreshed_at.desc())
            .first()
        )

        if existing and existing.refreshed_at and existing.refreshed_at >= freshness_cutoff:
            return self._serialize_model(existing)

        model = self._train_influence_model(window_start, now, days_back)
        return self._serialize_model(model)

    def get_attribute_catalog(self) -> Dict[str, Any]:
        attributes = (
            self.db.query(BiasInfluenceAttribute)
            .order_by(BiasInfluenceAttribute.category_id, BiasInfluenceAttribute.id)
            .all()
        )
        categories: Dict[str, Dict[str, Any]] = {}
        for attribute in attributes:
            entry = attribute.as_glossary_entry()
            category_id = entry.get("category_id") or "uncategorized"
            category_title = entry.get("category_title") or category_id.replace("_", " ").title()

            if category_id not in categories:
                categories[category_id] = {
                    "id": category_id,
                    "title": category_title,
                    "attributes": [],
                }

            categories[category_id]["attributes"].append(
                {
                    "id": entry["id"],
                    "label": entry["label"],
                    "explanation": entry["explanation"],
                }
            )

        ordered = sorted(categories.values(), key=lambda item: item["title"].lower())
        return {"categories": ordered}

    # ------------------------------------------------------------------
    # Review cadence
    # ------------------------------------------------------------------
    def get_review_cadence(self) -> Dict[str, Any]:
        cadence_rows = (
            self.db.query(BiasReviewCadence)
            .order_by(BiasReviewCadence.updated_at.desc())
            .all()
        )
        bands = []
        for row in cadence_rows:
            bands.append(
                {
                    "interval": row.interval,
                    "review_time": row.review_time,
                    "reviewTime": row.review_time,
                    "view_time": row.view_time,
                    "viewTime": row.view_time,
                    "cases": row.cases,
                    "updated_at": row.updated_at.isoformat() if row.updated_at else None,
                    "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
                }
            )
        return {"bands": bands}

    # ------------------------------------------------------------------
    # Internal helpers — sampling & statistics
    # ------------------------------------------------------------------
    def _build_statistics(self, cases: List[Dict[str, Any]], total_rejected: int) -> Dict[str, Any]:
        reviewed_count = sum(1 for case in cases if case.get("reviewed"))
        bias_count = sum(
            1 for case in cases if case.get("review_result") == "biased" or case.get("reviewResult") == "biased"
        )
        bias_rate = round((bias_count / reviewed_count * 100) if reviewed_count else 0.0, 2)
        patterns = self._derive_pattern_summaries(cases)
        return self._augment_keys(
            {
                "total_rejected": total_rejected,
                "sample_size": len(cases),
                "reviewed_count": reviewed_count,
                "bias_detected_count": bias_count,
                "bias_rate": bias_rate,
                "common_bias_patterns": patterns,
            }
        )

    def _derive_pattern_summaries(self, cases: Sequence[Dict[str, Any]]) -> List[str]:
        country_counts: Dict[str, int] = defaultdict(int)
        visa_counts: Dict[str, int] = defaultdict(int)
        for case in cases:
            if case.get("review_result") == "biased" or case.get("reviewResult") == "biased":
                application = case.get("application", {})
                country = application.get("country", "Unknown")
                visa_type = application.get("visa_type") or application.get("visaType", "unknown")
                country_counts[country] += 1
                visa_counts[visa_type] += 1
        patterns: List[str] = []
        if country_counts:
            sorted_countries = sorted(country_counts.items(), key=lambda item: item[1], reverse=True)
            top_country, top_count = sorted_countries[0]
            patterns.append(f"Country skew: {top_country} ({top_count} cases)")
        if visa_counts:
            sorted_visas = sorted(visa_counts.items(), key=lambda item: item[1], reverse=True)
            top_visa, visa_count = sorted_visas[0]
            patterns.append(f"Visa type skew: {top_visa} ({visa_count} cases)")
        if not patterns:
            patterns.append("No significant bias patterns detected yet")
        return patterns

    def _deterministic_sample(
        self, applications: Sequence[Application], sample_size: int, days_back: int
    ) -> List[Application]:
        def stability_key(app: Application) -> Tuple[float, datetime]:
            digest = hashlib.sha1(f"{app.id}:{days_back}".encode("utf-8")).hexdigest()
            score = int(digest[:8], 16) / 0xFFFFFFFF
            return (score, app.submitted_at or datetime.min)

        ranked = sorted(applications, key=stability_key)
        return ranked[:sample_size]

    def _load_latest_reviews(self, app_ids: List[str]) -> Dict[str, BiasReview]:
        if not app_ids:
            return {}
        reviews = (
            self.db.query(BiasReview)
            .filter(BiasReview.application_id.in_(app_ids))
            .order_by(BiasReview.application_id, BiasReview.reviewed_at.desc())
            .all()
        )
        latest: Dict[str, BiasReview] = {}
        for review in reviews:
            if review.application_id not in latest:
                latest[review.application_id] = review
        return latest

    def _load_rejection_notes(self, app_ids: List[str]) -> Dict[str, str]:
        if not app_ids:
            return {}
        updates = (
            self.db.query(StatusUpdate)
            .filter(
                and_(
                    StatusUpdate.application_id.in_(app_ids),
                    StatusUpdate.status == "rejected",
                )
            )
            .order_by(StatusUpdate.application_id, StatusUpdate.timestamp.desc())
            .all()
        )
        notes: Dict[str, str] = {}
        for update in updates:
            if update.application_id not in notes:
                notes[update.application_id] = update.notes or "No reason provided"
        return notes

    def _load_document_counts(self, app_ids: List[str]) -> Dict[str, int]:
        if not app_ids:
            return {}
        rows = (
            self.db.query(Document.application_id, func.count(Document.id))
            .filter(Document.application_id.in_(app_ids))
            .group_by(Document.application_id)
            .all()
        )
        return {application_id: count for application_id, count in rows}

    # ------------------------------------------------------------------
    # Internal helpers — snapshots
    # ------------------------------------------------------------------
    def _create_snapshot(self, days_back: int) -> BiasMonitoringSnapshot:
        cutoff = datetime.utcnow() - timedelta(days=days_back)

        total_rejected = (
            self.db.query(Application)
            .filter(
                and_(
                    Application.status == "rejected",
                    Application.updated_at >= cutoff,
                )
            )
            .count()
        )

        reviews: List[BiasReview] = (
            self.db.query(BiasReview)
            .filter(BiasReview.reviewed_at >= cutoff)
            .options(joinedload(BiasReview.application))
            .all()
        )

        reviewed_count = len(reviews)
        bias_reviews = [review for review in reviews if review.result == "biased"]
        bias_detected_count = len(bias_reviews)
        bias_rate = round((bias_detected_count / reviewed_count * 100) if reviewed_count else 0.0, 2)

        bias_by_country: Dict[str, int] = defaultdict(int)
        bias_by_visa_type: Dict[str, int] = defaultdict(int)
        audit_status_breakdown: Dict[str, int] = defaultdict(int)

        for review in reviews:
            audit_status_breakdown[review.audit_status] += 1

        for review in bias_reviews:
            app = review.application
            if not app:
                continue
            answers = json.loads(app.answers) if app.answers else {}
            country = answers.get("nationality", "Unknown")
            bias_by_country[country] += 1
            bias_by_visa_type[app.visa_type] += 1

        patterns = self._derive_pattern_summaries(
            [
                {
                    "application": self._augment_keys(
                        {
                            "country": json.loads(review.application.answers).get("nationality", "Unknown")
                            if review.application and review.application.answers
                            else "Unknown",
                            "visa_type": review.application.visa_type if review.application else "unknown",
                        }
                    ),
                    "review_result": review.result,
                }
                for review in reviews
            ]
        )

        alerts = self._determine_alerts(bias_rate, patterns)

        metrics = {
            "total_rejected": total_rejected,
            "sampled_count": min(total_rejected, max(1, int(total_rejected * 0.1))) if total_rejected else 0,
            "reviewed_count": reviewed_count,
            "bias_detected_count": bias_detected_count,
            "bias_rate": bias_rate,
            "bias_by_country": dict(bias_by_country),
            "bias_by_visa_type": dict(bias_by_visa_type),
            "audit_status_breakdown": dict(audit_status_breakdown),
            "common_bias_patterns": patterns,
            "alerts": alerts,
            "window_days": days_back,
        }

        snapshot = BiasMonitoringSnapshot(
            id=generate_id("biassnap"),
            generated_at=datetime.utcnow(),
            total_rejected=total_rejected,
            sampled_count=metrics["sampled_count"],
            reviewed_count=reviewed_count,
            bias_detected_count=bias_detected_count,
            bias_rate=bias_rate,
            window_days=days_back,
            snapshot_data=json.dumps(metrics),
        )

        self.db.add(snapshot)
        self.db.commit()
        self.db.refresh(snapshot)
        return snapshot

    def _serialize_snapshot(self, snapshot: BiasMonitoringSnapshot) -> Dict[str, Any]:
        metrics = snapshot._json_load(snapshot.snapshot_data, {})
        dto = {
            "snapshot_id": snapshot.id,
            "snapshotId": snapshot.id,
            "generated_at": snapshot.generated_at.isoformat() if snapshot.generated_at else None,
            "generatedAt": snapshot.generated_at.isoformat() if snapshot.generated_at else None,
            "metrics": self._augment_nested(metrics),
        }
        return dto

    def _determine_alerts(self, bias_rate: float, patterns: Sequence[str]) -> List[str]:
        alerts: List[str] = []
        if bias_rate > 25:
            alerts.append("Bias rate exceeds 25% threshold — immediate review recommended")
        elif bias_rate > 10:
            alerts.append("Bias rate trending high — schedule focused audit")
        if patterns:
            alerts.append("Investigate top recurring bias patterns")
        return alerts

    # ------------------------------------------------------------------
    # Internal helpers — influence model
    # ------------------------------------------------------------------
    def _train_influence_model(
        self, window_start: datetime, window_end: datetime, window_days: int
    ) -> BiasInfluenceModel:
        attribute_records = (
            self.db.query(BiasInfluenceAttribute)
            .order_by(BiasInfluenceAttribute.id)
            .all()
        )
        if not attribute_records:
            # Ensure we still return an empty model for API consumption
            empty_model = BiasInfluenceModel(
                id=generate_id("biasmodel"),
                window_start=window_start,
                window_end=window_end,
                window_days=window_days,
                sample_size=0,
                auc=0.0,
                refreshed_at=datetime.utcnow(),
                model_metadata=json.dumps({"reason": "No attribute configuration available"}),
                warnings=json.dumps(["Attribute catalog is empty; unable to train influence model."]),
            )
            self.db.add(empty_model)
            self.db.commit()
            self.db.refresh(empty_model)
            return empty_model

        reviews = (
            self.db.query(BiasReview)
            .options(
                joinedload(BiasReview.application).joinedload(Application.documents)
            )
            .filter(BiasReview.reviewed_at >= window_start)
            .filter(BiasReview.reviewed_at <= window_end)
            .all()
        )

        if len(reviews) < self.MIN_MODEL_SAMPLE or not LogisticRegression or np is None:
            warning_messages = []
            if len(reviews) < self.MIN_MODEL_SAMPLE:
                warning_messages.append("Insufficient reviewed cases to train influence model")
            if not LogisticRegression:
                warning_messages.append("scikit-learn not available; influence model skipped")
            if np is None:
                warning_messages.append("numpy not available; influence model skipped")

            empty_model = BiasInfluenceModel(
                id=generate_id("biasmodel"),
                window_start=window_start,
                window_end=window_end,
                window_days=window_days,
                sample_size=len(reviews),
                auc=0.0,
                refreshed_at=datetime.utcnow(),
                model_metadata=json.dumps({"reason": "Training prerequisites unmet"}),
                warnings=json.dumps(warning_messages),
            )
            self.db.add(empty_model)
            self.db.commit()
            self.db.refresh(empty_model)
            return empty_model

        attribute_configs = [self._attribute_config(attr) for attr in attribute_records]

        feature_matrix, outcome_vector, feature_counts = self._build_feature_matrix(reviews, attribute_configs)

        active_indices = [idx for idx, counts in enumerate(feature_counts) if counts not in (0, len(reviews))]
        if not active_indices:
            empty_model = BiasInfluenceModel(
                id=generate_id("biasmodel"),
                window_start=window_start,
                window_end=window_end,
                window_days=window_days,
                sample_size=len(reviews),
                auc=0.0,
                refreshed_at=datetime.utcnow(),
                model_metadata=json.dumps({"reason": "All features constant; unable to compute coefficients"}),
                warnings=json.dumps(["Feature matrix lacks variance across samples"]),
            )
            self.db.add(empty_model)
            self.db.commit()
            self.db.refresh(empty_model)
            return empty_model

        X = feature_matrix[:, active_indices]
        y = outcome_vector
        active_attributes = [attribute_configs[idx] for idx in active_indices]
        active_counts = [feature_counts[idx] for idx in active_indices]

        classifier = LogisticRegression(max_iter=500, solver="liblinear")
        classifier.fit(X, y)

        try:
            probabilities = classifier.predict_proba(X)[:, 1]
            auc = float(roc_auc_score(y, probabilities)) if roc_auc_score else 0.0
        except Exception:
            probabilities = np.clip(classifier.decision_function(X), 0, 1)
            auc = 0.0

        p_values = self._compute_p_values(X, probabilities, classifier.coef_[0])

        previous_model = (
            self.db.query(BiasInfluenceModel)
            .options(joinedload(BiasInfluenceModel.factors))
            .order_by(BiasInfluenceModel.refreshed_at.desc())
            .first()
        )
        previous_factors: Dict[str, BiasInfluenceFactor] = {}
        if previous_model:
            for factor in previous_model.factors:
                previous_factors[factor.attribute_id] = factor

        influence_model = BiasInfluenceModel(
            id=generate_id("biasmodel"),
            window_start=window_start,
            window_end=window_end,
            window_days=window_days,
            sample_size=len(reviews),
            auc=auc,
            refreshed_at=datetime.utcnow(),
            model_metadata=json.dumps(
                {
                    "feature_ids": [config["id"] for config in active_attributes],
                    "total_features": len(attribute_configs),
                }
            ),
            warnings=json.dumps([]),
        )
        self.db.add(influence_model)
        self.db.flush()

        coefficients = classifier.coef_[0]

        for idx, attribute in enumerate(active_attributes):
            coefficient = float(coefficients[idx])
            odds_ratio = math.exp(coefficient)
            occurrences = active_counts[idx]
            sample_share = occurrences / len(reviews)
            prevalence_weight = math.sqrt(sample_share)
            p_value = float(p_values[idx]) if p_values is not None else None
            previous = previous_factors.get(attribute["id"])
            delta = coefficient - (previous.coefficient if previous else 0.0)
            direction = "driver" if coefficient >= 0 else "buffer"
            confidence_weight = max(0.0, 1 - (p_value / 0.1)) if p_value is not None else 0.0

            factor = BiasInfluenceFactor(
                id=generate_id("biasfactor"),
                model=influence_model,
                attribute_id=attribute["id"],
                coefficient=coefficient,
                odds_ratio=odds_ratio,
                sample_share=sample_share,
                prevalence_weight=prevalence_weight,
                p_value=p_value,
                delta=delta,
                direction=direction,
                extra=json.dumps(
                    {
                        "display_label": attribute["label"],
                        "confidence_weight": confidence_weight,
                        "occurrences": occurrences,
                    }
                ),
            )
            self.db.add(factor)

        self.db.commit()
        self.db.refresh(influence_model)
        return influence_model

    def _attribute_config(self, attribute: BiasInfluenceAttribute) -> Dict[str, Any]:
        config = attribute._json_load(attribute.config, {})
        return {
            "id": attribute.id,
            "label": config.get("label", attribute.label),
            "explanation": config.get("explanation", attribute.explanation or ""),
            "feature": config.get("feature", {}),
        }

    def _build_feature_matrix(
        self,
        reviews: Sequence[BiasReview],
        attributes: Sequence[Dict[str, Any]],
    ) -> Tuple[Any, Any, List[int]]:
        matrix: List[List[float]] = []
        outcomes: List[int] = []
        counts = [0 for _ in attributes]

        for review in reviews:
            app = review.application
            answers = json.loads(app.answers) if app and app.answers else {}
            documents_count = len(app.documents) if app and app.documents else 0

            row: List[float] = []
            for idx, attribute in enumerate(attributes):
                feature_value = self._evaluate_feature(attribute["feature"], app, answers, documents_count, review)
                if feature_value:
                    counts[idx] += 1
                row.append(float(feature_value))

            matrix.append(row)
            outcomes.append(1 if review.result == "biased" else 0)

        return np.array(matrix, dtype=float), np.array(outcomes, dtype=float), counts

    def _evaluate_feature(
        self,
        feature_config: Dict[str, Any],
        application: Optional[Application],
        answers: Dict[str, Any],
        documents_count: int,
        review: BiasReview,
    ) -> float:
        if not feature_config:
            return 0.0
        feature_type = feature_config.get("type")
        if feature_type == "risk_score_bucket":
            bucket = feature_config.get("bucket", "medium")
            score = application.risk_score if application and application.risk_score is not None else 0
            if bucket == "high":
                return 1.0 if score >= feature_config.get("threshold", 70) else 0.0
            if bucket == "low":
                return 1.0 if score <= feature_config.get("threshold", 30) else 0.0
            return 1.0 if feature_config.get("min", 30) <= score < feature_config.get("max", 70) else 0.0
        if feature_type == "visa_type":
            return 1.0 if application and application.visa_type == feature_config.get("value") else 0.0
        if feature_type == "country_in":
            values = feature_config.get("values", [])
            country = answers.get(feature_config.get("path", "nationality"), "Unknown")
            return 1.0 if country in values else 0.0
        if feature_type == "documents_gte":
            return 1.0 if documents_count >= feature_config.get("value", 0) else 0.0
        if feature_type == "ai_confidence_gte":
            confidence = review.ai_confidence or 0
            return 1.0 if confidence >= feature_config.get("value", 80) else 0.0
        if feature_type == "answer_equals":
            key = feature_config.get("path")
            expected = feature_config.get("value")
            return 1.0 if answers.get(key) == expected else 0.0
        return 0.0

    def _compute_p_values(self, X: Any, probabilities: Any, coefficients: Any) -> Optional[Any]:
        if norm is None or np is None:
            return None
        try:
            probs = np.clip(probabilities, 1e-6, 1 - 1e-6)
            W = np.diag(probs * (1 - probs))
            X_design = np.hstack([np.ones((X.shape[0], 1)), X])
            xtwx = X_design.T @ W @ X_design
            cov = np.linalg.inv(xtwx)
            standard_errors = np.sqrt(np.diag(cov))[1:]
            z_scores = coefficients / standard_errors
            p_values = 2 * (1 - norm.cdf(np.abs(z_scores)))
            return p_values
        except Exception:
            return None

    def _serialize_model(self, model: BiasInfluenceModel) -> Dict[str, Any]:
        factors = []
        ordered_factors = sorted(model.factors, key=lambda item: abs(item.coefficient), reverse=True)
        for factor in ordered_factors:
            entry = factor.as_leaderboard_entry()
            entry.update(self._augment_keys(entry))
            factors.append(entry)
        metadata = model.metadata_dict()
        response = {
            "factors": factors,
            "model": {
                "sample_size": model.sample_size,
                "sampleSize": model.sample_size,
                "auc": model.auc,
                "refreshed_at": model.refreshed_at.isoformat() if model.refreshed_at else None,
                "refreshedAt": model.refreshed_at.isoformat() if model.refreshed_at else None,
                "window_days": model.window_days,
                "windowDays": model.window_days,
                "metadata": metadata,
                "warnings": model.warnings_list(),
            },
        }
        return response

    # ------------------------------------------------------------------
    # Key formatting helpers
    # ------------------------------------------------------------------
    def _augment_keys(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        augmented: Dict[str, Any] = {}
        for key, value in payload.items():
            augmented[key] = value
            camel_key = self._snake_to_camel(key)
            if camel_key != key:
                augmented[camel_key] = value
        return augmented

    def _augment_nested(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        result = {}
        for key, value in payload.items():
            if isinstance(value, dict):
                nested_value = self._augment_nested(value)
                result[key] = nested_value
                camel_key = self._snake_to_camel(key)
                if camel_key != key:
                    result[camel_key] = nested_value
            elif isinstance(value, list):
                augmented_list = [self._augment_nested(item) if isinstance(item, dict) else item for item in value]
                result[key] = augmented_list
                camel_key = self._snake_to_camel(key)
                if camel_key != key:
                    result[camel_key] = augmented_list
            else:
                result[key] = value
                camel_key = self._snake_to_camel(key)
                if camel_key != key:
                    result[camel_key] = value
        return result

    @staticmethod
    def _snake_to_camel(value: str) -> str:
        if "_" not in value:
            return value
        start, *rest = value.split("_")
        return start + "".join(word.capitalize() for word in rest)


def get_bias_monitoring_service(db: Session) -> BiasMonitoringService:
    return BiasMonitoringService(db)


def refresh_bias_snapshot(days_back: int) -> None:
    from database import get_db_session

    session = get_db_session()
    try:
        service = BiasMonitoringService(session)
        service.enqueue_snapshot(days_back)
    finally:
        session.close()
