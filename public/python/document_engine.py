import io
import re
from pypdf import PdfReader, PdfWriter
from datetime import datetime

# ============================================================================
# ALL4ONE - BROWSER-SAFE PDF ENGINE (Pyodide Compatible)
# GUARDIAN V3: PRE-FLIGHT only in browser RAM (Pyodide).
# Responsibilities: AES unlock, date sniff for UI sort, merge.
# Deep multi-bank extraction is Cloud Function Assembly Line (bank profiles + Document AI + Gemini).
# ============================================================================

def safe_extract_text(reader):
    """Safely extracts text from the first page of a PDF using pypdf"""
    try:
        if len(reader.pages) > 0:
            return reader.pages[0].extract_text()
    except Exception as e:
        print(f"Extraction Error: {e}")
    return ""

def standardize_date(date_str):
    """Converts various date formats to YYYY-MM-DD to guarantee perfect sorting in JS"""
    if not date_str: return None
    
    # Clean up separators (convert dots and slashes to dashes)
    clean_date = re.sub(r'\s+', ' ', date_str).strip()
    clean_date = clean_date.replace('.', '-').replace('/', '-')
    
    formats = [
        "%d-%m-%Y", "%Y-%m-%d", 
        "%d %B %Y", "%d %b %Y",
        "%d %B %y", "%d %b %y"
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(clean_date, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
            
    # Fallback to original string if we cannot parse it mathematically
    return date_str 

def parse_date_standard_bank(text):
    """Specific logic for Standard Bank Statements"""
    period_match = re.search(r'Statement\s+from\s+.*?\s+to\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})', text, re.IGNORECASE)
    if period_match:
        return standardize_date(period_match.group(1))
    return None

def parse_date_payslip(text):
    """Specific logic for Payslips - hunts for ranges and grabs the end date"""
    # 1. Look for explicit ranges (e.g., "01.05.2026 - 31.05.2026" or "01/05/2026 to 31/05/2026")
    range_match = re.search(r'(\d{2}[./-]\d{2}[./-]\d{4})\s*(?:-|to)\s*(\d{2}[./-]\d{2}[./-]\d{4})', text, re.IGNORECASE)
    if range_match:
        # Return the END date for chronological sorting
        return standardize_date(range_match.group(2))
    
    # 2. Look for explicit "Pay Period: DD.MM.YYYY" (Single date)
    period_single = re.search(r'Pay\s+Period:?\s*(\d{2}[./-]\d{2}[./-]\d{4})', text, re.IGNORECASE)
    if period_single:
        return standardize_date(period_single.group(1))
        
    return None

def parse_date_generic(text):
    """Generic fallback for other formats"""
    month_names = r'(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)'
    
    # 1. Standard Dates (DD Month YYYY)
    date_pattern = fr'\b(\d{{1,2}}\s+{month_names}\s+\d{{4}})\b'
    matches = re.findall(date_pattern, text, re.IGNORECASE)
    if matches: 
        return standardize_date(matches[0])
    
    # 2. Numeric YYYY/MM/DD or DD/MM/YYYY or DD.MM.YYYY
    numeric_match = re.search(r'\b(\d{4}[/-]\d{2}[/-]\d{2})\b|\b(\d{2}[./-]\d{2}[./-]\d{4})\b', text)
    if numeric_match: 
        val = numeric_match.group(1) if numeric_match.group(1) else numeric_match.group(2)
        return standardize_date(val)
    
    return "Date not found"

# ============================================================================
# CORE EXPORTED FUNCTIONS FOR JAVASCRIPT
# ============================================================================

def unlock_pdf(file_bytes, passwords_str):
    """
    Attempts to unlock a PDF using a comma-separated list of passwords.
    Returns a dict with success state and the raw decrypted bytes.
    """
    passwords = [p.strip() for p in passwords_str.split(',') if p.strip()]
    
    try:
        pdf_stream = io.BytesIO(file_bytes.to_py())
        reader = PdfReader(pdf_stream)
        
        if not reader.is_encrypted:
            return {"success": True, "is_encrypted": False, "bytes": file_bytes.to_py()}
            
        for pwd in passwords:
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
    Used purely for organizing files in the UI before cloud extraction.
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
        elif doc_type == "payslip":
            date_found = parse_date_payslip(text)
            
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
        files_map = files_dict.to_py()
        
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