from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from uuid import UUID, uuid4


class CriteriaCategory(str, Enum):
    """Criteria category classification."""
    TECHNICAL = "technical"
    SECURITY = "security"
    PERFORMANCE = "performance"
    SUPPORT = "support"
    COMPLIANCE = "compliance"
    INTEGRATION = "integration"
    FINANCIAL = "financial"
    OTHER = "other"


class CriteriaStatus(str, Enum):
    """Criteria review status."""
    EXTRACTED = "extracted"
    APPROVED = "approved"
    MODIFIED = "modified"
    REJECTED = "rejected"
    PENDING = "pending"


class CriteriaPriority(str, Enum):
    """Criteria priority level."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class CriteriaExtraction(BaseModel):
    """Raw criteria extraction from document."""
    id: UUID = Field(default_factory=uuid4)
    document_id: UUID
    raw_text: str = Field(..., description="Original text from document")
    processed_text: str = Field(..., description="Cleaned and processed text")
    page_number: Optional[int] = None
    criteria_id: Optional[str] = None
    section_title: Optional[str] = None
    extraction_confidence: float = Field(..., ge=0.0, le=1.0)
    extraction_timestamp: datetime = Field(default_factory=datetime.utcnow)


class Criterion(BaseModel):
    """Structured criterion model."""
    id: UUID = Field(default_factory=uuid4)
    extraction_id: UUID
    criterion_text: str = Field(..., description="Formatted criterion text")
    category: CriteriaCategory
    priority: CriteriaPriority = CriteriaPriority.MEDIUM
    status: CriteriaStatus = CriteriaStatus.EXTRACTED
    source_reference: str = Field(..., description="Source document and location")
    keywords: List[str] = Field(default_factory=list)
    requirements: List[str] = Field(default_factory=list)
    evaluation_criteria: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    review_notes: Optional[str] = None
    
    # AI Agent Validation Fields
    is_met: Optional[bool] = None
    validation_summary: Optional[str] = None
    validation_references: List[Dict[str, str]] = Field(default_factory=list)
    
    @validator('criterion_text')
    def validate_criterion_text(cls, v):
        if len(v.strip()) < 10:
            raise ValueError("Criterion text must be at least 10 characters")
        return v.strip()


class CriteriaUpdateRequest(BaseModel):
    """Request model for updating criteria."""
    criterion_text: Optional[str] = None
    category: Optional[CriteriaCategory] = None
    priority: Optional[CriteriaPriority] = None
    status: Optional[CriteriaStatus] = None
    review_notes: Optional[str] = None


class CriteriaBulkUpdateRequest(BaseModel):
    """Request model for bulk criteria updates."""
    criteria_ids: List[UUID] = Field(..., min_items=1)
    updates: CriteriaUpdateRequest
    reviewed_by: Optional[str] = None


class CriteriaStatistics(BaseModel):
    """Criteria statistics model."""
    total_count: int
    by_status: Dict[CriteriaStatus, int]
    by_category: Dict[CriteriaCategory, int]
    by_priority: Dict[CriteriaPriority, int]
    approval_rate: float = Field(..., ge=0.0, le=1.0)


class CriteriaResponse(BaseModel):
    """Response model for criteria operations."""
    criteria: List[Criterion]
    statistics: Optional[CriteriaStatistics] = None
    total_count: int
    page: int = 1
    page_size: int = 50
    has_next: bool = False
    message: str
    success: bool
