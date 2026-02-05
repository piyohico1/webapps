const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const selectFilesBtn = document.getElementById('select-files-btn');
const durationInput = document.getElementById('duration-input');
const imageCountDisplay = document.getElementById('image-count');
const fpsDisplay = document.getElementById('fps-display');
const resolutionDisplay = document.getElementById('resolution-display');
const generateBtn = document.getElementById('generate-btn');
const previewCanvas = document.getElementById('preview-canvas');
const ctx = previewCanvas.getContext('2d');
const resultVideo = document.getElementById('result-video');
const previewSection = document.querySelector('.preview-section');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const downloadLink = document.getElementById('download-link');
const thumbnailSection = document.getElementById('thumbnail-section');
const thumbnailGrid = document.getElementById('thumbnail-grid');
const thumbnailCount = document.getElementById('thumbnail-count');

let images = [];
let targetDuration = 5;
let dragSrcEl = null;

// --- Event Listeners ---

selectFilesBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent bubbling to uploadArea click
    fileInput.click();
});

uploadArea.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', handleFileSelect);

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
});

durationInput.addEventListener('input', updateSettings);

generateBtn.addEventListener('click', generateVideo);

// Format Selector
const formatMp4Btn = document.getElementById('format-mp4-btn');
const formatWebmBtn = document.getElementById('format-webm-btn');
const mp4WarningModal = document.getElementById('mp4-warning-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const deleteAllBtn = document.getElementById('delete-all-btn');

// Delete Confirm Modal Elements
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const deleteCancelBtn = document.getElementById('delete-cancel-btn');
const deleteConfirmBtn = document.getElementById('delete-confirm-btn');

let selectedFormat = 'mp4'; // Default preference

// Helper to check MP4 support
function getSupportedMp4Type() {
    const mp4Types = [
        'video/mp4;codecs=avc1.4d402a',
        'video/mp4;codecs=avc1.424028',
        'video/mp4'
    ];
    for (const type of mp4Types) {
        if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return null;
}

// Initial Check
if (!getSupportedMp4Type()) {
    selectedFormat = 'webm';
    formatMp4Btn.classList.remove('active');
    formatWebmBtn.classList.add('active');
}

formatMp4Btn.addEventListener('click', () => {
    if (!getSupportedMp4Type()) {
        mp4WarningModal.hidden = false;
        return;
    }
    selectedFormat = 'mp4';
    formatMp4Btn.classList.add('active');
    formatWebmBtn.classList.remove('active');
});

formatWebmBtn.addEventListener('click', () => {
    selectedFormat = 'webm';
    formatWebmBtn.classList.add('active');
    formatMp4Btn.classList.remove('active');
});

modalCloseBtn.addEventListener('click', () => {
    mp4WarningModal.hidden = true;
});

deleteAllBtn.addEventListener('click', () => {
    deleteConfirmModal.hidden = false;
});

deleteCancelBtn.addEventListener('click', () => {
    deleteConfirmModal.hidden = true;
});

deleteConfirmBtn.addEventListener('click', () => {
    images = [];
    renderThumbnails();
    updateSettings();
    thumbnailSection.hidden = true;
    generateBtn.disabled = true;

    // Clear canvas
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    resolutionDisplay.textContent = "-";

    deleteConfirmModal.hidden = true;
});

// --- Functions ---

function handleFileSelect(e) {
    handleFiles(e.target.files);
}

async function handleFiles(fileList) {
    const validFiles = Array.from(fileList).filter(file => file.type.startsWith('image/'));

    if (validFiles.length === 0) {
        alert('画像ファイルを選択してください。');
        return;
    }

    // Load images
    // let loadedCount = 0; // This variable is not used in the provided snippet, so it's removed.

    // Show loading state if needed (simple ver: just block UI or show spinner)
    generateBtn.disabled = true;
    generateBtn.textContent = translations[currentLang].loadBtnLoading;

    // Sort files by name to ensure order (optional but recommended)
    validFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    try {
        const loadedImages = await Promise.all(validFiles.map(loadFileAsImage));

        // Append new images to existing list or replace? 
        // Current logic: Replace for simplicity as per original design, but adding to list is also valid.
        // Let's stick to "Replace" for this input interaction for now, or "Append" if consistent.
        // Given "File Input", usually implies "Here are the files I want".
        // Let's Replace to avoid confusion unless user wants append.
        images = loadedImages;

        renderThumbnails();

        generateBtn.disabled = false;
        generateBtn.textContent = translations[currentLang].generateVideoBtn;

        updateSettings();

        // Setup canvas with first image for resolution info
        if (images.length > 0) {
            setupCanvas(images[0], true); // true = init only, don't show preview section yet
        }

    } catch (err) {
        console.error("Error loading images:", err);
        alert("画像の読み込みに失敗しました。"); // Could i18n this too but basics for now
        generateBtn.disabled = false;
        generateBtn.textContent = translations[currentLang].generateVideoBtn; // Reset
    }
}

function loadFileAsImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = e.target.result;
            img.dataset.filename = file.name; // Store filename
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function updateSettings() {
    targetDuration = parseFloat(durationInput.value) || 3;
    const count = images.length;
    imageCountDisplay.textContent = count;

    if (count > 0 && targetDuration > 0) {
        const fps = count / targetDuration;
        fpsDisplay.textContent = fps.toFixed(2);
    } else {
        fpsDisplay.textContent = "-";
    }

    generateBtn.disabled = count === 0 || targetDuration <= 0;
}

function renderThumbnails() {
    thumbnailGrid.innerHTML = '';
    thumbnailSection.hidden = false;
    thumbnailCount.textContent = images.length;

    images.forEach((img, index) => {
        const div = document.createElement('div');
        div.className = 'thumbnail-item';
        div.draggable = true;
        div.dataset.index = index;

        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'valign-wrapper'; // Reuse or new class
        imgWrapper.style.pointerEvents = 'none'; // Ensure drag works on parent

        // Clone image for thumbnail
        const thumbImg = img.cloneNode();
        // thumbImg.className = 'thumb-img'; // Optional if needed for specific styling

        const nameSpan = document.createElement('span');
        nameSpan.className = 'thumbnail-name';
        nameSpan.textContent = img.dataset.filename || `Image ${index + 1}`;

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'thumbnail-delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            images.splice(index, 1);
            renderThumbnails();
            updateSettings();
            if (images.length > 0) {
                setupCanvas(images[0], true);
            }
        });

        imgWrapper.appendChild(thumbImg);
        div.appendChild(imgWrapper);
        div.appendChild(deleteBtn);
        div.appendChild(nameSpan);

        addDnDHandlers(div);
        thumbnailGrid.appendChild(div);
    });
}

