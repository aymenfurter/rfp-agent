"""Custom application exceptions."""


class RFPAgentException(Exception):
    """Base exception for RFP Agent application."""
    
    def __init__(self, message: str, details: str = None):
        self.message = message
        self.details = details
        super().__init__(self.message)


class DocumentProcessingError(RFPAgentException):
    """Exception raised when document processing fails."""
    pass


class FileValidationError(RFPAgentException):
    """Exception raised when file validation fails."""
    pass


class CriteriaExtractionError(RFPAgentException):
    """Exception raised when criteria extraction fails."""
    pass


class ConfigurationError(RFPAgentException):
    """Exception raised when configuration is invalid."""
    pass


class DatabaseError(RFPAgentException):
    """Exception raised when database operations fail."""
    pass
    pass
