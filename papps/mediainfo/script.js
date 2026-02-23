const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const resultsContainer = document.getElementById('results');
const statusMsg = document.getElementById('status-msg');

// Modal Elements
const modal = document.getElementById('detail-modal');
const modalCloseBtn = document.getElementById('modal-close');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body-content');

// Mediainfo instance
let mediaInfo = null;
let lastAnalysisData = null; // Store for re-rendering on lang switch

// --- i18n & Shared Logic ---
const translations = {
    ja: {
        title: 'Media Info',
        desc: '画像・動画・音声ファイルをドラッグ＆ドロップして詳細を確認',
        dropMain: 'ここにファイルをドロップ',
        dropSub: 'またはクリックしてファイルを選択',
        analyzing: '解析中',
        generationInfo: 'Generation Info',
        showDetails: '詳細を表示',
        modalTitle: 'トラック詳細',
        container: 'コンテナ',
        duration: '再生時間',
        fileSize: 'ファイルサイズ',
        bitrate: '総ビットレート',
        videoCodec: '映像コーデック',
        resolution: '解像度',
        frameRate: 'フレームレート',
        videoBitrate: '映像ビットレート',
        audioCodec: '音声コーデック',
        channels: 'チャンネル数',
        sampleRate: 'サンプリングレート',
        audioBitrate: '音声ビットレート',
        imageFormat: '画像フォーマット',
        colorSpace: '色空間',
        bitDepth: 'ビット深度',
        type: '種類',
        audioNoVideo: '音声 / 映像なし',
        errorLoad: 'エラー: MediaInfoライブラリの読み込みに失敗しました。',
        errorFactory: 'エラー: MediaInfoファクトリ関数が見つかりません。',
        ready: '準備完了',
        loading: 'MediaInfo読み込み中...',
        updateHistory: '更新履歴'
    },
    en: {
        title: 'Media Info',
        desc: 'Drag & drop image/video/audio files to check details',
        dropMain: 'Drop files here',
        dropSub: 'or click to select files',
        analyzing: 'Analyzing',
        generationInfo: 'Generation Info',
        showDetails: 'Show Details',
        modalTitle: 'Track Details',
        container: 'Container',
        duration: 'Duration',
        fileSize: 'File Size',
        bitrate: 'Overall Bitrate',
        videoCodec: 'Video Codec',
        resolution: 'Resolution',
        frameRate: 'Frame Rate',
        videoBitrate: 'Video Bitrate',
        audioCodec: 'Audio Codec',
        channels: 'Channels',
        sampleRate: 'Sampling Rate',
        audioBitrate: 'Audio Bitrate',
        imageFormat: 'Image Format',
        colorSpace: 'Color Space',
        bitDepth: 'Bit Depth',
        type: 'Type',
        audioNoVideo: 'Audio / No Video',
        errorLoad: 'Error: MediaInfo library failed to load.',
        errorFactory: 'Error: MediaInfo factory function not found.',
        ready: 'Ready',
        loading: 'MediaInfo loading...',
        updateHistory: 'Update History'
    }
};

let currentLang = localStorage.getItem('mediaInfoLang') || 'ja';

const updateLanguage = (lang) => {
    currentLang = lang;
    localStorage.setItem('mediaInfoLang', lang);
    const t = translations[lang];

    document.getElementById('app-title').textContent = t.title;
    document.getElementById('app-desc').textContent = t.desc;
    document.getElementById('drop-text-main').textContent = t.dropMain;
    document.getElementById('drop-text-sub').textContent = t.dropMain;
    document.getElementById('modal-title').textContent = t.modalTitle;
    document.getElementById('history-btn').setAttribute('aria-label', t.updateHistory);
    document.getElementById('lang-toggle').textContent = lang === 'ja' ? 'EN' : 'JP';

    // Update status message if it's strictly one of the static messages
    const statusMsg = document.getElementById('status-msg');
    if (statusMsg.textContent === translations.ja.ready || statusMsg.textContent === translations.en.ready) {
        statusMsg.textContent = t.ready;
    } else if (statusMsg.textContent === translations.ja.loading || statusMsg.textContent === translations.en.loading) {
        statusMsg.textContent = t.loading;
    }

    updateXShareLink();

    // Re-render result if exists
    if (lastAnalysisData) {
        resultsContainer.innerHTML = '';
        displayResult(
            lastAnalysisData.fileName,
            lastAnalysisData.data,
            lastAnalysisData.thumbnailUrl,
            lastAnalysisData.pngMeta
        );
    }
};

