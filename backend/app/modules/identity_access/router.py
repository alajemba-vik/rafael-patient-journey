from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.modules.identity_access import service
from app.modules.identity_access.schemas import LoginRequest, LoginResponse, UserCreate, UserOut
from app.modules.identity_access.service import CurrentUser, get_current_user

router = APIRouter(prefix="/auth", tags=["identity_access"])


@router.post("/login")
def login(body: LoginRequest) -> LoginResponse:
    return LoginResponse(access_token=service.login(body.email, body.password))


@router.get("/me")
def me(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> UserOut:
    return UserOut.model_validate(service.get_user(db, user.id))


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    return service.create_user(db, user, body)


@router.get("/care-staff")
def list_care_staff(
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[UserOut]:
    return service.list_care_staff(db, user)


@router.get("/users")
def list_users(
    user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[UserOut]:
    return service.list_users(db, user)
