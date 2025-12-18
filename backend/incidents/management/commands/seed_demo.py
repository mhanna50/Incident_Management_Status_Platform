import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from incidents.models import ActionItem, Incident, IncidentUpdate, Postmortem


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
            ),
            self._create_incident(
                title="Checkout button disabled",
                severity=Incident.Severity.SEV2,
                status=Incident.Status.MONITORING,
                is_public=True,
                hours_open=2,
            ),
            self._create_incident(
                title="Internal dashboard outage",
                severity=Incident.Severity.SEV3,
                status=Incident.Status.INVESTIGATING,
                is_public=False,
                hours_open=1,
            ),
        ]

        for incident in incidents:
            self._seed_updates(incident)
            if incident.status == Incident.Status.RESOLVED:
                self._seed_postmortem(incident)

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully."))

    def _create_incident(self, *, title, severity, status, is_public, hours_open) -> Incident:
        now = timezone.now()
        incident = Incident.objects.create(
            title=title,
            summary=f"{title} summary with key impact statements.",
            severity=severity,
            status=status,
            is_public=is_public,
            created_by_name="Demo Bot",
            created_at=now - timedelta(hours=hours_open),
            updated_at=now,
            resolved_at=now if status == Incident.Status.RESOLVED else None,
        )
        return incident

    def _seed_updates(self, incident: Incident):
        authors = ["Alex", "Jordan", "Taylor", "Morgan"]
        messages = [
            "Investigating elevated error rates.",
            "Identified degraded replica. Working on fix.",
            "Mitigated impact and monitoring closely.",
            "Confirming resolution with customers.",
        ]
        for idx, message in enumerate(messages):
            if idx > 0 and incident.status == Incident.Status.INVESTIGATING:
                break
            IncidentUpdate.objects.create(
                incident=incident,
                message=message,
                status_at_time=incident.status,
                created_by_name=random.choice(authors),
            )

    def _seed_postmortem(self, incident: Incident):
        postmortem = Postmortem.objects.create(
            incident=incident,
            summary="Root cause summary for demo seed.",
            impact="Checkout latency impacted 15% of users.",
            root_cause="Misconfigured database failover.",
            detection="Pager triggered by elevated timeouts.",
            resolution="Rolled back migration and tuned connections.",
            lessons_learned="Improve alert thresholds + runbooks.",
            published=True,
            published_at=timezone.now(),
        )
        ActionItem.objects.create(
            postmortem=postmortem,
            title="Add automated DB failover test",
            owner_name="SRE Team",
            due_date=timezone.now().date() + timedelta(days=14),
        )
