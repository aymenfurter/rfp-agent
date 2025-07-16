"""Service for summarizing document content."""

import logging
import re
from typing import List
import instructor
from openai import AzureOpenAI
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.exceptions import RFPAgentException

logger = logging.getLogger(__name__)


class SummaryResult(BaseModel):
    """Model for summarization result."""
    summary: str = Field(..., description="The concise summary of the provided text.")


class SummarizationService:
    """Service for creating document summaries using a map-reduce approach."""

    def __init__(self):
        """Initialize the summarization service."""
        self.settings = get_settings()
        self.client = None
        
        if (self.settings.AZURE_OPENAI_ENDPOINT and 
            self.settings.AZURE_OPENAI_API_KEY and 
            self.settings.AZURE_OPENAI_DEPLOYMENT_NAME):
            try:
                client = AzureOpenAI(
                    azure_endpoint=self.settings.AZURE_OPENAI_ENDPOINT,
                    api_key=self.settings.AZURE_OPENAI_API_KEY,
                    api_version=self.settings.AZURE_OPENAI_API_VERSION
                )
                self.client = instructor.from_openai(client)
                logger.info("Summarization service initialized successfully")
            except Exception as e:
                logger.warning(f"Failed to initialize Azure OpenAI client for summarization: {e}")
                self.client = None
        else:
            logger.warning("Azure OpenAI credentials not configured for summarization.")

    def _split_content_semantically(self, content: str, chunk_size: int) -> List[str]:
        """Splits content into semantic chunks."""
        chunks = []
        current_chunk = ""
        sections = re.split(r'(^#{1,6}\s+.*$)', content, flags=re.MULTILINE)
        
        for section in sections:
            if not section.strip():
                continue
            if len(current_chunk) + len(section) > chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = section
            else:
                current_chunk += "\n" + section if current_chunk else section
        
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        return chunks

    async def summarize_content(self, content: str) -> str:
        """
        Summarize content using a map-reduce strategy.
        
        Args:
            content: The document content to summarize.
            
        Returns:
            A concise summary of the content.
        """
        if not self.client:
            raise RFPAgentException("Summarization service is not available.")

        # Map step: Summarize each chunk
        chunk_size = 40000  # ~10k tokens
        chunks = self._split_content_semantically(content, chunk_size)
        
        summaries = []
        for chunk in chunks:
            prompt = f"Summarize the key information, requirements, and objectives from this document chunk:\n\n{chunk}"
            try:
                response = self.client.chat.completions.create(
                    model=self.settings.AZURE_OPENAI_DEPLOYMENT_NAME,
                    response_model=SummaryResult,
                    messages=[
                        {"role": "system", "content": "You are an expert at summarizing technical and procurement documents."},
                        {"role": "user", "content": prompt}
                    ]
                )
                summaries.append(response.summary)
            except Exception as e:
                logger.error(f"Failed to summarize a chunk: {e}")
        
        if not summaries:
            return "Could not generate a summary."

        # Reduce step: Combine summaries
        if len(summaries) == 1:
            return summaries[0]
        
        combined_summaries = "\n\n".join(summaries)
        final_prompt = f"Create a single, coherent summary from the following chunk summaries:\n\n{combined_summaries}"
        
        try:
            final_response = self.client.chat.completions.create(
                model=self.settings.AZURE_OPENAI_DEPLOYMENT_NAME,
                response_model=SummaryResult,
                messages=[
                    {"role": "system", "content": "You are an expert at synthesizing multiple summaries into a final, comprehensive summary."},
                    {"role": "user", "content": final_prompt}
                ]
            )
            return final_response.summary
        except Exception as e:
            logger.error(f"Failed to create final summary: {e}")
            return "Failed to consolidate summary."