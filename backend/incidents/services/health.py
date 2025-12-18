from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict

from django.core.cache import cache
from django.db import connections
from django.db.utils import OperationalError
from django.utils import timezone

PROCESS_STARTED_AT = timezone.now()


@dataclass
class HealthStatus:
    status: str
    database_ok: bool
    cache_ok: bool
    uptime_seconds: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "database_ok": self.database_ok,
            "cache_ok": self.cache_ok,
            "uptime_seconds": self.uptime_seconds,
            "timestamp": timezone.now(),
        }


def check_database() -> bool:
    try:
        connections["default"].cursor()
        return True
    except OperationalError:
        return False


def check_cache() -> bool:
    try:
        cache.set("healthcheck", "ok", timeout=5)
        return cache.get("healthcheck") == "ok"
    except Exception:
        return False


def get_health_status() -> HealthStatus:
    db_ok = check_database()
    cache_ok = check_cache()
    status = "ok" if db_ok and cache_ok else "degraded"
    uptime = (timezone.now() - PROCESS_STARTED_AT).total_seconds()
    return HealthStatus(status=status, database_ok=db_ok, cache_ok=cache_ok, uptime_seconds=uptime)
