// =============================================
// 3D Size Comparison App - Main Script
// =============================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';

// =============================================
// Product Data (dimensions in mm)
// =============================================
const PRODUCTS = [
    // Apple - Desktop
    { id: 'mac_mini_m4', name: 'Mac mini (M4)', category: 'apple', width: 127, height: 50, depth: 127, color: 0xc0c0c0 },
    { id: 'mac_studio_m4', name: 'Mac Studio (M4 Max)', category: 'apple', width: 197, height: 95, depth: 197, color: 0xa8a8a8 },
    { id: 'mac_pro', name: 'Mac Pro', category: 'apple', width: 218, height: 450, depth: 450, color: 0x888888 },

    // Apple - Laptop
    { id: 'macbook_air_13', name: 'MacBook Air 13"', category: 'apple', width: 304, height: 11.3, depth: 215, color: 0xd4c5a9 },
    { id: 'macbook_air_15', name: 'MacBook Air 15"', category: 'apple', width: 340, height: 11.5, depth: 238, color: 0xd4d4d4 },
    { id: 'macbook_pro_14', name: 'MacBook Pro 14"', category: 'apple', width: 312, height: 15.5, depth: 221, color: 0x6e6e6e },
    { id: 'macbook_pro_16', name: 'MacBook Pro 16"', category: 'apple', width: 356, height: 16.8, depth: 249, color: 0x5a5a5a },

    // Apple - Mobile
    { id: 'iphone_16', name: 'iPhone 16', category: 'apple', width: 71.6, height: 7.8, depth: 147.6, color: 0x4a90d9 },
    { id: 'iphone_16_pro_max', name: 'iPhone 16 Pro Max', category: 'apple', width: 77.6, height: 8.25, depth: 163, color: 0xb8a88a },
    { id: 'ipad_pro_11', name: 'iPad Pro 11"', category: 'apple', width: 177.5, height: 5.3, depth: 249.7, color: 0x8a8a8a },
    { id: 'ipad_pro_13', name: 'iPad Pro 13"', category: 'apple', width: 215.5, height: 5.1, depth: 281.6, color: 0x8a8a8a },

    // Apple - Wearable & Other
    { id: 'apple_watch_ultra', name: 'Apple Watch Ultra 2', category: 'apple', width: 44, height: 14.4, depth: 49, color: 0xd4a574 },
    { id: 'homepod_mini', name: 'HomePod mini', category: 'apple', width: 97.9, height: 84.3, depth: 97.9, color: 0x444444 },
    { id: 'apple_tv_4k', name: 'Apple TV 4K', category: 'apple', width: 93, height: 31, depth: 93, color: 0x2a2a2a },

    // Gaming Consoles
    { id: 'ps5', name: 'PS5', category: 'console', width: 104, height: 390, depth: 260, color: 0xf0f0f0 },
    { id: 'ps5_slim', name: 'PS5 Slim', category: 'console', width: 96, height: 358, depth: 216, color: 0xe8e8e8 },
    { id: 'ps5_pro', name: 'PS5 Pro', category: 'console', width: 89, height: 388, depth: 216, color: 0xe0e0e0 },
    { id: 'xbox_series_x', name: 'Xbox Series X', category: 'console', width: 151, height: 301, depth: 151, color: 0x1a1a1a },
    { id: 'xbox_series_s', name: 'Xbox Series S', category: 'console', width: 151, height: 275, depth: 65, color: 0xf2f2f2 },
    { id: 'switch_dock', name: 'Nintendo Switch (Dock)', category: 'console', width: 173, height: 104, depth: 60, color: 0x2d2d2d },
    {
        id: 'switch_2', name: 'Nintendo Switch 2', category: 'console', width: 270, height: 14, depth: 116, color: 0x1a1a1a,
        parts: [
            { name: 'Body', w: 200, h: 14, d: 116, x: 0, color: 0x1a1a1a },
            { name: 'Left Controller', w: 35, h: 14, d: 116, x: -117.5, color: 0x333333 },
            { name: 'Right Controller', w: 35, h: 14, d: 116, x: 117.5, color: 0x333333 }
        ]
    },
    { id: 'steam_deck', name: 'Steam Deck', category: 'console', width: 298, height: 35, depth: 117, color: 0x3a3a3a },
    { id: 'steam_machine', name: 'Steam Machine', category: 'console', width: 156, height: 152, depth: 162.4, color: 0x222222 },

    // Other
    { id: 'a4_paper', name: 'A4用紙', category: 'other', width: 210, height: 0.5, depth: 297, color: 0xf5f5dc },
    { id: 'manga_tankobon', name: '漫画単行本', category: 'other', width: 105, height: 15, depth: 175, color: 0xf0e68c },
    { id: 'credit_card', name: 'クレジットカード', category: 'other', width: 85.6, height: 0.8, depth: 53.98, color: 0xffd700 },
    { id: 'can_350ml', name: '350ml缶', category: 'other', width: 66, height: 122, depth: 66, color: 0xd4af37 },
    { id: 'iphone_box', name: 'iPhoneの箱', category: 'other', width: 84, height: 47, depth: 162, color: 0xfafafa },
    { id: 'raspberry_pi_5', name: 'Raspberry Pi 5', category: 'other', width: 85, height: 19.5, depth: 56, color: 0x2e8b57 },
    { id: 'dgx_spark', name: 'DGX Spark', category: 'other', width: 150, height: 50.5, depth: 150, color: 0x76b900 },
    { id: 'asus_ascent_gx10', name: 'ASUS Ascent GX10', category: 'other', width: 150, height: 51, depth: 150, color: 0x00a3e0 },
];

// =============================================
// App State
// =============================================
const state = {
    activeItems: [],         // { product, mesh, labelEl, dimGroup, dimLabels }
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    gridHelper: null,
    showGrid: false,
    showLabels: true,
    showDimensions: false,
    placementMode: 'side', // 'side', 'stack', 'overlay'
    transparent: false, // manual transparency toggle
    currentCategory: 'all',
    searchQuery: '',
    nextPlacementX: 0,
    // Desk
    deskWidthCm: 120,
    deskDepthCm: 60,
    deskMaterial: 'wood',   // 'white' or 'wood'
    deskGroup: null,
    // Physics (cannon-es)
    clock: new THREE.Clock(),
    physicsWorld: null,
    floorBody: null,
    deskBody: null,
    // Lighting references
    ambientLight: null,
    dirLight: null,
    fillLight: null,
    spotLight: null,
    skySphere: null,
    nightMode: false,
};

// =============================================
// Scale: 1 unit in Three.js = 100mm
// =============================================
const SCALE = 0.01;

