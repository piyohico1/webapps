class ImageProcessor {
    constructor() {
        this.originalImage = null;
        this.history = []; // Stack of DataURLs (or Image objects)
        this.historyIndex = -1;

        this.params = {
            brightness: 100,
            contrast: 100,
            saturation: 100,
            grayscale: 0,
            sepia: 0,
            rotate: 0, // 0, 90, 180, 270
            flipH: 1, // 1 or -1
            flipV: 1  // 1 or -1
        };
    }

    loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.originalImage = new Image();
                this.originalImage.onload = () => {
                    this.resetParams();
                    // Init History
                    this.history = [];
                    this.historyIndex = -1;
                    this.saveState();

                    resolve(this.originalImage);
                };
                this.originalImage.onerror = reject;
                this.originalImage.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    resetParams() {
        this.params = {
            brightness: 100,
            contrast: 100,
            saturation: 100,
            grayscale: 0,
            sepia: 0,
            rotate: 0,
            flipH: 1,
            flipV: 1
        };
    }

    saveState() {
        if (!this.originalImage) return;

        // If we are not at the end of history, discard future states
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        // Push current source
        this.history.push(this.originalImage.src);

        // Cap history to 20 items to save memory
        if (this.history.length > 20) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            return new Promise((resolve) => {
                this.historyIndex--;
                const prevSrc = this.history[this.historyIndex];
                const img = new Image();
                img.onload = () => {
                    this.originalImage = img;
                    // Note: We typically keep params? 
                    // Or do we reset params on undo? 
                    // Usually Undo applies to the *content* change (like crop).
                    // We shouldn't reset params unless params were part of history.
                    // Implementation Plan: Params are NOT in history, only image content.
                    resolve(true);
                };
                img.src = prevSrc;
            });
        }
        return Promise.resolve(false);
    }

    canUndo() {
        return this.historyIndex > 0;
    }

    updateParam(key, value) {
        if (key in this.params) {
            this.params[key] = value;
        }
    }

    rotate(direction) {
        // direction: 'left' or 'right'
        if (direction === 'left') {
            this.params.rotate = (this.params.rotate - 90) % 360;
            if (this.params.rotate < 0) this.params.rotate += 360;
        } else {
            this.params.rotate = (this.params.rotate + 90) % 360;
        }
    }

    flip(axis) {
        if (axis === 'h') this.params.flipH *= -1;
        if (axis === 'v') this.params.flipV *= -1;
    }

    getFilterString() {
        const p = this.params;
        return `brightness(${p.brightness}%) contrast(${p.contrast}%) saturate(${p.saturation}%) grayscale(${p.grayscale}%) sepia(${p.sepia}%)`;
    }

    /**
     * Renders the processed image to the provided canvas
     * @param {HTMLCanvasElement} canvas 
     */
    render(canvas) {
        if (!this.originalImage) return;

        const ctx = canvas.getContext('2d');
        const { width, height } = this.originalImage;
        const { rotate, flipH, flipV } = this.params;

        // Determine canvas size based on rotation
        const isRotated = rotate % 180 !== 0;
        canvas.width = isRotated ? height : width;
        canvas.height = isRotated ? width : height;

        // Clear and save context
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();

        // Apply processing center-aligned
        ctx.translate(canvas.width / 2, canvas.height / 2);

        // Rotate
        ctx.rotate((rotate * Math.PI) / 180);

        // Flip
        ctx.scale(flipH, flipV);

        // Apply Filters
        ctx.filter = this.getFilterString();

        // Draw Image (centered)
        ctx.drawImage(
            this.originalImage,
            -width / 2,
            -height / 2
        );

        ctx.restore();
    }

    /**
     * Allows exporting the current state as a data URL
     * @param {Object} cropRect Optional crop rectangle {x, y, w, h}
     */
    export(cropRect = null) {
        // Create a temporary canvas to render the processed image
        const tempCanvas = document.createElement('canvas');
        this.render(tempCanvas);

        if (cropRect) {
            // Create another canvas for the cropped result
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = cropRect.w;
            cropCanvas.height = cropRect.h;
            const ctx = cropCanvas.getContext('2d');

            ctx.drawImage(
                tempCanvas,
                cropRect.x, cropRect.y, cropRect.w, cropRect.h,
                0, 0, cropRect.w, cropRect.h
            );
            return cropCanvas.toDataURL('image/png');
        }

        return tempCanvas.toDataURL('image/png');
    }
}
