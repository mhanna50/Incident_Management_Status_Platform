from django.test import TestCase

from incidents.services.health import get_health_status


class HealthCheckTests(TestCase):
    def test_health_status_returns_ok(self):
        status = get_health_status()
        self.assertIn(status.status, ["ok", "degraded"])
        self.assertGreaterEqual(status.uptime_seconds, 0)