const updateXShareLink = () => {
    const text = currentLang === 'ja'
        ? 'ブラウザで動画・音声・画像のメタデータを解析できるツール「Media Info」'
        : 'Media Info - Browser-based media analysis tool';
    const url = window.location.origin + window.location.pathname; // Dynamic URL
    const hashtags = 'MediaInfo';

    const shareUrl = `https://twitter.com/share?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}`;
    document.getElementById('x-share-btn').href = shareUrl;
};

document.getElementById('lang-toggle').addEventListener('click', () => {
    updateLanguage(currentLang === 'ja' ? 'en' : 'ja');
});

document.getElementById('history-btn').addEventListener('click', () => {
    try {
        const historyElement = document.getElementById(`history-data-${currentLang}`);
        if (!historyElement) throw new Error(`History data for ${currentLang} not found`);
        const text = historyElement.textContent.trim();
        const html = convertMarkdownToHtml(text);
        openModal(translations[currentLang].updateHistory, html);
    } catch (error) {
        console.error(error);
        openModal(translations[currentLang].updateHistory, `<p style="color:var(--danger-color)">${error.message}</p>`);
    }
});

const convertMarkdownToHtml = (markdown) => {
    const lines = markdown.split('\n');
    let html = '<div class="markdown-body">';

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        // Headers
        if (line.startsWith('### ')) {
            html += `<h4>${escapeHtml(line.slice(4))}</h4>`;
        } else if (line.startsWith('## ')) {
            html += `<h3 class="details-section-title">${escapeHtml(line.slice(3))}</h3>`;
        } else if (line.startsWith('# ')) {
            html += `<h2 style="color:var(--accent-color);margin-bottom:var(--spacing-md);font-size:1.2rem;">${escapeHtml(line.slice(2))}</h2>`;
        }
        // Lists
        else if (line.startsWith('- ') || line.startsWith('* ')) {
            html += `<li style="margin-left:var(--spacing-md);margin-bottom:4px;list-style-type:disc;">${escapeHtml(line.slice(2))}</li>`;
        }
        // Paragraph
        else {
            html += `<p style="margin-bottom:var(--spacing-sm);">${escapeHtml(line)}</p>`;
        }
    });

    html += '</div>';
    return html;
};

// Init
updateLanguage(currentLang);


// Initialize MediaInfo
const initMediaInfo = async () => {
    const t = translations[currentLang];
    statusMsg.textContent = t.loading;
    statusMsg.style.color = 'var(--text-secondary)';

    // Wait for the script to define MediaInfo (UMD global)
    let attempts = 0;
    while (typeof MediaInfo === 'undefined' && attempts < 20) {
        await new Promise(r => setTimeout(r, 500));
        attempts++;
    }

    if (typeof MediaInfo === 'undefined') {
        statusMsg.textContent = t.errorLoad;
        statusMsg.style.color = 'var(--danger-color)';
        return;
    }

    // v0.3.7 UMD exports MediaInfo as an object with .mediaInfoFactory or .default
    const factory = MediaInfo.mediaInfoFactory || MediaInfo.default || (typeof MediaInfo === 'function' ? MediaInfo : null);

    if (!factory) {
        statusMsg.textContent = t.errorFactory;
        statusMsg.style.color = 'var(--danger-color)';
        return;
    }

    try {
        mediaInfo = await factory({
            format: 'object',
            locateFile: () => 'MediaInfoModule.wasm'
        });
        console.log('MediaInfo initialized');
        statusMsg.textContent = t.ready;
        statusMsg.style.color = 'var(--success-color)';
    } catch (error) {
        console.error('Failed to initialize MediaInfo:', error);
        statusMsg.textContent = 'Error: ' + error.message;
        statusMsg.style.color = 'var(--danger-color)';
    }
};

initMediaInfo();

// --- Drag and Drop Logic ---

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('active');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('active');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('active');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

dropZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
        fileInput.value = ''; // Reset for same file selection
    }
});

// --- Modal Logic ---

const openModal = (title, contentHtml) => {
    modalTitle.textContent = title;
    modalBody.innerHTML = contentHtml;
    modal.classList.add('open');
};

