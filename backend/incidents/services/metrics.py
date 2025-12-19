from __future__ import annotations

import math
from datetime import timedelta

from django.db.models import Count, DurationField, ExpressionWrapper, F, Max
from django.db.models.functions import TruncDate
from django.utils import timezone

from incidents.models import ActionItem, EmailDelivery, Incident, Subscriber
from incidents.services import analytics as analytics_service


def _resolution_durations(queryset):
    resolution_duration = ExpressionWrapper(
        F("resolved_at") - F("created_at"),
        output_field=DurationField(),
    )
    durations = (
        queryset.filter(resolved_at__isnull=False)
        .annotate(duration=resolution_duration)
        .values_list("duration", flat=True)
    )
    return [value.total_seconds() / 3600 for value in durations if value is not None]


def _percentile(values: list[float], percentile: float) -> float | None:
    if not values:
        return None
    if len(values) == 1:
        return round(values[0], 2)
    values_sorted = sorted(values)
    k = (len(values_sorted) - 1) * percentile
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return round(values_sorted[int(k)], 2)
    lower = values_sorted[f]
    upper = values_sorted[c]
    return round(lower + (upper - lower) * (k - f), 2)


def _weekly_mttr_for_queryset(queryset, weeks: int = 8):
    now = timezone.now()
    start_of_week = now - timedelta(days=now.weekday())
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
    data: list[dict[str, object]] = []
    for offset in reversed(range(weeks)):
        start = start_of_week - timedelta(weeks=offset)
        end = start + timedelta(weeks=1)
        durations = _resolution_durations(
            queryset.filter(resolved_at__gte=start, resolved_at__lt=end)
        )
        average = round(sum(durations) / len(durations), 2) if durations else None
        data.append(
            {
                "week_start": start.date().isoformat(),
                "mttr_hours": average,
            }
        )
    return data


def _active_incident_timeline(hours: int = 24):
    now = timezone.now()
    start = now - timedelta(hours=hours - 1)
    incidents = list(
        Incident.objects.values("created_at", "resolved_at", "status")
    )
    timeline = []
    for index in range(hours):
        point = start + timedelta(hours=index)
        count = 0
        for incident in incidents:
            created = incident["created_at"]
            resolved = incident["resolved_at"]
            if created <= point and (resolved is None or resolved >= point):
                count += 1
        timeline.append({"timestamp": point.isoformat(), "count": count})
    current_open = sum(
        1 for incident in incidents if incident["status"] != Incident.Status.RESOLVED
    )
    return timeline, current_open


def _subscriber_growth(days: int = 7):
    now = timezone.now()
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    counts = (
        Subscriber.objects.filter(created_at__gte=start)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(total=Count("id"))
        .order_by("day")
    )
    by_date = {row["day"]: row["total"] for row in counts}
    growth = []
    for offset in range(days):
        current_day = (start + timedelta(days=offset)).date()
        growth.append(
            {
                "date": current_day.isoformat(),
                "count": by_date.get(current_day, 0),
            }
        )
    return growth


def _email_delivery_stats():
    stats = EmailDelivery.objects.values("status").annotate(total=Count("id"))
    return [
        {"status": row["status"], "count": row["total"]}
        for row in stats
    ]


def _automation_watchlist():
    now = timezone.now()
    stale_threshold = now - timedelta(minutes=60)
    unresolved = (
        Incident.objects.exclude(status=Incident.Status.RESOLVED)
        .annotate(last_update=Max("updates__created_at"))
        .values("id", "title", "created_at", "last_update")
    )
    stale_incidents = []
    for incident in unresolved:
        last_activity = incident["last_update"] or incident["created_at"]
        if last_activity < stale_threshold:
            minutes = int((now - last_activity).total_seconds() // 60)
            stale_incidents.append(
                {
                    "id": str(incident["id"]),
                    "title": incident["title"],
                    "minutes_since_update": minutes,
                }
            )

    missing_postmortem = list(
        Incident.objects.filter(status=Incident.Status.RESOLVED, postmortem__isnull=True)
        .values("id", "title", "severity")[:20]
    )

    overdue_items = list(
        ActionItem.objects.filter(
            due_date__isnull=False,
            due_date__lt=now.date(),
        )
        .exclude(status=ActionItem.Status.DONE)
        .values("id", "title", "owner_name", "due_date")
    )

    # Cast UUIDs to string for JSON serialization
    for entry in missing_postmortem:
        entry["id"] = str(entry["id"])
    for entry in overdue_items:
        entry["id"] = str(entry["id"])

    return {
        "stale_incidents": stale_incidents,
        "missing_postmortems": missing_postmortem,
        "overdue_action_items": overdue_items,
    }


def get_admin_metrics():
    timeline, current_open = _active_incident_timeline(hours=48)
    severity_breakdown = analytics_service.incidents_per_severity()

    incidents = Incident.objects.all()
    weekly_all = _weekly_mttr_for_queryset(incidents)
    weekly_public = _weekly_mttr_for_queryset(incidents.filter(is_public=True))
    weekly_internal = _weekly_mttr_for_queryset(incidents.filter(is_public=False))

    all_durations = _resolution_durations(incidents.filter(resolved_at__isnull=False))
    percentiles = {
        "p50": _percentile(all_durations, 0.5),
        "p90": _percentile(all_durations, 0.9),
    }

    thirty_days_ago = timezone.now() - timedelta(days=30)
    resolved_last_month = (
        Incident.objects.filter(resolved_at__gte=thirty_days_ago, resolved_at__isnull=False)
        .values("severity")
        .annotate(total=Count("id"))
    )
    resolved_by_severity = [
        {"severity": row["severity"], "count": row["total"]} for row in resolved_last_month
    ]

    subscriber_growth = _subscriber_growth()
    email_stats = _email_delivery_stats()
    status_views = [
        {"date": entry["date"], "views": None} for entry in subscriber_growth
    ]

    watchlist = _automation_watchlist()

    visibility_breakdown = {
        "public": incidents.filter(is_public=True).count(),
        "internal": incidents.filter(is_public=False).count(),
    }

    return {
        "incident_pulse": {
            "timeline": timeline,
            "current_open": current_open,
            "sla_target": 3,
            "severity_breakdown": severity_breakdown,
        },
        "resolution_health": {
            "weekly_mttr": {
                "all": weekly_all,
                "public": weekly_public,
                "internal": weekly_internal,
            },
            "percentiles": percentiles,
            "resolved_by_severity": resolved_by_severity,
            "visibility_breakdown": visibility_breakdown,
        },
        "engagement": {
            "subscriber_growth": subscriber_growth,
            "email_delivery": email_stats,
            "status_page_views": status_views,
        },
        "automation_watchlist": watchlist,
    }
