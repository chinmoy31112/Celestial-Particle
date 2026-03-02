// --- 1. THREE.JS SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000005); // Deep space background

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3500);
// Detect mobile device for better initial view
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
camera.position.z = isMobile ? 520 : 450; // Zoom out to see wider solar system

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.NoToneMapping; // No tone compression — pure vivid colors
document.body.appendChild(renderer.domElement);

// --- POST-PROCESSING (BLOOM) ---
const renderScene = new THREE.RenderPass(scene, camera);
const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.55;  // Only bright bodies bloom (Sun mainly)
bloomPass.strength = 0.55;   // Moderate glow — preserves planet shapes and colors
bloomPass.radius = 0.25;   // Tight glow to avoid washing out detail

const composer = new THREE.EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// --- PARTICLE TEXTURE GENERATOR ---
function createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.08, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.18)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.04)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    // Pure round glow — no directional spikes so planets stay perfectly spherical
    return new THREE.CanvasTexture(canvas);
}

// --- 2. PARTICLE SYSTEM SETUP ---
const PARTICLE_COUNT = 130000;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);
const basePositions = new Float32Array(PARTICLE_COUNT * 3);
const localOffsets = new Float32Array(PARTICLE_COUNT * 3);
const particleBodyId = new Int8Array(PARTICLE_COUNT);

const baseColors = new Float32Array(PARTICLE_COUNT * 3); // stores original colors for zoom brightness
for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 500;
    colors[i] = 1;
}
particleBodyId.fill(-1);

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const sizes = new Float32Array(PARTICLE_COUNT);
sizes.fill(1.0); // Slightly larger for better coverage
geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

const material = new THREE.PointsMaterial({
    size: 1.8, // Good base size for planet visibility
    vertexColors: true,
    transparent: true,
    opacity: 0.92, // Mostly opaque for vivid bright colors
    blending: THREE.AdditiveBlending,
    map: createParticleTexture(),
    depthWrite: false
});

const particleSystem = new THREE.Points(geometry, material);
scene.add(particleSystem);

// --- 3. SOLAR SYSTEM BODY DATA (for orbital view) ---
// Real planet colors based on actual astronomical observations
const BODIES = [
    { name: "Sun", orbitR: 0, r: 14, speed: 0, inc: 0, clrs: [0xffd700, 0xffa500, 0xffcc00, 0xffe135] },
    { name: "Mercury", orbitR: 36, r: 2.5, speed: 0.48, inc: 0.122, clrs: [0x8c7853, 0x9c8a6a, 0x7a6a4d, 0xa39787] },
    { name: "Venus", orbitR: 60, r: 3.6, speed: 0.35, inc: 0.059, clrs: [0xe8d5b7, 0xffc649, 0xe4c998, 0xd4b896] },
    { name: "Earth", orbitR: 86, r: 4.2, speed: 0.30, inc: 0, clrs: [0x1e4d8b, 0x2e5f99, 0x4a7c3d, 0x6b93d6] },
    { name: "Mars", orbitR: 115, r: 3.1, speed: 0.24, inc: 0.032, clrs: [0xcd5c5c, 0xa0522d, 0xb87333, 0xc47451] },
    { name: "Jupiter", orbitR: 190, r: 10.5, speed: 0.13, inc: 0.023, clrs: [0xc88b3a, 0xd4a574, 0xb77731, 0xe0c097] },
    { name: "Saturn", orbitR: 255, r: 8.5, speed: 0.10, inc: 0.044, clrs: [0xf4e7c3, 0xe6d7b3, 0xfad89d, 0xd5c4a1], hasRings: true, ringClrs: [0xf0e5c9, 0xd9c7a5, 0xc4b28b] },
    { name: "Uranus", orbitR: 325, r: 5.6, speed: 0.07, inc: 0.014, clrs: [0x4fd0e7, 0x68d4e6, 0x5acbe6, 0x7dd6e8] },
    { name: "Neptune", orbitR: 395, r: 5.4, speed: 0.05, inc: 0.032, clrs: [0x4169e1, 0x4f86f7, 0x5a7fcb, 0x4682b4] }
];

// Particle budgets per body in solar system view - INCREASED for better planet shapes
const BODY_BUDGETS = [12000, 2500, 2800, 3500, 2200, 8500, 8000, 4500, 4000]; // High detail planets
// Per-planet color intensity — boosted for vivid, bright planet rendering
// Sun much brighter than all planets; planets vivid with identifiable colors at default zoom
const BODY_INTENSITY = [2.8, 1.9, 1.9, 2.0, 1.9, 1.9, 1.8, 1.9, 2.0];
// Per-planet max sphere growth limit — prevents overlap with neighbors
// Safe caps: visual radius (r*outL) stays under 40% of gap to nearest orbit/belt
// Merc(gap24), Venus(gap26), Earth(gap26), Mars(gap25 to belt), Jupiter(gap20 from belt), Saturn(gap65), Uranus(gap70), Neptune(gap35 to Kuiper)
const BODY_MAX_OUTL = [1.55, 2.5, 1.8, 1.6, 1.6, 1.3, 1.8, 2.5, 2.0];
// Track current growth factor per body (used to scale moon orbits)
const bodyCurrentOutL = new Float32Array(9).fill(1.0);
// Sun, Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune
const MOON_BUDGET = 400;            // Earth's Moon
const PHOBOS_BUDGET = 200;          // Mars' moon Phobos
const DEIMOS_BUDGET = 150;          // Mars' moon Deimos (smaller)
const IO_BUDGET = 350;              // Jupiter's moon Io
const EUROPA_BUDGET = 320;          // Jupiter's moon Europa
const GANYMEDE_BUDGET = 450;        // Jupiter's moon Ganymede (largest)
const CALLISTO_BUDGET = 380;        // Jupiter's moon Callisto
const TITAN_BUDGET = 500;           // Saturn's moon Titan (largest)
const ENCELADUS_BUDGET = 280;       // Saturn's moon Enceladus (water plumes)
const RHEA_BUDGET = 320;            // Saturn's moon Rhea
const IAPETUS_BUDGET = 300;         // Saturn's moon Iapetus
const DIONE_BUDGET = 270;           // Saturn's moon Dione
const TETHYS_BUDGET = 260;          // Saturn's moon Tethys
const MIMAS_BUDGET = 220;           // Saturn's moon Mimas
const MIRANDA_BUDGET = 240;         // Uranus's moon Miranda (smallest major moon)
const ARIEL_BUDGET = 340;           // Uranus's moon Ariel
const UMBRIEL_BUDGET = 340;         // Uranus's moon Umbriel (dark surface)
const TITANIA_BUDGET = 450;         // Uranus's moon Titania (largest)
const OBERON_BUDGET = 420;          // Uranus's moon Oberon
const TRITON_BUDGET = 500;          // Neptune's moon Triton (largest, retrograde)
const PROTEUS_BUDGET = 350;         // Neptune's moon Proteus (second largest)
const NEREID_BUDGET = 200;          // Neptune's moon Nereid (eccentric orbit)
const LARISSA_BUDGET = 240;         // Neptune's moon Larissa
const DESPINA_BUDGET = 220;         // Neptune's moon Despina
const GALATEA_BUDGET = 210;         // Neptune's moon Galatea
const THALASSA_BUDGET = 200;        // Neptune's moon Thalassa
const NAIAD_BUDGET = 190;           // Neptune's moon Naiad (innermost)
const HIPPOCAMP_BUDGET = 150;       // Neptune's moon Hippocamp (tiny)
const HALIMEDE_BUDGET = 160;        // Neptune's moon Halimede (irregular)
const SAO_BUDGET = 160;             // Neptune's moon Sao (irregular)
const LAOMEDEIA_BUDGET = 150;       // Neptune's moon Laomedeia (irregular)
const PSAMATHE_BUDGET = 150;        // Neptune's moon Psamathe (irregular)
const NESO_BUDGET = 150;            // Neptune's moon Neso (outermost)
const ASTEROID_BUDGET = 14000;      // Main belt (Mars–Jupiter)
const KUIPER_BUDGET = 10000;         // Kuiper belt (beyond Neptune)
const SCATTERED_BUDGET = 2500;      // Rogue/scattered asteroids throughout space
const ORBIT_LINE_BUDGET = 3000;
const STAR_BUDGET = 35000; // massive star field for realistic look

let orbitAngles = BODIES.map(() => Math.random() * Math.PI * 2);
let moonOrbitAngle = Math.random() * Math.PI * 2; // Moon's orbit around Earth
let phobosOrbitAngle = Math.random() * Math.PI * 2; // Phobos' orbit around Mars
let deimosOrbitAngle = Math.random() * Math.PI * 2; // Deimos' orbit around Mars
let ioOrbitAngle = Math.random() * Math.PI * 2; // Io's orbit around Jupiter
let europaOrbitAngle = Math.random() * Math.PI * 2; // Europa's orbit around Jupiter
let ganymedeOrbitAngle = Math.random() * Math.PI * 2; // Ganymede's orbit around Jupiter
let callistoOrbitAngle = Math.random() * Math.PI * 2; // Callisto's orbit around Jupiter
let titanOrbitAngle = Math.random() * Math.PI * 2; // Titan's orbit around Saturn
let enceladusOrbitAngle = Math.random() * Math.PI * 2; // Enceladus' orbit around Saturn
let rheaOrbitAngle = Math.random() * Math.PI * 2; // Rhea's orbit around Saturn
let iapetusOrbitAngle = Math.random() * Math.PI * 2; // Iapetus' orbit around Saturn
let dioneOrbitAngle = Math.random() * Math.PI * 2; // Dione's orbit around Saturn
let tethysOrbitAngle = Math.random() * Math.PI * 2; // Tethys' orbit around Saturn
let mimasOrbitAngle = Math.random() * Math.PI * 2; // Mimas' orbit around Saturn
let mirandaOrbitAngle = Math.random() * Math.PI * 2; // Miranda's orbit around Uranus
let arielOrbitAngle = Math.random() * Math.PI * 2; // Ariel's orbit around Uranus
let umbrielOrbitAngle = Math.random() * Math.PI * 2; // Umbriel's orbit around Uranus
let titaniaOrbitAngle = Math.random() * Math.PI * 2; // Titania's orbit around Uranus
let oberonOrbitAngle = Math.random() * Math.PI * 2; // Oberon's orbit around Uranus
let tritonOrbitAngle = Math.random() * Math.PI * 2; // Triton's orbit around Neptune
let proteusOrbitAngle = Math.random() * Math.PI * 2; // Proteus' orbit around Neptune
let nereidOrbitAngle = Math.random() * Math.PI * 2; // Nereid's orbit around Neptune
let larissaOrbitAngle = Math.random() * Math.PI * 2; // Larissa's orbit around Neptune
let despinaOrbitAngle = Math.random() * Math.PI * 2; // Despina's orbit around Neptune
let galateaOrbitAngle = Math.random() * Math.PI * 2; // Galatea's orbit around Neptune
let thalassaOrbitAngle = Math.random() * Math.PI * 2; // Thalassa's orbit around Neptune
let naiadOrbitAngle = Math.random() * Math.PI * 2; // Naiad's orbit around Neptune
let hippocampOrbitAngle = Math.random() * Math.PI * 2; // Hippocamp's orbit around Neptune
let halimedeOrbitAngle = Math.random() * Math.PI * 2; // Halimede's orbit around Neptune
let saoOrbitAngle = Math.random() * Math.PI * 2; // Sao's orbit around Neptune
let laomedeiaOrbitAngle = Math.random() * Math.PI * 2; // Laomedeia's orbit around Neptune
let psamatheOrbitAngle = Math.random() * Math.PI * 2; // Psamathe's orbit around Neptune
let nesoOrbitAngle = Math.random() * Math.PI * 2; // Neso's orbit around Neptune
let bodyRanges = [];

// Maps BODIES array index (0-8) to PLANET_VIEWS index.
// Moon occupies PLANET_VIEWS[5] (between Earth and Mars), so Mars and beyond are offset.
const BODY_TO_PLANET_VIEW = [1, 2, 3, 4, 6, 7, 8, 9, 10];

