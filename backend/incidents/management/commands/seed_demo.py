import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from incidents.models import ActionItem, AuditEvent, Incident, IncidentUpdate, Postmortem


class Command(BaseCommand):
    help = "Seed demo data for the incident management platform."

    def handle(self, *args, **options):
        self.stdout.write("Clearing existing incidents…")
        AuditEvent.objects.all().delete()
        ActionItem.objects.all().delete()
        Postmortem.objects.all().delete()
        IncidentUpdate.objects.all().delete()
        Incident.objects.all().delete()

        scenarios = [
            {
                "title": "Global API outage impacting all regions",
                "summary": "Requests to /v1 time out in every region; customers see elevated 500s.",
                "severity": Incident.Severity.SEV1,
                "status": Incident.Status.RESOLVED,
                "is_public": True,
                "hours_open": 5,
                "created_by_name": "Jordan Patel",
                "timeline": [
                    (Incident.Status.INVESTIGATING, "Pager triggered for elevated 500s across all app servers."),
                    (Incident.Status.IDENTIFIED, "Primary database failover stuck; routing read traffic to standby."),
                    (Incident.Status.MONITORING, "Mitigation deployed by shifting traffic to healthy nodes."),
                    (Incident.Status.RESOLVED, "Services stable for 30 minutes. Communicating final update."),
                ],
                "with_postmortem": True,
                "postmortem": {
                    "impact": "All customers could not create or update resources for ~45 minutes.",
                    "root_cause": "Automated DB failover left primary replicas in read-only mode.",
                    "lessons_learned": "Add chaos test for failover workflows and audit runbooks quarterly.",
                },
            },
            {
                "title": "Checkout latency in EU stores",
                "summary": "Customers in Frankfurt & London experience a slow checkout button.",
                "severity": Incident.Severity.SEV2,
                "status": Incident.Status.MONITORING,
                "is_public": True,
                "hours_open": 2,
                "created_by_name": "Morgan Lee",
                "timeline": [
                    (Incident.Status.INVESTIGATING, "Investigating reports of a disabled checkout button in EU stores."),
                    (Incident.Status.IDENTIFIED, "Feature flag conflict in the EU region triggered throttling."),
                    (Incident.Status.MONITORING, "Flag rolled back and caches cleared. Watching metrics."),
                ],
            },
            {
                "title": "Internal billing job backlog",
                "summary": "Nightly ledger sync is 3 hours behind, limited to finance/internal stakeholders.",
                "severity": Incident.Severity.SEV3,
                "status": Incident.Status.INVESTIGATING,
                "is_public": False,
                "hours_open": 4,
                "created_by_name": "Taylor Kim",
                "timeline": [
                    (Incident.Status.INVESTIGATING, "Finance noticed unpaid invoices not updating."),
                    (Incident.Status.IDENTIFIED, "Scheduler misfire blocked cron jobs; restarting services."),
                ],
            },
            {
                "title": "Webhook signature mismatch",
                "summary": "Customers see signature verification failures for webhook payloads.",
                "severity": Incident.Severity.SEV2,
                "status": Incident.Status.IDENTIFIED,
                "is_public": True,
                "hours_open": 3,
                "created_by_name": "Jamie Owens",
                "timeline": [
                    (Incident.Status.INVESTIGATING, "Investigating spike in webhook retries."),
                    (Incident.Status.IDENTIFIED, "HMAC library upgraded without rotating customer secrets."),
                ],
            },
            {
                "title": "UX polish release communications",
                "summary": "Minor UI flicker during feature rollout; informational public notice.",
                "severity": Incident.Severity.SEV4,
                "status": Incident.Status.MONITORING,
                "is_public": True,
                "hours_open": 1,
                "created_by_name": "Riley Chen",
                "timeline": [
                    (Incident.Status.MONITORING, "Deploying a UI patch with a note for customers."),
                ],
            },
            {
                "title": "Edge cache invalidation delays",
                "summary": "Content updates take up to 20 minutes to appear globally.",
                "severity": Incident.Severity.SEV1,
                "status": Incident.Status.RESOLVED,
                "is_public": True,
                "hours_open": 6,
                "created_by_name": "Alex Rivera",
                "timeline": [
                    (Incident.Status.INVESTIGATING, "Investigating stale content reports after CDN change."),
                    (Incident.Status.IDENTIFIED, "Background worker queue exhausted cache invalidations."),
                    (Incident.Status.MONITORING, "Queue workers doubled to drain backlog."),
                    (Incident.Status.RESOLVED, "All regions serving fresh content."),
                ],
                "with_postmortem": False,
            },
        ]

        incidents = []
        for scenario in scenarios:
            incident = self._create_incident(
                title=scenario["title"],
                summary=scenario["summary"],
                severity=scenario["severity"],
                status=scenario["status"],
                is_public=scenario["is_public"],
                hours_open=scenario["hours_open"],
                created_by_name=scenario["created_by_name"],
            )
            self._seed_updates(incident, scenario.get("timeline"))
            with_postmortem = scenario.get("with_postmortem", incident.status == Incident.Status.RESOLVED)
            if with_postmortem:
                self._seed_postmortem(incident, scenario.get("postmortem"))
            incidents.append(incident)

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully."))

    def _create_incident(self, *, title, summary, severity, status, is_public, hours_open, created_by_name) -> Incident:
        now = timezone.now()
        created_at = now - timedelta(hours=hours_open)
        resolved_at = created_at + timedelta(hours=hours_open) if status == Incident.Status.RESOLVED else None
        updated_at = resolved_at or now

        incident = Incident.objects.create(
            title=title,
            summary=summary,
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

    def _seed_updates(self, incident: Incident, custom_timeline=None):
        authors = ["Alex", "Jordan", "Taylor", "Morgan"]
        timeline = custom_timeline or [
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

    def _seed_postmortem(self, incident: Incident, overrides=None):
        published_at = (incident.resolved_at or incident.updated_at) + timedelta(minutes=45)
        defaults = {
            "summary": "Root cause summary for demo seed.",
            "impact": "Checkout latency impacted 15% of users.",
            "root_cause": "Misconfigured database failover.",
            "detection": "Pager triggered by elevated timeouts.",
            "resolution": "Rolled back migration and tuned connections.",
            "lessons_learned": "Improve alert thresholds + runbooks.",
        }
        if overrides:
            defaults.update(overrides)
        postmortem = Postmortem.objects.create(
            incident=incident,
            summary=defaults["summary"],
            impact=defaults["impact"],
            root_cause=defaults["root_cause"],
            detection=defaults["detection"],
            resolution=defaults["resolution"],
            lessons_learned=defaults["lessons_learned"],
            published=True,
            published_at=published_at,
        )
        ActionItem.objects.create(
            postmortem=postmortem,
            title="Add automated DB failover test",
            owner_name="SRE Team",
            due_date=published_at.date() + timedelta(days=14),
        )
