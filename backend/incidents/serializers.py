from rest_framework import serializers

from .models import (
    ActionItem,
    AuditEvent,
    Incident,
    IncidentUpdate,
    Postmortem,
    Subscriber,
)


class IncidentUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncidentUpdate
        fields = [
            "id",
            "incident",
            "message",
            "status_at_time",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class IncidentSerializer(serializers.ModelSerializer):
    latest_update = serializers.SerializerMethodField()
    active = serializers.SerializerMethodField()

    class Meta:
        model = Incident
        fields = [
            "id",
            "title",
            "summary",
            "severity",
            "status",
            "is_public",
            "created_by_name",
            "created_at",
            "updated_at",
            "resolved_at",
            "latest_update",
            "active",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "resolved_at", "latest_update", "active"]

    def get_latest_update(self, obj):
        latest = obj.updates.order_by("-created_at").first()
        if not latest:
            return None
        return IncidentUpdateSerializer(latest).data

    def get_active(self, obj):
        return obj.status != Incident.Status.RESOLVED


class SubscriberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscriber
        fields = ["id", "email", "scope", "incident", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        scope = attrs.get("scope")
        incident = attrs.get("incident")
        if scope == Subscriber.Scope.INCIDENT and not incident:
            raise serializers.ValidationError(
                {"incident": "An incident must be provided for INCIDENT scoped subscribers."}
            )
        return attrs


class ActionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActionItem
        fields = ["id", "postmortem", "title", "owner_name", "due_date", "status"]
        read_only_fields = ["id"]


class PostmortemSerializer(serializers.ModelSerializer):
    action_items = ActionItemSerializer(many=True, read_only=True)

    class Meta:
        model = Postmortem
        fields = [
            "id",
            "incident",
            "summary",
            "impact",
            "root_cause",
            "detection",
            "resolution",
            "lessons_learned",
            "published",
            "published_at",
            "created_at",
            "updated_at",
            "action_items",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "action_items", "published_at"]


class AuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = ["id", "actor_name", "action", "incident", "metadata", "created_at"]
        read_only_fields = ["id", "created_at"]
