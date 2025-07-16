"""Criteria extraction and management service implementation."""

import logging
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from uuid import UUID

from app.models.criteria import (
    Criterion,
    CriteriaExtraction,
    CriteriaUpdateRequest,
    CriteriaBulkUpdateRequest,
    CriteriaStatistics,
    CriteriaCategory,
    CriteriaStatus,
    CriteriaPriority
)
from app.services.criteria_extraction import CriteriaExtractionService
from app.services.ai_agent_service import AIAgentService
from app.services.summarization_service import SummarizationService
from app.core.exceptions import CriteriaExtractionError, RFPAgentException
from app.models.document import DocumentType

logger = logging.getLogger(__name__)

# In-memory storage for demonstration (replace with database)
_extractions_db: Dict[UUID, CriteriaExtraction] = {}
_criteria_db: Dict[UUID, Criterion] = {}


class CriteriaServiceInterface(ABC):
    """Interface for criteria extraction and management services."""
    
    @abstractmethod
    async def extract_criteria_from_document(
        self,
        document_id: UUID,
        auto_categorize: bool = True
    ) -> List[CriteriaExtraction]:
        """Extract criteria from a processed document."""
        pass
    
    @abstractmethod
    async def process_extractions_to_criteria(
        self,
        extraction_ids: List[UUID]
    ) -> List[Criterion]:
        """Convert raw extractions to structured criteria."""
        pass
    
    @abstractmethod
    async def get_criteria(
        self,
        document_id: Optional[UUID] = None,
        category: Optional[CriteriaCategory] = None,
        status: Optional[CriteriaStatus] = None,
        priority: Optional[CriteriaPriority] = None,
        search_query: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Criterion]:
        """Retrieve criteria with optional filtering."""
        pass
    
    @abstractmethod
    async def get_criterion(self, criterion_id: UUID) -> Optional[Criterion]:
        """Retrieve a single criterion by ID."""
        pass
    
    @abstractmethod
    async def update_criterion(
        self,
        criterion_id: UUID,
        update_request: CriteriaUpdateRequest,
        reviewed_by: Optional[str] = None
    ) -> Optional[Criterion]:
        """Update a single criterion."""
        pass
    
    @abstractmethod
    async def bulk_update_criteria(
        self,
        update_request: CriteriaBulkUpdateRequest
    ) -> Dict[UUID, bool]:
        """Update multiple criteria in bulk."""
        pass
    
    @abstractmethod
    async def approve_criterion(
        self,
        criterion_id: UUID,
        reviewed_by: Optional[str] = None
    ) -> Optional[Criterion]:
        """Approve a criterion."""
        pass
    
    @abstractmethod
    async def reject_criterion(
        self,
        criterion_id: UUID,
        reason: str,
        reviewed_by: Optional[str] = None
    ) -> Optional[Criterion]:
        """Reject a criterion."""
        pass
    
    @abstractmethod
    async def get_criteria_statistics(
        self,
        document_id: Optional[UUID] = None
    ) -> CriteriaStatistics:
        """Get criteria statistics."""
        pass
    
    @abstractmethod
    async def auto_categorize_criteria(
        self,
        criteria_ids: List[UUID]
    ) -> Dict[UUID, CriteriaCategory]:
        """Auto-categorize criteria using AI."""
        pass

    @abstractmethod
    async def validate_criterion_with_agent(
        self,
        criterion_id: UUID,
        product_name: str,
        use_deep_research: bool = False
    ) -> Optional[Criterion]:
        """Validate a criterion using an AI agent."""
        pass


