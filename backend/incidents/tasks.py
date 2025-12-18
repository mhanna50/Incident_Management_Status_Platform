from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from incidents.models import EmailDelivery


@shared_task(bind=True, max_retries=5)
def send_email_delivery(self, delivery_id: str):
    try:
        delivery = EmailDelivery.objects.get(id=delivery_id)
    except EmailDelivery.DoesNotExist:
        return

    delivery.attempts += 1
    delivery.last_attempt_at = timezone.now()
    delivery.save(update_fields=["attempts", "last_attempt_at"])

    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "status@example.com")

    try:
        send_mail(
            subject=delivery.subject,
            message=delivery.body,
            from_email=from_email,
            recipient_list=[delivery.subscriber_email],
            fail_silently=False,
        )
        delivery.status = EmailDelivery.Status.SENT
        delivery.sent_at = timezone.now()
        delivery.last_error = ""
        delivery.save(update_fields=["status", "sent_at", "last_error"])
    except Exception as exc:  # pragma: no cover - relies on email backend
        delivery.last_error = str(exc)
        delivery.save(update_fields=["last_error"])
        if delivery.attempts >= self.max_retries:
            delivery.status = EmailDelivery.Status.FAILED
            delivery.save(update_fields=["status"])
            return
        backoff = min(60 * (2 ** (delivery.attempts - 1)), 900)
        raise self.retry(exc=exc, countdown=backoff)