function addDnDHandlers(el) {
    el.addEventListener('dragstart', handleDragStart);
    el.addEventListener('dragenter', handleDragEnter);
    el.addEventListener('dragover', handleDragOver);
    el.addEventListener('dragleave', handleDragLeave);
    el.addEventListener('drop', handleDrop);
    el.addEventListener('dragend', handleDragEnd);
}

function handleDragStart(e) {
    this.style.opacity = '0.4';
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    if (dragSrcEl !== this) {
        const oldIndex = parseInt(dragSrcEl.dataset.index);
        const newIndex = parseInt(this.dataset.index);

        if (oldIndex !== newIndex) {
            // Move item in array
            const movedItem = images.splice(oldIndex, 1)[0];
            images.splice(newIndex, 0, movedItem);

            // Re-render
            renderThumbnails();

            // Re-setup canvas if the first image changed to ensure aspect ratio is correct for the new start
            if (newIndex === 0 || oldIndex === 0) {
                setupCanvas(images[0], true);
            }
        }
    }
    return false;
}

function handleDragEnd(e) {
    this.style.opacity = '1';

    let items = document.querySelectorAll('.thumbnail-item');
    items.forEach(function (item) {
        item.classList.remove('drag-over');
    });
}

function setupCanvas(firstImage, isInit = false) {
    // Max resolution 1920px (width or height)
    let width = firstImage.width;
    let height = firstImage.height;
    const maxSize = 1920;

    if (width > maxSize || height > maxSize) {
        if (width > height) {
            height = Math.round(height * (maxSize / width));
            width = maxSize;
        } else {
            width = Math.round(width * (maxSize / height));
            height = maxSize;
        }
    }

    // Make dimensions even for better codec compatibility (often required by some encoders)
    if (width % 2 !== 0) width -= 1;
    if (height % 2 !== 0) height -= 1;

    previewCanvas.width = width;
    previewCanvas.height = height;

    resolutionDisplay.textContent = `${width} x ${height}`;

    // We no longer show preview section on setup, only on generate
}

