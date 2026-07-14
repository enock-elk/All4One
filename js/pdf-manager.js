// ============================================================================
// ALL4ONE - PDF DOCUMENT MANAGER (FRONTEND UI CONTROLLER)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const dropzone = document.getElementById('pdf-dropzone');
    const fileInput = document.getElementById('pdf-file-input');
    const fileListBody = document.getElementById('pdf-file-list');
    const emptyStateRow = document.getElementById('pdf-empty-state');
    const selectAllCheckbox = document.getElementById('pdf-select-all');
    const statsCount = document.getElementById('pdf-stats-count');
    const btnClearBay = document.getElementById('btn-clear-bay');
    
    // Action Buttons
    const btnUnlock = document.getElementById('btn-unlock-pdf');
    const btnScan = document.getElementById('btn-scan-pdf');
    const btnMerge = document.getElementById('btn-merge-pdf');
    const btnExtractExcel = document.getElementById('btn-extract-excel');

    // --- State Management ---
    // This acts as our localized RAM before passing to the Python engine
    let holdingBay = []; 

    // --- Core Functions ---

    /**
     * Re-renders the file table based on the holdingBay array.
     */
    function renderTable() {
        // Clear all rows EXCEPT the empty state stub
        const rows = Array.from(fileListBody.querySelectorAll('tr'));
        rows.forEach(row => {
            if (row.id !== 'pdf-empty-state') {
                row.remove();
            }
        });

        // Toggle Empty State Visibility
        if (holdingBay.length === 0) {
            emptyStateRow.style.display = 'table-row';
            selectAllCheckbox.disabled = true;
            selectAllCheckbox.checked = false;
            btnClearBay.disabled = true;
            toggleActionButtons(false);
            statsCount.textContent = '0 files tracked';
            return;
        }

        emptyStateRow.style.display = 'none';
        selectAllCheckbox.disabled = false;
        btnClearBay.disabled = false;
        toggleActionButtons(true);
        statsCount.textContent = `${holdingBay.length} file${holdingBay.length > 1 ? 's' : ''} tracked`;

        // Render each file
        holdingBay.forEach((fileObj, index) => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150 cursor-move';
            tr.setAttribute('draggable', 'true');
            tr.setAttribute('data-index', index);
            
            // Status Badge Logic
            let statusBadge = '';
            if (fileObj.status === 'pending') {
                statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">Pending</span>';
            } else if (fileObj.status === 'unlocked') {
                statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Unlocked</span>';
            } else if (fileObj.status === 'error') {
                statusBadge = '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">Error</span>';
            }

            tr.innerHTML = `
                <td class="px-4 py-3 whitespace-nowrap text-center">
                    <input type="checkbox" class="file-checkbox rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-slate-50 dark:bg-slate-800 dark:border-slate-600 cursor-pointer" data-index="${index}" ${fileObj.included ? 'checked' : ''}>
                </td>
                <td class="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100 truncate max-w-xs" title="${fileObj.file.name}">
                    ${fileObj.file.name}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    ${statusBadge}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <input type="text" class="w-full bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-blue-500 outline-none text-sm px-1 py-0.5 transition-colors" value="${fileObj.detectedDate || ''}" placeholder="Scan to detect..." data-index="${index}">
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button class="download-btn text-slate-400 hover:text-blue-500 transition-colors ${fileObj.status === 'error' ? 'hidden' : ''}" data-index="${index}" title="Download File">
                            <i data-lucide="download" class="w-4 h-4"></i>
                        </button>
                        <button class="delete-btn text-slate-400 hover:text-rose-500 transition-colors" data-index="${index}" title="Remove File">
                            <i data-lucide="trash-2" class="w-4 h-4 mx-auto"></i>
                        </button>
                    </div>
                </td>
            `;

            fileListBody.appendChild(tr);
        });

        // Attach listeners to dynamically created elements
        attachRowListeners();
        
        // Re-init newly injected icons
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    function toggleActionButtons(enable) {
        btnUnlock.disabled = !enable;
        btnScan.disabled = !enable;
        btnMerge.disabled = !enable;
        if (btnExtractExcel) btnExtractExcel.disabled = !enable;
    }

    function attachRowListeners() {
        // Individual Checkboxes
        document.querySelectorAll('.file-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const idx = e.target.getAttribute('data-index');
                holdingBay[idx].included = e.target.checked;
                updateSelectAllState();
            });
        });

        // Date Inputs (Save manual edits)
        document.querySelectorAll('input[placeholder="Scan to detect..."]').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = e.target.getAttribute('data-index');
                holdingBay[idx].detectedDate = e.target.value.trim();
            });
        });

        // Download Buttons
        document.querySelectorAll('.download-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idx = e.currentTarget.getAttribute('data-index');
                const fileObj = holdingBay[idx];
                
                try {
                    const arrayBuffer = await fileObj.file.arrayBuffer();
                    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileObj.file.name;
                    document.body.appendChild(a);
                    a.click();
                    
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } catch (err) {
                    console.error("Download failed:", err);
                    alert("Could not download the file.");
                }
            });
        });

        // Delete Buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.currentTarget.getAttribute('data-index');
                holdingBay.splice(idx, 1);
                renderTable();
            });
        });

        // --- Drag and Drop Reordering Logic ---
        let draggedIndex = null;
        const rows = document.querySelectorAll('#pdf-file-list tr:not(#pdf-empty-state)');
        
        rows.forEach(row => {
            row.addEventListener('dragstart', (e) => {
                draggedIndex = parseInt(row.getAttribute('data-index'));
                row.classList.add('opacity-50', 'bg-blue-50', 'dark:bg-blue-900/20');
                e.dataTransfer.effectAllowed = 'move';
                // Necessary for Firefox support
                e.dataTransfer.setData('text/plain', draggedIndex);
            });

            row.addEventListener('dragend', () => {
                row.classList.remove('opacity-50', 'bg-blue-50', 'dark:bg-blue-900/20');
                draggedIndex = null;
            });

            row.addEventListener('dragover', (e) => {
                e.preventDefault(); // Necessary to allow dropping
                e.dataTransfer.dropEffect = 'move';
                
                const dropIndex = parseInt(row.getAttribute('data-index'));
                if (draggedIndex !== null && draggedIndex !== dropIndex) {
                    row.classList.add('border-t-2', 'border-blue-500');
                }
            });

            row.addEventListener('dragleave', () => {
                row.classList.remove('border-t-2', 'border-blue-500');
            });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                row.classList.remove('border-t-2', 'border-blue-500');
                
                const dropIndex = parseInt(row.getAttribute('data-index'));
                if (draggedIndex !== null && draggedIndex !== dropIndex) {
                    // 1. Remove the dragged item from its original position
                    const [draggedItem] = holdingBay.splice(draggedIndex, 1);
                    // 2. Insert it at the new drop index
                    holdingBay.splice(dropIndex, 0, draggedItem);
                    
                    // 3. Re-render the table to lock in the new order visually and programmatically
                    renderTable();
                }
            });
        });
    }

    function updateSelectAllState() {
        const allChecked = holdingBay.length > 0 && holdingBay.every(f => f.included);
        selectAllCheckbox.checked = allChecked;
    }

    function handleFilesAdded(files) {
        let addedCount = 0;
        Array.from(files).forEach(file => {
            if (file.type === 'application/pdf') {
                // Prevent exact duplicates by filename
                if (!holdingBay.some(f => f.file.name === file.name)) {
                    holdingBay.push({
                        file: file,
                        status: 'pending', // pending, unlocked, error
                        detectedDate: null,
                        included: true
                    });
                    addedCount++;
                }
            }
        });

        if (addedCount > 0) {
            renderTable();
        }
    }

    // --- Drag & Drop Listeners ---
    
    // Prevent default browser behavior
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight dropzone
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
            dropzone.classList.remove('border-slate-300', 'dark:border-slate-600');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
            dropzone.classList.add('border-slate-300', 'dark:border-slate-600');
        }, false);
    });

    // Handle drops
    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFilesAdded(files);
    });

    // Handle clicks to browse
    dropzone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', function() {
        handleFilesAdded(this.files);
        this.value = ''; // Reset input so same files can be re-selected if deleted
    });

    // --- Global Controls ---
    
    selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        holdingBay.forEach(f => f.included = isChecked);
        document.querySelectorAll('.file-checkbox').forEach(cb => cb.checked = isChecked);
    });

    btnClearBay.addEventListener('click', () => {
        if (confirm("Are you sure you want to clear the holding bay?")) {
            holdingBay = [];
            renderTable();
        }
    });

    // --- WebAssembly / Python Engine (Pyodide) ---
    let pyodideInstance = null;
    const headerStatusText = document.getElementById('header-status-text');
    const headerStatusDot = document.getElementById('header-status-dot');

    async function initPyodide() {
        try {
            headerStatusText.textContent = 'LOADING ENGINE...';
            headerStatusDot.classList.replace('bg-emerald-500', 'bg-amber-500');

            // 1. Inject Pyodide script
            if (!window.loadPyodide) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js";
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            // 2. Initialize Pyodide & Install Packages
            const pyodide = await loadPyodide();
            await pyodide.loadPackage("micropip");
            const micropip = pyodide.pyimport("micropip");
            
            headerStatusText.textContent = 'INSTALLING DEPENDENCIES...';
            await micropip.install(["pypdf", "cryptography"]);

            // 3. Fetch Local Python Script
            headerStatusText.textContent = 'MOUNTING LOGIC...';
            const response = await fetch('python/document_engine.py');
            if (!response.ok) throw new Error("Could not load document_engine.py");
            const pyCode = await response.text();
            
            // 4. Run the Python definitions
            await pyodide.runPythonAsync(pyCode);
            
            pyodideInstance = pyodide;
            headerStatusText.textContent = 'SYSTEM ONLINE';
            headerStatusDot.classList.replace('bg-amber-500', 'bg-emerald-500');
            console.log("GUARDIAN: Pyodide Engine Online.");
        } catch (err) {
            console.error("GUARDIAN: Pyodide initialization failed:", err);
            headerStatusText.textContent = 'ENGINE ERROR';
            headerStatusDot.classList.replace('bg-emerald-500', 'bg-rose-500');
        }
    }

    // Initialize Engine in background without blocking UI
    initPyodide();

    btnUnlock.addEventListener('click', async () => {
        if (!pyodideInstance) return alert("Engine is still loading. Please wait.");
        const passwords = document.getElementById('pdf-password-input').value;
        if (!passwords) return alert("Please enter at least one password to try.");

        btnUnlock.disabled = true;
        btnUnlock.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span class="hidden sm:inline">Processing...</span>';
        if (window.lucide) lucide.createIcons();

        try {
            for (let i = 0; i < holdingBay.length; i++) {
                const fileObj = holdingBay[i];
                if (!fileObj.included) continue;

                const arrayBuffer = await fileObj.file.arrayBuffer();
                const pyUnlock = pyodideInstance.globals.get('unlock_pdf');
                
                // Call Python
                const resultProxy = pyUnlock(arrayBuffer, passwords);
                const result = resultProxy.toJs({ dict_converter: Object.fromEntries });
                resultProxy.destroy();

                if (result.success) {
                    if (result.is_encrypted) {
                        // Create new decrypted file in RAM
                        const blob = new Blob([result.bytes], { type: 'application/pdf' });
                        const newFile = new File([blob], fileObj.file.name.replace('.pdf', '_unlocked.pdf'), { type: 'application/pdf' });
                        fileObj.file = newFile;
                    }
                    fileObj.status = 'unlocked';
                } else {
                    fileObj.status = 'error';
                    console.warn(`Failed to unlock ${fileObj.file.name}: ${result.error}`);
                }
            }
        } catch (e) {
            console.error(e);
            alert("A critical error occurred during unlocking.");
        }

        btnUnlock.innerHTML = '<i data-lucide="unlock" class="w-4 h-4"></i><span class="hidden sm:inline">Unlock</span>';
        btnUnlock.disabled = false;
        renderTable();
    });

    btnScan.addEventListener('click', async () => {
        if (!pyodideInstance) return alert("Engine is still loading. Please wait.");
        const docType = document.getElementById('pdf-doc-type').value;

        btnScan.disabled = true;
        btnScan.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Scanning...</span>';
        if (window.lucide) lucide.createIcons();

        try {
            for (let i = 0; i < holdingBay.length; i++) {
                const fileObj = holdingBay[i];
                if (!fileObj.included) continue;

                const arrayBuffer = await fileObj.file.arrayBuffer();
                const pyScan = pyodideInstance.globals.get('scan_pdf_date');
                
                const resultProxy = pyScan(arrayBuffer, docType);
                const result = resultProxy.toJs({ dict_converter: Object.fromEntries });
                resultProxy.destroy();

                if (result.success) {
                    fileObj.detectedDate = result.date;
                    // Reset error status if it succeeded
                    if (fileObj.status === 'error') fileObj.status = 'pending';
                } else {
                    fileObj.status = 'error';
                    fileObj.detectedDate = result.error;
                }
            }
        } catch (e) {
            console.error(e);
            alert("A critical error occurred during scanning.");
        }

        btnScan.innerHTML = '<i data-lucide="calendar-search" class="w-4 h-4"></i><span>Scan Dates & Sort</span>';
        btnScan.disabled = false;
        
        // Auto-sort chronologically (Basic string sort handles YYYY/MM/DD well)
        holdingBay.sort((a, b) => {
            if (!a.detectedDate) return 1;
            if (!b.detectedDate) return -1;
            return a.detectedDate.localeCompare(b.detectedDate);
        });

        renderTable();
    });

    btnMerge.addEventListener('click', async () => {
        if (!pyodideInstance) return alert("Engine is still loading. Please wait.");
        const selectedFiles = holdingBay.filter(f => f.included);
        if (selectedFiles.length === 0) return alert("No files selected to merge.");

        btnMerge.disabled = true;
        btnMerge.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Merging...</span>';
        if (window.lucide) lucide.createIcons();

        try {
            const fileMap = new Map();
            for (const f of selectedFiles) {
                fileMap.set(f.file.name, await f.file.arrayBuffer());
            }

            const pyMerge = pyodideInstance.globals.get('merge_pdfs');
            const resultProxy = pyMerge(fileMap);
            const result = resultProxy.toJs({ dict_converter: Object.fromEntries });
            resultProxy.destroy();

            if (result.success) {
                // Trigger Download
                const blob = new Blob([result.bytes], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Merged_History_${new Date().getTime()}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                alert("Merge Complete! File downloaded.");
            } else {
                alert(`Merge Failed: ${result.error}`);
            }
        } catch (e) {
            console.error(e);
            alert("A critical error occurred during merging.");
        }

        btnMerge.innerHTML = '<i data-lucide="layers" class="w-4 h-4"></i><span>Merge Selected</span>';
        btnMerge.disabled = false;
        renderTable();
    });

    // --- Document AI Extraction Groundwork ---
    
    // Utility: Convert raw ArrayBuffer to Base64 for Google Cloud API payloads
    function arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    if (btnExtractExcel) {
        btnExtractExcel.addEventListener('click', async () => {
            const selectedFiles = holdingBay.filter(f => f.included);
            if (selectedFiles.length === 0) return alert("No files selected for extraction.");
            
            btnExtractExcel.disabled = true;
            const originalText = btnExtractExcel.innerHTML;
            btnExtractExcel.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Preparing AI Payload...</span>';
            if (window.lucide) lucide.createIcons();
            
            try {
                console.log(`GUARDIAN EVENT: Initiating AI Extraction for ${selectedFiles.length} files...`);
                
                for (const fileObj of selectedFiles) {
                    // 1. Get raw bytes securely from local RAM
                    const arrayBuffer = await fileObj.file.arrayBuffer();
                    
                    // 2. Convert to Base64 (Required format for GCP Document AI)
                    const base64Data = arrayBufferToBase64(arrayBuffer);
                    
                    console.log(`[Document AI Stub] Payload prepared for: ${fileObj.file.name}`);
                    console.log(`[Document AI Stub] Base64 String Length: ${base64Data.length} characters`);
                    
                    // --- GUARDIAN SECURITY UPGRADE ---
                    // Request the active session token from our Firebase Auth implementation in app.js
                    const authToken = await window.getGuardianAuthToken();
                    if (!authToken) {
                        throw new Error("Authentication Token missing. Please lock and unlock the workspace to establish a secure session.");
                    }
                    
                    // 3. LIVE FIREBASE FUNCTION CALL (NOW SECURED)
                    const response = await fetch('https://extractbankdata-lrg33w5mda-uc.a.run.app', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}` 
                        },
                        body: JSON.stringify({ 
                            filename: fileObj.file.name, 
                            documentType: document.getElementById('pdf-doc-type').value,
                            documentBase64: base64Data 
                        })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.error || 'Unknown error occurred during AI extraction.');
                    }

                    console.log(`[Document AI Bridge] Extraction Success: Found ${data.tableCount} tables.`);

                    // 4. Construct and Download the CSV File
                    const csvBlob = new Blob([data.csvData], { type: 'text/csv;charset=utf-8;' });
                    const csvUrl = URL.createObjectURL(csvBlob);
                    
                    const downloadLink = document.createElement('a');
                    downloadLink.href = csvUrl;
                    downloadLink.setAttribute('download', `Extracted_${fileObj.file.name.replace('.pdf', '')}.csv`);
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                    URL.revokeObjectURL(csvUrl);
                }

                alert("AI Extraction Complete! Your structured data files have been downloaded.");
            } catch (err) {
                console.error("Extraction preparation failed:", err);
                alert(`A critical error occurred during AI extraction: ${err.message}`);
            } finally {
                btnExtractExcel.innerHTML = originalText;
                btnExtractExcel.disabled = false;
                if (window.lucide) lucide.createIcons();
            }
        });
    }

    // --- Initial Render ---
    renderTable();
});