from django.core.cache import cache
from django.test import TestCase

from incidents.models import Incident
from incidents.services import status as status_service


class PublicStatusCacheTests(TestCase):
    def setUp(self):
        cache.clear()
        self.incident = Incident.objects.create(
            title="API outage",
            summary="Investigating",
            severity=Incident.Severity.SEV1,
            status=Incident.Status.INVESTIGATING,
            is_public=True,
            created_by_name="Alice",
        )

    def test_cache_and_invalidation_flow(self):
        payload = status_service.get_public_status_payload()
        self.assertEqual(len(payload["active_incidents"]), 1)

        # Resolve incident without clearing cache – payload should still show previous state.
        self.incident.status = Incident.Status.RESOLVED
        self.incident.save()
        cached_payload = status_service.get_public_status_payload()
        self.assertEqual(len(cached_payload["active_incidents"]), 1)

        # After invalidation, payload should reflect updated status.
        status_service.invalidate_public_status_cache()
        refreshed = status_service.get_public_status_payload()
        self.assertEqual(len(refreshed["active_incidents"]), 0)
