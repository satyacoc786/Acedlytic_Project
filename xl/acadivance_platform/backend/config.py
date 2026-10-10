import os
from pydantic import BaseModel

class Settings(BaseModel):
    APP_NAME: str = "Acadivance — Smart Campus Analytics"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "acadivance-super-secret-key-2025-token-auth")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./acadivance.db")
    
    # Default scoring weights (S = 0.35A + 0.20T + 0.15L + 0.20P + 0.10E)
    WEIGHT_ACADEMIC: float = 0.35
    WEIGHT_ATTENDANCE: float = 0.20
    WEIGHT_LMS: float = 0.15
    WEIGHT_PLACEMENT: float = 0.20
    WEIGHT_ENGAGEMENT: float = 0.10
    
    # Risk Thresholds
    ACADEMIC_RISK_CGPA_THRESHOLD: float = 6.0      # Out of 10
    ACADEMIC_RISK_ATTENDANCE_THRESHOLD: float = 75.0 # Percent
    ACADEMIC_RISK_LMS_THRESHOLD: float = 60.0       # Percent
    
    PLACEMENT_RISK_READINESS_THRESHOLD: float = 60.0 # Percent
    PLACEMENT_RISK_SKILL_THRESHOLD: float = 55.0     # Percent

settings = Settings()