class CriteriaService(CriteriaServiceInterface):
    """Concrete implementation of criteria service."""
    
    def __init__(self, document_service=None):
        """Initialize criteria service."""
        self.extraction_service = CriteriaExtractionService()
        self.document_service = document_service
        self.ai_agent_service = AIAgentService()
        self.summarization_service = SummarizationService()
        
        # In-memory storage for demonstration (replace with database)
        self._extractions: Dict[UUID, CriteriaExtraction] = _extractions_db
        self._criteria: Dict[UUID, Criterion] = _criteria_db
    
    async def extract_criteria_from_document(
        self,
        document_id: UUID,
        auto_categorize: bool = True
    ) -> List[CriteriaExtraction]:
        """Extract criteria from a processed document."""
        try:
            # Check if document is a requirements document
            document = await self.document_service.get_document(document_id)
            if not document:
                raise CriteriaExtractionError("Document not found")
            
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
            
            if not is_requirements_document:
                logger.info(f"Document {document_id} is not a requirements document ({document.document_type}). Skipping criteria extraction.")
                return []
            
            # Get document content
            content = await self.document_service.get_document_content(document_id)
            if not content:
                raise CriteriaExtractionError("Document content not found or not processed")
            
            # Extract criteria
            extractions = await self.extraction_service.extract_criteria_from_content(
                content, document_id
            )
            
            # Store extractions
            for extraction in extractions:
                self._extractions[extraction.id] = extraction
            
            logger.info(f"Extracted {len(extractions)} criteria from requirements document {document_id}")
            return extractions
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Error extracting criteria from document {document_id}: {e}")
            raise CriteriaExtractionError(f"Failed to extract criteria: {str(e)}")
    
    async def process_extractions_to_criteria(
        self,
        extraction_ids: List[UUID]
    ) -> List[Criterion]:
        """Convert raw extractions to structured criteria."""
        try:
            extractions = []
            for extraction_id in extraction_ids:
                extraction = self._extractions.get(extraction_id)
                if extraction:
                    extractions.append(extraction)
            
            if not extractions:
                return []
            
            # Convert to criteria
            criteria = await self.extraction_service.process_extractions_to_criteria(extractions)
            
            # Store criteria
            for criterion in criteria:
                self._criteria[criterion.id] = criterion
            
            # Update document criteria count
            if extractions:
                doc_id = extractions[0].document_id
                document = await self.document_service.get_document(doc_id)
                if document:
                    document.criteria_count = len([c for c in self._criteria.values() 
                                                  if c.extraction_id in [e.id for e in extractions]])
            
            logger.info(f"Processed {len(criteria)} criteria from extractions")
            return criteria
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Error processing extractions to criteria: {e}")
            raise CriteriaExtractionError(f"Failed to process extractions: {str(e)}")
    
    async def get_criteria(
        self,
        document_id: Optional[UUID] = None,
        category: Optional[CriteriaCategory] = None,
        status: Optional[CriteriaStatus] = None,
        priority: Optional[CriteriaPriority] = None,
        search_query: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Criterion]:
        """Retrieve criteria with optional filtering."""
        criteria = list(self._criteria.values())
        
        # Apply filters
        if document_id:
            # Filter by document ID by checking extraction document_id
            extraction_ids = [e.id for e in self._extractions.values() if e.document_id == document_id]
            criteria = [c for c in criteria if c.extraction_id in extraction_ids]
        
        if category:
            criteria = [c for c in criteria if c.category == category]
        
        if status:
            criteria = [c for c in criteria if c.status == status]
        
        if priority:
            criteria = [c for c in criteria if c.priority == priority]
        
        if search_query:
            query_lower = search_query.lower()
            criteria = [c for c in criteria if query_lower in c.criterion_text.lower()]
        
        # Sort by creation date (newest first)
        criteria.sort(key=lambda x: x.created_at, reverse=True)
        
        # Apply pagination
        return criteria[offset:offset + limit]
    
    async def get_criterion(self, criterion_id: UUID) -> Optional[Criterion]:
        """Retrieve a single criterion by ID."""
        return self._criteria.get(criterion_id)
    
    async def update_criterion(
        self,
        criterion_id: UUID,
        update_request: CriteriaUpdateRequest,
        reviewed_by: Optional[str] = None
    ) -> Optional[Criterion]:
        """Update a single criterion."""
        criterion = self._criteria.get(criterion_id)
        if not criterion:
            return None
        
        # Apply updates
        if update_request.criterion_text is not None:
            criterion.criterion_text = update_request.criterion_text
        if update_request.category is not None:
            criterion.category = update_request.category
        if update_request.priority is not None:
            criterion.priority = update_request.priority
        if update_request.status is not None:
            criterion.status = update_request.status
        if update_request.review_notes is not None:
            criterion.review_notes = update_request.review_notes
        
        if reviewed_by:
            criterion.reviewed_by = reviewed_by
        
        from datetime import datetime
        criterion.updated_at = datetime.utcnow()
        
        return criterion
    
    async def bulk_update_criteria(
        self,
        update_request: CriteriaBulkUpdateRequest
    ) -> Dict[UUID, bool]:
        """Update multiple criteria in bulk."""
        results = {}
        
        for criterion_id in update_request.criteria_ids:
            try:
                updated = await self.update_criterion(
                    criterion_id, 
                    update_request.updates, 
                    update_request.reviewed_by
                )
                results[criterion_id] = updated is not None
            except Exception as e:
                import traceback
                traceback.print_exc()
                logger.error(f"Error updating criterion {criterion_id}: {e}")
                results[criterion_id] = False
        
        return results
    
    async def approve_criterion(
        self,
        criterion_id: UUID,
        reviewed_by: Optional[str] = None
    ) -> Optional[Criterion]:
        """Approve a criterion."""
        update_request = CriteriaUpdateRequest(
            status=CriteriaStatus.APPROVED,
            review_notes="Approved"
        )
        return await self.update_criterion(criterion_id, update_request, reviewed_by)
    
    async def reject_criterion(
        self,
        criterion_id: UUID,
        reason: str,
        reviewed_by: Optional[str] = None
    ) -> Optional[Criterion]:
        """Reject a criterion."""
        update_request = CriteriaUpdateRequest(
            status=CriteriaStatus.REJECTED,
            review_notes=f"Rejected: {reason}"
        )
        return await self.update_criterion(criterion_id, update_request, reviewed_by)
    
    async def get_criteria_statistics(
        self,
        document_id: Optional[UUID] = None
    ) -> CriteriaStatistics:
        """Get criteria statistics."""
        criteria = await self.get_criteria(document_id=document_id, limit=1000)
        
        total_count = len(criteria)
        by_status = {}
        by_category = {}
        by_priority = {}
        
        # Count by status
        for status in CriteriaStatus:
            by_status[status] = len([c for c in criteria if c.status == status])
        
        # Count by category
        for category in CriteriaCategory:
            by_category[category] = len([c for c in criteria if c.category == category])
        
        # Count by priority
        for priority in CriteriaPriority:
            by_priority[priority] = len([c for c in criteria if c.priority == priority])
        
        # Calculate approval rate
        approved_count = by_status.get(CriteriaStatus.APPROVED, 0)
        approval_rate = approved_count / total_count if total_count > 0 else 0.0
        
        return CriteriaStatistics(
            total_count=total_count,
            by_status=by_status,
            by_category=by_category,
            by_priority=by_priority,
            approval_rate=approval_rate
        )
    
    async def auto_categorize_criteria(
        self,
        criteria_ids: List[UUID]
    ) -> Dict[UUID, CriteriaCategory]:
        """Auto-categorize criteria using AI."""
        try:
            criteria_texts = []
            valid_ids = []
            
            for criterion_id in criteria_ids:
                criterion = self._criteria.get(criterion_id)
                if criterion:
                    criteria_texts.append(criterion.criterion_text)
                    valid_ids.append(criterion_id)
            
            if not criteria_texts:
                return {}
            
            # Use extraction service to categorize
            categorized = await self.extraction_service.categorize_criteria(criteria_texts)
            
            # Map back to criterion IDs and update
            results = {}
            category_mapping = {
                "Technical Requirements": CriteriaCategory.TECHNICAL,
                "Security & Compliance": CriteriaCategory.SECURITY,
                "Performance & Scalability": CriteriaCategory.PERFORMANCE,
                "Integration & Compatibility": CriteriaCategory.INTEGRATION,
                "Support & Maintenance": CriteriaCategory.SUPPORT,
                "Commercial & Legal": CriteriaCategory.FINANCIAL
            }
            
            for i, criterion_id in enumerate(valid_ids):
                # Find which category this criterion was assigned to
                for category_name, criteria_list in categorized.items():
                    if i < len(criteria_list) and criteria_texts[i] in criteria_list:
                        mapped_category = category_mapping.get(category_name, CriteriaCategory.OTHER)
                        
                        # Update the criterion
                        criterion = self._criteria[criterion_id]
                        criterion.category = mapped_category
                        
                        results[criterion_id] = mapped_category
                        break
            
            return results
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Error auto-categorizing criteria: {e}")
            return {}
    
    async def extract_criteria_from_document(
        self,
        document_id: UUID,
        auto_categorize: bool = True
    ) -> List[CriteriaExtraction]:
        """Extract criteria from a processed document."""
        try:
            # Check if document is a requirements document
            document = await self.document_service.get_document(document_id)
            if not document:
                raise CriteriaExtractionError("Document not found")
            
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
            
            if not is_requirements_document:
                logger.info(f"Document {document_id} is not a requirements document ({document.document_type}). Skipping criteria extraction.")
                return []
            
            # Get document content
            content = await self.document_service.get_document_content(document_id)
            if not content:
                raise CriteriaExtractionError("Document content not found or not processed")
            
            # Extract criteria
            extractions = await self.extraction_service.extract_criteria_from_content(
                content, document_id
            )
            
            # Store extractions
            for extraction in extractions:
                self._extractions[extraction.id] = extraction
            
            logger.info(f"Extracted {len(extractions)} criteria from requirements document {document_id}")
            return extractions
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Error extracting criteria from document {document_id}: {e}")
            raise CriteriaExtractionError(f"Failed to extract criteria: {str(e)}")

    async def validate_criterion_with_agent(
        self,
        criterion_id: UUID,
        product_name: str,
        use_deep_research: bool = False
    ) -> Optional[Criterion]:
        """Validate a criterion using an AI agent."""
        criterion = self._criteria.get(criterion_id)
        if not criterion:
            return None

        extraction = self._extractions.get(criterion.extraction_id)
        if not extraction:
            raise RFPAgentException("Source extraction not found for the criterion.")

        # Get source document content for context
        source_doc = await self.document_service.get_document(extraction.document_id)
        if not source_doc or not source_doc.markdown_content:
            logger.warning("Source document content not found, using criterion text only")
            document_summary = f"Limited context available. Evaluating criterion: {criterion.criterion_text}"
        else:
            # Generate summary using map-reduce approach
            try:
                document_summary = await self.summarization_service.summarize_content(source_doc.markdown_content)
            except Exception as e:
                logger.warning(f"Failed to generate document summary: {e}")
                document_summary = f"Document summary unavailable. Evaluating criterion: {criterion.criterion_text}"

        # Call agent for validation - no fallback, let it fail if not configured
        validation_result = await self.ai_agent_service.validate_criterion(
            product_name=product_name,
            document_summary=document_summary,
            criterion_text=criterion.criterion_text,
            use_deep_research=use_deep_research
        )

        # Update criterion with validation result
        from datetime import datetime
        criterion.is_met = validation_result.is_met
        criterion.validation_summary = validation_result.summary
        criterion.validation_references = validation_result.references
        criterion.status = CriteriaStatus.MODIFIED
        criterion.updated_at = datetime.utcnow()
        
        logger.info(f"Criterion {criterion_id} validated. Is met: {criterion.is_met}")
        return criterion
