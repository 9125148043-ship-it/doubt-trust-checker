import json
import sqlite3
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from schemas import CheckDoubtRequest, CheckDoubtResponse
from pipeline import run_pipeline

DB_PATH = Path(__file__).parent / "runs.db"

app = FastAPI(title="Doubt Trust Checker API")

@app.get("/")
async def root():
    return {"status": "ok", "service": "VerifiEd backend"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Loosen this to your deployed frontend's exact origin before the real demo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at REAL,
            doubt TEXT,
            doubt_type TEXT,
            answer TEXT,
            eval1_score INTEGER,
            eval1_issues TEXT,
            eval1_verdict TEXT,
            refined_answer TEXT,
            changes_made TEXT,
            eval2_score INTEGER,
            eval2_issues TEXT,
            eval2_verdict TEXT,
            trust_score INTEGER,
            trust_label TEXT,
            suggested_action TEXT,
            total_input_tokens INTEGER,
            total_output_tokens INTEGER,
            total_latency_ms INTEGER,
            model_calls_made INTEGER
        )
        """
    )
    conn.commit()
    conn.close()


def log_run(result: dict):
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        INSERT INTO runs (
            created_at, doubt, doubt_type, answer,
            eval1_score, eval1_issues, eval1_verdict,
            refined_answer, changes_made,
            eval2_score, eval2_issues, eval2_verdict,
            trust_score, trust_label, suggested_action,
            total_input_tokens, total_output_tokens, total_latency_ms, model_calls_made
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            time.time(),
            result["doubt"],
                        result["doubt_type"],
            result["answer"],
                        (result.get("evaluation") or {}).get("score"),
            json.dumps((result.get("evaluation") or {}).get("issues", [])),
            (result.get("evaluation") or {}).get("verdict"),
            (result.get("refinement") or {}).get("refined_answer"),
            json.dumps((result.get("refinement") or {}).get("changes_made", [])),
            (result.get("second_evaluation") or {}).get("score"),
            json.dumps((result.get("second_evaluation") or {}).get("issues", [])),
            (result.get("second_evaluation") or {}).get("verdict"),
            result["trust_score"],
            result["trust_label"],
            result["suggested_action"],
            result["telemetry"]["total_input_tokens"],
            result["telemetry"]["total_output_tokens"],
            result["telemetry"]["total_latency_ms"],
            result["telemetry"]["model_calls_made"],
        ),
    )
    conn.commit()
    conn.close()


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}


from fastapi import Query
from pipeline import search_images


@app.get("/search-images")
async def search_images_endpoint(q: str = Query(..., min_length=1, max_length=200)):
    try:
        images = await search_images(q)
        return {"query": q, "images": images}
    except Exception as e:
        print(f"IMAGE SEARCH ERROR: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Image search failed: {e}",
        )


@app.post("/check-doubt", response_model=CheckDoubtResponse)
async def check_doubt(req: CheckDoubtRequest):
    try:
        result = await run_pipeline(req.doubt, req.history)
    except Exception as e:
        print(f"PIPELINE ERROR: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"Pipeline failed: {e}")

    log_run(result)
    return result