// Environment Constants
const DESK_HEIGHT = 700 * SCALE; // 70cm (fixed height)
const ROOM_WIDTH = 4000 * SCALE; // 4m
const ROOM_DEPTH = 4000 * SCALE; // 4m
const ROOM_HEIGHT = 2500 * SCALE; // 2.5m

// Dynamic desk dimensions (computed from state)
function getDeskWidth() { return state.deskWidthCm * 10 * SCALE; }
function getDeskDepth() { return state.deskDepthCm * 10 * SCALE; }

// =============================================
// Initialize Three.js
// =============================================
function initThree() {
    const container = document.getElementById('canvas-container');

    // Scene
    state.scene = new THREE.Scene();
    // No solid background — sky sphere provides the backdrop

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    state.camera = new THREE.PerspectiveCamera(50, aspect, 0.01, 100);
    state.camera.position.set(0, DESK_HEIGHT + 4, getDeskDepth() + 6); // Look from above front
    state.camera.lookAt(0, DESK_HEIGHT, 0);

    // Renderer
    state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    state.renderer.setSize(container.clientWidth, container.clientHeight);
    state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    state.renderer.shadowMap.enabled = true;
    state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    state.renderer.toneMappingExposure = 1.2;
    container.appendChild(state.renderer.domElement);

    // Controls
    state.controls = new OrbitControls(state.camera, state.renderer.domElement);
    state.controls.enableDamping = true;
    state.controls.dampingFactor = 0.08;
    state.controls.minDistance = 0.5;
    state.controls.maxDistance = 30;
    state.controls.target.set(0, DESK_HEIGHT, 0);
    state.controls.update();

    // Lighting
    state.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    state.scene.add(state.ambientLight);

    state.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    state.dirLight.position.set(5, 8, 5);
    state.dirLight.castShadow = true;
    state.dirLight.shadow.mapSize.width = 2048;
    state.dirLight.shadow.mapSize.height = 2048;
    state.dirLight.shadow.camera.near = 0.5;
    state.dirLight.shadow.camera.far = 30;
    state.dirLight.shadow.camera.left = -10;
    state.dirLight.shadow.camera.right = 10;
    state.dirLight.shadow.camera.top = 10;
    state.dirLight.shadow.camera.bottom = -10;
    state.dirLight.shadow.bias = -0.0002;
    state.dirLight.shadow.normalBias = 0.02;
    state.scene.add(state.dirLight);

    state.fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    state.fillLight.position.set(-3, 4, -3);
    state.scene.add(state.fillLight);

    // Spotlight (for night mode, initially off)
    state.spotLight = new THREE.SpotLight(0xffeedd, 0, 50, Math.PI / 3, 0.4, 1.0);
    state.spotLight.position.set(0, ROOM_HEIGHT - 0.1, 0);
    state.spotLight.target.position.set(0, DESK_HEIGHT, 0);
    state.spotLight.castShadow = true;
    state.spotLight.shadow.mapSize.width = 2048;
    state.spotLight.shadow.mapSize.height = 2048;
    state.spotLight.shadow.bias = -0.0001;
    state.spotLight.shadow.normalBias = 0.02;
    state.scene.add(state.spotLight);
    state.scene.add(state.spotLight.target);

    // Ceiling light fixture (visible emissive sphere, initially hidden)
    const fixGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const fixMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
    state.lightFixture = new THREE.Mesh(fixGeo, fixMat);
    state.lightFixture.position.set(0, ROOM_HEIGHT - 0.3, 0);
    state.lightFixture.visible = false;
    state.scene.add(state.lightFixture);

    // Point light for broader night fill (initially off)
    state.pointLight = new THREE.PointLight(0xffeedd, 0, 40, 1.0);
    state.pointLight.position.set(0, ROOM_HEIGHT - 0.5, 0);
    state.scene.add(state.pointLight);

    // Create Environment (Room & Desk)
    createEnvironment();

    // Grid on desk
    rebuildDeskGrid();

    // Handle resize
    window.addEventListener('resize', onWindowResize);
}

function rebuildDeskGrid() {
    if (state.gridHelper) {
        state.scene.remove(state.gridHelper);
        state.gridHelper.geometry.dispose();
        state.gridHelper.material.dispose();
    }
    const dw = getDeskWidth();
    const deskGrid = new THREE.GridHelper(dw, Math.round(dw / 0.5), 0x555555, 0x444444);
    deskGrid.position.y = DESK_HEIGHT + 0.001;
    deskGrid.visible = state.showGrid;
    state.scene.add(deskGrid);
    state.gridHelper = deskGrid;
}

function createFloorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base light wood color
    ctx.fillStyle = '#c8a876';
    ctx.fillRect(0, 0, 512, 512);

    // Plank lines (horizontal)
    const plankH = 64;
    for (let py = 0; py < 512; py += plankH) {
        // Plank variation
        const variation = Math.random() * 20 - 10;
        ctx.fillStyle = `rgb(${180 + variation}, ${150 + variation}, ${100 + variation})`;
        ctx.fillRect(0, py, 512, plankH - 2);

        // Grain
        for (let i = 0; i < 30; i++) {
            const gy = py + Math.random() * plankH;
            ctx.strokeStyle = `rgba(100, 70, 30, ${0.04 + Math.random() * 0.08})`;
            ctx.lineWidth = 0.5 + Math.random() * 1.5;
            ctx.beginPath();
            ctx.moveTo(0, gy);
            for (let gx = 0; gx < 512; gx += 15) {
                ctx.lineTo(gx, gy + (Math.random() - 0.5) * 3);
            }
            ctx.stroke();
        }

        // Gap between planks
        ctx.fillStyle = 'rgba(60, 40, 20, 0.3)';
        ctx.fillRect(0, py + plankH - 2, 512, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    return tex;
}

function createEnvironment() {
    // --- Floor (Wood Flooring) ---
    const floorGeo = new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH);
    const floorTex = createFloorTexture();
    const floorMat = new THREE.MeshStandardMaterial({
        map: floorTex,
        roughness: 0.5,
        metalness: 0.05
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    state.scene.add(floor);

    // --- Walls and Ceiling (White) ---
    const wallMat = new THREE.MeshStandardMaterial({
        color: 0xf5f5f0,
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.FrontSide
    });

    // Back Wall (Split into 4 parts for window hole)
    const winW = 18;  // 1.8m
    const winH = 15;  // 1.5m
    const winY = 16;  // Center at 1.6m

    const wallZ = -ROOM_DEPTH / 2;
    // Top part
    const topH = ROOM_HEIGHT - (winY + winH / 2);
    const topWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, topH), wallMat);
    topWall.position.set(0, ROOM_HEIGHT - topH / 2, wallZ);
    state.scene.add(topWall);

    // Bottom part
    const bottomH = winY - winH / 2;
    const bottomWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, bottomH), wallMat);
    bottomWall.position.set(0, bottomH / 2, wallZ);
    state.scene.add(bottomWall);

    // Left part
    const sideW = (ROOM_WIDTH - winW) / 2;
    const leftWallPart = new THREE.Mesh(new THREE.PlaneGeometry(sideW, winH), wallMat);
    leftWallPart.position.set(-(ROOM_WIDTH - sideW) / 2, winY, wallZ);
    state.scene.add(leftWallPart);

    // Right part
    const rightWallPart = new THREE.Mesh(new THREE.PlaneGeometry(sideW, winH), wallMat);
    rightWallPart.position.set((ROOM_WIDTH - sideW) / 2, winY, wallZ);
    state.scene.add(rightWallPart);

    // Add Sky Sphere
    createSkySphere();

    // Front Wall
    const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT), wallMat);
    frontWall.position.set(0, ROOM_HEIGHT / 2, ROOM_DEPTH / 2);
    frontWall.rotation.y = Math.PI;
    state.scene.add(frontWall);

    // Left Wall
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT), wallMat);
    leftWall.position.set(-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    state.scene.add(leftWall);

    // Right Wall
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT), wallMat);
    rightWall.position.set(ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    state.scene.add(rightWall);

    // Ceiling
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH), wallMat);
    ceiling.position.set(0, ROOM_HEIGHT, 0);
    ceiling.rotation.x = Math.PI / 2;
    state.scene.add(ceiling);

    // --- Window on Back Wall ---
    createWindow();

    // --- Desk ---
    rebuildDesk();
}

