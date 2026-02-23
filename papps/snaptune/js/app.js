document.addEventListener('DOMContentLoaded', () => {
    const processor = new ImageProcessor();
    const canvas = document.getElementById('editor-canvas');
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const downloadBtn = document.getElementById('download-btn');
    const copyBtn = document.getElementById('copy-btn');

    // Zoom State
    let zoomLevel = 1.0;
    const zoomMin = 0.1;
    const zoomMax = 5.0;

    // --- Localization ---
    const i18n = {
        ja: {
            undo: "元に戻す",
            selectImage: "画像を選択",
            copy: "コピー",
            save: "保存",
            share: "Xでシェア",
            dropText: "ここに画像をドロップして開始",
            appDesc: "ブラウザだけで完結する、シンプルな画像編集アプリです。<br>画像をドラッグ＆ドロップ、またはコピペ。",
            featFilter: "✨ 簡易フィルター (明るさ・彩度など)",
            featTransform: "🔄 回転・反転・トリミング",
            featPrivacy: "🔒 プライバシー保護 (画像はアップロードされません)",
            filters: "フィルター",
            brightness: "明るさ",
            contrast: "コントラスト",
            saturation: "彩度",
            grayscale: "グレースケール",
            sepia: "セピア",
            resetFilters: "フィルター・リセット",
            transform: "変形",
            rotateLeft: "左回転",
            rotateRight: "右回転",
            flipH: "左右反転",
            flipV: "上下反転",
            crop: "トリミング (アスペクト比)",
            landscape: "横",
            portrait: "縦",
            free: "フリー",
            applyCrop: "切り抜き適用",
            blurArea: "プライバシー・ぼかし",
            applyBlur: "選択範囲をぼかす",
            alertLoadFail: "画像の読み込みに失敗しました。",
            alertCopyFail: "コピーに失敗しました。\nブラウザの権限設定を確認してください。",
            shareText: "ブラウザで画像編集「SNAPTUNE」を使ってみました！",
            copied: "コピー完了！",
            updates: "アップデート履歴",
            updatesTitle: "アップデート履歴",
            close: "閉じる"
        },
        en: {
            undo: "Undo",
            selectImage: "Select Image",
            copy: "Copy",
            save: "Save",
            share: "Share on X",
            dropText: "Drop image here to start",
            appDesc: "Simple, client-side image editor.<br>Drag & drop or paste locally.",
            featFilter: "✨ Filters (Brightness, Saturation, etc.)",
            featTransform: "🔄 Rotate, Flip, Crop",
            featPrivacy: "🔒 Privacy First (No upload)",
            filters: "Filters",
            brightness: "Brightness",
            contrast: "Contrast",
            saturation: "Saturation",
            grayscale: "Grayscale",
            sepia: "Sepia",
            resetFilters: "Reset Filters",
            transform: "Transform",
            rotateLeft: "Rotate Left",
            rotateRight: "Rotate Right",
            flipH: "Flip Horizontally",
            flipV: "Flip Vertically",
            crop: "Crop (Aspect Ratio)",
            landscape: "Landscape",
            portrait: "Portrait",
            free: "Free",
            applyCrop: "Apply Crop",
            blurArea: "Privacy & Blur",
            applyBlur: "Blur Selection",
            alertLoadFail: "Failed to load image.",
            alertCopyFail: "Failed to copy.\nPlease check browser permissions.",
            shareText: "Tried 'SNAPTUNE' for image editing in the browser!",
            copied: "Copied!",
            updates: "Updates",
            updatesTitle: "Update History",
            close: "Close"
        }
    };

    let currentLang = 'ja';
    const langBtn = document.getElementById('lang-btn');

    function updateLanguage(lang) {
        currentLang = lang;
        langBtn.textContent = lang === 'ja' ? 'EN' : 'JP'; // Button shows target lang

        const t = i18n[lang];

        // Update Text
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (t[key]) {
                el.innerHTML = t[key];
            }
        });

        // Update Titles
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.dataset.i18nTitle;
            if (t[key]) {
                el.title = t[key];
            }
        });
    }

    langBtn.addEventListener('click', () => {
        const newLang = currentLang === 'ja' ? 'en' : 'ja';
        updateLanguage(newLang);
    });

    // Init Language
    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang.startsWith('en')) {
        updateLanguage('en');
    } else {
        // Default is JA, but run update to ensure state is consistent if needed
        updateLanguage('ja');
    }

    // --- Event Listeners ---

    // Upload
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));

    // Drag & Drop
    const dropZone = document.getElementById('drop-zone');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Counter to track enter/leave because dragenter/leave fire for every child element
    let dragCounter = 0;

    document.addEventListener('dragenter', (e) => {
        dragCounter++;
        dropZone.classList.remove('hidden');
        initialState.classList.add('hidden'); // Hide welcome immediately
    });

    document.addEventListener('dragleave', (e) => {
        dragCounter--;
        if (dragCounter === 0) {
            dropZone.classList.add('hidden');
            if (!processor.originalImage) {
                // If no image loaded yet, show welcome again
                initialState.classList.remove('hidden');
            }
        }
    });

    document.addEventListener('drop', (e) => {
        dragCounter = 0; // Reset
        dropZone.classList.add('hidden');

        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            handleFileSelect(files[0]).catch(() => {
                // If failed and no image, show welcome
                if (!processor.originalImage) initialState.classList.remove('hidden');
            });
        } else {
            if (!processor.originalImage) initialState.classList.remove('hidden');
        }
    });

    const initialState = document.getElementById('initial-state');
    const canvasContainer = document.getElementById('canvas-container');
    const heroUploadBtn = document.getElementById('hero-upload-btn');

    heroUploadBtn.addEventListener('click', () => fileInput.click());

    async function handleFileSelect(file) {
        if (file && file.type.startsWith('image/')) {
            try {
                await processor.loadImage(file);

                // Switch view
                initialState.classList.add('hidden');
                canvasContainer.classList.remove('hidden');

                render();
                downloadBtn.disabled = false;
                copyBtn.disabled = false;
                updateUndoButton(); // Check undo state
                // resetZoom(); // Changed effectively to fitToScreen via resetZoom logic change or direct call
                fitToScreen();
            } catch (err) {
                console.error("Failed to load image", err);
                alert(i18n[currentLang].alertLoadFail);
            }
        }
    }

    // Paste from Clipboard
    document.addEventListener('paste', (e) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                handleFileSelect(blob);
                break;
            }
        }
    });

    // Undo function logic extracted for reuse
    async function performUndo() {
        if (!processor.canUndo()) return;
        const success = await processor.undo();
        if (success) {
            render();
            cropManager.hide();
            updateUndoButton();
        }
    }

    const undoBtn = document.getElementById('undo-btn');
    undoBtn.addEventListener('click', performUndo);

    // Keyboard Shortcuts (Ctrl+Z)
    document.addEventListener('keydown', (e) => {
        // Ctrl+Z or Cmd+Z
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            performUndo();
        }
    });

    function updateUndoButton() {
        undoBtn.disabled = !processor.canUndo();
    }


    // Download
    downloadBtn.addEventListener('click', () => {
        if (!processor.originalImage) return;
        const link = document.createElement('a');

        // Generate timestamp YYMMDD_HHMMSS
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const MM = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const timestamp = `${yy}${MM}${dd}_${hh}${mm}${ss}`;

        link.download = `snaptune_${timestamp}.png`;
        link.href = processor.export();
        link.click();
    });

    // Clipboard Copy
    copyBtn.addEventListener('click', async () => {
        if (!processor.originalImage) return;

        try {
            const dataUrl = processor.export();
            const blob = await (await fetch(dataUrl)).blob();

            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]);

            // Visual feedback
            const originalText = copyBtn.innerHTML;
            copyBtn.textContent = i18n[currentLang].copied;
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
            }, 2000);

        } catch (err) {
            console.error('Failed to copy functionality', err);
            alert(i18n[currentLang].alertCopyFail);
        }
    });

    // Share to X
    document.getElementById('share-btn').addEventListener('click', () => {
        const text = encodeURIComponent(i18n[currentLang].shareText);
        const urlProperty = encodeURIComponent('https://piyohico1.github.io/webapps/papps/snaptune/');
        const shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${urlProperty}`;
        window.open(shareUrl, '_blank');
    });

    // Filters
    const filterInputs = ['brightness', 'contrast', 'saturation', 'grayscale', 'sepia'];
    filterInputs.forEach(id => {
        const input = document.getElementById(id);
        const valDisplay = document.getElementById(`${id}-val`);

        input.addEventListener('input', (e) => {
            const val = e.target.value;
            valDisplay.textContent = `${val}%`;
            processor.updateParam(id, Number(val));
            render();
        });
    });

    // Reset Filters
    document.getElementById('reset-filters').addEventListener('click', () => {
        filterInputs.forEach(id => {
            const input = document.getElementById(id);
            // Defualts
            let def = 0;
            if (['brightness', 'contrast', 'saturation'].includes(id)) def = 100;

            input.value = def;
            document.getElementById(`${id}-val`).textContent = `${def}%`;
            processor.updateParam(id, def);
        });
        render();
    });

    // Transforms
    document.getElementById('rotate-left').addEventListener('click', () => {
        processor.rotate('left');
        render();
        cropManager.hide(); // Or resetOverlay() if we want to allow crop rotation workflow
    });
    document.getElementById('rotate-right').addEventListener('click', () => {
        processor.rotate('right');
        render();
        cropManager.hide();
    });
    document.getElementById('flip-h').addEventListener('click', () => {
        processor.flip('h');
        render();
    });
    document.getElementById('flip-v').addEventListener('click', () => {
        processor.flip('v');
        render();
    });

    // Zoom Controls
    document.getElementById('zoom-in').addEventListener('click', () => updateZoom(0.1));
    document.getElementById('zoom-out').addEventListener('click', () => updateZoom(-0.1));
    document.getElementById('fit-screen').addEventListener('click', fitToScreen);

    // Mouse Wheel Zoom
    canvasContainer.addEventListener('wheel', (e) => {
        if (!processor.originalImage) return;
        e.preventDefault();

        // Adjust zoom speed based on deltaY. Typical scroll is ~100
        const zoomDelta = e.deltaY < 0 ? 0.05 : -0.05;
        updateZoom(zoomDelta);
    }, { passive: false });

    // Orientation & Crop
    const cropManager = new CropManager(
        document.getElementById('crop-overlay'),
        document.getElementById('canvas-container'),
        canvas
    );

    const orientLandscapeBtn = document.getElementById('orient-landscape');
    const orientPortraitBtn = document.getElementById('orient-portrait');
    let isPortrait = false;
    let currentAspect = 'free';

    function updateCropConfig() {
        cropManager.setRatio(currentAspect, isPortrait);
    }

    orientLandscapeBtn.addEventListener('click', () => {
        isPortrait = false;
        orientLandscapeBtn.classList.add('active');
        orientPortraitBtn.classList.remove('active');
        updateCropConfig();
    });

    orientPortraitBtn.addEventListener('click', () => {
        isPortrait = true;
        orientPortraitBtn.classList.add('active');
        orientLandscapeBtn.classList.remove('active');
        updateCropConfig();
    });

    // Aspect Ratio Buttons
    document.querySelectorAll('.aspect-btn').forEach(btn => {
        // Skip orientation buttons which also have this class
        if (btn.id.startsWith('orient-')) return;

        btn.addEventListener('click', () => {
            document.querySelectorAll('.aspect-btn:not([id^="orient-"])').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const ratio = btn.dataset.ratio;
            currentAspect = ratio;

            if (ratio === 'free') {
                // If free, show overlay but without constraints
                cropManager.setRatio('free', isPortrait);
            } else {
                updateCropConfig();
            }
        });
    });

    // Apply Crop
    // Currently, "Apply Crop" might mean "Show me the cropped image for download" or "Destructive Cut".
    // For a simple editor, let's keep it non-destructive until download? 
    // OR, actually cropping makes the canvas smaller. 
    // Let's implement destructive crop for the session:
    document.getElementById('apply-crop').addEventListener('click', async () => {
        const cropData = cropManager.getCropData();
        // Generate new images from dataURL
        const croppedDataUrl = processor.export(cropData);

        // Reload generic image from this new data
        // Convert DataURL to Blob/File for loading?
        // Or just new Image()
        const img = new Image();
        img.onload = () => {
            processor.originalImage = img;
            processor.resetParams();
            processor.saveState(); // Save new state

            render();
            cropManager.hide();
            updateUndoButton();
        };
        img.src = croppedDataUrl;
    });

    // Apply Blur (Drag-to-blur Mode)
    let isBlurMode = false;
    let isDraggingBlur = false;
    let blurStart = { x: 0, y: 0 };
    const blurBtn = document.getElementById('apply-blur');
    const blurOverlay = document.getElementById('blur-overlay');

    blurBtn.addEventListener('click', () => {
        isBlurMode = !isBlurMode;
        if (isBlurMode) {
            document.body.classList.add('blur-mode-active');
            blurBtn.classList.add('blur-active');
            cropManager.hide(); // Hide crop overlay to prevent interference
        } else {
            document.body.classList.remove('blur-mode-active');
            blurBtn.classList.remove('blur-active');
            isDraggingBlur = false;
            blurOverlay.classList.add('hidden');
        }
    });

    // Helper: get offset between canvas and its container (same as CropManager)
    function getCanvasOffset() {
        const containerRect = canvasContainer.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        return {
            x: canvasRect.left - containerRect.left,
            y: canvasRect.top - containerRect.top
        };
    }

    // Handle Mousedown/move/up for Drag-to-Blur on canvas container
    canvasContainer.addEventListener('mousedown', (e) => {
        if (!isBlurMode || !processor.originalImage) return;

        // Only start drag if we click directly on the canvas or container (not buttons etc inside)
        if (e.target !== canvas && e.target !== canvasContainer) return;

        isDraggingBlur = true;

        const canvasRect = canvas.getBoundingClientRect();
        const offset = getCanvasOffset();
        // Record start position relative to the visual canvas element
        blurStart.x = e.clientX - canvasRect.left;
        blurStart.y = e.clientY - canvasRect.top;

        // Position overlay relative to canvas-container, add offset
        blurOverlay.style.left = `${blurStart.x + offset.x}px`;
        blurOverlay.style.top = `${blurStart.y + offset.y}px`;
        blurOverlay.style.width = `0px`;
        blurOverlay.style.height = `0px`;
        blurOverlay.classList.remove('hidden');

        e.preventDefault();
        e.stopPropagation(); // Prevent image move
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDraggingBlur) return;
        e.preventDefault();

        const canvasRect = canvas.getBoundingClientRect();
        const offset = getCanvasOffset();
        let currentX = e.clientX - canvasRect.left;
        let currentY = e.clientY - canvasRect.top;

        // Clamp to canvas display rect
        currentX = Math.max(0, Math.min(currentX, canvasRect.width));
        currentY = Math.max(0, Math.min(currentY, canvasRect.height));

        const width = Math.abs(currentX - blurStart.x);
        const height = Math.abs(currentY - blurStart.y);
        const left = Math.min(currentX, blurStart.x);
        const top = Math.min(currentY, blurStart.y);

        // Position overlay relative to canvas-container, add offset
        blurOverlay.style.left = `${left + offset.x}px`;
        blurOverlay.style.top = `${top + offset.y}px`;
        blurOverlay.style.width = `${width}px`;
        blurOverlay.style.height = `${height}px`;
    });

    document.addEventListener('mouseup', async (e) => {
        if (!isDraggingBlur) return;
        isDraggingBlur = false;

        const rect = canvas.getBoundingClientRect();

        blurOverlay.classList.add('hidden');

        // Do not exit blur mode automatically (keep it as a toggle)
        // isBlurMode = false;
        // document.body.classList.remove('blur-mode-active');
        // blurBtn.classList.remove('blur-active');

        const widthStr = blurOverlay.style.width;
        const widthPx = widthStr ? parseInt(widthStr, 10) : 0;

        // Prevent accidental micro-drags
        if (widthPx < 10) return;

        const leftPx = parseInt(blurOverlay.style.left, 10);
        const topPx = parseInt(blurOverlay.style.top, 10);
        const heightPx = parseInt(blurOverlay.style.height, 10);

        // Overlay position includes canvas offset; subtract it for canvas-relative coords
        const offset = getCanvasOffset();
        const canvasLeft = leftPx - offset.x;
        const canvasTop = topPx - offset.y;

        // Convert Display Pixels to Internal Canvas Pixels
        const dw = rect.width;
        const dh = rect.height;
        const iw = canvas.width;
        const ih = canvas.height;
        const scaleX = iw / dw;
        const scaleY = ih / dh;

        const cropData = {
            x: canvasLeft * scaleX,
            y: canvasTop * scaleY,
            w: widthPx * scaleX,
            h: heightPx * scaleY
        };

        const blurredDataUrl = processor.exportWithBlur(cropData, 15);

        if (!blurredDataUrl) return;

        const img = new Image();
        img.onload = () => {
            processor.originalImage = img;
            processor.resetParams();
            processor.saveState(); // Save new state

            render();
            updateUndoButton();
        };
        img.src = blurredDataUrl;
    });

    function render() {
        if (!processor.originalImage) return;
        processor.render(canvas);
        // Apply Zoom
        canvas.style.transform = `scale(${zoomLevel})`;
        // When rendering (e.g. rotating), we might need to update crop overlay position/bounds if it was active
        // For now, let's hide crop on rotate to avoid confusion, or user has to reset it.
        // cropManager.hide(); 
    }

    function updateZoom(delta) {
        // Round to 1 decimal to avoid float issues
        let newZoom = Math.round((zoomLevel + delta) * 100) / 100;

        // Dynamic min/max could be better, but fixed is fine for now
        if (newZoom < zoomMin) newZoom = zoomMin;
        if (newZoom > zoomMax) newZoom = zoomMax;

        zoomLevel = newZoom;
        document.getElementById('zoom-level').textContent = `${Math.round(zoomLevel * 100)}%`;
        render();
    }

    function resetZoom() {
        // Reset to 100% or Fit? 
        // "Fit" button usually implies Fit.
        fitToScreen();
    }

    function fitToScreen() {
        if (!processor.originalImage) return;

        const container = document.getElementById('canvas-container');
        // Container size might be limited by CSS max-height/width
        // We need clientWidth/Height
        const cw = container.clientWidth - 40; // padding/margin safety
        const ch = container.clientHeight - 40;

        const { width, height } = processor.getTransformedDimensions ? processor.getTransformedDimensions() : processor.originalImage;
        // fallback if getTransformedDimensions missing (it is, need to use canvas size logic)
        // Actually render() sets canvas.width/height based on rotation.
        // We can just use the canvas.width/height implied by local logic?
        // But render() hasn't run with new image maybe? 
        // processor.originalImage is set.

        // Let's replicate dimension logic or use current params
        const { rotate } = processor.params;
        const isRotated = rotate % 180 !== 0;
        const imgW = isRotated ? processor.originalImage.height : processor.originalImage.width;
        const imgH = isRotated ? processor.originalImage.width : processor.originalImage.height;

        const scaleW = cw / imgW;
        const scaleH = ch / imgH;

        // Fit whole image
        let scale = Math.min(scaleW, scaleH);

        // Allow image to upscale past 1.0 to fit screen if needed.
        // if (scale > 1) scale = 1.0;

        // Don't go too small
        if (scale < zoomMin) scale = zoomMin;

        zoomLevel = scale;
        document.getElementById('zoom-level').textContent = `${Math.round(zoomLevel * 100)}%`;
        render();
    }

    // --- Update History ---
    const updatesModal = document.getElementById('updates-modal');
    const updatesBtn = document.getElementById('updates-btn');
    const closeModalBtn = document.getElementById('close-modal');
    const updatesList = document.getElementById('updates-list');

    const updateHistory = [
        {
            date: '2026.02.23',
            desc: {
                ja: '・プライバシー・ぼかし機能の追加（ドラッグで範囲指定）\n・「元に戻す」のキーボードショートカット (Ctrl+Z / Cmd+Z) を追加\n・マウスホイール回転による画像の拡大縮小に対応\n・画像拡大時に見切れる表示領域の問題を解消',
                en: '・Added Privacy Blur feature (drag to select area)\n・Added keyboard shortcut for Undo (Ctrl+Z / Cmd+Z)\n・Added mouse wheel support for zooming\n・Fixed display clipping issue when zooming in'
            }
        },
        {
            date: '2026.01.13',
            desc: {
                ja: '・入力画像が画面外にはみ出てたのを解消\n・トリミング操作の安定性を向上',
                en: '・Fixed issue where input images extended off-screen\n・Improved crop stability'
            }
        },
        { date: '2026.01.08', desc: { ja: '・リリース！', en: '・Initial Release!' } }
    ];

    function renderUpdates() {
        updatesList.innerHTML = '';
        updateHistory.forEach(item => {
            const li = document.createElement('li');
            const dateSpan = document.createElement('span');
            dateSpan.className = 'update-date';
            dateSpan.textContent = item.date;

            const descSpan = document.createElement('span');
            descSpan.className = 'update-desc';
            descSpan.textContent = item.desc[currentLang] || item.desc['ja'];

            li.appendChild(dateSpan);
            li.appendChild(descSpan);
            updatesList.appendChild(li);
        });
    }

    updatesBtn.addEventListener('click', () => {
        renderUpdates();
        updatesModal.classList.remove('hidden');
    });

    closeModalBtn.addEventListener('click', () => {
        updatesModal.classList.add('hidden');
    });

    // Close on click outside
    updatesModal.addEventListener('click', (e) => {
        if (e.target === updatesModal) {
            updatesModal.classList.add('hidden');
        }
    });
});
