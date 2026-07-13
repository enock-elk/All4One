import os
import re
import pikepdf
import pdfplumber

# --- CONFIGURATION ---
SOURCE_FOLDER = r"C:\Users\enock\OneDrive\Documents\GitHub\All4One\Source Code"
INPUT_PDF = os.path.join(SOURCE_FOLDER, "Full_History_Sorted.pdf")

# Output files
OUTPUT_FOLDER = os.path.join(SOURCE_FOLDER, "SplitWork")
BUSINESS_PDF = os.path.join(OUTPUT_FOLDER, "Business_History_6466.pdf")
PERSONAL_PDF = os.path.join(OUTPUT_FOLDER, "Personal_History_0697.pdf")

def split_merged_pdf():
    print(f"--- Starting Document Separation ---\n")
    
    if not os.path.exists(INPUT_PDF):
        print(f"[ERROR] Could not find the merged file at:\n{INPUT_PDF}")
        print("Please ensure you have run the merger script first.")
        return

    # Create the SplitWork output folder if it doesn't exist
    if not os.path.exists(OUTPUT_FOLDER):
        os.makedirs(OUTPUT_FOLDER)
        print(f"Created output directory: {OUTPUT_FOLDER}\n")

    print(f"Opening: {INPUT_PDF}")
    
    # We use pikepdf for saving/copying pages, and pdfplumber for reading the text
    src_pdf = pikepdf.Pdf.open(INPUT_PDF)
    
    bus_pdf = pikepdf.Pdf.new()
    per_pdf = pikepdf.Pdf.new()
    
    current_account = None # Acts as our "sticky" memory
    bus_count = 0
    per_count = 0

    with pdfplumber.open(INPUT_PDF) as pdf_text:
        total_pages = len(pdf_text.pages)
        print(f"Total pages to process: {total_pages}\n")
        
        for i in range(total_pages):
            print(f"Scanning page {i+1}/{total_pages}...", end='\r')
            
            # Extract text from the current page
            page_text = pdf_text.pages[i].extract_text() or ""
            
            # 1. Search for the explicit Account Number header
            # This looks for "Account Number" followed by spaces and digits
            acc_match = re.search(r'Account\s*Number\s*([0-9\s]{8,20})', page_text, re.IGNORECASE)
            
            if acc_match:
                # Clean up the found number (remove spaces and newlines)
                clean_acc = acc_match.group(1).replace(" ", "").replace("\n", "")
                
                if clean_acc.endswith("6466"):
                    current_account = "business"
                elif clean_acc.endswith("0697"):
                    current_account = "personal"
            
            # 2. Route the page to the correct new PDF
            if current_account == "business":
                bus_pdf.pages.append(src_pdf.pages[i])
                bus_count += 1
            elif current_account == "personal":
                per_pdf.pages.append(src_pdf.pages[i])
                per_count += 1
            else:
                # Fallback: If it's the very first page and we can't find an account number
                # we will guess it's business, but log a warning.
                print(f"\n[WARN] Could not find account number on Page {i+1}. Defaulting to Business.")
                current_account = "business"
                bus_pdf.pages.append(src_pdf.pages[i])
                bus_count += 1
    
    print(" " * 50, end='\r') # Clear the progress line
    print("Separation complete. Saving new files...\n")
    
    # 3. Save the results
    if bus_count > 0:
        bus_pdf.save(BUSINESS_PDF)
        print(f"[SUCCESS] Saved Business PDF ({bus_count} pages):")
        print(f"  -> {BUSINESS_PDF}")
        
    if per_count > 0:
        per_pdf.save(PERSONAL_PDF)
        print(f"\n[SUCCESS] Saved Personal PDF ({per_count} pages):")
        print(f"  -> {PERSONAL_PDF}")
        
    print("\n" + "="*40)
    print("DONE!")
    print("="*40)

if __name__ == "__main__":
    try:
        split_merged_pdf()
    except Exception as e:
        print(f"\n[CRITICAL ERROR] {e}")
    finally:
        input("\nPress Enter to exit...")