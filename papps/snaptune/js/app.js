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
            alertLoadFail: "画像の読み込みに失敗しました。",
            alertCopyFail: "コピーに失敗しました。\nブラウザの権限設定を確認してください。",
            shareText: "ブラウザで使えるシンプルな画像編集アプリ「SNAPTUNE」を使ってみました！ #SNAPTUNE",
            copied: "コピー完了！"
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
            alertLoadFail: "Failed to load image.",
            alertCopyFail: "Failed to copy.\nPlease check browser permissions.",
            shareText: "Tried SNAPTUNE, a simple browser-based image editor! #SNAPTUNE",
            copied: "Copied!"
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
                resetZoom();
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

    const undoBtn = document.getElementById('undo-btn');
    undoBtn.addEventListener('click', async () => {
        const success = await processor.undo();
        if (success) {
            render();
            // Maybe we want to keep filters? processor.undo() keeps params as is.
            // If undoing crop, the new image might have different dim.
            // CropManager overlay might need reset.
            cropManager.hide();
            updateUndoButton();
        }
    });

    function updateUndoButton() {
        undoBtn.disabled = !processor.canUndo();
    }


    // Download
    downloadBtn.addEventListener('click', () => {
        if (!processor.originalImage) return;
        const link = document.createElement('a');
        link.download = 'edited-image.png';
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
        const url = encodeURIComponent(window.location.href); // Or a fixed official URL if available
        // Since it is local file, usually window.location.href is file:// which is not helpful.
        // Let's just share text if it's strictly local, or maybe a project repo URL?
        // Using just text for now as requested "Share the App".
        const shareUrl = `https://twitter.com/intent/tweet?text=${text}`;
        window.open(shareUrl, '_blank', 'width=550,height=420');
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
    document.getElementById('fit-screen').addEventListener('click', resetZoom);

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
        const newZoom = Math.round((zoomLevel + delta) * 10) / 10;
        if (newZoom >= zoomMin && newZoom <= zoomMax) {
            zoomLevel = newZoom;
            document.getElementById('zoom-level').textContent = `${Math.round(zoomLevel * 100)}%`;
            render();
        }
    }

    function resetZoom() {
        // Fit to container logic could go here
        zoomLevel = 1.0;
        document.getElementById('zoom-level').textContent = "100%";
        // Reset CSS transform
        canvas.style.transform = 'none';
        // Logic to actually fit within container based on clientWidth/Height vs canvas.width/height is better
        // For now, reset to 100%
        render();
    }
});
