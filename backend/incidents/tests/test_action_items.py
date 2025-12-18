import json
from django.test import TestCase
from django.urls import reverse

from incidents.models import ActionItem, Incident, Postmortem


class ActionItemViewTests(TestCase):
    def setUp(self):
        self.incident = Incident.objects.create(
            title="API outage",
            summary="Investigating elevated errors",
            severity=Incident.Severity.SEV2,
            status=Incident.Status.INVESTIGATING,
            is_public=True,
            created_by_name="Alice",
        )
        self.postmortem = Postmortem.objects.create(incident=self.incident)

    def test_create_action_item(self):
        url = reverse("postmortem-action-items", args=[self.incident.id])
        payload = {
            "title": "Improve alerting",
            "owner_name": "Bob",
            "due_date": None,
        }
        response = self.client.post(
            url,
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(ActionItem.objects.count(), 1)
        action_item = ActionItem.objects.first()
        self.assertEqual(action_item.title, payload["title"])

    def test_update_action_item_status(self):
        action_item = ActionItem.objects.create(
            postmortem=self.postmortem,
            title="Patch dependency",
            owner_name="Carol",
        )
        url = reverse(
            "postmortem-action-item-detail",
            args=[self.incident.id, action_item.id],
        )
        response = self.client.patch(
            url,
            data=json.dumps({"status": ActionItem.Status.DONE}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        action_item.refresh_from_db()
        self.assertEqual(action_item.status, ActionItem.Status.DONE)