// --- SOLAR SYSTEM MOONS DATA (data-driven for consistent generation + animation) ---
// Every moon uses a SINGLE source of truth for orbit radius, ensuring no mismatch.
// localOffsets stores ONLY sphere-local offset (lx, ly, lz), NOT orbit position.
const SOLAR_SYSTEM_MOONS = [
    // Earth (parentIdx 3)
    {
        parentIdx: 3, bodyId: -6, orbitR: 10.0, r: 1.2, orbitSpeed: 0.04, spinSpeed: 0.02,
        budget: MOON_BUDGET, colors: [0xcccccc, 0xbbbbbb, 0xaaaaaa, 0xdddddd], intensity: 1.3
    },
    // Mars (parentIdx 4)
    {
        parentIdx: 4, bodyId: -7, orbitR: 7.0, r: 0.60, orbitSpeed: 0.08, spinSpeed: 0.05,
        budget: PHOBOS_BUDGET, colors: [0x8b7355, 0x6b5d4f, 0x7a6a5a, 0x5c4f42], intensity: 1.2
    },
    {
        parentIdx: 4, bodyId: -8, orbitR: 10.0, r: 0.48, orbitSpeed: 0.03, spinSpeed: 0.03,
        budget: DEIMOS_BUDGET, colors: [0x9a8975, 0xa89580, 0x8d7d6b, 0xb0a090], intensity: 1.2
    },
    // Jupiter (parentIdx 5) - planet r=10.5, moons well outside
    {
        parentIdx: 5, bodyId: -9, orbitR: 19.5, r: 1.3, orbitSpeed: 0.10, spinSpeed: 0.06,
        budget: IO_BUDGET, colors: [0xffdd44, 0xffaa22, 0xff8800, 0xffcc33], intensity: 1.4
    },
    {
        parentIdx: 5, bodyId: -10, orbitR: 25.0, r: 1.1, orbitSpeed: 0.06, spinSpeed: 0.04,
        budget: EUROPA_BUDGET, colors: [0xeeeeff, 0xddeeff, 0xccddff, 0xffffff], intensity: 1.5
    },
    {
        parentIdx: 5, bodyId: -11, orbitR: 32.0, r: 1.55, orbitSpeed: 0.04, spinSpeed: 0.035,
        budget: GANYMEDE_BUDGET, colors: [0x998877, 0xaa9988, 0x887766, 0xbbaa99], intensity: 1.3
    },
    {
        parentIdx: 5, bodyId: -12, orbitR: 39.0, r: 1.45, orbitSpeed: 0.025, spinSpeed: 0.025,
        budget: CALLISTO_BUDGET, colors: [0x6b5d50, 0x7a6d5f, 0x5c4f42, 0x8a7d6f], intensity: 1.2
    },
    // Saturn (parentIdx 6) - r=8.5, rings extend to ~r*2.55=~21.7, moons clearly outside
    {
        parentIdx: 6, bodyId: -19, orbitR: 24.0, r: 0.65, orbitSpeed: 0.12, spinSpeed: 0.05,
        budget: MIMAS_BUDGET, colors: [0xc0c0c0, 0xb0b0b0, 0xd0d0d0, 0xa8a8a8], intensity: 1.3
    },
    {
        parentIdx: 6, bodyId: -14, orbitR: 27.0, r: 0.75, orbitSpeed: 0.08, spinSpeed: 0.045,
        budget: ENCELADUS_BUDGET, colors: [0xffffff, 0xf0f8ff, 0xe8f4ff, 0xfcfcfc], intensity: 1.6
    },
    {
        parentIdx: 6, bodyId: -18, orbitR: 30.0, r: 0.82, orbitSpeed: 0.06, spinSpeed: 0.04,
        budget: TETHYS_BUDGET, colors: [0xfafafa, 0xf0f0f0, 0xffffff, 0xe8e8e8], intensity: 1.5
    },
    {
        parentIdx: 6, bodyId: -17, orbitR: 34.0, r: 0.85, orbitSpeed: 0.05, spinSpeed: 0.04,
        budget: DIONE_BUDGET, colors: [0xe8e8e8, 0xd8d8d8, 0xf0f0f0, 0xc8c8c8], intensity: 1.45
    },
    {
        parentIdx: 6, bodyId: -15, orbitR: 38.0, r: 1.02, orbitSpeed: 0.035, spinSpeed: 0.035,
        budget: RHEA_BUDGET, colors: [0xd0d0d0, 0xc8c8c8, 0xe0e0e0, 0xb8b8b8], intensity: 1.4
    },
    {
        parentIdx: 6, bodyId: -13, orbitR: 48.0, r: 1.55, orbitSpeed: 0.025, spinSpeed: 0.03,
        budget: TITAN_BUDGET, colors: [0xdd8844, 0xcc7733, 0xee9955, 0xbb6622], intensity: 1.3
    },
    {
        parentIdx: 6, bodyId: -16, orbitR: 62.0, r: 0.98, orbitSpeed: 0.015, spinSpeed: 0.02,
        budget: IAPETUS_BUDGET, colors: [0x3a3a3a, 0x2a2a2a, 0xe8e8e8, 0xd8d8d8], intensity: 1.3
    },
    // Uranus (parentIdx 7) - r=5.6, moons well outside
    {
        parentIdx: 7, bodyId: -20, orbitR: 12.5, r: 0.68, orbitSpeed: 0.10, spinSpeed: 0.05,
        budget: MIRANDA_BUDGET, colors: [0x9a8b7a, 0x8a7a6a, 0xa59585, 0x7a6a5a], intensity: 1.25
    },
    {
        parentIdx: 7, bodyId: -21, orbitR: 17.5, r: 1.15, orbitSpeed: 0.07, spinSpeed: 0.04,
        budget: ARIEL_BUDGET, colors: [0xe8e8e8, 0xf0f0f0, 0xd0d0d0, 0xc8c8c8], intensity: 1.4
    },
    {
        parentIdx: 7, bodyId: -22, orbitR: 22.5, r: 1.15, orbitSpeed: 0.05, spinSpeed: 0.03,
        budget: UMBRIEL_BUDGET, colors: [0x4a4a4a, 0x555555, 0x3f3f3f, 0x606060], intensity: 1.2
    },
    {
        parentIdx: 7, bodyId: -23, orbitR: 28.0, r: 1.55, orbitSpeed: 0.035, spinSpeed: 0.035,
        budget: TITANIA_BUDGET, colors: [0xa89888, 0x988878, 0xb8a898, 0x887868], intensity: 1.3
    },
    {
        parentIdx: 7, bodyId: -24, orbitR: 36.5, r: 1.48, orbitSpeed: 0.025, spinSpeed: 0.025,
        budget: OBERON_BUDGET, colors: [0x786868, 0x685858, 0x887878, 0x584848], intensity: 1.25
    },
    // Neptune (parentIdx 8) - r=5.4, moons clearly outside with bright visible colors
    {
        parentIdx: 8, bodyId: -32, orbitR: 13.0, r: 0.65, orbitSpeed: 0.22, spinSpeed: 0.11,
        budget: NAIAD_BUDGET, colors: [0x8a8a8a, 0x949494, 0x808080, 0xa0a0a0], intensity: 1.7
    },
    {
        parentIdx: 8, bodyId: -31, orbitR: 15.5, r: 0.68, orbitSpeed: 0.20, spinSpeed: 0.10,
        budget: THALASSA_BUDGET, colors: [0x8c8c8c, 0x969696, 0x828282, 0xa2a2a2], intensity: 1.7
    },
    {
        parentIdx: 8, bodyId: -29, orbitR: 18.0, r: 0.72, orbitSpeed: 0.18, spinSpeed: 0.09,
        budget: DESPINA_BUDGET, colors: [0x909090, 0x9a9a9a, 0x868686, 0xa6a6a6], intensity: 1.7
    },
    {
        parentIdx: 8, bodyId: -30, orbitR: 20.0, r: 0.70, orbitSpeed: 0.14, spinSpeed: 0.07,
        budget: GALATEA_BUDGET, colors: [0x8e8e8e, 0x989898, 0x848484, 0xa4a4a4], intensity: 1.7
    },
    {
        parentIdx: 8, bodyId: -28, orbitR: 23.0, r: 0.80, orbitSpeed: 0.15, spinSpeed: 0.08,
        budget: LARISSA_BUDGET, colors: [0x949494, 0x9e9e9e, 0x8a8a8a, 0xaaaaaa], intensity: 1.7
    },
    {
        parentIdx: 8, bodyId: -25, orbitR: 28.0, r: 1.55, orbitSpeed: -0.04, spinSpeed: 0.04,
        budget: TRITON_BUDGET, colors: [0xf5d5d5, 0xedc5c5, 0xffdada, 0xe8c0c0], intensity: 1.8
    },
    {
        parentIdx: 8, bodyId: -33, orbitR: 34.0, r: 0.48, orbitSpeed: 0.10, spinSpeed: 0.05,
        budget: HIPPOCAMP_BUDGET, colors: [0x999999, 0xa3a3a3, 0x909090, 0xb0b0b0], intensity: 1.6
    },
    {
        parentIdx: 8, bodyId: -26, orbitR: 40.0, r: 1.25, orbitSpeed: 0.12, spinSpeed: 0.06,
        budget: PROTEUS_BUDGET, colors: [0x808080, 0x8a8a8a, 0x767676, 0x969696], intensity: 1.7
    },
    {
        parentIdx: 8, bodyId: -27, orbitR: 48.0, r: 0.76, orbitSpeed: 0.008, spinSpeed: 0.01,
        budget: NEREID_BUDGET, colors: [0xa0a0a0, 0x969696, 0xababab, 0x8c8c8c], intensity: 1.6
    },
    {
        parentIdx: 8, bodyId: -34, orbitR: 57.0, r: 0.55, orbitSpeed: 0.005, spinSpeed: 0.006,
        budget: HALIMEDE_BUDGET, colors: [0x909090, 0x9a9a9a, 0x888888, 0xa2a2a2], intensity: 1.5
    },
    {
        parentIdx: 8, bodyId: -35, orbitR: 65.0, r: 0.52, orbitSpeed: 0.004, spinSpeed: 0.005,
        budget: SAO_BUDGET, colors: [0x8e8e8e, 0x989898, 0x868686, 0xa0a0a0], intensity: 1.5
    },
    {
        parentIdx: 8, bodyId: -36, orbitR: 74.0, r: 0.50, orbitSpeed: 0.005, spinSpeed: 0.006,
        budget: LAOMEDEIA_BUDGET, colors: [0x8c8c8c, 0x969696, 0x848484, 0x9e9e9e], intensity: 1.5
    },
    {
        parentIdx: 8, bodyId: -37, orbitR: 82.0, r: 0.50, orbitSpeed: 0.003, spinSpeed: 0.004,
        budget: PSAMATHE_BUDGET, colors: [0x8a8a8a, 0x949494, 0x828282, 0x9c9c9c], intensity: 1.5
    },
    {
        parentIdx: 8, bodyId: -38, orbitR: 92.0, r: 0.52, orbitSpeed: 0.002, spinSpeed: 0.003,
        budget: NESO_BUDGET, colors: [0x888888, 0x929292, 0x808080, 0x9a9a9a], intensity: 1.5
    },
];
// Initialize moon orbit angles (random start positions)
const moonOrbitAnglesMap = {};
SOLAR_SYSTEM_MOONS.forEach(m => { moonOrbitAnglesMap[m.bodyId] = Math.random() * Math.PI * 2; });
// Fast lookup for animation
const moonDataByBodyId = {};
SOLAR_SYSTEM_MOONS.forEach(m => { moonDataByBodyId[m.bodyId] = m; });

// --- 4. INDIVIDUAL PLANET VIEW DATA (for fist-switch cycling) ---
// Each planet has its natural satellites embedded with real colors
const PLANET_VIEWS = [
    { name: "Solar System", isSolarSystem: true },
    { name: "Sun", radius: 65, main: 0xff5500, second: 0xffbb00, third: 0xff2200 },
    { name: "Mercury", radius: 20, main: 0x8c7e72, second: 0xa09488, third: 0x6e6258 },
    { name: "Venus", radius: 30, main: 0xffcc55, second: 0xeea830 },
    {
        name: "Earth", radius: 35, main: 0x0066ff, second: 0x00cc44, moons: [
            { name: "Moon", orbitR: 85, r: 12.0, speed: 0.025, main: 0xB8B4AA, second: 0x8A8478, third: 0xD0CCC4, fourth: 0x6E6860, fifth: 0xC8C4BC, particles: 6000 }
        ]
    },
    { name: "Moon", radius: 40, main: 0xB8B4AA, second: 0x8A8478, third: 0xD0CCC4 },
    {
        name: "Mars", radius: 25, main: 0xff2200, second: 0xee3300, moons: [
            { name: "Phobos", orbitR: 39, r: 3.0, speed: 0.08, main: 0x6B5B4D, second: 0x544838, third: 0x7A6A58, particles: 800 },
            { name: "Deimos", orbitR: 56, r: 2.5, speed: 0.03, main: 0x7A6850, second: 0x635540, third: 0x8B7960, particles: 600 }
        ]
    },
    {
        name: "Jupiter", radius: 60, main: 0xeeaa55, second: 0xcc7733, third: 0xffcc88, moons: [
            { name: "Io", orbitR: 93, r: 4.0, speed: 0.10, main: 0xE8D040, second: 0xE09828, third: 0xF8F0C0, particles: 800 },
            { name: "Europa", orbitR: 117, r: 3.3, speed: 0.06, main: 0xF0E8D0, second: 0xC4AA78, third: 0xE0D4B8, particles: 700 },
            { name: "Ganymede", orbitR: 146, r: 4.6, speed: 0.04, main: 0x908474, second: 0xB8AC9C, third: 0x685C4C, particles: 900 },
            { name: "Callisto", orbitR: 180, r: 4.2, speed: 0.025, main: 0x4A3C30, second: 0x5C4E42, third: 0x3A2C22, particles: 850 }
        ]
    },
    {
        name: "Saturn", radius: 52, main: 0xffdd77, hasRings: true, ringClr: 0xeedd88, moons: [
            { name: "Mimas", orbitR: 144, r: 2.0, speed: 0.12, main: 0xD4D0C8, second: 0xC0BCB4, third: 0xDEDAD2, particles: 350 },
            { name: "Enceladus", orbitR: 162, r: 2.4, speed: 0.08, main: 0xFCFCFA, second: 0xF0F6FF, third: 0xE8F0F8, particles: 400 },
            { name: "Tethys", orbitR: 181, r: 2.7, speed: 0.06, main: 0xEAE6E0, second: 0xDCD8D2, third: 0xF0ECE6, particles: 450 },
            { name: "Dione", orbitR: 203, r: 2.7, speed: 0.05, main: 0xDCD8D0, second: 0xC4C0B8, third: 0xE4E0D8, particles: 450 },
            { name: "Rhea", orbitR: 226, r: 3.1, speed: 0.035, main: 0xD0CCC4, second: 0xC0BCB4, third: 0xDCD8D0, particles: 550 },
            { name: "Titan", orbitR: 267, r: 4.8, speed: 0.025, main: 0xCC8030, second: 0xE09838, third: 0xA86820, particles: 900 },
            { name: "Iapetus", orbitR: 322, r: 3.0, speed: 0.015, main: 0x28201A, second: 0xE0D8D0, third: 0x1A1410, particles: 500 }
        ]
    },
    {
        name: "Uranus", radius: 42, main: 0x22ccff, second: 0x55eeff, moons: [
            { name: "Miranda", orbitR: 70, r: 2.5, speed: 0.10, main: 0x908880, second: 0x706860, third: 0xB0A8A0, particles: 450 },
            { name: "Ariel", orbitR: 91, r: 3.5, speed: 0.07, main: 0xBCB4AC, second: 0xCCC4BC, third: 0xA49C94, particles: 600 },
            { name: "Umbriel", orbitR: 112, r: 3.5, speed: 0.05, main: 0x444038, second: 0x545048, third: 0x363228, particles: 600 },
            { name: "Titania", orbitR: 140, r: 4.5, speed: 0.035, main: 0x887C74, second: 0x9C9088, third: 0x746860, particles: 750 },
            { name: "Oberon", orbitR: 168, r: 4.2, speed: 0.025, main: 0x6C6058, second: 0x7C6450, third: 0x5C5048, particles: 700 }
        ]
    },
    {
        name: "Neptune", radius: 40, main: 0x2255ff, second: 0x3377ff, moons: [
            { name: "Naiad", orbitR: 60, r: 1.8, speed: 0.22, main: 0x7A7878, second: 0x8A8888, third: 0x6E6C6C, particles: 250 },
            { name: "Thalassa", orbitR: 68, r: 1.9, speed: 0.20, main: 0x7C7A7A, second: 0x8C8A8A, third: 0x706E6E, particles: 250 },
            { name: "Despina", orbitR: 78, r: 2.0, speed: 0.18, main: 0x808080, second: 0x909090, third: 0x747474, particles: 300 },
            { name: "Galatea", orbitR: 88, r: 2.0, speed: 0.14, main: 0x7E7E7E, second: 0x8E8E8E, third: 0x727272, particles: 300 },
            { name: "Larissa", orbitR: 100, r: 2.2, speed: 0.15, main: 0x868686, second: 0x969696, third: 0x7A7A7A, particles: 350 },
            { name: "Hippocamp", orbitR: 114, r: 1.5, speed: 0.10, main: 0x787878, second: 0x888888, third: 0x6C6C6C, particles: 220 },
            { name: "Proteus", orbitR: 131, r: 3.5, speed: 0.12, main: 0x808080, second: 0x909090, third: 0x747474, particles: 600 },
            { name: "Triton", orbitR: 157, r: 4.5, speed: -0.04, main: 0xE4CCC0, second: 0xD4B8A8, third: 0xF0DED4, particles: 1000 },
            { name: "Nereid", orbitR: 192, r: 2.5, speed: 0.008, main: 0x8C8888, second: 0x9C9898, third: 0x7C7878, particles: 450 },
            { name: "Halimede", orbitR: 228, r: 1.8, speed: 0.005, main: 0x888888, second: 0x989898, third: 0x787878, particles: 250 },
            { name: "Sao", orbitR: 257, r: 1.8, speed: 0.004, main: 0x868686, second: 0x969696, third: 0x787878, particles: 250 },
            { name: "Laomedeia", orbitR: 285, r: 1.5, speed: 0.005, main: 0x848484, second: 0x949494, third: 0x767676, particles: 220 },
            { name: "Psamathe", orbitR: 314, r: 1.5, speed: 0.003, main: 0x828282, second: 0x929292, third: 0x747474, particles: 220 },
            { name: "Neso", orbitR: 342, r: 1.8, speed: 0.002, main: 0x808080, second: 0x909090, third: 0x727272, particles: 250 }
        ]
    }
];

// Moon orbit state for planet view animation
let planetViewMoonAngles = [];
let currentPlanetViewMoons = [];

let currentViewIndex = 0;
let isSolarSystemView = true;

// Volumetric sphere helper: places particles inside the sphere volume
// surfaceBias = fraction put in outer shell (for surface texture detail)
function randomInSphere(r, surfaceBias) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const isSurf = Math.random() < surfaceBias;
    const rd = isSurf
        ? r * (0.82 + Math.random() * 0.18)   // outer shell 82-100% radius (thicker shell = more surface detail)
        : r * Math.cbrt(Math.random()) * 0.82; // interior fill up to 82%
    return {
        lx: rd * Math.sin(ph) * Math.cos(th),
        ly: rd * Math.sin(ph) * Math.sin(th),
        lz: rd * Math.cos(ph),
        rd, ph, th
    };
}

