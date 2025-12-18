import uuid

from django.db import models


class Incident(models.Model):
    class Severity(models.TextChoices):
        SEV1 = "SEV1", "SEV1"
        SEV2 = "SEV2", "SEV2"
        SEV3 = "SEV3", "SEV3"
        SEV4 = "SEV4", "SEV4"

    class Status(models.TextChoices):
        INVESTIGATING = "INVESTIGATING", "Investigating"
        IDENTIFIED = "IDENTIFIED", "Identified"
        MONITORING = "MONITORING", "Monitoring"
        RESOLVED = "RESOLVED", "Resolved"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    summary = models.TextField()
    severity = models.CharField(max_length=8, choices=Severity.choices)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.INVESTIGATING)
    is_public = models.BooleanField(default=True)
    created_by_name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "severity", "is_public", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.get_status_display()})"


class IncidentUpdate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.ForeignKey(Incident, related_name="updates", on_delete=models.CASCADE)
    message = models.TextField()
    status_at_time = models.CharField(max_length=32, choices=Incident.Status.choices)
    created_by_name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["incident", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.incident.title}: {self.status_at_time}"


class Subscriber(models.Model):
    class Scope(models.TextChoices):
        GLOBAL = "GLOBAL", "Global"
        INCIDENT = "INCIDENT", "Incident"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField()
    scope = models.CharField(max_length=16, choices=Scope.choices, default=Scope.GLOBAL)
    incident = models.ForeignKey(
        Incident,
        related_name="subscribers",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.email} ({self.scope})"


class Postmortem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.OneToOneField(Incident, related_name="postmortem", on_delete=models.CASCADE)
    summary = models.TextField(blank=True)
    impact = models.TextField(blank=True)
    root_cause = models.TextField(blank=True)
    detection = models.TextField(blank=True)
    resolution = models.TextField(blank=True)
    lessons_learned = models.TextField(blank=True)
    published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Postmortem for {self.incident.title}"


class ActionItem(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        DONE = "DONE", "Done"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    postmortem = models.ForeignKey(
        Postmortem, related_name="action_items", on_delete=models.CASCADE
    )
    title = models.CharField(max_length=255)
    owner_name = models.CharField(max_length=255)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)

    def __str__(self) -> str:
        return f"{self.title} ({self.get_status_display()})"


class AuditEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor_name = models.CharField(max_length=255)
    action = models.CharField(max_length=255)
    incident = models.ForeignKey(
        Incident, related_name="audit_events", on_delete=models.SET_NULL, null=True, blank=True
    )
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.action} by {self.actor_name}"


class EmailDelivery(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SENT = "SENT", "Sent"
        FAILED = "FAILED", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.ForeignKey(
        Incident, related_name="email_deliveries", on_delete=models.SET_NULL, null=True, blank=True
    )
    subscriber_email = models.EmailField()
    subject = models.CharField(max_length=255)
    body = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveIntegerField(default=0)
    last_error = models.TextField(blank=True, default="")
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["subscriber_email"]),
        ]

    def __str__(self) -> str:
        return f"EmailDelivery to {self.subscriber_email} ({self.status})"


class IdempotencyKey(models.Model):
    key = models.CharField(max_length=128, unique=True)
    method = models.CharField(max_length=10)
    path = models.CharField(max_length=255)
    status_code = models.IntegerField()
    response_body = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["method", "path"]),
        ]

    def __str__(self) -> str:
        return f"{self.method} {self.path} ({self.key})"