function createWindow() {
    const winW = 18;  // 1.8m wide (1.5x)
    const winH = 15;  // 1.5m tall (1.5x)
    const winY = 16;  // Center at 1.6m from floor
    const wallZ = -ROOM_DEPTH / 2; // removed small offset to fit in hole perfectly


    // Window frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.3, metalness: 0.4 });
    const frameThick = 0.45; // 3x thicker (0.15 * 3)

    // Window group
    const winGroup = new THREE.Group();

    // Frame (Exterior border)
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(winW + frameThick, frameThick, frameThick), frameMat);
    topBar.position.set(0, winH / 2, 0);
    winGroup.add(topBar);

    const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(winW + frameThick, frameThick, frameThick), frameMat);
    bottomBar.position.set(0, -winH / 2, 0);
    winGroup.add(bottomBar);

    const leftBar = new THREE.Mesh(new THREE.BoxGeometry(frameThick, winH + frameThick, frameThick), frameMat);
    leftBar.position.set(-winW / 2, 0, 0);
    winGroup.add(leftBar);

    const rightBar = new THREE.Mesh(new THREE.BoxGeometry(frameThick, winH + frameThick, frameThick), frameMat);
    rightBar.position.set(winW / 2, 0, 0);
    winGroup.add(rightBar);

    // Grid (Cross)
    const midHBar = new THREE.Mesh(new THREE.BoxGeometry(winW, frameThick * 0.6, frameThick * 0.6), frameMat);
    winGroup.add(midHBar);

    const midVBar = new THREE.Mesh(new THREE.BoxGeometry(frameThick * 0.6, winH, frameThick * 0.6), frameMat);
    winGroup.add(midVBar);

    winGroup.position.set(0, winY, wallZ);
    state.scene.add(winGroup);
}

function createSkySphere() {
    const geometry = new THREE.SphereGeometry(50, 60, 40);
    // Invert geometry to view from inside
    geometry.scale(-1, 1, 1);

    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
    gradient.addColorStop(0, '#0080ff');    // Vivid Zenith (Bright Azure)
    gradient.addColorStop(0.5, '#80dfff');  // Vivid Horizon (Cyan-Blue)
    gradient.addColorStop(0.55, '#ffffff');  // Vivid Horizon Line
    gradient.addColorStop(0.56, '#99ff99');  // Ground (More vivid green)
    gradient.addColorStop(1, '#22aa22');     // Ground (Bottom)
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2048, 1024);

    // Clouds removed by user request

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture });

    const sphere = new THREE.Mesh(geometry, material);
    state.skySphere = sphere;
    state.scene.add(sphere);
}

// =============================================
// Night Mode
// =============================================
function toggleNightMode() {
    state.nightMode = !state.nightMode;
    const btn = document.getElementById('night-mode-btn');
    const icon = btn.querySelector('.material-symbols-outlined');

    if (state.nightMode) {
        // --- NIGHT ---
        btn.classList.add('active');
        icon.textContent = 'light_mode';

        // Dim ambient & directional lights
        state.ambientLight.intensity = 0.03;
        state.dirLight.intensity = 0;
        state.fillLight.intensity = 0;

        // Enable spotlight + point light
        state.spotLight.intensity = 16.0;
        state.pointLight.intensity = 4.0;

        // Show light fixture
        if (state.lightFixture) state.lightFixture.visible = true;

        // Darken sky sphere
        if (state.skySphere) {
            state.skySphere.material.color.setHex(0x060610);
        }

        // Adjust tone mapping for darker scene
        state.renderer.toneMappingExposure = 0.6;

    } else {
        // --- DAY ---
        btn.classList.remove('active');
        icon.textContent = 'dark_mode';

        // Restore lights
        state.ambientLight.intensity = 0.6;
        state.dirLight.intensity = 1.2;
        state.fillLight.intensity = 0.3;

        // Disable spotlight + point light
        state.spotLight.intensity = 0;
        state.pointLight.intensity = 0;

        // Hide light fixture
        if (state.lightFixture) state.lightFixture.visible = false;

        // Restore sky sphere
        if (state.skySphere) {
            state.skySphere.material.color.setHex(0xffffff);
        }

        // Restore tone mapping
        state.renderer.toneMappingExposure = 1.2;
    }
}

function setTopView() {
    const target = new THREE.Vector3(0, DESK_HEIGHT, 0);
    // Align with Z-axis to prevent 90-degree rotation mismatch in OrbitControls
    const pos = new THREE.Vector3(0, DESK_HEIGHT + 10, 0.01);
    animateCamera(pos, target);
}

function setFrontView() {
    const target = new THREE.Vector3(0, DESK_HEIGHT, 0);
    const pos = new THREE.Vector3(0, DESK_HEIGHT + 0.5, getDeskDepth() + 6);
    animateCamera(pos, target);
}

function createWoodTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Base wood color (Natural Oak style)
    ctx.fillStyle = '#d2a679';
    ctx.fillRect(0, 0, 1024, 1024);

    // Grain layers
    const layers = [
        { count: 150, alpha: 0.1, color: '#8b5a2b', width: 2, wave: 10 },
        { count: 200, alpha: 0.15, color: '#5d4037', width: 0.8, wave: 5 },
        { count: 50, alpha: 0.05, color: '#ffffff', width: 1.5, wave: 15 } // light streaks
    ];

    layers.forEach(layer => {
        for (let i = 0; i < layer.count; i++) {
            const y = Math.random() * 1024;
            ctx.strokeStyle = layer.color;
            ctx.globalAlpha = layer.alpha;
            ctx.lineWidth = layer.width;
            ctx.beginPath();
            ctx.moveTo(0, y);

            let currentY = y;
            const step = 40;
            for (let x = step; x <= 1024; x += step) {
                currentY += (Math.random() - 0.5) * layer.wave;
                ctx.lineTo(x, currentY);
            }
            ctx.stroke();
        }
    });
    ctx.globalAlpha = 1.0;

    // Soft Knots
    for (let i = 0; i < 8; i++) {
        const x = Math.random() * 1024;
        const y = Math.random() * 1024;
        const rWidth = 15 + Math.random() * 30;
        const rHeight = 5 + Math.random() * 10;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.random() * 0.2 - 0.1);

        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rWidth);
        grad.addColorStop(0, 'rgba(60, 30, 10, 0.25)');
        grad.addColorStop(0.7, 'rgba(60, 30, 10, 0.05)');
        grad.addColorStop(1, 'rgba(60, 30, 10, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, rWidth, rHeight, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function getDeskTopMaterial() {
    if (state.deskMaterial === 'wood') {
        const tex = createWoodTexture();
        return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.0 });
    }
    return new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.2, metalness: 0.1 });
}

function rebuildDesk() {
    // Remove old desk if exists
    if (state.deskGroup) {
        state.scene.remove(state.deskGroup);
        state.deskGroup.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
    }

    const dw = getDeskWidth();
    const dd = getDeskDepth();
    const deskGroup = new THREE.Group();

    // Tabletop
    const topGeo = new THREE.BoxGeometry(dw, 0.3, dd); // 3cm thick
    const topMat = getDeskTopMaterial();
    const tabletop = new THREE.Mesh(topGeo, topMat);
    tabletop.position.y = DESK_HEIGHT - 0.15;
    tabletop.castShadow = true;
    tabletop.receiveShadow = true;
    tabletop.name = 'desk-top';
    deskGroup.add(tabletop);

    // Legs (5cm = 0.5 units)
    const legGeo = new THREE.BoxGeometry(0.5, DESK_HEIGHT - 0.3, 0.5);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.8 });

    const inset = 0.5; // leg inset from edge
    const positions = [
        [-dw / 2 + inset, (DESK_HEIGHT - 0.3) / 2, -dd / 2 + inset],
        [dw / 2 - inset, (DESK_HEIGHT - 0.3) / 2, -dd / 2 + inset],
        [-dw / 2 + inset, (DESK_HEIGHT - 0.3) / 2, dd / 2 - inset],
        [dw / 2 - inset, (DESK_HEIGHT - 0.3) / 2, dd / 2 - inset],
    ];

    positions.forEach(pos => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(...pos);
        leg.castShadow = true;
        leg.receiveShadow = true;
        deskGroup.add(leg);
    });

    state.scene.add(deskGroup);
    state.deskGroup = deskGroup;

    // Update physics desk body
    rebuildDeskBody();
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(width, height);
}

// =============================================
// Add Product to Scene
// =============================================
function addProductToScene(product) {
    // Check if already added
    if (state.activeItems.find(item => item.product.id === product.id)) {
        removeProductFromScene(product.id);
        return;
    }

    const w = product.width * SCALE;
    const h = product.height * SCALE;
    const d = product.depth * SCALE;

    const isTranslucent = state.transparent;
    const commonMatProps = {
        roughness: 0.35,
        metalness: 0.15,
        transparent: isTranslucent,
        opacity: isTranslucent ? 0.55 : 1.0,
        depthWrite: !isTranslucent,
    };

    let mesh;

    if (product.parts) {
        // Complex product (Multiple parts)
        mesh = new THREE.Group();
        product.parts.forEach(part => {
            const pw = part.w * SCALE;
            const ph = part.h * SCALE;
            const pd = part.d * SCALE;
            const px = part.x * SCALE;
            const py = (part.y || 0) * SCALE;
            const pz = (part.z || 0) * SCALE;

            const partGeo = new THREE.BoxGeometry(pw, ph, pd);
            const partMat = new THREE.MeshStandardMaterial({
                ...commonMatProps,
                color: part.color || product.color
            });
            const partMesh = new THREE.Mesh(partGeo, partMat);
            partMesh.position.set(px, py, pz);
            partMesh.castShadow = true;
            partMesh.receiveShadow = true;
            mesh.add(partMesh);

            // Subtle edge for each part
            const partEdgesGeo = new THREE.EdgesGeometry(partGeo);
            const partEdgesMat = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.15
            });
            const pEdges = new THREE.LineSegments(partEdgesGeo, partEdgesMat);
            partMesh.add(pEdges);
        });
    } else {
        // Simple product (Single cube)
        const geometry = new THREE.BoxGeometry(w, h, d);
        const material = new THREE.MeshStandardMaterial({
            ...commonMatProps,
            color: product.color,
        });
        mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Edge lines for visibility
        const edgesGeometry = new THREE.EdgesGeometry(geometry);
        const edgesMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.15,
        });
        const edgeLines = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        mesh.add(edgeLines);
    }

    state.scene.add(mesh);

    // Create label element
    const labelEl = createLabelElement(product);
    document.getElementById('labels-overlay').appendChild(labelEl);

    // Create dimension lines (3D group attached to mesh)
    const { dimGroup, dimLabels } = createDimensionLines(product, mesh);
    state.scene.add(dimGroup);

    // Create physics body
    const halfExtents = new CANNON.Vec3(w / 2, h / 2, d / 2);
    const shape = new CANNON.Box(halfExtents);
    const body = new CANNON.Body({
        mass: 1,
        type: CANNON.Body.KINEMATIC,
        shape: shape,
    });
    body.position.copy(mesh.position);
    body.quaternion.copy(mesh.quaternion);
    state.physicsWorld.addBody(body);

    // Store
    const activeItem = {
        product,
        mesh,
        labelEl,
        dimGroup,
        dimLabels,
        body,
    };
    state.activeItems.push(activeItem);

    // Position items correctly (Centering/Stacking/Overlay)
    recalculatePositions();

    // Update UI
    updateActiveList();

    // Fit camera
    fitCameraToItems();

    showToast(`${product.name} を追加しました`);
}

