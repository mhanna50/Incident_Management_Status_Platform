import json
from django.test import TestCase
from django.urls import reverse

from incidents.models import Incident, IncidentUpdate, Subscriber


class IdempotencyTests(TestCase):
    def setUp(self):
        self.incident = Incident.objects.create(
            title="API outage",
            summary="Investigating elevated errors",
            severity=Incident.Severity.SEV2,
            status=Incident.Status.INVESTIGATING,
            is_public=True,
            created_by_name="Alice",
        )

    def test_incident_update_is_idempotent(self):
        url = reverse("incident-updates", args=[self.incident.id])
        payload = {"message": "Update message", "created_by_name": "Bob"}
        headers = {"HTTP_IDEMPOTENCY_KEY": "update-key-1"}

        first = self.client.post(
            url,
            data=json.dumps(payload),
            content_type="application/json",
            **headers,
        )
        self.assertEqual(first.status_code, 201)
        second = self.client.post(
            url,
            data=json.dumps(payload),
            content_type="application/json",
            **headers,
        )
        self.assertEqual(second.status_code, 201)
        self.assertEqual(IncidentUpdate.objects.count(), 1)
        self.assertEqual(first.json(), second.json())

    def test_subscriber_creation_idempotent(self):
        url = reverse("subscriber-create")
        payload = {"email": "test@example.com", "scope": "GLOBAL"}
        headers = {"HTTP_IDEMPOTENCY_KEY": "subscribe-1"}

        response = self.client.post(
            url,
            data=json.dumps(payload),
            content_type="application/json",
            **headers,
        )
        self.assertEqual(response.status_code, 201)
        duplicate = self.client.post(
            url,
            data=json.dumps(payload),
            content_type="application/json",
            **headers,
        )
        self.assertEqual(duplicate.status_code, 201)
        self.assertEqual(Subscriber.objects.count(), 1)
