import logging
import logging.config
from pathlib import Path
from app.core.config import get_settings


def setup_logging():
    """Configure application logging."""
    settings = get_settings()
    
    # Ensure log directory exists
    log_file = Path(settings.LOG_FILE)
    log_file.parent.mkdir(parents=True, exist_ok=True)
    
    logging_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
            "detailed": {
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(module)s - %(funcName)s - %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "level": settings.LOG_LEVEL,
                "formatter": "default",
                "stream": "ext://sys.stdout",
            },
            "file": {
                "class": "logging.handlers.RotatingFileHandler",
                "level": settings.LOG_LEVEL,
                "formatter": "detailed",
                "filename": settings.LOG_FILE,
                "maxBytes": 10485760,  # 10MB
                "backupCount": 5,
            },
        },
        "loggers": {
            "": {
                "level": settings.LOG_LEVEL,
                "handlers": ["console", "file"],
                "propagate": False,
            },
            "uvicorn": {
                "level": "INFO",
                "handlers": ["console"],
                "propagate": False,
            },
        },
    }
    
    logging.config.dictConfig(logging_config)