// --- PROCEDURAL PLANET TEXTURES ---
// --- Realistic Moon surface coloring based on research ---
// Maria: dark basaltic plains (~31% near side), iron/titanium-rich, dark grey-blue-brown
// Highlands (Terrae): lighter grey, anorthositic (calcium-rich feldspar)
// Craters: scattered dark spots, young ones have bright ray systems (Tycho, Copernicus)
// Overall: muted brownish-gray, albedo ~0.12
function applyRealisticMoonColor(c, phi, theta, r) {
    const lat = phi;  // 0 = north pole, PI = south pole
    const lon = theta;
    const normalLat = (lat / Math.PI);  // 0 to 1
    const normalLon = (lon % (Math.PI * 2)) / (Math.PI * 2);  // 0 to 1

    // --- Define Maria regions (dark basaltic plains) ---
    // Use overlapping sine waves to create large irregular dark regions
    // Simulates: Mare Tranquillitatis, Mare Serenitatis, Mare Imbrium, Oceanus Procellarum
    const mare1 = Math.sin(lat * 2.5 + 0.8) * Math.cos(lon * 1.3 + 0.5);  // Large mare (Imbrium/Procellarum)
    const mare2 = Math.sin(lat * 3.2 - 1.2) * Math.sin(lon * 2.1 - 0.3);  // Medium mare (Tranquillitatis/Serenitatis)
    const mare3 = Math.sin(lat * 1.8 + lon * 0.7) * 0.6;  // Oceanus Procellarum (largest)
    const mare4 = Math.cos(lat * 4.0 - 0.5) * Math.sin(lon * 1.5 + 1.0) * 0.4;  // Smaller maria
    const mareStrength = Math.max(0, (mare1 + mare2 * 0.8 + mare3 + mare4) * 0.35);
    const isMare = mareStrength > 0.18;

    // --- Crater generation ---
    // Large craters (~5% of surface)
    const largeCrater = (Math.sin(lat * 15.3 + lon * 12.7) + Math.cos(lat * 9.1 - lon * 18.4)) > 1.6;
    // Medium craters (~10%)
    const medCrater = (Math.sin(lat * 28.5 + lon * 22.3) + Math.cos(lat * 19.7 - lon * 31.2)) > 1.5;
    // Small craters / pitting (~15%)
    const smallCrater = Math.random() > 0.85;

    // --- Bright crater ray systems (Tycho-like, Copernicus-like) ---
    // Rays radiate from specific points, very bright white streaks
    const ray1Lat = 2.6, ray1Lon = 4.2; // Tycho-like position
    const ray1Dist = Math.sqrt((lat - ray1Lat) * (lat - ray1Lat) + (lon - ray1Lon) * (lon - ray1Lon));
    const ray1Angle = Math.atan2(lat - ray1Lat, lon - ray1Lon);
    const isRay1 = ray1Dist > 0.15 && ray1Dist < 1.8 && Math.abs(Math.sin(ray1Angle * 6)) < 0.08;
    const ray1Center = ray1Dist < 0.15;

    const ray2Lat = 1.2, ray2Lon = 2.8; // Copernicus-like
    const ray2Dist = Math.sqrt((lat - ray2Lat) * (lat - ray2Lat) + (lon - ray2Lon) * (lon - ray2Lon));
    const ray2Angle = ray2Dist > 0 ? Math.atan2(lat - ray2Lat, lon - ray2Lon) : 0;
    const isRay2 = ray2Dist > 0.12 && ray2Dist < 1.2 && Math.abs(Math.sin(ray2Angle * 5)) < 0.07;
    const ray2Center = ray2Dist < 0.12;

    // --- Surface noise/regolith texture ---
    const regolithNoise = (Math.random() - 0.5) * 0.06;
    const fineTexture = Math.sin(lat * 45 + lon * 38) * 0.03 + Math.sin(lat * 67 - lon * 52) * 0.02;

    // --- Apply colors based on region ---
    // Boosted brightness for additive blending visibility
    if (ray1Center || ray2Center) {
        // Bright crater center
        c.setRGB(0.92, 0.90, 0.85);
    } else if (isRay1 || isRay2) {
        // Bright ray streaks — white-grey
        c.setRGB(0.95 + Math.random() * 0.05, 0.93 + Math.random() * 0.05, 0.88 + Math.random() * 0.05);
    } else if (isMare) {
        // Maria — dark basaltic grey-brown (boosted for additive blending)
        // Different maria have slightly different tones (titanium content varies)
        const mareVariation = mareStrength * 0.8;
        const titaniumTint = Math.sin(lon * 3.5) * 0.03;
        c.setRGB(
            0.52 + mareVariation * 0.12 + regolithNoise + titaniumTint * 0.3,
            0.50 + mareVariation * 0.11 + regolithNoise + titaniumTint * 0.5,
            0.48 + mareVariation * 0.10 + regolithNoise + titaniumTint
        );
    } else {
        // Highlands — lighter grey (anorthositic)
        const highlandBase = 0.78 + Math.sin(lat * 5.5 + lon * 3.2) * 0.06;
        c.setRGB(
            highlandBase + regolithNoise + fineTexture,
            highlandBase - 0.01 + regolithNoise + fineTexture,
            highlandBase - 0.02 + regolithNoise + fineTexture
        );
    }

    // --- Apply crater darkening on top ---
    if (largeCrater) {
        c.r *= 0.7; c.g *= 0.7; c.b *= 0.7;
    } else if (medCrater) {
        c.r *= 0.82; c.g *= 0.82; c.b *= 0.82;
    } else if (smallCrater) {
        const craterDark = 0.92 + Math.random() * 0.05;
        c.r *= craterDark; c.g *= craterDark; c.b *= craterDark;
    }

    // Clamp all channels
    c.r = Math.max(0, Math.min(1, c.r));
    c.g = Math.max(0, Math.min(1, c.g));
    c.b = Math.max(0, Math.min(1, c.b));
}

function applyRealisticPlanetColor(c, bName, ph, th) {
    const lat = ph;
    const lon = th;
    let totalDetail = 0;

    if (bName === "Sun") {
        const sunFlare = Math.sin(lat * 20 + lon * 25) * 0.15 + Math.sin(lat * 8 - lon * 10) * 0.1;
        c.r = Math.min(1, c.r + sunFlare);
        c.g = Math.min(1, c.g + sunFlare * 0.8);
        c.b = Math.min(1, c.b + sunFlare * 0.4);
        return;
    } else if (bName === "Moon") {
        applyRealisticMoonColor(c, lat, lon, 40);
        return;
    } else if (bName === "Earth") {
        const cloudNoise = Math.sin(lat * 6 + Math.sin(lon * 4)) + Math.sin(lon * 3);
        const isCloud = cloudNoise > 0.65;
        const isPole = Math.abs(Math.cos(lat)) > 0.85 + (Math.sin(lon * 4) * 0.05);
        const isLand = Math.sin(lat * 5 + Math.sin(lon * 4) * 2) > 0.15;

        if (isPole) {
            c.setRGB(0.9, 0.95, 1.0);
        } else if (isCloud) {
            const cloudDensity = Math.random() * 0.2;
            c.setRGB(0.8 + cloudDensity, 0.85 + cloudDensity, 0.9 + cloudDensity);
        } else if (isLand) {
            const desert = Math.abs(lat - Math.PI / 2) < 0.3 && Math.sin(lon * 3) > 0;
            if (desert) c.setRGB(0.7, 0.6, 0.3); // Desert/Sand
            else c.setRGB(0.1, 0.4 + Math.random() * 0.1, 0.15); // Forest/Land
        } else {
            c.setRGB(0.0, 0.15 + (Math.random() - 0.5) * 0.05, 0.4 + Math.random() * 0.1); // Ocean
        }
        return;
    } else if (bName === "Jupiter") {
        const bands = Math.sin(lat * 15) + Math.sin(lat * 30) * 0.5 + Math.sin(lat * 50) * 0.25;
        const turbulence = Math.sin(lon * 8 + bands * 3) * 0.15;
        totalDetail = bands * 0.12 + turbulence;

        const spotLat = Math.abs(lat - 1.9);
        const spotLon = Math.abs(lon - Math.PI);
        const spotDist = Math.sqrt(spotLat * spotLat * 2 + spotLon * spotLon);
        if (spotDist < 0.25) { // Great Red Spot
            const mix = 1.0 - (spotDist * 4.0);
            c.lerp(new THREE.Color(0xd04020), mix);
            return;
        }
    } else if (bName === "Saturn") {
        const bands = Math.sin(lat * 12) + Math.sin(lat * 25) * 0.3;
        totalDetail = bands * 0.08 + (Math.random() - 0.5) * 0.03;
    } else if (bName === "Mars") {
        const isPole = Math.abs(Math.cos(lat)) > 0.92 + (Math.sin(lon * 3) * 0.02);
        if (isPole) {
            c.setRGB(0.9, 0.9, 0.95);
            return;
        }
        const darkPatch = Math.sin(lat * 4 + Math.sin(lon * 3)) > 0.3;
        if (darkPatch) {
            c.setRGB(0.4, 0.15, 0.05);
            totalDetail = (Math.random() - 0.5) * 0.05;
        } else {
            c.setRGB(0.7, 0.25, 0.1);
            totalDetail = (Math.random() - 0.5) * 0.1;
        }
    } else if (bName === "Venus") {
        const streaks = Math.sin(lat * 12 + lon * 2) * 0.1 + Math.sin(lat * 6) * 0.05;
        totalDetail = streaks;
    } else if (bName === "Uranus") {
        // Uranus: cyan-blue ice giant — keep detail in blue/green channels only
        const faintBands = Math.sin(lat * 8) * 0.04;
        const storm = (Math.random() > 0.98) ? 0.08 : 0;
        c.r = Math.max(0, Math.min(1, c.r + faintBands * 0.2));
        c.g = Math.max(0, Math.min(1, c.g + faintBands * 0.6 + storm * 0.3));
        c.b = Math.max(0, Math.min(1, c.b + faintBands + storm));
        return;
    } else if (bName === "Neptune") {
        // Neptune: deep blue ice giant — keep strong blue, minimal red
        const faintBands = Math.sin(lat * 10) * 0.04;
        const storm = (Math.random() > 0.97) ? 0.1 : 0;
        c.r = Math.max(0, Math.min(1, c.r + faintBands * 0.15));
        c.g = Math.max(0, Math.min(1, c.g + faintBands * 0.4 + storm * 0.2));
        c.b = Math.max(0, Math.min(1, c.b + faintBands + storm));
        return;
    } else {
        const craterNoise = (Math.random() > 0.85) ? -0.2 : (Math.random() - 0.5) * 0.08;
        totalDetail = craterNoise;
    }

    c.r = Math.max(0, Math.min(1, c.r + totalDetail));
    c.g = Math.max(0, Math.min(1, c.g + totalDetail));
    c.b = Math.max(0, Math.min(1, c.b + totalDetail));
}