function drawImageContain(img) {
    // Reset Alpha
    ctx.globalAlpha = 1.0;

    // Fill background with black
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

    // Calculate generic contain logic
    const scale = Math.min(previewCanvas.width / img.width, previewCanvas.height / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (previewCanvas.width - w) / 2;
    const y = (previewCanvas.height - h) / 2;

    ctx.drawImage(img, x, y, w, h);
}

const fadeEffectInput = document.getElementById('fade-effect-input');

async function generateVideo() {
    if (images.length === 0) return;

    setupCanvas(images[0]);

    generateBtn.disabled = true;
    previewSection.hidden = false;

    resultVideo.hidden = true;
    downloadLink.hidden = true;
    progressContainer.hidden = false;
    progressBar.style.width = '0%';
    progressText.textContent = '0%';

    // --- Video Generation Logic ---

    const TARGET_FPS = 30; // Fixed FPS for smooth effects
    const fadeDuration = 1.0; // 1 second for fade in/out
    const isFadeEnabled = fadeEffectInput.checked;

    // Calculate total duration layout
    const baseImageDuration = targetDuration / images.length;

    let timeline = images.map(img => ({
        img: img,
        duration: baseImageDuration
    }));

    if (isFadeEnabled) {
        timeline[0].duration += fadeDuration; // Add fade in time to first
        timeline[timeline.length - 1].duration += fadeDuration; // Add fade out time to last
    }

    // Re-calculate total duration
    const finalTotalDuration = timeline.reduce((sum, item) => sum + item.duration, 0);
    const totalFrames = Math.ceil(finalTotalDuration * TARGET_FPS);

    // Prepare MediaRecorder with selected format
    let mimeType;
    let ext;

    if (selectedFormat === 'mp4') {
        // Try MP4 (H.264)
        const mp4Types = [
            'video/mp4;codecs=avc1.4d402a',
            'video/mp4;codecs=avc1.424028',
            'video/mp4'
        ];

        let mp4Supported = false;
        for (const type of mp4Types) {
            if (MediaRecorder.isTypeSupported(type)) {
                mimeType = type;
                mp4Supported = true;
                break;
            }
        }

        if (!mp4Supported) {
            // Show modal and abort
            mp4WarningModal.hidden = false;
            generateBtn.disabled = false;
            progressContainer.hidden = true;
            return;
        }
        ext = 'mp4';
    } else {
        // WebM
        mimeType = 'video/webm;codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
        }
        ext = 'webm';
    }

    const stream = previewCanvas.captureStream(TARGET_FPS);
    const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 5000000 // 5Mbps
    });

    const chunks = [];
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        resultVideo.src = url;
        resultVideo.hidden = false;

        downloadLink.href = url;
        downloadLink.download = `video-${Date.now()}.${ext}`;
        downloadLink.hidden = false;
        const typeLabel = ext === 'mp4' ? 'Mp4' : 'Webm'; // Key suffix
        const t = translations[currentLang]; // Access current translations
        downloadLink.textContent = typeLabel === 'Mp4' ? t.downloadBtnMp4 : t.downloadBtnWebm;
        downloadLink.className = "primary-btn";
        downloadLink.style.display = "flex";
        downloadLink.style.alignItems = "center";
        downloadLink.style.justifyContent = "center";
        downloadLink.style.marginTop = "10px";
        downloadLink.style.textDecoration = "none";
        downloadLink.style.boxSizing = "border-box";

        generateBtn.disabled = false;
        progressContainer.hidden = true;
    };

    mediaRecorder.start();

    // --- Rendering Loop ---

    let currentFrame = 0;

    // Delay start slightly to let MediaRecorder init? 
    // Usually safe to start immediately with captureStream.

    function renderFrame() {
        if (currentFrame >= totalFrames) {
            mediaRecorder.stop();
            return;
        }

        // Determine current time
        const currentTime = currentFrame / TARGET_FPS;

        // Find active image
        let accumulatedTime = 0;
        let activeImageIdx = 0;
        let timeInImage = 0; // Time elapsed within the current image

        for (let i = 0; i < timeline.length; i++) {
            if (currentTime < accumulatedTime + timeline[i].duration) {
                activeImageIdx = i;
                timeInImage = currentTime - accumulatedTime;
                break;
            }
            accumulatedTime += timeline[i].duration;
            // Handle edge case for very last frame
            if (i === timeline.length - 1) {
                activeImageIdx = i;
                timeInImage = timeline[i].duration;
            }
        }

        const activeItem = timeline[activeImageIdx];

        // Draw Image
        drawImageContain(activeItem.img);

        // Apply Overlay if needed
        if (isFadeEnabled) {
            ctx.fillStyle = "#FFFFFF";

            // Fade In (First Image)
            // Logic: Starts White (alpha 1), fades to Transparent (alpha 0) over fadeDuration.
            if (activeImageIdx === 0) {
                if (timeInImage < fadeDuration) {
                    const alpha = 1.0 - (timeInImage / fadeDuration);
                    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
                    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
                    ctx.globalAlpha = 1.0; // Reset
                } else {
                    ctx.globalAlpha = 1.0; // Ensure reset if condition fails but we are in idx 0
                }
            }

            // Fade Out (Last Image)
            // Logic: Starts Transparent (alpha 0), fades to White (alpha 1) over last fadeDuration.
            if (activeImageIdx === timeline.length - 1) {
                const timeRemaining = activeItem.duration - timeInImage;
                if (timeRemaining < fadeDuration) {
                    const alpha = 1.0 - (timeRemaining / fadeDuration);
                    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
                    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
                    ctx.globalAlpha = 1.0; // Reset
                } else {
                    ctx.globalAlpha = 1.0;
                }
            }
        }

        // Progress
        const percent = Math.round(((currentFrame + 1) / totalFrames) * 100);
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${percent}%`;

        currentFrame++;

        // Throttle next frame to match FPS
        setTimeout(() => {
            requestAnimationFrame(renderFrame);
        }, 1000 / TARGET_FPS);
    }

    renderFrame();
}

// Randomize Neon Orbs Initial Position
document.addEventListener('DOMContentLoaded', () => {
    const orbs = document.querySelectorAll('.neon-orb');
    orbs.forEach(orb => {
        // Random position between -20% and 80%
        const randomX = Math.floor(Math.random() * 100) - 20;
        const randomY = Math.floor(Math.random() * 100) - 20;

        orb.style.top = `${randomY}%`;
        orb.style.left = `${randomX}%`;

        // Reset potentially conflicting styles
        orb.style.bottom = 'auto';
        orb.style.right = 'auto';
        orb.style.transform = 'none';
    });
});

// --- Internationalization and Social ---

const translations = {
    ja: {
        appDescription: "複数画像を入力して一つの動画を作成します",
        dragDropText: "ここに画像をドラッグ＆ドロップ",
        selectFilesBtn: "ファイルを選択",
        imagesLabel: "画像",
        deleteAllBtn: "全て削除",
        dragToReorder: "ドラッグして順番を入れ替えられます",
        videoDuration: "動画の長さ (秒)",
        fadeEffect: "フェード イン/アウト (各+1秒)",
        resolution: "動画解像度",
        totalImages: "合計画像数",
        imagesUnit: "枚",
        frameRate: "フレームレート",
        outputFormat: "出力形式:",
        generateVideoBtn: "動画を作成",
        generatingVideo: "動画作成中...",
        downloadBtn: "動画をダウンロード",
        mp4Warning: "お使いのブラウザはMP4出力をサポートしていません。WebMに切り替えてください。",
        closeBtn: "閉じる",
        deleteConfirm: "全ての画像を削除してもよろしいですか？",
        cancelBtn: "キャンセル",
        deleteBtn: "削除する",
        loadBtnLoading: "画像を読み込み中...",
        downloadBtnMp4: "動画をダウンロード (MP4)",
        downloadBtnWebm: "動画をダウンロード (WebM)"
    },
    en: {
        appDescription: "Create a video from multiple images",
        dragDropText: "Drag & Drop images here",
        selectFilesBtn: "Select Files",
        imagesLabel: "Images",
        deleteAllBtn: "Delete All",
        dragToReorder: "Drag to reorder",
        videoDuration: "Video Duration (sec)",
        fadeEffect: "Fade In/Out (+1s each)",
        resolution: "Resolution",
        totalImages: "Total Images",
        imagesUnit: "",
        frameRate: "Frame Rate",
        outputFormat: "Format:",
        generateVideoBtn: "Generate Video",
        generatingVideo: "Generating Video...",
        downloadBtn: "Download Video",
        mp4Warning: "Your browser does not support MP4 export. Please switch to WebM.",
        closeBtn: "Close",
        deleteConfirm: "Are you sure you want to delete all images?",
        cancelBtn: "Cancel",
        deleteBtn: "Delete",
        loadBtnLoading: "Loading Images...",
        downloadBtnMp4: "Download Video (MP4)",
        downloadBtnWebm: "Download Video (WebM)"
    }
};

// Initial Language Load from LocalStorage
let currentLang = localStorage.getItem('snap2mov_lang') || 'ja';
// Apply initial language immediately
updateLanguage(currentLang);

const langToggleBtn = document.getElementById('lang-toggle-btn');
const xShareBtn = document.getElementById('x-share-btn');

function updateLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('snap2mov_lang', lang); // Save preference
    const t = translations[lang];

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (t[key]) {
            el.textContent = t[key];
        }
    });

    // Update dynamic texts if currently visible/active
    if (generateBtn.disabled && generateBtn.textContent !== t.generateVideoBtn && generateBtn.textContent.includes("...")) {
        generateBtn.textContent = t.loadBtnLoading;
    } else if (!generateBtn.disabled) {
        generateBtn.textContent = t.generateVideoBtn;
    }

    if (!downloadLink.hidden) {
        const ext = downloadLink.download.split('.').pop().toUpperCase();
        if (ext === 'MP4') downloadLink.textContent = t.downloadBtnMp4;
        else downloadLink.textContent = t.downloadBtnWebm;
    }
}

langToggleBtn.addEventListener('click', () => {
    const newLang = currentLang === 'ja' ? 'en' : 'ja';
    updateLanguage(newLang);
});

xShareBtn.addEventListener('click', () => {
    const intro = currentLang === 'ja' ?
        "ブラウザで画像を動画に変換！" :
        "Convert images to video in your browser!";

    const hashtags = "Snap2Mov";
    const shareUrl = "https://piyohico1.github.io/webapps/snap2mov/";

    const tweetText = `${intro}\n${shareUrl}\n#${hashtags}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

    window.open(twitterUrl, '_blank');
});
