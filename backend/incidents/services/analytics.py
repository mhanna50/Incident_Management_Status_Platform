from __future__ import annotations

from datetime import timedelta

from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F
from django.utils import timezone

from incidents.models import Incident


def compute_mttr_hours() -> float | None:
    resolved = Incident.objects.filter(resolved_at__isnull=False)
    if not resolved.exists():
        return None

    resolution_duration = ExpressionWrapper(
        F("resolved_at") - F("created_at"),
        output_field=DurationField(),
    )
    aggregate = resolved.annotate(resolution_time=resolution_duration).aggregate(
        average=Avg("resolution_time")
    )
    avg_duration: timedelta | None = aggregate.get("average")
    if not avg_duration:
        return None
    return round(avg_duration.total_seconds() / 3600, 2)


def incidents_per_severity() -> dict[str, int]:
    data = Incident.objects.values("severity").annotate(count=Count("id"))
    result: dict[str, int] = {row["severity"]: row["count"] for row in data}
    for severity, _ in Incident.Severity.choices:
        result.setdefault(severity, 0)
    return result


def get_incident_analytics() -> dict[str, object]:
    active_count = Incident.objects.exclude(status=Incident.Status.RESOLVED).count()
    seven_days_ago = timezone.now() - timedelta(days=7)
    resolved_last_7_days = Incident.objects.filter(
        resolved_at__isnull=False, resolved_at__gte=seven_days_ago
    ).count()

    return {
        "mttr_hours": compute_mttr_hours(),
        "active_incidents": active_count,
        "resolved_last_7_days": resolved_last_7_days,
        "incidents_per_severity": incidents_per_severity(),
    }
