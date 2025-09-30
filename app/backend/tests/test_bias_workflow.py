import json
import os
import sys
import unittest
from datetime import datetime

from fastapi.testclient import TestClient

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.append(PROJECT_ROOT)

import main  # noqa: E402
import database  # noqa: E402
from utils import generate_id, seed_flag_catalog  # noqa: E402

# Ensure tables exist for tests even if lifespan did not run.
database.create_tables()


def create_rejected_application() -> str:
    session = database.get_db_session()
    try:
        # Ensure reviewing officer exists for the tests
        officer = session.query(database.Officer).filter(database.Officer.id == 'maria.schmidt').first()
        if not officer:
            session.add(
                database.Officer(
                    id='maria.schmidt',
                    name='Officer Maria Schmidt',
                    email='maria@embassy.gov',
                    role='Senior Consular Officer',
                    embassy_id='us_demo',
                    password_hash='demo123',
                )
            )

        user_id = generate_id('user')
        application_id = generate_id('app')

        user = database.User(
            id=user_id,
            email=f'{user_id}@example.com',
            name='Test Applicant',
            phone='+1000000000',
            nationality='Testonia',
        )

        answers = {
            'applicant_name': 'Test Applicant',
            'nationality': 'Testonia',
            'destination_country': 'Germany',
        }

        application = database.Application(
            id=application_id,
            user_id=user_id,
            visa_type='tourist',
            status='rejected',
            priority='normal',
            risk_score=55,
            answers=json.dumps(answers),
            submitted_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        rejection_update = database.StatusUpdate(
            id=generate_id('status'),
            application_id=application_id,
            status='rejected',
            notes='Automated risk score triggered rejection',
            officer_id='maria.schmidt',
            timestamp=datetime.utcnow(),
        )

        session.add(user)
        session.add(application)
        session.add(rejection_update)
        session.commit()
        return application_id
    finally:
        session.close()


def create_application_with_document(visa_type: str = 'tourist') -> tuple[str, str]:
    """Create an application with a single uploaded document for flagging tests."""

    session = database.get_db_session()
    try:
        seed_flag_catalog(session)

        officer = session.query(database.Officer).filter(database.Officer.id == 'maria.schmidt').first()
        if not officer:
            session.add(
                database.Officer(
                    id='maria.schmidt',
                    name='Officer Maria Schmidt',
                    email='maria@embassy.gov',
                    role='Senior Consular Officer',
                    embassy_id='us_demo',
                    password_hash='demo123',
                )
            )

        user_id = generate_id('user')
        application_id = generate_id('app')
        document_id = generate_id('doc')
        now = datetime.utcnow()

        user = database.User(
            id=user_id,
            email=f'{user_id}@example.com',
            name='Flag Test Applicant',
            phone='+10000001234',
            nationality='Testlandia',
        )

        answers = {
            'applicant_name': 'Flag Test Applicant',
            'nationality': 'Testlandia',
            'destination_country': 'Germany',
        }

        application = database.Application(
            id=application_id,
            user_id=user_id,
            visa_type=visa_type,
            status='document_review',
            priority='normal',
            risk_score=42,
            answers=json.dumps(answers),
            submitted_at=now,
            updated_at=now,
        )

        document = database.Document(
            id=document_id,
            application_id=application_id,
            name='Passport Scan',
            type='passport',
            size=128,
            verified=False,
            uploaded_at=now,
            file_path='uploads/test/passport.pdf',
        )

        session.add(user)
        session.add(application)
        session.add(document)
        session.commit()
        return application_id, document_id
    finally:
        session.close()


class BiasWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)

    def test_bias_review_sample_and_submit(self):
        application_id = create_rejected_application()

        sample_response = self.client.get('/api/bias-monitoring/sample?sample_rate=1.0&days_back=90')
        self.assertEqual(sample_response.status_code, 200)
        sample_data = sample_response.json()
        self.assertIn('cases', sample_data)

        matched_cases = [case for case in sample_data['cases'] if case['application']['id'] == application_id]
        self.assertTrue(matched_cases, 'Expected rejected application to be present in bias review sample')

        review_payload = {
            'result': 'biased',
            'notes': 'Manual test review flagged bias for QA.',
            'officer_id': 'maria.schmidt',
            'ai_confidence': matched_cases[0]['ai_confidence'],
        }
        review_response = self.client.post(
            f'/api/bias-monitoring/review/{application_id}',
            json=review_payload,
        )
        self.assertEqual(review_response.status_code, 200)

        session = database.get_db_session()
        try:
            record = (
                session.query(database.BiasReview)
                .filter(database.BiasReview.application_id == application_id)
                .first()
            )
            self.assertIsNotNone(record)
            self.assertEqual(record.result, 'biased')
            self.assertEqual(record.audit_status, 'pending')
        finally:
            session.close()

    def test_review_audit_flow(self):
        queue_response = self.client.get('/api/review-audit/queue?status=pending&limit=5')
        self.assertEqual(queue_response.status_code, 200)

        queue_data = queue_response.json().get('items', [])
        if not queue_data:
            self.skipTest('No pending reviews available for audit flow test')

        review_id = queue_data[0]['review']['id']

        decision_payload = {
            'decision': 'clear_to_proceed',
            'notes': 'Validated during automated test run.',
            'auditor_id': 'maria.schmidt',
        }
        decision_response = self.client.post(
            f'/api/review-audit/{review_id}/decision',
            json=decision_payload,
        )
        self.assertEqual(decision_response.status_code, 200)
        updated_review = decision_response.json()['review']['review']
        self.assertEqual(updated_review['audit_status'], 'clear_to_proceed')

    def test_bias_monitoring_snapshot_generation(self):
        trigger_response = self.client.post('/api/bias-monitoring/snapshot?days_back=30')
        self.assertEqual(trigger_response.status_code, 200)

        history_response = self.client.get('/api/bias-monitoring/history?limit=1')
        self.assertEqual(history_response.status_code, 200)
        history = history_response.json().get('history', [])
        self.assertGreaterEqual(len(history), 1)

    def test_bias_monitoring_overview_and_leaderboard(self):
        overview_response = self.client.get('/api/bias-monitoring/overview?days_back=30')
        self.assertEqual(overview_response.status_code, 200)
        overview = overview_response.json()
        self.assertIn('snapshotId', overview)
        self.assertIn('metrics', overview)
        metrics = overview['metrics']
        self.assertIn('biasRate', metrics)
        self.assertIn('commonBiasPatterns', metrics)

        leaderboard_response = self.client.get('/api/bias-influence/leaderboard?days_back=30')
        self.assertEqual(leaderboard_response.status_code, 200)
        leaderboard = leaderboard_response.json()
        self.assertIn('factors', leaderboard)
        self.assertIn('model', leaderboard)
        factors = leaderboard['factors']
        self.assertIsInstance(factors, list)
        model_meta = leaderboard['model']
        self.assertIn('sampleSize', model_meta)
        self.assertGreaterEqual(model_meta['sampleSize'], 0)

        # Expect our seeded influence factors to be present and carry numeric weights
        attribute_ids = {factor.get('attributeId') for factor in factors}
        self.assertIn('origin_colombia', attribute_ids)
        self.assertIn('doc_quantity_low', attribute_ids)

        for factor in factors:
            self.assertIn('coefficient', factor)
            self.assertIn('sampleShare', factor)
            self.assertIsInstance(factor['coefficient'], (int, float))
            self.assertGreaterEqual(factor['sampleShare'], 0.0)
            self.assertLessEqual(factor['sampleShare'], 1.0)

        if not factors:
            warnings = model_meta.get('warnings', [])
            self.assertTrue(warnings)

        attributes_response = self.client.get('/api/bias-influence/attributes')
        self.assertEqual(attributes_response.status_code, 200)
        categories = attributes_response.json().get('categories', [])
        self.assertGreater(len(categories), 0)
        self.assertIn('attributes', categories[0])

    def test_bias_review_cadence_endpoint(self):
        cadence_response = self.client.get('/api/bias-monitoring/cadence')
        self.assertEqual(cadence_response.status_code, 200)
        cadence = cadence_response.json()
        self.assertIn('bands', cadence)
        self.assertIsInstance(cadence['bands'], list)
        self.assertGreater(len(cadence['bands']), 0)
        first_band = cadence['bands'][0]
        self.assertIn('interval', first_band)
        self.assertIn('reviewTime', first_band)
        self.assertIn('viewTime', first_band)

    def test_bias_influence_attributes_endpoint(self):
        response = self.client.get('/api/bias-influence/attributes')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        categories = payload.get('categories', [])
        self.assertTrue(any(category.get('id') == 'origin_trends' for category in categories))
        origin_category = next(category for category in categories if category.get('id') == 'origin_trends')
        origin_ids = {attribute['id'] for attribute in origin_category.get('attributes', [])}
        self.assertTrue({'origin_colombia', 'origin_kenya', 'origin_philippines'}.issubset(origin_ids))


    def test_flags_catalog_structure(self):
        session = database.get_db_session()
        try:
            seed_flag_catalog(session)
            session.commit()
        finally:
            session.close()

        response = self.client.get('/api/flags/catalog')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('categories', payload)
        self.assertIn('decisions', payload)
        self.assertIn('matrix', payload)
        self.assertTrue(all('code' in category and 'label' in category for category in payload['categories']))
        self.assertTrue(all('code' in decision and 'label' in decision for decision in payload['decisions']))

        decision_codes = {decision['code'] for decision in payload['decisions']}
        self.assertSetEqual(
            decision_codes,
            {
                'clear_to_proceed',
                'request_clarification',
                'request_additional_docs',
                'issue_conditional_approval',
                'escalate_to_policy',
                'escalate_to_security',
                'overturn_flag',
                'refer_for_training',
            },
        )

        matrix = payload['matrix']
        self.assertSetEqual(
            {entry['code'] for entry in matrix['document_gap']},
            {
                'clear_to_proceed',
                'request_clarification',
                'request_additional_docs',
                'issue_conditional_approval',
                'overturn_flag',
                'refer_for_training',
            },
        )
        self.assertTrue(
            any(entry['code'] == 'request_additional_docs' and entry['requiresFollowUp'] for entry in matrix['document_gap'])
        )

        self.assertSetEqual(
            {entry['code'] for entry in matrix['identity_mismatch']},
            {
                'clear_to_proceed',
                'request_additional_docs',
                'request_clarification',
                'escalate_to_policy',
                'escalate_to_security',
                'overturn_flag',
                'refer_for_training',
            },
        )
        self.assertTrue(
            any(entry['code'] == 'request_additional_docs' and entry['requiresFollowUp'] for entry in matrix['identity_mismatch'])
        )
        self.assertTrue(
            all(
                (entry['code'] != 'request_additional_docs' and not entry['requiresFollowUp'])
                or (entry['code'] == 'request_additional_docs' and entry['requiresFollowUp'])
                for entry in matrix['identity_mismatch']
            )
        )

        self.assertSetEqual(
            {entry['code'] for entry in matrix['document_authenticity']},
            {
                'clear_to_proceed',
                'request_additional_docs',
                'escalate_to_policy',
                'escalate_to_security',
            },
        )

        self.assertSetEqual(
            {entry['code'] for entry in matrix['financial_concern']},
            {
                'clear_to_proceed',
                'request_clarification',
                'request_additional_docs',
                'issue_conditional_approval',
                'escalate_to_policy',
                'refer_for_training',
            },
        )

        self.assertSetEqual(
            {entry['code'] for entry in matrix['travel_intent_risk']},
            {
                'clear_to_proceed',
                'request_clarification',
                'request_additional_docs',
                'issue_conditional_approval',
                'escalate_to_policy',
                'overturn_flag',
                'refer_for_training',
            },
        )

        self.assertSetEqual(
            {entry['code'] for entry in matrix['compliance_alert']},
            {
                'clear_to_proceed',
                'escalate_to_policy',
                'escalate_to_security',
                'overturn_flag',
            },
        )
        self.assertTrue(
            all(not entry['requiresFollowUp'] for entry in matrix['compliance_alert'])
        )

        def test_document_flagging_workflow(self):
            application_id, document_id = create_application_with_document()

            flag_response = self.client.post(
                f'/api/applications/{application_id}/flag-document',
                json={
                    'document_id': document_id,
                    'reason': 'Document incomplete',
                    'officer_id': 'maria.schmidt',
                    'flag_category_code': 'document_gap',
                },
            )
            self.assertEqual(flag_response.status_code, 200)
            flag_payload = flag_response.json()
            self.assertEqual(flag_payload['application_status'], 'flagged_for_review')
            flag_id = flag_payload['flag_id']

            application_response = self.client.get(f'/api/applications/{application_id}')
            self.assertEqual(application_response.status_code, 200)
            application_payload = application_response.json()
            self.assertEqual(application_payload['status'], 'flagged_for_review')
            self.assertEqual(len(application_payload['flagged_documents']), 1)
            flagged_entry = application_payload['flagged_documents'][0]
            self.assertEqual(flagged_entry['document_id'], document_id)
            self.assertFalse(flagged_entry['resolved'])

            unflag_response = self.client.post(
                f'/api/applications/{application_id}/unflag-document',
                json={'flag_id': flag_id},
            )
            self.assertEqual(unflag_response.status_code, 200)
            self.assertNotEqual(unflag_response.json().get('application_status'), 'flagged_for_review')

            post_unflag_response = self.client.get(f'/api/applications/{application_id}')
            self.assertEqual(post_unflag_response.status_code, 200)
            post_unflag_payload = post_unflag_response.json()
            self.assertEqual(post_unflag_payload['flagged_documents'], [])
            history = post_unflag_payload.get('resolved_flag_history', [])
            self.assertGreaterEqual(len(history), 1)
            history_entry = history[0]
            self.assertTrue(history_entry['resolved'])
            self.assertEqual(history_entry['document_id'], document_id)

        def test_flag_document_rejects_invalid_category(self):
            application_id, document_id = create_application_with_document()

            response = self.client.post(
                f'/api/applications/{application_id}/flag-document',
                json={
                    'document_id': document_id,
                    'reason': 'Attempt invalid category',
                    'officer_id': 'maria.schmidt',
                    'flag_category_code': 'invalid_code',
                },
            )

            self.assertEqual(response.status_code, 400)

        def test_review_audit_category_specific_decisions(self):
            gap_app_id, gap_document_id = create_application_with_document()
            gap_flag_response = self.client.post(
                f'/api/applications/{gap_app_id}/flag-document',
                json={
                    'document_id': gap_document_id,
                    'reason': 'Need clearer scan',
                    'officer_id': 'maria.schmidt',
                    'flag_category_code': 'document_gap',
                },
            )
            self.assertEqual(gap_flag_response.status_code, 200)
            gap_review_id = gap_flag_response.json().get('audit_review_id')

            gap_decision = self.client.post(
                f'/api/review-audit/{gap_review_id}/decision',
                json={
                    'decision_code': 'request_additional_docs',
                    'notes': 'Please obtain updated paperwork.',
                    'auditor_id': 'maria.schmidt',
                },
            )
            self.assertEqual(gap_decision.status_code, 200)
            gap_payload = gap_decision.json()
            self.assertEqual(gap_payload['review']['review']['audit_status'], 'request_additional_docs')
            self.assertEqual(gap_payload['review']['audits'][0]['decision'], 'request_additional_docs')

            compliance_app_id, compliance_document_id = create_application_with_document('business')
            compliance_flag_response = self.client.post(
                f'/api/applications/{compliance_app_id}/flag-document',
                json={
                    'document_id': compliance_document_id,
                    'reason': 'Potential compliance issue',
                    'officer_id': 'maria.schmidt',
                    'flag_category_code': 'compliance_alert',
                },
            )
            self.assertEqual(compliance_flag_response.status_code, 200)
            compliance_review_id = compliance_flag_response.json().get('audit_review_id')

            compliance_decision = self.client.post(
                f'/api/review-audit/{compliance_review_id}/decision',
                json={
                    'decision_code': 'escalate_to_policy',
                    'notes': 'Needs compliance review.',
                    'auditor_id': 'maria.schmidt',
                },
            )
            self.assertEqual(compliance_decision.status_code, 200)
            compliance_payload = compliance_decision.json()
            self.assertEqual(compliance_payload['review']['review']['audit_status'], 'escalate_to_policy')
            self.assertEqual(compliance_payload['review']['audits'][0]['decision'], 'escalate_to_policy')

    def test_applicant_flag_visibility_requires_follow_up(self):
        application_id, document_id = create_application_with_document()

        flag_payload = {
            'document_id': document_id,
            'reason': 'Please upload the latest bank statement.',
            'officer_id': 'maria.schmidt',
            'flag_category_code': 'document_gap',
        }

        flag_response = self.client.post(
            f'/api/applications/{application_id}/flag-document',
            json=flag_payload,
        )
        self.assertEqual(flag_response.status_code, 200)

        application_before_audit = self.client.get(f'/api/applications/{application_id}')
        self.assertEqual(application_before_audit.status_code, 200)
        payload_before_audit = application_before_audit.json()

        flagged_docs = payload_before_audit.get('flagged_documents', [])
        self.assertGreaterEqual(len(flagged_docs), 1)
        flagged_doc = flagged_docs[0]
        self.assertIsNone(flagged_doc.get('audit_decision_code'))
        self.assertFalse(flagged_doc.get('applicant_visible'))
        self.assertIsNone(flagged_doc.get('audit_decision_requires_follow_up'))

        session = database.get_db_session()
        try:
            review = (
                session.query(database.BiasReview)
                .filter(database.BiasReview.application_id == application_id)
                .order_by(database.BiasReview.reviewed_at.desc())
                .first()
            )
            self.assertIsNotNone(review)
            review_id = review.id
        finally:
            session.close()

        audit_payload = {
            'decision_code': 'request_additional_docs',
            'notes': 'Applicant must upload a more recent statement.',
            'auditor_id': 'maria.schmidt',
        }
        audit_response = self.client.post(
            f'/api/review-audit/{review_id}/decision',
            json=audit_payload,
        )
        self.assertEqual(audit_response.status_code, 200)

        application_after_audit = self.client.get(f'/api/applications/{application_id}')
        self.assertEqual(application_after_audit.status_code, 200)
        payload_after_audit = application_after_audit.json()

        flagged_docs_after = payload_after_audit.get('flagged_documents', [])
        self.assertGreaterEqual(len(flagged_docs_after), 1)
        flagged_doc_after = flagged_docs_after[0]
        self.assertEqual(flagged_doc_after.get('audit_decision_code'), 'request_additional_docs')
        self.assertTrue(flagged_doc_after.get('applicant_visible'))
        self.assertTrue(flagged_doc_after.get('audit_decision_requires_follow_up'))


if __name__ == '__main__':
    unittest.main()
