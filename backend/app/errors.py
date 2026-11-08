"""Errors that services raise.

`main.py` turns them into HTTP responses, so services never import FastAPI.
"""


class AppError(Exception):
    status_code = 400

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(AppError):
    status_code = 404


class ForbiddenError(AppError):
    status_code = 403


class UnauthorizedError(AppError):
    status_code = 401


class ConflictError(AppError):
    status_code = 409


class TooManyRequestsError(AppError):
    status_code = 429


class ServiceUnavailableError(AppError):
    """A service we depend on (the identity provider) failed or can't be reached."""

    status_code = 503