// --- 5. GENERATE SOLAR SYSTEM VIEW ---
function generateSolarSystem() {
    let idx = 0;
    bodyRanges = [];

    for (let b = 0; b < BODIES.length; b++) {
        const body = BODIES[b];
        const budget = BODY_BUDGETS[b];
        const startIdx = idx;
        const angle = orbitAngles[b];
        const ox = Math.cos(angle) * body.orbitR;
        const oz = Math.sin(angle) * body.orbitR;
        // Orbital inclination: Y offset of orbit centre at current angle
        const oy = Math.sin(angle) * body.orbitR * Math.sin(body.inc || 0);

        if (body.hasRings) {
            const sphereN = Math.floor(budget * 0.6);
            const ringN = budget - sphereN;

            for (let p = 0; p < sphereN; p++) {
                const i3 = idx * 3;
                // Volumetric sphere: 75% outer shell + 25% interior for true 3D sphere shape
                const { lx, ly, lz, rd, ph, th } = randomInSphere(body.r, 0.75);
                localOffsets[i3] = lx; localOffsets[i3 + 1] = ly; localOffsets[i3 + 2] = lz;
                basePositions[i3] = ox + lx; basePositions[i3 + 1] = oy + ly; basePositions[i3 + 2] = oz + lz;
                particleBodyId[idx] = b;
                const c = new THREE.Color(body.clrs[Math.floor(Math.random() * body.clrs.length)]);

                applyRealisticPlanetColor(c, body.name, ph, th);

                // LIMB DARKENING: center of sphere bright, edges dim — looks round from EVERY angle
                // This is view-independent (not tied to z-axis) so rotation doesn't create flat discs
                const normalizedR = rd / body.r; // 0=center, 1=surface
                // Interior particles dimmer, surface particles full brightness
                const depthFade = 0.3 + 0.7 * normalizedR;
                // Limb darkening: particles near the edge of the sphere silhouette are dimmer
                // (simulates how real planets appear: bright center, darker limb)
                const limbFactor = (b === 0) ? 1.0 : (0.65 + 0.35 * (1.0 - normalizedR * normalizedR * 0.3));
                const shadeFactor = depthFade * limbFactor;

                let intensity = BODY_INTENSITY[b];
                colors[i3] = Math.max(0, c.r * intensity * shadeFactor);
                colors[i3 + 1] = Math.max(0, c.g * intensity * shadeFactor);
                colors[i3 + 2] = Math.max(0, c.b * intensity * shadeFactor);
                idx++;
            }
            // Saturn ring tilt: 26.7 degrees from ecliptic
            const SATURN_RING_TILT = 26.7 * Math.PI / 180;
            const cosTilt = Math.cos(SATURN_RING_TILT);
            const sinTilt = Math.sin(SATURN_RING_TILT);
            for (let p = 0; p < ringN; p++) {
                const i3 = idx * 3;
                const ra = Math.random() * Math.PI * 2;
                let rr = body.r * 1.3 + Math.random() * body.r * 1.25;
                // Cassini Division
                if (rr > body.r * 1.85 && rr < body.r * 2.0 && Math.random() > 0.05) rr += 0.15 * body.r;
                // Encke Gap
                else if (rr > body.r * 2.3 && rr < body.r * 2.38 && Math.random() > 0.1) rr -= 0.08 * body.r;
                // Generate flat ring, then tilt
                const flatX = Math.cos(ra) * rr;
                const flatY = (Math.random() - 0.5) * 0.8;
                const flatZ = Math.sin(ra) * rr;
                // Store FLAT coordinates in localOffsets (for correct tilted rotation)
                localOffsets[i3] = flatX; localOffsets[i3 + 1] = flatY; localOffsets[i3 + 2] = flatZ;
                // Apply tilt for initial basePositions (rotate around X axis)
                const tiltedY = flatY * cosTilt - flatZ * sinTilt;
                const tiltedZ = flatY * sinTilt + flatZ * cosTilt;
                basePositions[i3] = ox + flatX; basePositions[i3 + 1] = oy + tiltedY; basePositions[i3 + 2] = oz + tiltedZ;
                particleBodyId[idx] = -5; // Special ID for Saturn's rings
                const c = new THREE.Color(body.ringClrs[Math.floor(Math.random() * body.ringClrs.length)]);
                colors[i3] = c.r * 1.2; colors[i3 + 1] = c.g * 1.2; colors[i3 + 2] = c.b * 1.2;
                idx++;
            }
        } else {
            for (let p = 0; p < budget; p++) {
                const i3 = idx * 3;
                // Volumetric sphere: 75% shell + 25% interior for true 3D sphere shape
                const { lx, ly, lz, rd, ph, th } = randomInSphere(body.r, 0.75);
                localOffsets[i3] = lx; localOffsets[i3 + 1] = ly; localOffsets[i3 + 2] = lz;
                basePositions[i3] = ox + lx; basePositions[i3 + 1] = oy + ly; basePositions[i3 + 2] = oz + lz;
                particleBodyId[idx] = b;
                const c = new THREE.Color(body.clrs[Math.floor(Math.random() * body.clrs.length)]);

                applyRealisticPlanetColor(c, body.name, ph, th);

                // LIMB DARKENING: center bright, edges dim — round from EVERY angle
                const normalizedR = rd / body.r;
                const depthFade = 0.3 + 0.7 * normalizedR;
                const limbFactor = (b === 0) ? 1.0 : (0.65 + 0.35 * (1.0 - normalizedR * normalizedR * 0.3));
                const shadeFactor = depthFade * limbFactor;

                let intensity = BODY_INTENSITY[b];
                colors[i3] = Math.max(0, c.r * intensity * shadeFactor);
                colors[i3 + 1] = Math.max(0, c.g * intensity * shadeFactor);
                colors[i3 + 2] = Math.max(0, c.b * intensity * shadeFactor);
                idx++;
            }
        }
        bodyRanges.push({ start: startIdx, end: idx, bodyIdx: b });
    }

    // === ALL MOONS — data-driven generation ===
    // Each moon stores ONLY sphere-local offset in localOffsets (NOT orbit position!)
    // This ensures proper 3D spherical shape from every viewing angle.
    for (const moon of SOLAR_SYSTEM_MOONS) {
        const parentBody = BODIES[moon.parentIdx];
        const parentAngle = orbitAngles[moon.parentIdx];
        const parentX = Math.cos(parentAngle) * parentBody.orbitR;
        const parentZ = Math.sin(parentAngle) * parentBody.orbitR;
        const parentY = Math.sin(parentAngle) * parentBody.orbitR * Math.sin(parentBody.inc || 0);
        const moonAngle = moonOrbitAnglesMap[moon.bodyId];
        const moonCX = Math.cos(moonAngle) * moon.orbitR;
        const moonCZ = Math.sin(moonAngle) * moon.orbitR;

        for (let p = 0; p < moon.budget && idx < PARTICLE_COUNT; p++) {
            const i3 = idx * 3;
            // Volumetric sphere for proper 3D (65% surface, 35% interior)
            const { lx, ly, lz, rd } = randomInSphere(moon.r, 0.65);

            // CRITICAL: localOffsets = sphere offset ONLY (not moon orbit position!)
            localOffsets[i3] = lx;
            localOffsets[i3 + 1] = ly;
            localOffsets[i3 + 2] = lz;

            // basePositions = parent planet pos + moon orbit pos + sphere offset
            basePositions[i3] = parentX + moonCX + lx;
            basePositions[i3 + 1] = parentY + ly;
            basePositions[i3 + 2] = parentZ + moonCZ + lz;

            particleBodyId[idx] = moon.bodyId;

            // Color with surface detail
            const c = new THREE.Color(moon.colors[Math.floor(Math.random() * moon.colors.length)]);
            const craterNoise = (Math.random() > 0.87) ? -0.2 : (Math.random() - 0.5) * 0.08;
            const fineDetail = (Math.random() - 0.5) * 0.05;
            c.r = Math.max(0, Math.min(1, c.r + craterNoise + fineDetail));
            c.g = Math.max(0, Math.min(1, c.g + craterNoise + fineDetail));
            c.b = Math.max(0, Math.min(1, c.b + craterNoise + fineDetail));
            // LIMB DARKENING for moon — round from every angle, no hemisphere bias
            const moonNormR = rd / moon.r;
            const moonDepth = 0.35 + 0.65 * moonNormR;
            const moonLimb = 0.7 + 0.3 * (1.0 - moonNormR * moonNormR * 0.3);
            const moonShade = moonDepth * moonLimb;
            colors[i3] = c.r * moon.intensity * 0.95 * moonShade;
            colors[i3 + 1] = c.g * moon.intensity * 0.95 * moonShade;
            colors[i3 + 2] = c.b * moon.intensity * 0.95 * moonShade;
            idx++;
        }
    }

    // --- MAIN Asteroid Belt (between Mars r=115 and Jupiter r=190) ---
    // Band at r=140-170 — clear gap from Mars max reach and Jupiter min reach
    for (let p = 0; p < ASTEROID_BUDGET; p++) {
        const i3 = idx * 3;
        const a = Math.random() * Math.PI * 2;
        const r = 140 + Math.random() * 30; // 140-170 range (safely between Mars and Jupiter)
        const clump = Math.sin(a * 5) * 3 + Math.sin(a * 11) * 1.5; // denser clumping
        const spread = (Math.random() > 0.85) ? 4.0 : 1.5;
        const lx = Math.cos(a) * (r + clump) + (Math.random() - 0.5) * spread;
        const ly = (Math.random() - 0.5) * 5.0;
        const lz = Math.sin(a) * (r + clump) + (Math.random() - 0.5) * spread;
        localOffsets[i3] = lx; localOffsets[i3 + 1] = ly; localOffsets[i3 + 2] = lz;
        basePositions[i3] = lx; basePositions[i3 + 1] = ly; basePositions[i3 + 2] = lz;
        particleBodyId[idx] = -2;
        const type = Math.random();
        let cr, cg, cb;
        if (type < 0.3) { cr = 0.8 + Math.random() * 0.2; cg = 0.4 + Math.random() * 0.2; cb = 0.1 + Math.random() * 0.1; }
        else if (type < 0.6) { cr = 0.9 + Math.random() * 0.1; cg = 0.7 + Math.random() * 0.2; cb = 0.2 + Math.random() * 0.2; }
        else if (type < 0.8) { cr = 0.6 + Math.random() * 0.2; cg = 0.4 + Math.random() * 0.2; cb = 0.2 + Math.random() * 0.1; }
        else { const g = 0.5 + Math.random() * 0.3; cr = g + 0.1; cg = g; cb = g - 0.1; }
        colors[i3] = cr * 3.5; colors[i3 + 1] = cg * 3.5; colors[i3 + 2] = cb * 3.5; // Bright asteroid belt
        sizes[idx] = Math.random() > 0.92 ? 2.5 + Math.random() * 2.0 : 0.8 + Math.random() * 0.7;
        idx++;
    }

    // --- KUIPER BELT (beyond Neptune r=395) ---
    for (let p = 0; p < KUIPER_BUDGET; p++) {
        const i3 = idx * 3;
        const a = Math.random() * Math.PI * 2;
        const r = 420 + Math.random() * 100; // 420–520 range — wider band, closer start
        const clump = Math.sin(a * 3) * 4;
        const spread = (Math.random() > 0.75) ? 8.0 : 3.5;
        const lx = Math.cos(a) * (r + clump) + (Math.random() - 0.5) * spread;
        const ly = (Math.random() - 0.5) * 10.0; // thicker plane for visibility
        const lz = Math.sin(a) * (r + clump) + (Math.random() - 0.5) * spread;
        localOffsets[i3] = lx; localOffsets[i3 + 1] = ly; localOffsets[i3 + 2] = lz;
        basePositions[i3] = lx; basePositions[i3 + 1] = ly; basePositions[i3 + 2] = lz;
        particleBodyId[idx] = -3; // -3 = Kuiper belt object
        // Kuiper belt objects are icy – blue-grey, white, light cyan
        const kt = Math.random();
        let cr, cg, cb;
        if (kt < 0.4) { cr = 0.6 + Math.random() * 0.3; cg = 0.7 + Math.random() * 0.3; cb = 0.9 + Math.random() * 0.1; } // icy blue
        else if (kt < 0.7) { cr = 0.7 + Math.random() * 0.2; cg = 0.75 + Math.random() * 0.2; cb = 0.8 + Math.random() * 0.2; } // grey-white
        else if (kt < 0.88) { cr = 0.5 + Math.random() * 0.3; cg = 0.8 + Math.random() * 0.2; cb = 0.9 + Math.random() * 0.1; } // cyan-ice
        else { cr = 0.9 + Math.random() * 0.1; cg = 0.9 + Math.random() * 0.1; cb = 1.0; } // pure white (Pluto-like)
        colors[i3] = cr * 27.0; colors[i3 + 1] = cg * 27.0; colors[i3 + 2] = cb * 27.0; // Ultra bright Kuiper belt (3x boost)
        sizes[idx] = Math.random() > 0.80 ? 4.0 + Math.random() * 3.5 : 2.2 + Math.random() * 1.8;
        idx++;
    }

    // --- DEEP SPACE ASTEROIDS (far outside the solar system, among the stars) ---
    for (let p = 0; p < SCATTERED_BUDGET; p++) {
        const i3 = idx * 3;
        // Placed deep in space beyond the solar system (radius 520–850)
        // Mixed at all angles, inclinations — fully 3D scatter like a real starfield
        const dist = 520 + Math.random() * 330;
        const a = Math.random() * Math.PI * 2;
        const elev = (Math.random() - 0.5) * Math.PI; // full 3D sphere
        const lx = dist * Math.cos(elev) * Math.cos(a);
        const ly = dist * Math.sin(elev);
        const lz = dist * Math.cos(elev) * Math.sin(a);
        localOffsets[i3] = lx; localOffsets[i3 + 1] = ly; localOffsets[i3 + 2] = lz;
        basePositions[i3] = lx; basePositions[i3 + 1] = ly; basePositions[i3 + 2] = lz;
        particleBodyId[idx] = -2;
        // Bright glowing colors — visible like stars in deep space
        // Rocky orange, reddish, golden, icy-blue, metallic white
        const rt = Math.random();
        let cr, cg, cb;
        if (rt < 0.2) { cr = 1.0; cg = 0.55 + Math.random() * 0.25; cb = 0.1 + Math.random() * 0.15; } // orange-red molten rock
        else if (rt < 0.4) { cr = 1.0; cg = 0.8 + Math.random() * 0.2; cb = 0.3 + Math.random() * 0.2; } // bright gold / iron
        else if (rt < 0.6) { cr = 0.6 + Math.random() * 0.3; cg = 0.75 + Math.random() * 0.2; cb = 1.0; } // icy blue comet
        else if (rt < 0.75) { cr = 1.0; cg = 1.0; cb = 0.8 + Math.random() * 0.2; } // bright white (metallic)
        else if (rt < 0.88) { cr = 0.9 + Math.random() * 0.1; cg = 0.4 + Math.random() * 0.2; cb = 0.2 + Math.random() * 0.15; } // red dwarf rocky
        else { const g = 0.7 + Math.random() * 0.3; cr = g; cg = g; cb = g; } // silver-grey
        // Bright enough to be visible with natural colors
        const brightness = 0.3 + Math.random() * 0.4; // Very faint deep-space objects
        colors[i3] = cr * brightness; colors[i3 + 1] = cg * brightness; colors[i3 + 2] = cb * brightness;
        // Varied sizes — some are large enough to look like small glowing bodies
        sizes[idx] = Math.random() > 0.88 ? 2.5 + Math.random() * 3.5 : 1.2 + Math.random() * 1.3;
        idx++;
    }

    // --- Orbit Path Lines ---
    const PER_ORBIT = Math.floor(ORBIT_LINE_BUDGET / 8);
    for (let o = 0; o < 8; o++) {
        const oR = BODIES[o + 1].orbitR;
        for (let p = 0; p < PER_ORBIT; p++) {
            if (idx >= PARTICLE_COUNT) break;
            const i3 = idx * 3;
            const a = (p / PER_ORBIT) * Math.PI * 2 + Math.random() * 0.01;
            const lx = Math.cos(a) * oR;
            const ly = (Math.random() - 0.5) * 0.2;
            const lz = Math.sin(a) * oR;
            localOffsets[i3] = lx; localOffsets[i3 + 1] = ly; localOffsets[i3 + 2] = lz;
            basePositions[i3] = lx; basePositions[i3 + 1] = ly; basePositions[i3 + 2] = lz;
            particleBodyId[idx] = -1;
            colors[i3] = 0.20; colors[i3 + 1] = 0.30; colors[i3 + 2] = 0.65; // Visible blue orbit lines
            sizes[idx] = 1.2; // Slightly larger to stand out from belt
            idx++;
        }
    }

    // --- Wandering Stars (bright stars orbiting through the solar system) ---
    const WANDERING_STAR_COUNT = 60;
    for (let w = 0; w < WANDERING_STAR_COUNT && idx < PARTICLE_COUNT; w++) {
        const i3 = idx * 3;
        // Place at various orbital radii throughout the solar system
        const orbitR = 80 + Math.random() * 420; // Between Mercury and beyond Neptune
        const angle = Math.random() * Math.PI * 2;
        const inclination = (Math.random() - 0.5) * 0.6; // Slight vertical spread
        const lx = Math.cos(angle) * orbitR;
        const ly = Math.sin(inclination) * orbitR * 0.15;
        const lz = Math.sin(angle) * orbitR;
        localOffsets[i3] = lx; localOffsets[i3 + 1] = ly; localOffsets[i3 + 2] = lz;
        basePositions[i3] = lx; basePositions[i3 + 1] = ly; basePositions[i3 + 2] = lz;
        particleBodyId[idx] = -42; // Wandering star ID

        // Bright, colorful wandering stars
        const t = Math.random();
        let cr, cg, cb;
        if (t < 0.3) { cr = 1.0; cg = 1.0; cb = 1.0; }         // Brilliant white
        else if (t < 0.5) { cr = 0.7; cg = 0.85; cb = 1.0; }    // Icy blue
        else if (t < 0.65) { cr = 1.0; cg = 0.9; cb = 0.5; }    // Golden
        else if (t < 0.8) { cr = 1.0; cg = 0.5; cb = 0.2; }     // Fiery orange
        else if (t < 0.9) { cr = 0.9; cg = 0.3; cb = 0.9; }     // Violet
        else { cr = 0.4; cg = 0.7; cb = 1.0; }                   // Deep blue
        const brightness = 6.0 + Math.random() * 5.0; // Very bright
        colors[i3] = cr * brightness; colors[i3 + 1] = cg * brightness; colors[i3 + 2] = cb * brightness;
        sizes[idx] = 4.0 + Math.random() * 5.0; // Large and prominent
        idx++;
    }

    // --- Background Stars - Realistic Star Field ---
    // Layer 1: Massive bright stars (very few, very prominent)
    const MEGA_STAR_COUNT = 120;
    // Layer 2: Bright visible stars (with color variety like real night sky)
    const BRIGHT_STAR_COUNT = 1200;
    // Layer 3: Medium stars (many, visible)
    const MEDIUM_STAR_COUNT = 3500;
    // Layer 4: Dim background star dust (fills the sky like Milky Way)
    // Rest of the budget

    let starIdx = 0;
    while (idx < PARTICLE_COUNT) {
        const i3 = idx * 3;

        let isMega = starIdx < MEGA_STAR_COUNT;
        let isBright = !isMega && starIdx < (MEGA_STAR_COUNT + BRIGHT_STAR_COUNT);
        let isMedium = !isMega && !isBright && starIdx < (MEGA_STAR_COUNT + BRIGHT_STAR_COUNT + MEDIUM_STAR_COUNT);

        let sr;
        if (isMega) {
            sr = 530 + Math.random() * 300;
        } else if (isBright) {
            sr = 530 + Math.random() * 400;
        } else if (isMedium) {
            sr = 530 + Math.random() * 500;
        } else {
            sr = 530 + Math.random() * 700; // Fill the sky deeply
        }

        const st = Math.random() * Math.PI * 2;
        const sp = Math.random() * Math.PI;
        const lx = sr * Math.sin(sp) * Math.cos(st);
        const ly = sr * Math.sin(sp) * Math.sin(st);
        const lz = sr * Math.cos(sp);
        localOffsets[i3] = lx; localOffsets[i3 + 1] = ly; localOffsets[i3 + 2] = lz;
        basePositions[i3] = lx; basePositions[i3 + 1] = ly; basePositions[i3 + 2] = lz;

        if (isMega) {
            // Mega stars - bright white/blue with huge glow
            particleBodyId[idx] = -4;
            const t = Math.random();
            let cr, cg, cb;
            if (t < 0.4) { cr = 1.0; cg = 1.0; cb = 1.0; } // pure white
            else if (t < 0.6) { cr = 0.8; cg = 0.9; cb = 1.0; } // blue-white
            else if (t < 0.8) { cr = 1.0; cg = 0.95; cb = 0.7; } // warm white
            else { cr = 1.0; cg = 0.6; cb = 0.3; } // orange giant
            colors[i3] = cr * 9.0; colors[i3 + 1] = cg * 9.0; colors[i3 + 2] = cb * 9.0;
            sizes[idx] = 8.0 + Math.random() * 5.0;
        } else if (isBright) {
            // Bright stars - various real star colors
            particleBodyId[idx] = -4;
            const t = Math.random();
            let cr, cg, cb;
            if (t < 0.25) { cr = 1.0; cg = 1.0; cb = 1.0; }       // White (A-type)
            else if (t < 0.45) { cr = 0.7; cg = 0.8; cb = 1.0; }   // Blue-white (B-type)
            else if (t < 0.60) { cr = 1.0; cg = 0.95; cb = 0.8; }   // Yellow-white (F-type)
            else if (t < 0.75) { cr = 1.0; cg = 0.85; cb = 0.5; }   // Yellow (G-type, like Sun)
            else if (t < 0.85) { cr = 1.0; cg = 0.7; cb = 0.4; }    // Orange (K-type)
            else if (t < 0.95) { cr = 1.0; cg = 0.4; cb = 0.3; }    // Red (M-type)
            else { cr = 0.5; cg = 0.6; cb = 1.0; }                   // Deep blue (O-type)
            colors[i3] = cr * 7.0; colors[i3 + 1] = cg * 7.0; colors[i3 + 2] = cb * 7.0;
            sizes[idx] = 4.5 + Math.random() * 3.5;
        } else if (isMedium) {
            // Medium stars - clearly visible points
            particleBodyId[idx] = -4;
            const t = Math.random();
            let cr, cg, cb;
            if (t < 0.5) { cr = 1.0; cg = 1.0; cb = 1.0; }
            else if (t < 0.7) { cr = 0.8; cg = 0.9; cb = 1.0; }
            else if (t < 0.85) { cr = 1.0; cg = 0.9; cb = 0.7; }
            else { cr = 1.0; cg = 0.6; cb = 0.4; }
            colors[i3] = cr * 4.5; colors[i3 + 1] = cg * 4.5; colors[i3 + 2] = cb * 4.5;
            sizes[idx] = 3.0 + Math.random() * 2.0;
        } else {
            // Background star dust - tiny but visible, fills the sky
            particleBodyId[idx] = -1;
            const brightness = 1.2 + Math.random() * 1.5;
            const tint = Math.random();
            if (tint < 0.6) {
                colors[i3] = brightness; colors[i3 + 1] = brightness; colors[i3 + 2] = brightness;
            } else if (tint < 0.8) {
                colors[i3] = brightness * 0.8; colors[i3 + 1] = brightness * 0.85; colors[i3 + 2] = brightness;
            } else {
                colors[i3] = brightness; colors[i3 + 1] = brightness * 0.9; colors[i3 + 2] = brightness * 0.8;
            }
            sizes[idx] = 1.5 + Math.random() * 2.0;
        }

        idx++;
        starIdx++;
    }

    // Store base colors for zoom-based brightness boost
    baseColors.set(colors);

    // INSTANT planet formation — copy base positions directly so planets appear immediately
    positions.set(basePositions);

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;
    document.getElementById('planet-name').innerText = "Solar System";
    isSolarSystemView = true;
}