const closeModal = () => {
    modal.classList.remove('open');
};

modalCloseBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeModal();
    }
});
// Escape key to close
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
        closeModal();
    }
});

// --- Thumbnail Generation ---

const generateThumbnail = (file) => {
    return new Promise((resolve) => {
        const objectUrl = URL.createObjectURL(file);
        const type = file.type || '';

        if (type.startsWith('image/')) {
            resolve(objectUrl);
        } else if (type.startsWith('video/')) {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.muted = true;
            video.playsInline = true;
            video.src = objectUrl;
            video.addEventListener('loadeddata', () => {
                video.currentTime = Math.min(1, video.duration * 0.1);
            });
            video.addEventListener('seeked', () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0);
                const thumbUrl = canvas.toDataURL('image/jpeg', 0.7);
                URL.revokeObjectURL(objectUrl);
                resolve(thumbUrl);
            });
            video.addEventListener('error', () => {
                URL.revokeObjectURL(objectUrl);
                resolve(null);
            });
        } else {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
        }
    });
};

// --- PNG/JPEG AI Generation Metadata Extraction ---

const extractGenerationMetadata = async (file) => {
    const type = file.type || '';
    const name = file.name.toLowerCase();

    if (type === 'image/png' || name.endsWith('.png')) {
        return await extractPngTextChunks(file);
    }
    // JPEG EXIF UserComment could also contain AI metadata
    // but that requires full EXIF parsing - skip for now
    return null;
};

const extractPngTextChunks = async (file) => {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    const decoder = new TextDecoder('utf-8');
    const result = {};
    let found = false;

    // PNG signature is 8 bytes
    let offset = 8;

    while (offset < buffer.byteLength) {
        if (offset + 8 > buffer.byteLength) break;
        const length = view.getUint32(offset, false); // big-endian
        const typeBytes = new Uint8Array(buffer, offset + 4, 4);
        const chunkType = String.fromCharCode(...typeBytes);

        if (chunkType === 'tEXt') {
            const data = new Uint8Array(buffer, offset + 8, length);
            // keyword\0text
            const nullIdx = data.indexOf(0);
            if (nullIdx > 0) {
                const keyword = decoder.decode(data.slice(0, nullIdx));
                const text = decoder.decode(data.slice(nullIdx + 1));
                result[keyword] = text;
                found = true;
            }
        } else if (chunkType === 'iTXt') {
            const data = new Uint8Array(buffer, offset + 8, length);
            // keyword\0 compressionFlag compressionMethod languageTag\0 translatedKeyword\0 text
            const nullIdx = data.indexOf(0);
            if (nullIdx > 0) {
                const keyword = decoder.decode(data.slice(0, nullIdx));
                const compressionFlag = data[nullIdx + 1];
                // Skip compression method (1 byte)
                let pos = nullIdx + 3;
                // Skip language tag
                while (pos < data.length && data[pos] !== 0) pos++;
                pos++; // skip null
                // Skip translated keyword
                while (pos < data.length && data[pos] !== 0) pos++;
                pos++; // skip null
                const textBytes = data.slice(pos);
                if (compressionFlag === 0) {
                    result[keyword] = decoder.decode(textBytes);
                    found = true;
                } else {
                    // zlib compressed - use DecompressionStream
                    try {
                        const ds = new DecompressionStream('deflate');
                        const writer = ds.writable.getWriter();
                        writer.write(textBytes);
                        writer.close();
                        const reader = ds.readable.getReader();
                        const chunks = [];
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            chunks.push(value);
                        }
                        const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
                        const merged = new Uint8Array(totalLen);
                        let mergeOffset = 0;
                        for (const c of chunks) {
                            merged.set(c, mergeOffset);
                            mergeOffset += c.length;
                        }
                        result[keyword] = decoder.decode(merged);
                        found = true;
                    } catch (e) {
                        console.warn('Failed to decompress iTXt chunk:', keyword, e);
                    }
                }
            }
        } else if (chunkType === 'IEND') {
            break;
        }

        // Move to next chunk: 4(length) + 4(type) + length(data) + 4(CRC)
        offset += 12 + length;
    }

    return found ? result : null;
};

// --- File Handling & Display ---

