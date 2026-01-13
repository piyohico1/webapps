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

            // Clamp resizing to canvas bounds
            // 1. Clamp Top/Left
            if (newRect.x < 0) {
                newRect.w += newRect.x; // reduce width by the amount it went over (negative x)
                newRect.x = 0;
            }
            if (newRect.y < 0) {
                newRect.h += newRect.y; // reduce height
                newRect.y = 0;
            }

            // 2. Clamp Bottom/Right
            if (newRect.x + newRect.w > canvasRect.width) {
                newRect.w = canvasRect.width - newRect.x;
            }
            if (newRect.y + newRect.h > canvasRect.height) {
                newRect.h = canvasRect.height - newRect.y;
            }

            // Min size
            if (newRect.w < 20) newRect.w = 20;
            if (newRect.h < 20) newRect.h = 20;

            // Re-apply Aspect Ratio after clamping if needed?
            // If clamping broke the ratio, we might need to adjust the other dimension to match again.
            // This is tricky. Simple clamping is often preferred over rigid ratio if it hits the edge.
            // But if strict ratio is required, we have to clamp the *dominant* side and adjust the other.

            if (this.activeRatio) {
                // Check if we violated ratio due to clamping
                // Simplest logic: If we hit width limit, recalc height. If we hit height limit, recalc width.
                // Ideally we shouldn't drift.

                // Let's recalculate based on the new potentially-clamped width/height, 
                // prioritizing the specific handle direction being dragged?
                // That can lead to infinite loops or fighting constraints.
                // For now, let's accept the clamping might slightly break ratio at the very edge 
                // OR we clamp strictly. 

                // Let's try to maintain ratio by reducing the other dimension if one hits the wall.

                /* 
                 * Logic: 
                 * If width was clamped, adjust height = width / ratio
                 * If height was clamped, adjust width = height * ratio
                 */

                // Since we modified w/h and x/y above, let's check ratio again
                // But wait, changing h might push it out of bounds again? No, if we reduce.

                const currentRatio = newRect.w / newRect.h;
                // Allow small epsilon diff
                if (Math.abs(currentRatio - this.activeRatio) > 0.01) {
                    // Ratio mismatch due to clamping.
                    // We should shrink the non-clamped dimension to fit.

                    // If we are dragging E/W, width is primary. If we clamped width, we should adjust height.
                    // But we clamped both above.
                    // Just try to fit into the box with the ratio.

                    if (this.dragHandle.includes('e') || this.dragHandle.includes('w')) {
                        // Driven by width mostly, unless height hit limit.
                        // But if width hit limit, we want encoded height.
                        // If height hit limit, we want encoded width.

                        // Re-verify
                        let wFromH = newRect.h * this.activeRatio;
                        let hFromW = newRect.w / this.activeRatio;

                        // Which one is smaller/valid?
                        if (wFromH <= newRect.w) {
                            newRect.w = wFromH;
                            if (this.dragHandle.includes('w')) {
                                // If we shrank width, and we anchor Right (drag West), we need to adjust X?
                                // X was set by drag.
                                // If we reduce W, and we are dragging W, X should shift right? No, X is left edge.
                                // Dragging West: X moves. 
                                // If we hit Left Wall (x=0), newRect.w was reduced.
                                // If we hit Right Wall (not possible dragging West)...

                                // It's clearer to just set W/H. 
                                // For West drag, Right edge is fixed: R = oldX + oldW.
                                // newX = R - newW.
                                newRect.x = (this.startRect.x + this.startRect.w) - newRect.w;
                            }
                        } else {
                            newRect.h = hFromW;
                            if (this.dragHandle.includes('n')) {
                                // Dragging North? (Corner case)
                                // If dragging NW, and we adjust Height, Bottom is fixed.
                                // newY = (oldY + oldH) - newH
                                newRect.y = (this.startRect.y + this.startRect.h) - newRect.h;
                            }
                            // If dragging varying Height handles...
                        }
                    } else {
                        // N/S drag... similar logic
                        // It gets complicated. 
                        // Simplest acceptable UX: Enforce ratio purely, and if it exceeds bounds, clamp both and shrink to fit ratio.

                        if (newRect.w > newRect.h * this.activeRatio) {
                            newRect.w = newRect.h * this.activeRatio;
                            if (this.dragHandle.includes('w')) {
                                newRect.x = (this.startRect.x + this.startRect.w) - newRect.w;
                            }
                        } else {
                            newRect.h = newRect.w / this.activeRatio;
                            if (this.dragHandle.includes('n')) {
                                newRect.y = (this.startRect.y + this.startRect.h) - newRect.h;
                            }
                        }
                    }
                }
            }

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
        const offset = this.getCanvasOffset();
        this.overlay.style.top = `${r.y + offset.y}px`;
        this.overlay.style.left = `${r.x + offset.x}px`;
        this.overlay.style.width = `${r.w}px`;
        this.overlay.style.height = `${r.h}px`;
    }

    getCanvasOffset() {
        const containerRect = this.container.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        return {
            x: canvasRect.left - containerRect.left,
            y: canvasRect.top - containerRect.top
        };
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
