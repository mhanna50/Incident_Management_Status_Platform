from django.urls import path

from incidents import views

urlpatterns = [
    path("", views.api_root, name="api-root"),
    path("api/incidents", views.IncidentListCreateView.as_view(), name="incident-list"),
    path(
        "api/incidents/analytics",
        views.IncidentAnalyticsView.as_view(),
        name="incident-analytics",
    ),
    path("api/metrics", views.AdminMetricsView.as_view(), name="admin-metrics"),
    path(
        "api/incidents/<uuid:incident_id>",
        views.IncidentDetailView.as_view(),
        name="incident-detail",
    ),
    path(
        "api/incidents/<uuid:incident_id>/transition",
        views.IncidentTransitionView.as_view(),
        name="incident-transition",
    ),
    path(
        "api/incidents/<uuid:incident_id>/updates",
        views.IncidentUpdatesView.as_view(),
        name="incident-updates",
    ),
    path(
        "api/incidents/<uuid:incident_id>/postmortem",
        views.PostmortemView.as_view(),
        name="incident-postmortem",
    ),
    path(
        "api/incidents/<uuid:incident_id>/postmortem/publish",
        views.PostmortemPublishView.as_view(),
        name="postmortem-publish",
    ),
    path(
        "api/incidents/<uuid:incident_id>/postmortem/export",
        views.PostmortemExportView.as_view(),
        name="postmortem-export",
    ),
    path(
        "api/incidents/<uuid:incident_id>/postmortem/action-items",
        views.PostmortemActionItemsView.as_view(),
        name="postmortem-action-items",
    ),
    path(
        "api/incidents/<uuid:incident_id>/postmortem/action-items/<uuid:action_item_id>",
        views.PostmortemActionItemDetailView.as_view(),
        name="postmortem-action-item-detail",
    ),
    path("api/subscribers", views.SubscriberCreateView.as_view(), name="subscriber-create"),
    path("api/audit", views.AuditEventListView.as_view(), name="audit-events"),
    path("api/public/status", views.PublicStatusView.as_view(), name="public-status"),
    path(
        "api/public/incidents/<uuid:incident_id>",
        views.PublicIncidentDetailView.as_view(),
        name="public-incident-detail",
    ),
    path(
        "api/public/incidents/<uuid:incident_id>/postmortem",
        views.PublicPostmortemView.as_view(),
        name="public-postmortem",
    ),
    path("api/stream/admin", views.AdminStreamView.as_view(), name="stream-admin"),
    path("api/stream/public", views.PublicStreamView.as_view(), name="stream-public"),
    path("healthz", views.HealthCheckView.as_view(), name="healthz"),
]
