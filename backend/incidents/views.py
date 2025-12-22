from __future__ import annotations

from django.http import Http404, HttpResponse, JsonResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.urls import reverse
from django.views import View
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator
from rest_framework import status as http_status
from rest_framework.response import Response
from rest_framework.views import APIView

from incidents.models import ActionItem, AuditEvent, Incident, IncidentUpdate, Postmortem
from incidents.serializers import (
    ActionItemSerializer,
    AuditEventSerializer,
    IncidentSerializer,
    IncidentUpdateSerializer,
    PostmortemSerializer,
    SubscriberSerializer,
)
from incidents.services import (
    analytics as analytics_service,
    health as health_service,
    incidents as incident_services,
    metrics as metrics_service,
    notifications,
    sse,
    status as status_service,
)
from incidents.services.idempotency import idempotent_endpoint


def api_root(request):
    """Serve a friendly landing page instead of Django's default 404."""

    def absolute(name: str) -> str:
        return request.build_absolute_uri(reverse(name))

    return JsonResponse(
        {
            "service": "Incident Management & Public Status API",
            "message": "See README.md for deployment instructions and the React frontend.",
            "links": {
                "health": absolute("healthz"),
                "prometheus_metrics": request.build_absolute_uri("/metrics"),
                "incidents": absolute("incident-list"),
                "incident_analytics": absolute("incident-analytics"),
                "public_status": absolute("public-status"),
                "public_stream": absolute("stream-public"),
            },
        }
    )


