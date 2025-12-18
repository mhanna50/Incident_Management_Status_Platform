import importlib
import json

from django.test import SimpleTestCase

from incidents.services import sse


class SSEStreamTests(SimpleTestCase):
    def setUp(self):
        importlib.reload(sse)

    def test_replays_events_after_last_event_id(self):
        sse.broadcast_event("INCIDENT_CREATED", {"index": 1})
        sse.broadcast_event("INCIDENT_UPDATED", {"index": 2})

        stream = sse.stream("admin", last_event_id="1")
        payload = next(stream)
        stream.close()

        self.assertIn("id: 2", payload)
        self.assertIn("event: INCIDENT_UPDATED", payload)
        data_line = [line for line in payload.splitlines() if line.startswith("data:")][0]
        data = json.loads(data_line.split("data: ")[1])
        self.assertEqual(data["index"], 2)

    def test_heartbeat_emitted_when_idle(self):
        original_interval = sse._HEARTBEAT_INTERVAL
        sse._HEARTBEAT_INTERVAL = 0.01
        try:
            stream = sse.stream("admin")
            heartbeat = next(stream)
        finally:
            stream.close()
            sse._HEARTBEAT_INTERVAL = original_interval

        self.assertEqual(heartbeat, ": heartbeat\n\n")
