import streamlit as st
import os
import re
import pikepdf
import pdfplumber
import pandas as pd
from datetime import datetime

# --- APP CONFIGURATION ---
st.set_page_config(
    page_title="Bank Statement Manager",
    page_icon="📂",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- UTILITY FUNCTIONS ---

def safe_extract_text(pdf_path):
    try:
        with pdfplumber.open(pdf_path) as pdf:
            if len(pdf.pages) > 0:
                return pdf.pages[0].extract_text()
    except:
        return ""
    return ""

def parse_date_standard_bank(text):
    """Specific logic for Standard Bank Statements"""
    # Look for "Statement from X to Y"
    period_match = re.search(r'Statement\s+from\s+.*?\s+to\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})', text, re.IGNORECASE)
    if period_match:
        return period_match.group(1)
    return None

def parse_date_generic(text):
    """Generic fallback for other banks"""
    # Strict Regex for Standard Dates (DD Month YYYY)
    month_names = r'(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)'
    date_pattern = fr'\b(\d{{1,2}}\s+{month_names}\s+\d{{4}})\b'
    matches = re.findall(date_pattern, text, re.IGNORECASE)
    if matches: 
        return matches[0]
    
    # Numeric YYYY/MM/DD
    numeric_match = re.search(r'\b(\d{4}[/-]\d{2}[/-]\d{2})\b|\b(\d{2}[/-]\d{2}[/-]\d{4})\b', text)
    if numeric_match: 
        return numeric_match.group(0)
    
    return "Date not found"

def convert_to_datetime(date_str):
    if not date_str or "found" in str(date_str) or "Error" in str(date_str):
        return datetime.min
    
    clean_date = re.sub(r'\s+', ' ', str(date_str)).strip()
    formats = [
        "%d %B %Y", "%d %b %Y", 
        "%Y/%m/%d", "%d/%m/%Y", 
        "%Y-%m-%d", "%d-%m-%Y"
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(clean_date, fmt)
        except ValueError:
            continue
    return datetime.min

# --- SIDEBAR ---
with st.sidebar:
    st.header("⚙️ Settings")
    st.info("💡 **Tip:** To toggle Light/Dark mode, click the '⋮' menu at the top right > Settings > Theme.")
    
    st.markdown("---")
    st.write(" **Current Workflow:**")
    st.markdown("1. **Unlock** encrypted PDFs.")
    st.markdown("2. **Scan & Sort** by statement date.")
    st.markdown("3. **Merge** into one history file.")

# --- MAIN PAGE ---
st.title("📂 Bank Statement Manager")
st.markdown("Automate the processing of your monthly bank statements securely on your local machine.")

# Tabs
tab_unlock, tab_sort, tab_merge = st.tabs(["🔓 1. Unlock Files", "📅 2. Scan & Sort", "📑 3. Merge Files"])

# ==========================================
# TAB 1: UNLOCKER
# ==========================================
with tab_unlock:
    st.header("Step 1: Unlock PDF Files")
    st.markdown("Remove passwords from a batch of PDF files.")

    col1, col2 = st.columns(2)
    with col1:
        source_folder = st.text_input("Source Folder Path", placeholder=r"C:\Users\Name\Downloads\Statements", key="unlock_src")
    with col2:
        passwords_input = st.text_input("Passwords (comma separated)", value="7904265574083, 10175706466")
    
    if st.button("🚀 Unlock All Files", type="primary"):
        if not source_folder or not os.path.exists(source_folder):
            st.error("Please provide a valid folder path.")
        else:
            # Setup
            passwords = [p.strip() for p in passwords_input.split(',')]
            output_folder = os.path.join(source_folder, "Unlocked_Files")
            if not os.path.exists(output_folder):
                os.makedirs(output_folder)
            
            files = [f for f in os.listdir(source_folder) if f.lower().endswith('.pdf')]
            
            progress_bar = st.progress(0)
            status_text = st.empty()
            
            success_count = 0
            fail_count = 0
            
            # Processing Loop
            for i, filename in enumerate(files):
                input_path = os.path.join(source_folder, filename)
                output_path = os.path.join(output_folder, filename)
                
                pdf = None
                
                # Try passwords
                for pwd in passwords:
                    try:
                        pdf = pikepdf.open(input_path, password=pwd)
                        break
                    except:
                        continue
                
                # Try no password
                if pdf is None:
                    try:
                        pdf = pikepdf.open(input_path)
                    except:
                        pass
                
                # Save
                if pdf:
                    try:
                        pdf.save(output_path)
                        success_count += 1
                    except:
                        fail_count += 1
                else:
                    fail_count += 1
                
                # Update UI
                progress = (i + 1) / len(files)
                progress_bar.progress(progress)
                status_text.text(f"Processing: {filename}")

            st.success(f"Processing Complete! {success_count} files unlocked.")
            if fail_count > 0:
                st.warning(f"{fail_count} files failed to unlock.")
            st.info(f"Unlocked files saved to: `{output_folder}`")
            
            # Store default path for next tab
            st.session_state['unlocked_folder'] = output_folder

# ==========================================
# TAB 2: SORT
# ==========================================
with tab_sort:
    st.header("Step 2: Scan Dates & Sort")
    
    default_path = st.session_state.get('unlocked_folder', "")
    scan_folder = st.text_input("Unlocked Folder Path", value=default_path, key="sort_src")
    
    col_a, col_b = st.columns(2)
    with col_a:
        bank_type = st.selectbox("Bank Statement Type", ["Auto-Detect / Generic", "Standard Bank"])
    with col_b:
        st.write("") # Spacer
        st.write("") 
        scan_btn = st.button("🔍 Scan Dates", type="primary")

    if scan_btn and scan_folder:
        if not os.path.exists(scan_folder):
            st.error("Folder not found.")
        else:
            files = [f for f in os.listdir(scan_folder) if f.lower().endswith('.pdf') and "Full_History" not in f]
            
            data_list = []
            
            with st.spinner(f"Scanning {len(files)} files..."):
                for filename in files:
                    path = os.path.join(scan_folder, filename)
                    text = safe_extract_text(path)
                    
                    date_found = None
                    if bank_type == "Standard Bank":
                        date_found = parse_date_standard_bank(text)
                    
                    if not date_found:
                        date_found = parse_date_generic(text)
                        
                    dt_obj = convert_to_datetime(date_found)
                    
                    data_list.append({
                        "Include": True,
                        "Filename": filename,
                        "Detected Date": date_found,
                        "Sort Value": dt_obj # Hidden column for sorting
                    })
            
            # Create DataFrame
            df = pd.DataFrame(data_list)
            # Sort by date initially
            df = df.sort_values(by="Sort Value")
            
            st.session_state['df_scanned'] = df
            st.session_state['scan_complete'] = True

    # Display Editable Table
    if st.session_state.get('scan_complete'):
        st.markdown("### 📝 Review & Edit")
        st.markdown("Double-click any cell to correct dates or exclude files.")
        
        # We drop 'Sort Value' for the display, but keep index logic
        display_df = st.session_state['df_scanned'].drop(columns=['Sort Value'])
        
        edited_df = st.data_editor(
            display_df,
            hide_index=True,
            column_config={
                "Include": st.column_config.CheckboxColumn("Merge?", help="Uncheck to exclude this file from the final PDF"),
                "Filename": st.column_config.TextColumn("Filename", disabled=True),
                "Detected Date": st.column_config.TextColumn("Statement Date (Editable)"),
            },
            use_container_width=True
        )
        
        # Update session state with edits
        st.session_state['df_final'] = edited_df

# ==========================================
# TAB 3: MERGE
# ==========================================
with tab_merge:
    st.header("Step 3: Merge to PDF")
    
    if 'df_final' not in st.session_state:
        st.info("⚠️ Please complete 'Step 2: Scan & Sort' first.")
    else:
        df = st.session_state['df_final']
        selected_files = df[df['Include'] == True]
        
        st.write(f"Ready to merge **{len(selected_files)}** files.")
        
        output_name = st.text_input("Output Filename", "Full_History_Sorted.pdf")
        
        if st.button("📑 Create Merged PDF", type="primary"):
            merge_folder = st.session_state.get('sort_src', st.session_state.get('unlocked_folder'))
            output_path = os.path.join(merge_folder, output_name)
            
            merged_pdf = pikepdf.Pdf.new()
            
            progress_bar_merge = st.progress(0)
            status_merge = st.empty()
            
            # Re-calculate sort order based on potentially edited text dates
            # We need to re-parse the text dates in case the user edited them manually in the table
            selected_files = selected_files.copy()
            selected_files['Sort_Recompute'] = selected_files['Detected Date'].apply(convert_to_datetime)
            selected_files = selected_files.sort_values(by='Sort_Recompute')
            
            total = len(selected_files)
            count = 0
            
            try:
                for idx, row in selected_files.iterrows():
                    fname = row['Filename']
                    fpath = os.path.join(merge_folder, fname)
                    
                    try:
                        src = pikepdf.Pdf.open(fpath)
                        merged_pdf.pages.extend(src.pages)
                        count += 1
                        status_merge.text(f"Merging: {fname}")
                    except Exception as e:
                        st.error(f"Failed to merge {fname}: {e}")
                    
                    progress_bar_merge.progress((count) / total)
                
                merged_pdf.save(output_path)
                st.success("✅ Merge Complete!")
                st.balloons()
                st.markdown(f"### File saved as: `{output_path}`")
                
                # Provide a button to open the folder
                if st.button("📂 Open Output Folder"):
                    os.startfile(merge_folder)
                    
            except Exception as e:
                st.error(f"Critical Error during merge: {e}")