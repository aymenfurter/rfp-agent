from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, validator
from uuid import UUID, uuid4


class DocumentStatus(str, Enum):
    """Document processing status."""
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class DocumentType(str, Enum):
    """Document type classification."""
    RFP = "rfp"
    TECHNICAL_REQUIREMENTS = "technical_requirements"
    SCOPE_OF_WORK = "scope_of_work" 
    STATEMENT_OF_WORK = "statement_of_work"
    VENDOR_REQUIREMENTS = "vendor_requirements"
    SYSTEM_REQUIREMENTS = "system_requirements"
    FUNCTIONAL_REQUIREMENTS = "functional_requirements"
    TECHNICAL_SPECIFICATIONS = "technical_specifications"
    PROCUREMENT_REQUIREMENTS = "procurement_requirements"
    BID_REQUIREMENTS = "bid_requirements"
    PROJECT_REQUIREMENTS = "project_requirements"
    RFP_ADDENDUM = "rfp_addendum"
    AMENDMENT = "amendment"
    SPREADSHEET = "spreadsheet"
    OTHER = "other"


class DocumentUploadRequest(BaseModel):
    """Request model for document upload."""
    filename: str = Field(..., description="Original filename")
    file_size: int = Field(..., gt=0, description="File size in bytes")
    content_type: str = Field(..., description="MIME content type")
    
    @validator('filename')
    def validate_filename(cls, v):
        if not v.strip():
            raise ValueError("Filename cannot be empty")
        return v.strip()


class DocumentMetadata(BaseModel):
    """Document metadata model."""
    id: UUID = Field(default_factory=uuid4)
    filename: str
    original_filename: str
    file_size: int
    content_type: str
    document_type: DocumentType
    upload_timestamp: datetime = Field(default_factory=datetime.utcnow)
    processing_started_at: Optional[datetime] = None
    processing_completed_at: Optional[datetime] = None
    status: DocumentStatus = DocumentStatus.UPLOADED
    page_count: Optional[int] = None
    word_count: Optional[int] = None
    extracted_text_length: Optional[int] = None
    markdown_content: Optional[str] = None
    classification_confidence: Optional[float] = None
    contains_criteria: bool = False
    criteria_count: int = 0
    error_message: Optional[str] = None


class DocumentProcessingResult(BaseModel):
    """Result of document processing."""
    document_id: UUID
    status: DocumentStatus
    page_count: int
    word_count: int
    criteria_count: int
    processing_time_seconds: float
    extracted_sections: List[str] = []
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    classification_result: Optional[DocumentType] = None
    contains_criteria: bool = False


class DocumentResponse(BaseModel):
    """Response model for document operations."""
    document: DocumentMetadata
    processing_result: Optional[DocumentProcessingResult] = None
    message: str
    success: bool