const handleFile = async (file) => {
    const t = translations[currentLang];
    if (!mediaInfo) {
        alert('MediaInfo is still loading. Please wait.'); // Consider i18n for alert too
        return;
    }

    // Clear previous results
    resultsContainer.innerHTML = '';

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'result-card';
    loadingDiv.style.textAlign = 'center';
    loadingDiv.innerHTML = `<span class="material-symbols-outlined" style="animation: spin 1s linear infinite;">progress_activity</span> ${t.analyzing} ${file.name}...`;
    resultsContainer.appendChild(loadingDiv);

    try {
        // Run analysis and thumbnail generation in parallel
        const readChunk = (size, offset) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (event.target.error) reject(event.target.error);
                    resolve(new Uint8Array(event.target.result));
                };
                reader.readAsArrayBuffer(file.slice(offset, offset + size));
            });
        };

        const [result, thumbnailUrl, pngMeta] = await Promise.all([
            mediaInfo.analyzeData(file.size, readChunk),
            generateThumbnail(file),
            extractGenerationMetadata(file)
        ]);

        resultsContainer.removeChild(loadingDiv);

        lastAnalysisData = {
            fileName: file.name,
            data: result,
            thumbnailUrl: thumbnailUrl,
            pngMeta: pngMeta
        };

        displayResult(file.name, result, thumbnailUrl, pngMeta);

    } catch (error) {
        console.error(error);
        loadingDiv.textContent = 'Error: ' + error.message;
        loadingDiv.style.color = 'var(--danger-color)';
    }
};

const displayResult = (fileName, data, thumbnailUrl, pngMeta) => {
    const t = translations[currentLang];
    const general = data.media.track.find(t => t['@type'] === 'General') || {};
    const video = data.media.track.find(t => t['@type'] === 'Video');
    const audio = data.media.track.find(t => t['@type'] === 'Audio');
    const image = data.media.track.find(t => t['@type'] === 'Image');

    const card = document.createElement('div');
    card.className = 'result-card';

    // Summary Items
    const summaryItems = [
        { label: t.container, value: general.Format },
    ];

    // Only add Duration and Bitrate for non-image files
    if (!image) {
        summaryItems.push(
            { label: t.duration, value: formatDuration(general.Duration) },
            { label: t.bitrate, value: formatBitrate(general.OverallBitRate) }
        );
    }

    summaryItems.push(
        { label: t.fileSize, value: formatFileSize(general.FileSize) }
    );

    if (video) {
        summaryItems.push(
            { label: t.videoCodec, value: `${video.Format} ${video.Format_Profile ? '(' + video.Format_Profile + ')' : ''}` },
            { label: t.resolution, value: `${video.Width} × ${video.Height}` },
            { label: t.frameRate, value: `${video.FrameRate} fps` },
            { label: t.videoBitrate, value: formatBitrate(video.BitRate) }
        );
    } else if (image) {
        summaryItems.push(
            { label: t.resolution, value: `${image.Width} × ${image.Height}` },
            { label: t.colorSpace, value: image.ColorSpace },
            { label: t.bitDepth, value: image.BitDepth ? `${image.BitDepth} bits` : '-' }
        );
    } else {
        summaryItems.push({ label: t.type, value: t.audioNoVideo });
    }

    if (audio) {
        summaryItems.push(
            { label: t.audioCodec, value: `${audio.Format}` },
            { label: t.channels, value: `${audio.Channels} ch` },
            { label: t.sampleRate, value: `${audio.SamplingRate} Hz` },
            { label: t.audioBitrate, value: formatBitrate(audio.BitRate) }
        );
    }

    const gridHtml = summaryItems.map(item => `
        <div class="meta-item">
            <div class="meta-label">${item.label}</div>
            <div class="meta-value">${item.value || '-'}</div>
        </div>
    `).join('');

    const thumbHtml = thumbnailUrl
        ? `<div class="result-thumbnail"><img src="${thumbnailUrl}" alt="Thumbnail"></div>`
        : '';

    // Check for Generation Info (from PNG chunks or MediaInfo tracks)
    const genInfo = getGenerationInfo(general, pngMeta);

    const genBtnHtml = genInfo
        ? `<button class="btn btn-sm btn-primary show-gen-info-btn">
             <span class="material-symbols-outlined" style="font-size: 16px;">auto_awesome</span>
             ${t.generationInfo}
           </button>`
        : '';

    card.innerHTML = `
        <div class="result-header">
            <div class="file-name">${fileName}</div>
            <div class="header-actions">
                ${genBtnHtml}
                <button class="btn btn-sm btn-secondary show-details-btn">
                    <span class="material-symbols-outlined" style="font-size: 16px;">list</span>
                    ${t.showDetails}
                </button>
            </div>
        </div>
        <div class="result-body">
            ${thumbnailUrl ? `<div class="result-thumbnail"><img src="${thumbnailUrl}" alt="Thumbnail"></div>` : ''}
            <div class="result-meta">
                <div class="meta-grid">
                    ${gridHtml}
                </div>
            </div>
        </div>
    `;

    // Add Event Listener to the buttons
    const detailBtn = card.querySelector('.show-details-btn');
    detailBtn.addEventListener('click', () => {
        showDetailsModal(fileName, data.media.track);
    });

    if (genInfo) {
        const genBtn = card.querySelector('.show-gen-info-btn');
        genBtn.addEventListener('click', () => {
            showGenerationModal(fileName, genInfo);
        });
    }

    resultsContainer.appendChild(card);
};

