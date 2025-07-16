"""Criteria extraction service using Instructor and Azure OpenAI."""

import logging
import instructor
from openai import AzureOpenAI
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from uuid import UUID
import re

from app.core.config import get_settings
from app.models.criteria import (
    CriteriaExtraction, 
    Criterion, 
    CriteriaCategory, 
    CriteriaPriority
)
from app.core.exceptions import CriteriaExtractionError

logger = logging.getLogger(__name__)


class ExtractedCriterion(BaseModel):
    """Model for individual extracted criterion using Instructor."""
    criterion_text: str = Field(..., description="The exact requirement or criterion text")
    category: str = Field(..., description="Category classification for the criterion")
    priority: str = Field(..., description="Priority level: critical, high, medium, or low")
    keywords: List[str] = Field(..., description="Key terms and concepts from the criterion")
    requirements: List[str] = Field(..., description="Specific requirements or conditions")
    source_reference: str = Field(..., description="Reference to source location in document")


class CriteriaExtractionResult(BaseModel):
    """Model for complete criteria extraction result."""
    criteria: List[ExtractedCriterion] = Field(..., description="List of extracted criteria")
    total_found: int = Field(..., description="Total number of criteria found")
    confidence_score: float = Field(..., description="Overall confidence in extraction", ge=0.0, le=1.0)


class CriteriaCategorization(BaseModel):
    """Model for criteria categorization result."""
    categorized_criteria: Dict[str, List[str]] = Field(
        ..., 
        description="Criteria organized into exactly 6 categories"
    )
    category_descriptions: Dict[str, str] = Field(
        ...,
        description="Description of what each category contains"
    )