// --- 6. GENERATE INDIVIDUAL PLANET VIEW ---
function generatePlanetView(view) {
    isSolarSystemView = false;
    bodyRanges = [];
    currentPlanetViewMoons = [];
    planetViewMoonAngles = [];

    const moons = view.moons || [];
    const totalMoonParticles = moons.reduce((sum, m) => sum + m.particles, 0);
    const STAR_PARTICLES = Math.floor(PARTICLE_COUNT * 0.15); // Less stars, more for planet detail
    const AVAILABLE_FOR_BODIES = PARTICLE_COUNT - STAR_PARTICLES;
    const PLANET_PARTICLES = AVAILABLE_FOR_BODIES - totalMoonParticles;

    let idx = 0;

    // --- Generate planet sphere ---
    const planetEnd = view.hasRings ? Math.floor(PLANET_PARTICLES * 0.55) : PLANET_PARTICLES;
    for (let i = 0; i < planetEnd && idx < PARTICLE_COUNT; i++) {
        const i3 = idx * 3;
        particleBodyId[idx] = -1;

        const total = planetEnd;
        const phi = Math.acos(-1 + (2 * i) / total);
        const theta = Math.sqrt(total * Math.PI) * phi;

        const x = view.radius * Math.cos(theta) * Math.sin(phi);
        const y = view.radius * Math.sin(theta) * Math.sin(phi);
        const z = view.radius * Math.cos(phi);

        const noise = 1 + (Math.random() - 0.5) * 0.03;
        basePositions[i3] = x * noise;
        basePositions[i3 + 1] = y * noise;
        basePositions[i3 + 2] = z * noise;
        localOffsets[i3] = x * noise;
        localOffsets[i3 + 1] = y * noise;
        localOffsets[i3 + 2] = z * noise;

        let pColor = new THREE.Color(view.main);
        if (view.second) {
            const mix = Math.sin(y * 0.2) * 0.5 + 0.5 + (Math.random() * 0.2);
            pColor.lerp(new THREE.Color(view.second), mix);
        }
        if (view.third) {
            pColor.lerp(new THREE.Color(view.third), Math.random() * 0.3);
        }

        applyRealisticPlanetColor(pColor, view.name, phi, theta);

        // Per-planet intensity — vivid bright for planet view
        const planetNames = ["Sun","Mercury","Venus","Earth","Moon","Mars","Jupiter","Saturn","Uranus","Neptune"];
        const planetIntensities = [1.4, 0.75, 0.65, 0.85, 1.25, 0.80, 0.75, 0.65, 0.75, 0.85];
        const pIdx = planetNames.indexOf(view.name);
        let intensity = pIdx >= 0 ? planetIntensities[pIdx] : 0.75;
        // Limb darkening for planet view — consistent brightness at all angles
        const distFromCenter = Math.sqrt(x*x + y*y + z*z) / view.radius;
        const pvHemiShade = (view.name === "Sun") ? 1.0 : (0.55 + 0.45 * (1.0 - distFromCenter * distFromCenter * 0.25));
        colors[i3] = Math.max(0, pColor.r * intensity * pvHemiShade);
        colors[i3 + 1] = Math.max(0, pColor.g * intensity * pvHemiShade);
        colors[i3 + 2] = Math.max(0, pColor.b * intensity * pvHemiShade);
        sizes[idx] = 1.0;
        idx++;
    }

    // --- Generate Saturn-like rings ---
    if (view.hasRings) {
        const ringCount = PLANET_PARTICLES - planetEnd;
        const RING_TILT = 26.7 * Math.PI / 180; // Saturn's axial tilt
        const cosTilt = Math.cos(RING_TILT);
        const sinTilt = Math.sin(RING_TILT);
        for (let i = 0; i < ringCount && idx < PARTICLE_COUNT; i++) {
            const i3 = idx * 3;
            particleBodyId[idx] = -1;
            const angle = Math.random() * Math.PI * 2;
            let r = view.radius * 1.25 + Math.random() * view.radius * 1.6;
            // Cassini Division gap
            if (r > view.radius * 1.82 && r < view.radius * 1.98 && Math.random() > 0.04) r += 0.16 * view.radius;
            // Encke Gap
            else if (r > view.radius * 2.28 && r < view.radius * 2.36 && Math.random() > 0.08) r -= 0.08 * view.radius;
            // Generate in flat plane then tilt
            const flatX = Math.cos(angle) * r;
            const flatY = (Math.random() - 0.5) * 1.5;
            const flatZ = Math.sin(angle) * r;
            // Apply tilt around X axis
            const tiltedY = flatY * cosTilt - flatZ * sinTilt;
            const tiltedZ = flatY * sinTilt + flatZ * cosTilt;
            basePositions[i3] = flatX;
            basePositions[i3 + 1] = tiltedY;
            basePositions[i3 + 2] = tiltedZ;
            localOffsets[i3] = flatX;
            localOffsets[i3 + 1] = tiltedY;
            localOffsets[i3 + 2] = tiltedZ;
            // Bright ring colors — multiple ring bands with varying brightness
            const ringDist = r / view.radius; // 1.25 to 2.85
            const bandBright = (ringDist < 1.6) ? 1.2 : (ringDist < 2.1) ? 1.0 : 0.85; // B ring brightest, A ring medium, C ring dimmer
            const baseRingClr = new THREE.Color(view.ringClr || 0xeedd88);
            const variation = (Math.random() - 0.5) * 0.15;
            baseRingClr.r = Math.min(1, baseRingClr.r + variation);
            baseRingClr.g = Math.min(1, baseRingClr.g + variation * 0.8);
            baseRingClr.b = Math.min(1, baseRingClr.b + variation * 0.5);
            const ringIntensity = bandBright * (0.9 + Math.random() * 0.2);
            colors[i3] = baseRingClr.r * ringIntensity;
            colors[i3 + 1] = baseRingClr.g * ringIntensity;
            colors[i3 + 2] = baseRingClr.b * ringIntensity;
            sizes[idx] = 1.4 + Math.random() * 0.8;
            idx++;
        }
    }

    // --- Generate orbiting moons ---
    for (let m = 0; m < moons.length; m++) {
        const moon = moons[m];
        const moonAngle = (Math.PI * 2 * m / moons.length) + Math.random() * 0.5; // Spread moons around orbit
        planetViewMoonAngles.push(moonAngle);

        const moonStartIdx = idx;
        const moonCenterX = Math.cos(moonAngle) * moon.orbitR;
        const moonCenterZ = Math.sin(moonAngle) * moon.orbitR;

        for (let p = 0; p < moon.particles && idx < PARTICLE_COUNT; p++) {
            const i3 = idx * 3;
            const phi = Math.acos(-1 + (2 * p) / moon.particles);
            const theta = Math.sqrt(moon.particles * Math.PI) * phi;
            const n = 1 + (Math.random() - 0.5) * 0.05;

            const lx = moon.r * Math.cos(theta) * Math.sin(phi) * n;
            const ly = moon.r * Math.sin(theta) * Math.sin(phi) * n;
            const lz = moon.r * Math.cos(phi) * n;

            // Store local offset relative to moon center
            localOffsets[i3] = lx;
            localOffsets[i3 + 1] = ly;
            localOffsets[i3 + 2] = lz;

            basePositions[i3] = moonCenterX + lx;
            basePositions[i3 + 1] = ly;
            basePositions[i3 + 2] = moonCenterZ + lz;

            particleBodyId[idx] = -50 - m; // Unique moon ID for animation

            // Moon coloring with surface detail
            let mColor = new THREE.Color(moon.main);
            if (moon.second) {
                mColor.lerp(new THREE.Color(moon.second), Math.random() * 0.5);
            }
            if (moon.third) {
                mColor.lerp(new THREE.Color(moon.third), Math.random() * 0.3);
            }

            // Apply research-based realistic Moon coloring for Earth's Moon
            if (moon.name === "Moon" && view.name === "Earth") {
                applyRealisticMoonColor(mColor, phi, theta, moon.r);
            } else {
                // Surface details for other moons
                const lat = phi;
                const craterDetail = (Math.random() > 0.85) ? -0.2 : (Math.random() - 0.5) * 0.08;
                const fineDetail = (Math.random() - 0.5) * 0.06;
                const totalDetail = craterDetail + fineDetail;
                mColor.r = Math.max(0, Math.min(1, mColor.r + totalDetail));
                mColor.g = Math.max(0, Math.min(1, mColor.g + totalDetail));
                mColor.b = Math.max(0, Math.min(1, mColor.b + totalDetail));
            }

            // Limb darkening — round from all angles (Moon gets gentler darkening)
            const mDistFromCenter = Math.sqrt(lx*lx + ly*ly + lz*lz) / moon.r;
            const mHemiShade = (moon.name === "Moon" && view.name === "Earth") 
                ? (0.65 + 0.35 * (1.0 - mDistFromCenter * mDistFromCenter * 0.2))
                : (0.55 + 0.45 * (1.0 - mDistFromCenter * mDistFromCenter * 0.25));
            // Earth's Moon gets higher intensity for detailed visibility
            const intensity = (moon.name === "Moon" && view.name === "Earth") ? 1.35 : 0.85;
            colors[i3] = mColor.r * intensity * mHemiShade;
            colors[i3 + 1] = mColor.g * intensity * mHemiShade;
            colors[i3 + 2] = mColor.b * intensity * mHemiShade;
            // Moon particles slightly larger for detail visibility
            sizes[idx] = (moon.name === "Moon" && view.name === "Earth") ? 1.3 : 1.0;
            idx++;
        }

        currentPlanetViewMoons.push({
            startIdx: moonStartIdx,
            endIdx: idx,
            orbitR: moon.orbitR,
            speed: moon.speed,
            moonIdx: m
        });
    }

    // --- Generate moon orbit path lines ---
    for (let m = 0; m < moons.length; m++) {
        const orbitPts = Math.min(80, Math.floor((PARTICLE_COUNT - idx - STAR_PARTICLES) / Math.max(1, moons.length)));
        if (orbitPts <= 0) break;
        for (let p = 0; p < orbitPts && idx < PARTICLE_COUNT - STAR_PARTICLES; p++) {
            const i3 = idx * 3;
            const a = (p / orbitPts) * Math.PI * 2;
            basePositions[i3] = Math.cos(a) * moons[m].orbitR;
            basePositions[i3 + 1] = (Math.random() - 0.5) * 0.15;
            basePositions[i3 + 2] = Math.sin(a) * moons[m].orbitR;
            localOffsets[i3] = basePositions[i3];
            localOffsets[i3 + 1] = basePositions[i3 + 1];
            localOffsets[i3 + 2] = basePositions[i3 + 2];
            particleBodyId[idx] = -1;
            colors[i3] = 0.25; colors[i3 + 1] = 0.35; colors[i3 + 2] = 0.55;
            sizes[idx] = 0.6;
            idx++;
        }
    }

    // --- Background Stars & Deep-Space Asteroids (matching solar system quality) ---
    // Calculate camera distance for this view so star sphere is always well-placed
    let viewCamZ = isMobile ? 180 : 150;
    if (view.moons && view.moons.length > 0) {
        const farthest = Math.max(...view.moons.map(m => m.orbitR + m.r));
        viewCamZ = Math.max(viewCamZ, farthest * (isMobile ? 2.6 : 2.2));
    }
    // Star placement scales with camera distance so stars always surround the view
    const starBaseR = Math.max(300, viewCamZ * 1.2);
    const starMaxR = starBaseR + 400;

    const remainingStarBudget = PARTICLE_COUNT - idx;
    const ASTEROID_FRAC = 0.10; // 10% for scattered asteroids/debris
    const MEGA_COUNT = Math.max(40, Math.floor(remainingStarBudget * 0.005));
    const BRIGHT_COUNT = Math.max(250, Math.floor(remainingStarBudget * 0.04));
    const MEDIUM_COUNT = Math.max(800, Math.floor(remainingStarBudget * 0.12));
    const DEBRIS_COUNT = Math.floor(remainingStarBudget * ASTEROID_FRAC);
    let pvStarIdx = 0;

    while (idx < PARTICLE_COUNT) {
        const i3 = idx * 3;

        const isMega = pvStarIdx < MEGA_COUNT;
        const isBright = !isMega && pvStarIdx < (MEGA_COUNT + BRIGHT_COUNT);
        const isMedium = !isMega && !isBright && pvStarIdx < (MEGA_COUNT + BRIGHT_COUNT + MEDIUM_COUNT);
        const isDebris = !isMega && !isBright && !isMedium && pvStarIdx < (MEGA_COUNT + BRIGHT_COUNT + MEDIUM_COUNT + DEBRIS_COUNT);

        if (isDebris) {
            // --- Deep-space asteroids / debris ---
            const dist = starBaseR * 0.8 + Math.random() * starBaseR * 0.6;
            const st = Math.random() * Math.PI * 2;
            const sp = Math.random() * Math.PI;
            basePositions[i3] = dist * Math.sin(sp) * Math.cos(st);
            basePositions[i3 + 1] = dist * Math.sin(sp) * Math.sin(st);
            basePositions[i3 + 2] = dist * Math.cos(sp);
            localOffsets[i3] = basePositions[i3];
            localOffsets[i3 + 1] = basePositions[i3 + 1];
            localOffsets[i3 + 2] = basePositions[i3 + 2];
            particleBodyId[idx] = -1;
            const rt = Math.random();
            let cr, cg, cb;
            if (rt < 0.2) { cr = 1.0; cg = 0.55 + Math.random() * 0.25; cb = 0.1 + Math.random() * 0.15; }
            else if (rt < 0.4) { cr = 1.0; cg = 0.8 + Math.random() * 0.2; cb = 0.3 + Math.random() * 0.2; }
            else if (rt < 0.6) { cr = 0.6 + Math.random() * 0.3; cg = 0.75 + Math.random() * 0.2; cb = 1.0; }
            else if (rt < 0.75) { cr = 1.0; cg = 1.0; cb = 0.8 + Math.random() * 0.2; }
            else if (rt < 0.88) { cr = 0.9 + Math.random() * 0.1; cg = 0.4 + Math.random() * 0.2; cb = 0.2 + Math.random() * 0.15; }
            else { const g = 0.7 + Math.random() * 0.3; cr = g; cg = g; cb = g; }
            const brightness = 0.8 + Math.random() * 1.2;
            colors[i3] = cr * brightness; colors[i3 + 1] = cg * brightness; colors[i3 + 2] = cb * brightness;
            sizes[idx] = Math.random() > 0.75 ? 3.0 + Math.random() * 3.5 : 1.5 + Math.random() * 2.0;
        } else {
            // --- Stars (4 tiers matching solar system view quality) ---
            let sr;
            if (isMega) {
                sr = starBaseR + Math.random() * 200;
            } else if (isBright) {
                sr = starBaseR + Math.random() * 300;
            } else if (isMedium) {
                sr = starBaseR + Math.random() * 350;
            } else {
                sr = starBaseR + Math.random() * 400;
            }

            const st = Math.random() * Math.PI * 2;
            const sp = Math.random() * Math.PI;
            basePositions[i3] = sr * Math.sin(sp) * Math.cos(st);
            basePositions[i3 + 1] = sr * Math.sin(sp) * Math.sin(st);
            basePositions[i3 + 2] = sr * Math.cos(sp);
            localOffsets[i3] = basePositions[i3];
            localOffsets[i3 + 1] = basePositions[i3 + 1];
            localOffsets[i3 + 2] = basePositions[i3 + 2];

            if (isMega) {
                particleBodyId[idx] = -4;
                const t = Math.random();
                let cr, cg, cb;
                if (t < 0.4) { cr = 1.0; cg = 1.0; cb = 1.0; }
                else if (t < 0.6) { cr = 0.8; cg = 0.9; cb = 1.0; }
                else if (t < 0.8) { cr = 1.0; cg = 0.95; cb = 0.7; }
                else { cr = 1.0; cg = 0.6; cb = 0.3; }
                colors[i3] = cr * 8.0; colors[i3 + 1] = cg * 8.0; colors[i3 + 2] = cb * 8.0;
                sizes[idx] = 7.0 + Math.random() * 4.0;
            } else if (isBright) {
                particleBodyId[idx] = -4;
                const t = Math.random();
                let cr, cg, cb;
                if (t < 0.25) { cr = 1.0; cg = 1.0; cb = 1.0; }
                else if (t < 0.45) { cr = 0.7; cg = 0.8; cb = 1.0; }
                else if (t < 0.60) { cr = 1.0; cg = 0.95; cb = 0.8; }
                else if (t < 0.75) { cr = 1.0; cg = 0.85; cb = 0.5; }
                else if (t < 0.85) { cr = 1.0; cg = 0.7; cb = 0.4; }
                else if (t < 0.95) { cr = 1.0; cg = 0.4; cb = 0.3; }
                else { cr = 0.5; cg = 0.6; cb = 1.0; }
                colors[i3] = cr * 6.0; colors[i3 + 1] = cg * 6.0; colors[i3 + 2] = cb * 6.0;
                sizes[idx] = 4.0 + Math.random() * 3.0;
            } else if (isMedium) {
                particleBodyId[idx] = -4;
                const t = Math.random();
                let cr, cg, cb;
                if (t < 0.5) { cr = 1.0; cg = 1.0; cb = 1.0; }
                else if (t < 0.7) { cr = 0.8; cg = 0.9; cb = 1.0; }
                else if (t < 0.85) { cr = 1.0; cg = 0.9; cb = 0.7; }
                else { cr = 1.0; cg = 0.6; cb = 0.4; }
                colors[i3] = cr * 4.0; colors[i3 + 1] = cg * 4.0; colors[i3 + 2] = cb * 4.0;
                sizes[idx] = 2.8 + Math.random() * 2.0;
            } else {
                // Background star dust
                particleBodyId[idx] = -1;
                const brightness = 1.0 + Math.random() * 1.2;
                const tint = Math.random();
                if (tint < 0.6) {
                    colors[i3] = brightness; colors[i3 + 1] = brightness; colors[i3 + 2] = brightness;
                } else if (tint < 0.8) {
                    colors[i3] = brightness * 0.8; colors[i3 + 1] = brightness * 0.85; colors[i3 + 2] = brightness;
                } else {
                    colors[i3] = brightness; colors[i3 + 1] = brightness * 0.9; colors[i3 + 2] = brightness * 0.8;
                }
                sizes[idx] = 1.3 + Math.random() * 1.5;
            }
        }

        idx++;
        pvStarIdx++;
    }

    // Store base colors for zoom-based brightness boost
    baseColors.set(colors);

    // INSTANT planet formation — copy base positions directly so planet appears immediately
    positions.set(basePositions);

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;

    document.getElementById('planet-name').innerText = view.name;
}

