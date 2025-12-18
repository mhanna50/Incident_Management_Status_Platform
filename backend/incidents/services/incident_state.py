from __future__ import annotations

from typing import Tuple

from django.db import transaction
from django.utils import timezone

from incidents.models import AuditEvent, Incident, IncidentUpdate

from . import notifications, sse, status as status_service

ALLOWED_TRANSITIONS = {
    Incident.Status.INVESTIGATING: {
        Incident.Status.IDENTIFIED,
        Incident.Status.MONITORING,
        Incident.Status.RESOLVED,
    },
    Incident.Status.IDENTIFIED: {
        Incident.Status.MONITORING,
        Incident.Status.RESOLVED,
    },
    Incident.Status.MONITORING: {Incident.Status.RESOLVED},
    Incident.Status.RESOLVED: {Incident.Status.INVESTIGATING},
}


def transition_incident(
    incident: Incident,
    new_status: str,
    actor_name: str,
    message: str | None = None,
) -> Tuple[Incident, IncidentUpdate]:
    """
    Validate and persist an incident status transition while generating updates and notifications.
    """

    if not actor_name:
        raise ValueError("actor_name is required for transitions")

    if new_status not in Incident.Status.values:
        raise ValueError(f"Unsupported status: {new_status}")

    if incident.status == new_status:
        raise ValueError("Incident is already in the requested status")

    allowed = ALLOWED_TRANSITIONS.get(incident.status, set())
    if new_status not in allowed:
        raise ValueError(f"Cannot transition from {incident.status} to {new_status}")

    previous_status = incident.status

    with transaction.atomic():
        incident.status = new_status
        incident.updated_at = timezone.now()
        if new_status == Incident.Status.RESOLVED:
            incident.resolved_at = incident.resolved_at or timezone.now()
        else:
            incident.resolved_at = None
        incident.save(update_fields=["status", "updated_at", "resolved_at"])

        body = message or f"Status changed to {Incident.Status(new_status).label}"
        update = IncidentUpdate.objects.create(
            incident=incident,
            message=body,
            status_at_time=new_status,
            created_by_name=actor_name,
        )

        AuditEvent.objects.create(
            actor_name=actor_name,
            action="STATUS_CHANGED",
            incident=incident,
            metadata={"from": previous_status, "to": new_status, "message": body},
        )

        def after_commit():
            notifications.notify_status_changed(incident, update)
            sse.broadcast_incident_status_changed(incident, update)
            status_service.invalidate_public_status_cache()

        transaction.on_commit(after_commit)

    return incident, update
