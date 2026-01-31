// --- Utilities ---
function toggleAccordion(header) {
    header.parentElement.classList.toggle('active');
}

// --- History Manager ---
class HistoryManager {
    constructor(app) {
        this.app = app;
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 20;
    }

    pushState() {
        // Optimization: Don't use JSON.stringify on the whole state (which includes ImageData)
        const state = this.app.getState();

        if (this.undoStack.length > 0) {
            const lastState = this.undoStack[this.undoStack.length - 1];
            if (this.areStatesEqual(lastState, state)) {
                return; // No change
            }
        }

        this.undoStack.push(state);
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        this.redoStack = [];
        this.updateUI();
    }

    areStatesEqual(s1, s2) {
        // Fast comparison
        if (JSON.stringify(s1.transform) !== JSON.stringify(s2.transform)) return false;
        if (JSON.stringify(s1.filters) !== JSON.stringify(s2.filters)) return false;
        // Check Mask Reference (ImageData objects)
        // Note: references might be same if reused. 
        // If s1.maskData === s2.maskData, they are equal.
        // If they are different objects, we assume they are different (or too expensive to check deeply)
        // In our optimization, we reuse the same ImageData object if mask didn't change, so reference check is valid!
        if (s1.maskData !== s2.maskData) return false;

        return true;
    }

    undo() {
        if (this.undoStack.length === 0) return;

        // Save current state to redo stack first
        this.redoStack.push(this.app.getState());

        const prevState = this.undoStack.pop();
        this.app.restoreState(prevState);
        this.updateUI();
    }

    redo() {
        if (this.redoStack.length === 0) return;

        // Save current state to undo stack
        this.undoStack.push(this.app.getState());

        const nextState = this.redoStack.pop();
        this.app.restoreState(nextState);
        this.updateUI();
    }

    updateUI() {
        document.getElementById('undoBtn').disabled = this.undoStack.length === 0;
        document.getElementById('redoBtn').disabled = this.redoStack.length === 0;
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.updateUI();
    }
}

// --- Main App Logic ---
class ImageCompositor {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Images
        this.bgImage = null;
        this.overlayImage = null;

        // Caching
        this.cachedOverlay = {
            canvas: document.createElement('canvas'),
            ctx: null,
            isValid: false
        };
        this.cachedOverlay.ctx = this.cachedOverlay.canvas.getContext('2d', { willReadFrequently: true });

        // Low-Res Proxy
        this.cachedSmall = {
            canvas: document.createElement('canvas'),
            ctx: null,
            scale: 1,
            isValid: false
        };
        this.cachedSmall.ctx = this.cachedSmall.canvas.getContext('2d');

        // Mask State Optimizations
        this.maskCache = null;
        this.maskDirty = true;

        // Render Flag
        this.needsRedraw = true;

        // State
        this.transform = {
            x: 0, y: 0,
            scale: 1,
            rotation: 0,
            flipH: false
        };

        this.filters = {
            opacity: 1,
            brightness: 1,
            contrast: 1,
            saturation: 1,
            hue: 0
        };

        this.view = { scale: 1, x: 0, y: 0 };
        this.tool = 'move';
        this.eraser = {
            size: 20,
            softness: 0,
            maskCanvas: null,
            maskCtx: null,
            isDrawing: false,
            lastPos: null
        };

        this.isDragging = false;
        this.isPanning = false;
        this.dragStart = { x: 0, y: 0 };
        this.lastPos = { x: 0, y: 0 };
        this.currentCursorPos = { x: -100, y: -100 };

