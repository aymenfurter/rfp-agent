"""Main FastAPI application for RFP Agent AI."""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.api.routes import documents, criteria

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting RFP Agent AI application...")
    
    # Ensure required directories exist
    settings = get_settings()
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path("logs").mkdir(exist_ok=True)
    
    # Initialize AI agents
    try:
        from app.api.routes.documents import get_document_service
        document_service = get_document_service()
        await document_service.initialize_ai_agents()
        logger.info("AI agents initialized successfully")
    except Exception as e:
        logger.warning(f"Failed to initialize AI agents: {e}")
    
    logger.info("Application startup complete")
    
    yield
    
    # Shutdown
    logger.info("Shutting down RFP Agent AI application...")
    
    # Cleanup AI agents
    try:
        from app.api.routes.documents import get_document_service
        document_service = get_document_service()
        await document_service.cleanup_ai_agents()
        logger.info("AI agents cleaned up successfully")
    except Exception as e:
        logger.warning(f"Failed to cleanup AI agents: {e}")

# Create FastAPI application
app = FastAPI(
    title="RFP Agent AI",
    description="Intelligent RFP Processing & Response Generation",
    version="1.0.0",
    lifespan=lifespan
)

# Get settings
settings = get_settings()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(criteria.router, prefix="/api/criteria", tags=["criteria"])

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "message": "RFP Agent AI is running",
        "version": "1.0.0"
    }

# API info endpoint
@app.get("/api/info")
async def api_info():
    """API information endpoint."""
    return {
        "title": "RFP Agent AI API",
        "version": "1.0.0",
        "description": "API for intelligent RFP processing and response generation",
        "endpoints": {
            "documents": "/api/documents",
            "criteria": "/api/criteria",
            "health": "/health"
        }
    }

# Serve the main HTML file
@app.get("/")
async def serve_index():
    """Serve the main application page."""
    return FileResponse("index.html")


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
