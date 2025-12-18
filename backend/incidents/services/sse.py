from __future__ import annotations

import json
import queue
import threading
from collections import deque
from typing import Deque, Dict, Optional

from incidents.models import Incident, IncidentUpdate, Postmortem
from incidents.serializers import IncidentSerializer, IncidentUpdateSerializer, PostmortemSerializer

_CHANNELS: Dict[str, set] = {"admin": set(), "public": set()}
_HISTORY: Dict[str, Deque[dict]] = {
    "admin": deque(maxlen=500),
    "public": deque(maxlen=500),
}
_LOCK = threading.Lock()
_EVENT_COUNTER = 0
_HEARTBEAT_INTERVAL = 15


def _next_event_id() -> str:
    global _EVENT_COUNTER
    with _LOCK:
        _EVENT_COUNTER += 1
        return str(_EVENT_COUNTER)


def _format_sse(event: dict) -> str:
    payload = [
        f"id: {event['id']}",
        f"event: {event['type']}",
        f"data: {json.dumps(event['data'])}",
    ]
    return "\n".join(payload) + "\n\n"


def _broadcast(channel: str, event: dict) -> None:
    with _LOCK:
        _HISTORY[channel].append(event)
        clients = list(_CHANNELS[channel])

    for client_queue in clients:
        client_queue.put(event)


def broadcast_event(event_type: str, data: dict, include_public: bool = False) -> None:
    event = {"id": _next_event_id(), "type": event_type, "data": data}
    _broadcast("admin", event)
    if include_public:
        _broadcast("public", event)


def broadcast_incident_created(incident: Incident) -> None:
    broadcast_event(
        "INCIDENT_CREATED",
        IncidentSerializer(incident).data,
        include_public=incident.is_public,
    )


def broadcast_incident_updated(incident: Incident) -> None:
    broadcast_event(
        "INCIDENT_UPDATED",
        IncidentSerializer(incident).data,
        include_public=incident.is_public,
    )


def broadcast_incident_status_changed(incident: Incident, update: IncidentUpdate) -> None:
    broadcast_event(
        "INCIDENT_STATUS_CHANGED",
        {
            "incident": IncidentSerializer(incident).data,
            "update": IncidentUpdateSerializer(update).data,
        },
        include_public=incident.is_public,
    )


def broadcast_incident_update_posted(incident: Incident, update: IncidentUpdate) -> None:
    broadcast_event(
        "INCIDENT_UPDATE_POSTED",
        {
            "incident": IncidentSerializer(incident).data,
            "update": IncidentUpdateSerializer(update).data,
        },
        include_public=incident.is_public,
    )


def broadcast_postmortem_published(incident: Incident, postmortem: Postmortem) -> None:
    broadcast_event(
        "POSTMORTEM_PUBLISHED",
        {
            "incident": IncidentSerializer(incident).data,
            "postmortem": PostmortemSerializer(postmortem).data,
        },
        include_public=incident.is_public,
    )


def stream(channel: str, last_event_id: Optional[str] = None):
    if channel not in _CHANNELS:
        raise ValueError("Unknown SSE channel")

    q: queue.Queue = queue.Queue()
    with _LOCK:
        _CHANNELS[channel].add(q)
        history = list(_HISTORY[channel])

    def event_stream():
        try:
            if last_event_id:
                try:
                    last_id_int = int(last_event_id)
                    for event in history:
                        if int(event["id"]) > last_id_int:
                            yield _format_sse(event)
                except ValueError:
                    pass

            while True:
                try:
                    event = q.get(timeout=_HEARTBEAT_INTERVAL)
                    yield _format_sse(event)
                except queue.Empty:
                    yield ": heartbeat\n\n"
        finally:
            with _LOCK:
                _CHANNELS[channel].discard(q)

    return event_stream()
