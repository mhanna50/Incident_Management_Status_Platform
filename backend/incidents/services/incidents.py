from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from incidents.models import AuditEvent, Incident, IncidentUpdate
from incidents.services import notifications, sse, status as status_service
from incidents.services.incident_state import transition_incident as transition_service


def create_incident(*, data: dict) -> Incident:
    with transaction.atomic():
        incident = Incident.objects.create(**data)
        AuditEvent.objects.create(
            actor_name=incident.created_by_name,
            action="INCIDENT_CREATED",
            incident=incident,
            metadata={"severity": incident.severity, "status": incident.status},
        )

        def after_commit():
            notifications.notify_incident_created(incident)
            sse.broadcast_incident_created(incident)
            status_service.invalidate_public_status_cache()

        transaction.on_commit(after_commit)
    return incident


def update_incident_partial(*, incident: Incident, data: dict, actor_name: str) -> Incident:
    with transaction.atomic():
        for field, value in data.items():
            setattr(incident, field, value)
        incident.updated_at = timezone.now()
        if "status" in data:
            if data["status"] == Incident.Status.RESOLVED and not incident.resolved_at:
                incident.resolved_at = timezone.now()
            elif data["status"] != Incident.Status.RESOLVED:
                incident.resolved_at = None
        incident.save()

        AuditEvent.objects.create(
            actor_name=actor_name,
            action="INCIDENT_UPDATED",
            incident=incident,
            metadata=data,
        )

        def after_commit():
            sse.broadcast_incident_updated(incident)
            status_service.invalidate_public_status_cache()

        transaction.on_commit(after_commit)
    return incident


def post_update(*, incident: Incident, data: dict) -> IncidentUpdate:
    with transaction.atomic():
        incident.updated_at = timezone.now()
        incident.save(update_fields=["updated_at"])
        update = IncidentUpdate.objects.create(
            incident=incident,
            message=data["message"],
            status_at_time=data.get("status_at_time", incident.status),
            created_by_name=data["created_by_name"],
        )
        AuditEvent.objects.create(
            actor_name=update.created_by_name,
            action="INCIDENT_UPDATE_POSTED",
            incident=incident,
            metadata={"message": update.message},
        )

        def after_commit():
            notifications.notify_update_posted(incident, update)
            sse.broadcast_incident_update_posted(incident, update)
            status_service.invalidate_public_status_cache()

        transaction.on_commit(after_commit)
    return update


def transition_incident(*, incident: Incident, new_status: str, actor_name: str, message: str | None):
    return transition_service(
        incident=incident,
        new_status=new_status,
        actor_name=actor_name,
        message=message,
    )
