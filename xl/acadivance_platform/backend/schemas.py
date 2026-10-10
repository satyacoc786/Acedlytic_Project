from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime

# ================= AUTH SCHEMAS =================
class LoginRequest(BaseModel):
    username_or_id: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str
    full_name: str
    role: str

# ================= SCORING & EXPLAINABILITY SCHEMAS =================
class ComponentScoreDetail(BaseModel):
    raw_value: Optional[float]
    normalized_score: float # 0 to 100
    weight: float
    weighted_contribution: float
    is_missing: bool = False
    description: str

class ScoreExplanation(BaseModel):
    overall_score: float # 0-100
    band: str # "On Track", "Needs Attention", "At Risk"
    data_completeness_percent: float
    components: Dict[str, ComponentScoreDetail]
    positive_factors: List[str]
    negative_factors: List[str]
    missing_data_notes: List[str]
    recommended_actions: List[str]

# ================= RISK SCHEMAS =================
class RiskIndicator(BaseModel):
    rule_name: str
    category: str # "academic" or "placement"
    severity: str # "High", "Moderate", "Low"
    metric_name: str
    actual_value: str
    threshold: str
    reason: str
    recommended_action: str

class StudentRiskAnalysis(BaseModel):
    academic_risk: bool
    academic_severity: str # "None", "Low", "Moderate", "High"
    academic_indicators: List[RiskIndicator]
    
    placement_risk: bool
    placement_severity: str # "None", "Low", "Moderate", "High"
    placement_indicators: List[RiskIndicator]
    
    risk_summary_badge: str # "Academic & Placement", "Academic Risk", "Placement Risk", "None"

# ================= STUDENT SCHEMAS =================
class StudentListItem(BaseModel):
    id: str
    name: str
    email: str
    department: str
    semester: int
    academic_year: str
    cgpa: float
    attendance_pct: float
    success_score: float
    academic_risk: bool
    placement_risk: bool
    risk_flags: List[str]
    last_activity: str

class StudentDetailOut(BaseModel):
    id: str
    name: str
    email: str
    department: str
    semester: int
    academic_year: str
    phone: Optional[str]
    avatar: str
    status: str
    
    # Raw components
    academic: Optional[Dict[str, Any]]
    attendance: Optional[Dict[str, Any]]
    lms: Optional[Dict[str, Any]]
    placement: Optional[Dict[str, Any]]
    engagement: Optional[Dict[str, Any]]
    
    # Computed & Explainable Analytics
    score_analysis: ScoreExplanation
    risk_analysis: StudentRiskAnalysis
    
    # Active interventions
    interventions: List[Dict[str, Any]]

# ================= INTERVENTION SCHEMAS =================
class InterventionCreate(BaseModel):
    student_id: str
    title: str
    category: str = "academic" # academic, placement, attendance, general
    issue: str
    action_plan: str
    priority: str = "Medium" # Low, Medium, High, Urgent
    assigned_to_name: str = "Staff Member"
    due_date: str = "May 25, 2025"
    follow_up_date: Optional[str] = None
    notes: Optional[str] = ""

class InterventionUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    issue: Optional[str] = None
    action_plan: Optional[str] = None
    priority: Optional[str] = None
    assigned_to_name: Optional[str] = None
    due_date: Optional[str] = None
    follow_up_date: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class InterventionStatusUpdate(BaseModel):
    status: str # Open, Scheduled, In Progress, Completed, Cancelled
    notes: Optional[str] = None

class InterventionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: str
    student_name: Optional[str] = None
    student_dept: Optional[str] = None
    title: str
    category: str
    issue: str
    action_plan: str
    assigned_to_name: str
    priority: str
    status: str
    created_at: datetime
    due_date: str
    follow_up_date: Optional[str]
    notes: Optional[str]
    completed_at: Optional[datetime]

# ================= SETTINGS SCHEMAS =================
class ScoringWeightsConfig(BaseModel):
    weight_academic: float = 0.35
    weight_attendance: float = 0.20
    weight_lms: float = 0.15
    weight_placement: float = 0.20
    weight_engagement: float = 0.10
    
    academic_risk_cgpa: float = 6.0
    academic_risk_attendance: float = 75.0
    academic_risk_lms: float = 60.0
    
    placement_risk_readiness: float = 60.0
    placement_risk_skill: float = 55.0
