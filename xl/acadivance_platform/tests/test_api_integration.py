import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_login_flow_and_kpis():
    # 1. Login with demo admin
    res = client.post("/api/auth/login", json={"username_or_id": "admin", "password": "admin123"})
    assert res.status_code == 200
    body = res.json()
    assert "access_token" in body
    assert body["user"]["role"] == "admin"
    token = body["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get Dashboard Summary
    dash_res = client.get("/api/dashboard/summary", headers=headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["total_students"] > 100
    assert dash_data["avg_success_score"] > 0
    assert dash_data["at_risk_count"] > 0
    assert len(dash_data["needing_review"]) > 0

    # 3. List Students
    stud_res = client.get("/api/students?page=1&page_size=10", headers=headers)
    assert stud_res.status_code == 200
    stud_data = stud_res.json()
    assert len(stud_data["items"]) == 10

    # 4. Student Detail (CS2021001 Aarav Sharma)
    detail_res = client.get("/api/students/CS2021001", headers=headers)
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert detail_data["name"] == "Aarav Sharma"
    assert "score_analysis" in detail_data
    assert "risk_analysis" in detail_data

def test_intervention_crud():
    # Login
    res = client.post("/api/auth/login", json={"username_or_id": "admin", "password": "admin123"})
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create intervention
    payload = {
        "student_id": "CS2021001",
        "title": "Comprehensive Mock Test Mentoring",
        "category": "placement",
        "issue": "Coding Skill Deficit",
        "action_plan": "Bi-weekly coding practice sessions with senior student advisor.",
        "priority": "High",
        "due_date": "May 30, 2025"
    }
    create_res = client.post("/api/interventions", json=payload, headers=headers)
    assert create_res.status_code == 201
    it_data = create_res.json()
    it_id = it_data["id"]
    assert it_data["status"] == "Open"

    # Update status to In Progress
    patch_res = client.patch(
        f"/api/interventions/{it_id}/status",
        json={"status": "In Progress", "notes": "Mentor assigned."},
        headers=headers
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "In Progress"

def test_csv_validation():
    res = client.post("/api/auth/login", json={"username_or_id": "admin", "password": "admin123"})
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Valid template download
    tpl_res = client.get("/api/integration/template/students", headers=headers)
    assert tpl_res.status_code == 200
    assert "id,name,email,department" in tpl_res.text
