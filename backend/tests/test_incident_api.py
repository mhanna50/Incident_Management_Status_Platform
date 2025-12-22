import uuid

import pytest
from django.urls import reverse

from incidents.models import Incident


@pytest.mark.django_db
def test_create_incident_and_list(api_client):
    payload = {
        "title": "API Integration Incident",
        "summary": "Integration test summary",
        "severity": "SEV2",
        "status": "INVESTIGATING",
        "is_public": True,
        "created_by_name": "Integration Tester",
    }
    response = api_client.post(reverse("incident-list"), data=payload, format="json")
    assert response.status_code == 201
    incident_id = response.data["id"]

    list_response = api_client.get(reverse("incident-list"))
    assert list_response.status_code == 200
    assert any(item["id"] == incident_id for item in list_response.data)


@pytest.mark.django_db
def test_api_root_returns_helpful_links(api_client):
    response = api_client.get(reverse("api-root"))
    assert response.status_code == 200
    payload = response.json()
    assert payload["service"] == "Incident Management & Public Status API"
    assert "public_status" in payload["links"]
    assert payload["links"]["public_status"].endswith("/api/public/status")


@pytest.mark.django_db
def test_transition_and_updates(api_client):
    incident = Incident.objects.create(
        title="Integration Demo",
        summary="Testing transitions",
        severity=Incident.Severity.SEV3,
        status=Incident.Status.INVESTIGATING,
        is_public=True,
        created_by_name="Alex",
    )

    transition_url = reverse("incident-transition", args=[incident.id])
    response = api_client.post(
        transition_url,
        data={"status": Incident.Status.IDENTIFIED, "actor_name": "Alex"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["incident"]["status"] == Incident.Status.IDENTIFIED

    updates_url = reverse("incident-updates", args=[incident.id])
    update_response = api_client.post(
        updates_url,
        data={"message": "Posted via integration test", "created_by_name": "Alex"},
        format="json",
    )
    assert update_response.status_code == 201
    list_updates = api_client.get(updates_url)
    assert list_updates.status_code == 200
    assert any(u["message"] == "Posted via integration test" for u in list_updates.data)