// =============================================
// Remove Product from Scene
// =============================================
function removeProductFromScene(productId) {
    const index = state.activeItems.findIndex(item => item.product.id === productId);
    if (index === -1) return;

    const item = state.activeItems[index];

    // Remove physics body
    if (item.body) {
        state.physicsWorld.removeBody(item.body);
    }

    // Remove mesh
    state.scene.remove(item.mesh);
    item.mesh.traverse(child => {
        if (child.isMesh || child.isLine) {
            if (child.geometry) {
                child.geometry.dispose();
            }
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        }
    });

    // Remove label
    item.labelEl.remove();

    // Remove dimension lines
    if (item.dimGroup) {
        state.scene.remove(item.dimGroup);
        item.dimGroup.traverse(c => {
            if (c.isMesh || c.isLine) {
                if (c.geometry) c.geometry.dispose();
                if (c.material) {
                    if (Array.isArray(c.material)) {
                        c.material.forEach(m => m.dispose());
                    } else {
                        c.material.dispose();
                    }
                }
            }
        });
    }
    if (item.dimLabels) {
        item.dimLabels.forEach(el => el.remove());
    }

    // Remove from list
    state.activeItems.splice(index, 1);

    // Recalculate positions
    recalculatePositions();

    // Update UI
    updateActiveList();

    if (state.activeItems.length > 0) {
        fitCameraToItems();
    }
}

function clearAllItems() {
    while (state.activeItems.length > 0) {
        const item = state.activeItems[0];
        if (item.body) {
            state.physicsWorld.removeBody(item.body);
        }
        state.scene.remove(item.mesh);
        item.mesh.traverse(child => {
            if (child.isMesh || child.isLine) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
        item.labelEl.remove();
        if (item.dimGroup) {
            state.scene.remove(item.dimGroup);
            item.dimGroup.traverse(c => {
                if (c.isMesh || c.isLine) {
                    if (c.geometry) c.geometry.dispose();
                    if (c.material) {
                        if (Array.isArray(c.material)) {
                            c.material.forEach(m => m.dispose());
                        } else {
                            c.material.dispose();
                        }
                    }
                }
            });
        }
        if (item.dimLabels) {
            item.dimLabels.forEach(el => el.remove());
        }
        state.activeItems.splice(0, 1);
    }
    state.nextPlacementX = 0;
    updateActiveList();
}

function recalculatePositions() {
    if (state.activeItems.length === 0) {
        state.nextPlacementX = 0;
        return;
    }

    if (state.placementMode === 'side') {
        // --- Side by Side (Centered) ---
        let totalWidth = 0;
        const gap = 0.05;
        state.activeItems.forEach((item, i) => {
            totalWidth += item.product.width * SCALE;
            if (i < state.activeItems.length - 1) totalWidth += gap;
        });

        let startX = -totalWidth / 2;
        state.activeItems.forEach(item => {
            const w = item.product.width * SCALE;
            const h = item.product.height * SCALE;
            item.mesh.position.set(startX + w / 2, DESK_HEIGHT + h / 2, 0);
            item.mesh.quaternion.identity();
            startX += w + gap;
        });
        state.nextPlacementX = totalWidth / 2 + gap;

    } else if (state.placementMode === 'stack') {
        // --- Vertical Stack ---
        let currentY = DESK_HEIGHT;
        state.activeItems.forEach(item => {
            const h = item.product.height * SCALE;
            item.mesh.position.set(0, currentY + h / 2, 0);
            item.mesh.quaternion.identity();
            currentY += h;
        });
        state.nextPlacementX = 0;

    } else if (state.placementMode === 'overlay') {
        // --- Overlay (All at origin) ---
        state.activeItems.forEach(item => {
            const h = item.product.height * SCALE;
            item.mesh.position.set(0, DESK_HEIGHT + h / 2, 0);
            item.mesh.quaternion.identity();
        });
        state.nextPlacementX = 0;
    }

    // Sync physics bodies and determine kinematic vs dynamic
    syncBodiesToMeshes();

    // Initial sync
    syncAttachedObjects();
}

function syncAttachedObjects() {
    for (const item of state.activeItems) {
        if (item.dimGroup) {
            item.dimGroup.position.copy(item.mesh.position);
        }
    }
}

// =============================================
// Physics (cannon-es)
// =============================================
function initPhysicsWorld() {
    const world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.82, 0),
    });

    // Solver settings for stability
    world.solver.iterations = 10;
    world.broadphase = new CANNON.NaiveBroadphase();
    world.allowSleep = true;

    // Contact material for natural friction/bounce
    const defaultMaterial = new CANNON.Material('default');
    const contactMat = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
        friction: 0.4,
        restitution: 0.15,
    });
    world.addContactMaterial(contactMat);
    world.defaultContactMaterial = contactMat;

    // Floor (static plane at y=0)
    const floorBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane(),
        material: defaultMaterial,
    });
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // face up
    world.addBody(floorBody);

    state.physicsWorld = world;
    state.floorBody = floorBody;

    // Create desk body
    rebuildDeskBody();
}

function rebuildDeskBody() {
    if (!state.physicsWorld) return;

    // Remove old desk body
    if (state.deskBody) {
        state.physicsWorld.removeBody(state.deskBody);
    }

    const dw = getDeskWidth();
    const dd = getDeskDepth();
    const deskThickness = 0.3; // 3cm (same as visual)

    const deskBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(dw / 2, deskThickness / 2, dd / 2)),
    });
    deskBody.position.set(0, DESK_HEIGHT - deskThickness / 2, 0);
    state.physicsWorld.addBody(deskBody);
    state.deskBody = deskBody;
}

function syncBodiesToMeshes() {
    const dw = getDeskWidth();
    const dd = getDeskDepth();
    const halfDW = dw / 2;
    const halfDD = dd / 2;

    state.activeItems.forEach(item => {
        const body = item.body;
        if (!body) return;

        const w = item.product.width * SCALE;
        const d = item.product.depth * SCALE;
        const mx = item.mesh.position.x;
        const mz = item.mesh.position.z;

        // Check if more than 50% of the item overhangs the desk
        const overhangX = Math.max(0, (mx + w / 2) - halfDW, halfDW - (mx - w / 2) < 0 ? Math.abs(halfDW - (mx - w / 2)) : 0);
        const leftEdge = mx - w / 2;
        const rightEdge = mx + w / 2;
        const centerOffDesk = (mx > halfDW || mx < -halfDW);

        if (centerOffDesk) {
            // Center of mass is off desk -> dynamic (fall)
            body.type = CANNON.Body.DYNAMIC;
            body.mass = 1;
            body.updateMassProperties();
            body.wakeUp();
        } else {
            // On desk -> kinematic (fixed)
            body.type = CANNON.Body.KINEMATIC;
            body.mass = 0;
            body.updateMassProperties();
            body.velocity.setZero();
            body.angularVelocity.setZero();
        }

        // Copy mesh position/rotation to body
        body.position.set(item.mesh.position.x, item.mesh.position.y, item.mesh.position.z);
        body.quaternion.set(
            item.mesh.quaternion.x,
            item.mesh.quaternion.y,
            item.mesh.quaternion.z,
            item.mesh.quaternion.w
        );
    });
}

