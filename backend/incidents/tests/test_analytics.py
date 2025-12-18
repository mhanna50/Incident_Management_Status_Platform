from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from incidents.models import Incident
from incidents.services.analytics import get_incident_analytics


class IncidentAnalyticsTests(TestCase):
    def setUp(self):
        now = timezone.now()
        Incident.objects.create(
            title="Resolved incident",
            summary="Issue resolved",
            severity=Incident.Severity.SEV1,
            status=Incident.Status.RESOLVED,
            is_public=True,
            created_by_name="Alice",
            resolved_at=now,
            created_at=now - timedelta(hours=5),
        )
        Incident.objects.create(
            title="Active incident",
            summary="Still investigating",
            severity=Incident.Severity.SEV2,
            status=Incident.Status.INVESTIGATING,
            is_public=True,
            created_by_name="Bob",
        )

    def test_returns_mttr_and_counts(self):
        analytics = get_incident_analytics()
        self.assertEqual(analytics["active_incidents"], 1)
        self.assertIsNotNone(analytics["mttr_hours"])
        self.assertGreaterEqual(analytics["incidents_per_severity"]["SEV1"], 1)