class CriteriaExtractionService:
    """Service for extracting and categorizing criteria using Instructor and Azure OpenAI."""
    
    def __init__(self):
        """Initialize the criteria extraction service."""
        self.settings = get_settings()
        self.client = None
        
        if (self.settings.AZURE_OPENAI_ENDPOINT and 
            self.settings.AZURE_OPENAI_API_KEY and 
            self.settings.AZURE_OPENAI_DEPLOYMENT_NAME):
            try:
                # Initialize Azure OpenAI client with Instructor
                client = AzureOpenAI(
                    azure_endpoint=self.settings.AZURE_OPENAI_ENDPOINT,
                    api_key=self.settings.AZURE_OPENAI_API_KEY,
                    api_version=self.settings.AZURE_OPENAI_API_VERSION
                )
                self.client = instructor.from_openai(client)
                logger.info("Azure OpenAI criteria extraction service initialized successfully")
            except Exception as e:
                import traceback
                traceback.print_exc()
                logger.warning(f"Failed to initialize Azure OpenAI client: {e}")
                self.client = None
        else:
            logger.warning("Azure OpenAI credentials not configured")
    
    async def extract_criteria_from_content(
        self, 
        content: str, 
        document_id: UUID,
        max_criteria: int = None
    ) -> List[CriteriaExtraction]:
        """
        Extract criteria from document content using Instructor.
        
        Args:
            content: Document content in markdown format
            document_id: UUID of the source document
            max_criteria: Maximum number of criteria to extract
            
        Returns:
            List of extracted criteria
            
        Raises:
            CriteriaExtractionError: If extraction fails
        """
        if not self.client:
            logger.warning("Criteria extraction service not available, using fallback method")
            return await self._fallback_criteria_extraction(content, document_id, max_criteria)
        
        try:
            logger.info(f"Extracting criteria from content ({len(content)} characters)")
            
            # Set max criteria if not provided
            if max_criteria is None:
                max_criteria = self.settings.MAX_CRITERIA_PER_DOCUMENT
            
            # Process content in semantic chunks to avoid token limits
            # Target chunk size: ~40k characters (~10k tokens)
            chunk_size = 40000
            
            if len(content) <= chunk_size:
                # Process as single chunk
                return await self._extract_criteria_from_chunk(content, document_id, max_criteria, 1, 1)
            else:
                # Process in multiple chunks
                chunks = self._split_content_semantically(content, chunk_size)
                logger.info(f"Processing content in {len(chunks)} semantic chunks")
                
                all_extractions = []
                for i, chunk in enumerate(chunks):
                    chunk_extractions = await self._extract_criteria_from_chunk(
                        chunk, document_id, max_criteria, i + 1, len(chunks)
                    )
                    all_extractions.extend(chunk_extractions)
                    
                    # Respect max criteria limit across all chunks
                    if len(all_extractions) >= max_criteria:
                        all_extractions = all_extractions[:max_criteria]
                        break
                
                logger.info(f"Successfully extracted {len(all_extractions)} criteria from {len(chunks)} chunks")
                return all_extractions
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Error extracting criteria: {e}")
            logger.info("Attempting fallback criteria extraction...")
            return await self._fallback_criteria_extraction(content, document_id, max_criteria)
    
    def _split_content_semantically(self, content: str, chunk_size: int) -> List[str]:
        """
        Split content into semantic chunks based on markdown structure.
        
        Args:
            content: Full document content
            chunk_size: Target size for each chunk
            
        Returns:
            List of content chunks
        """
        chunks = []
        current_chunk = ""
        
        # Split by markdown sections (headers)
        sections = re.split(r'(^#{1,6}\s+.*$)', content, flags=re.MULTILINE)
        
        for section in sections:
            if not section.strip():
                continue
                
            # If adding this section would exceed chunk size, start new chunk
            if len(current_chunk) + len(section) > chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = section
            else:
                current_chunk += "\n" + section if current_chunk else section
        
        # Add the last chunk
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        # If we still have chunks that are too large, split by paragraphs
        final_chunks = []
        for chunk in chunks:
            if len(chunk) <= chunk_size:
                final_chunks.append(chunk)
            else:
                # Split large chunk by paragraphs
                paragraphs = chunk.split('\n\n')
                sub_chunk = ""
                
                for paragraph in paragraphs:
                    if len(sub_chunk) + len(paragraph) > chunk_size and sub_chunk:
                        final_chunks.append(sub_chunk.strip())
                        sub_chunk = paragraph
                    else:
                        sub_chunk += "\n\n" + paragraph if sub_chunk else paragraph
                
                if sub_chunk.strip():
                    final_chunks.append(sub_chunk.strip())
        
        logger.info(f"Split content into {len(final_chunks)} semantic chunks")
        return final_chunks
    
    async def _extract_criteria_from_chunk(
        self, 
        chunk: str, 
        document_id: UUID, 
        max_criteria: int,
        chunk_number: int,
        total_chunks: int
    ) -> List[CriteriaExtraction]:
        """
        Extract criteria from a single content chunk.
        
        Args:
            chunk: Content chunk to process
            document_id: UUID of the source document
            max_criteria: Maximum criteria to extract
            chunk_number: Current chunk number
            total_chunks: Total number of chunks
            
        Returns:
            List of extracted criteria from this chunk
        """
        try:
            logger.info(f"Processing chunk {chunk_number}/{total_chunks} ({len(chunk)} characters)")
            
            extraction_prompt = f"""
            Analyze this document chunk and extract ALL requirements, criteria, specifications, and evaluation points.
            This document may be in German, English, or other languages.
            Provide the exact text as found in the document.
            Include the internal ID of the criteria in the criteria_id field. 
            
            Chunk {chunk_number} of {total_chunks}:
            
            {chunk}
            """
            
            result = self.client.chat.completions.create(
                model=self.settings.AZURE_OPENAI_DEPLOYMENT_NAME,
                response_model=CriteriaExtractionResult,
                messages=[
                    {
                        "role": "system", 
                        "content": """You are an expert at analyzing procurement documents (RFPs, RFQs, tenders) and extracting requirements and criteria. 
                        You work with documents in multiple languages including German, English, French, and others.
                        Extract ALL requirements in exactly the structure given (same granularity as in the document)."""
                    },
                    {"role": "user", "content": extraction_prompt}
                ],
                max_tokens=16384,
                temperature=0.1
            )
            
            # Convert to internal models
            extractions = []
            for i, criterion in enumerate(result.criteria):
                extraction = CriteriaExtraction(
                    document_id=document_id,
                    raw_text=criterion.criterion_text,
                    processed_text=criterion.criterion_text.strip(),
                    page_number=None,  
                    section_title=f"Chunk {chunk_number}",
                    extraction_confidence=result.confidence_score
                )
                extractions.append(extraction)
            
            logger.info(f"Chunk {chunk_number}: extracted {len(extractions)} criteria")
            return extractions
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Error extracting criteria from chunk {chunk_number}: {e}")
            return []
    
    async def _fallback_criteria_extraction(
        self, 
        content: str, 
        document_id: UUID,
        max_criteria: int = None
    ) -> List[CriteriaExtraction]:
        """
        Enhanced fallback method for criteria extraction when OpenAI is not available.
        """
        try:
            logger.info("Using enhanced fallback criteria extraction method")
            
            if max_criteria is None:
                max_criteria = self.settings.MAX_CRITERIA_PER_DOCUMENT
            
            # Enhanced keyword patterns for multiple languages
            criteria_patterns = [
                # German patterns
                r'.*\bmuss\b.*',
                r'.*\bsoll\b.*', 
                r'.*\bsollte\b.*',
                r'.*\bAnforderung\b.*',
                r'.*\bSpezifikation\b.*',
                r'.*\bKriterium\b.*',
                r'.*\bVoraussetzung\b.*',
                r'.*\berforderlich\b.*',
                r'.*\bobligatorisch\b.*',
                r'.*\bzwingend\b.*',
                
                # English patterns
                r'.*\bmust\b.*',
                r'.*\bshall\b.*',
                r'.*\bshould\b.*',
                r'.*\brequirement\b.*',
                r'.*\brequired\b.*',
                r'.*\bmandatory\b.*',
                r'.*\bspecification\b.*',
                r'.*\bcriteria\b.*',
                r'.*\bcriterion\b.*',
                r'.*\bstandard\b.*',
                r'.*\bcompliance\b.*',
                r'.*\bminimum\b.*',
                r'.*\bmaximum\b.*',
                r'.*\bthreshold\b.*'
            ]
            
            lines = content.split('\n')
            extracted_criteria = []
            
            for i, line in enumerate(lines):
                line = line.strip()
                if len(line) < 15:  # Skip very short lines
                    continue
                
                # Check if line matches any criteria pattern
                line_lower = line.lower()
                if any(re.match(pattern, line_lower, re.IGNORECASE) for pattern in criteria_patterns):
                    extraction = CriteriaExtraction(
                        document_id=document_id,
                        raw_text=line,
                        processed_text=line.strip(),
                        page_number=None,
                        section_title="Fallback extraction",
                        extraction_confidence=0.6  # Moderate confidence for enhanced fallback
                    )
                    extracted_criteria.append(extraction)
                    
                    if len(extracted_criteria) >= max_criteria:
                        break
            
            logger.info(f"Enhanced fallback extraction found {len(extracted_criteria)} potential criteria")
            return extracted_criteria
            
        except Exception as e:
            logger.error(f"Fallback criteria extraction failed: {e}")
            raise CriteriaExtractionError(f"All criteria extraction methods failed: {str(e)}")
    
    async def categorize_criteria(self, criteria_texts: List[str]) -> Dict[str, List[str]]:
        """
        Categorize criteria into exactly 6 predefined categories.
        
        Args:
            criteria_texts: List of criteria text to categorize
            
        Returns:
            Dictionary mapping categories to lists of criteria
            
        Raises:
            CriteriaExtractionError: If categorization fails
        """
        if not self.client:
            raise CriteriaExtractionError(
                "Criteria categorization service not available. Please configure Azure OpenAI credentials."
            )
        
        try:
            logger.info(f"Categorizing {len(criteria_texts)} criteria into 6 categories")
            
            categories = self.settings.CRITERIA_CATEGORIES
            
            categorization_prompt = f"""
            Categorize the following criteria into exactly these 6 categories:
            
            1. Technical Requirements - System architecture, technology stack, technical specifications
            2. Security & Compliance - Security measures, regulatory compliance, data protection
            3. Performance & Scalability - Performance metrics, scalability requirements, capacity
            4. Integration & Compatibility - System integration, compatibility, interoperability
            5. Support & Maintenance - Support services, maintenance requirements, SLAs
            6. Commercial & Legal - Pricing, contracts, legal terms, commercial conditions
            
            Each criterion must be assigned to exactly one category. Provide descriptions for each category.
            
            Criteria to categorize:
            {chr(10).join([f"{i+1}. {text}" for i, text in enumerate(criteria_texts)])}
            """
            
            result = self.client.chat.completions.create(
                model=self.settings.AZURE_OPENAI_DEPLOYMENT_NAME,
                response_model=CriteriaCategorization,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert at categorizing RFP criteria. Assign each criterion to exactly one of the 6 specified categories."
                    },
                    {"role": "user", "content": categorization_prompt}
                ],
                max_tokens=2048,
                temperature=0.1
            )
            
            logger.info("Successfully categorized criteria")
            return result.categorized_criteria
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Error categorizing criteria: {e}")
            raise CriteriaExtractionError(f"Failed to categorize criteria: {str(e)}")
    
    async def process_extractions_to_criteria(
        self, 
        extractions: List[CriteriaExtraction]
    ) -> List[Criterion]:
        """
        Convert raw extractions to structured criteria.
        
        Args:
            extractions: List of raw criteria extractions
            
        Returns:
            List of structured criteria
        """
        criteria = []
        
        for extraction in extractions:
            # Enhanced category mapping based on content analysis
            category = self._determine_category_from_text(extraction.processed_text)
            priority = self._determine_priority_from_text(extraction.processed_text)
            keywords = self._extract_keywords_from_text(extraction.processed_text)
            requirements = self._extract_requirements_from_text(extraction.processed_text)
            
            criterion = Criterion(
                extraction_id=extraction.id,
                criterion_text=extraction.processed_text,
                category=category,
                priority=priority,
                source_reference=f"Document {extraction.document_id}",
                keywords=keywords,
                requirements=requirements
            )
            criteria.append(criterion)
        
        return criteria
    
    def _determine_category_from_text(self, text: str) -> CriteriaCategory:
        """Determine category based on text content analysis."""
        text_lower = text.lower()
        
        # Enhanced category keywords mapping
        category_keywords = {
            CriteriaCategory.TECHNICAL: [
                'technical', 'system', 'technology', 'architecture', 'platform',
                'software', 'hardware', 'infrastructure', 'network', 'database',
                'api', 'interface', 'protocol', 'standard', 'specification'
            ],
            CriteriaCategory.SECURITY: [
                'security', 'secure', 'encryption', 'authentication', 'authorization',
                'compliance', 'gdpr', 'privacy', 'audit', 'vulnerability',
                'firewall', 'access control', 'certificate', 'ssl', 'tls'
            ],
            CriteriaCategory.PERFORMANCE: [
                'performance', 'speed', 'latency', 'throughput', 'scalability',
                'capacity', 'load', 'response time', 'availability', 'uptime',
                'reliability', 'efficiency', 'optimization', 'bandwidth'
            ],
            CriteriaCategory.SUPPORT: [
                'support', 'maintenance', 'service', 'help', 'assistance',
                'documentation', 'training', 'backup', 'recovery', 'monitoring',
                'troubleshooting', 'ticket', 'sla', 'response time'
            ],
            CriteriaCategory.INTEGRATION: [
                'integration', 'interface', 'compatibility', 'interoperability',
                'connect', 'sync', 'import', 'export', 'migration',
                'third-party', 'plugin', 'connector', 'webhook'
            ],
            CriteriaCategory.FINANCIAL: [
                'cost', 'price', 'pricing', 'budget', 'financial', 'commercial',
                'license', 'subscription', 'payment', 'billing', 'invoice',
                'contract', 'terms', 'conditions', 'warranty'
            ]
        }
        
        # Score each category based on keyword matches
        category_scores = {}
        for category, keywords in category_keywords.items():
            score = sum(1 for keyword in keywords if keyword in text_lower)
            if score > 0:
                category_scores[category] = score
        
        # Return the category with the highest score
        if category_scores:
            return max(category_scores, key=category_scores.get)
        
        return CriteriaCategory.OTHER
    
    def _determine_priority_from_text(self, text: str) -> CriteriaPriority:
        """Determine priority based on text content."""
        text_lower = text.lower()
        
        # Critical priority indicators
        if any(word in text_lower for word in [
            'critical', 'mandatory', 'required', 'must', 'shall', 'essential',
            'vital', 'crucial', 'obligatory', 'zwingend', 'erforderlich'
        ]):
            return CriteriaPriority.CRITICAL
        
        # High priority indicators
        if any(word in text_lower for word in [
            'important', 'high', 'priority', 'significant', 'key', 'major',
            'should', 'soll', 'wichtig'
        ]):
            return CriteriaPriority.HIGH
        
        # Low priority indicators
        if any(word in text_lower for word in [
            'optional', 'nice to have', 'preferred', 'desirable', 'minor',
            'could', 'might', 'wünschenswert', 'optional'
        ]):
            return CriteriaPriority.LOW
        
        return CriteriaPriority.MEDIUM
    
    def _extract_keywords_from_text(self, text: str) -> List[str]:
        """Extract key terms from the criterion text."""
        # Simple keyword extraction - in production, use more sophisticated NLP
        import re
        
        # Remove common stop words and extract meaningful terms
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'}
        words = re.findall(r'\b\w+\b', text.lower())
        keywords = [word for word in words if len(word) > 3 and word not in stop_words]
        
        # Return unique keywords, limited to top 10
        return list(set(keywords))[:10]
    
    def _extract_requirements_from_text(self, text: str) -> List[str]:
        """Extract specific requirements from the text."""
        requirements = []
        
        # Look for numeric requirements
        import re
        numeric_patterns = [
            r'\d+%',  # Percentages
            r'\d+\s*(hour|minute|second|day|month|year)s?',  # Time periods
            r'\d+\s*(gb|mb|kb|tb)',  # Storage amounts
            r'\d+\s*(user|concurrent|simultaneous)',  # User counts
        ]
        
        for pattern in numeric_patterns:
            matches = re.findall(pattern, text.lower())
            requirements.extend(matches)
        
        return requirements[:5]  # Limit to 5 requirements