function updatePhysics() {
    const dt = state.clock.getDelta();
    if (!state.physicsWorld || dt <= 0) return;

    // Step the physics world
    const fixedTimeStep = 1 / 60;
    const maxSubSteps = 3;
    state.physicsWorld.step(fixedTimeStep, dt, maxSubSteps);

    // Sync Three.js meshes from physics bodies
    for (const item of state.activeItems) {
        const body = item.body;
        if (!body) continue;

        // Only sync dynamic bodies (kinematic ones are controlled by us)
        if (body.type === CANNON.Body.DYNAMIC) {
            item.mesh.position.copy(body.position);
            item.mesh.quaternion.copy(body.quaternion);
        }
    }

    syncAttachedObjects();
}

function updateMaterials() {
    const isTranslucent = state.transparent;
    state.activeItems.forEach(item => {
        item.mesh.traverse(child => {
            if (child.isMesh && child.material) {
                const mat = child.material;
                mat.transparent = isTranslucent;
                mat.opacity = isTranslucent ? 0.55 : 1.0;
                mat.depthWrite = !isTranslucent;
                mat.needsUpdate = true;
            }
        });
    });
}

// =============================================
// Camera Fitting
// =============================================
function fitCameraToItems() {
    if (state.activeItems.length === 0) return;

    const box = new THREE.Box3();
    for (const item of state.activeItems) {
        box.expandByObject(item.mesh);
    }

    const center = new THREE.Vector3();
    box.getCenter(center);

    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = state.camera.fov * (Math.PI / 180);
    let cameraDistance = maxDim / (2 * Math.tan(fov / 2));
    cameraDistance *= 1.8; // padding

    const direction = new THREE.Vector3(0.6, 0.5, 0.7).normalize();
    const newPos = center.clone().add(direction.multiplyScalar(cameraDistance));

    // Animate camera
    animateCamera(newPos, center);
}

let _cameraAnimId = 0; // animation cancellation token

function animateCamera(targetPos, targetLookAt) {
    const animId = ++_cameraAnimId; // cancel any previous animation
    const startPos = state.camera.position.clone();
    const startTarget = state.controls.target.clone();

    // Create spherical representations relative to targets
    const relStart = startPos.clone().sub(startTarget);
    const relEnd = targetPos.clone().sub(targetLookAt);

    const sphStart = new THREE.Spherical().setFromVector3(relStart);
    const sphEnd = new THREE.Spherical().setFromVector3(relEnd);

    // Handle theta wrapping for shortest path
    let startTheta = sphStart.theta;
    let endTheta = sphEnd.theta;
    while (endTheta - startTheta > Math.PI) endTheta -= Math.PI * 2;
    while (endTheta - startTheta < -Math.PI) endTheta += Math.PI * 2;

    const duration = 800;
    const start = performance.now();

    function step(time) {
        if (animId !== _cameraAnimId) return; // cancelled
        const elapsed = time - start;
        const t = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3); // ease out cubic

        // 1. Interpolate target
        const currentTarget = new THREE.Vector3().lerpVectors(startTarget, targetLookAt, ease);
        state.controls.target.copy(currentTarget);

        // 2. Interpolate spherical components
        const currentRadius = THREE.MathUtils.lerp(sphStart.radius, sphEnd.radius, ease);
        const currentPhi = THREE.MathUtils.lerp(sphStart.phi, sphEnd.phi, ease);
        const currentTheta = THREE.MathUtils.lerp(startTheta, endTheta, ease);

        const currentSph = new THREE.Spherical(currentRadius, currentPhi, currentTheta);
        const relativePos = new THREE.Vector3().setFromSpherical(currentSph);

        state.camera.position.copy(currentTarget.clone().add(relativePos));
        state.camera.lookAt(currentTarget);
        state.controls.update();

        if (t < 1) {
            requestAnimationFrame(step);
        }
    }
    requestAnimationFrame(step);
}

// =============================================
// Labels
// =============================================
function createLabelElement(product) {
    const el = document.createElement('div');
    el.className = 'label-3d';
    el.dataset.productId = product.id;

    el.innerHTML = `
        <div class="label-content">
            <div class="label-name">${product.name}</div>
        </div>
        <div class="label-line"></div>
    `;
    return el;
}

// =============================================
// Dimension Lines (3D edge-based)
// =============================================
function createDimensionLines(product, mesh) {
    const w = product.width * SCALE;
    const h = product.height * SCALE;
    const d = product.depth * SCALE;
    const offset = 0.06; // offset from box edge
    const dimColor = 0xff6644;
    const dimMat = new THREE.LineBasicMaterial({ color: dimColor, linewidth: 1 });

    const dimGroup = new THREE.Group();
    const dimLabels = [];

    // Helper: create a line between two points
    function makeLine(p1, p2) {
        const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const line = new THREE.Line(geo, dimMat);
        dimGroup.add(line);
        return line;
    }

    // Helper: create small end ticks perpendicular to the line
    function makeTick(center, dir, len) {
        const half = dir.clone().multiplyScalar(len / 2);
        const p1 = center.clone().sub(half);
        const p2 = center.clone().add(half);
        makeLine(p1, p2);
    }

    // === Width line (front bottom edge, along X) ===
    const wY = -h / 2;
    const wZ = d / 2 + offset;
    const wStart = new THREE.Vector3(-w / 2, wY, wZ);
    const wEnd = new THREE.Vector3(w / 2, wY, wZ);
    makeLine(wStart, wEnd);
    makeTick(wStart, new THREE.Vector3(0, 1, 0), 0.04);
    makeTick(wEnd, new THREE.Vector3(0, 1, 0), 0.04);

    // Width dimension label
    const wLabel = document.createElement('div');
    wLabel.className = 'dim-label';
    wLabel.textContent = `${product.width}`;
    document.getElementById('labels-overlay').appendChild(wLabel);
    dimLabels.push(wLabel);

    // === Height line (front right edge, along Y) ===
    const hX = w / 2 + offset;
    const hZ = d / 2 + offset;
    const hStart = new THREE.Vector3(hX, -h / 2, hZ);
    const hEnd = new THREE.Vector3(hX, h / 2, hZ);
    makeLine(hStart, hEnd);
    makeTick(hStart, new THREE.Vector3(1, 0, 0), 0.04);
    makeTick(hEnd, new THREE.Vector3(1, 0, 0), 0.04);

    // Height dimension label
    const hLabel = document.createElement('div');
    hLabel.className = 'dim-label';
    hLabel.textContent = `${product.height}`;
    document.getElementById('labels-overlay').appendChild(hLabel);
    dimLabels.push(hLabel);

    // === Depth line (bottom right edge, along Z) ===
    const dX = w / 2 + offset;
    const dY = -h / 2;
    const dStart = new THREE.Vector3(dX, dY, -d / 2);
    const dEnd = new THREE.Vector3(dX, dY, d / 2);
    makeLine(dStart, dEnd);
    makeTick(dStart, new THREE.Vector3(0, 1, 0), 0.04);
    makeTick(dEnd, new THREE.Vector3(0, 1, 0), 0.04);

    // Depth dimension label
    const dLabel = document.createElement('div');
    dLabel.className = 'dim-label';
    dLabel.textContent = `${product.depth}`;
    document.getElementById('labels-overlay').appendChild(dLabel);
    dimLabels.push(dLabel);

    // Position the group at mesh position
    dimGroup.position.copy(mesh.position);

    // Store anchors for label projection
    dimGroup.userData = {
        wMid: new THREE.Vector3(0, wY, wZ),
        hMid: new THREE.Vector3(hX, 0, hZ),
        dMid: new THREE.Vector3(dX, dY, 0),
    };

    return { dimGroup, dimLabels };
}