// --- 7. VIEW SWITCHING ---
function switchView(index) {
    currentViewIndex = index;
    const view = PLANET_VIEWS[index];
    if (view.isSolarSystem) {
        // Snap tilt and camera so planets are never viewed edge-on on the first
        // frame after returning to the solar system.
        particleSystem.rotation.x = -0.55;
        particleSystem.rotation.y = 0;
        camera.position.z = isMobile ? 520 : 450;
        camera.position.x = 0;
        camera.position.y = 0;
        generateSolarSystem();
    } else {
        generatePlanetView(view);
    }
}

switchView(0); // Start with Solar System

// --- 8. UPDATE SOLAR SYSTEM ORBITS ---
function updateOrbits() {
    if (!isSolarSystemView) return;

    for (let b = 0; b < BODIES.length; b++) {
        orbitAngles[b] += BODIES[b].speed * 0.008; // Increased speed
    }

    // Update all moon orbits — data-driven, single source of truth
    for (const moon of SOLAR_SYSTEM_MOONS) {
        moonOrbitAnglesMap[moon.bodyId] += moon.orbitSpeed;
    }

    for (const range of bodyRanges) {
        const b = range.bodyIdx;
        const a = orbitAngles[b];
        const ox = Math.cos(a) * BODIES[b].orbitR;
        const oz = Math.sin(a) * BODIES[b].orbitR;
        for (let idx = range.start; idx < range.end; idx++) {
            const i3 = idx * 3;
            basePositions[i3] = ox + localOffsets[i3];
            basePositions[i3 + 1] = localOffsets[i3 + 1];
            basePositions[i3 + 2] = oz + localOffsets[i3 + 2];
        }
    }
}

// --- 9A. MOBILE TOUCH CONTROLS ---
let touchStartX = 0, touchStartY = 0;
let touchRotationX = 0, touchRotationY = 0;
let initialPinchDistance = 0;
let touchExpansion = 0;
let lastTapTime = 0;
let focusBeforeTap = -1; // snapshot of focusedPlanetIdx before the first tap, so double-tap can revert it

if (isMobile) {
    // Touch drag for rotation
    renderer.domElement.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
        }
    });

    renderer.domElement.addEventListener('touchmove', (e) => {
        e.preventDefault();

        if (e.touches.length === 1) {
            // Single finger drag = rotate
            const deltaX = e.touches[0].clientX - touchStartX;
            const deltaY = e.touches[0].clientY - touchStartY;
            touchRotationY += deltaX * 0.01;
            touchRotationX += deltaY * 0.01;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            // Pinch gesture = expand/contract
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const pinchDelta = (distance - initialPinchDistance) * 0.01;
            touchExpansion = Math.max(0, Math.min(5, touchExpansion + pinchDelta));
            initialPinchDistance = distance;
        }
    }, { passive: false });

    renderer.domElement.addEventListener('touchend', (e) => {
        if (e.touches.length === 0) {
            const now = Date.now();
            const tapX = touchStartX;
            const tapY = touchStartY;

            if (now - lastTapTime < 350) {
                // --- DOUBLE TAP ---
                // Revert the focus-zoom that the first tap may have started
                focusedPlanetIdx = focusBeforeTap;
                focusTransition = 0;
                if (isSolarSystemView) {
                    // Navigate to the tapped planet, just like desktop dblclick
                    const clickedIdx = findClickedPlanet(tapX, tapY);
                    if (clickedIdx >= 0 && clickedIdx < BODY_TO_PLANET_VIEW.length) {
                        focusedPlanetIdx = -1;
                        focusTransition = 0;
                        lastPlanetViewIndex = clickedIdx;
                        currentViewIndex = BODY_TO_PLANET_VIEW[clickedIdx];
                        switchView(currentViewIndex);
                    } else {
                        // Tapped empty space — cycle views
                        currentViewIndex = (currentViewIndex + 1) % PLANET_VIEWS.length;
                        focusedPlanetIdx = -1;
                        focusTransition = 0;
                        if (PLANET_VIEWS[currentViewIndex].isSolarSystem) {
                            handRotation.x = 0; handRotation.y = 0;
                            handVelocity.x = 0; handVelocity.y = 0;
                            userZoomOffset = 0;
                            touchRotationX = 0; touchRotationY = 0;
                        }
                        switchView(currentViewIndex);
                    }
                } else {
                    // In planet view — double-tap returns to solar system
                    focusTransition = 0;
                    userZoomOffset = 0;
                    handRotation.x = 0; handRotation.y = 0;
                    handVelocity.x = 0; handVelocity.y = 0;
                    touchRotationX = 0; touchRotationY = 0;
                    currentViewIndex = 0;
                    switchView(0);
                    focusedPlanetIdx = -1;
                }
                lastTapTime = 0; // reset so next tap starts fresh
            } else {
                // --- SINGLE TAP: planet focus ---
                focusBeforeTap = focusedPlanetIdx; // snapshot before changing, so double-tap can revert
                if (isSolarSystemView && tapX && tapY) {
                    const clickedIdx = findClickedPlanet(tapX, tapY);
                    if (clickedIdx >= 0) {
                        if (focusedPlanetIdx !== clickedIdx) focusTransition = 0;
                        focusedPlanetIdx = clickedIdx;
                    } else if (focusedPlanetIdx >= 0) {
                        focusedPlanetIdx = -1;
                    }
                }
                lastTapTime = now;
            }
        }
    });
}

// --- 9C. GYROSCOPE DISABLED — hand tracking used on all devices ---
let gyroEnabled = false;
let gyroRotationX = 0, gyroRotationY = 0;

// --- 9B. MEDIAPIPE HAND TRACKING ---
// Left hand thumbs up = previous planet, Right hand thumbs up = next planet
const videoElement = document.getElementById('webcam');
let handRotation = { x: 0, y: 0 };
let handVelocity = { x: 0, y: 0 };  // inertia: coasts after hand leaves
let lastHandPos = null;             // previous wrist position for delta calc
let smoothedWrist = null;             // EMA-smoothed wrist for jitter removal
const wristSmooth = isMobile ? 0.45 : 0.3; // EMA factor (higher = smoother but laggier)
let expansionFactor = 0;
let smoothedExpansion = 0;
let lastSwitchTime = 0;

// --- SCROLL WHEEL ZOOM ---
let userZoomOffset = 0;
window.addEventListener('wheel', (e) => {
    e.preventDefault();
    userZoomOffset += e.deltaY * 0.25;
    // Clamp: max zoom-out +300, max zoom-in -240 (keeps min cam dist ~40)
    userZoomOffset = Math.max(-390, Math.min(500, userZoomOffset));
}, { passive: false });

// --- PLANET FOCUS/ZOOM SYSTEM ---
// Click any planet in solar system view to zoom into it
let focusedPlanetIdx = -1;         // -1 = no focus (full solar system), 0-8 = focused on BODIES[idx]
let focusTransition = 0;           // 0 = fully unfocused, 1 = fully focused (smooth lerp)
let cameraTargetX = 0, cameraTargetY = 0; // camera look-at target for focused planet
const FOCUS_CAM_DISTANCE = 70;     // How close camera gets to focused planet — far enough to see whole planet
const FOCUS_TRANSITION_SPEED = 0.04; // Smooth transition speed

// Project a 3D world position to 2D screen coordinates
// Takes local-space coordinates and transforms through particleSystem's matrix
function projectToScreen(x, y, z) {
    const vec = new THREE.Vector3(x, y, z);
    // Transform from particle system local space to world space
    vec.applyMatrix4(particleSystem.matrixWorld);
    vec.project(camera);
    return {
        x: (vec.x * 0.5 + 0.5) * window.innerWidth,
        y: (-vec.y * 0.5 + 0.5) * window.innerHeight
    };
}

// Get current world center of planet bodyIdx
// Accounts for hand-expansion orbit scaling so clicks match visual positions
function getPlanetCenter(bodyIdx) {
    if (!isSolarSystemView || bodyRanges.length === 0) return null;
    const a = orbitAngles[bodyIdx];
    const body = BODIES[bodyIdx];
    // When focused, particles don't expand (expansionForSpread=0), so use scale 1
    const isFocusActive = focusedPlanetIdx >= 0 && focusTransition > 0.3;
    const effectiveExpansion = isFocusActive ? 0 : expansionFactor;
    const orbitScale = 1 + effectiveExpansion * 1.5;
    return {
        x: Math.cos(a) * body.orbitR * orbitScale,
        y: Math.sin(a) * body.orbitR * Math.sin(body.inc || 0) * orbitScale,
        z: Math.sin(a) * body.orbitR * orbitScale
    };
}

// Find which planet was clicked (returns body index or -1)
function findClickedPlanet(screenX, screenY) {
    let bestIdx = -1;
    let bestDist = Infinity;
    const hitRadius = 45; // pixels — tolerance for click detection

    for (let b = 0; b < BODIES.length; b++) {
        const center = getPlanetCenter(b);
        if (!center) continue;
        const screen = projectToScreen(center.x, center.y, center.z);
        const dx = screen.x - screenX;
        const dy = screen.y - screenY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Scale hit radius by planet size and zoom level for easier clicking
        const zoomBoost = Math.max(1, 1 + expansionFactor * 0.5);
        const scaledRadius = (hitRadius + BODIES[b].r * 2.5) * zoomBoost;
        if (dist < scaledRadius && dist < bestDist) {
            bestDist = dist;
            bestIdx = b;
        }
    }
    return bestIdx;
}

// Hover cursor change — pointer when over a planet in solar system view
renderer.domElement.addEventListener('mousemove', (e) => {
    if (!isSolarSystemView) return;
    const hovered = findClickedPlanet(e.clientX, e.clientY);
    renderer.domElement.style.cursor = hovered >= 0 ? 'pointer' : 'default';
});

// Click handler for planet focus
// focusBeforeSequence: snapshot of focusedPlanetIdx at the START of a click sequence,
// so returning from a planet view can restore the planet that was selected beforehand.
let focusBeforeSequence = -1;
let focusBeforeClick = -1;
let lastClickTimestamp = 0;
const DBLCLICK_THRESHOLD_MS = 300;

renderer.domElement.addEventListener('click', (e) => {
    if (!isSolarSystemView) return;
    const now = Date.now();
    // New sequence (not a rapid double-click) — snapshot pre-sequence focus state.
    if (now - lastClickTimestamp > DBLCLICK_THRESHOLD_MS) {
        focusBeforeSequence = focusedPlanetIdx;
    }
    lastClickTimestamp = now;
    focusBeforeClick = focusedPlanetIdx; // per-click snapshot so dblclick can revert
    const clickedIdx = findClickedPlanet(e.clientX, e.clientY);
    if (clickedIdx >= 0) {
        // Always focus the clicked planet — never toggle off on same-planet click
        // (toggling caused zoom-in → zoom-out stutter on double-click).
        if (focusedPlanetIdx !== clickedIdx) focusTransition = 0; // fresh transition when switching
        focusedPlanetIdx = clickedIdx;
    } else {
        // Clicked empty space — unfocus.
        focusedPlanetIdx = -1;
    }
});

// Double-click: in solar system → go to planet view; in planet view → go back to solar system
let lastPlanetViewIndex = 0; // Remember which planet we were viewing (BODIES index)
renderer.domElement.addEventListener('dblclick', (e) => {
    // Revert the focus change made by the preceding click events so we enter
    // the planet view from a clean state (no partial focus zoom in progress).
    focusedPlanetIdx = focusBeforeClick;

    if (isSolarSystemView) {
        // Re-derive the clicked planet directly from cursor position — independent of focusedPlanetIdx.
        const clickedIdx = findClickedPlanet(e.clientX, e.clientY);
        if (clickedIdx >= 0 && clickedIdx < BODY_TO_PLANET_VIEW.length) {
            // Use BODY_TO_PLANET_VIEW so Mars → PLANET_VIEWS[6], not Moon at [5].
            focusedPlanetIdx = -1;
            focusTransition = 0;
            lastPlanetViewIndex = clickedIdx;
            currentViewIndex = BODY_TO_PLANET_VIEW[clickedIdx];
            switchView(currentViewIndex);
        }
    } else {
        // In planet view — double-click returns to solar system.
        // Reset accumulated state to avoid edge-on/flat-planet issues.
        focusTransition = 0;
        userZoomOffset = 0;
        handRotation.x = 0;
        handRotation.y = 0;
        handVelocity.x = 0;
        handVelocity.y = 0;
        touchRotationX = 0;
        touchRotationY = 0;
        currentViewIndex = 0;
        switchView(0);
        // Restore the focus state from BEFORE the double-click sequence began:
        //   • Single-clicked a planet first → return with that planet focused.
        //   • Double-clicked with no prior selection → return to default (no focus).
        // focusTransition stays 0 so camera starts from the default distance and
        // smoothly flies in — avoids the flat-planet issue.
        focusedPlanetIdx = focusBeforeSequence;
    }
});

// Escape key to unfocus
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && focusedPlanetIdx >= 0) {
        focusedPlanetIdx = -1;
    }
});

const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: isMobile ? 0 : 1,          // lite model on mobile for speed
    minDetectionConfidence: isMobile ? 0.5 : 0.6,
    minTrackingConfidence: isMobile ? 0.4 : 0.6  // lower = fewer re-detections = smoother
});

function isThumbsUp(landmarks) {
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const thumbMCP = landmarks[2];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const thumbUp = thumbTip.y < thumbMCP.y - 0.08;
    const indexCurled = Math.sqrt(Math.pow(wrist.x - indexTip.x, 2) + Math.pow(wrist.y - indexTip.y, 2)) < 0.22;
    const middleCurled = Math.sqrt(Math.pow(wrist.x - middleTip.x, 2) + Math.pow(wrist.y - middleTip.y, 2)) < 0.22;
    const ringCurled = Math.sqrt(Math.pow(wrist.x - ringTip.x, 2) + Math.pow(wrist.y - ringTip.y, 2)) < 0.22;
    const pinkyCurled = Math.sqrt(Math.pow(wrist.x - pinkyTip.x, 2) + Math.pow(wrist.y - pinkyTip.y, 2)) < 0.22;
    return thumbUp && indexCurled && middleCurled && ringCurled && pinkyCurled;
}

hands.onResults((results) => {
    document.getElementById('loading').style.display = 'none';

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        // Use first detected hand for rotation and pinch
        const landmarks = results.multiHandLandmarks[0];

        // 1. Delta-based rotation — accumulates on every sweep, unlimited range
        const rawWrist = landmarks[0];
        // EMA smoothing on raw wrist position to eliminate jitter
        if (smoothedWrist === null) {
            smoothedWrist = { x: rawWrist.x, y: rawWrist.y };
        } else {
            smoothedWrist.x += (rawWrist.x - smoothedWrist.x) * (1 - wristSmooth);
            smoothedWrist.y += (rawWrist.y - smoothedWrist.y) * (1 - wristSmooth);
        }
        const wrist = smoothedWrist;
        if (lastHandPos !== null) {
            const rawDx = wrist.y - lastHandPos.y;  // vertical move   → X rotation
            const rawDy = wrist.x - lastHandPos.x;  // horizontal move → Y rotation
            const deadZone = 0.004;                 // ignore micro-jitter
            const sensitivity = 10;                 // higher = faster turns
            if (Math.abs(rawDx) > deadZone) {
                const delta = rawDx * sensitivity;
                handRotation.x += delta;
                handVelocity.x = handVelocity.x * 0.6 + delta * 0.4;
            } else {
                handVelocity.x *= 0.85;
            }
            if (Math.abs(rawDy) > deadZone) {
                const delta = rawDy * sensitivity;
                handRotation.y += delta;
                handVelocity.y = handVelocity.y * 0.6 + delta * 0.4;
            } else {
                handVelocity.y *= 0.85;
            }
        }
        lastHandPos = { x: wrist.x, y: wrist.y };

        // 2. Pinch (Thumb tip=4, Index tip=8) -> Expand particles
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const dx = thumbTip.x - indexTip.x;
        const dy = thumbTip.y - indexTip.y;
        const pinchDistance = Math.sqrt(dx * dx + dy * dy);
        const rawExpansion = Math.max(0, (pinchDistance - 0.05) * 5);
        // Smooth expansion to avoid flickering on mobile
        smoothedExpansion += (rawExpansion - smoothedExpansion) * (isMobile ? 0.3 : 0.5);
        expansionFactor = smoothedExpansion;

        // 3. Thumbs Up on either hand -> Switch View
        // Check all detected hands for thumbs up + determine left/right
        for (let h = 0; h < results.multiHandLandmarks.length; h++) {
            const handLandmarks = results.multiHandLandmarks[h];
            const handedness = results.multiHandedness[h];
            // MediaPipe reports "Left"/"Right" from camera perspective (mirrored)
            // So "Right" label = user's left hand, "Left" label = user's right hand
            const isUserLeftHand = handedness.label === 'Right';
            const isUserRightHand = handedness.label === 'Left';

            if (isThumbsUp(handLandmarks)) {
                const now = Date.now();
                if (now - lastSwitchTime > 1500) {
                    if (isUserLeftHand) {
                        // Left hand thumbs up = previous planet
                        currentViewIndex = (currentViewIndex - 1 + PLANET_VIEWS.length) % PLANET_VIEWS.length;
                    } else if (isUserRightHand) {
                        // Right hand thumbs up = next planet
                        currentViewIndex = (currentViewIndex + 1) % PLANET_VIEWS.length;
                    }
                    focusedPlanetIdx = -1;
                    focusTransition = 0;
                    // Reset accumulated rotation when returning to solar system so the
                    // view always snaps back to the correct tilted orbital perspective.
                    if (PLANET_VIEWS[currentViewIndex].isSolarSystem) {
                        handRotation.x = 0;
                        handRotation.y = 0;
                        handVelocity.x = 0;
                        handVelocity.y = 0;
                        userZoomOffset = 0;
                    }
                    switchView(currentViewIndex);
                    lastSwitchTime = now;
                }
            }
        }
    } else {
        // No hand visible — keep expansion at last value so zoom stays
        // User zooms out manually via scroll wheel
        lastHandPos = null;          // reset so no jump on re-entry
        smoothedWrist = null;          // reset so no jump on re-entry
        // Coast with inertia, then decay to rest
        handRotation.x += handVelocity.x;
        handRotation.y += handVelocity.y;
        handVelocity.x *= 0.88;
        handVelocity.y *= 0.88;
    }
});

