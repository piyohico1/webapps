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
        loading: 'MediaInfo読み込み中...'
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
        loading: 'MediaInfo loading...'
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
    document.getElementById('drop-text-sub').textContent = t.dropSub;
    document.getElementById('modal-title').textContent = t.modalTitle;
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

const showGenerationModal = (fileName, genInfo) => {
    let html = '';

    for (const [key, value] of Object.entries(genInfo)) {
        html += `<div class="details-section-title">${key}</div>`;
        html += `<pre class="code-block">${escapeHtml(value)}</pre>`;
    }

    openModal(fileName + ' - Generation Info', html);
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

    openModal(fileName, html);
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
