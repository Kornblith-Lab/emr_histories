import csv
import os
import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from collections import defaultdict
from sqlitedict import SqliteDict
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("data", exist_ok=True)
DB_PATH = "data/reviews.db"
ASSIGNMENTS_KEY_PREFIX = "assignment::"

REVIEWERS = ["Reviewer A", "Reviewer B"]


class ReviewSubmission(BaseModel):
    reviewer: str
    patient_id: str
    q1: int
    q2: int
    q3: int
    q4: int
    q5: int
    q6: int
    q7: int
    q8: int
    q9: int
    q10: int
    q11: int
    q12: int
    q13: int
    q14: int
    has_errors: bool
    error_count: Optional[str] = None
    error_severity: Optional[str] = None
    error_changes_understanding: Optional[bool] = None
    error_description: Optional[str] = None
    additional_comments: Optional[str] = None


class AssignmentUpdate(BaseModel):
    patient_id: str
    reviewer: str


@app.get("/api/health")
def check_health():
    return {"status": "healthy"}


def load_patients_from_csv():
    csv_filename = "deid_transfers_for_shree.csv"
    if not os.path.exists(csv_filename):
        return None, f"File not found. Directory: {os.listdir('.')}"

    patient_rows = defaultdict(list)
    with open(csv_filename, mode="r", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        for row in reader:
            if row.get("PatientDurableKey"):
                patient_rows[row["PatientDurableKey"]].append(row)

    patients = []
    for patient_key, rows in patient_rows.items():
        first = rows[0]

        encounter_groups = defaultdict(list)
        for row in rows:
            encounter_groups[row.get("EncounterKey", "")].append(row)

        encounters = []
        for enc_key, enc_rows in encounter_groups.items():
            first_enc_row = enc_rows[0]

            note_lines = [r.get("note_text", "") for r in enc_rows if r.get("note_text")]
            joined_notes = "\n\n".join(note_lines)

            seen_summaries = []
            for r in enc_rows:
                s = r.get("summary", "")
                if s and s not in seen_summaries:
                    seen_summaries.append(s)
            joined_summary = "\n\n".join(seen_summaries)

            encounters.append({
                "EncounterKey": enc_key,
                "AdmissionDecisionInstant": first_enc_row.get("AdmissionDecisionInstant", ""),
                "ArrivalInstant": first_enc_row.get("ArrivalInstant", ""),
                "DepartureInstant": first_enc_row.get("DepartureInstant", ""),
                "PrimaryEdDiagnosisName": first_enc_row.get("PrimaryEdDiagnosisName", ""),
                "SurgicalProcedures": first_enc_row.get("SurgicalProcedures", ""),
                "BP": first_enc_row.get("BP", ""),
                "Pulse": first_enc_row.get("Pulse", ""),
                "Resp": first_enc_row.get("Resp", ""),
                "SpO2": first_enc_row.get("SpO2", ""),
                "Temp": first_enc_row.get("Temp", ""),
                "summary": joined_summary,
                "note_text": joined_notes,
                "had_psych_event": first_enc_row.get("had_psych_event", ""),
                "recieved_transfusion": first_enc_row.get("recieved_transfusion", ""),
                "LengthOfStayInDays": first_enc_row.get("LengthOfStayInDays", ""),
                "IcuLengthOfStay": first_enc_row.get("IcuLengthOfStay", ""),
                "VentilatorDays": first_enc_row.get("VentilatorDays", ""),
                "MedicationAdministrations": first_enc_row.get("MedicationAdministrations", ""),
                "EdDisposition": first_enc_row.get("EdDisposition", ""),
            })

        patients.append({
            "PatientDurableKey": patient_key,
            "Age": first.get("Age", ""),
            "Sex": first.get("Sex", ""),
            "Ethnicity": first.get("Ethnicity", ""),
            "PrimaryChiefComplaintName": first.get("PrimaryChiefComplaintName", ""),
            "PrimaryEdDiagnosisName": first.get("PrimaryEdDiagnosisName", ""),
            "PrimaryInpatientDiagnosisName": first.get("PrimaryInpatientDiagnosisName", ""),
            "LengthOfStayInDays": first.get("LengthOfStayInDays", ""),
            "IcuLengthOfStay": first.get("IcuLengthOfStay", ""),
            "VentilatorDays": first.get("VentilatorDays", ""),
            "ProblemList": first.get("ProblemList", ""),
            "AcquiredDuringAdmission": first.get("AcquiredDuringAdmission", ""),
            "MedicationAdministrations": first.get("MedicationAdministrations", ""),
            "EdDisposition": first.get("EdDisposition", ""),
            "had_psych_event": any(r.get("had_psych_event") == "True" for r in rows),
            "recieved_transfusion": any(r.get("recieved_transfusion") == "True" for r in rows),
            "encounters": encounters,
        })

    return patients, None


@app.get("/api/patients")
def get_all_patients():
    patients, error = load_patients_from_csv()
    if error:
        return {"status": "error", "message": error}
    try:
        return {"status": "success", "data": patients}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/assignments")
def get_assignments():
    try:
        patients, error = load_patients_from_csv()
        if error:
            return {"status": "error", "message": error}

        assignments = {}
        with SqliteDict(DB_PATH) as db:
            overrides = {
                key[len(ASSIGNMENTS_KEY_PREFIX):]: value
                for key, value in db.items()
                if key.startswith(ASSIGNMENTS_KEY_PREFIX)
            }

        for i, p in enumerate(patients):
            pid = p["PatientDurableKey"]
            if pid in overrides:
                assignments[pid] = overrides[pid]
            else:
                assignments[pid] = REVIEWERS[i % len(REVIEWERS)]

        return {"status": "success", "data": assignments}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/api/assignments")
def update_assignment(update: AssignmentUpdate):
    try:
        with SqliteDict(DB_PATH, autocommit=True) as db:
            db[f"{ASSIGNMENTS_KEY_PREFIX}{update.patient_id}"] = update.reviewer
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/api/review")
def submit_review(submission: ReviewSubmission):
    try:
        with SqliteDict(DB_PATH, autocommit=True) as db:
            key = f"{submission.reviewer}::{submission.patient_id}"
            existing = db.get(key)
            submitted_at = existing.get("submitted_at") if existing and existing.get("submitted_at") else datetime.datetime.utcnow().isoformat()

            db[key] = {
                **submission.dict(),
                "submitted_at": submitted_at,
                "updated_at": datetime.datetime.utcnow().isoformat(),
            }
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/reviews/{reviewer}")
def get_reviews_for_reviewer(reviewer: str):
    try:
        with SqliteDict(DB_PATH) as db:
            results = {}
            for key, value in db.items():
                if key.startswith(f"{reviewer}::"):
                    results[value["patient_id"]] = value
        return {"status": "success", "data": results}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/reviews_all")
def get_all_reviews():
    try:
        with SqliteDict(DB_PATH) as db:
            results = []
            for key, value in db.items():
                if not key.startswith(ASSIGNMENTS_KEY_PREFIX):
                    results.append(value)
        return {"status": "success", "data": results}
    except Exception as e:
        return {"status": "error", "message": str(e)}