        this.history = new HistoryManager(this);
        this.init();
    }

    init() {
        this.setupInputs();
        this.setupCanvasEvents();
        this.setupKeyboard();
        this.resizeCanvas();
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.requestRender();
        });

        const animate = () => {
            if (this.needsRedraw) {
                this.draw();
                this.needsRedraw = false;
            }
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }

    requestRender() {
        this.needsRedraw = true;
    }

    setupInputs() {
        // Same as before... but refactored for brevity in this replace call if needed.
        // Copying full setupInputs logic...
        const bgInput = document.getElementById('bgInput');
        const bgCard = document.getElementById('bgUploadCard');
        bgCard.onclick = () => { if (!this.bgImage) bgInput.click(); };
        bgInput.onchange = (e) => this.handleImageUpload(e.target.files[0], 'bg');

        const ovInput = document.getElementById('overlayInput');
        const ovCard = document.getElementById('overlayUploadCard');
        ovCard.onclick = () => { if (!this.overlayImage) ovInput.click(); };
        ovInput.onchange = (e) => this.handleImageUpload(e.target.files[0], 'overlay');

        [bgCard, ovCard].forEach(card => {
            card.ondragover = (e) => { e.preventDefault(); card.classList.add('drag-over'); };
            card.ondragleave = () => card.classList.remove('drag-over');
            card.ondrop = (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                if (e.dataTransfer.files[0]) {
                    const type = card.id.includes('bg') ? 'bg' : 'overlay';
                    this.handleImageUpload(e.dataTransfer.files[0], type);
                }
            };
        });

        // Canvas DnD - Smart Loading
        const canvasContainer = document.getElementById('canvasContainer');
        canvasContainer.ondragover = (e) => {
            e.preventDefault();
            canvasContainer.style.borderColor = 'var(--accent-color)';
            canvasContainer.style.borderWidth = '2px';
            canvasContainer.style.borderStyle = 'solid';
        };
        canvasContainer.ondragleave = () => {
            canvasContainer.style.borderColor = 'transparent';
            canvasContainer.style.borderWidth = '0px';
        };
        canvasContainer.ondrop = (e) => {
            e.preventDefault();
            canvasContainer.style.borderColor = 'transparent';
            canvasContainer.style.borderWidth = '0px';

            if (e.dataTransfer.files[0]) {
                if (!this.bgImage) {
                    this.handleImageUpload(e.dataTransfer.files[0], 'bg');
                } else {
                    this.handleImageUpload(e.dataTransfer.files[0], 'overlay');
                }
            }
        };

        document.getElementById('clearBgBtn').onclick = (e) => { e.stopPropagation(); this.clearImage('bg'); };
        document.getElementById('clearOverlayBtn').onclick = (e) => { e.stopPropagation(); this.clearImage('overlay'); };

        const bindControl = (id, validId, targetObj, prop, factor = 1) => {
            const slider = document.getElementById(id + 'Slider');
            const input = document.getElementById(id + 'Input');
            const update = (val) => {
                this.history.pushState();
                targetObj[prop] = parseFloat(val) * factor;
                slider.value = val;
                input.value = val;
                this.requestRender();
            };
            slider.oninput = (e) => {
                targetObj[prop] = parseFloat(e.target.value) * factor;
                input.value = e.target.value;
                this.requestRender();
            };
            slider.onchange = (e) => {
                this.history.pushState();
                this.requestRender();
            };
            input.onchange = (e) => update(e.target.value);
        };

        bindControl('scale', 'scaleVal', this.transform, 'scale', 0.01);
        bindControl('rotate', 'rotateVal', this.transform, 'rotation');
        bindControl('opacity', 'opacityVal', this.filters, 'opacity', 0.01);
        bindControl('brightness', 'brightnessVal', this.filters, 'brightness', 0.01);
        bindControl('contrast', 'contrastVal', this.filters, 'contrast', 0.01);
        bindControl('saturation', 'saturationVal', this.filters, 'saturation', 0.01);
        bindControl('hue', 'hueVal', this.filters, 'hue');

        document.getElementById('flipCheck').onchange = (e) => {
            this.history.pushState();
            this.transform.flipH = e.target.checked;
            this.requestRender();
        };

        document.getElementById('eraserSizeSlider').oninput = (e) => {
            this.eraser.size = parseInt(e.target.value);
            document.getElementById('eraserSizeVal').textContent = this.eraser.size + 'px';
        };
        document.getElementById('eraserSoftSlider').oninput = (e) => {
            this.eraser.softness = parseInt(e.target.value) / 100;
            document.getElementById('eraserSoftVal').textContent = parseInt(e.target.value) + '%';
        };

        document.getElementById('undoBtn').onclick = () => { this.history.undo(); this.requestRender(); };
        document.getElementById('redoBtn').onclick = () => { this.history.redo(); this.requestRender(); };
        document.getElementById('resetViewBtn').onclick = () => { this.fitView(); };
        document.getElementById('downloadBtn').onclick = () => this.download();
        document.getElementById('copyBtn').onclick = () => this.copyToClipboard();

        // Zoom Buttons - Zoom from Center Logic
        document.getElementById('zoomInBtn').onclick = () => {
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;
            const oldScale = this.view.scale;
            const newScale = oldScale * 1.1;

            // newX = cx - (cx - oldX) * (newScale / oldScale)
            this.view.x = cx - (cx - this.view.x) * (newScale / oldScale);
            this.view.y = cy - (cy - this.view.y) * (newScale / oldScale);
            this.view.scale = newScale;

            this.updateViewUI();
            this.requestRender();
        };
        document.getElementById('zoomOutBtn').onclick = () => {
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;
            const oldScale = this.view.scale;
            const newScale = oldScale / 1.1;

            this.view.x = cx - (cx - this.view.x) * (newScale / oldScale);
            this.view.y = cy - (cy - this.view.y) * (newScale / oldScale);
            this.view.scale = newScale;

            this.updateViewUI();
            this.requestRender();
        };

        document.getElementById('downloadBtn').onclick = () => this.download();

        // New Features
        this.currentLang = localStorage.getItem('imagecomp_lang') || 'ja';
        this.setLanguage(this.currentLang);

        document.getElementById('langBtn').onclick = () => {
            const next = this.currentLang === 'ja' ? 'en' : 'ja';
            this.setLanguage(next);
        };

        document.getElementById('shareBtn').onclick = () => this.shareToX();

        // Update Modal Logic
        const modal = document.getElementById('updateModal');
        const openBtn = document.getElementById('updateBtn');
        const closeBtn = document.getElementsByClassName('close-modal')[0];
        const closeBtnFooter = document.getElementById('closeModalBtn');

        const openModal = () => modal.classList.add('show');
        const closeModal = () => modal.classList.remove('show');

        openBtn.onclick = openModal;
        closeBtn.onclick = closeModal;
        closeBtnFooter.onclick = closeModal;

        window.onclick = (e) => {
            if (e.target === modal) closeModal();
        };

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });
    }

    setLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('imagecomp_lang', lang);
        document.getElementById('langBtn').textContent = lang === 'ja' ? 'JP' : 'EN'; // Show what it IS or what it WILL BE? Usually "EN" means switch to EN. But let's show current status or toggle. 
        // Request says "Japanese/English language support and switch button".
        // Let's make the button show the *current* language or the *target*?
        // Standard is often showing the current language code or flag.
        // Let's show the current one for now: "JP" or "EN".
        document.getElementById('langBtn').textContent = lang.toUpperCase();
        document.documentElement.lang = lang;

        const t = locales[lang];
        if (!t) return;

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key]) {
                const attr = el.getAttribute('data-i18n-attr');
                if (attr) {
                    el.setAttribute(attr, t[key]);
                } else {
                    el.innerHTML = t[key];
                }
            }
        });
    }

    shareToX() {
        const t = locales[this.currentLang];
        const text = encodeURIComponent(t.introText);
        const url = encodeURIComponent(window.location.href);
        const intentUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}&hashtags=Composi`;
        window.open(intentUrl, '_blank');
    }

    handleImageUpload(file, type) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                if (type === 'bg') {
                    this.bgImage = img;
                    this.fitView();
                    document.getElementById('bgUploadCard').classList.add('has-image');
                    document.getElementById('bgPreview').src = img.src;
                    document.getElementById('clearBgBtn').style.display = 'block';
                    document.getElementById('downloadBtn').disabled = false;
                    document.getElementById('copyBtn').disabled = false;
                    this.fitView();
                } else {
                    this.overlayImage = img;
                    document.getElementById('overlayUploadCard').classList.add('has-image');
                    document.getElementById('overlayPreview').src = img.src;
                    document.getElementById('clearOverlayBtn').style.display = 'block';
                    this.initMask();
                    this.updateOverlayCache();
                    this.resetTransform();
                }
                this.history.pushState();
                this.requestRender();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    clearImage(type) {
        this.history.pushState();
        if (type === 'bg') {
            this.bgImage = null;
            document.getElementById('bgUploadCard').classList.remove('has-image');
            document.getElementById('bgPreview').src = '';
            document.getElementById('clearBgBtn').style.display = 'none';
            document.getElementById('bgInput').value = '';
        } else {
            this.overlayImage = null;
            document.getElementById('overlayUploadCard').classList.remove('has-image');
            document.getElementById('overlayPreview').src = '';
            document.getElementById('clearOverlayBtn').style.display = 'none';
            document.getElementById('overlayInput').value = '';
            this.eraser.maskCanvas = null;
            this.cachedOverlay.isValid = false;
            this.cachedSmall.isValid = false;
        }
        this.requestRender();
    }

    initMask() {
        if (!this.overlayImage) return;
        this.eraser.maskCanvas = document.createElement('canvas');
        this.eraser.maskCanvas.width = this.overlayImage.width;
        this.eraser.maskCanvas.height = this.overlayImage.height;
        this.eraser.maskCtx = this.eraser.maskCanvas.getContext('2d');
        this.maskDirty = true;
    }

    updateOverlayCache() {
        if (!this.overlayImage) return;

        const w = this.overlayImage.width;
        const h = this.overlayImage.height;

        if (this.cachedOverlay.canvas.width !== w || this.cachedOverlay.canvas.height !== h) {
            this.cachedOverlay.canvas.width = w;
            this.cachedOverlay.canvas.height = h;
        }

        const ctx = this.cachedOverlay.ctx;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(this.overlayImage, 0, 0);

        if (this.eraser.maskCanvas) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.drawImage(this.eraser.maskCanvas, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
        }

        this.cachedOverlay.isValid = true;

        // Low Res
        const MaxSize = 2048;
        let scale = 1;
        if (w > MaxSize || h > MaxSize) {
            scale = Math.min(MaxSize / w, MaxSize / h);
        }

        const sw = Math.floor(w * scale);
        const sh = Math.floor(h * scale);

        if (this.cachedSmall.canvas.width !== sw || this.cachedSmall.canvas.height !== sh) {
            this.cachedSmall.canvas.width = sw;
            this.cachedSmall.canvas.height = sh;
        }
        this.cachedSmall.scale = scale;

        const sCtx = this.cachedSmall.ctx;
        sCtx.clearRect(0, 0, sw, sh);
        sCtx.drawImage(this.cachedOverlay.canvas, 0, 0, sw, sh);
        this.cachedSmall.isValid = true;
    }

    resetTransform() {
        this.history.pushState();

        let initialScale = 1;

        if (this.bgImage) {
            this.transform.x = this.bgImage.width / 2;
            this.transform.y = this.bgImage.height / 2;

            // Fit overlay to background
            if (this.overlayImage) {
                const scaleX = this.bgImage.width / this.overlayImage.width;
                const scaleY = this.bgImage.height / this.overlayImage.height;
                initialScale = Math.min(scaleX, scaleY);
            }
        } else {
            this.transform.x = this.canvas.width / 2;
            this.transform.y = this.canvas.height / 2;
        }

        this.transform.scale = initialScale;
        this.transform.rotation = 0;
        this.transform.flipH = false;
        this.updateControlUI();
        this.requestRender();
    }

    resetFilters() {
        this.history.pushState();
        this.filters.opacity = 1;
        this.filters.brightness = 1;
        this.filters.contrast = 1;
        this.filters.saturation = 1;
        this.filters.hue = 0;
        this.updateControlUI();
        this.requestRender();
    }

    resetMask() {
        if (this.eraser.maskCtx) {
            this.history.pushState();
            this.eraser.maskCtx.clearRect(0, 0, this.eraser.maskCanvas.width, this.eraser.maskCanvas.height);
            this.maskDirty = true;
            this.updateOverlayCache();
            this.requestRender();
        }
    }

    setTool(tool) {
        this.tool = tool;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(tool + 'ToolBtn').classList.add('active');
        document.getElementById('eraserSettings').style.display = tool === 'eraser' ? 'block' : 'none';
        document.getElementById('canvasContainer').style.cursor = tool === 'eraser' ? 'crosshair' : 'default';
    }

    setupCanvasEvents() {
        const c = this.canvas;
        c.addEventListener('mousedown', e => this.onPointerDown(e));
        window.addEventListener('mousemove', e => this.onPointerMove(e));
        window.addEventListener('mouseup', e => this.onPointerUp(e));
        c.addEventListener('wheel', e => this.onWheel(e));
        c.addEventListener('contextmenu', e => e.preventDefault());
    }

    getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    screenToWorld(x, y) {
        return { x: (x - this.view.x) / this.view.scale, y: (y - this.view.y) / this.view.scale };
    }

    worldToOverlay(x, y) {
        if (!this.overlayImage) return null;
        let lx = x - this.transform.x;
        let ly = y - this.transform.y;
        const rad = -this.transform.rotation * Math.PI / 180;
        const rx = lx * Math.cos(rad) - ly * Math.sin(rad);
        const ry = lx * Math.sin(rad) + ly * Math.cos(rad);
        let sx = rx / this.transform.scale;
        let sy = ry / this.transform.scale;
        if (this.transform.flipH) sx = -sx;
        return { x: sx + this.overlayImage.width / 2, y: sy + this.overlayImage.height / 2 };
    }

    onPointerDown(e) {
        const pos = this.getCanvasPos(e);
        const worldPos = this.screenToWorld(pos.x, pos.y);

        if (e.button === 1 || this.isSpacePressed) {
            this.isPanning = true;
            this.dragStart = pos;
            this.lastPos = pos;
            document.getElementById('canvasContainer').classList.add('panning');
            return;
        }

        if (this.tool === 'move' && e.button === 0) {
            this.isDragging = true;
            this.dragStart = worldPos;
            this.lastTransform = { ...this.transform };
            if (e.shiftKey) {
                // Calc initial mouse angle relative to image center
                const dx = worldPos.x - this.transform.x;
                const dy = worldPos.y - this.transform.y;
                this.dragStartAngle = Math.atan2(dy, dx) * 180 / Math.PI;
            }
            this.history.pushState(); // Save state (Fast now)
        } else if (this.tool === 'eraser' && this.overlayImage && e.button === 0) {
            this.eraser.isDrawing = true;
            this.eraser.lastPos = this.worldToOverlay(worldPos.x, worldPos.y);
            this.history.pushState();
            this.erase(worldPos.x, worldPos.y);
        }
        this.requestRender();
    }

    onPointerMove(e) {
        let changed = false;

        // Update Cursor Tracker
        this.currentCursorPos = this.getCanvasPos(e);

        if (this.isPanning) {
            const pos = this.getCanvasPos(e);
            this.view.x += pos.x - this.lastPos.x;
            this.view.y += pos.y - this.lastPos.y;
            this.lastPos = pos;
            this.updateViewUI();
            changed = true;
        } else {
            const pos = this.getCanvasPos(e);

            if (this.isDragging && this.tool === 'move') {
                const worldPos = this.screenToWorld(pos.x, pos.y);
                if (e.shiftKey) {
                    const dx = worldPos.x - this.transform.x;
                    const dy = worldPos.y - this.transform.y;
                    const currentAngle = Math.atan2(dy, dx) * 180 / Math.PI;

                    // Relative Rotation
                    let delta = currentAngle - this.dragStartAngle;
                    let newRot = this.lastTransform.rotation + delta;

                    if (e.altKey) {
                        const snap = 45;
                        newRot = Math.round(newRot / snap) * snap;
                    }

                    this.transform.rotation = newRot;
                    this.updateControlUI();
                } else {
                    const dx = worldPos.x - this.dragStart.x;
                    const dy = worldPos.y - this.dragStart.y;
                    this.transform.x = this.lastTransform.x + dx;
                    this.transform.y = this.lastTransform.y + dy;
                }
                changed = true;
            } else if (this.eraser.isDrawing && this.tool === 'eraser') {
                const worldPos = this.screenToWorld(pos.x, pos.y);
                this.erase(worldPos.x, worldPos.y);
                changed = true;
            }
        }

        // Always redraw if tool is eraser (for cursor preview)
        if (this.tool === 'eraser') changed = true;

        if (changed) this.requestRender();
    }

    onPointerUp(e) {
        const wasInteracting = this.isDragging || this.isPanning || this.eraser.isDrawing;
        this.isDragging = false;
        this.isPanning = false;
        this.eraser.isDrawing = false;
        document.getElementById('canvasContainer').classList.remove('panning');

        if (wasInteracting) {
            if (this.tool === 'eraser') {
                this.updateOverlayCache();

                // Smart Cache Update: Queue a mask update to avoid next click lag
                // Use setTimeout to yield to render first
                setTimeout(() => {
                    if (this.eraser.maskCanvas) {
                        // Force update internal cache
                        this.maskDirty = true; // Mark as dirty
                        // Optionally pre-fetch? No, lazy load is okay if we are fast enough,
                        // but user might click immediately. 
                        // Let's trigger a read now while idle.
                        this.getState();
                    }
                }, 50);
            }
            this.requestRender();
        }
    }

    onWheel(e) {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const delta = e.deltaY < 0 ? 1 : -1;
        const zoomFactor = Math.exp(delta * zoomIntensity);

        // Ctrlキーが押されている、または合成画像がない場合はキャンバスズーム
        if (e.ctrlKey || !this.overlayImage) {
            const pos = this.getCanvasPos(e);
            const wx = (pos.x - this.view.x) / this.view.scale;
            const wy = (pos.y - this.view.y) / this.view.scale;
            this.view.scale *= zoomFactor;
            this.view.x = pos.x - wx * this.view.scale;
            this.view.y = pos.y - wy * this.view.scale;
            this.updateViewUI();
            this.requestRender();
        }
        // 合成画像がある場合は合成画像サイズ変更
        else if (this.overlayImage) {
            // Debounce history push for zoom? 
            // Actually, we can just push state. If optimized, it's cheap.
            this.history.pushState();
            this.transform.scale *= zoomFactor;
            this.updateControlUI();
            this.requestRender();
        }
    }

    erase(worldX, worldY) {
        if (!this.overlayImage || !this.eraser.maskCtx) return;
        const localPos = this.worldToOverlay(worldX, worldY);
        if (!localPos) return;

        const ctx = this.eraser.maskCtx;
        const drawEraser = (targetCtx, scale = 1) => {
            targetCtx.save();
            targetCtx.beginPath();
            const soft = this.eraser.softness;
            const size = this.eraser.size * scale;
            const x = localPos.x * scale;
            const y = localPos.y * scale;

            targetCtx.lineCap = 'round';
            targetCtx.lineJoin = 'round';

            if (soft > 0) {
                targetCtx.shadowBlur = size * soft;
                targetCtx.shadowColor = 'white';
                targetCtx.fillStyle = 'white';
                targetCtx.strokeStyle = 'white';
            } else {
                targetCtx.shadowBlur = 0;
                targetCtx.fillStyle = 'white';
                targetCtx.strokeStyle = 'white';
            }

            targetCtx.lineWidth = size;

            const last = this.eraser.lastPos ? { x: this.eraser.lastPos.x * scale, y: this.eraser.lastPos.y * scale } : null;
            if (last) {
                targetCtx.moveTo(last.x, last.y);
                targetCtx.lineTo(x, y);
                targetCtx.stroke();
            } else {
                targetCtx.arc(x, y, size / 2, 0, Math.PI * 2);
                targetCtx.fill();
            }
            targetCtx.restore();
        };

        ctx.globalCompositeOperation = 'source-over';
        drawEraser(ctx, 1);

        // Mark mask as dirty so next getState() grabs new pixels
        this.maskDirty = true;

        if (this.cachedOverlay.isValid) {
            const cCtx = this.cachedOverlay.ctx;
            cCtx.globalCompositeOperation = 'destination-out';
            drawEraser(cCtx, 1);
            cCtx.globalCompositeOperation = 'source-over';
        }

        if (this.cachedSmall.isValid) {
            const sCtx = this.cachedSmall.ctx;
            sCtx.globalCompositeOperation = 'destination-out';
            drawEraser(sCtx, this.cachedSmall.scale);
            sCtx.globalCompositeOperation = 'source-over';
        }

        this.eraser.lastPos = localPos;
        this.requestRender();
    }

    setupKeyboard() {
        window.addEventListener('keydown', e => {
            if (e.code === 'Space') this.isSpacePressed = true;
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
                e.preventDefault();
                this.history.undo();
                this.requestRender();
            }
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
                e.preventDefault();
                this.history.redo();
                this.requestRender();
            }

            // Keyboard Movement
            if (this.overlayImage && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                this.history.pushState();

                switch (e.code) {
                    case 'ArrowUp': this.transform.y -= step; break;
                    case 'ArrowDown': this.transform.y += step; break;
                    case 'ArrowLeft': this.transform.x -= step; break;
                    case 'ArrowRight': this.transform.x += step; break;
                }
                this.updateControlUI();
                this.requestRender();
            }
        });
        window.addEventListener('keyup', e => {
            if (e.code === 'Space') this.isSpacePressed = false;
        });
    }

    resizeCanvas() {
        const container = document.getElementById('canvasContainer');
        const oldW = this.canvas.width;
        const oldH = this.canvas.height;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        if (oldW && oldH && oldW !== this.canvas.width) {
            const dx = (this.canvas.width - oldW) / 2;
            const dy = (this.canvas.height - oldH) / 2;
            this.view.x += dx;
            this.view.y += dy;
        } else if (this.view.scale === 1 && this.view.x === 0) {
            this.view.x = this.canvas.width / 2;
            this.view.y = this.canvas.height / 2;
        }
        this.requestRender();
    }

    fitView() {
        if (!this.bgImage || !this.canvas.width || !this.canvas.height) {
            this.view = { scale: 1, x: this.canvas.width / 2, y: this.canvas.height / 2 };
        } else {
            const scaleX = this.canvas.width / this.bgImage.width;
            const scaleY = this.canvas.height / this.bgImage.height;
            const scale = Math.min(scaleX, scaleY) * 0.9;
            this.view.scale = scale;
            this.view.x = (this.canvas.width - this.bgImage.width * scale) / 2;
            this.view.y = (this.canvas.height - this.bgImage.height * scale) / 2;
        }
        this.updateViewUI();
        this.requestRender();
    }

    // --- Rendering ---
    draw() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.translate(this.view.x, this.view.y);
        this.ctx.scale(this.view.scale, this.view.scale);

        if (this.bgImage) {
            this.ctx.drawImage(this.bgImage, 0, 0);
            this.ctx.strokeStyle = '#444';
            this.ctx.lineWidth = 2 / this.view.scale;
            this.ctx.strokeRect(0, 0, this.bgImage.width, this.bgImage.height);
        }

        if (this.overlayImage) {
            this.ctx.save();
            this.ctx.translate(this.transform.x, this.transform.y);
            this.ctx.rotate(this.transform.rotation * Math.PI / 180);
            this.ctx.scale(this.transform.scale * (this.transform.flipH ? -1 : 1), this.transform.scale);
            this.ctx.globalAlpha = this.filters.opacity;
            this.ctx.filter = `brightness(${this.filters.brightness}) contrast(${this.filters.contrast}) saturate(${this.filters.saturation}) hue-rotate(${this.filters.hue}deg)`;

            const w = this.overlayImage.width;
            const h = this.overlayImage.height;
            const ox = -w / 2;
            const oy = -h / 2;

            const isInteracting = this.isDragging || this.isPanning || this.eraser.isDrawing;
            const useProxy = isInteracting && this.cachedSmall.isValid && this.cachedSmall.scale < 1;

            if (useProxy) {
                this.ctx.drawImage(this.cachedSmall.canvas, ox, oy, w, h);
            } else if (this.cachedOverlay.isValid) {
                this.ctx.drawImage(this.cachedOverlay.canvas, ox, oy, w, h);
            } else {
                this.ctx.drawImage(this.overlayImage, ox, oy, w, h);
            }

            if (this.tool === 'move') {
                this.ctx.filter = 'none';
                this.ctx.strokeStyle = '#6c5ce7';
                this.ctx.lineWidth = 2 / this.transform.scale;
                this.ctx.strokeRect(ox, oy, w, h);
            }
            this.ctx.restore();
        }

        // Brush Preview
        if (this.tool === 'eraser' && this.currentCursorPos) {
            const size = this.eraser.size * this.transform.scale * this.view.scale;
            const x = this.currentCursorPos.x;
            const y = this.currentCursorPos.y;

            this.ctx.save();
            this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Screen space
            this.ctx.beginPath();
            this.ctx.arc(x, y, size / 2, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.arc(x, y, size / 2, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            this.ctx.restore();
        }
    }

    // --- State/UI Sync ---
    updateControlUI() {
        // Transform
        document.getElementById('scaleSlider').value = parseInt(this.transform.scale * 100);
        document.getElementById('scaleInput').value = parseInt(this.transform.scale * 100);
        document.getElementById('rotateSlider').value = parseInt(this.transform.rotation);
        document.getElementById('rotateInput').value = parseInt(this.transform.rotation);
        document.getElementById('flipCheck').checked = this.transform.flipH;

        // Filters
        document.getElementById('opacitySlider').value = parseInt(this.filters.opacity * 100);
        document.getElementById('opacityInput').value = parseInt(this.filters.opacity * 100);
        document.getElementById('brightnessSlider').value = parseInt(this.filters.brightness * 100);
        document.getElementById('brightnessInput').value = parseInt(this.filters.brightness * 100);
        document.getElementById('contrastSlider').value = parseInt(this.filters.contrast * 100);
        document.getElementById('contrastInput').value = parseInt(this.filters.contrast * 100);
        document.getElementById('saturationSlider').value = parseInt(this.filters.saturation * 100);
        document.getElementById('saturationInput').value = parseInt(this.filters.saturation * 100);
        document.getElementById('hueSlider').value = parseInt(this.filters.hue);
        document.getElementById('hueInput').value = parseInt(this.filters.hue);
    }

    updateViewUI() {
        document.getElementById('zoomLevel').textContent = Math.round(this.view.scale * 100) + '%';
    }

    getState() {
        // Optimized: Only read maskData if dirty
        let maskData = null;
        if (this.eraser.maskCanvas) {
            if (this.maskDirty) {
                // Expensive read
                maskData = this.eraser.maskCtx.getImageData(0, 0, this.eraser.maskCanvas.width, this.eraser.maskCanvas.height);
                this.maskCache = maskData; // Update cache
                this.maskDirty = false;
            } else {
                // Use cached
                maskData = this.maskCache;
            }
        }

        const state = {
            transform: { ...this.transform },
            filters: { ...this.filters },
            maskData: maskData
        };
        return state;
    }

    restoreState(state) {
        this.transform = { ...state.transform };
        this.filters = { ...state.filters };

        if (state.maskData && this.eraser.maskCtx) {
            this.eraser.maskCtx.putImageData(state.maskData, 0, 0);
            this.maskDirty = true; // Invalidate current
            this.maskCache = state.maskData; // Set current to restored
            this.maskDirty = false; // Valid again
            this.updateOverlayCache();
        } else if (!state.maskData && this.eraser.maskCtx) {
            this.eraser.maskCtx.clearRect(0, 0, this.eraser.maskCanvas.width, this.eraser.maskCanvas.height);
            this.maskDirty = true;
            this.updateOverlayCache();
        }

        this.updateControlUI();
        this.requestRender();
    }

    download() {
        if (!this.bgImage) return;
        const outCanvas = document.createElement('canvas');
        outCanvas.width = this.bgImage.width;
        outCanvas.height = this.bgImage.height;
        const outCtx = outCanvas.getContext('2d');
        outCtx.drawImage(this.bgImage, 0, 0);
        if (this.overlayImage) {
            outCtx.save();
            outCtx.translate(this.transform.x, this.transform.y);
            outCtx.rotate(this.transform.rotation * Math.PI / 180);
            outCtx.scale(this.transform.scale * (this.transform.flipH ? -1 : 1), this.transform.scale);
            outCtx.globalAlpha = this.filters.opacity;
            outCtx.globalAlpha = this.filters.opacity;
            outCtx.filter = `brightness(${this.filters.brightness}) contrast(${this.filters.contrast}) saturate(${this.filters.saturation}) hue-rotate(${this.filters.hue}deg)`;
            const w = this.overlayImage.width;
            const h = this.overlayImage.height;
            if (this.cachedOverlay.isValid) {
                outCtx.drawImage(this.cachedOverlay.canvas, -w / 2, -h / 2);
            } else {
                outCtx.drawImage(this.overlayImage, -w / 2, -h / 2, w, h);
            }
            outCtx.restore();
        }
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15);
        link.download = `composite_${timestamp}.png`;
        link.href = outCanvas.toDataURL('image/png');
        link.click();
    }

    copyToClipboard() {
        if (!this.bgImage) return;
        const outCanvas = document.createElement('canvas');
        outCanvas.width = this.bgImage.width;
        outCanvas.height = this.bgImage.height;
        const outCtx = outCanvas.getContext('2d');

        // --- Shared Rendering Logic ---
        outCtx.drawImage(this.bgImage, 0, 0);
        if (this.overlayImage) {
            outCtx.save();
            outCtx.translate(this.transform.x, this.transform.y);
            outCtx.rotate(this.transform.rotation * Math.PI / 180);
            outCtx.scale(this.transform.scale * (this.transform.flipH ? -1 : 1), this.transform.scale);
            outCtx.globalAlpha = this.filters.opacity;
            outCtx.globalAlpha = this.filters.opacity;
            outCtx.filter = `brightness(${this.filters.brightness}) contrast(${this.filters.contrast}) saturate(${this.filters.saturation}) hue-rotate(${this.filters.hue}deg)`;
            const w = this.overlayImage.width;
            const h = this.overlayImage.height;
            if (this.cachedOverlay.isValid) {
                outCtx.drawImage(this.cachedOverlay.canvas, -w / 2, -h / 2);
            } else {
                outCtx.drawImage(this.overlayImage, -w / 2, -h / 2, w, h);
            }
            outCtx.restore();
        }
        // ------------------------------

        outCanvas.toBlob(blob => {
            navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]).then(() => {
                // Clipboard copy successful
            }).catch(err => {
                console.error('Failed to copy: ', err);
            });
        });
    }
}

const app = new ImageCompositor();
setInterval(() => {
    const btn = document.getElementById('downloadBtn');
    if (btn) btn.disabled = !app.bgImage;
}, 500);