function updateLabels() {
    const container = document.getElementById('canvas-container');
    const overlay = document.getElementById('labels-overlay');

    for (const item of state.activeItems) {
        // -- Name label --
        if (state.showLabels) {
            item.labelEl.style.display = '';
            const h = item.product.height * SCALE;
            const pos3D = new THREE.Vector3(
                item.mesh.position.x,
                item.mesh.position.y + h / 2 + 0.05,
                item.mesh.position.z
            );
            const projected = pos3D.clone().project(state.camera);
            const behind = projected.z > 1;
            item.labelEl.style.display = behind ? 'none' : '';
            item.labelEl.style.left = (projected.x * 0.5 + 0.5) * container.clientWidth + 'px';
            item.labelEl.style.top = (-projected.y * 0.5 + 0.5) * container.clientHeight + 'px';
        } else {
            item.labelEl.style.display = 'none';
        }

        // -- Dimension lines & labels --
        if (item.dimGroup) {
            item.dimGroup.visible = state.showDimensions;
        }
        if (item.dimLabels && item.dimGroup && item.dimGroup.userData) {
            const show = state.showDimensions;
            const anchors = item.dimGroup.userData;
            const worldPos = item.mesh.position;

            const projectAnchor = (localAnchor) => {
                const world = localAnchor.clone().add(worldPos);
                const proj = world.project(state.camera);
                return {
                    x: (proj.x * 0.5 + 0.5) * container.clientWidth,
                    y: (-proj.y * 0.5 + 0.5) * container.clientHeight,
                    behind: proj.z > 1
                };
            };

            // Width label
            const wp = projectAnchor(anchors.wMid);
            item.dimLabels[0].style.display = (show && !wp.behind) ? '' : 'none';
            item.dimLabels[0].style.left = wp.x + 'px';
            item.dimLabels[0].style.top = wp.y + 'px';

            // Height label
            const hp = projectAnchor(anchors.hMid);
            item.dimLabels[1].style.display = (show && !hp.behind) ? '' : 'none';
            item.dimLabels[1].style.left = hp.x + 'px';
            item.dimLabels[1].style.top = hp.y + 'px';

            // Depth label
            const dp = projectAnchor(anchors.dMid);
            item.dimLabels[2].style.display = (show && !dp.behind) ? '' : 'none';
            item.dimLabels[2].style.left = dp.x + 'px';
            item.dimLabels[2].style.top = dp.y + 'px';
        }
    }
}