// Initialize camera and hand tracking on all devices
const cameraUtils = new Camera(videoElement, {
    onFrame: async () => { await hands.send({ image: videoElement }); },
    width: isMobile ? 176 : 320,
    height: isMobile ? 144 : 240,
    facingMode: 'user'
});
cameraUtils.start();

// --- 10. ANIMATION LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    // Compute zoomFactor based on camera distance AND hand expansion to trigger 3D zoom details
    const defaultCamZ = isMobile ? 520 : 450;
    const cameraZoomFactor = Math.max(0, Math.min(1, (defaultCamZ - camera.position.z) / (defaultCamZ - 70)));
    // Hand expansion also contributes to zoom (expansionFactor 0-5 maps to 0-1)
    const handZoomFactor = Math.max(0, Math.min(1, expansionFactor / 2.5));
    // Use whichever zoom source is stronger
    const zoomFactor = Math.max(cameraZoomFactor, handZoomFactor);

    // Update planet orbits in solar system view
    updateOrbits();

    // Per-planet self-rotation in solar system view
    if (isSolarSystemView && bodyRanges.length > 0) {
        for (const range of bodyRanges) {
            const b = range.bodyIdx;
            if (b === 0) continue; // Sun handled separately with pulse
            const spinSpeed = 0.05 + b * 0.008; // Increased self-rotation speed
            const cosA = Math.cos(time * spinSpeed);
            const sinA = Math.sin(time * spinSpeed);
            const body = BODIES[b];
            const a = orbitAngles[b];
            const ox = Math.cos(a) * body.orbitR;
            const oz = Math.sin(a) * body.orbitR;
            const oy = Math.sin(a) * body.orbitR * Math.sin(body.inc || 0);

            // Focus-based growth: focused planet grows slightly, others stay normal
            const isFocused = (focusedPlanetIdx === b);
            const focusGrow = isFocused ? (1.0 + focusTransition * 0.15) : 1.0;

            for (let idx = range.start; idx < range.end; idx++) {
                const i3 = idx * 3;
                // Skip ring particles (they have their own rotation logic)
                if (particleBodyId[idx] === -5) continue;

                // Planet sphere growth when zoomed — only when NO planet is focused.
                // When focused, the camera is already moved close by the focus system;
                // growing the world-space sphere on top of perspective zoom double-compounds
                // the effect and makes selected planets look huge when zoomed out.
                const focusActive = focusedPlanetIdx >= 0 && focusTransition > 0.01;
                let outL = 1.0;
                if (!focusActive) {
                    outL = 1.0 + zoomFactor * 0.6;
                    outL = Math.min(outL, BODY_MAX_OUTL[b]);
                    if (zoomFactor > 0.02) {
                        // Terrain pop-out for surface detail on zoom
                        const luma = baseColors[i3] * 0.3 + baseColors[i3 + 1] * 0.59 + baseColors[i3 + 2] * 0.11;
                        outL += luma * zoomFactor * 0.15;
                        outL = Math.min(outL, BODY_MAX_OUTL[b]);
                    }
                }
                // Apply focus growth (also capped)
                outL *= focusGrow;
                // Store for moon orbit scaling
                bodyCurrentOutL[b] = outL;

                // Full 3D rotation: spin around Y axis + tilt around X for proper sphere shape at any view angle
                const lx0 = localOffsets[i3] * outL;
                const ly0 = localOffsets[i3 + 1] * outL;
                const lz0 = localOffsets[i3 + 2] * outL;
                // Y-axis spin
                const rx1 = lx0 * cosA - lz0 * sinA;
                const rz1 = lx0 * sinA + lz0 * cosA;
                basePositions[i3] = ox + rx1;
                basePositions[i3 + 1] = oy + ly0;
                basePositions[i3 + 2] = oz + rz1;
            }
        }
    }

    // Sun gentle pulsation + self-rotation in solar system view
    if (isSolarSystemView && bodyRanges.length > 0) {
        const sunRange = bodyRanges[0];
        const pulse = Math.sin(time * 2) * 0.025 + 1.01; // Gentle size pulsation
        const sunFocused = (focusedPlanetIdx === 0);
        const sunFocusGrow = sunFocused ? (1.0 + focusTransition * 0.15) : 1.0;
        const sunSpin = time * 0.03; // Slow self-rotation
        const sunCosA = Math.cos(sunSpin);
        const sunSinA = Math.sin(sunSpin);
        // When any focus is active, skip zoomFactor-driven sphere expansion for the same
        // reason as planets — camera is already positioned close, no world-space growth needed.
        const sunFocusActive = focusedPlanetIdx >= 0 && focusTransition > 0.01;
        for (let idx = sunRange.start; idx < sunRange.end; idx++) {
            const i3 = idx * 3;
            // Sun grows very little — capped to never cover Mercury orbit
            let outL = pulse;
            if (!sunFocusActive && zoomFactor > 0.02) {
                const luma = baseColors[i3] * 0.3 + baseColors[i3 + 1] * 0.59 + baseColors[i3 + 2] * 0.11;
                outL += luma * zoomFactor * 0.15;
            }
            outL = Math.min(outL, BODY_MAX_OUTL[0]);
            outL *= sunFocusGrow;
            bodyCurrentOutL[0] = outL;
            // Full 3D rotation for Sun sphere
            const lx0 = localOffsets[i3] * outL;
            const ly0 = localOffsets[i3 + 1] * outL;
            const lz0 = localOffsets[i3 + 2] * outL;
            basePositions[i3] = lx0 * sunCosA - lz0 * sunSinA;
            basePositions[i3 + 1] = ly0;
            basePositions[i3 + 2] = lx0 * sunSinA + lz0 * sunCosA;
        }
    }

    // Animate moons orbiting in individual planet view
    if (!isSolarSystemView && currentPlanetViewMoons.length > 0) {
        for (let m = 0; m < currentPlanetViewMoons.length; m++) {
            const moonData = currentPlanetViewMoons[m];
            // Update orbit angle
            planetViewMoonAngles[m] += moonData.speed * 0.008;
            const angle = planetViewMoonAngles[m];
            const moonCenterX = Math.cos(angle) * moonData.orbitR;
            const moonCenterZ = Math.sin(angle) * moonData.orbitR;

            // Update all particles belonging to this moon
            for (let idx = moonData.startIdx; idx < moonData.endIdx; idx++) {
                const i3 = idx * 3;
                let outL = 1.0;
                if (zoomFactor > 0.02) {
                    const luma = baseColors[i3] * 0.3 + baseColors[i3 + 1] * 0.59 + baseColors[i3 + 2] * 0.11;
                    outL += (luma - 0.3) * zoomFactor * 0.3;
                }
                basePositions[i3] = moonCenterX + localOffsets[i3] * outL;
                basePositions[i3 + 1] = localOffsets[i3 + 1] * outL;
                basePositions[i3 + 2] = moonCenterZ + localOffsets[i3 + 2] * outL;
            }
        }
    }

    // === BRIGHTNESS: gently compensate for camera distance so perceived brightness stays consistent ===
    // When a planet is focused the camera is intentionally close; we anchor the brightness reference
    // to that nominal focus distance so zooming in/out while focused doesn't shift the whole scene's
    // brightness. Without this, a focused close camera triggers a large brightness spike.
    const isFocusMode = focusedPlanetIdx >= 0 && focusTransition > 0.3;
    // Use the actual camera Z normally, but floor it at the focus camera distance when focused
    // so brightness doesn't climb as the user scrolls in toward the selected planet.
    const nominalFocusDist = isFocusMode ? (FOCUS_CAM_DISTANCE + BODIES[focusedPlanetIdx].r * 5) : 0;
    const effectiveCamZ = isFocusMode ? Math.max(camera.position.z, nominalFocusDist * 0.8) : camera.position.z;
    const camRatio = Math.max(0.15, effectiveCamZ / defaultCamZ);
    // Power 0.22 gives gentle correction: ~1.0 at default, ~1.13 at mid zoom, ~1.22 at full close zoom.
    // Cap at 1.25 so colours never blow out — lower cap when focused to avoid scene-wide brightness spike.
    const brightCap = isFocusMode ? 1.1 : 1.25;
    const zoomBrightComp = Math.min(brightCap, Math.pow(1.0 / camRatio, 0.22));

    const hasFocus = focusedPlanetIdx >= 0 && focusTransition > 0.01;
    if (isSolarSystemView) {
        // Planets & bodies — apply zoom-brightness compensation to keep perceived brightness constant
        for (const range of bodyRanges) {
            for (let idx = range.start; idx < range.end; idx++) {
                const i3 = idx * 3;
                if (particleBodyId[idx] === -4) continue;
                colors[i3]     = baseColors[i3]     * zoomBrightComp;
                colors[i3 + 1] = baseColors[i3 + 1] * zoomBrightComp;
                colors[i3 + 2] = baseColors[i3 + 2] * zoomBrightComp;
            }
        }
        // Moons and Saturn's rings — same compensation
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const bid = particleBodyId[i];
            if (bid === -5 || (bid <= -6 && bid >= -38)) {
                const i3 = i * 3;
                colors[i3]     = baseColors[i3]     * zoomBrightComp;
                colors[i3 + 1] = baseColors[i3 + 1] * zoomBrightComp;
                colors[i3 + 2] = baseColors[i3 + 2] * zoomBrightComp;
            }
        }
        geometry.attributes.color.needsUpdate = true;
    }

    // Realistic star twinkling effect - each star twinkles at its own frequency
    const sizeArr = geometry.attributes.size.array;
    if (isSolarSystemView) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;

            // Star twinkling
            if (particleBodyId[i] === -4) {
                // Each star has unique twinkle speed and phase
                const speed1 = 2.0 + (i % 7) * 0.5;
                const speed2 = 3.0 + (i % 5) * 0.7;
                const phase = i * 17.3;
                // Combine two sine waves for realistic irregular twinkle
                const tw = 0.75 + Math.sin(time * speed1 + phase) * 0.18 + Math.sin(time * speed2 + phase * 0.7) * 0.12;
                // Natural star brightness with twinkling
                const baseBright = sizeArr[i] > 4.5 ? 3.8 : (sizeArr[i] > 2.8 ? 2.5 : 1.5);
                colors[i3] = baseBright * tw;
                colors[i3 + 1] = baseBright * tw * 0.95;
                colors[i3 + 2] = baseBright * tw * 1.05;

                // Subtle star drift movement (very slow rotation around center)
                const driftSpeed = 0.001 + (i % 11) * 0.0001;
                const driftAngle = time * driftSpeed + phase;
                const radius = Math.sqrt(localOffsets[i3] * localOffsets[i3] + localOffsets[i3 + 2] * localOffsets[i3 + 2]);
                basePositions[i3] = Math.cos(driftAngle) * radius;
                basePositions[i3 + 2] = Math.sin(driftAngle) * radius;
                // Keep Y position with slight wave
                basePositions[i3 + 1] = localOffsets[i3 + 1] + Math.sin(time * 0.2 + phase) * 0.5;
            }

            // Boost planet/moon particle sizes when zoomed for solid 3D detail
            const bid = particleBodyId[i];
            if (bid >= 0 && bid < 9) {
                // Planet body particles — mild growth when zoomed to show detail
                sizeArr[i] = 1.0 + zoomFactor * 0.6;
            } else if (bid === -5) {
                // Saturn ring particles
                sizeArr[i] = 0.8 + zoomFactor * 0.5;
            } else if (bid <= -6 && bid >= -38) {
                // Moon particles
                sizeArr[i] = 0.8 + zoomFactor * 0.6;
            } else if (bid === -2 || bid === -3) {
                // Belt particles
                sizeArr[i] = sizeArr[i] * (1.0 + zoomFactor * 0.3);
            }

            // Main Asteroid Belt movement (orbital motion)
            if (particleBodyId[i] === -2) {
                const orbitSpeed = 0.008 + (i % 13) * 0.002; // varied speeds
                const phase = i * 23.7;
                const angle = time * orbitSpeed + phase;
                const radius = Math.sqrt(localOffsets[i3] * localOffsets[i3] + localOffsets[i3 + 2] * localOffsets[i3 + 2]);
                basePositions[i3] = Math.cos(angle) * radius;
                basePositions[i3 + 2] = Math.sin(angle) * radius;
                // Slight vertical oscillation
                basePositions[i3 + 1] = localOffsets[i3 + 1] + Math.sin(time * 0.5 + phase) * 1.5;
            }

            // Kuiper Belt movement (slower orbital motion)
            if (particleBodyId[i] === -3) {
                const orbitSpeed = 0.003 + (i % 17) * 0.001; // slower than main belt
                const phase = i * 31.4;
                const angle = time * orbitSpeed + phase;
                const radius = Math.sqrt(localOffsets[i3] * localOffsets[i3] + localOffsets[i3 + 2] * localOffsets[i3 + 2]);
                basePositions[i3] = Math.cos(angle) * radius;
                basePositions[i3 + 2] = Math.sin(angle) * radius;
                // Slight vertical oscillation
                basePositions[i3 + 1] = localOffsets[i3 + 1] + Math.sin(time * 0.3 + phase) * 2.0;
            }

            // Wandering stars — bright stars orbiting through the solar system
            if (particleBodyId[i] === -42) {
                const orbitRadius = Math.sqrt(localOffsets[i3] * localOffsets[i3] + localOffsets[i3 + 2] * localOffsets[i3 + 2]);
                const baseAngle = Math.atan2(localOffsets[i3 + 2], localOffsets[i3]);
                // Each wandering star has its own speed — some fast, some slow
                const orbitSpeed = 0.015 + (i % 19) * 0.004;
                const wanderPhase = i * 13.7;
                const angle = baseAngle + time * orbitSpeed;
                // Slight radial oscillation for elliptical feel
                const radOsc = Math.sin(time * 0.4 + wanderPhase) * orbitRadius * 0.12;
                const curR = orbitRadius + radOsc;
                basePositions[i3] = Math.cos(angle) * curR;
                basePositions[i3 + 2] = Math.sin(angle) * curR;
                // Vertical bobbing
                basePositions[i3 + 1] = localOffsets[i3 + 1] + Math.sin(time * 0.7 + wanderPhase) * 8.0;

                // Bright pulsing glow for wandering stars
                const pulseBright = 0.8 + Math.sin(time * 3.0 + wanderPhase) * 0.2;
                colors[i3] = baseColors[i3] * pulseBright;
                colors[i3 + 1] = baseColors[i3 + 1] * pulseBright;
                colors[i3 + 2] = baseColors[i3 + 2] * pulseBright;
            }

            // Saturn's rings rotation with 26.7 deg tilt
            if (particleBodyId[i] === -5) {
                const saturnAngle = orbitAngles[6];
                const saturnX = Math.cos(saturnAngle) * BODIES[6].orbitR;
                const saturnZ = Math.sin(saturnAngle) * BODIES[6].orbitR;
                const saturnY = Math.sin(saturnAngle) * BODIES[6].orbitR * Math.sin(BODIES[6].inc || 0);

                // Rotate in the FLAT ring plane first — rings grow with planet, capped
                const saturnFocused = (focusedPlanetIdx === 6);
                const ringFocusGrow = saturnFocused ? (1.0 + focusTransition * 0.3) : 1.0;
                const ringGrow = Math.min(1.0 + zoomFactor * 0.6, BODY_MAX_OUTL[6]) * ringFocusGrow;
                const flatRadius = Math.sqrt(localOffsets[i3] * localOffsets[i3] + localOffsets[i3 + 2] * localOffsets[i3 + 2]) * ringGrow;
                const flatBaseAngle = Math.atan2(localOffsets[i3 + 2], localOffsets[i3]);
                const ringRotSpeed = 0.08;
                const newFlatAngle = flatBaseAngle + time * ringRotSpeed;
                const rotFlatX = Math.cos(newFlatAngle) * flatRadius;
                const rotFlatZ = Math.sin(newFlatAngle) * flatRadius;
                const flatY = localOffsets[i3 + 1] * ringGrow;

                // Apply Saturn's 26.7 deg axial tilt (rotation around X axis)
                const SATURN_TILT = 0.466; // 26.7 degrees in radians
                const cosT = Math.cos(SATURN_TILT);
                const sinT = Math.sin(SATURN_TILT);
                const tiltedY = flatY * cosT - rotFlatZ * sinT;
                const tiltedZ = flatY * sinT + rotFlatZ * cosT;

                basePositions[i3] = saturnX + rotFlatX;
                basePositions[i3 + 1] = saturnY + tiltedY;
                basePositions[i3 + 2] = saturnZ + tiltedZ;
            }

            // === ALL MOONS — data-driven animation (proper 3D orbits) ===
            // localOffsets stores sphere-only offset, so:
            //   finalPos = parentPlanetPos + moonOrbitPos(currentAngle) + rotatedSphereOffset
            // This keeps every moon as a perfect 3D sphere at all viewing angles.
            const bodyId = particleBodyId[i];
            if (bodyId <= -6 && bodyId >= -38) {
                const moon = moonDataByBodyId[bodyId];
                if (moon) {
                    const parentBody = BODIES[moon.parentIdx];
                    const parentAngle = orbitAngles[moon.parentIdx];
                    const parentX = Math.cos(parentAngle) * parentBody.orbitR;
                    const parentZ = Math.sin(parentAngle) * parentBody.orbitR;

                    const mAngle = moonOrbitAnglesMap[moon.bodyId];

                    // Self-rotation: rotate sphere offset around Y axis
                    const cosS = Math.cos(time * moon.spinSpeed);
                    const sinS = Math.sin(time * moon.spinSpeed);

                    // Moon sphere growth when zoomed — gentle like planets
                    // Moons of focused planet also grow
                    const moonParentFocused = (focusedPlanetIdx === moon.parentIdx);
                    const moonFocusGrow = moonParentFocused ? (1.0 + focusTransition * 0.5) : 1.0;
                    let outL = (1.0 + zoomFactor * 0.5) * moonFocusGrow;
                    if (zoomFactor > 0.02) {
                        const luma = baseColors[i3] * 0.3 + baseColors[i3 + 1] * 0.59 + baseColors[i3 + 2] * 0.11;
                        outL += luma * zoomFactor * 0.15;
                    }

                    // Scale moon orbit radius by parent planet's growth so moon stays OUTSIDE planet
                    const parentOutL = bodyCurrentOutL[moon.parentIdx] || 1.0;
                    const scaledOrbitR = moon.orbitR * parentOutL;
                    const moonCX = Math.cos(mAngle) * scaledOrbitR;
                    const moonCZ = Math.sin(mAngle) * scaledOrbitR;

                    const slx = localOffsets[i3] * outL;
                    const slz = localOffsets[i3 + 2] * outL;
                    const rx = slx * cosS - slz * sinS;
                    const rz = slx * sinS + slz * cosS;

                    basePositions[i3] = parentX + moonCX + rx;
                    basePositions[i3 + 1] = localOffsets[i3 + 1] * outL;
                    basePositions[i3 + 2] = parentZ + moonCZ + rz;
                }
            }
        }
        geometry.attributes.color.needsUpdate = true;
    }

    // Star twinkling for planet views — same quality as solar system view
    if (!isSolarSystemView) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            if (particleBodyId[i] === -4) {
                const i3 = i * 3;
                const speed1 = 2.0 + (i % 7) * 0.5;
                const speed2 = 3.0 + (i % 5) * 0.7;
                const phase = i * 17.3;
                const tw = 0.75 + Math.sin(time * speed1 + phase) * 0.18 + Math.sin(time * speed2 + phase * 0.7) * 0.12;
                const baseBright = sizeArr[i] > 4.5 ? 3.8 : (sizeArr[i] > 2.8 ? 2.5 : 1.5);
                colors[i3] = baseBright * tw;
                colors[i3 + 1] = baseBright * tw * 0.95;
                colors[i3 + 2] = baseBright * tw * 1.05;

                // Subtle star drift
                const driftSpeed = 0.001 + (i % 11) * 0.0001;
                const driftAngle = time * driftSpeed + phase;
                const radius = Math.sqrt(localOffsets[i3] * localOffsets[i3] + localOffsets[i3 + 2] * localOffsets[i3 + 2]);
                basePositions[i3] = Math.cos(driftAngle) * radius;
                basePositions[i3 + 2] = Math.sin(driftAngle) * radius;
                basePositions[i3 + 1] = localOffsets[i3 + 1] + Math.sin(time * 0.2 + phase) * 0.5;
            }
        }
        geometry.attributes.color.needsUpdate = true;
    }

    // Smooth camera zoom: pull back for solar system, closer for planets
    // For planet views with moons, zoom out further to show the full moon system
    let planetViewCamZ = isMobile ? 180 : 150;
    if (!isSolarSystemView) {
        const view = PLANET_VIEWS[currentViewIndex];
        if (view && view.moons && view.moons.length > 0) {
            const farthestMoonOrbit = Math.max(...view.moons.map(m => m.orbitR + m.r));
            planetViewCamZ = Math.max(planetViewCamZ, farthestMoonOrbit * (isMobile ? 2.6 : 2.2));
        }
    }
    const baseCamZ = isSolarSystemView ? (isMobile ? 520 : 450) : planetViewCamZ;

    // --- PLANET FOCUS CAMERA ---
    if (isSolarSystemView && focusedPlanetIdx >= 0) {
        // Smoothly transition to focused state
        focusTransition = Math.min(1, focusTransition + FOCUS_TRANSITION_SPEED);
        const center = getPlanetCenter(focusedPlanetIdx);
        if (center) {
            // Transform planet center from particle system local space to world space
            const worldPos = new THREE.Vector3(center.x, center.y, center.z);
            worldPos.applyMatrix4(particleSystem.matrixWorld);
            cameraTargetX = worldPos.x;
            cameraTargetY = worldPos.y;
            // Calculate zoom distance based on planet size + hand gesture
            const planetR = BODIES[focusedPlanetIdx].r;
            const focusDist = FOCUS_CAM_DISTANCE + planetR * 5;
            // Hand gesture (expansion) zooms toward focused planet — more responsive
            const handFocusZoom = Math.min(expansionFactor * 35, 100);
            // Give userZoomOffset FULL effect when focused so zoom-out actually moves the camera
            // away from the selected planet. Previously it was dampened to 30% (1 - 0.7*focusT)
            // which caused the camera to barely move, making the planet appear stuck-large.
            const targetCamZ = baseCamZ * (1 - focusTransition) + (worldPos.z + focusDist - handFocusZoom) * focusTransition + userZoomOffset;
            camera.position.z += (targetCamZ - camera.position.z) * 0.08;
            // Smooth camera X/Y to look at focused planet — faster tracking
            camera.position.x += (cameraTargetX * focusTransition - camera.position.x) * 0.06;
            camera.position.y += (cameraTargetY * focusTransition - camera.position.y) * 0.06;
            // Update planet name display
            document.getElementById('planet-name').innerText = BODIES[focusedPlanetIdx].name;
        }
    } else {
        // Unfocusing: smoothly return to full solar system view
        if (focusTransition > 0.001) {
            focusTransition = Math.max(0, focusTransition - FOCUS_TRANSITION_SPEED);
        } else {
            focusTransition = 0;
        }
        const targetCamZ = Math.max(10, baseCamZ + userZoomOffset);
        camera.position.z += (targetCamZ - camera.position.z) * 0.18;
        camera.position.x += (0 - camera.position.x) * 0.12;
        camera.position.y += (0 - camera.position.y) * 0.12;
        if (isSolarSystemView && focusTransition < 0.01) {
            document.getElementById('planet-name').innerText = "Solar System";
        }
    }

    // Hand tracking controls rotation on all devices (same as desktop)
    const activeRotationX = handRotation.x;
    const activeRotationY = handRotation.y;
    const activeExpansion = expansionFactor;

    // Smooth rotation + base tilt for solar system orbital view
    const baseTiltX = isSolarSystemView ? -0.55 : 0; // Default tilt when no hand rotation applied
    // Solar system: SNAP rotation.x directly every frame (no lerp).
    // Lerp caused a drift window where rotation.x hovered near 0 (edge-on) after
    // returning from planet view, making planets look flat for several frames.
    if (isSolarSystemView) {
        particleSystem.rotation.x = activeRotationX + baseTiltX;
    } else {
        particleSystem.rotation.x += ((activeRotationX + baseTiltX) - particleSystem.rotation.x) * 0.18;
    }
    particleSystem.rotation.y += (activeRotationY - particleSystem.rotation.y) * 0.18;

    // Always add a slow ambient spin
    particleSystem.rotation.y += 0.008; // Increased ambient spin

    // Dynamic particle size — scale with camera distance so particles maintain
    // consistent apparent size at all zoom levels (no giant blobs when close).
    // camDistScale < 1 when zoomed in, > 1 when zoomed out.
    const camDistScale = Math.max(0.45, Math.sqrt(Math.max(10, camera.position.z) / 450));

    if (isSolarSystemView) {
        // Bloom: mild increase when zoomed, Sun always glows, planets keep their shape
        bloomPass.threshold = Math.max(0.40, 0.55 - zoomFactor * 0.10);
        const focusBloom = hasFocus ? focusTransition * 0.05 : 0;
        bloomPass.strength = 0.55 + zoomFactor * 0.15 + focusBloom;
        bloomPass.radius = 0.25 + zoomFactor * 0.05;
        // Particle size: mild increase when zoomed — enough to fill, not blob
        const zoomSizeAdj = 1.0 + zoomFactor * 0.5;
        if (activeExpansion < 0.01) {
            material.size = 1.8 * camDistScale * zoomSizeAdj;
        } else {
            const ramp = Math.min(activeExpansion / 0.5, 1.0);
            const shrink = Math.max(0, (activeExpansion - 0.5) * 0.55);
            material.size = (1.8 + ramp * 0.8 - shrink) * camDistScale * zoomSizeAdj;
        }
    } else {
        // Planet view: mild bloom so planet stays sharp with visible colors
        bloomPass.strength = 0.35 + zoomFactor * 0.15;
        bloomPass.threshold = 0.65;
        // Particle size: mild increase for detail when zoomed
        const pointScale = 1.0 + zoomFactor * 0.4;
        const baseSize = 1.8 + (activeExpansion * 0.5);
        const detailBoost = activeExpansion > 0.3 ? Math.min(activeExpansion * 0.4, 0.8) : 0;
        material.size = (baseSize + detailBoost) * camDistScale * pointScale;
    }

    const pos = geometry.attributes.position.array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;

        const vx = basePositions[i3];
        const vy = basePositions[i3 + 1];
        const vz = basePositions[i3 + 2];

        let targetX, targetY, targetZ;

        if (isSolarSystemView && activeExpansion > 0.01) {
            // When focused on a planet, DON'T spread orbits — gesture only zooms camera
            // When not focused, spread orbits outward as before
            const isFocusActive = focusedPlanetIdx >= 0 && focusTransition > 0.3;
            const expansionForSpread = isFocusActive ? 0 : activeExpansion;
            const bodyId = particleBodyId[i];

            if (bodyId >= 0 && bodyId < BODIES.length) {
                // Planet particles: scale orbit centre + gently grow local sphere for zoom detail
                const localX = localOffsets[i3];
                const localY = localOffsets[i3 + 1];
                const localZ = localOffsets[i3 + 2];

                // Compute orbit centre from orbital parameters rather than vx-localX.
                // basePositions already has self-rotation applied, so vx-localX is NOT
                // the orbit centre — it produces a wrong (non-zero) value for the Sun
                // and a slightly-off value for rotating planets, distorting the sphere.
                const a = orbitAngles[bodyId];
                const bd = BODIES[bodyId];
                const orbitCenterX = Math.cos(a) * bd.orbitR;
                const orbitCenterY = Math.sin(a) * bd.orbitR * Math.sin(bd.inc || 0);
                const orbitCenterZ = Math.sin(a) * bd.orbitR;

                // Spread orbits outward with expansion (disabled when focused)
                const orbitScale = 1 + expansionForSpread * 1.5;
                // Gentle planet sphere growth — just enough to see detail, not overlap orbits
                const localScale = 1 + expansionForSpread * 0.5;

                targetX = orbitCenterX * orbitScale + localX * localScale;
                targetY = orbitCenterY * orbitScale + localY * localScale;
                targetZ = orbitCenterZ * orbitScale + localZ * localScale;
            } else if (bodyId === -1) {
                // Orbit ring lines: scale radius AND inclination Y for correct tilted orbits
                const orbitalRadius = Math.sqrt(vx * vx + vz * vz);
                const angle = Math.atan2(vz, vx);
                const orbitScale = 1 + expansionForSpread * 1.5;
                targetX = Math.cos(angle) * orbitalRadius * orbitScale;
                targetY = vy * orbitScale;
                targetZ = Math.sin(angle) * orbitalRadius * orbitScale;
            } else if (bodyId === -2 || bodyId === -3) {
                // Asteroid and Kuiper belts - scale radially like orbits
                const orbitalRadius = Math.sqrt(vx * vx + vz * vz);
                const angle = Math.atan2(vz, vx);
                const scaledRadius = orbitalRadius * (1 + expansionForSpread * 1.5);
                targetX = Math.cos(angle) * scaledRadius;
                targetY = vy + (vy * 0.2 * expansionForSpread);
                targetZ = Math.sin(angle) * scaledRadius;
            } else if (bodyId <= -5) {
                // Saturn's rings (bodyId -5) and ALL moons (bodyId -6 to -38):
                //
                // The broken approach was: scaledRadius = sqrt(vx²+vz²) * scale
                // That mixed the parent planet's orbit distance with the moon's local
                // offset, so every particle in the same moon had a different scale
                // factor — making spheres look flat, tilted, or displaced at any
                // orbit angle.
                //
                // Correct approach: localOffsets already encodes each particle's
                // FULL offset from its parent planet centre (moon orbit + sphere offset).
                // So  (vx - localX) == parent planet world X,
                //     (vz - localZ) == parent planet world Z.
                // Scale ONLY the parent position; add back the unchanged local
                // structure.  Every moon and ring stays a perfect sphere at all
                // zoom levels and at every point in its orbit.
                const localX = localOffsets[i3];
                const localY = localOffsets[i3 + 1];
                const localZ = localOffsets[i3 + 2];
                const orbitScale = 1 + expansionForSpread * 1.5;
                const moonLocalScale = 1 + expansionForSpread * 0.5;
                targetX = (vx - localX) * orbitScale + localX * moonLocalScale;
                targetY = (vy - localY) * orbitScale + localY * moonLocalScale;
                targetZ = (vz - localZ) * orbitScale + localZ * moonLocalScale;
            } else {
                // Stars and other particles - minimal expansion
                const wave = Math.sin(time * 2 + i) * 2 * expansionForSpread;
                targetX = vx + (vx * expansionForSpread * 0.3) + wave;
                targetY = vy + (vy * expansionForSpread * 0.3) + wave;
                targetZ = vz + (vz * expansionForSpread * 0.3) + wave;
            }
        } else {
            // Planet view or no expansion - use original behavior
            const wave = Math.sin(time * 2 + i) * 5 * activeExpansion;
            targetX = vx + (vx * activeExpansion * 2) + wave;
            targetY = vy + (vy * activeExpansion * 2) + wave;
            targetZ = vz + (vz * activeExpansion * 2) + wave;
        }

        // Planets, moons, rings: near-instant positioning to prevent orbital lag
        // (slow lerp + orbital motion = horizontal smear making spheres into ovals)
        const bid = particleBodyId[i];
        const lerpRate = (bid >= 0 || bid === -5 || (bid <= -6 && bid >= -38)) ? 0.92 : 0.18;
        positions[i3] += (targetX - positions[i3]) * lerpRate;
        positions[i3 + 1] += (targetY - positions[i3 + 1]) * lerpRate;
        positions[i3 + 2] += (targetZ - positions[i3 + 2]) * lerpRate;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;
    composer.render();
}

animate();
