from __future__ import annotations

from typing import Iterable

from django.core.cache import cache

from incidents.models import Incident

PUBLIC_STATUS_CACHE_KEY = "public_status_payload"
PUBLIC_STATUS_TTL = 15  # seconds


def compute_overall_status(active_incidents: Iterable[Incident]) -> str:
    severities = {incident.severity for incident in active_incidents}
    if Incident.Severity.SEV1 in severities:
        return "Major Outage"
    if Incident.Severity.SEV2 in severities:
        return "Partial Outage"
    if Incident.Severity.SEV3 in severities or Incident.Severity.SEV4 in severities:
        return "Degraded Performance"
    return "All Systems Operational"


def get_public_status_payload():
    cached = cache.get(PUBLIC_STATUS_CACHE_KEY)
    if cached:
        return cached

    active_incidents = list(
        Incident.objects.filter(is_public=True).exclude(status=Incident.Status.RESOLVED)
    )
    overall_status = compute_overall_status(active_incidents)
    payload = {
        "overall_status": overall_status,
        "active_incidents": active_incidents,
    }
    cache.set(PUBLIC_STATUS_CACHE_KEY, payload, PUBLIC_STATUS_TTL)
    return payload


def invalidate_public_status_cache():
    cache.delete(PUBLIC_STATUS_CACHE_KEY)