// =============================================
// Product List UI
// =============================================
function renderProductList() {
    const container = document.getElementById('product-list');
    container.innerHTML = '';

    const filtered = PRODUCTS.filter(p => {
        const catMatch = state.currentCategory === 'all' || p.category === state.currentCategory;
        const searchMatch = state.searchQuery === '' ||
            p.name.toLowerCase().includes(state.searchQuery.toLowerCase());
        return catMatch && searchMatch;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-message">該当する製品がありません</div>';
        return;
    }

    for (const product of filtered) {
        const el = document.createElement('div');
        el.className = 'product-item';
        el.dataset.productId = product.id;

        const isActive = state.activeItems.some(item => item.product.id === product.id);
        if (isActive) {
            el.style.opacity = '0.5';
        }

        el.innerHTML = `
            <div class="color-dot" style="background-color: #${product.color.toString(16).padStart(6, '0')}"></div>
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-dims">${product.width} × ${product.depth} × ${product.height} mm</div>
            </div>
            <span class="material-symbols-outlined add-icon">${isActive ? 'check' : 'add'}</span>
        `;

        el.addEventListener('click', () => {
            addProductToScene(product);
            renderProductList();
        });

        container.appendChild(el);
    }
}

function updateActiveList() {
    const container = document.getElementById('active-list');
    container.innerHTML = '';

    if (state.activeItems.length === 0) {
        container.innerHTML = '<div class="empty-message">製品をクリックして追加</div>';
        return;
    }

    for (const item of state.activeItems) {
        const el = document.createElement('div');
        el.className = 'active-item';
        el.innerHTML = `
            <div class="color-dot" style="background-color: #${item.product.color.toString(16).padStart(6, '0')}"></div>
            <span class="item-name">${item.product.name}</span>
            <button class="remove-btn" title="削除">
                <span class="material-symbols-outlined">close</span>
            </button>
        `;

        el.querySelector('.remove-btn').addEventListener('click', () => {
            removeProductFromScene(item.product.id);
            renderProductList();
        });

        container.appendChild(el);
    }
}

// =============================================
// Toast
// =============================================
let toastTimeout = null;
function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<span class="material-symbols-outlined">check_circle</span>${message}`;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 2500);
}

// =============================================
// Modal Logic
// =============================================
function setupModal() {
    const modal = document.getElementById('custom-product-modal');
    const closeBtn = document.getElementById('modal-close');
    const cancelBtn = document.getElementById('modal-cancel');
    const addBtn = document.getElementById('modal-add');

    function toggleModal() {
        modal.classList.toggle('hidden');
    }

    // We don't have a trigger button in sidebar yet, but we can add one
    closeBtn.addEventListener('click', toggleModal);
    cancelBtn.addEventListener('click', toggleModal);

    // Close on background click
    let mouseDownOnOverlay = false;
    modal.addEventListener('mousedown', (e) => {
        mouseDownOnOverlay = e.target === modal;
    });
    modal.addEventListener('mouseup', (e) => {
        if (mouseDownOnOverlay && e.target === modal) {
            toggleModal();
        }
        mouseDownOnOverlay = false;
    });

    addBtn.addEventListener('click', () => {
        const name = document.getElementById('custom-name').value.trim();
        const width = parseFloat(document.getElementById('custom-width').value);
        const height = parseFloat(document.getElementById('custom-height').value);
        const depth = parseFloat(document.getElementById('custom-depth').value);

        if (!name || isNaN(width) || isNaN(height) || isNaN(depth)) {
            showToast('全てのフィールドを入力してください');
            return;
        }

        const customProduct = {
            id: 'custom_' + Date.now(),
            name,
            category: 'other',
            width,
            height,
            depth,
            color: Math.floor(Math.random() * 0xffffff),
        };

        addProductToScene(customProduct);
        renderProductList();
        toggleModal();

        // Clear inputs
        document.getElementById('custom-name').value = '';
        document.getElementById('custom-width').value = '';
        document.getElementById('custom-height').value = '';
        document.getElementById('custom-depth').value = '';
    });

    // Expose toggle globally for the add custom button
    window.openCustomModal = toggleModal;
}



// =============================================
// Desk Settings
// =============================================
function updateDeskSize(widthCm, depthCm) {
    state.deskWidthCm = widthCm;
    state.deskDepthCm = depthCm;
    rebuildDesk();
    rebuildDeskGrid();
    recalculatePositions();
    fitCameraToItems();
    // Update inputs
    document.getElementById('desk-width-input').value = widthCm;
    document.getElementById('desk-depth-input').value = depthCm;
}

function updateDeskMaterial(material) {
    state.deskMaterial = material;
    rebuildDesk();
}

// =============================================
// Event Binding
// =============================================
function setupEvents() {
    // Category tabs
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.currentCategory = tab.dataset.category;
            renderProductList();
        });
    });

    // Search
    const searchInput = document.getElementById('product-search');
    const clearSearchBtn = document.getElementById('clear-search-btn');

    searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        if (state.searchQuery) {
            clearSearchBtn.classList.add('show');
        } else {
            clearSearchBtn.classList.remove('show');
        }
        renderProductList();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        state.searchQuery = '';
        clearSearchBtn.classList.remove('show');
        renderProductList();
        searchInput.focus();
    });

    // Mode Selector
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.placementMode = mode;

            // Default transparency by mode
            state.transparent = (mode === 'overlay');
            const transToggle = document.getElementById('toggle-transparent');
            if (transToggle) transToggle.checked = state.transparent;

            updateMaterials();
            recalculatePositions();
            fitCameraToItems();
        });
    });

    // Toggle grid
    document.getElementById('toggle-grid').addEventListener('change', (e) => {
        state.showGrid = e.target.checked;
        if (state.gridHelper) state.gridHelper.visible = state.showGrid;
    });

    // Toggle transparency
    document.getElementById('toggle-transparent').addEventListener('change', (e) => {
        state.transparent = e.target.checked;
        updateMaterials();
    });

    // Toggle labels
    document.getElementById('toggle-labels').addEventListener('change', (e) => {
        state.showLabels = e.target.checked;
    });

    // Toggle dimensions
    document.getElementById('toggle-dimensions').addEventListener('change', (e) => {
        state.showDimensions = e.target.checked;
    });

    // Night mode
    document.getElementById('night-mode-btn').addEventListener('click', () => {
        toggleNightMode();
    });

    // Camera shortcuts
    document.getElementById('top-view-btn').addEventListener('click', () => {
        setTopView();
    });
    document.getElementById('front-view-btn').addEventListener('click', () => {
        setFrontView();
    });

    // Share to X
    document.getElementById('share-x-btn').addEventListener('click', () => {
        const text = 'SizeComp - 製品サイズを3D立方体で視覚的に比較';
        const url = window.location.href;
        const hashtag = '#SizeComp';
        const tweetText = encodeURIComponent(`${text}\n${url}\n${hashtag}`);
        window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, '_blank');
    });

    // Clear all
    document.getElementById('clear-all-btn').addEventListener('click', () => {
        clearAllItems();
        renderProductList();
    });

    // --- Desk Settings ---
    // Material radio
    document.querySelectorAll('input[name="desk-material"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateDeskMaterial(e.target.value);
        });
    });

    // Preset buttons
    document.querySelectorAll('.desk-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.desk-preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const w = parseInt(btn.dataset.w);
            const d = parseInt(btn.dataset.d);
            updateDeskSize(w, d);
        });
    });

    // Custom size apply
    document.getElementById('desk-apply-btn').addEventListener('click', () => {
        const w = parseInt(document.getElementById('desk-width-input').value);
        const d = parseInt(document.getElementById('desk-depth-input').value);
        if (isNaN(w) || isNaN(d) || w < 60 || d < 40) {
            showToast('有効なサイズを入力してください');
            return;
        }
        // Deselect presets
        document.querySelectorAll('.desk-preset-btn').forEach(b => b.classList.remove('active'));
        updateDeskSize(w, d);
        showToast(`机サイズ: ${w}×${d} cm`);
    });

    // Resize handle for active items
    const resizeHandle = document.getElementById('resize-handle');
    const activeSection = document.querySelector('.active-items-section');
    if (resizeHandle && activeSection) {
        let isResizing = false;
        let startY = 0;
        let startHeight = 0;

        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startY = e.clientY;
            startHeight = activeSection.offsetHeight;
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const delta = e.clientX === undefined ? 0 : e.clientY - startY; // Avoid error on some browsers
            const newHeight = Math.min(400, Math.max(60, startHeight - delta));
            activeSection.style.maxHeight = newHeight + 'px';
            activeSection.style.height = newHeight + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }
}

// =============================================
// Animation Loop
// =============================================
function animate() {
    requestAnimationFrame(animate);
    state.controls.update();
    updatePhysics();
    state.renderer.render(state.scene, state.camera);
    updateLabels();
}

// =============================================
// Bootstrap
// =============================================
function init() {
    initThree();
    initPhysicsWorld();
    setupEvents();
    setupModal();
    renderProductList();
    updateActiveList();
    animate();

    // Add some default items for a nice first impression
    const macMini = PRODUCTS.find(p => p.id === 'mac_mini_m4');
    const macStudio = PRODUCTS.find(p => p.id === 'mac_studio_m4');
    if (macMini) addProductToScene(macMini);
    if (macStudio) addProductToScene(macStudio);
    renderProductList();
}

// Start!
init();
