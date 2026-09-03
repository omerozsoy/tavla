"""API sozlesmeleri (pydantic). Cikti engine-uyumlu: points[24] +acik/-koyu."""
from pydantic import BaseModel, Field


class Corner(BaseModel):
    x: float  # normalize 0..1 (orijinal foto genisligine gore)
    y: float


class Corners(BaseModel):
    topLeft: Corner
    topRight: Corner
    bottomRight: Corner
    bottomLeft: Corner


class Detection(BaseModel):
    confidence: float
    needsReview: bool
    needsReviewPoints: list[int] = Field(default_factory=list)
    source: str  # "yolo" | "opencv" | "claude"
    errors: list[str] = Field(default_factory=list)


class BarCount(BaseModel):
    white: int = 0
    black: int = 0


class DiceResult(BaseModel):
    values: list[int] = Field(default_factory=list)
    confidence: float | None = None


class DetectResponse(BaseModel):
    success: bool
    # engine-uyumlu (frontend analyzeBoardImage ile ayni sekil):
    points: list[int]  # uzunluk 24; index i = hane i+1; +acik/-koyu
    bar: BarCount
    off: BarCount
    dice: DiceResult | None = None
    detection: Detection
