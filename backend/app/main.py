from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.errors import AppError
from app.modules.analytics.router import router as analytics_router
from app.modules.care_team.router import router as care_team_router
from app.modules.faq.router import router as faq_router
from app.modules.identity_access.router import router as identity_access_router
from app.modules.notifications.router import router as notifications_router
from app.modules.pathways.router import router as pathways_router
from app.modules.patients.router import router as patients_router
from app.modules.questionnaires.router import router as questionnaires_router
from app.modules.reception.router import router as reception_router
from app.modules.scheduling.router import router as scheduling_router

app = FastAPI(title="Institut Rafaël – Patient Journey API", version="0.1.0")

# The frontend sends a bearer token header, not cookies, so credentials stay off.
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(AppError)
def handle_app_error(_: Request, error: AppError) -> JSONResponse:
    return JSONResponse(status_code=error.status_code, content={"detail": error.message})


@app.get("/api/v1/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


# Every module's router is already registered: add endpoints in your module's router.py,
# no need to edit this file.
for router in (
    analytics_router,
    care_team_router,
    faq_router,
    identity_access_router,
    notifications_router,
    pathways_router,
    patients_router,
    questionnaires_router,
    reception_router,
    scheduling_router,
):
    app.include_router(router, prefix="/api/v1")
