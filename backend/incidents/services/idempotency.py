from __future__ import annotations

import json
from functools import wraps

from django.core.serializers.json import DjangoJSONEncoder
from django.db import IntegrityError
from rest_framework.response import Response

from incidents.models import IdempotencyKey

SAFE_METHODS = {"POST", "PATCH"}


def idempotent_endpoint(view_func):
    @wraps(view_func)
    def wrapper(self, request, *args, **kwargs):
        key = request.headers.get("Idempotency-Key")
        method = request.method.upper()
        path = request.get_full_path()

        if not key or method not in SAFE_METHODS:
            return view_func(self, request, *args, **kwargs)

        try:
            existing = IdempotencyKey.objects.get(key=key, method=method, path=path)
            return Response(existing.response_body, status=existing.status_code)
        except IdempotencyKey.DoesNotExist:
            pass

        response = view_func(self, request, *args, **kwargs)

        if isinstance(response, Response):
            try:
                serialized = json.loads(json.dumps(response.data, cls=DjangoJSONEncoder))
                IdempotencyKey.objects.create(
                    key=key,
                    method=method,
                    path=path,
                    status_code=response.status_code,
                    response_body=serialized,
                )
            except IntegrityError:
                # Another request stored the response before we could
                existing = IdempotencyKey.objects.get(key=key, method=method, path=path)
                return Response(existing.response_body, status=existing.status_code)

        return response

    return wrapper