const getGenerationInfo = (generalTrack, pngMeta) => {
    const info = {};
    let found = false;

    // 1. Check PNG text chunks first (most reliable)
    if (pngMeta) {
        const aiKeys = ['parameters', 'workflow', 'prompt', 'Comment', 'Description',
            'postprocessing', 'extras', 'Software'];
        for (const [key, value] of Object.entries(pngMeta)) {
            if (aiKeys.includes(key) || key.toLowerCase().includes('parameter')) {
                info[key] = value;
                found = true;
            }
        }
    }

    // 2. Also check MediaInfo General track (for videos and other formats)
    if (generalTrack) {
        const metaKeys = ['parameters', 'workflow', 'prompt', 'Comment', 'Description',
            'Title', 'comment', 'description'];
        for (const [key, value] of Object.entries(generalTrack)) {
            if (found && !metaKeys.includes(key)) continue; // already found from PNG, skip non-meta keys
            if (metaKeys.includes(key) || key.toLowerCase().includes('parameters') || key.toLowerCase().includes('comment')) {
                if (typeof value === 'string' && value.length > 10) {
                    // Check if it looks like AI generation data
                    const looksLikeAI =
                        value.includes('Steps:') ||
                        value.includes('Sampler:') ||
                        value.includes('CFG') ||
                        value.includes('"nodes"') ||
                        value.includes('"inputs"') ||
                        value.includes('"class_type"') ||
                        value.includes('"workflow"') ||
                        value.includes('"prompt"') ||
                        key === 'workflow' ||
                        key === 'prompt' ||
                        key === 'parameters';
                    if (looksLikeAI) {
                        info[key] = value;
                        found = true;
                    }
                }
            }
        }
    }

    return found ? info : null;
};

const parseA1111Metadata = (text) => {
    const result = {};
    if (typeof text !== 'string') return null;

    let prompt = "";
    let negativePrompt = "";
    let settings = "";

    const splitNeg = text.split(/Negative prompt:\s*/i);
    if (splitNeg.length > 1) {
        prompt = splitNeg[0].trim();
        const splitSteps = splitNeg[1].split(/Steps:\s*/i);
        if (splitSteps.length > 1) {
            negativePrompt = splitSteps[0].trim();
            settings = "Steps: " + splitSteps[1].trim();
        } else {
            negativePrompt = splitNeg[1].trim();
        }
    } else {
        const splitSteps = text.split(/Steps:\s*/i);
        if (splitSteps.length > 1) {
            prompt = splitSteps[0].trim();
            settings = "Steps: " + splitSteps[1].trim();
        } else {
            return null; // Not A1111 format
        }
    }

    if (prompt) result["Prompt"] = prompt;
    if (negativePrompt) result["Negative prompt"] = negativePrompt;

    if (settings) {
        const pairs = [];
        let currentToken = "";
        let inQuotes = false;
        let escape = false;

        for (let i = 0; i < settings.length; i++) {
            const char = settings[i];

            if (char === '\\' && !escape) {
                escape = true;
                currentToken += char;
                continue;
            }
            if (char === '"' && !escape) {
                inQuotes = !inQuotes;
            }

            if (char === ',' && !inQuotes) {
                pairs.push(currentToken.trim());
                currentToken = "";
            } else {
                currentToken += char;
            }

            escape = false;
        }
        if (currentToken.trim()) {
            pairs.push(currentToken.trim());
        }

        pairs.forEach(pair => {
            const colonIdx = pair.indexOf(':');
            if (colonIdx > -1) {
                const k = pair.substring(0, colonIdx).trim();
                let v = pair.substring(colonIdx + 1).trim();
                if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
                    v = v.substring(1, v.length - 1);
                }
                result[k] = v;
            } else {
                result["Settings"] = (result["Settings"] ? result["Settings"] + ", " : "") + pair;
            }
        });
    }

    return Object.keys(result).length > 0 ? result : null;
};

