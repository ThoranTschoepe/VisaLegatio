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
from utils import generate_id  # noqa: E402

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


class BiasWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)

    def test_bias_review_sample_and_submit(self):
        application_id = create_rejected_application()

        sample_response = self.client.get('/api/bias-review/sample?sample_rate=1.0&days_back=90')
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
        review_response = self.client.post(f'/api/bias-review/review/{application_id}', json=review_payload)
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
            'decision': 'validated',
            'notes': 'Validated during automated test run.',
            'auditor_id': 'maria.schmidt',
        }
        decision_response = self.client.post(
            f'/api/review-audit/{review_id}/decision',
            json=decision_payload,
        )
        self.assertEqual(decision_response.status_code, 200)
        updated_review = decision_response.json()['review']['review']
        self.assertEqual(updated_review['audit_status'], 'validated')

    def test_bias_monitoring_snapshot_generation(self):
        trigger_response = self.client.post('/api/bias-monitoring/snapshot?days_back=30')
        self.assertEqual(trigger_response.status_code, 200)

        history_response = self.client.get('/api/bias-monitoring/history?limit=1')
        self.assertEqual(history_response.status_code, 200)
        history = history_response.json().get('history', [])
        self.assertGreaterEqual(len(history), 1)


if __name__ == '__main__':
    unittest.main()
