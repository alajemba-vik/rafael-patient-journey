"""Logging, request ids and the last-resort error handler.

Every log line carries the id of the request that produced it, and every response returns
that id in `X-Request-ID`, so a user's "it failed at 10:42" can be matched to the logs.

Logs never contain patient data: requests are logged by route template
(`/api/v1/patients/{patient_id}`), never with their query string or body.
"""

import logging
import re
import time
import uuid
from contextvars import ContextVar

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

REQUEST_ID_HEADER = "X-Request-ID"
# An id from a proxy or the frontend is kept only if it looks like one: it ends up in logs.
_VALID_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")

_request_id: ContextVar[str] = ContextVar("request_id", default="-")
logger = logging.getLogger("app.requests")


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _request_id.get()
        return True


def configure_logging(level: str) -> None:
    """One format for the whole app, set once at startup."""
    handler = logging.StreamHandler()
    handler.addFilter(_RequestIdFilter())
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s")
    )
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())
    # Uvicorn's access log prints full URLs, query strings included (a patient search is a
    # name): ours replaces it with route templates.
    logging.getLogger("uvicorn.access").disabled = True
    # One line per call to the identity provider is noise at INFO.
    logging.getLogger("httpx").setLevel(logging.WARNING)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Gives each request an id, logs its outcome and turns unexpected errors into a 500.

    Registered inside the CORS middleware, so even a 500 carries CORS headers and the
    browser shows the error instead of a misleading CORS failure.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        incoming = request.headers.get(REQUEST_ID_HEADER, "")
        request_id = incoming if _VALID_REQUEST_ID.fullmatch(incoming) else uuid.uuid4().hex
        token = _request_id.set(request_id)
        started = time.perf_counter()
        try:
            try:
                response = await call_next(request)
            except Exception:
                logger.exception("Unhandled error on %s %s", request.method, _route(request))
                response = JSONResponse(
                    status_code=500,
                    content={
                        "detail": "Something went wrong on our side.",
                        "request_id": request_id,
                    },
                )
            response.headers[REQUEST_ID_HEADER] = request_id
            _log_outcome(request, response.status_code, time.perf_counter() - started)
            return response
        finally:
            _request_id.reset(token)


def install(app: FastAPI) -> None:
    app.add_middleware(RequestContextMiddleware)


def _route(request: Request) -> str:
    """The path with its ids put back as names (`/patients/{patient_id}`), so patient and
    appointment ids aren't logged. Never the query string."""
    path = request.url.path
    for name, value in request.path_params.items():
        path = path.replace(str(value), "{" + name + "}")
    return path


def _log_outcome(request: Request, status: int, elapsed_seconds: float) -> None:
    level = logging.ERROR if status >= 500 else logging.INFO
    logger.log(
        level, "%s %s %s %.0fms", request.method, _route(request), status, elapsed_seconds * 1000
    )
