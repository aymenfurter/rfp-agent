"""Application configuration settings."""

import os
from typing import List
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""
    
    # Server Configuration
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    DEBUG: bool = True
    
    # File Upload Configuration
    MAX_FILE_SIZE: int = 52428800  # 50MB
    UPLOAD_DIR: str = "uploads"
    ALLOWED_EXTENSIONS: List[str] = [".pdf", ".xlsx", ".xls"]
    
    # Database Configuration
    DATABASE_URL: str = "sqlite:///./rfp_agent.db"
    
    # Azure OpenAI Configuration
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_API_VERSION: str = "2024-02-15-preview"
    AZURE_OPENAI_MODEL: str = "gpt-4.1"
    AZURE_OPENAI_DEPLOYMENT_NAME: str = ""
    MAX_CRITERIA_PER_DOCUMENT: int = 1000

    # Azure AI Agent Service Configuration
    BING_CONNECTION_NAME: str = ""
    DEEP_RESEARCH_MODEL_DEPLOYMENT_NAME: str = ""
    
    # Additional Azure AI Agent fields (from environment)
    AZURE_AI_AGENT_ENDPOINT: str = ""
    AZURE_AI_AGENT_MODEL_DEPLOYMENT_NAME: str = ""

    # Azure Document Intelligence Configuration
    AZURE_DOC_INTELLIGENCE_ENDPOINT: str = ""
    AZURE_DOC_INTELLIGENCE_KEY: str = ""
    
    # Logging Configuration
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/rfp_agent.log"
    
    # Criteria Categories
    CRITERIA_CATEGORIES: List[str] = [
        "Technical Requirements",
        "Security & Compliance", 
        "Performance & Scalability",
        "Integration & Compatibility",
        "Support & Maintenance",
        "Commercial & Legal"
    ]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()
