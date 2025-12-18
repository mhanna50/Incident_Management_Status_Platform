from .celery import app as celery_app  # noqa
from . import tracing  # noqa: F401

__all__ = ("celery_app",)