const showGenerationModal = (fileName, genInfo) => {
    let html = '<div class="gen-meta-container">';

    for (const [key, rawValue] of Object.entries(genInfo)) {
        html += `<div class="gen-meta-source-title">${escapeHtml(key)}</div>`;

        let parsed = null;
        if (typeof rawValue === 'string') {
            const trimmed = rawValue.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try {
                    parsed = JSON.parse(trimmed);
                } catch (e) { }
            }
            if (!parsed && trimmed.includes('Steps:')) {
                parsed = parseA1111Metadata(trimmed);
            }
        }

        if (parsed && typeof parsed === 'object') {
            html += `<div class="gen-meta-grid">`;

            // Group specific keys (Model + Hash, VAE + Hash)
            const processed = [];
            const keysToSkip = new Set();
            const entries = Object.entries(parsed);

            // Determine which keys to skip (standalone hash keys)
            if (parsed['Model'] && parsed['Model hash']) keysToSkip.add('Model hash');
            if (parsed['VAE'] && parsed['VAE hash']) keysToSkip.add('VAE hash');

            entries.forEach(([k, v]) => {
                if (keysToSkip.has(k)) return;

                if (k === 'Model' && parsed['Model hash']) {
                    processed.push(['Model', `${v} (${parsed['Model hash']})`]);
                } else if (k === 'VAE' && parsed['VAE hash']) {
                    processed.push(['VAE', `${v} (${parsed['VAE hash']})`]);
                } else {
                    processed.push([k, v]);
                }
            });

            for (const [subKey, subVal] of processed) {
                const isObject = typeof subVal === 'object' && subVal !== null;
                const isLongText = typeof subVal === 'string' && subVal.length > 60;
                const isPrompt = subKey.toLowerCase().includes('prompt');
                const cellClass = (isLongText || isObject || isPrompt) ? 'gen-meta-cell full-width' : 'gen-meta-cell';

                let displayVal = subVal;
                if (isObject) {
                    displayVal = JSON.stringify(subVal, null, 2);
                }

                html += `
                    <div class="${cellClass}">
                        <div class="gen-meta-label">${escapeHtml(subKey)}</div>
                        <div class="gen-meta-value">${escapeHtml(String(displayVal))}</div>
                    </div>
                `;
            }
            html += `</div>`;
        } else {
            html += `<pre class="code-block">${escapeHtml(String(rawValue))}</pre>`;
        }
    }

    html += '</div>';

    openModal('Generation Info', html);
};


const escapeHtml = (unsafe) => {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};


const showDetailsModal = (fileName, tracks) => {
    let html = '';

    tracks.forEach(track => {
        const trackType = track['@type'];
        html += `<div class="details-section-title">${trackType}</div>`;
        html += '<table class="details-table"><tbody>';

        // Filter out redundant or internal fields if needed, 
        // for now displaying most keys that act like metadata
        for (const [key, value] of Object.entries(track)) {
            if (key === '@type') continue;
            // Skip object values (sub-properties) for simple table display
            if (typeof value === 'object') continue;

            html += `
                <tr>
                    <th>${key}</th>
                    <td>${value}</td>
                </tr>
            `;
        }
        html += '</tbody></table>';
    });

    openModal(translations[currentLang].modalTitle || 'Track Details', html);
};

// Utils
const formatDuration = (ms) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60); // 整数のみ

    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
};

const formatBitrate = (bps) => {
    if (!bps) return '-';
    // bps can be string or number
    bps = Number(bps);
    const kbps = Math.round(bps / 1000);
    if (kbps > 1000) {
        return `${(kbps / 1000).toFixed(1)} Mbps`;
    }
    return `${kbps} Kbps`;
};

const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    bytes = Number(bytes);
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) {
        return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
};
