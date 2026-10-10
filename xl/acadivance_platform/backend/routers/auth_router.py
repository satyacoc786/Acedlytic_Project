from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User, Student
from backend.schemas import LoginRequest, TokenResponse, UserOut
from backend.auth import verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    # 1. Check if it's a staff User
    user = db.query(User).filter(
        (User.username == creds.username_or_id) | (User.email == creds.username_or_id)
    ).first()

    if user:
        if not verify_password(creds.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )
        token = create_access_token({
            "sub": user.username,
            "role": user.role,
            "name": user.full_name,
            "id": user.id
        })
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "name": user.full_name,
                "role": user.role
            }
        }

    # 2. Check if it's a student login
    student = db.query(Student).filter(Student.id == creds.username_or_id).first()
    if student:
        # For student demo login, accepts password of length >= 6
        if len(creds.password) < 6:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Password must be at least 6 characters"
            )
        token = create_access_token({
            "sub": student.id,
            "role": "student",
            "name": student.name,
            "id": student.id
        })
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": student.id,
                "username": student.id,
                "email": student.email,
                "name": student.name,
                "role": "student"
            }
        }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials. User not found."
    )

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "name": current_user.full_name,
        "role": current_user.role
    }

@router.post("/logout")
def logout():
    return {"message": "Logged out successfully"}
