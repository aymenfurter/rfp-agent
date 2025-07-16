from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.models.criteria import (
    Criterion,
    CriteriaResponse,
    CriteriaUpdateRequest,
    CriteriaBulkUpdateRequest,
    CriteriaStatistics,
    CriteriaCategory,
    CriteriaStatus,
    CriteriaPriority
)
from app.services.criteria_service import CriteriaServiceInterface, CriteriaService
from app.api.routes.documents import get_document_service
from app.core.exceptions import CriteriaExtractionError

router = APIRouter()

# Create a single instance of the criteria service
_criteria_service_instance = None


def get_criteria_service() -> CriteriaServiceInterface:
    """Dependency to get criteria service instance."""
    global _criteria_service_instance
    if _criteria_service_instance is None:
        _criteria_service_instance = CriteriaService(document_service=get_document_service())
    return _criteria_service_instance


@router.post("/extract/{document_id}", response_model=CriteriaResponse)
async def extract_criteria(
    document_id: UUID,
    auto_categorize: bool = Query(True, description="Automatically categorize extracted criteria"),
    service: CriteriaServiceInterface = Depends(get_criteria_service)
) -> CriteriaResponse:
    """
    Extract criteria from a processed document.
    
    - **document_id**: UUID of the processed document
    - **auto_categorize**: Whether to automatically categorize criteria using AI
    
    Returns extracted and structured criteria from the document.
    """
    try:
        # Extract raw criteria
        extractions = await service.extract_criteria_from_document(
            document_id, auto_categorize=auto_categorize
        )
        
        # Convert to structured criteria
        extraction_ids = [extraction.id for extraction in extractions]
        criteria = await service.process_extractions_to_criteria(extraction_ids)
        
        # Get statistics
        statistics = await service.get_criteria_statistics(document_id=document_id)
        
        return CriteriaResponse(
            criteria=criteria,
            statistics=statistics,
            total_count=len(criteria),
            message=f"Successfully extracted {len(criteria)} criteria from document",
            success=True
        )
    except CriteriaExtractionError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Criteria extraction failed: {e.message}"
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to extract criteria"
        )


@router.get("/", response_model=CriteriaResponse)
async def get_criteria(
    document_id: Optional[UUID] = Query(None, description="Filter by document ID"),
    category: Optional[CriteriaCategory] = Query(None, description="Filter by category"),
    status_filter: Optional[CriteriaStatus] = Query(None, alias="status", description="Filter by status"),
    priority: Optional[CriteriaPriority] = Query(None, description="Filter by priority"),
    search: Optional[str] = Query(None, description="Search in criterion text"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    service: CriteriaServiceInterface = Depends(get_criteria_service)
) -> CriteriaResponse:
    """
    Retrieve criteria with optional filtering and pagination.
    
    - **document_id**: Filter criteria by source document
    - **category**: Filter by criteria category
    - **status**: Filter by review status
    - **priority**: Filter by priority level
    - **search**: Search text in criterion content
    - **page**: Page number for pagination
    - **page_size**: Number of items per page
    
    Returns paginated list of criteria matching the filters.
    """
    try:
        offset = (page - 1) * page_size
        
        criteria = await service.get_criteria(
            document_id=document_id,
            category=category,
            status=status_filter,
            priority=priority,
            search_query=search,
            limit=page_size + 1,  # Get one extra to check if there's a next page
            offset=offset
        )
        
        has_next = len(criteria) > page_size
        if has_next:
            criteria = criteria[:-1]  # Remove the extra item
        
        # Get overall statistics
        statistics = await service.get_criteria_statistics(document_id=document_id)
        
        return CriteriaResponse(
            criteria=criteria,
            statistics=statistics,
            total_count=statistics.total_count,
            page=page,
            page_size=page_size,
            has_next=has_next,
            message=f"Retrieved {len(criteria)} criteria",
            success=True
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve criteria"
        )


@router.get("/{criterion_id}", response_model=Criterion)
async def get_criterion(
    criterion_id: UUID,
    service: CriteriaServiceInterface = Depends(get_criteria_service)
) -> Criterion:
    """
    Retrieve a single criterion by ID.
    
    - **criterion_id**: UUID of the criterion to retrieve
    
    Returns complete criterion details.
    """
    criterion = await service.get_criterion(criterion_id)
    if not criterion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Criterion not found"
        )
    return criterion


@router.put("/bulk", response_model=Dict[str, Any])
async def bulk_update_criteria(
    update_request: CriteriaBulkUpdateRequest,
    service: CriteriaServiceInterface = Depends(get_criteria_service)
) -> Dict[str, Any]:
    """
    Bulk update multiple criteria.
    
    - **update_request**: Criteria IDs and updates to apply
    
    Returns summary of update results.
    """
    try:
        results = await service.bulk_update_criteria(update_request)
        
        success_count = sum(1 for success in results.values() if success)
        failure_count = len(results) - success_count
        
        return {
            "success": True,
            "message": f"Updated {success_count} criteria, {failure_count} failed",
            "results": {str(k): v for k, v in results.items()},
            "success_count": success_count,
            "failure_count": failure_count
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to bulk update criteria"
        )


