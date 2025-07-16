"""Excel processing service for converting spreadsheets to markdown."""

import logging
import pandas as pd
from typing import Dict, Any, List
from pathlib import Path
from tabulate import tabulate

from app.core.exceptions import DocumentProcessingError

logger = logging.getLogger(__name__)


class ExcelProcessingService:
    """Service for processing Excel files and converting to markdown."""
    
    def __init__(self):
        """Initialize the Excel processing service."""
        pass
    
    async def convert_excel_to_markdown(self, file_path: str) -> str:
        """
        Convert Excel file to markdown format.
        
        Args:
            file_path: Path to the Excel file
            
        Returns:
            Content in markdown format
            
        Raises:
            DocumentProcessingError: If processing fails
        """
        try:
            logger.info(f"Processing Excel file: {file_path}")
            
            # Read Excel file (handle both .xlsx and .xls)
            file_extension = Path(file_path).suffix.lower()
            
            if file_extension == '.xlsx':
                excel_data = pd.read_excel(file_path, sheet_name=None, engine='openpyxl')
            elif file_extension == '.xls':
                excel_data = pd.read_excel(file_path, sheet_name=None, engine='xlrd')
            else:
                raise DocumentProcessingError(f"Unsupported file format: {file_extension}")
            
            markdown_content = []
            
            # Process each sheet
            for sheet_name, df in excel_data.items():
                logger.info(f"Processing sheet: {sheet_name}")
                
                # Add sheet header
                markdown_content.append(f"# {sheet_name}\n")
                
                # Clean the dataframe
                df = self._clean_dataframe(df)
                
                if not df.empty:
                    # Convert to markdown table
                    table_markdown = tabulate(
                        df, 
                        headers='keys', 
                        tablefmt='pipe', 
                        showindex=False
                    )
                    markdown_content.append(table_markdown)
                    markdown_content.append("\n")
                else:
                    markdown_content.append("*Empty sheet*\n")
            
            result = "\n".join(markdown_content)
            logger.info(f"Successfully converted Excel to markdown: {len(result)} characters")
            
            return result
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Error processing Excel file: {e}")
            raise DocumentProcessingError(f"Failed to process Excel file: {str(e)}")
    
    def _clean_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Clean dataframe by removing empty rows/columns and handling NaN values.
        
        Args:
            df: Input dataframe
            
        Returns:
            Cleaned dataframe
        """
        try:
            # Remove completely empty rows and columns
            df = df.dropna(how='all').dropna(axis=1, how='all')
            
            # Fill NaN values with empty strings
            df = df.fillna('')
            
            # Convert all columns to string to avoid issues with mixed types
            for col in df.columns:
                df[col] = df[col].astype(str)
            
            # Remove rows where all values are empty strings
            df = df[~(df == '').all(axis=1)]
            
            # Ensure column names are strings
            df.columns = [str(col) for col in df.columns]
            
            return df
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.warning(f"Error cleaning dataframe: {e}")
            return df
    
    async def extract_criteria_keywords(self, markdown_content: str) -> List[str]:
        """
        Extract potential criteria-related keywords from Excel content.
        
        Args:
            markdown_content: Markdown content from Excel
            
        Returns:
            List of criteria-related keywords found
        """
        criteria_keywords = [
            "requirement", "criteria", "must", "shall", "should", 
            "mandatory", "optional", "specification", "standard", 
            "compliance", "evaluation", "scoring", "weight", 
            "threshold", "minimum", "maximum", "target"
        ]
        
        found_keywords = []
        content_lower = markdown_content.lower()
        
        for keyword in criteria_keywords:
            if keyword in content_lower:
                found_keywords.append(keyword)
        
        return found_keywords
    
    async def analyze_excel_structure(self, file_path: str) -> Dict[str, Any]:
        """
        Analyze Excel file structure to determine if it contains criteria.
        
        Args:
            file_path: Path to the Excel file
            
        Returns:
            Analysis results including sheet info and criteria indicators
        """
        try:
            # Read Excel file
            file_extension = Path(file_path).suffix.lower()
            
            if file_extension == '.xlsx':
                excel_data = pd.read_excel(file_path, sheet_name=None, engine='openpyxl')
            elif file_extension == '.xls':
                excel_data = pd.read_excel(file_path, sheet_name=None, engine='xlrd')
            else:
                raise DocumentProcessingError(f"Unsupported file format: {file_extension}")
            
            analysis = {
                "sheet_count": len(excel_data),
                "sheet_names": list(excel_data.keys()),
                "total_rows": 0,
                "total_columns": 0,
                "contains_criteria": False,
                "criteria_indicators": []
            }
            
            criteria_keywords = [
                "requirement", "criteria", "specification", "standard",
                "mandatory", "compliance", "evaluation", "scoring"
            ]
            
            for sheet_name, df in excel_data.items():
                df_clean = self._clean_dataframe(df)
                analysis["total_rows"] += len(df_clean)
                analysis["total_columns"] = max(analysis["total_columns"], len(df_clean.columns))
                
                # Check for criteria indicators in sheet name and content
                sheet_text = f"{sheet_name} {df_clean.to_string()}".lower()
                
                for keyword in criteria_keywords:
                    if keyword in sheet_text:
                        analysis["criteria_indicators"].append(keyword)
                        analysis["contains_criteria"] = True
            
            return analysis
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Error analyzing Excel structure: {e}")
            return {
                "sheet_count": 0,
                "sheet_names": [],
                "total_rows": 0,
                "total_columns": 0,
                "contains_criteria": False,
                "criteria_indicators": []
            }
