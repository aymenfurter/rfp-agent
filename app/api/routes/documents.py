from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from fastapi.responses import JSONResponse

from app.models.document import (
    DocumentMetadata,
    DocumentProcessingResult,
    DocumentResponse,
    DocumentStatus,
    DocumentType
)
from app.services.document_service import DocumentServiceInterface, DocumentService
from app.core.exceptions import DocumentProcessingError, FileValidationError

router = APIRouter()

# Create a single instance of the service to be shared
_document_service_instance = DocumentService()


def get_document_service() -> DocumentServiceInterface:
    """Dependency to get document service instance."""
    return _document_service_instance


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Query(default="other", description="Document type")
):
    """Upload a document for processing."""
    try:
        # Convert string to enum if valid
        try:
            doc_type = DocumentType(document_type.lower())
        except ValueError:
            doc_type = DocumentType.OTHER
        
        # Upload the document
        document = await _document_service_instance.upload_document(file, doc_type)
        
        # Immediately process the document to get classification
        try:
            processing_result = await _document_service_instance.process_document(document.id)
            
            # Get the updated document after processing
            updated_document = await _document_service_instance.get_document(document.id)
            
            return {
                "success": True,
                "message": "Document uploaded and processed successfully",
                "document": updated_document.model_dump() if updated_document else document.model_dump(),
                "processing_result": processing_result.model_dump() if processing_result else None
            }
        except Exception as processing_error:
            # Return the uploaded document even if processing failed
            return {
                "success": True,
                "message": "Document uploaded successfully (processing failed)",
                "document": document.model_dump(),
                "processing_result": None,
                "processing_error": str(processing_error)
            }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{document_id}/process", response_model=DocumentResponse)
async def process_document(
    document_id: UUID,
    service: DocumentServiceInterface = Depends(get_document_service)
) -> DocumentResponse:
    """
    Process an uploaded document to extract text and structure.
    
    - **document_id**: UUID of the document to process
    
    Returns processing results including page count, word count, and extracted sections.
    """
    try:
        # Get document metadata first
        document = await service.get_document(document_id)
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        # Check if document is in uploadable state
        if document.status not in [DocumentStatus.UPLOADED, DocumentStatus.FAILED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Document cannot be processed. Current status: {document.status.value}"
            )
        
        # Process the document
        processing_result = await service.process_document(document_id)
        
        # Get updated document metadata
        updated_document = await service.get_document(document_id)
        
        return DocumentResponse(
            document=updated_document,
            processing_result=processing_result,
            message="Document processed successfully",
            success=True
        )
    except HTTPException:
        raise
    except DocumentProcessingError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Document processing failed: {e.message}"
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process document: {str(e)}"
        )


@router.get("/stats")
async def get_document_statistics(
    service: DocumentServiceInterface = Depends(get_document_service)
):
    """Get document processing statistics."""
    try:
        stats = service.get_document_statistics()
        return {"success": True, "statistics": stats}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get statistics"
        )


@router.get("/", response_model=List[DocumentMetadata])
async def list_documents(
    status_filter: Optional[DocumentStatus] = Query(None, alias="status", description="Filter by document status"),
    type_filter: Optional[DocumentType] = Query(None, alias="type", description="Filter by document type"),
    limit: int = Query(50, ge=1, le=100, description="Number of documents to return"),
    offset: int = Query(0, ge=0, description="Number of documents to skip"),
    service: DocumentServiceInterface = Depends(get_document_service)
) -> List[DocumentMetadata]:
    """
    List documents with optional filtering.
    
    - **status**: Filter by document processing status
    - **type**: Filter by document type
    - **limit**: Maximum number of documents to return (1-100)
    - **offset**: Number of documents to skip for pagination
    
    Returns list of document metadata matching the filters.
    """
    try:
        documents = await service.get_documents(
            status=status_filter,
            document_type=type_filter,
            limit=limit,
            offset=offset
        )
        return documents
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list documents"
        )


@router.get("/{document_id}", response_model=DocumentMetadata)
async def get_document(
    document_id: UUID,
    service: DocumentServiceInterface = Depends(get_document_service)
) -> DocumentMetadata:
    """
    Retrieve document metadata by ID.
    
    - **document_id**: UUID of the document
    
    Returns document metadata including processing status and results.
    """
    document = await service.get_document(document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    return document


@router.get("/{document_id}/content")
async def get_document_content(
    document_id: UUID,
    service: DocumentServiceInterface = Depends(get_document_service)
) -> JSONResponse:
    """
    Get processed document content.
    
    - **document_id**: UUID of the document
    
    Returns the extracted and processed document content in JSON format.
    """
    try:
        document = await service.get_document(document_id)
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        content = await service.get_document_content(document_id)
        if content is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document content not available. Document may not be processed yet."
            )
        
        return JSONResponse(content={
            "document_id": str(document_id),
            "content": content,
            "content_length": len(content),
            "success": True
        })
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get document content"
        )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    service: DocumentServiceInterface = Depends(get_document_service)
):
    """
    Delete a document and its associated data.
    
    - **document_id**: UUID of the document to delete
    
    Returns 204 No Content on successful deletion.
    """
    try:
        success = await service.delete_document(document_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document"
        )