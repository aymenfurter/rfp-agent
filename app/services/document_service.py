"""Document processing service implementation."""

import os
import time
import logging
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
from pathlib import Path
from fastapi import UploadFile

from app.models.document import (
    DocumentMetadata,
    DocumentProcessingResult,
    DocumentStatus,
    DocumentType
)
from app.core.config import get_settings
from app.core.exceptions import DocumentProcessingError, FileValidationError
from app.services.document_intelligence import DocumentIntelligenceService
from app.services.excel_processing import ExcelProcessingService
from app.services.ai_agent_service import AIAgentService

logger = logging.getLogger(__name__)

# In-memory storage for demonstration (replace with database)
# This will be shared across all instances of DocumentService
_documents_db: Dict[UUID, DocumentMetadata] = {}


class DocumentServiceInterface(ABC):
    """Interface for document processing services."""
    
    @abstractmethod
    async def upload_document(
        self,
        file: UploadFile,
        document_type: DocumentType = DocumentType.OTHER
    ) -> DocumentMetadata:
        """Upload and validate a document."""
        pass
    
    @abstractmethod
    async def process_document(self, document_id: UUID) -> DocumentProcessingResult:
        """Process an uploaded document to extract text and structure."""
        pass
    
    @abstractmethod
    async def get_document(self, document_id: UUID) -> Optional[DocumentMetadata]:
        """Retrieve document metadata by ID."""
        pass
    
    @abstractmethod
    async def get_documents(
        self,
        status: Optional[DocumentStatus] = None,
        document_type: Optional[DocumentType] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[DocumentMetadata]:
        """Retrieve documents with optional filtering."""
        pass
    
    @abstractmethod
    async def delete_document(self, document_id: UUID) -> bool:
        """Delete a document and its files."""
        pass
    
    @abstractmethod
    async def get_document_content(self, document_id: UUID) -> Optional[str]:
        """Get processed document content."""
        pass


class DocumentService(DocumentServiceInterface):
    """Concrete implementation of document service."""
    
    def __init__(self):
        """Initialize document service."""
        self.settings = get_settings()
        self.document_intelligence = DocumentIntelligenceService()
        self.excel_processor = ExcelProcessingService()
        self.ai_agent_service = AIAgentService()
        
        # Use the shared in-memory storage
        self._documents: Dict[UUID, DocumentMetadata] = _documents_db
        
        # Ensure upload directory exists
        Path(self.settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    
    async def initialize_ai_agents(self):
        """Initialize AI agents for criteria validation."""
        try:
            await self.ai_agent_service.initialize_agents()
            logger.info("AI Agent Service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize AI Agent Service: {e}")
    
    async def upload_document(
        self,
        file: UploadFile,
        document_type: DocumentType = DocumentType.OTHER
    ) -> DocumentMetadata:
        """Upload and validate a document."""
        try:
            # Validate file
            await self._validate_file(file)
            
            # Generate unique filename
            document_id = uuid4()
            file_extension = Path(file.filename).suffix.lower()
            filename = f"{document_id}{file_extension}"
            file_path = Path(self.settings.UPLOAD_DIR) / filename
            
            # Save file
            content = await file.read()
            with open(file_path, "wb") as f:
                f.write(content)
            
            # Create document metadata
            document = DocumentMetadata(
                id=document_id,
                filename=filename,
                original_filename=file.filename,
                file_size=len(content),
                content_type=file.content_type,
                document_type=document_type,
                status=DocumentStatus.UPLOADED
            )
            
            # Store in memory (replace with database)
            self._documents[document_id] = document
            
            logger.info(f"Document uploaded successfully: {filename}")
            return document
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Error uploading document: {e}")
            raise DocumentProcessingError(f"Failed to upload document: {str(e)}")
    
    async def process_document(self, document_id: UUID) -> DocumentProcessingResult:
        """Process an uploaded document to extract text and structure."""
        start_time = time.time()
        
        try:
            document = self._documents.get(document_id)
            if not document:
                raise DocumentProcessingError("Document not found")
            
            if document.status == DocumentStatus.PROCESSING:
                raise DocumentProcessingError("Document is already being processed")
            
            # Update status to processing
            document.status = DocumentStatus.PROCESSING
            document.processing_started_at = time.time()
            
            file_path = Path(self.settings.UPLOAD_DIR) / document.filename
            if not file_path.exists():
                raise DocumentProcessingError(f"Document file not found: {file_path}")
            
            file_extension = Path(document.filename).suffix.lower()
            
            logger.info(f"Processing document {document_id} with extension {file_extension}")
            
            # Process based on file type
            if file_extension == '.pdf':
                markdown_content = await self._process_pdf(str(file_path))
            elif file_extension in ['.xlsx', '.xls']:
                markdown_content = await self._process_excel(str(file_path))
            else:
                raise DocumentProcessingError(f"Unsupported file format: {file_extension}")
            
            if not markdown_content or len(markdown_content.strip()) == 0:
                raise DocumentProcessingError("No content extracted from document")
            
            # Classify document type and check for criteria using LLM
            logger.info("Classifying document type with LLM...")
            classification = await self.document_intelligence.classify_document_type(markdown_content)
            
            # Update document metadata with processing results
            document.markdown_content = markdown_content
            document.status = DocumentStatus.COMPLETED
            document.processing_completed_at = time.time()
            document.extracted_text_length = len(markdown_content)
            document.word_count = len(markdown_content.split())
            document.classification_confidence = classification["confidence"]
            document.contains_criteria = classification["contains_criteria"]
            
            # Map classification to document type enum
            doc_type_mapping = {
                "Request for Proposal": DocumentType.RFP,
                "Technical Requirements": DocumentType.TECHNICAL_REQUIREMENTS,
                "Scope of Work": DocumentType.SCOPE_OF_WORK,
                "Statement of Work": DocumentType.STATEMENT_OF_WORK,
                "Vendor Requirements": DocumentType.VENDOR_REQUIREMENTS,
                "System Requirements": DocumentType.SYSTEM_REQUIREMENTS,
                "Functional Requirements": DocumentType.FUNCTIONAL_REQUIREMENTS,
                "Technical Specifications": DocumentType.TECHNICAL_SPECIFICATIONS,
                "Procurement Requirements": DocumentType.PROCUREMENT_REQUIREMENTS,
                "Bid Requirements": DocumentType.BID_REQUIREMENTS,
                "Project Requirements": DocumentType.PROJECT_REQUIREMENTS,
                "RFP Addendum": DocumentType.RFP_ADDENDUM,
                "Amendment": DocumentType.AMENDMENT,
                "OTHER": DocumentType.OTHER
            }
            
            if file_extension in ['.xlsx', '.xls']:
                document.document_type = DocumentType.SPREADSHEET
            else:
                document.document_type = doc_type_mapping.get(
                    classification["document_type"], 
                    DocumentType.OTHER
                )
            
            # Log classification result with reasoning if available
            reasoning = classification.get("reasoning", "No reasoning provided")
            logger.info(
                f"Document classified as {document.document_type.value} "
                f"(confidence: {classification['confidence']:.2f}). "
                f"Reasoning: {reasoning}"
            )
            
            # Determine if this is a requirements document that should have criteria extracted
            requirements_document_types = {
                DocumentType.RFP,
                DocumentType.TECHNICAL_REQUIREMENTS,
                DocumentType.VENDOR_REQUIREMENTS,
                DocumentType.SYSTEM_REQUIREMENTS,
                DocumentType.FUNCTIONAL_REQUIREMENTS,
                DocumentType.TECHNICAL_SPECIFICATIONS,
                DocumentType.PROCUREMENT_REQUIREMENTS,
                DocumentType.BID_REQUIREMENTS,
                DocumentType.PROJECT_REQUIREMENTS
            }
            
            is_requirements_document = (
                document.document_type in requirements_document_types or 
                document.contains_criteria
            )
            
            processing_time = time.time() - start_time
            
            # Create processing result with updated information
            result = DocumentProcessingResult(
                document_id=document_id,
                status=DocumentStatus.COMPLETED,
                page_count=1,  # TODO: Extract actual page count
                word_count=document.word_count,
                criteria_count=0,  # Will be updated after criteria extraction
                processing_time_seconds=processing_time,
                extracted_sections=[],  # TODO: Extract sections
                confidence_score=classification["confidence"],
                classification_result=document.document_type,
                contains_criteria=is_requirements_document
            )
            
            logger.info(
                f"Document processed successfully: {document.filename}, "
                f"type: {document.document_type.value}, "
                f"is_requirements_document: {is_requirements_document}, "
                f"contains_criteria: {document.contains_criteria}, "
                f"processing_time: {processing_time:.2f}s"
            )
            return result
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            # Update document status to failed
            if document_id in self._documents:
                self._documents[document_id].status = DocumentStatus.FAILED
                self._documents[document_id].error_message = str(e)
            
            logger.error(f"Error processing document: {e}")
            raise DocumentProcessingError(f"Failed to process document: {str(e)}")
    
    async def get_document(self, document_id: UUID) -> Optional[DocumentMetadata]:
        """Retrieve document metadata by ID."""
        return self._documents.get(document_id)
    
    async def get_documents(
        self,
        status: Optional[DocumentStatus] = None,
        document_type: Optional[DocumentType] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[DocumentMetadata]:
        """Retrieve documents with optional filtering."""
        documents = list(self._documents.values())
        
        # Apply filters
        if status:
            documents = [doc for doc in documents if doc.status == status]
        if document_type:
            documents = [doc for doc in documents if doc.document_type == document_type]
        
        # Sort by upload timestamp (newest first)
        documents.sort(key=lambda x: x.upload_timestamp, reverse=True)
        
        # Apply pagination
        return documents[offset:offset + limit]
    
    async def delete_document(self, document_id: UUID) -> bool:
        """Delete a document and its files."""
        try:
            document = self._documents.get(document_id)
            if not document:
                return False
            
            # Delete file
            file_path = Path(self.settings.UPLOAD_DIR) / document.filename
            if file_path.exists():
                file_path.unlink()
            
            # Remove from storage
            del self._documents[document_id]
            
            logger.info(f"Document deleted successfully: {document.filename}")
            return True
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Error deleting document: {e}")
            return False
    
    async def get_document_content(self, document_id: UUID) -> Optional[str]:
        """Get processed document content."""
        document = self._documents.get(document_id)
        if document:
            return document.markdown_content
        return None
    
    async def _validate_file(self, file: UploadFile) -> None:
        """Validate uploaded file."""
        # Check file size
        content = await file.read()
        await file.seek(0)  # Reset file pointer
        
        if len(content) > self.settings.MAX_FILE_SIZE:
            raise FileValidationError(
                f"File size {len(content)} exceeds maximum allowed {self.settings.MAX_FILE_SIZE}"
            )
        
        # Check file extension
        file_extension = Path(file.filename).suffix.lower()
        if file_extension not in self.settings.ALLOWED_EXTENSIONS:
            raise FileValidationError(
                f"File extension {file_extension} not allowed. Allowed: {self.settings.ALLOWED_EXTENSIONS}"
            )
    
    async def _process_pdf(self, file_path: str) -> str:
        """Process PDF file and extract markdown content."""
        try:
            logger.info(f"Processing PDF file: {file_path}")
            markdown_content = await self.document_intelligence.extract_markdown_from_pdf(file_path)
            logger.info(f"Successfully extracted {len(markdown_content)} characters from PDF")
            return markdown_content
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Error processing PDF: {e}")
            raise DocumentProcessingError(f"PDF processing failed: {str(e)}")
    
    async def _process_excel(self, file_path: str) -> str:
        """Process Excel file and convert to markdown."""
        try:
            logger.info(f"Processing Excel file: {file_path}")
            markdown_content = await self.excel_processor.convert_excel_to_markdown(file_path)
            logger.info(f"Successfully converted Excel to {len(markdown_content)} characters of markdown")
            return markdown_content
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Error processing Excel: {e}")
            raise DocumentProcessingError(f"Excel processing failed: {str(e)}")
    
    async def cleanup_ai_agents(self):
        """Cleanup AI agents when shutting down."""
        try:
            await self.ai_agent_service.cleanup_agents()
            logger.info("AI Agent Service cleaned up successfully")
        except Exception as e:
            logger.error(f"Error cleaning up AI Agent Service: {e}")
    
    def get_document_statistics(self) -> Dict[str, Any]:
        """Get statistics about processed documents."""
        documents = list(self._documents.values())
        
        stats = {
            "total_documents": len(documents),
            "by_status": {},
            "by_type": {},
            "total_criteria": sum(doc.criteria_count for doc in documents),
            "with_criteria": len([doc for doc in documents if doc.contains_criteria])
        }
        
        # Count by status
        for status in DocumentStatus:
            stats["by_status"][status.value] = len([doc for doc in documents if doc.status == status])
        
        # Count by type
        for doc_type in DocumentType:
            stats["by_type"][doc_type.value] = len([doc for doc in documents if doc.document_type == doc_type])
        
        return stats
