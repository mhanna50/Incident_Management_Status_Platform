from unittest import mock

from django.test import TestCase

from incidents.models import EmailDelivery, Incident
from incidents.services import notifications
from incidents.tasks import send_email_delivery


class NotificationTests(TestCase):
    def setUp(self):
        self.incident = Incident.objects.create(
            title="DB outage",
            summary="Investigating database connectivity",
            severity=Incident.Severity.SEV1,
            status=Incident.Status.INVESTIGATING,
            is_public=True,
            created_by_name="Alice",
        )

    @mock.patch("incidents.tasks.send_mail", return_value=1)
    def test_enqueue_email_delivery_creates_and_sends(self, mock_send_mail):
        deliveries = notifications.enqueue_email_deliveries(
            self.incident,
            subject="Test subject",
            body="Test body",
            recipients=["user@example.com"],
        )
        self.assertEqual(len(deliveries), 1)
        delivery = EmailDelivery.objects.get(subscriber_email="user@example.com")
        self.assertEqual(delivery.status, EmailDelivery.Status.SENT)
        self.assertEqual(delivery.attempts, 1)
        mock_send_mail.assert_called_once()

    def test_send_email_delivery_marks_failed_after_max_attempts(self):
        delivery = EmailDelivery.objects.create(
            incident=self.incident,
            subscriber_email="fail@example.com",
            subject="subject",
            body="body",
            attempts=send_email_delivery.max_retries,
        )
        with mock.patch("incidents.tasks.send_mail", side_effect=Exception("boom")):
            send_email_delivery.run(str(delivery.id))
        delivery.refresh_from_db()
        self.assertEqual(delivery.status, EmailDelivery.Status.FAILED)
        self.assertIn("boom", delivery.last_error)
