from __future__ import annotations

from typing import Iterable, List

from incidents.models import EmailDelivery, Incident, IncidentUpdate, Postmortem, Subscriber
from incidents.tasks import send_email_delivery


def get_recipients_for_incident(incident: Incident) -> List[str]:
    emails = set(
        Subscriber.objects.filter(is_active=True, scope=Subscriber.Scope.GLOBAL).values_list(
            "email", flat=True
        )
    )

    incident_specific = Subscriber.objects.filter(
        is_active=True, scope=Subscriber.Scope.INCIDENT, incident=incident
    ).values_list("email", flat=True)

    emails.update(incident_specific)
    return sorted(emails)


def enqueue_email_deliveries(incident: Incident | None, subject: str, body: str, recipients: Iterable[str]):
    deliveries: List[EmailDelivery] = []
    for email in recipients:
        delivery = EmailDelivery.objects.create(
            incident=incident,
            subscriber_email=email,
            subject=subject,
            body=body,
        )
        deliveries.append(delivery)
        send_email_delivery.delay(str(delivery.id))
    return deliveries


def notify_incident_created(incident: Incident) -> None:
    recipients = get_recipients_for_incident(incident)
    subject = f"[Incident] {incident.title} created"
    body = (
        f"A new incident has been created.\n\n"
        f"Title: {incident.title}\n"
        f"Severity: {incident.severity}\n"
        f"Status: {incident.status}\n\n"
        f"{incident.summary}"
    )
    enqueue_email_deliveries(incident, subject, body, recipients)


def notify_status_changed(incident: Incident, update: IncidentUpdate) -> None:
    recipients = get_recipients_for_incident(incident)
    subject = f"[Incident] {incident.title} status changed to {incident.status}"
    body = f"{update.created_by_name} updated the incident:\n\n{update.message}"
    enqueue_email_deliveries(incident, subject, body, recipients)


def notify_update_posted(incident: Incident, update: IncidentUpdate) -> None:
    recipients = get_recipients_for_incident(incident)
    subject = f"[Incident] Update on {incident.title}"
    body = f"{update.created_by_name} wrote:\n\n{update.message}"
    enqueue_email_deliveries(incident, subject, body, recipients)


def notify_postmortem_published(incident: Incident, postmortem: Postmortem) -> None:
    recipients = get_recipients_for_incident(incident)
    subject = f"[Incident] Postmortem published for {incident.title}"
    body = (
        f"A postmortem has been published for the incident '{incident.title}'.\n\n"
        f"Summary:\n{postmortem.summary or 'No summary provided.'}"
    )
    enqueue_email_deliveries(incident, subject, body, recipients)