@router.put("/{criterion_id}", response_model=Criterion)
async def update_criterion(
    criterion_id: UUID,
    update_request: CriteriaUpdateRequest,
    reviewed_by: Optional[str] = Query(None, description="ID/name of reviewer"),
    service: CriteriaServiceInterface = Depends(get_criteria_service)
) -> Criterion:
    """
    Update a criterion.
    
    - **criterion_id**: UUID of the criterion to update
    - **update_request**: Fields to update
    - **reviewed_by**: Optional reviewer identifier
    
    Returns the updated criterion.
    """
    criterion = await service.update_criterion(
        criterion_id, update_request, reviewed_by=reviewed_by
    )
    if not criterion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Criterion not found"
        )
    return criterion


@router.post("/{criterion_id}/approve", response_model=Criterion)
async def approve_criterion(
    criterion_id: UUID,
    reviewed_by: Optional[str] = Query(None, description="ID/name of reviewer"),
    service: CriteriaServiceInterface = Depends(get_criteria_service)
) -> Criterion:
    """
    Approve a criterion.
    
    - **criterion_id**: UUID of the criterion to approve
    - **reviewed_by**: Optional reviewer identifier
    
    Returns the approved criterion.
    """
    criterion = await service.approve_criterion(criterion_id, reviewed_by=reviewed_by)
    if not criterion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Criterion not found"
        )
    return criterion


@router.post("/{criterion_id}/reject", response_model=Criterion)
async def reject_criterion(
    criterion_id: UUID,
    reason: str = Query(..., description="Reason for rejection"),
    reviewed_by: Optional[str] = Query(None, description="ID/name of reviewer"),
    service: CriteriaServiceInterface = Depends(get_criteria_service)
) -> Criterion:
    """
    Reject a criterion.
    
    - **criterion_id**: UUID of the criterion to reject
    - **reason**: Reason for rejection
    - **reviewed_by**: Optional reviewer identifier
    
    Returns the rejected criterion.
    """
    criterion = await service.reject_criterion(
        criterion_id, reason, reviewed_by=reviewed_by
    )
    if not criterion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Criterion not found"
        )
    return criterion


@router.get("/statistics/overview", response_model=CriteriaStatistics)
async def get_criteria_statistics(
    document_id: Optional[UUID] = Query(None, description="Filter by document ID"),
    service: CriteriaServiceInterface = Depends(get_criteria_service)
) -> CriteriaStatistics:
    """
    Get criteria statistics overview.
    
    - **document_id**: Optional document filter
    
    Returns comprehensive statistics about criteria.
    """
    return await service.get_criteria_statistics(document_id=document_id)


@router.post("/auto-categorize")
async def auto_categorize_criteria(
    criteria_ids: List[UUID],
    service: CriteriaServiceInterface = Depends(get_criteria_service)
):
    """
    Auto-categorize criteria into 6 predefined categories using AI.
    
    - **criteria_ids**: List of criterion UUIDs to categorize
    
    Returns categorization results for each criterion.
    """
    try:
        if not criteria_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No criteria IDs provided"
            )
        
        results = await service.auto_categorize_criteria(criteria_ids)
        
        return {
            "categorization_results": results,
            "processed_count": len(results),
            "total_requested": len(criteria_ids),
            "message": f"Successfully categorized {len(results)} criteria",
            "success": True
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to auto-categorize criteria: {str(e)}"
        )


class CriterionValidationRequest(BaseModel):
    """Request model for criterion validation."""
    product_name: str = Field(..., description="Product/service name to validate against")
    use_deep_research: bool = Field(False, description="Use deep research for validation")


@router.post("/{criterion_id}/validate", response_model=Criterion)
async def validate_criterion_with_agent(
    criterion_id: UUID,
    request: CriterionValidationRequest,
    service: CriteriaServiceInterface = Depends(get_criteria_service)
) -> Criterion:
    """
    Validate a criterion using AI agent with web research.
    
    - **criterion_id**: UUID of the criterion to validate
    - **request**: Validation request with product name and research options
    
    Returns the criterion with validation results.
    """
    try:
        criterion = await service.validate_criterion_with_agent(
            criterion_id=criterion_id,
            product_name=request.product_name,
            use_deep_research=request.use_deep_research
        )

        print ("=== Validated Criterion ===")
        print (criterion)
        
        if not criterion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Criterion not found"
            )
        
        return criterion
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to validate criterion: {str(e)}"
        )
