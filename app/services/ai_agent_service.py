"""Service for interacting with Azure AI Agent Service."""

import logging
import os
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
import instructor

from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential
from azure.ai.agents.models import (
    DeepResearchTool,
    BingGroundingTool,
    MessageRole
)
from openai import AzureOpenAI

from app.core.config import get_settings
from app.core.exceptions import ConfigurationError, RFPAgentException

logger = logging.getLogger(__name__)


class AgentValidationResult(BaseModel):
    """Structured output for agent validation."""
    is_met: bool = Field(..., description="Whether the criterion is met by the product/service.")
    summary: str = Field(..., description="A concise summary of the validation findings.")
    references: List[Dict[str, str]] = Field(
        default_factory=list,
        description="List of source references used for validation, with title and URL."
    )


class AIAgentService:
    """Service for managing Azure AI Agents."""

    def __init__(self):
        """Initialize the AI Agent Service."""
        self.settings = get_settings()
        self.project_client: Optional[AIProjectClient] = None
        self.agents_client = None
        self.instructor_client: Optional[instructor.Instructor] = None
        self.agent_id: Optional[str] = None
        self.deep_research_agent_id: Optional[str] = None

        # Check for proper configuration
        if not self.settings.AZURE_AI_AGENT_ENDPOINT:
            logger.warning("AZURE_AI_AGENT_ENDPOINT is not configured. AI Agent Service will not be available.")
            return

        try:
            self.project_client = AIProjectClient(
                endpoint=self.settings.AZURE_AI_AGENT_ENDPOINT,
                credential=DefaultAzureCredential(),
            )
            self.agents_client = self.project_client.agents

            # Instructor client for structured output
            if self.settings.AZURE_OPENAI_ENDPOINT and self.settings.AZURE_OPENAI_API_KEY:
                azure_client = AzureOpenAI(
                    azure_endpoint=self.settings.AZURE_OPENAI_ENDPOINT,
                    api_key=self.settings.AZURE_OPENAI_API_KEY,
                    api_version=self.settings.AZURE_OPENAI_API_VERSION
                )
                self.instructor_client = instructor.from_openai(azure_client)

            logger.info("AI Agent Service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize AIProjectClient: {e}")
            self.project_client = None
            self.agents_client = None

    async def initialize_agents(self):
        """Create and initialize the required agents on startup."""
        if not self.agents_client or not self.settings.BING_CONNECTION_NAME:
            logger.warning("Cannot initialize agents - missing configuration")
            return

        try:
            # Initialize standard agent with Bing Grounding
            self.agent_id = await self._create_agent(use_deep_research=False)
            logger.info(f"Standard agent initialized with ID: {self.agent_id}")

            # Initialize agent with Deep Research if configured
            if self.settings.DEEP_RESEARCH_MODEL_DEPLOYMENT_NAME:
                self.deep_research_agent_id = await self._create_agent(use_deep_research=True)
                logger.info(f"Deep Research agent initialized with ID: {self.deep_research_agent_id}")
        except Exception as e:
            logger.error(f"Failed to initialize agents: {e}")

    async def _create_agent(self, use_deep_research: bool) -> str:
        """Helper to create an agent."""
        if not self.agents_client or not self.project_client:
            raise RFPAgentException("Agent client not initialized.")

        try:
            conn_id = self.project_client.connections.get(name=self.settings.BING_CONNECTION_NAME).id
            
            if use_deep_research:
                tool = DeepResearchTool(
                    bing_grounding_connection_id=conn_id,
                    deep_research_model=self.settings.DEEP_RESEARCH_MODEL_DEPLOYMENT_NAME,
                )
                agent_name = "rfp-deep-research-agent"
            else:
                tool = BingGroundingTool(connection_id=conn_id)
                agent_name = "rfp-bing-agent"

            agent = self.agents_client.create_agent(
                model=self.settings.AZURE_AI_AGENT_MODEL_DEPLOYMENT_NAME or self.settings.AZURE_OPENAI_DEPLOYMENT_NAME,
                name=agent_name,
                instructions="You are an expert RFP analyst. Your task is to validate if a given criterion is met by a specified product/service, based on the provided document summary and web research. Provide a clear 'yes' or 'no' answer, a justification, and cite your sources. YOU MUST ALWAYS PROVIDE FULL URLs TO YOUR SOURCES",
                tools=tool.definitions,
            )
            return agent.id
        except Exception as e:
            logger.error(f"Error creating agent: {e}")
            raise RFPAgentException(f"Failed to create agent: {str(e)}")

    async def validate_criterion(
        self,
        product_name: str,
        document_summary: str,
        criterion_text: str,
        use_deep_research: bool = False
    ) -> AgentValidationResult:
        """Validate a single criterion using an AI agent."""

        if not self.instructor_client:
            raise RFPAgentException("Instructor client not initialized - Azure OpenAI credentials must be configured.")

        try:
            # Get appropriate agent, create if needed
            agent_id = await self._get_or_create_agent(use_deep_research)

            prompt = f"""
Product/Service to validate: {product_name}

Summary of RFP documents (Only for context, do not use this as the main source):
---
{document_summary}
---

Criterion to assess: "{criterion_text}"

Based on the provided summary and your web research, determine if the product/service meets this criterion.
Explain your reasoning and provide sources.
            """

            print("=== Agent Prompt ===")
            print (prompt)

            # Create thread and add message
            thread = self.agents_client.threads.create()
            
            # Use correct API pattern for creating messages
            message = self.agents_client.messages.create(
                thread_id=thread.id,
                role=MessageRole.USER,
                content=prompt
            )
            
            # Create and process the run
            run = self.agents_client.runs.create_and_process(
                thread_id=thread.id, 
                agent_id=agent_id
            )

            if run.status != "completed":
                error_message = run.last_error.message if run.last_error else "Unknown error"
                logger.warning(f"Agent run failed with status {run.status}: {error_message}")

            # Get the agent response from thread messages
            agent_response = self._extract_agent_response(thread.id)
            
            print ("=== Agent Response ===")
            print (agent_response)

            # Use instructor to get structured output
            structured_result = self.instructor_client.chat.completions.create(
                model=self.settings.AZURE_OPENAI_DEPLOYMENT_NAME,
                response_model=AgentValidationResult,
                messages=[
                    {"role": "system", "content": "You are a summarization expert. Extract the final decision, summary, and references from the agent's response. Please include all references (full URL as provided). ONLY RETURN A SINGLE OBJECT."},
                    {"role": "user", "content": f"Agent conversation:\n{agent_response}"}
                ]
            )
            
                
            logger.info(f"Agent validation successful for: {criterion_text[:50]}...")
            return structured_result
            
        except Exception as e:
            logger.warning(f"Agent validation failed, falling back to Azure OpenAI: {e}")


    async def _get_or_create_agent(self, use_deep_research: bool) -> str:
        """Get existing agent or create new one if needed."""
        agent_id = self.deep_research_agent_id if use_deep_research and self.deep_research_agent_id else self.agent_id
        
        if not agent_id:
            # Try to create agent on-demand
            agent_id = await self._create_agent(use_deep_research)
            if use_deep_research:
                self.deep_research_agent_id = agent_id
            else:
                self.agent_id = agent_id
        
        return agent_id

    async def cleanup_agents(self):
        """Delete agents created by this service."""
        if not self.agents_client:
            return
        try:
            if self.agent_id:
                self.agents_client.delete_agent(self.agent_id)
                logger.info(f"Deleted agent {self.agent_id}")
            if self.deep_research_agent_id:
                self.agents_client.delete_agent(self.deep_research_agent_id)
                logger.info(f"Deleted agent {self.deep_research_agent_id}")
        except Exception as e:
            logger.error(f"Error cleaning up agents: {e}")

    def _extract_agent_response(self, thread_id: str) -> str:
        """Extract the agent's response from thread messages."""
        try:
            # Get all messages from the thread
            messages = self.agents_client.messages.list(thread_id=thread_id)
            
            # Collect all conversation messages
            conversation_parts = []
            
            for message in messages:
                # Use string comparison for message role instead of enum
                role_str = str(message.role).lower() if hasattr(message, 'role') else 'unknown'
                
                # Extract message content
                message_content = ""
                if hasattr(message, 'content') and message.content:
                    # Handle content array
                    content_parts = []
                    for content_item in message.content:
                        if hasattr(content_item, 'text') and content_item.text:
                            if hasattr(content_item.text, 'value'):
                                content_parts.append(content_item.text.value)
                            else:
                                content_parts.append(str(content_item.text))
                        elif hasattr(content_item, 'value'):
                            content_parts.append(str(content_item.value))
                        elif hasattr(content_item, 'message'):
                            content_parts.append(str(content_item.message))
                    message_content = "\n".join(content_parts)
                elif hasattr(message, 'text'):
                    # Direct text property
                    if hasattr(message.text, 'value'):
                        message_content = message.text.value
                    else:
                        message_content = str(message.text)
                elif hasattr(message, 'message'):
                    message_content = str(message.message)
                
                if message_content.strip():
                    # Add role prefix for clarity
                    role_prefix = "USER" if 'user' in role_str else "ASSISTANT" if 'assistant' in role_str else role_str.upper()
                    conversation_parts.append(f"[{role_prefix}]: {message_content}")
            
            # Join all conversation parts
            full_conversation = "\n\n".join(conversation_parts)
            
            if not full_conversation.strip():
                logger.warning("No conversation content found in thread")
                # Try alternative approach - get just the assistant messages
                assistant_messages = []
                for message in messages:
                    role_str = str(message.role).lower() if hasattr(message, 'role') else 'unknown'
                    if 'assistant' in role_str:
                        if hasattr(message, 'content') and message.content:
                            for content_item in message.content:
                                if hasattr(content_item, 'text') and hasattr(content_item.text, 'value'):
                                    assistant_messages.append(content_item.text.value)
                
                if assistant_messages:
                    return "\n\n".join(assistant_messages)
                else:
                    return "No response content available from agent"
            
            logger.info(f"Extracted conversation with {len(conversation_parts)} parts")
            return full_conversation
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Error extracting agent response: {e}")
            
            # Fallback: try to get any text content from messages
            try:
                messages = self.agents_client.messages.list(thread_id=thread_id)
                fallback_content = []
                
                for message in messages:
                    # Try multiple ways to extract content
                    content = None
                    if hasattr(message, 'content'):
                        if isinstance(message.content, list):
                            for item in message.content:
                                if hasattr(item, 'text'):
                                    content = getattr(item.text, 'value', str(item.text))
                                    break
                        elif hasattr(message.content, 'text'):
                            content = getattr(message.content.text, 'value', str(message.content.text))
                        else:
                            content = str(message.content)
                    elif hasattr(message, 'text'):
                        content = getattr(message.text, 'value', str(message.text))
                    
                    if content and content.strip():
                        fallback_content.append(content)
                
                if fallback_content:
                    return "\n\n".join(fallback_content)
                    
            except Exception as fallback_error:
                logger.error(f"Fallback extraction also failed: {fallback_error}")
            
            return f"Error extracting response: {str(e)}"

    def _get_last_agent_message(self, thread_id: str) -> str:
        """Get the last agent message from the thread."""
        try:
            messages = self.agents_client.messages.list(thread_id=thread_id)
            
            for message in reversed(messages):  # Start from the most recent
                role_str = str(message.role).lower() if hasattr(message, 'role') else 'unknown'
                
                if 'assistant' in role_str:
                    if hasattr(message, 'content') and message.content:
                        for content_item in message.content:
                            if hasattr(content_item, 'text') and content_item.text:
                                if hasattr(content_item.text, 'value'):
                                    return content_item.text.value
                                else:
                                    return str(content_item.text)
                    elif hasattr(message, 'text') and message.text:
                        if hasattr(message.text, 'value'):
                            return message.text.value
                        else:
                            return str(message.text)
            
            return "No agent message found"
            
        except Exception as e:
            logger.error(f"Error getting last agent message: {e}")
            return f"Error: {str(e)}"