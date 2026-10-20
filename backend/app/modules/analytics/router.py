from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.modules.analytics import service
from app.modules.analytics.schemas import Dashboard
from app.modules.identity_access.service import CurrentUser, get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard")
def get_dashboard(
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
) -> Dashboard:
    return service.get_dashboard(db, user)
