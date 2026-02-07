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
const generationMode = document.getElementById('generation-mode');
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
        // Wrap text in LTR span to prevent punctuation flipping in RTL container (used for left-truncation)
        const nameText = document.createElement('span');
        nameText.dir = 'ltr';
        nameText.textContent = img.dataset.filename || `Image ${index + 1}`;
        nameSpan.appendChild(nameText);

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

// --- Resolution Selector ---
let selectedResolution = 1920; // Default

const res1280Btn = document.getElementById('res-1280-btn');
const res1920Btn = document.getElementById('res-1920-btn');

res1280Btn.addEventListener('click', () => {
    selectedResolution = 1280;
    res1280Btn.classList.add('active');
    res1920Btn.classList.remove('active');
    if (images.length > 0) setupCanvas(images[0]);
});

res1920Btn.addEventListener('click', () => {
    selectedResolution = 1920;
    res1920Btn.classList.add('active');
    res1280Btn.classList.remove('active');
    if (images.length > 0) setupCanvas(images[0]);
});

function setupCanvas(firstImage, isInit = false) {
    // Scale based on selected resolution as Max Size (Longest side)
    let width = firstImage.width;
    let height = firstImage.height;
    const maxSize = selectedResolution;

    // Scale so the longest side equals maxSize, but only if image is larger
    // Do NOT upscale smaller images - keep their original size
    const longestSide = Math.max(width, height);
    if (longestSide > maxSize) {
        if (width > height) {
            // Landscape
            height = Math.round(height * (maxSize / width));
            width = maxSize;
        } else {
            // Portrait or Square
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

    const startTime = performance.now(); // Start timer

    generateBtn.disabled = true;
    previewSection.hidden = false;

    resultVideo.hidden = true;
    downloadLink.hidden = true;
    progressContainer.hidden = false;
    progressBar.style.width = '0%';
    progressText.textContent = '0%';

    // --- Video Generation Logic ---

    const TARGET_FPS = 30;
    const fadeDuration = 1.0;
    const isFadeEnabled = fadeEffectInput.checked;

    // Calculate total duration layout
    const baseImageDuration = targetDuration / images.length;

    let timeline = images.map(img => ({
        img: img,
        duration: baseImageDuration
    }));

    if (isFadeEnabled) {
        timeline[0].duration += fadeDuration;
        timeline[timeline.length - 1].duration += fadeDuration;
    }

    const finalTotalDuration = timeline.reduce((sum, item) => sum + item.duration, 0);
    const totalFrames = Math.ceil(finalTotalDuration * TARGET_FPS);

    // --- High Speed Export for MP4 (WebCodecs) ---
    const isHighSpeedSupported = selectedFormat === 'mp4' &&
        typeof VideoEncoder !== 'undefined' &&
        typeof Mp4Muxer !== 'undefined';

    console.log("High Speed Check:", {
        isHighSpeedSupported,
        selectedFormat,
        hasVideoEncoder: typeof VideoEncoder !== 'undefined',
        hasMp4Muxer: typeof Mp4Muxer !== 'undefined'
    });

    if (isHighSpeedSupported) {
        try {
            await generateVideoMP4HighSpeed(timeline, totalFrames, TARGET_FPS, finalTotalDuration, startTime);
            return;
        } catch (e) {
            console.error("High Speed Export Failed, falling back to legacy:", e);
            // Fallthrough to legacy method
        }
    } else {
        console.log("Skipping High Speed Export: Missing Requirements");
    }

    // --- Legacy Export (MediaRecorder) for WebM or Fallback ---
    generateVideoLegacy(timeline, totalFrames, TARGET_FPS, startTime);
}

// --- High Speed MP4 Generation (WebCodecs + mp4-muxer) ---
async function generateVideoMP4HighSpeed(timeline, totalFrames, TARGET_FPS, duration, startTime) {
    generationMode.textContent = "(High-Speed)";
    const width = previewCanvas.width;
    const height = previewCanvas.height;

    let muxer = new Mp4Muxer.Muxer({
        target: new Mp4Muxer.ArrayBufferTarget(),
        video: {
            codec: 'avc', // H.264
            width: width,
            height: height
        },
        fastStart: 'in-memory'
    });

    let videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => {
            console.error("VideoEncoder Error:", e);
            throw e;
        }
    });

    videoEncoder.configure({
        codec: 'avc1.4d0034', // Main Profile Level 5.2 (Supports up to 4k)
        width: width,
        height: height,
        bitrate: 5_000_000, // 5Mbps
        framerate: TARGET_FPS
    });

    const fadeDuration = 1.0; // Sync with main logic
    const isFadeEnabled = fadeEffectInput.checked;

    for (let currentFrame = 0; currentFrame < totalFrames; currentFrame++) {
        // Update Progress
        if (currentFrame % 5 === 0) { // Throttle UI updates
            const percent = Math.round((currentFrame / totalFrames) * 100);
            progressBar.style.width = `${percent}%`;
            progressText.textContent = `${percent}%`;
            await new Promise(r => setTimeout(r, 0)); // Yield to UI
        }

        const currentTime = currentFrame / TARGET_FPS;

        // Render Frame to Canvas
        renderToCanvas(timeline, currentTime, fadeDuration, isFadeEnabled);

        // Encode Frame
        // VideoFrame from Canvas
        let frame = new VideoFrame(previewCanvas, {
            timestamp: currentTime * 1_000_000 // microseconds
        });

        videoEncoder.encode(frame, { keyFrame: currentFrame % (TARGET_FPS * 2) === 0 });
        frame.close();
    }

    // Finish
    await videoEncoder.flush();
    muxer.finalize();

    const buffer = muxer.target.buffer;
    const blob = new Blob([buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);

    finishGeneration(url, 'mp4', startTime);
}

// --- Legacy / Realtime Generation (MediaRecorder) ---
function generateVideoLegacy(timeline, totalFrames, TARGET_FPS, startTime) {
    generationMode.textContent = "(Real-time)";
    let mimeType = 'video/webm;codecs=vp9';
    let ext = 'webm';

    if (selectedFormat === 'mp4') {
        // Fallback to MP4 via MediaRecorder if WebCodecs failed but format is MP4
        // (Likely won't work well if mp4-muxer failed, but worth a try or just default to webm)
        if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
            ext = 'mp4';
        } else {
            alert(translations[currentLang].mp4Warning);
            generateBtn.disabled = false;
            progressContainer.hidden = true;
            return;
        }
    } else if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
    }

    const stream = previewCanvas.captureStream(TARGET_FPS);
    const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 5000000
    });

    const chunks = [];
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        finishGeneration(url, ext, startTime);
    };

    mediaRecorder.start();

    let currentFrame = 0;
    const fadeDuration = 1.0;
    const isFadeEnabled = fadeEffectInput.checked;

    function renderLoop() {
        if (currentFrame >= totalFrames) {
            mediaRecorder.stop();
            return;
        }

        const currentTime = currentFrame / TARGET_FPS;
        renderToCanvas(timeline, currentTime, fadeDuration, isFadeEnabled);

        // Progress
        const percent = Math.round(((currentFrame + 1) / totalFrames) * 100);
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${percent}%`;

        currentFrame++;
        setTimeout(() => {
            requestAnimationFrame(renderLoop);
        }, 1000 / TARGET_FPS);
    }

    renderLoop();
}

function renderToCanvas(timeline, currentTime, fadeDuration, isFadeEnabled) {
    let accumulatedTime = 0;
    let activeImageIdx = 0;
    let timeInImage = 0;

    for (let i = 0; i < timeline.length; i++) {
        if (currentTime < accumulatedTime + timeline[i].duration) {
            activeImageIdx = i;
            timeInImage = currentTime - accumulatedTime;
            break;
        }
        accumulatedTime += timeline[i].duration;
        if (i === timeline.length - 1) {
            activeImageIdx = i;
            timeInImage = timeline[i].duration;
        }
    }

    const activeItem = timeline[activeImageIdx];
    drawImageContain(activeItem.img);
    // Overlay logic omitted for brevity as it is unchanged
    if (isFadeEnabled) {
        ctx.fillStyle = "#FFFFFF";
        if (activeImageIdx === 0) {
            if (timeInImage < fadeDuration) {
                const alpha = 1.0 - (timeInImage / fadeDuration);
                ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
                ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
                ctx.globalAlpha = 1.0;
            }
        }
        if (activeImageIdx === timeline.length - 1) {
            const timeRemaining = activeItem.duration - timeInImage;
            if (timeRemaining < fadeDuration) {
                const alpha = 1.0 - (timeRemaining / fadeDuration);
                ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
                ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
                ctx.globalAlpha = 1.0;
            }
        }
    }
}

function finishGeneration(url, ext, startTime) {
    const endTime = performance.now();
    const elapsed = ((endTime - startTime) / 1000).toFixed(2);
    const modeText = generationMode.textContent;
    generationMode.textContent = `${modeText} - ${elapsed}s`;

    resultVideo.src = url;
    resultVideo.hidden = false;

    downloadLink.href = url;
    downloadLink.download = `video-${Date.now()}.${ext}`;
    downloadLink.hidden = false;
    const typeLabel = ext === 'mp4' ? 'Mp4' : 'Webm';
    const t = translations[currentLang];
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

    // Scroll to result
    resultVideo.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
        outputResolution: "出力解像度:",
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
        downloadBtnWebm: "動画をダウンロード (WebM)",
        historyBtn: "更新履歴",
        historyTitle: "更新履歴"
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
        outputResolution: "Resolution:",
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
        downloadBtnWebm: "Download Video (WebM)",
        historyBtn: "Updates",
        historyTitle: "Update History"
    }
};

// Initial Language Load from LocalStorage
let currentLang = localStorage.getItem('snap2v_lang') || 'ja';
// Apply initial language immediately
updateLanguage(currentLang);

const langToggleBtn = document.getElementById('lang-toggle-btn');
const xShareBtn = document.getElementById('x-share-btn');

function updateLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('snap2v_lang', lang); // Save preference
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
        "Snap2Vで画像を動画にしました！" :
        "Snap2V created a video from images!";

    const hashtags = "Snap2V";
    const shareUrl = "https://piyohico1.github.io/webapps/papps/snap2v/";

    const tweetText = `${intro}\n${shareUrl}\n#${hashtags}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

    window.open(twitterUrl, '_blank');
});

