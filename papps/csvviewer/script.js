document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------------------
    // Configuration & State
    // ----------------------------------------------------------------
    const state = {
        csvData: [],
        headers: [],
        filteredData: [],
        currentLang: localStorage.getItem('csvViewerLang') || 'ja'
    };

    // ----------------------------------------------------------------
    // i18n Dictionary
    // ----------------------------------------------------------------
    const i18nData = {
        ja: {
            appTitle: "CSV Viewer",
            pdfExport: "PDF書き出し",
            pdfExportDesc: "現在の表示内容をPDFとして出力します",
            csvSelect: "CSVを選択",
            csvSelectDesc: "CSVファイルを選択するか、ここにドラッグ＆ドロップしてください",
            searchPlaceholder: "テーブル内全体を検索...",
            filterColumnSelect: "フィルターする列を選択...",
            dropZoneText: "ここにCSVファイルをドロップ",
            tableInitialText: "ここにCSVデータが表示されます",
            emptyStateText: "右上の「CSVを選択」ボタンからファイルを選ぶか<br>ここにファイルをドラッグ＆ドロップしてください。",
            modalHint: "※行をクリックで詳細表示（モーダル）",
            modalTitle: "行の詳細データ",
            modalClose: "閉じる",
            generatingPdf: "PDFを作成中... (データ量により時間がかかります)"
        },
        en: {
            appTitle: "CSV Viewer",
            pdfExport: "Export PDF",
            pdfExportDesc: "Export current table view as PDF",
            csvSelect: "Select CSV",
            csvSelectDesc: "Select a CSV file or drag and drop it here",
            searchPlaceholder: "Search entire table...",
            filterColumnSelect: "Select column to filter...",
            dropZoneText: "Drop CSV file here",
            tableInitialText: "CSV data will be displayed here",
            emptyStateText: "Please select a file from \"Select CSV\" button<br>Or drag and drop a file here.",
            modalHint: "*Click row for details (Modal)",
            modalTitle: "Row Details",
            modalClose: "Close",
            generatingPdf: "Generating PDF... (May take a while for large data)"
        }
    };

    // ----------------------------------------------------------------
    // DOM Elements
    // ----------------------------------------------------------------
    const fileInput = document.getElementById('csv-file-input');
    const dropZone = document.getElementById('drop-zone');
    const dropOverlay = document.getElementById('drop-overlay');
    const searchInput = document.getElementById('search-input');

    const thead = document.getElementById('csv-thead');
    const tbody = document.getElementById('csv-tbody');
    const recordCountDisplay = document.getElementById('record-count');
    const loadingOverlay = document.getElementById('loading-overlay');

    const pdfExportBtn = document.getElementById('pdf-export-btn');
    const advancedFilterWrapper = document.getElementById('advanced-filter-wrapper');
    const columnSelect = document.getElementById('column-select');
    const categoryCheckboxContainer = document.getElementById('category-checkbox-container');

    // Modal Elements
    const detailModal = document.getElementById('detail-modal');
    const modalCloseBtn = document.getElementById('modal-close');
    const modalCancelBtn = document.getElementById('modal-cancel');
    const modalBodyContent = document.getElementById('modal-body-content');

    // Utilities (/appfinal)
    const xShareBtn = document.getElementById('x-share-btn');

    // ----------------------------------------------------------------
    // i18n Logic
    // ----------------------------------------------------------------
    function applyLanguage(lang) {
        state.currentLang = lang;
        localStorage.setItem('csvViewerLang', lang);

        const dict = i18nData[lang];

        // Update simple text nodes
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                el.innerHTML = dict[key];
            }
        });

        // Update placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (dict[key]) {
                el.placeholder = dict[key];
            }
        });

        // Update titles
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (dict[key]) {
                el.title = dict[key];
            }
        });

        // Update dynamic record count (if table has data)
        updateRecordCount(state.filteredData.length); // Pass current filtered count
    }

    // Apply initially
    applyLanguage(state.currentLang);

    // X (Twitter) Share Listener
    xShareBtn.addEventListener('click', () => {
        const currentUrl = encodeURIComponent(window.location.href);
        const text = encodeURIComponent("ドラッグ&ドロップで表示出来る、シンプルCSVビューワー\n");
        const xUrl = `https://twitter.com/intent/tweet?text=${text}&url=${currentUrl}&hashtags=CSVViewer`;
        window.open(xUrl, '_blank', 'noopener,noreferrer');
    });

    // ----------------------------------------------------------------
    // Feature Logic
    // ----------------------------------------------------------------

    // === State ===
    // let csvData = []; // Moved to state object
    // let headers = []; // Moved to state object
    let filterColumn = ""; // The currently chosen column for checkbox filtering
    let checkedCategories = new Set(); // Stores checked values for the current filter column

    // === Event Listeners ===

    // 1. File Input (Click to upload)
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
        // Reset input so the same file can be selected again if needed
        e.target.value = '';
    });

    // 2. Drag & Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropOverlay.classList.remove('hidden');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            if (e.type === 'dragleave' && dropZone.contains(e.relatedTarget)) {
                return;
            }
            dropOverlay.classList.add('hidden');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    }, false);

    // 3. Search, Column Select, and Checkboxes Filters
    searchInput.addEventListener('input', applyFilters);
    columnSelect.addEventListener('change', (e) => {
        setupCategoryCheckboxes(e.target.value);
        applyFilters();
    });

    // Checkboxes are dynamically created, so we use event delegation on their container
    categoryCheckboxContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('form-checkbox-input')) {
            const val = e.target.value;
            if (e.target.checked) {
                checkedCategories.add(val);
            } else {
                checkedCategories.delete(val);
            }
            applyFilters();
        }
    });

    // 4. Modal constraints
    modalCloseBtn.addEventListener('click', closeModal);
    modalCancelBtn.addEventListener('click', closeModal);
    // Click outside modal to close
    detailModal.addEventListener('click', (e) => {
        if (e.target === detailModal) {
            closeModal();
        }
    });
    // Escape key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !detailModal.classList.contains('hidden')) {
            closeModal();
        }
    });

    // 5. PDF Export
    pdfExportBtn.addEventListener('click', exportToPDF);

    // === Core Functions ===

    /**
     * Processes the selected/dropped file and detects encoding before parsing
     */
    function handleFile(file) {
        if (file.type !== 'text/csv' && !file.name.endsWith('.csv') && !file.name.endsWith('.CSV')) {
            alert('CSVファイルを選択してください。');
            return;
        }

        loadingOverlay.classList.remove('hidden');
        searchInput.value = ''; // Reset UI states
        columnSelect.innerHTML = '<option value="" selected>フィルターする列を選択...</option>';
        categoryCheckboxContainer.innerHTML = '';
        categoryCheckboxContainer.classList.add('hidden');
        advancedFilterWrapper.classList.add('hidden');
        pdfExportBtn.classList.add('hidden');
        filterColumn = "";
        checkedCategories.clear();

        // Detect Encoding before Parsing
        detectEncoding(file).then(encoding => {
            console.log(`Detected encoding: ${encoding}`);
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                encoding: encoding,
                error: (err, file) => {
                    console.error('PapaParse error:', err);
                    alert('ファイルのパースに失敗しました。');
                    loadingOverlay.classList.add('hidden');
                },
                complete: (results) => {
                    if (results.errors && results.errors.length > 0) {
                        console.warn('Parse warnings/errors:', results.errors);
                    }

                    state.csvData = results.data;
                    state.headers = results.meta.fields || (state.csvData.length > 0 ? Object.keys(state.csvData[0]) : []);
                    state.filteredData = [...state.csvData]; // Initialize filtered data

                    setupColumnSelectOptions();
                    renderTable(state.headers, state.csvData);

                    pdfExportBtn.classList.remove('hidden');
                    loadingOverlay.classList.add('hidden');
                }
            });
        }).catch(err => {
            console.error('Failed to detect encoding:', err);
            loadingOverlay.classList.add('hidden');
        });
    }

    /**
     * Helper: reads the first few KB of a file and tries to decode it as UTF-8.
     * If TextDecoder throws an error (or spots replacement characters in strict scenarios, 
     * although JS TextDecoder ignores standard replacement by default without fatal flag), 
     * it falls back to Shift_JIS.
     */
    function detectEncoding(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            // Read only the first 2KB for performance, usually enough to hit multibyte chars
            const slice = file.slice(0, 2048);

            reader.onload = (e) => {
                const buffer = e.target.result;
                const view = new Uint8Array(buffer);

                try {
                    // fatal: true ensures it throws an error if invalid UTF-8 sequences are found
                    const decoder = new TextDecoder('utf-8', { fatal: true });
                    decoder.decode(view);
                    resolve('UTF-8');
                } catch (err) {
                    // It threw an error, implying there are non-UTF8 (likely Shift_JIS) bytes
                    resolve('Shift_JIS');
                }
            };

            reader.onerror = (err) => {
                reject(err);
            };

            reader.readAsArrayBuffer(slice);
        });
    }

    /**
     * Renders the HTML table based on data
     */
    function renderTable(tableHeaders, tableData) {
        thead.innerHTML = '';
        tbody.innerHTML = '';

        if (!tableHeaders || tableHeaders.length === 0 || tableData.length === 0) {
            thead.innerHTML = `<tr><th>データがありません</th></tr>`;
            tbody.innerHTML = `<tr class="empty-row"><td class="empty-state">有効なデータが見つかりませんでした。</td></tr>`;
            recordCountDisplay.textContent = `0件のレコード`;
            return;
        }

        // Render Header
        const trHead = document.createElement('tr');
        tableHeaders.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            trHead.appendChild(th);
        });
        thead.appendChild(trHead);

        // Render Body
        const fragment = document.createDocumentFragment();

        tableData.forEach((rowObj, index) => {
            const trBody = document.createElement('tr');
            trBody.dataset.rowIndex = index;

            tableHeaders.forEach(col => {
                const td = document.createElement('td');
                td.textContent = rowObj[col] !== undefined && rowObj[col] !== null ? rowObj[col] : '';
                trBody.appendChild(td);
            });

            trBody.addEventListener('click', () => {
                openModal(index);
            });

            fragment.appendChild(trBody);
        });

        tbody.appendChild(fragment);
        updateRecordCount(tableData.length);
    }

    /**
     * Populates the column selection dropdown based on parsed headers.
     */
    function setupColumnSelectOptions() {
        if (!state.headers || state.headers.length === 0) return;

        state.headers.forEach(header => {
            const option = document.createElement('option');
            option.value = header;
            option.textContent = header;
            columnSelect.appendChild(option);
        });

        advancedFilterWrapper.classList.remove('hidden');
    }

    /**
     * Extracts unique values for the chosen column and builds checkboxes
     */
    function setupCategoryCheckboxes(columnName) {
        filterColumn = columnName;
        checkedCategories.clear();
        categoryCheckboxContainer.innerHTML = '';

        if (!columnName || !state.csvData || state.csvData.length === 0) {
            categoryCheckboxContainer.classList.add('hidden');
            return;
        }

        const uniqueVals = new Set();
        const MAX_CATEGORIES = 200; // Cap to avoid massive DOM trees

        for (let i = 0; i < state.csvData.length; i++) {
            const val = (state.csvData[i][columnName] || '').toString().trim();
            if (val !== '') {
                uniqueVals.add(val);
            }
            if (uniqueVals.size > MAX_CATEGORIES) break;
        }

        if (uniqueVals.size > 0 && uniqueVals.size <= MAX_CATEGORIES) {
            const sortedVals = Array.from(uniqueVals).sort();

            const fragment = document.createDocumentFragment();
            sortedVals.forEach(val => {
                const label = document.createElement('label');
                label.className = 'form-checkbox-label';

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.className = 'form-checkbox-input';
                input.value = val;

                label.appendChild(input);
                label.appendChild(document.createTextNode(val));
                fragment.appendChild(label);
            });

            categoryCheckboxContainer.appendChild(fragment);
            categoryCheckboxContainer.classList.remove('hidden');
        } else if (uniqueVals.size > MAX_CATEGORIES) {
            const msg = document.createElement('div');
            msg.style.color = 'var(--text-secondary)';
            msg.style.fontSize = '0.85rem';
            msg.textContent = 'カテゴリ種類が多すぎるため表示できません。';
            categoryCheckboxContainer.appendChild(msg);
            categoryCheckboxContainer.classList.remove('hidden');
        } else {
            categoryCheckboxContainer.classList.add('hidden');
        }
    }

    /**
     * Filters DOM table rows depending on category checkboxes AND text search
     */
    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();

        const rows = Array.from(tbody.querySelectorAll('tr:not(.empty-row)'));
        let visibleCount = 0;
        state.filteredData = []; // Reset filtered data for state

        rows.forEach(row => {
            const rowIndex = row.dataset.rowIndex;
            const rowData = state.csvData[rowIndex];

            // 1. Column Checkboxes Filter (OR logic among checked boxes)
            let passesCheckboxes = true;
            if (filterColumn && checkedCategories.size > 0) {
                const cellValue = (rowData[filterColumn] || '').toString().trim();
                // If the checked categories set does not have this cell's value, hide it
                if (!checkedCategories.has(cellValue)) {
                    passesCheckboxes = false;
                }
            }

            // 2. Search text check (across all text content in row)
            let passesSearch = true;
            if (searchTerm) {
                const textContent = row.textContent.toLowerCase();
                passesSearch = textContent.includes(searchTerm);
            }

            if (passesCheckboxes && passesSearch) {
                row.style.display = '';
                visibleCount++;
                state.filteredData.push(rowData); // Add to filtered data
            } else {
                row.style.display = 'none';
            }
        });

        updateRecordCount(visibleCount);
    }

    function updateRecordCount(count) {
        const suffix = state.currentLang === 'ja' ? '件のレコード' : ' records';
        recordCountDisplay.textContent = `${count.toLocaleString()}${suffix}`;
    }

    /**
     * Modal controls
     */
    function openModal(rowIndex) {
        const record = state.csvData[rowIndex];
        if (!record) return;

        modalBodyContent.innerHTML = '';
        const fragment = document.createDocumentFragment();

        headers.forEach(key => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'detail-row';

            const keyDiv = document.createElement('div');
            keyDiv.className = 'detail-key';
            keyDiv.textContent = key;

            const valueDiv = document.createElement('div');
            valueDiv.className = 'detail-value';
            valueDiv.textContent = record[key] !== undefined && record[key] !== null && record[key] !== "" ? record[key] : '(空)';

            rowDiv.appendChild(keyDiv);
            rowDiv.appendChild(valueDiv);
            fragment.appendChild(rowDiv);
        });

        modalBodyContent.appendChild(fragment);
        detailModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        detailModal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    /**
     * Exports the visible table area to PDF using html2pdf
     * Optimized for large tables with scale reduction and pagebreak rules
     */
    function exportToPDF() {
        const element = document.getElementById('pdf-content');

        // Show loading
        const msg = document.querySelector('#loading-overlay p');
        const origMsg = msg.textContent;
        msg.textContent = 'PDFを作成中... (データ量により時間がかかります)';
        loadingOverlay.classList.remove('hidden');

        // Let UI update
        setTimeout(() => {
            // Calculate scale to fit A4 Landscape width (297mm is approx 1122px at 96dpi)
            // We use a safe target targetWidth around 1080px to account for margins
            const targetWidth = 1080;
            const tableWidth = element.scrollWidth;
            let dynamicScale = 1;

            if (tableWidth > targetWidth) {
                dynamicScale = targetWidth / tableWidth;
            }

            const opt = {
                margin: 10,
                filename: 'csv_export.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                // scale: dynamically shrinks the generated canvas to fit within A4
                // windowWidth/width: forces canvas to capture the entire scrollable width
                // x, y, scrollX, scrollY: enforces capture to start exactly from the top-left, preventing left-side cutoff
                html2canvas: {
                    scale: dynamicScale,
                    useCORS: true,
                    windowWidth: tableWidth,
                    width: tableWidth,
                    x: 0,
                    y: 0,
                    scrollX: 0,
                    scrollY: 0
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
                // avoid slicing table rows in half
                pagebreak: { mode: 'css', avoid: 'tr' }
            };

            // Allow the table to expand to full height so it gets captured fully
            const origMaxHeight = element.style.maxHeight;
            const origOverflow = element.style.overflow;
            element.style.maxHeight = 'none';
            element.style.overflow = 'visible';

            html2pdf().set(opt).from(element).save().then(() => {
                // Restore state
                element.style.maxHeight = origMaxHeight;
                element.style.overflow = origOverflow;

                msg.textContent = origMsg;
                loadingOverlay.classList.add('hidden');
            }).catch(err => {
                console.error("PDF Export failed:", err);
                alert("PDF書き出しに失敗しました。\n(データが多すぎる場合、ブラウザの描画上限を超越した可能性があります)");

                // Restore state
                element.style.maxHeight = origMaxHeight;
                element.style.overflow = origOverflow;

                msg.textContent = origMsg;
                loadingOverlay.classList.add('hidden');
            });
        }, 300);
    }
});
