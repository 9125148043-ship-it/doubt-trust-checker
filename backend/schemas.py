from pydantic import BaseModel, Field
from typing import List, Optional

class ChatMessage(BaseModel):
    role: str
    content: str


class CheckDoubtRequest(BaseModel):
    doubt: str = Field(..., min_length=1, max_length=2000)
    history: List[ChatMessage] = []


class Evaluation(BaseModel):
    score: int
    issues: List[str]
    verdict: str


class Refinement(BaseModel):
    refined_answer: str
    changes_made: List[str]


class Telemetry(BaseModel):
    total_input_tokens: int
    total_output_tokens: int
    total_latency_ms: int
    model_calls_made: int
    stage_latencies: List[dict] = []

class CheckDoubtResponse(BaseModel):
    doubt: str
    doubt_type: str
    answer: str
    follow_up_options: List[str] = []
    verification_performed: bool = False
    evaluation: Optional[Evaluation] = None
    refinement: Optional[Refinement] = None
    second_evaluation: Optional[Evaluation] = None
    trust_score: Optional[int] = None
    trust_label: Optional[str] = None
    suggested_action: str
    formula: str
    warnings: List[str] = []
    telemetry: Telemetry            # for your cost/latency deployment-viability numbers
