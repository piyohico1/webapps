class CropManager {
    constructor(overlayElement, containerElement, canvasElement) {
        this.overlay = overlayElement;
        this.container = containerElement; // The wrapper around canvas
        this.canvas = canvasElement;

        this.handles = this.overlay.querySelectorAll('.crop-handle');
        this.activeRatio = null; // null for free, or number (width/height)
        this.isPortrait = false;

        this.currentRect = { x: 0, y: 0, w: 0, h: 0 }; // Relative to container/canvas display size
        this.isDragging = false;
        this.dragHandle = null; // 'nw', 'ne', 'sw', 'se' or 'move' (if clicking center)
        this.startPos = { x: 0, y: 0 };
        this.startRect = { ...this.currentRect };

        this.initEvents();
    }

    initEvents() {
        // Overlay drag (move)
        this.overlay.addEventListener('mousedown', (e) => {
            if (e.target === this.overlay) {
                this.startDrag(e, 'move');
            }
        });

        // Handles drag (resize)
        this.handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                let direction = 'nw';
                if (handle.classList.contains('ne')) direction = 'ne';
                if (handle.classList.contains('sw')) direction = 'sw';
                if (handle.classList.contains('se')) direction = 'se';
                this.startDrag(e, direction);
            });
        });

        document.addEventListener('mousemove', (e) => this.onDrag(e));
        document.addEventListener('mouseup', () => this.endDrag());
    }

    startDrag(e, type) {
        this.isDragging = true;
        this.dragHandle = type;
        this.startPos = { x: e.clientX, y: e.clientY };
        this.startRect = { ...this.currentRect };
        this.overlay.style.cursor = type === 'move' ? 'grabbing' : this.getCursorForHandle(type);
    }

    getCursorForHandle(type) {
        // Simplified cursor logic
        if (type === 'nw' || type === 'se') return 'nwse-resize';
        if (type === 'ne' || type === 'sw') return 'nesw-resize';
        return 'move';
    }

    onDrag(e) {
        if (!this.isDragging) return;
        e.preventDefault();

        const dx = e.clientX - this.startPos.x;
        const dy = e.clientY - this.startPos.y;

        let newRect = { ...this.startRect };

        // Constraints: stay within canvas dimensions
        // Note: canvas.clientWidth/Height might be affected by zoom.
        // We should calculate relative to the *visible* canvas dimensions.
        // But for simplicity, let's assume overlay is direct child of a container that matches canvas size?
        // Actually, canvas scaling for zoom (css transform) makes this tricky if overlay is outside.
        // Best approach: Overlay is sibling to canvas in a container that has the exact size of the visible image?
        // Let's rely on getBoundingClientRect for sync.

        const canvasRect = this.canvas.getBoundingClientRect();

        // Convert screen delta to container delta (handling zoom if container is zoomed, but currently zoom is on canvas)
        // If zoom is on canvas via CSS transform, the container might not change or might clip.
        // Let's assume for now 100% zoom for crop logic or that container scales.
        // Wait, app.js zooms by scale().

        // FIXME: Making crop work with CSS zoom is complex. 
        // Strategy: Calculate everything in "Display Pixels" (unzoomed container space) if possible, 
        // OR map mouse movement by dividing by zoom level.

        // Let's assume zoom is handled by transforming the CONTAINER, or that we account for it.
        // Current app.js: canvas.style.transform = scale(...)
        // The container is fixed size? No, container is just a div.
        // If canvas scales physically, overlay needs to match.

        // Let's use the container rect.

        if (this.dragHandle === 'move') {
            newRect.x += dx;
            newRect.y += dy;
            // Clamp
            newRect.x = Math.max(0, Math.min(newRect.x, canvasRect.width - newRect.w));
            newRect.y = Math.max(0, Math.min(newRect.y, canvasRect.height - newRect.h));
        } else {
            // Resizing
            // Very basic resizing logic (free form)
            // TODO: Implement Aspect Ratio locking

            if (this.dragHandle.includes('e')) newRect.w = this.startRect.w + dx;
            if (this.dragHandle.includes('s')) newRect.h = this.startRect.h + dy;
            if (this.dragHandle.includes('w')) {
                newRect.x = this.startRect.x + dx;
                newRect.w = this.startRect.w - dx;
            }
            if (this.dragHandle.includes('n')) {
                newRect.y = this.startRect.y + dy;
                newRect.h = this.startRect.h - dy;
            }

            // Aspect Ratio Lock
            if (this.activeRatio) {
                // If dragging corner, enforce ratio.
                // Simple version: prioritize width change, calculate height.
                // Or better: projection.
                // Let's keep it simple: width drives height for now.

                // Effective Ratio taking orientation into account
                let targetRatio = this.activeRatio;
                // However aspect ratio buttons usually imply shape, user sets "4:3", orientation sets it to 4/3 or 3/4.
                // My setRatio logic handles the value flipping.

                if (this.dragHandle.includes('e') || this.dragHandle.includes('w')) {
                    // Width changed, update height
                    newRect.h = newRect.w / targetRatio;
                } else {
                    // Height changed, update width
                    newRect.w = newRect.h * targetRatio;
                }
            }

            // Min size
            if (newRect.w < 20) newRect.w = 20;
            if (newRect.h < 20) newRect.h = 20;

        }

        this.currentRect = newRect;
        this.updateOverlay();
    }

    endDrag() {
        this.isDragging = false;
        this.overlay.style.cursor = 'move';
    }

    setRatio(ratio, isPortrait) {
        if (ratio === 'free') {
            this.activeRatio = null;
        } else {
            const [w, h] = ratio.split(':').map(Number);
            let r = w / h;
            if (isPortrait) {
                // Determine if we need to invert. 
                // If r > 1 (Landscape ratio like 4:3), and we want Portrait, invert to 3/4.
                if (r > 1) r = 1 / r;
            } else {
                // Landscape requested
                if (r < 1) r = 1 / r;
            }
            this.activeRatio = r;
        }
        this.isPortrait = isPortrait;
        this.resetOverlay();
    }

    resetOverlay() {
        // Initialize crop rect to center 80%
        const canvasRect = this.canvas.getBoundingClientRect();
        const cw = canvasRect.width;
        const ch = canvasRect.height;

        let targetW = cw * 0.8;
        let targetH = ch * 0.8;

        if (this.activeRatio) {
            // Fit to ratio within target area
            if (targetW / targetH > this.activeRatio) {
                targetW = targetH * this.activeRatio;
            } else {
                targetH = targetW / this.activeRatio;
            }
        }

        this.currentRect = {
            x: (cw - targetW) / 2,
            y: (ch - targetH) / 2,
            w: targetW,
            h: targetH
        };

        this.overlay.classList.remove('hidden');
        this.updateOverlay();
    }

    updateOverlay() {
        const r = this.currentRect;
        this.overlay.style.top = `${r.y}px`;
        this.overlay.style.left = `${r.x}px`;
        this.overlay.style.width = `${r.w}px`;
        this.overlay.style.height = `${r.h}px`;
    }

    hide() {
        this.overlay.classList.add('hidden');
    }

    /**
     * Returns the crop rect coordinates relative to the actual internal canvas resolution
     */
    getCropData() {
        // Map display pixels (currentRect) to internal canvas pixels.
        // We know canvas.width / canvas.clientWidth is the scale factor (ignoring CSS zoom for a moment, assuming clientWidth matches layout)

        const rect = this.canvas.getBoundingClientRect();
        // display width
        const dw = rect.width;
        const dh = rect.height;

        // internal width
        const iw = this.canvas.width;
        const ih = this.canvas.height;

        const scaleX = iw / dw;
        const scaleY = ih / dh;

        return {
            x: this.currentRect.x * scaleX,
            y: this.currentRect.y * scaleY,
            w: this.currentRect.w * scaleX,
            h: this.currentRect.h * scaleY
        };
    }
}
