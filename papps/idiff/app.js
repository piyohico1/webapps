document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropZone1 = document.getElementById('drop-zone1');
    const dropZone2 = document.getElementById('drop-zone2');
    const fileInput1 = document.getElementById('file-input1');
    const fileInput2 = document.getElementById('file-input2');
    const uploadSection = document.getElementById('upload-section');
    const comparisonContainer = document.getElementById('comparison-container');
    const imageWrapper = document.getElementById('image-wrapper');
    const image1 = document.getElementById('image1');
    const image2 = document.getElementById('image2');
    const label1 = document.getElementById('label1');
    const label2 = document.getElementById('label2');
    const label1Text = label1.querySelector('.label-text');
    const label1Res = label1.querySelector('.label-resolution');
    const label2Text = label2.querySelector('.label-text');
    const label2Res = label2.querySelector('.label-resolution');
    const sliderHandle = document.getElementById('slider-handle');
    const sliderKnob = sliderHandle.querySelector('.slider-knob');
    const modeBtns = document.querySelectorAll('.mode-btn');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const resetBtn = document.getElementById('reset-view');
    const fitBtn = document.getElementById('fit-view');
    const zoomLevelDisplay = document.getElementById('zoom-level');
    const themeToggle = document.getElementById('theme-toggle');
    const archiveBtn = document.getElementById('archive-btn');
    const historyModal = document.getElementById('history-modal');
    const closeHistoryModalBtn = document.getElementById('close-history-modal');
    const historyList = document.getElementById('history-list');
    const textBtn = document.getElementById('text-btn');
    const textModal = document.getElementById('text-modal');
    const closeTextModalBtn = document.getElementById('close-text-modal');
    const saveLabelsBtn = document.getElementById('save-labels-btn');
    const labelInput1 = document.getElementById('label-input-1');
    const labelInput2 = document.getElementById('label-input-2');

    // Confirm Modal Elements
    const confirmModal = document.getElementById('confirm-modal');
    const closeConfirmModalBtn = document.getElementById('close-confirm-modal');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    let itemToDeleteId = null;

    // Create Drag Overlay
    const dragOverlay = document.createElement('div');
    dragOverlay.className = 'drag-overlay';
    dragOverlay.innerHTML = `
        <div class="drag-zone" id="replace-zone-1">Replace Image 1</div>
        <div class="drag-zone" id="replace-zone-2">Replace Image 2</div>
    `;
    comparisonContainer.appendChild(dragOverlay);
    const replaceZone1 = dragOverlay.querySelector('#replace-zone-1');
    const replaceZone2 = dragOverlay.querySelector('#replace-zone-2');

    // State
    const state = {
        img1Loaded: false,
        img2Loaded: false,
        mode: 'slider',
        zoom: 1,
        panX: 0,
        panY: 0,
        isDraggingSlider: false,
        sliderPosition: 50,
        isPanning: false,
        lastMouseX: 0,
        lastMouseY: 0,
        lastMouseY: 0,
        isDarkTheme: localStorage.getItem('image_diff_theme') !== 'light', // Default to dark if not set or set to 'dark'
        currentFile1: null,
        currentFile2: null,
        lastTouchDist: 0,
        lastTouchX: 0,
        lastTouchY: 0,
        labelsVisible: true
    };

    // --- IndexedDB Logic ---
    let db;
    const DB_NAME = 'ImageDiffDB';
    const STORE_NAME = 'comparisons';
    const initDB = () => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true }).createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        request.onsuccess = (event) => { db = event.target.result; };
        request.onerror = (event) => { console.error('IndexedDB error:', event.target.errorCode); };
    };
    const saveComparison = async () => {
        if (!db || !state.currentFile1 || !state.currentFile2) return;

        // Use current labels or defaults
        const t = translations[state.lang];
        const currentLabel1 = label1Text.textContent || t.defaultBefore;
        const currentLabel2 = label2Text.textContent || t.defaultAfter;

        const item = {
            timestamp: Date.now(),
            file1: state.currentFile1,
            file2: state.currentFile2,
            name1: state.currentFile1.name,
            name2: state.currentFile2.name,
            label1: currentLabel1,
            label2: currentLabel2
        };

        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(item);

        request.onsuccess = (event) => {
            state.currentComparisonId = event.target.result;
        };
    };

    const updateComparisonLabels = (id, newLabel1, newLabel2) => {
        if (!db || !id) return;
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = (event) => {
            const data = event.target.result;
            if (data) {
                data.label1 = newLabel1;
                data.label2 = newLabel2;
                // Optionally update names if we want list to reflect labels, but keeping filenames vs labels distinct is usually better.
                // However, for user convenience, showing labels in history list might be nice. 
                // For now, let's keep name1/name2 as filenames, but we could update them if desired.
                // data.name1 = newLabel1; // Uncomment if history list should show labels
                // data.name2 = newLabel2;
                store.put(data);
            }
        };

        transaction.oncomplete = () => {
            // Optional: refresh history list if it's open
            if (historyModal.open) updateHistoryList();
        };
    };

    const getHistory = (callback) => {
        if (!db) { callback([]); return; }
        const items = [];
        db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).openCursor(null, 'prev').onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) { items.push(cursor.value); cursor.continue(); } else { callback(items); }
        };
    };
    const deleteComparison = (id, callback) => {
        if (!db) return;
        const request = db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).delete(id);
        request.onsuccess = () => { if (callback) callback(); };
    };
    initDB();

    // --- Helper for Backdrop Click ---
    const setupBackdropClose = (modal) => {
        let mouseDownTarget = null;
        modal.addEventListener('mousedown', (e) => {
            mouseDownTarget = e.target;
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal && mouseDownTarget === modal) {
                modal.close();
            }
            mouseDownTarget = null;
        });
    };

    // --- History Modal ---
    archiveBtn.addEventListener('click', () => { updateHistoryList(); historyModal.showModal(); });
    closeHistoryModalBtn?.addEventListener('click', () => historyModal.close());
    setupBackdropClose(historyModal);

    // --- Confirm Modal Logic ---
    const closeConfirm = () => {
        confirmModal.close();
        itemToDeleteId = null;
    };

    closeConfirmModalBtn.addEventListener('click', closeConfirm);
    cancelDeleteBtn.addEventListener('click', closeConfirm);
    setupBackdropClose(confirmModal);

    confirmDeleteBtn.addEventListener('click', () => {
        if (itemToDeleteId !== null) {
            deleteComparison(itemToDeleteId, () => {
                updateHistoryList();
                closeConfirm();
            });
        }
    });

    function updateHistoryList() {
        historyList.innerHTML = '<div class="empty-state">Loading...</div>';
        getHistory((items) => {
            if (items.length === 0) { historyList.innerHTML = '<div class="empty-state">No history yet</div>'; return; }
            historyList.innerHTML = '';
            items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'history-item';
                const url1 = URL.createObjectURL(item.file1);
                const url2 = URL.createObjectURL(item.file2);

                // Use labels if available and not default, otherwise filenames
                // Check against both languages' defaults to be safe, or just check if it matches current lang's default?
                // Better: check against known defaults.
                const defaults = ["Before", "After", "変更前", "変更後"];
                const display1 = (item.label1 && !defaults.includes(item.label1)) ? item.label1 : item.name1;
                const display2 = (item.label2 && !defaults.includes(item.label2)) ? item.label2 : item.name2;

                div.innerHTML = `
                    <div class="history-thumbs"><img src="${url1}"><img src="${url2}"></div>
                    <div class="history-info">
                        <div class="history-date">${new Date(item.timestamp).toLocaleString()}</div>
                        <div class="history-names">${display1} vs ${display2}</div>
                    </div>
                    <button class="history-delete-btn" title="Delete">🗑️</button>
                `;

                div.addEventListener('click', (e) => {
                    if (e.target.closest('.history-delete-btn')) return;
                    loadHistoryItem(item);
                    historyModal.close();
                });

                const deleteBtn = div.querySelector('.history-delete-btn');
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    itemToDeleteId = item.id;
                    confirmModal.showModal();
                });

                historyList.appendChild(div);
            });
        });
    }

    function loadHistoryItem(item) {
        state.currentFile1 = item.file1;
        state.currentFile2 = item.file2;
        state.currentComparisonId = item.id; // Track current ID

        // FORCE clear/set labels to prevent leaking from previous state
        const t = translations[state.lang];
        const l1 = item.label1 || t.defaultBefore;
        const l2 = item.label2 || t.defaultAfter;

        label1Text.textContent = l1;
        labelInput1.value = l1;

        label2Text.textContent = l2;
        labelInput2.value = l2;

        handleFile(item.file1, image1, null, true, false);
        handleFile(item.file2, image2, null, false, false);
    }

    // --- Text Overlay ---
    textBtn.addEventListener('click', () => {
        state.labelsVisible = !state.labelsVisible;
        label1.classList.toggle('hidden', !state.labelsVisible);
        label2.classList.toggle('hidden', !state.labelsVisible);
        textBtn.classList.toggle('active', state.labelsVisible);
    });
    textBtn.classList.add('active');
    label1.addEventListener('click', () => { labelInput1.value = label1Text.textContent; labelInput2.value = label2Text.textContent; textModal.showModal(); labelInput1.focus(); });
    label2.addEventListener('click', () => { labelInput1.value = label1Text.textContent; labelInput2.value = label2Text.textContent; textModal.showModal(); labelInput2.focus(); });
    closeTextModalBtn.addEventListener('click', () => textModal.close());
    setupBackdropClose(textModal);

    saveLabelsBtn.addEventListener('click', () => {
        const newLabel1 = labelInput1.value;
        const newLabel2 = labelInput2.value;

        label1Text.textContent = newLabel1;
        label2Text.textContent = newLabel2;

        // Update DB if we have an active comparison
        if (state.currentComparisonId) {
            updateComparisonLabels(state.currentComparisonId, newLabel1, newLabel2);
        }

        textModal.close();
    });

    document.getElementById('reset-labels-btn').addEventListener('click', () => {
        const t = translations[state.lang];
        labelInput1.value = t.defaultBefore;
        labelInput2.value = t.defaultAfter;
    });

    themeToggle.addEventListener('click', () => {
        state.isDarkTheme = !state.isDarkTheme;
        const theme = state.isDarkTheme ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('image_diff_theme', theme);
    });

    // Apply initial theme
    document.documentElement.setAttribute('data-theme', state.isDarkTheme ? 'dark' : 'light');

    const translations = {
        en: {
            toggleLabels: "Toggle Labels",
            viewHistory: "View History",
            toggleTheme: "Toggle Theme",
            toggleLang: "Switch to Japanese",
            historyTitle: "Comparison History",
            historyEmpty: "No history yet",
            historyLoading: "Loading...",
            delete: "Delete",
            editLabelsTitle: "Edit Labels",
            label1: "Image 1 Label",
            label2: "Image 2 Label",
            label1Placeholder: "e.g. Before",
            label2Placeholder: "e.g. After",
            save: "Save",
            resetLabels: "Reset to Defaults",
            deleteTitle: "Delete History",
            deleteConfirm: "Are you sure you want to delete this comparison?",
            cancel: "Cancel",
            upload1: "Upload Image 1 (Base)",
            upload2: "Upload Image 2 (Compare)",
            dropHint: "Drag & drop or click to browse",
            mode: "Mode:",
            modeSlider: "Slider",
            modeSide: "Side-by-Side",
            modeDiff: "Difference",
            zoom: "Zoom:",
            opacity: "Opacity:",
            fitView: "Fit to View",
            resetView: "Reset View",
            defaultBefore: "Before",
            defaultAfter: "After",
            replace1: "Replace Image 1",
            replace2: "Replace Image 2",
            shareIntro: "Easily compare images with iDiff"
        },
        ja: {
            toggleLabels: "ラベル表示切替",
            viewHistory: "履歴を表示",
            toggleTheme: "テーマ切替",
            toggleLang: "Switch to English",
            historyTitle: "比較履歴",
            historyEmpty: "履歴はありません",
            historyLoading: "読み込み中...",
            delete: "削除",
            editLabelsTitle: "ラベル編集",
            label1: "画像1 ラベル",
            label2: "画像2 ラベル",
            label1Placeholder: "例: 変更前",
            label2Placeholder: "例: 変更後",
            save: "保存",
            resetLabels: "初期値に戻す",
            deleteTitle: "履歴の削除",
            deleteConfirm: "この比較履歴を削除してもよろしいですか？",
            cancel: "キャンセル",
            upload1: "画像1 (変更前)",
            upload2: "画像2 (変更後)",
            dropHint: "ドラッグ&ドロップ またはクリックして選択",
            mode: "モード:",
            modeSlider: "スライダー",
            modeSide: "横並び",
            modeDiff: "差分",
            zoom: "ズーム:",
            opacity: "不透明度:",
            fitView: "全体表示",
            resetView: "リセット",
            defaultBefore: "変更前",
            defaultAfter: "変更後",
            replace1: "画像1を置換",
            replace2: "画像2を置換",
            shareIntro: "画像比較ツール「iDiff」で画像を比較！"
        }
    };

    // Lang State
    state.lang = localStorage.getItem('image_diff_lang') || 'ja'; // Default to Japanese

    function setLanguage(lang) {
        state.lang = lang;
        localStorage.setItem('image_diff_lang', lang);
        document.getElementById('lang-toggle').textContent = lang === 'en' ? 'EN' : 'JA';
        updateTexts();
    }

    function updateTexts() {
        const t = translations[state.lang];

        // Data attributes
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key]) el.textContent = t[key];
        });

        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (t[key]) el.title = t[key];
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (t[key]) el.placeholder = t[key];
        });

        // Dynamic Elements that might need manual update if initialized
        if (textBtn) textBtn.title = t.toggleLabels;

        // Drag Overlay
        const replaceZone1 = document.getElementById('replace-zone-1');
        const replaceZone2 = document.getElementById('replace-zone-2');
        if (replaceZone1) replaceZone1.textContent = t.replace1;
        if (replaceZone2) replaceZone2.textContent = t.replace2;
    }

    document.getElementById('lang-toggle').addEventListener('click', () => {
        setLanguage(state.lang === 'en' ? 'ja' : 'en');
    });

    document.getElementById('share-x-btn').addEventListener('click', () => {
        const t = translations[state.lang];
        const text = t.shareIntro;
        const url = window.location.href;
        const hashtag = '#iDiff';

        // Format: Intro + \n + URL + \n + #appname
        const shareText = `${text}\n${url}\n${hashtag}`;
        const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

        window.open(tweetUrl, '_blank');
    });

    // --- Upload ---
    function handleFile(file, imgElement, dropZone, isImg1, autoSave = true) {
        if (!file || !file.type.startsWith('image/')) return;
        if (isImg1) state.currentFile1 = file; else state.currentFile2 = file;

        // Reset ID if uploading new files (not loading from history)
        if (autoSave) state.currentComparisonId = null;

        const reader = new FileReader();
        reader.onload = (e) => { imgElement.src = e.target.result; };
        reader.readAsDataURL(file);
        imgElement.onload = () => {
            if (isImg1) state.img1Loaded = true; else state.img2Loaded = true;
            if (dropZone) { dropZone.classList.add('active'); dropZone.querySelector('p').textContent = file.name; }
            const labelText = isImg1 ? label1Text : label2Text;
            const labelInput = isImg1 ? labelInput1 : labelInput2;
            const labelRes = isImg1 ? label1Res : label2Res;

            const t = translations[state.lang];
            const defaultText = isImg1 ? t.defaultBefore : t.defaultAfter;

            // Only set default if empty (allows loadHistoryItem to pre-set labels)
            if (!labelText.textContent) {
                labelText.textContent = defaultText;
                labelInput.value = labelText.textContent;
            }
            // Ensure inputs are synced if text is set
            if (labelText.textContent && !labelInput.value) {
                labelInput.value = labelText.textContent;
            }

            labelRes.textContent = `${imgElement.naturalWidth} × ${imgElement.naturalHeight}`;
            checkReady(autoSave);
            if (uploadSection.style.display === 'none' && state.mode !== 'side-by-side') requestAnimationFrame(() => fitView());
        };
    }
    function setupDropZone(dropZone, fileInput, imgElement, isImg1) {
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('active'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('active'));
        dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('active'); handleFile(e.dataTransfer.files[0], imgElement, dropZone, isImg1); });
        fileInput.addEventListener('change', (e) => { handleFile(e.target.files[0], imgElement, dropZone, isImg1); });
    }
    setupDropZone(dropZone1, fileInput1, image1, true);
    setupDropZone(dropZone2, fileInput2, image2, false);

    window.addEventListener('dragover', (e) => { e.preventDefault(); if (uploadSection.style.display === 'none') dragOverlay.classList.add('active'); });
    dragOverlay.addEventListener('dragleave', (e) => { if (e.target === dragOverlay) dragOverlay.classList.remove('active'); });
    window.addEventListener('dragleave', (e) => { if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) dragOverlay.classList.remove('active'); });
    window.addEventListener('drop', (e) => { e.preventDefault(); dragOverlay.classList.remove('active'); });
    function setupReplaceZone(zone, imgElement, isImg1) {
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('drag-over'); dragOverlay.classList.remove('active'); handleFile(e.dataTransfer.files[0], imgElement, null, isImg1); });
    }
    setupReplaceZone(replaceZone1, image1, true);
    setupReplaceZone(replaceZone2, image2, false);

    function checkReady(autoSave = true) {
        if (state.img1Loaded && state.img2Loaded) {
            uploadSection.style.display = 'none';
            comparisonContainer.classList.remove('hidden');
            if (!state.hasInitialFit) { setTimeout(fitView, 100); state.hasInitialFit = true; }
            updateMode();
            if (autoSave) saveComparison();
        }
    }

    // --- Comparison ---
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const prevMode = state.mode;
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.mode = btn.dataset.mode;
            updateMode(prevMode);
        });
    });

    function getFitZoomVal() {
        if (!image1.complete || image1.naturalWidth === 0) return 1;
        const containerRect = comparisonContainer.getBoundingClientRect();
        const padding = 40;
        // Calculate fit zoom relative to natural size (Slider logic)
        return Math.min((containerRect.width - padding) / image1.naturalWidth, (containerRect.height - padding) / image1.naturalHeight);
    }

    function updateMode(prevMode) {
        // Clear all mode classes
        comparisonContainer.classList.remove('mode-slider', 'mode-side', 'mode-diff');

        // Handle Zoom Conversion
        // Slider/Diff use Natural coordinates. Side uses Container coordinates (1.0 = fit).
        // FitVal = Scale to make Natural fit in Container.
        const fitVal = getFitZoomVal();

        if (prevMode && state.mode !== prevMode) {
            // Check if we are effectively "at fit" before conversion
            // Tolerance for floating point/layout minor shifts
            const epsilon = 0.05; // 5% tolerance
            let isAtFit = false;

            if (prevMode === 'side-by-side') {
                // Was at fit if zoom is close to 1.0 (Side fit)
                if (Math.abs(state.zoom - 1.0) < epsilon) isAtFit = true;
            } else {
                // Was at fit if zoom is close to fitVal (Slider fit)
                if (Math.abs(state.zoom - fitVal) < epsilon) isAtFit = true;
            }

            if (isAtFit) {
                // Snap to new fit
                if (state.mode === 'side-by-side') {
                    // Fit in Side mode is 1.0
                    state.zoom = 1.0;
                } else {
                    // Fit in Slider mode is fitVal
                    state.zoom = fitVal;
                }
            } else {
                // Standard conversion for non-fit states
                if (prevMode === 'side-by-side' && state.mode !== 'side-by-side') {
                    // Side (1.0 = Fit) -> Slider (FitVal = Fit)
                    // NewZoom = OldZoom * FitVal
                    state.zoom = state.zoom * fitVal;
                } else if (prevMode !== 'side-by-side' && state.mode === 'side-by-side') {
                    // Slider (FitVal = Fit) -> Side (1.0 = Fit)
                    // NewZoom = OldZoom / FitVal
                    state.zoom = state.zoom / fitVal;
                }
            }

            // Clamp zoom to reasonable limits
            state.zoom = Math.max(0.1, Math.min(50, state.zoom));

            // Reset Pan to center for simplicity as coordinate systems differ wildly
            state.panX = 0;
            state.panY = 0;
        }

        // Add current mode class
        if (state.mode === 'side-by-side') {
            comparisonContainer.classList.add('mode-side');
            updateTransform();
        } else if (state.mode === 'slider') {
            comparisonContainer.classList.add('mode-slider');
            updateSliderVisuals();
            updateTransform();
        } else if (state.mode === 'difference') {
            comparisonContainer.classList.add('mode-diff');
            updateTransform();
        }
    }

    function updateSliderVisuals() {
        if (state.mode !== 'slider') return;
        const p = state.sliderPosition;
        image2.style.clipPath = `polygon(${p}% 0, 100% 0, 100% 100%, ${p}% 100%)`;
        const wrapperRect = imageWrapper.getBoundingClientRect();
        const containerRect = comparisonContainer.getBoundingClientRect();
        const wrapperLeft = wrapperRect.left - containerRect.left;
        const wrapperTop = wrapperRect.top - containerRect.top;
        const sliderX = wrapperLeft + (wrapperRect.width * (p / 100));
        sliderHandle.style.left = `${sliderX}px`;
        sliderHandle.style.top = `${wrapperTop}px`;
        sliderHandle.style.height = `${wrapperRect.height}px`;
        if (sliderKnob) {
            const centerY = containerRect.height / 2;
            let knobTop = centerY - wrapperTop;
            knobTop = Math.max(0, Math.min(wrapperRect.height, knobTop));
            sliderKnob.style.top = `${knobTop}px`;
        }
    }

    sliderHandle.addEventListener('mousedown', () => state.isDraggingSlider = true);
    window.addEventListener('mouseup', () => { state.isDraggingSlider = false; state.isPanning = false; });
    window.addEventListener('mousemove', (e) => {
        if (state.isDraggingSlider && state.mode === 'slider') {
            const wrapperRect = imageWrapper.getBoundingClientRect();
            state.sliderPosition = Math.max(0, Math.min(100, ((e.clientX - wrapperRect.left) / wrapperRect.width) * 100));
            updateSliderVisuals();
        }
        if (state.isPanning) {
            state.panX += e.clientX - state.lastMouseX;
            state.panY += e.clientY - state.lastMouseY;
            state.lastMouseX = e.clientX; state.lastMouseY = e.clientY;
            updateTransform();
        }
    });
    comparisonContainer.addEventListener('mousedown', (e) => {
        if (e.target !== sliderHandle && !sliderHandle.contains(e.target) && !e.target.closest('.image-label')) {
            state.isPanning = true; state.lastMouseX = e.clientX; state.lastMouseY = e.clientY; e.preventDefault();
        }
    });

    comparisonContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const rect = sliderHandle.getBoundingClientRect();
            if (state.mode === 'slider') {
                const wrapperRect = imageWrapper.getBoundingClientRect();
                const sliderX = wrapperRect.left + wrapperRect.width * (state.sliderPosition / 100);
                if (Math.abs(touch.clientX - sliderX) < 30) { state.isDraggingSlider = true; return; }
            }
            if (!e.target.closest('.image-label')) {
                state.isPanning = true; state.lastTouchX = touch.clientX; state.lastTouchY = touch.clientY;
            }
        } else if (e.touches.length === 2) { state.isPanning = false; state.isDraggingSlider = false; state.lastTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }
    }, { passive: false });

    comparisonContainer.addEventListener('touchmove', (e) => {
        if (e.cancelable) e.preventDefault();
        if (state.isDraggingSlider && state.mode === 'slider') {
            const wrapperRect = imageWrapper.getBoundingClientRect();
            state.sliderPosition = Math.max(0, Math.min(100, ((e.touches[0].clientX - wrapperRect.left) / wrapperRect.width) * 100));
            updateSliderVisuals();
        } else if (state.isPanning && e.touches.length === 1) {
            state.panX += e.touches[0].clientX - state.lastTouchX; state.panY += e.touches[0].clientY - state.lastTouchY;
            state.lastTouchX = e.touches[0].clientX; state.lastTouchY = e.touches[0].clientY;
            updateTransform();
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            if (state.lastTouchDist > 0) { state.zoom = Math.max(0.1, Math.min(50, state.zoom * (dist / state.lastTouchDist))); updateTransform(); }
            state.lastTouchDist = dist;
        }
    }, { passive: false });
    comparisonContainer.addEventListener('touchend', () => { state.isDraggingSlider = false; state.isPanning = false; state.lastTouchDist = 0; });

    function updateTransform() {
        imageWrapper.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
        imageWrapper.style.setProperty('--zoom', state.zoom);
        zoomLevelDisplay.textContent = `${Math.round(state.zoom * 100)}%`;
        if (state.mode === 'slider') updateSliderVisuals();
    }

    function fitView() {
        state.zoom = getFitZoomVal();
        state.panX = 0; state.panY = 0;
        updateTransform();
    }

    zoomInBtn.addEventListener('click', () => { state.zoom *= 1.2; updateTransform(); });
    zoomOutBtn.addEventListener('click', () => { state.zoom /= 1.2; updateTransform(); });
    resetBtn.addEventListener('click', () => { state.zoom = 1; state.panX = 0; state.panY = 0; updateTransform(); });
    fitBtn.addEventListener('click', fitView);
    window.addEventListener('resize', () => { if (state.mode === 'slider') updateSliderVisuals(); });
    comparisonContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = state.zoom * scaleFactor;
        if (newZoom < 0.1 || newZoom > 50) return;
        const rect = comparisonContainer.getBoundingClientRect();
        const mx = e.clientX - rect.left - rect.width / 2;
        const my = e.clientY - rect.top - rect.height / 2;
        state.panX = mx * (1 - scaleFactor) + state.panX * scaleFactor;
        state.panY = my * (1 - scaleFactor) + state.panY * scaleFactor;
        state.zoom = newZoom;
        updateTransform();
    }, { passive: false });

    updateMode();
    setLanguage(state.lang); // Initialize language logic
    if (fileInput1.files.length) handleFile(fileInput1.files[0], image1, dropZone1, true);
    if (fileInput2.files.length) handleFile(fileInput2.files[0], image2, dropZone2, false);
});