@method_decorator(ratelimit(key="ip", rate="10/m", block=True), name="post")
class IncidentListCreateView(APIView):
    def get(self, request):
        incidents = Incident.objects.order_by("-created_at")
        serializer = IncidentSerializer(incidents, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = IncidentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        incident = incident_services.create_incident(data=serializer.validated_data)
        return Response(IncidentSerializer(incident).data, status=http_status.HTTP_201_CREATED)


class IncidentDetailView(APIView):
    def get_object(self, incident_id: str) -> Incident:
        return get_object_or_404(Incident, pk=incident_id)

    def get(self, request, incident_id: str):
        incident = self.get_object(incident_id)
        return Response(IncidentSerializer(incident).data)

    def patch(self, request, incident_id: str):
        incident = self.get_object(incident_id)
        serializer = IncidentSerializer(instance=incident, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        actor_name = request.data.get("actor_name", incident.created_by_name)
        incident = incident_services.update_incident_partial(
            incident=incident,
            data=serializer.validated_data,
            actor_name=actor_name,
        )
        return Response(IncidentSerializer(incident).data)


class IncidentTransitionView(APIView):
    @idempotent_endpoint
    def post(self, request, incident_id: str):
        incident = get_object_or_404(Incident, pk=incident_id)
        target_status = request.data.get("status")
        actor_name = request.data.get("actor_name")
        message = request.data.get("message")

        if not target_status or not actor_name:
            return Response(
                {"detail": "status and actor_name are required"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        try:
            incident, update = incident_services.transition_incident(
                incident=incident,
                new_status=target_status,
                actor_name=actor_name,
                message=message,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=http_status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "incident": IncidentSerializer(incident).data,
                "update": IncidentUpdateSerializer(update).data,
            }
        )


class IncidentUpdatesView(APIView):
    def get(self, request, incident_id: str):
        incident = get_object_or_404(Incident, pk=incident_id)
        updates = incident.updates.order_by("-created_at")
        return Response(IncidentUpdateSerializer(updates, many=True).data)

    @idempotent_endpoint
    def post(self, request, incident_id: str):
        incident = get_object_or_404(Incident, pk=incident_id)
        data = request.data.copy()
        data["incident"] = str(incident.id)
        data.setdefault("status_at_time", incident.status)

        serializer = IncidentUpdateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        update = incident_services.post_update(incident=incident, data=serializer.validated_data)
        return Response(
            IncidentUpdateSerializer(update).data, status=http_status.HTTP_201_CREATED
        )


@method_decorator(ratelimit(key="ip", rate="5/m", block=True), name="post")
@method_decorator(ratelimit(key="post:email", rate="5/h", block=True), name="post")
class SubscriberCreateView(APIView):
    @idempotent_endpoint
    def post(self, request):
        serializer = SubscriberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subscriber = serializer.save()
        return Response(SubscriberSerializer(subscriber).data, status=http_status.HTTP_201_CREATED)


class AuditEventListView(APIView):
    def get(self, request):
        events = AuditEvent.objects.select_related("incident").order_by("-created_at")[:100]
        return Response(AuditEventSerializer(events, many=True).data)


class IncidentAnalyticsView(APIView):
    def get(self, request):
        data = analytics_service.get_incident_analytics()
        return Response(data)


class AdminMetricsView(APIView):
    def get(self, request):
        payload = metrics_service.get_admin_metrics()
        return Response(payload)


class PostmortemView(APIView):
    def get_incident(self, incident_id: str) -> Incident:
        return get_object_or_404(Incident, pk=incident_id)

    def get(self, request, incident_id: str):
        incident = self.get_incident(incident_id)
        if not hasattr(incident, "postmortem"):
            raise Http404("Postmortem not found")
        return Response(PostmortemSerializer(incident.postmortem).data)

    def post(self, request, incident_id: str):
        incident = self.get_incident(incident_id)
        if hasattr(incident, "postmortem"):
            return Response(
                {"detail": "Postmortem already exists"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        data = request.data.copy()
        data["incident"] = str(incident.id)
        serializer = PostmortemSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        postmortem = serializer.save()
        return Response(PostmortemSerializer(postmortem).data, status=http_status.HTTP_201_CREATED)

    def patch(self, request, incident_id: str):
        incident = self.get_incident(incident_id)
        if not hasattr(incident, "postmortem"):
            raise Http404("Postmortem not found")
        serializer = PostmortemSerializer(
            incident.postmortem, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        postmortem = serializer.save()
        return Response(PostmortemSerializer(postmortem).data)


class PostmortemPublishView(APIView):
    def post(self, request, incident_id: str):
        incident = get_object_or_404(Incident, pk=incident_id)
        if not hasattr(incident, "postmortem"):
            raise Http404("Postmortem not found")

        postmortem = incident.postmortem
        if not postmortem.published:
            postmortem.published = True
            postmortem.published_at = timezone.now()
            postmortem.save(update_fields=["published", "published_at"])

            AuditEvent.objects.create(
                actor_name=request.data.get("actor_name", "system"),
                action="POSTMORTEM_PUBLISHED",
                incident=incident,
                metadata={},
            )

            notifications.notify_postmortem_published(incident, postmortem)
            sse.broadcast_postmortem_published(incident, postmortem)

        return Response(PostmortemSerializer(postmortem).data)


class PostmortemExportView(APIView):
    def get(self, request, incident_id: str):
        incident = get_object_or_404(Incident, pk=incident_id)
        if not hasattr(incident, "postmortem"):
            raise Http404("Postmortem not found")
        postmortem = incident.postmortem
        content = [
            f"# Postmortem: {incident.title}",
            "",
            f"**Summary:** {postmortem.summary or 'N/A'}",
            "",
            f"**Impact:** {postmortem.impact or 'N/A'}",
            "",
            f"**Root Cause:** {postmortem.root_cause or 'N/A'}",
            "",
            f"**Detection:** {postmortem.detection or 'N/A'}",
            "",
            f"**Resolution:** {postmortem.resolution or 'N/A'}",
            "",
            f"**Lessons Learned:** {postmortem.lessons_learned or 'N/A'}",
        ]
        body = "\n".join(content)
        response = HttpResponse(body, content_type="text/markdown")
        response["Content-Disposition"] = f'attachment; filename="postmortem-{incident.id}.md"'
        return response


class PostmortemActionItemsView(APIView):
    def get_postmortem(self, incident_id: str) -> Postmortem:
        incident = get_object_or_404(Incident, pk=incident_id)
        if not hasattr(incident, "postmortem"):
            raise Http404("Postmortem not found")
        return incident.postmortem

    def get(self, request, incident_id: str):
        postmortem = self.get_postmortem(incident_id)
        serializer = ActionItemSerializer(postmortem.action_items.all(), many=True)
        return Response(serializer.data)

    def post(self, request, incident_id: str):
        postmortem = self.get_postmortem(incident_id)
        data = request.data.copy()
        data["postmortem"] = str(postmortem.id)
        serializer = ActionItemSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        action_item = serializer.save()
        return Response(ActionItemSerializer(action_item).data, status=http_status.HTTP_201_CREATED)


class PostmortemActionItemDetailView(APIView):
    def get_object(self, incident_id: str, action_item_id: str) -> ActionItem:
        postmortem = PostmortemActionItemsView().get_postmortem(incident_id)
        return get_object_or_404(ActionItem, pk=action_item_id, postmortem=postmortem)

    def patch(self, request, incident_id: str, action_item_id: str):
        action_item = self.get_object(incident_id, action_item_id)
        serializer = ActionItemSerializer(action_item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        action_item = serializer.save()
        return Response(ActionItemSerializer(action_item).data)


class PublicStatusView(APIView):
    def get(self, request):
        payload = status_service.get_public_status_payload()
        data = {
            "overall_status": payload["overall_status"],
            "active_incidents": IncidentSerializer(payload["active_incidents"], many=True).data,
        }
        return Response(data)


class PublicIncidentDetailView(APIView):
    def get(self, request, incident_id: str):
        incident = get_object_or_404(Incident, pk=incident_id, is_public=True)
        return Response(IncidentSerializer(incident).data)


class PublicPostmortemView(APIView):
    def get(self, request, incident_id: str):
        incident = get_object_or_404(Incident, pk=incident_id, is_public=True)
        if not hasattr(incident, "postmortem") or not incident.postmortem.published:
            raise Http404("Postmortem not available")
        return Response(PostmortemSerializer(incident.postmortem).data)


class AdminStreamView(View):
    def get(self, request, *args, **kwargs):
        last_event_id = request.headers.get("Last-Event-ID") or request.GET.get("last_event_id")
        response = StreamingHttpResponse(
            sse.stream("admin", last_event_id=last_event_id),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        return response


class PublicStreamView(View):
    def get(self, request, *args, **kwargs):
        last_event_id = request.headers.get("Last-Event-ID") or request.GET.get("last_event_id")
        response = StreamingHttpResponse(
            sse.stream("public", last_event_id=last_event_id),
            content_type="text/event-stream",
        )
        response["Cache-Control"] = "no-cache"
        return response


class HealthCheckView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        health = health_service.get_health_status()
        return Response(health.to_dict())
