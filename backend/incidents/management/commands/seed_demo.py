import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from incidents.models import ActionItem, AuditEvent, Incident, IncidentUpdate, Postmortem


class Command(BaseCommand):
    help = "Seed demo data for the incident management platform."

    def handle(self, *args, **options):
        self.stdout.write("Clearing existing incidents…")
        ActionItem.objects.all().delete()
        Postmortem.objects.all().delete()
        IncidentUpdate.objects.all().delete()
        Incident.objects.all().delete()

        incidents = [
            self._create_incident(
                title="Payments latency spike",
                severity=Incident.Severity.SEV1,
                status=Incident.Status.RESOLVED,
                is_public=True,
                hours_open=6,
                created_by_name="Jordan Patel",
            ),
            self._create_incident(
                title="Checkout button disabled",
                severity=Incident.Severity.SEV2,
                status=Incident.Status.MONITORING,
                is_public=True,
                hours_open=2,
                created_by_name="Morgan Lee",
            ),
            self._create_incident(
                title="Internal dashboard outage",
                severity=Incident.Severity.SEV3,
                status=Incident.Status.INVESTIGATING,
                is_public=False,
                hours_open=1,
                created_by_name="Taylor Kim",
            ),
            self._create_incident(
                title="Webhook delivery delays",
                severity=Incident.Severity.SEV3,
                status=Incident.Status.IDENTIFIED,
                is_public=True,
                hours_open=3,
                created_by_name="Jamie Owens",
            ),
            self._create_incident(
                title="Mobile push degraded",
                severity=Incident.Severity.SEV4,
                status=Incident.Status.MONITORING,
                is_public=True,
                hours_open=5,
                created_by_name="Riley Chen",
            ),
            self._create_incident(
                title="API gateway timeout errors",
                severity=Incident.Severity.SEV1,
                status=Incident.Status.INVESTIGATING,
                is_public=True,
                hours_open=4,
                created_by_name="Alex Rivera",
            ),
        ]

        for incident in incidents:
            self._seed_updates(incident)
            if incident.status == Incident.Status.RESOLVED:
                self._seed_postmortem(incident)

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully."))

    def _create_incident(self, *, title, severity, status, is_public, hours_open, created_by_name) -> Incident:
        now = timezone.now()
        created_at = now - timedelta(hours=hours_open)
        resolved_at = created_at + timedelta(hours=hours_open) if status == Incident.Status.RESOLVED else None
        updated_at = resolved_at or now

        incident = Incident.objects.create(
            title=title,
            summary=f"{title} summary with key impact statements.",
            severity=severity,
            status=status,
            is_public=is_public,
            created_by_name=created_by_name,
        )
        Incident.objects.filter(pk=incident.pk).update(
            created_at=created_at,
            updated_at=updated_at,
            resolved_at=resolved_at,
        )
        incident.refresh_from_db()
        AuditEvent.objects.create(
            actor_name=created_by_name,
            action="INCIDENT_CREATED",
            incident=incident,
            metadata={
                "seeded": True,
                "severity": incident.severity,
                "status": incident.status,
            },
        )
        return incident

    def _seed_updates(self, incident: Incident):
        authors = ["Alex", "Jordan", "Taylor", "Morgan"]
        timeline = [
            (Incident.Status.INVESTIGATING, "Investigating elevated error rates."),
            (Incident.Status.IDENTIFIED, "Identified a degraded replica and isolating impact."),
            (Incident.Status.MONITORING, "Mitigation applied, monitoring closely."),
            (Incident.Status.RESOLVED, "Confirming resolution with customers."),
        ]
        steps = []
        for status, message in timeline:
            steps.append((status, message))
            if status == incident.status:
                break

        start = incident.created_at
        end = incident.resolved_at or incident.updated_at
        if end <= start:
            end = start + timedelta(minutes=30)
        spacing = (end - start) / (len(steps) + 1)

        for idx, (status, message) in enumerate(steps):
            timestamp = start + spacing * (idx + 1)
            update = IncidentUpdate.objects.create(
                incident=incident,
                message=message,
                status_at_time=status,
                created_by_name=random.choice(authors),
            )
            IncidentUpdate.objects.filter(pk=update.pk).update(created_at=timestamp)

    def _seed_postmortem(self, incident: Incident):
        published_at = (incident.resolved_at or incident.updated_at) + timedelta(minutes=45)
        postmortem = Postmortem.objects.create(
            incident=incident,
            summary="Root cause summary for demo seed.",
            impact="Checkout latency impacted 15% of users.",
            root_cause="Misconfigured database failover.",
            detection="Pager triggered by elevated timeouts.",
            resolution="Rolled back migration and tuned connections.",
            lessons_learned="Improve alert thresholds + runbooks.",
            published=True,
            published_at=published_at,
        )
        ActionItem.objects.create(
            postmortem=postmortem,
            title="Add automated DB failover test",
            owner_name="SRE Team",
            due_date=published_at.date() + timedelta(days=14),
        )