// --- Update History Modal ---
const historyBtn = document.getElementById('history-btn');
const historyModal = document.getElementById('history-modal');
const historyCloseBtn = document.getElementById('history-close-btn');
const historyList = document.getElementById('history-list');

const historyData = {
    ja: [
        {
            date: "2026-02-07", content: `<ul>
            <li>高速書き出しモード追加（WebCodecs採用で約3倍高速化）</li>
            <li>書き出し解像度の選択機能追加</li>
            <li>UIデザインの調整</li>
            <li>ファイル名表示の修正（長いファイル名の末尾が表示されるように）</li>
        </ul>
        <div class="history-note">
            ※WebCodecsが動作しない環境では自動的に従来モードになります<br>
            ※指定解像度より小さい画像は拡大されず元の解像度のまま出力されます
        </div>`
        },
        { date: "2026-02-04", content: "初回リリース" }
    ],
    en: [
        {
            date: "2026-02-07", content: `<ul>
            <li>High-speed export added (Approx 3x faster)</li>
            <li>Output resolution selector</li>
            <li>Updated UI design</li>
            <li>Fixed filename display (Show end of long filenames)</li>
        </ul>
        <div class="history-note">
            *Falls back to heavy mode if WebCodecs is unavailable<br>
            *Images smaller than selected resolution retain original size
        </div>`
        },
        { date: "2026-02-04", content: "Initial release" }
    ]
};

function populateHistory() {
    historyList.innerHTML = '';
    const data = historyData[currentLang] || historyData.ja;
    data.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="date">${item.date}</span>${item.content}`;
        historyList.appendChild(li);
    });
}

historyBtn.addEventListener('click', () => {
    populateHistory();
    historyModal.hidden = false;
});

historyCloseBtn.addEventListener('click', () => {
    historyModal.hidden = true;
});

historyModal.addEventListener('click', (e) => {
    if (e.target === historyModal) {
        historyModal.hidden = true;
    }
});
