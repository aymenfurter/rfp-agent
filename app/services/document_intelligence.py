"""Azure Document Intelligence service for document processing."""

import logging
from typing import Optional, Dict, Any
from pathlib import Path
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import HttpResponseError
import instructor
from openai import AzureOpenAI
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.exceptions import DocumentProcessingError

logger = logging.getLogger(__name__)


class DocumentClassificationResult(BaseModel):
    """Structured result for document classification."""
    document_type: str = Field(..., description="The specific document type classification")
    confidence: float = Field(..., description="Confidence score between 0.0 and 1.0", ge=0.0, le=1.0)
    contains_criteria: bool = Field(..., description="Whether the document contains extractable criteria")
    reasoning: str = Field(..., description="Brief explanation of the classification decision")


class DocumentIntelligenceService:
    """Service for processing documents with Azure Document Intelligence."""
    
    def __init__(self):
        """Initialize the Document Intelligence service."""
        self.settings = get_settings()
        self.client = None
        self.llm_client = None
        
        # Initialize Document Intelligence client
        if self.settings.AZURE_DOC_INTELLIGENCE_ENDPOINT and self.settings.AZURE_DOC_INTELLIGENCE_KEY:
            try:
                self.client = DocumentIntelligenceClient(
                    endpoint=self.settings.AZURE_DOC_INTELLIGENCE_ENDPOINT,
                    credential=AzureKeyCredential(self.settings.AZURE_DOC_INTELLIGENCE_KEY)
                )
                logger.info("Document Intelligence client initialized successfully")
            except Exception as e:
                import traceback
                traceback.print_exc()
                logger.error(f"Failed to initialize Document Intelligence client: {e}")
                raise DocumentProcessingError(f"Document Intelligence initialization failed: {str(e)}")
        else:
            logger.error("Document Intelligence credentials not configured")
            raise DocumentProcessingError("Document Intelligence credentials not configured")
        
        # Initialize LLM client for classification
        if (self.settings.AZURE_OPENAI_ENDPOINT and 
            self.settings.AZURE_OPENAI_API_KEY and 
            self.settings.AZURE_OPENAI_DEPLOYMENT_NAME):
            try:
                azure_client = AzureOpenAI(
                    azure_endpoint=self.settings.AZURE_OPENAI_ENDPOINT,
                    api_key=self.settings.AZURE_OPENAI_API_KEY,
                    api_version=self.settings.AZURE_OPENAI_API_VERSION
                )
                self.llm_client = instructor.from_openai(azure_client)
                logger.info("LLM client for classification initialized successfully")
            except Exception as e:
                logger.warning(f"Failed to initialize LLM client for classification: {e}")
                self.llm_client = None
        else:
            logger.warning("Azure OpenAI credentials not configured for classification")
    
    async def extract_markdown_from_pdf(self, file_path: str) -> str:
        """
        Extract markdown content from PDF using Azure Document Intelligence.
        
        Args:
            file_path: Path to the PDF file
            
        Returns:
            Extracted content in markdown format
            
        Raises:
            DocumentProcessingError: If processing fails
        """
        if not self.client:
            raise DocumentProcessingError("Document Intelligence client not available")
        
        try:
            logger.info(f"Processing PDF with Document Intelligence: {file_path}")
            
            # Read file content
            with open(file_path, "rb") as file:
                file_content = file.read()
            
            logger.info(f"File size: {len(file_content)} bytes")
            
            # Analyze document using layout model for markdown output
            poller = self.client.begin_analyze_document(
                model_id="prebuilt-layout",
                body=file_content,
                content_type="application/pdf",
                output_content_format="markdown"
            )
            
            logger.info("Document analysis started, waiting for completion...")
            result = poller.result()
            
            if result.content:
                logger.info(f"Successfully extracted {len(result.content)} characters from PDF")
                return result.content
            else:
                raise DocumentProcessingError("No content extracted from Document Intelligence")
                
        except HttpResponseError as e:
            logger.error(f"Azure Document Intelligence API error: {e}")
            raise DocumentProcessingError(f"Document Intelligence API error: {str(e)}")
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Error processing PDF with Document Intelligence: {e}")
            raise DocumentProcessingError(f"PDF processing failed: {str(e)}")
    
    async def classify_document_type(self, content: str, first_pages_only: bool = True) -> Dict[str, Any]:
        """
        Classify document type based on content analysis using LLM.
        
        Args:
            content: Document content to analyze
            first_pages_only: Whether to analyze only first 3 pages worth of content
            
        Returns:
            Classification result with document type and confidence
        """
        try:
            # Truncate to first ~3 pages of content (approximately 3000 chars per page)
            if first_pages_only:
                analysis_content = content[:9000]  # ~3 pages
            else:
                analysis_content = content
            
            # Use LLM-based classification
            if self.llm_client:
                return await self._llm_classify_document(analysis_content)
            else:
                # If LLM is not available, return default classification
                logger.error("LLM not available for classification")
                return {
                    "document_type": "OTHER", 
                    "confidence": 0.0,
                    "contains_criteria": False,
                    "reasoning": "LLM classification service not available"
                }
                
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Error classifying document: {e}")
            return {
                "document_type": "OTHER", 
                "confidence": 0.0,
                "contains_criteria": False,
                "reasoning": f"Classification failed: {str(e)}"
            }
    
    async def _llm_classify_document(self, content: str) -> Dict[str, Any]:
        """
        Classify document using LLM with structured output.
        
        Args:
            content: Document content to classify
            
        Returns:
            Structured classification result
        """
        try:
            classification_prompt = f"""
            Analyze the following document content and classify it into one of these specific procurement document types:

            **Primary Types:**
            - "Request for Proposal" - RFP documents soliciting vendor proposals
            - "Technical Requirements" - Technical specifications and system requirements
            - "Scope of Work" - Project scope and work breakdown documents
            - "Statement of Work" - Detailed work statements and deliverables
            - "Vendor Requirements" - Vendor qualification and capability requirements
            - "System Requirements" - System functional and non-functional requirements
            - "Functional Requirements" - Business and user functional requirements
            - "Technical Specifications" - Detailed technical specifications
            - "Procurement Requirements" - Procurement process and commercial requirements
            - "Bid Requirements" - Bidding process and submission requirements
            - "Project Requirements" - Overall project requirements and constraints
            - "RFP Addendum" - Addendums, amendments, or clarifications to RFPs
            - "Amendment" - Document amendments or modifications

            **Criteria Detection:**
            Determine if the document contains extractable criteria by looking for:
            - Requirements statements (must, shall, should, required, mandatory)
            - Evaluation criteria or scoring rubrics
            - Technical specifications with measurable parameters
            - Compliance requirements
            - Performance standards or thresholds

            **Document Content:**
            {content}

            Provide your classification with high confidence if the document clearly fits a category, 
            or lower confidence if it's ambiguous. Explain your reasoning briefly.
            """

            result = self.llm_client.chat.completions.create(
                model=self.settings.AZURE_OPENAI_DEPLOYMENT_NAME,
                response_model=DocumentClassificationResult,
                messages=[
                    {
                        "role": "system", 
                        "content": "You are an expert document classifier specializing in procurement and RFP documents. Analyze the content carefully and provide accurate classification with appropriate confidence levels."
                    },
                    {"role": "user", "content": classification_prompt}
                ],
                max_tokens=1000,
                temperature=0.1  # Low temperature for consistent classification
            )

            logger.info(f"LLM classified document as: {result.document_type} (confidence: {result.confidence:.2f})")
            
            return {
                "document_type": result.document_type,
                "confidence": result.confidence,
                "contains_criteria": result.contains_criteria,
                "reasoning": result.reasoning
            }

        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"LLM classification failed: {e}")
            raise DocumentProcessingError(f"Document classification failed: {str(e)}")