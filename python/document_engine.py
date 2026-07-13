import io
import re
from pypdf import PdfReader, PdfWriter
from datetime import datetime

# ============================================================================
# ALL4ONE - BROWSER-SAFE PDF ENGINE (Pyodide Compatible)
# ============================================================================

def safe_extract_text(reader):
    """Safely extracts text from the first page of a PDF using pypdf"""
    try:
        if len(reader.pages) > 0:
            return reader.pages[0].extract_text()
    except Exception as e:
        print(f"Extraction Error: {e}")
    return ""

def parse_date_standard_bank(text):
    """Specific logic for Standard Bank Statements"""
    period_match = re.search(r'Statement\s+from\s+.*?\s+to\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})', text, re.IGNORECASE)
    if period_match:
        return period_match.group(1)
    return None

def parse_date_generic(text):
    """Generic fallback for other banks and payslips"""
    month_names = r'(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)'
    
    # 1. Standard Dates (DD Month YYYY)
    date_pattern = fr'\b(\d{{1,2}}\s+{month_names}\s+\d{{4}})\b'
    matches = re.findall(date_pattern, text, re.IGNORECASE)
    if matches: 
        return matches[0]
    
    # 2. Numeric YYYY/MM/DD or DD/MM/YYYY
    numeric_match = re.search(r'\b(\d{4}[/-]\d{2}[/-]\d{2})\b|\b(\d{2}[/-]\d{2}[/-]\d{4})\b', text)
    if numeric_match: 
        # Return whichever group matched
        return numeric_match.group(1) if numeric_match.group(1) else numeric_match.group(2)
    
    return "Date not found"

# --- CORE EXPORTED FUNCTIONS FOR JAVASCRIPT ---

def unlock_pdf(file_bytes, passwords_str):
    """
    Attempts to unlock a PDF using a comma-separated list of passwords.
    Returns a dict with success state and the raw decrypted bytes.
    """
    passwords = [p.strip() for p in passwords_str.split(',') if p.strip()]
    
    try:
        pdf_stream = io.BytesIO(file_bytes.to_py()) # to_py() converts JS ArrayBuffer to Python bytes
        reader = PdfReader(pdf_stream)
        
        # If it's not encrypted, just return the original bytes
        if not reader.is_encrypted:
            return {"success": True, "is_encrypted": False, "bytes": file_bytes.to_py()}
            
        for pwd in passwords:
            # pypdf decrypt returns an integer (0 = failed, 1 = success (user pwd), 2 = success (owner pwd))
            if reader.decrypt(pwd) != 0:
                writer = PdfWriter()
                writer.append_pages_from_reader(reader)
                
                out_stream = io.BytesIO()
                writer.write(out_stream)
                return {
                    "success": True, 
                    "is_encrypted": True, 
                    "password_used": pwd, 
                    "bytes": out_stream.getvalue()
                }
                
        return {"success": False, "error": "No passwords matched"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def scan_pdf_date(file_bytes, doc_type):
    """
    Extracts text from the first page and runs regex to find the document date.
    """
    try:
        pdf_stream = io.BytesIO(file_bytes.to_py())
        reader = PdfReader(pdf_stream)
        
        if reader.is_encrypted:
            return {"success": False, "error": "File is encrypted. Unlock first."}
            
        text = safe_extract_text(reader)
        if not text:
            return {"success": True, "date": "No text found (Scanned?)"}
            
        date_found = None
        if doc_type == "bank":
            date_found = parse_date_standard_bank(text)
            
        if not date_found:
            date_found = parse_date_generic(text)
            
        return {"success": True, "date": date_found}
    except Exception as e:
        return {"success": False, "error": str(e)}

def merge_pdfs(files_dict):
    """
    Takes a dict mapping filenames to their raw bytes, merges them sequentially,
    and returns the final merged byte stream.
    """
    try:
        writer = PdfWriter()
        files_map = files_dict.to_py() # Convert JS Map/Dict to Python Dict
        
        for filename, file_bytes in files_map.items():
            pdf_stream = io.BytesIO(file_bytes)
            reader = PdfReader(pdf_stream)
            writer.append_pages_from_reader(reader)
            
        out_stream = io.BytesIO()
        writer.write(out_stream)
        
        return {
            "success": True,
            "bytes": out_stream.getvalue()
        }
    except Exception as e:
        return {"success": False, "error": str(e)}