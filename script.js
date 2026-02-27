// --- 1. THREE.JS SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000005); // Deep space background

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1500);
// Detect mobile device for better initial view
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
camera.position.z = isMobile ? 350 : 280; // Zoom out more to see wider solar system

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.NoToneMapping; // No tone compression — pure vivid colors
document.body.appendChild(renderer.domElement);

// --- POST-PROCESSING (BLOOM) ---
const renderScene = new THREE.RenderPass(scene, camera);
const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.45;  // Higher threshold for natural colors, sun still glows
bloomPass.strength  = 0.85;  // Moderate glow strength for natural look
bloomPass.radius    = 0.3;  // Tight glow for crisp planets

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
    gradient.addColorStop(0.05, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.15, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.25)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.07)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    // Add cross-shaped diffraction spikes for star-like look
    context.globalCompositeOperation = 'lighter';
    const spikeGrad = context.createLinearGradient(0, 64, 128, 64);
    spikeGrad.addColorStop(0, 'rgba(255,255,255,0)');
    spikeGrad.addColorStop(0.4, 'rgba(255,255,255,0.05)');
    spikeGrad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    spikeGrad.addColorStop(0.6, 'rgba(255,255,255,0.05)');
    spikeGrad.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = spikeGrad;
    context.fillRect(0, 60, 128, 8); // horizontal spike
    const spikeGradV = context.createLinearGradient(64, 0, 64, 128);
    spikeGradV.addColorStop(0, 'rgba(255,255,255,0)');
    spikeGradV.addColorStop(0.4, 'rgba(255,255,255,0.05)');
    spikeGradV.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    spikeGradV.addColorStop(0.6, 'rgba(255,255,255,0.05)');
    spikeGradV.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = spikeGradV;
    context.fillRect(60, 0, 8, 128); // vertical spike
    return new THREE.CanvasTexture(canvas);
}

// --- 2. PARTICLE SYSTEM SETUP ---
const PARTICLE_COUNT = 70000;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);
const basePositions = new Float32Array(PARTICLE_COUNT * 3);
const localOffsets = new Float32Array(PARTICLE_COUNT * 3);
const particleBodyId = new Int8Array(PARTICLE_COUNT);

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
    size: 1.8, // Increased for better planet shape definition
    vertexColors: true,
    transparent: true,
    opacity: 0.98, // More opaque for solid-looking planets
    blending: THREE.AdditiveBlending,
    map: createParticleTexture(),
    depthWrite: false
});

const particleSystem = new THREE.Points(geometry, material);
scene.add(particleSystem);

// --- 3. SOLAR SYSTEM BODY DATA (for orbital view) ---
// Deep vivid colors for maximum visibility
const BODIES = [
    { name: "Sun",     orbitR: 0,   r: 13,  speed: 0,    inc: 0,     clrs: [0xff4400, 0xff7700, 0xffbb00, 0xffdd22] },
    { name: "Mercury", orbitR: 20,  r: 1.8, speed: 0.48, inc: 0.122, clrs: [0x8c7e72, 0xa09488, 0x6e6258, 0xb0a29a] },
    { name: "Venus",   orbitR: 30,  r: 2.6, speed: 0.35, inc: 0.059, clrs: [0xffcc55, 0xeea830, 0xdd9922] },
    { name: "Earth",   orbitR: 40,  r: 3.0, speed: 0.30, inc: 0,     clrs: [0x0066ff, 0x0099ff, 0x00cc44, 0x0055ee] },
    { name: "Mars",    orbitR: 50,  r: 2.2, speed: 0.24, inc: 0.032, clrs: [0xff2200, 0xee3300, 0xdd2200, 0xcc1100] },
    { name: "Jupiter", orbitR: 85,  r: 7.5, speed: 0.13, inc: 0.023, clrs: [0xeeaa55, 0xcc7733, 0xffcc88, 0xdd8833] },
    { name: "Saturn",  orbitR: 110, r: 6.0, speed: 0.10, inc: 0.044, clrs: [0xffdd77, 0xeebb44, 0xffcc55], hasRings: true, ringClrs: [0xeedd88, 0xccaa55, 0xaa8844] },
    { name: "Uranus",  orbitR: 145, r: 4.0, speed: 0.07, inc: 0.014, clrs: [0x22ccff, 0x55eeff, 0x33bbee] },
    { name: "Neptune", orbitR: 165, r: 3.8, speed: 0.05, inc: 0.032, clrs: [0x2255ff, 0x3377ff, 0x4499ff] }
];

// Particle budgets per body in solar system view - INCREASED for better planet shapes
const BODY_BUDGETS = [8000, 1200, 1500, 1800, 1000, 5000, 4500, 2500, 2200]; // Much more detailed planets
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
const ASTEROID_BUDGET = 12000;      // Main belt (Mars–Jupiter)
const KUIPER_BUDGET = 5000;         // Kuiper belt (beyond Neptune)
const SCATTERED_BUDGET = 2500;      // Rogue/scattered asteroids throughout space
const ORBIT_LINE_BUDGET = 3000;
const STAR_BUDGET = 25300; // massive star field for realistic look

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

// --- SOLAR SYSTEM MOONS DATA (data-driven for consistent generation + animation) ---
// Every moon uses a SINGLE source of truth for orbit radius, ensuring no mismatch.
// localOffsets stores ONLY sphere-local offset (lx, ly, lz), NOT orbit position.
const SOLAR_SYSTEM_MOONS = [
    // Earth (parentIdx 3)
    { parentIdx: 3, bodyId: -6, orbitR: 5.5, r: 0.9, orbitSpeed: 0.04, spinSpeed: 0.02,
      budget: MOON_BUDGET, colors: [0xcccccc, 0xbbbbbb, 0xaaaaaa, 0xdddddd], intensity: 1.3 },
    // Mars (parentIdx 4)
    { parentIdx: 4, bodyId: -7, orbitR: 3.5, r: 0.45, orbitSpeed: 0.08, spinSpeed: 0.05,
      budget: PHOBOS_BUDGET, colors: [0x8b7355, 0x6b5d4f, 0x7a6a5a, 0x5c4f42], intensity: 1.2 },
    { parentIdx: 4, bodyId: -8, orbitR: 5.5, r: 0.35, orbitSpeed: 0.03, spinSpeed: 0.03,
      budget: DEIMOS_BUDGET, colors: [0x9a8975, 0xa89580, 0x8d7d6b, 0xb0a090], intensity: 1.2 },
    // Jupiter (parentIdx 5) - Galilean moons
    { parentIdx: 5, bodyId: -9, orbitR: 11.0, r: 1.0, orbitSpeed: 0.10, spinSpeed: 0.06,
      budget: IO_BUDGET, colors: [0xffdd44, 0xffaa22, 0xff8800, 0xffcc33], intensity: 1.4 },
    { parentIdx: 5, bodyId: -10, orbitR: 14.0, r: 0.85, orbitSpeed: 0.06, spinSpeed: 0.04,
      budget: EUROPA_BUDGET, colors: [0xeeeeff, 0xddeeff, 0xccddff, 0xffffff], intensity: 1.5 },
    { parentIdx: 5, bodyId: -11, orbitR: 18.0, r: 1.2, orbitSpeed: 0.04, spinSpeed: 0.035,
      budget: GANYMEDE_BUDGET, colors: [0x998877, 0xaa9988, 0x887766, 0xbbaa99], intensity: 1.3 },
    { parentIdx: 5, bodyId: -12, orbitR: 23.0, r: 1.1, orbitSpeed: 0.025, spinSpeed: 0.025,
      budget: CALLISTO_BUDGET, colors: [0x6b5d50, 0x7a6d5f, 0x5c4f42, 0x8a7d6f], intensity: 1.2 },
    // Saturn (parentIdx 6) - rings extend to ~r*2.15 = ~12.9, ALL moons outside
    { parentIdx: 6, bodyId: -19, orbitR: 14.0, r: 0.48, orbitSpeed: 0.12, spinSpeed: 0.05,
      budget: MIMAS_BUDGET, colors: [0xc0c0c0, 0xb0b0b0, 0xd0d0d0, 0xa8a8a8], intensity: 1.3 },
    { parentIdx: 6, bodyId: -14, orbitR: 15.5, r: 0.55, orbitSpeed: 0.08, spinSpeed: 0.045,
      budget: ENCELADUS_BUDGET, colors: [0xffffff, 0xf0f8ff, 0xe8f4ff, 0xfcfcfc], intensity: 1.6 },
    { parentIdx: 6, bodyId: -18, orbitR: 17.0, r: 0.60, orbitSpeed: 0.06, spinSpeed: 0.04,
      budget: TETHYS_BUDGET, colors: [0xfafafa, 0xf0f0f0, 0xffffff, 0xe8e8e8], intensity: 1.5 },
    { parentIdx: 6, bodyId: -17, orbitR: 19.0, r: 0.62, orbitSpeed: 0.05, spinSpeed: 0.04,
      budget: DIONE_BUDGET, colors: [0xe8e8e8, 0xd8d8d8, 0xf0f0f0, 0xc8c8c8], intensity: 1.45 },
    { parentIdx: 6, bodyId: -15, orbitR: 22.0, r: 0.75, orbitSpeed: 0.035, spinSpeed: 0.035,
      budget: RHEA_BUDGET, colors: [0xd0d0d0, 0xc8c8c8, 0xe0e0e0, 0xb8b8b8], intensity: 1.4 },
    { parentIdx: 6, bodyId: -13, orbitR: 28.0, r: 1.15, orbitSpeed: 0.025, spinSpeed: 0.03,
      budget: TITAN_BUDGET, colors: [0xdd8844, 0xcc7733, 0xee9955, 0xbb6622], intensity: 1.3 },
    { parentIdx: 6, bodyId: -16, orbitR: 38.0, r: 0.72, orbitSpeed: 0.015, spinSpeed: 0.02,
      budget: IAPETUS_BUDGET, colors: [0x3a3a3a, 0x2a2a2a, 0xe8e8e8, 0xd8d8d8], intensity: 1.3 },
    // Uranus (parentIdx 7)
    { parentIdx: 7, bodyId: -20, orbitR: 6.5, r: 0.50, orbitSpeed: 0.10, spinSpeed: 0.05,
      budget: MIRANDA_BUDGET, colors: [0x9a8b7a, 0x8a7a6a, 0xa59585, 0x7a6a5a], intensity: 1.25 },
    { parentIdx: 7, bodyId: -21, orbitR: 9.5, r: 0.85, orbitSpeed: 0.07, spinSpeed: 0.04,
      budget: ARIEL_BUDGET, colors: [0xe8e8e8, 0xf0f0f0, 0xd0d0d0, 0xc8c8c8], intensity: 1.4 },
    { parentIdx: 7, bodyId: -22, orbitR: 13.0, r: 0.85, orbitSpeed: 0.05, spinSpeed: 0.03,
      budget: UMBRIEL_BUDGET, colors: [0x4a4a4a, 0x555555, 0x3f3f3f, 0x606060], intensity: 1.2 },
    { parentIdx: 7, bodyId: -23, orbitR: 17.0, r: 1.15, orbitSpeed: 0.035, spinSpeed: 0.035,
      budget: TITANIA_BUDGET, colors: [0xa89888, 0x988878, 0xb8a898, 0x887868], intensity: 1.3 },
    { parentIdx: 7, bodyId: -24, orbitR: 23.0, r: 1.10, orbitSpeed: 0.025, spinSpeed: 0.025,
      budget: OBERON_BUDGET, colors: [0x786868, 0x685858, 0x887878, 0x584848], intensity: 1.25 },
    // Neptune (parentIdx 8) - ordered by orbit distance
    { parentIdx: 8, bodyId: -32, orbitR: 8.0, r: 0.48, orbitSpeed: 0.22, spinSpeed: 0.11,
      budget: NAIAD_BUDGET, colors: [0x444444, 0x4e4e4e, 0x3c3c3c, 0x585858], intensity: 1.1 },
    { parentIdx: 8, bodyId: -31, orbitR: 9.5, r: 0.51, orbitSpeed: 0.20, spinSpeed: 0.10,
      budget: THALASSA_BUDGET, colors: [0x464646, 0x505050, 0x3e3e3e, 0x5a5a5a], intensity: 1.15 },
    { parentIdx: 8, bodyId: -29, orbitR: 10.5, r: 0.55, orbitSpeed: 0.18, spinSpeed: 0.09,
      budget: DESPINA_BUDGET, colors: [0x484848, 0x525252, 0x404040, 0x5c5c5c], intensity: 1.15 },
    { parentIdx: 8, bodyId: -30, orbitR: 11.0, r: 0.53, orbitSpeed: 0.14, spinSpeed: 0.07,
      budget: GALATEA_BUDGET, colors: [0x4a4a4a, 0x545454, 0x424242, 0x5e5e5e], intensity: 1.15 },
    { parentIdx: 8, bodyId: -28, orbitR: 12.5, r: 0.60, orbitSpeed: 0.15, spinSpeed: 0.08,
      budget: LARISSA_BUDGET, colors: [0x505050, 0x5a5a5a, 0x484848, 0x606060], intensity: 1.15 },
    { parentIdx: 8, bodyId: -25, orbitR: 15.0, r: 1.20, orbitSpeed: -0.04, spinSpeed: 0.04,
      budget: TRITON_BUDGET, colors: [0xf5d5d5, 0xedc5c5, 0xffdada, 0xe8c0c0], intensity: 1.45 },
    { parentIdx: 8, bodyId: -33, orbitR: 18.0, r: 0.35, orbitSpeed: 0.10, spinSpeed: 0.05,
      budget: HIPPOCAMP_BUDGET, colors: [0x606060, 0x6a6a6a, 0x585858, 0x707070], intensity: 1.1 },
    { parentIdx: 8, bodyId: -26, orbitR: 22.0, r: 0.95, orbitSpeed: 0.12, spinSpeed: 0.06,
      budget: PROTEUS_BUDGET, colors: [0x3a3a3a, 0x454545, 0x303030, 0x505050], intensity: 1.1 },
    { parentIdx: 8, bodyId: -27, orbitR: 28.0, r: 0.58, orbitSpeed: 0.008, spinSpeed: 0.01,
      budget: NEREID_BUDGET, colors: [0x888888, 0x7a7a7a, 0x959595, 0x6c6c6c], intensity: 1.2 },
    { parentIdx: 8, bodyId: -34, orbitR: 32.0, r: 0.40, orbitSpeed: 0.005, spinSpeed: 0.006,
      budget: HALIMEDE_BUDGET, colors: [0x707070, 0x7a7a7a, 0x686868, 0x808080], intensity: 1.1 },
    { parentIdx: 8, bodyId: -35, orbitR: 36.0, r: 0.38, orbitSpeed: 0.004, spinSpeed: 0.005,
      budget: SAO_BUDGET, colors: [0x6e6e6e, 0x787878, 0x666666, 0x7e7e7e], intensity: 1.1 },
    { parentIdx: 8, bodyId: -36, orbitR: 40.0, r: 0.36, orbitSpeed: 0.005, spinSpeed: 0.006,
      budget: LAOMEDEIA_BUDGET, colors: [0x6c6c6c, 0x767676, 0x646464, 0x7c7c7c], intensity: 1.1 },
    { parentIdx: 8, bodyId: -37, orbitR: 44.0, r: 0.36, orbitSpeed: 0.003, spinSpeed: 0.004,
      budget: PSAMATHE_BUDGET, colors: [0x6a6a6a, 0x747474, 0x626262, 0x7a7a7a], intensity: 1.1 },
    { parentIdx: 8, bodyId: -38, orbitR: 50.0, r: 0.38, orbitSpeed: 0.002, spinSpeed: 0.003,
      budget: NESO_BUDGET, colors: [0x686868, 0x727272, 0x606060, 0x787878], intensity: 1.1 },
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
    { name: "Sun",     radius: 50, main: 0xff5500, second: 0xffbb00, third: 0xff2200 },
    { name: "Mercury", radius: 15, main: 0x8c7e72, second: 0xa09488, third: 0x6e6258 },
    { name: "Venus",   radius: 22, main: 0xffcc55, second: 0xeea830 },
    { name: "Earth",   radius: 25, main: 0x0066ff, second: 0x00cc44, moons: [
        { name: "Moon", orbitR: 42, r: 4.5, speed: 0.04, main: 0xADA89E, second: 0x8C8478, third: 0xC2BDB5, particles: 1800 }
    ]},
    { name: "Mars",    radius: 18, main: 0xff2200, second: 0xee3300, moons: [
        { name: "Phobos", orbitR: 28, r: 2.2, speed: 0.08, main: 0x6B5B4D, second: 0x544838, third: 0x7A6A58, particles: 800 },
        { name: "Deimos", orbitR: 40, r: 1.8, speed: 0.03, main: 0x7A6850, second: 0x635540, third: 0x8B7960, particles: 600 }
    ]},
    { name: "Jupiter", radius: 45, main: 0xeeaa55, second: 0xcc7733, third: 0xffcc88, moons: [
        { name: "Io",       orbitR: 62, r: 3.0, speed: 0.10, main: 0xE8D040, second: 0xE09828, third: 0xF8F0C0, particles: 1000 },
        { name: "Europa",   orbitR: 76, r: 2.5, speed: 0.06, main: 0xF0E8D0, second: 0xC4AA78, third: 0xE0D4B8, particles: 900 },
        { name: "Ganymede", orbitR: 92, r: 3.5, speed: 0.04, main: 0x908474, second: 0xB8AC9C, third: 0x685C4C, particles: 1200 },
        { name: "Callisto", orbitR: 115, r: 3.2, speed: 0.025, main: 0x4A3C30, second: 0x5C4E42, third: 0x3A2C22, particles: 1100 }
    ]},
    { name: "Saturn",  radius: 38, main: 0xffdd77, hasRings: true, ringClr: 0xeedd88, moons: [
        { name: "Mimas",     orbitR: 100, r: 1.5, speed: 0.12, main: 0xD4D0C8, second: 0xC0BCB4, third: 0xDEDAD2, particles: 500 },
        { name: "Enceladus", orbitR: 112, r: 1.8, speed: 0.08, main: 0xFCFCFA, second: 0xF0F6FF, third: 0xE8F0F8, particles: 600 },
        { name: "Tethys",    orbitR: 124, r: 2.0, speed: 0.06, main: 0xEAE6E0, second: 0xDCD8D2, third: 0xF0ECE6, particles: 650 },
        { name: "Dione",     orbitR: 136, r: 2.0, speed: 0.05, main: 0xDCD8D0, second: 0xC4C0B8, third: 0xE4E0D8, particles: 650 },
        { name: "Rhea",      orbitR: 150, r: 2.3, speed: 0.035, main: 0xD0CCC4, second: 0xC0BCB4, third: 0xDCD8D0, particles: 750 },
        { name: "Titan",     orbitR: 175, r: 3.5, speed: 0.025, main: 0xCC8030, second: 0xE09838, third: 0xA86820, particles: 1200 },
        { name: "Iapetus",   orbitR: 210, r: 2.2, speed: 0.015, main: 0x28201A, second: 0xE0D8D0, third: 0x1A1410, particles: 700 }
    ]},
    { name: "Uranus",  radius: 30, main: 0x22ccff, second: 0x55eeff, moons: [
        { name: "Miranda", orbitR: 44, r: 1.8, speed: 0.10, main: 0x908880, second: 0x706860, third: 0xB0A8A0, particles: 550 },
        { name: "Ariel",   orbitR: 55, r: 2.5, speed: 0.07, main: 0xBCB4AC, second: 0xCCC4BC, third: 0xA49C94, particles: 800 },
        { name: "Umbriel", orbitR: 66, r: 2.5, speed: 0.05, main: 0x444038, second: 0x545048, third: 0x363228, particles: 800 },
        { name: "Titania", orbitR: 80, r: 3.2, speed: 0.035, main: 0x887C74, second: 0x9C9088, third: 0x746860, particles: 1000 },
        { name: "Oberon",  orbitR: 96, r: 3.0, speed: 0.025, main: 0x6C6058, second: 0x7C6450, third: 0x5C5048, particles: 950 }
    ]},
    { name: "Neptune", radius: 28, main: 0x2255ff, second: 0x3377ff, moons: [
        { name: "Naiad",     orbitR: 38, r: 1.2, speed: 0.22, main: 0x383634, second: 0x424040, third: 0x2E2C2A, particles: 350 },
        { name: "Thalassa",  orbitR: 42, r: 1.3, speed: 0.20, main: 0x3A3836, second: 0x444242, third: 0x302E2C, particles: 350 },
        { name: "Despina",   orbitR: 47, r: 1.4, speed: 0.18, main: 0x3E3C3A, second: 0x484644, third: 0x343230, particles: 400 },
        { name: "Galatea",   orbitR: 52, r: 1.4, speed: 0.14, main: 0x3C3A38, second: 0x464442, third: 0x32302E, particles: 400 },
        { name: "Larissa",   orbitR: 58, r: 1.5, speed: 0.15, main: 0x464442, second: 0x504E4C, third: 0x3C3A38, particles: 450 },
        { name: "Hippocamp", orbitR: 65, r: 1.0, speed: 0.10, main: 0x343230, second: 0x3E3C3A, third: 0x2A2826, particles: 300 },
        { name: "Proteus",   orbitR: 74, r: 2.5, speed: 0.12, main: 0x3E3C38, second: 0x484644, third: 0x343230, particles: 800 },
        { name: "Triton",    orbitR: 90, r: 3.2, speed: -0.04, main: 0xE4CCC0, second: 0xD4B8A8, third: 0xF0DED4, particles: 1100 },
        { name: "Nereid",    orbitR: 112, r: 1.8, speed: 0.008, main: 0x646060, second: 0x747070, third: 0x545050, particles: 500 },
        { name: "Halimede",  orbitR: 132, r: 1.2, speed: 0.005, main: 0x585858, second: 0x686868, third: 0x484848, particles: 300 },
        { name: "Sao",       orbitR: 148, r: 1.2, speed: 0.004, main: 0x565454, second: 0x666262, third: 0x484646, particles: 300 },
        { name: "Laomedeia", orbitR: 162, r: 1.0, speed: 0.005, main: 0x545050, second: 0x646060, third: 0x464242, particles: 280 },
        { name: "Psamathe",  orbitR: 176, r: 1.0, speed: 0.003, main: 0x525050, second: 0x626060, third: 0x444242, particles: 280 },
        { name: "Neso",      orbitR: 192, r: 1.2, speed: 0.002, main: 0x505050, second: 0x606060, third: 0x424242, particles: 300 }
    ]}
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
        ? r * (0.82 + Math.random() * 0.18)   // outer shell 82-100% radius
        : r * Math.cbrt(Math.random()) * 0.82; // interior fill
    return {
        lx: rd * Math.sin(ph) * Math.cos(th),
        ly: rd * Math.sin(ph) * Math.sin(th),
        lz: rd * Math.cos(ph),
        ph, th
    };
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
                // Volumetric sphere: 60% outer shell + 40% interior fill
                const { lx, ly, lz, ph, th } = randomInSphere(body.r, 0.6);
                localOffsets[i3]=lx; localOffsets[i3+1]=ly; localOffsets[i3+2]=lz;
                basePositions[i3]=ox+lx; basePositions[i3+1]=oy+ly; basePositions[i3+2]=oz+lz;
                particleBodyId[idx] = b;
                const c = new THREE.Color(body.clrs[Math.floor(Math.random()*body.clrs.length)]);
                
                if (b > 0) {
                    const lat = ph;
                    const lon = th;
                    const latBand = Math.sin(lat * 12 + lon * 0.3) * 0.08 + Math.sin(lat * 6) * 0.06;
                    const lonStreak = Math.sin(lon * 15 + lat * 2) * 0.05;
                    const craterNoise = (Math.random() > 0.88) ? -0.18 : (Math.random() - 0.5) * 0.06;
                    const fineDetail = (Math.random() - 0.5) * 0.04;
                    const polarEffect = Math.abs(Math.cos(lat)) * 0.08 * (Math.random() > 0.5 ? 1 : -1);
                    const totalDetail = latBand + lonStreak + craterNoise + fineDetail + polarEffect;
                    c.r = Math.max(0, Math.min(1, c.r + totalDetail));
                    c.g = Math.max(0, Math.min(1, c.g + totalDetail));
                    c.b = Math.max(0, Math.min(1, c.b + totalDetail));
                } else {
                    c.r+=(Math.random()-0.5)*0.08; c.g+=(Math.random()-0.5)*0.08; c.b+=(Math.random()-0.5)*0.06;
                }
                
                let intensity = (b === 0) ? 4.5 : 1.4;
                colors[i3]=Math.max(0, c.r * intensity); 
                colors[i3+1]=Math.max(0, c.g * intensity); 
                colors[i3+2]=Math.max(0, c.b * intensity);
                idx++;
            }
            // Saturn ring tilt: 26.7 degrees from ecliptic
            const SATURN_RING_TILT = 26.7 * Math.PI / 180;
            const cosTilt = Math.cos(SATURN_RING_TILT);
            const sinTilt = Math.sin(SATURN_RING_TILT);
            for (let p = 0; p < ringN; p++) {
                const i3 = idx * 3;
                const ra = Math.random() * Math.PI * 2;
                const rr = body.r * 1.3 + Math.random() * body.r * 0.85;
                // Generate flat ring, then tilt
                const flatX = Math.cos(ra)*rr;
                const flatY = (Math.random()-0.5)*0.8;
                const flatZ = Math.sin(ra)*rr;
                // Store FLAT coordinates in localOffsets (for correct tilted rotation)
                localOffsets[i3]=flatX; localOffsets[i3+1]=flatY; localOffsets[i3+2]=flatZ;
                // Apply tilt for initial basePositions (rotate around X axis)
                const tiltedY = flatY * cosTilt - flatZ * sinTilt;
                const tiltedZ = flatY * sinTilt + flatZ * cosTilt;
                basePositions[i3]=ox+flatX; basePositions[i3+1]=oy+tiltedY; basePositions[i3+2]=oz+tiltedZ;
                particleBodyId[idx] = -5; // Special ID for Saturn's rings
                const c = new THREE.Color(body.ringClrs[Math.floor(Math.random()*body.ringClrs.length)]);
                colors[i3]=c.r * 1.2; colors[i3+1]=c.g * 1.2; colors[i3+2]=c.b * 1.2;
                idx++;
            }
        } else {
            for (let p = 0; p < budget; p++) {
                const i3 = idx * 3;
                // Volumetric sphere: 60% outer shell + 40% interior fill
                const { lx, ly, lz, ph, th } = randomInSphere(body.r, 0.6);
                localOffsets[i3]=lx; localOffsets[i3+1]=ly; localOffsets[i3+2]=lz;
                basePositions[i3]=ox+lx; basePositions[i3+1]=oy+ly; basePositions[i3+2]=oz+lz;
                particleBodyId[idx] = b;
                const c = new THREE.Color(body.clrs[Math.floor(Math.random()*body.clrs.length)]);
                
                if (b > 0) {
                    const lat = ph;
                    const lon = th;
                    const latBand = Math.sin(lat * 12 + lon * 0.3) * 0.08 + Math.sin(lat * 6) * 0.06;
                    const lonStreak = Math.sin(lon * 15 + lat * 2) * 0.05;
                    const craterNoise = (Math.random() > 0.88) ? -0.18 : (Math.random() - 0.5) * 0.06;
                    const fineDetail = (Math.random() - 0.5) * 0.04;
                    const polarEffect = Math.abs(Math.cos(lat)) * 0.08 * (Math.random() > 0.5 ? 1 : -1);
                    const totalDetail = latBand + lonStreak + craterNoise + fineDetail + polarEffect;
                    c.r = Math.max(0, Math.min(1, c.r + totalDetail));
                    c.g = Math.max(0, Math.min(1, c.g + totalDetail));
                    c.b = Math.max(0, Math.min(1, c.b + totalDetail));
                } else {
                    c.r+=(Math.random()-0.5)*0.08; c.g+=(Math.random()-0.5)*0.08; c.b+=(Math.random()-0.5)*0.06;
                }
                
                let intensity = (b === 0) ? 4.5 : 1.4;
                colors[i3]=Math.max(0, c.r * intensity); 
                colors[i3+1]=Math.max(0, c.g * intensity); 
                colors[i3+2]=Math.max(0, c.b * intensity);
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
            // Volumetric sphere for proper 3D (70% surface, 30% interior)
            const { lx, ly, lz } = randomInSphere(moon.r, 0.7);

            // CRITICAL: localOffsets = sphere offset ONLY (not moon orbit position!)
            localOffsets[i3]   = lx;
            localOffsets[i3+1] = ly;
            localOffsets[i3+2] = lz;

            // basePositions = parent planet pos + moon orbit pos + sphere offset
            basePositions[i3]   = parentX + moonCX + lx;
            basePositions[i3+1] = parentY + ly;
            basePositions[i3+2] = parentZ + moonCZ + lz;

            particleBodyId[idx] = moon.bodyId;

            // Color with surface detail
            const c = new THREE.Color(moon.colors[Math.floor(Math.random() * moon.colors.length)]);
            const craterNoise = (Math.random() > 0.87) ? -0.2 : (Math.random() - 0.5) * 0.08;
            const fineDetail = (Math.random() - 0.5) * 0.05;
            c.r = Math.max(0, Math.min(1, c.r + craterNoise + fineDetail));
            c.g = Math.max(0, Math.min(1, c.g + craterNoise + fineDetail));
            c.b = Math.max(0, Math.min(1, c.b + craterNoise + fineDetail));
            colors[i3]   = c.r * moon.intensity;
            colors[i3+1] = c.g * moon.intensity;
            colors[i3+2] = c.b * moon.intensity;
            idx++;
        }
    }

        // --- MAIN Asteroid Belt (between Mars r=50 and Jupiter r=85) ---
    for (let p = 0; p < ASTEROID_BUDGET; p++) {
        const i3 = idx * 3;
        const a = Math.random() * Math.PI * 2;
        const r = 57 + Math.random() * 20;
        const clump = Math.sin(a * 5) * 3 + Math.sin(a * 11) * 1.5; // denser clumping
        const spread = (Math.random() > 0.85) ? 9.0 : 2.0;
        const lx = Math.cos(a) * (r + clump) + (Math.random()-0.5)*spread;
        const ly = (Math.random()-0.5)*5.0;
        const lz = Math.sin(a) * (r + clump) + (Math.random()-0.5)*spread;
        localOffsets[i3]=lx; localOffsets[i3+1]=ly; localOffsets[i3+2]=lz;
        basePositions[i3]=lx; basePositions[i3+1]=ly; basePositions[i3+2]=lz;
        particleBodyId[idx] = -2;
        const type = Math.random();
        let cr, cg, cb;
        if (type < 0.3) { cr = 0.8+Math.random()*0.2; cg = 0.4+Math.random()*0.2; cb = 0.1+Math.random()*0.1; }
        else if (type < 0.6) { cr = 0.9+Math.random()*0.1; cg = 0.7+Math.random()*0.2; cb = 0.2+Math.random()*0.2; }
        else if (type < 0.8) { cr = 0.6+Math.random()*0.2; cg = 0.4+Math.random()*0.2; cb = 0.2+Math.random()*0.1; }
        else { const g = 0.5+Math.random()*0.3; cr = g+0.1; cg = g; cb = g-0.1; }
        colors[i3]=cr*2.5; colors[i3+1]=cg*2.5; colors[i3+2]=cb*2.5; // Natural asteroid colors
        sizes[idx] = Math.random() > 0.95 ? 3.0+Math.random()*2.5 : 1.0+Math.random()*0.8;
        idx++;
    }

    // --- KUIPER BELT (beyond Neptune r=165) ---
    for (let p = 0; p < KUIPER_BUDGET; p++) {
        const i3 = idx * 3;
        const a = Math.random() * Math.PI * 2;
        const r = 175 + Math.random() * 45; // 175–220 range
        const clump = Math.sin(a * 3) * 5;
        const spread = (Math.random() > 0.8) ? 12.0 : 3.5;
        const lx = Math.cos(a) * (r + clump) + (Math.random()-0.5)*spread;
        const ly = (Math.random()-0.5)*8.0; // thicker plane than main belt
        const lz = Math.sin(a) * (r + clump) + (Math.random()-0.5)*spread;
        localOffsets[i3]=lx; localOffsets[i3+1]=ly; localOffsets[i3+2]=lz;
        basePositions[i3]=lx; basePositions[i3+1]=ly; basePositions[i3+2]=lz;
        particleBodyId[idx] = -3; // -3 = Kuiper belt object
        // Kuiper belt objects are icy – blue-grey, white, light cyan
        const kt = Math.random();
        let cr, cg, cb;
        if (kt < 0.4) { cr=0.6+Math.random()*0.3; cg=0.7+Math.random()*0.3; cb=0.9+Math.random()*0.1; } // icy blue
        else if (kt < 0.7) { cr=0.7+Math.random()*0.2; cg=0.75+Math.random()*0.2; cb=0.8+Math.random()*0.2; } // grey-white
        else if (kt < 0.88){ cr=0.5+Math.random()*0.3; cg=0.8+Math.random()*0.2; cb=0.9+Math.random()*0.1; } // cyan-ice
        else { cr=0.9+Math.random()*0.1; cg=0.9+Math.random()*0.1; cb=1.0; } // pure white (Pluto-like)
        colors[i3]=cr*2.2; colors[i3+1]=cg*2.2; colors[i3+2]=cb*2.2; // Natural Kuiper colors
        sizes[idx] = Math.random() > 0.97 ? 2.5+Math.random()*2.0 : 0.8+Math.random()*0.7;
        idx++;
    }

    // --- DEEP SPACE ASTEROIDS (far outside the solar system, among the stars) ---
    for (let p = 0; p < SCATTERED_BUDGET; p++) {
        const i3 = idx * 3;
        // Placed deep in space beyond the solar system (radius 180–450)
        // Mixed at all angles, inclinations — fully 3D scatter like a real starfield
        const dist = 180 + Math.random() * 270;
        const a    = Math.random() * Math.PI * 2;
        const elev = (Math.random() - 0.5) * Math.PI; // full 3D sphere
        const lx = dist * Math.cos(elev) * Math.cos(a);
        const ly = dist * Math.sin(elev);
        const lz = dist * Math.cos(elev) * Math.sin(a);
        localOffsets[i3]=lx; localOffsets[i3+1]=ly; localOffsets[i3+2]=lz;
        basePositions[i3]=lx; basePositions[i3+1]=ly; basePositions[i3+2]=lz;
        particleBodyId[idx] = -2;
        // Bright glowing colors — visible like stars in deep space
        // Rocky orange, reddish, golden, icy-blue, metallic white
        const rt = Math.random();
        let cr, cg, cb;
        if (rt < 0.2)       { cr=1.0; cg=0.55+Math.random()*0.25; cb=0.1+Math.random()*0.15; } // orange-red molten rock
        else if (rt < 0.4)  { cr=1.0; cg=0.8+Math.random()*0.2;  cb=0.3+Math.random()*0.2;  } // bright gold / iron
        else if (rt < 0.6)  { cr=0.6+Math.random()*0.3; cg=0.75+Math.random()*0.2; cb=1.0;  } // icy blue comet
        else if (rt < 0.75) { cr=1.0; cg=1.0; cb=0.8+Math.random()*0.2;              } // bright white (metallic)
        else if (rt < 0.88) { cr=0.9+Math.random()*0.1; cg=0.4+Math.random()*0.2; cb=0.2+Math.random()*0.15; } // red dwarf rocky
        else                { const g=0.7+Math.random()*0.3; cr=g; cg=g; cb=g;      } // silver-grey
        // Bright enough to be visible with natural colors
        const brightness = 2.8 + Math.random() * 1.5; // Natural brightness, visible colors
        colors[i3]=cr*brightness; colors[i3+1]=cg*brightness; colors[i3+2]=cb*brightness;
        // Varied sizes — some are large enough to look like small glowing bodies
        sizes[idx] = Math.random() > 0.88 ? 2.5 + Math.random() * 3.5 : 1.2 + Math.random() * 1.3;
        idx++;
    }

    // --- Orbit Path Lines ---
    const PER_ORBIT = Math.floor(ORBIT_LINE_BUDGET / 8);
    for (let o = 0; o < 8; o++) {
        const oR = BODIES[o+1].orbitR;
        for (let p = 0; p < PER_ORBIT; p++) {
            if (idx >= PARTICLE_COUNT) break;
            const i3 = idx * 3;
            const a = (p / PER_ORBIT) * Math.PI * 2 + Math.random()*0.01;
            const lx = Math.cos(a)*oR;
            const ly = (Math.random()-0.5)*0.2;
            const lz = Math.sin(a)*oR;
            localOffsets[i3]=lx; localOffsets[i3+1]=ly; localOffsets[i3+2]=lz;
            basePositions[i3]=lx; basePositions[i3+1]=ly; basePositions[i3+2]=lz;
            particleBodyId[idx] = -1;
            colors[i3]=0.4; colors[i3+1]=0.6; colors[i3+2]=1.0; // Bright blue/white orbit lines
            idx++;
        }
    }

    // --- Background Stars - Realistic Star Field ---
    // Layer 1: Massive bright stars (very few, very prominent)
    const MEGA_STAR_COUNT = 20;
    // Layer 2: Bright visible stars (with color variety like real night sky)
    const BRIGHT_STAR_COUNT = 200;
    // Layer 3: Medium stars (many, visible)
    const MEDIUM_STAR_COUNT = 800;
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
            sr = 120 + Math.random() * 180; // Closest, most prominent
        } else if (isBright) {
            sr = 150 + Math.random() * 250;
        } else if (isMedium) {
            sr = 200 + Math.random() * 300;
        } else {
            sr = 200 + Math.random() * 500; // Far away dust
        }
        
        const st = Math.random() * Math.PI * 2;
        const sp = Math.random() * Math.PI;
        const lx = sr * Math.sin(sp) * Math.cos(st);
        const ly = sr * Math.sin(sp) * Math.sin(st);
        const lz = sr * Math.cos(sp);
        localOffsets[i3] = lx; localOffsets[i3+1] = ly; localOffsets[i3+2] = lz;
        basePositions[i3] = lx; basePositions[i3+1] = ly; basePositions[i3+2] = lz;
        
        if (isMega) {
            // Mega stars - bright white/blue with huge glow
            particleBodyId[idx] = -4;
            const t = Math.random();
            let cr, cg, cb;
            if (t < 0.4) { cr=1.0; cg=1.0; cb=1.0; } // pure white
            else if (t < 0.6) { cr=0.8; cg=0.9; cb=1.0; } // blue-white
            else if (t < 0.8) { cr=1.0; cg=0.95; cb=0.7; } // warm white
            else { cr=1.0; cg=0.6; cb=0.3; } // orange giant
            colors[i3] = cr * 5.5; colors[i3+1] = cg * 5.5; colors[i3+2] = cb * 5.5; // Natural star colors
            sizes[idx] = 5.0 + Math.random() * 4.0;
        } else if (isBright) {
            // Bright stars - various real star colors
            particleBodyId[idx] = -4;
            const t = Math.random();
            let cr, cg, cb;
            if (t < 0.25) { cr=1.0; cg=1.0; cb=1.0; }       // White (A-type)
            else if (t < 0.45) { cr=0.7; cg=0.8; cb=1.0; }   // Blue-white (B-type)
            else if (t < 0.60) { cr=1.0; cg=0.95; cb=0.8; }   // Yellow-white (F-type)
            else if (t < 0.75) { cr=1.0; cg=0.85; cb=0.5; }   // Yellow (G-type, like Sun)
            else if (t < 0.85) { cr=1.0; cg=0.7; cb=0.4; }    // Orange (K-type)
            else if (t < 0.95) { cr=1.0; cg=0.4; cb=0.3; }    // Red (M-type)
            else { cr=0.5; cg=0.6; cb=1.0; }                   // Deep blue (O-type)
            colors[i3] = cr * 3.5; colors[i3+1] = cg * 3.5; colors[i3+2] = cb * 3.5; // Natural star colors
            sizes[idx] = 3.0 + Math.random() * 3.0;
        } else if (isMedium) {
            // Medium stars - clearly visible points
            particleBodyId[idx] = -4;
            const t = Math.random();
            let cr, cg, cb;
            if (t < 0.5) { cr=1.0; cg=1.0; cb=1.0; }
            else if (t < 0.7) { cr=0.8; cg=0.9; cb=1.0; }
            else if (t < 0.85) { cr=1.0; cg=0.9; cb=0.7; }
            else { cr=1.0; cg=0.6; cb=0.4; }
            colors[i3] = cr * 2.2; colors[i3+1] = cg * 2.2; colors[i3+2] = cb * 2.2; // Natural star colors
            sizes[idx] = 2.0 + Math.random() * 1.5;
        } else {
            // Background star dust - tiny but visible, fills the sky
            particleBodyId[idx] = -1;
            const brightness = 0.6 + Math.random() * 1.2; // Natural star dust brightness
            // Slight color tint for realism
            const tint = Math.random();
            if (tint < 0.6) {
                colors[i3] = brightness; colors[i3+1] = brightness; colors[i3+2] = brightness;
            } else if (tint < 0.8) {
                colors[i3] = brightness * 0.8; colors[i3+1] = brightness * 0.85; colors[i3+2] = brightness;
            } else {
                colors[i3] = brightness; colors[i3+1] = brightness * 0.9; colors[i3+2] = brightness * 0.8;
            }
            sizes[idx] = 0.5 + Math.random() * 1.0;
        }
        
        idx++;
        starIdx++;
    }

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
    const STAR_PARTICLES = Math.floor(PARTICLE_COUNT * 0.25);
    const AVAILABLE_FOR_BODIES = PARTICLE_COUNT - STAR_PARTICLES;
    const PLANET_PARTICLES = AVAILABLE_FOR_BODIES - totalMoonParticles;

    let idx = 0;

    // --- Generate planet sphere ---
    const planetEnd = view.hasRings ? Math.floor(PLANET_PARTICLES * 0.7) : PLANET_PARTICLES;
    for (let i = 0; i < planetEnd && idx < PARTICLE_COUNT; i++) {
        const i3 = idx * 3;
        particleBodyId[idx] = -1;

        const total = planetEnd;
        const phi   = Math.acos(-1 + (2 * i) / total);
        const theta = Math.sqrt(total * Math.PI) * phi;

        const x = view.radius * Math.cos(theta) * Math.sin(phi);
        const y = view.radius * Math.sin(theta) * Math.sin(phi);
        const z = view.radius * Math.cos(phi);

        const noise = 1 + (Math.random() - 0.5) * 0.03;
        basePositions[i3]     = x * noise;
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
        
        const lat = phi;
        const lon = theta;
        const latBand = Math.sin(lat * 10 + lon * 0.2) * 0.09;
        const craterNoise = (Math.random() > 0.86) ? -0.2 : (Math.random() - 0.5) * 0.07;
        const fineDetail = (Math.random() - 0.5) * 0.05;
        const polarEffect = Math.abs(Math.cos(lat)) * 0.1 * (Math.random() > 0.5 ? 1 : -1);
        
        const totalDetail = latBand + craterNoise + fineDetail + polarEffect;
        pColor.r = Math.max(0, Math.min(1, pColor.r + totalDetail));
        pColor.g = Math.max(0, Math.min(1, pColor.g + totalDetail));
        pColor.b = Math.max(0, Math.min(1, pColor.b + totalDetail));
        
        let intensity = (view.name === "Sun") ? 4.5 : 1.6;
        colors[i3] = pColor.r * intensity; 
        colors[i3 + 1] = pColor.g * intensity; 
        colors[i3 + 2] = pColor.b * intensity;
        sizes[idx] = 1.0;
        idx++;
    }

    // --- Generate Saturn-like rings ---
    if (view.hasRings) {
        const ringCount = PLANET_PARTICLES - planetEnd;
        for (let i = 0; i < ringCount && idx < PARTICLE_COUNT; i++) {
            const i3 = idx * 3;
            particleBodyId[idx] = -1;
            const angle = Math.random() * Math.PI * 2;
            const r = view.radius * 1.3 + Math.random() * view.radius * 1.1;
            basePositions[i3]     = Math.cos(angle) * r;
            basePositions[i3 + 1] = (Math.random() - 0.5) * 2;
            basePositions[i3 + 2] = Math.sin(angle) * r;
            localOffsets[i3] = basePositions[i3];
            localOffsets[i3 + 1] = basePositions[i3 + 1];
            localOffsets[i3 + 2] = basePositions[i3 + 2];
            const ringColor = new THREE.Color(view.ringClr || 0xaaaaaa).lerp(new THREE.Color(0x555555), Math.random());
            colors[i3] = ringColor.r * 1.5; colors[i3+1] = ringColor.g * 1.5; colors[i3+2] = ringColor.b * 1.5;
            sizes[idx] = 1.0;
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

            basePositions[i3]     = moonCenterX + lx;
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

            // Surface details
            const lat = phi;
            const craterDetail = (Math.random() > 0.85) ? -0.2 : (Math.random() - 0.5) * 0.08;
            const fineDetail = (Math.random() - 0.5) * 0.06;
            const totalDetail = craterDetail + fineDetail;
            mColor.r = Math.max(0, Math.min(1, mColor.r + totalDetail));
            mColor.g = Math.max(0, Math.min(1, mColor.g + totalDetail));
            mColor.b = Math.max(0, Math.min(1, mColor.b + totalDetail));

            const intensity = 1.4;
            colors[i3] = mColor.r * intensity;
            colors[i3 + 1] = mColor.g * intensity;
            colors[i3 + 2] = mColor.b * intensity;
            sizes[idx] = 1.0;
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
            basePositions[i3]     = Math.cos(a) * moons[m].orbitR;
            basePositions[i3 + 1] = (Math.random() - 0.5) * 0.15;
            basePositions[i3 + 2] = Math.sin(a) * moons[m].orbitR;
            localOffsets[i3] = basePositions[i3];
            localOffsets[i3 + 1] = basePositions[i3 + 1];
            localOffsets[i3 + 2] = basePositions[i3 + 2];
            particleBodyId[idx] = -1;
            colors[i3] = 0.25; colors[i3+1] = 0.35; colors[i3+2] = 0.55;
            sizes[idx] = 0.6;
            idx++;
        }
    }

    // --- Background stars ---
    while (idx < PARTICLE_COUNT) {
        const i3 = idx * 3;
        particleBodyId[idx] = -1;
        const sr = 200 + Math.random()*400;
        const st = Math.random()*Math.PI*2;
        const sp = Math.random()*Math.PI;
        basePositions[i3]   = sr*Math.sin(sp)*Math.cos(st);
        basePositions[i3+1] = sr*Math.sin(sp)*Math.sin(st);
        basePositions[i3+2] = sr*Math.cos(sp);
        localOffsets[i3] = basePositions[i3];
        localOffsets[i3+1] = basePositions[i3+1];
        localOffsets[i3+2] = basePositions[i3+2];
        const brightness = 0.3 + Math.random()*0.7;
        colors[i3]=brightness; colors[i3+1]=brightness;
        colors[i3+2]=brightness*(0.9+Math.random()*0.1);
        sizes[idx] = 0.5 + Math.random() * 1.0;
        idx++;
    }

    geometry.attributes.color.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;
    
    document.getElementById('planet-name').innerText = view.name;
}

// --- 7. VIEW SWITCHING ---
function switchView(index) {
    currentViewIndex = index;
    const view = PLANET_VIEWS[index];
    if (view.isSolarSystem) {
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
            basePositions[i3]     = ox + localOffsets[i3];
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

if (isMobile) {
    // Hide webcam on mobile as camera might not be accessible/needed
    document.getElementById('webcam').style.display = 'none';
    
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
            // Double tap to cycle views
            const now = Date.now();
            if (now - lastTapTime < 300) {
                currentViewIndex = (currentViewIndex + 1) % PLANET_VIEWS.length;
                switchView(currentViewIndex);
            }
            lastTapTime = now;
        }
    });
}

// --- 9C. GYROSCOPE / DEVICE ORIENTATION (MOBILE CAMERA ROTATION) ---
let gyroEnabled   = false;
let gyroBaseAlpha = null, gyroBaseBeta = null, gyroBaseGamma = null;
let gyroRotationX = 0, gyroRotationY = 0;

function _activateGyro() {
    gyroEnabled   = true;
    gyroBaseAlpha = null; // will be set on next sensor reading
    const btn = document.getElementById('gyro-btn');
    if (btn) {
        btn.textContent = '✅ Gyro Active — Tilt to Rotate';
        btn.style.background = 'rgba(0, 200, 100, 0.25)';
        setTimeout(() => { if (btn) btn.style.display = 'none'; }, 2000);
    }
}

if (isMobile && typeof DeviceOrientationEvent !== 'undefined') {

    // iOS 13+ requires an explicit user-gesture permission request
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const btn = document.createElement('button');
        btn.id = 'gyro-btn';
        btn.textContent = '🌐 Enable Gyro Rotation';
        Object.assign(btn.style, {
            position:       'fixed',
            bottom:         '80px',
            left:           '50%',
            transform:      'translateX(-50%)',
            zIndex:         '9999',
            padding:        '10px 22px',
            background:     'rgba(255,255,255,0.12)',
            color:          'white',
            border:         '1px solid rgba(255,255,255,0.35)',
            borderRadius:   '24px',
            fontSize:       '14px',
            backdropFilter: 'blur(8px)',
            cursor:         'pointer',
            whiteSpace:     'nowrap'
        });
        btn.addEventListener('click', () => {
            DeviceOrientationEvent.requestPermission()
                .then(response => { if (response === 'granted') _activateGyro(); })
                .catch(console.error);
        });
        document.body.appendChild(btn);
    } else {
        // Android & non-iOS Safari — permission not required, enable automatically
        _activateGyro();
    }

    window.addEventListener('deviceorientation', (e) => {
        if (!gyroEnabled || e.beta === null || e.gamma === null) return;

        // Capture neutral orientation on first reading so current phone angle = zero
        if (gyroBaseAlpha === null) {
            gyroBaseAlpha = e.alpha || 0;
            gyroBaseBeta  = e.beta  || 0;
            gyroBaseGamma = e.gamma || 0;
        }

        // beta  → front/back tilt  → X rotation (pitch)
        // gamma → left/right tilt  → Y rotation (yaw)
        const sensitivity = 0.028;
        gyroRotationX = -(e.beta  - gyroBaseBeta)  * sensitivity;
        gyroRotationY =  (e.gamma - gyroBaseGamma) * sensitivity;
    });
}

// --- 9B. MEDIAPIPE HAND TRACKING ---
// Left hand thumbs up = previous planet, Right hand thumbs up = next planet
const videoElement = document.getElementById('webcam');
let handRotation    = { x: 0, y: 0 };
let handVelocity    = { x: 0, y: 0 };  // inertia: coasts after hand leaves
let lastHandPos     = null;             // previous wrist position for delta calc
let expansionFactor = 0;
let lastSwitchTime  = 0;

// --- SCROLL WHEEL ZOOM ---
let userZoomOffset = 0;
window.addEventListener('wheel', (e) => {
    e.preventDefault();
    userZoomOffset += e.deltaY * 0.25;
    // Clamp: max zoom-out +300, max zoom-in -240 (keeps min cam dist ~40)
    userZoomOffset = Math.max(-240, Math.min(300, userZoomOffset));
}, { passive: false });

const hands = new Hands({ locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
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
    const indexCurled = Math.sqrt(Math.pow(wrist.x - indexTip.x,2) + Math.pow(wrist.y - indexTip.y,2)) < 0.22;
    const middleCurled = Math.sqrt(Math.pow(wrist.x - middleTip.x,2) + Math.pow(wrist.y - middleTip.y,2)) < 0.22;
    const ringCurled = Math.sqrt(Math.pow(wrist.x - ringTip.x,2) + Math.pow(wrist.y - ringTip.y,2)) < 0.22;
    const pinkyCurled = Math.sqrt(Math.pow(wrist.x - pinkyTip.x,2) + Math.pow(wrist.y - pinkyTip.y,2)) < 0.22;
    return thumbUp && indexCurled && middleCurled && ringCurled && pinkyCurled;
}

hands.onResults((results) => {
    document.getElementById('loading').style.display = 'none';

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        // Use first detected hand for rotation and pinch
        const landmarks = results.multiHandLandmarks[0];

        // 1. Delta-based rotation — accumulates on every sweep, unlimited range
        const wrist = landmarks[0];
        if (lastHandPos !== null) {
            const rawDx = wrist.y - lastHandPos.y;  // vertical move   → X rotation
            const rawDy = wrist.x - lastHandPos.x;  // horizontal move → Y rotation
            const deadZone = 0.004;                 // ignore micro-jitter
            const sensitivity = 10;                 // higher = faster turns
            if (Math.abs(rawDx) > deadZone) {
                const delta = rawDx * sensitivity;
                handRotation.x  += delta;
                handVelocity.x   = handVelocity.x * 0.6 + delta * 0.4;
            } else {
                handVelocity.x  *= 0.85;
            }
            if (Math.abs(rawDy) > deadZone) {
                const delta = rawDy * sensitivity;
                handRotation.y  += delta;
                handVelocity.y   = handVelocity.y * 0.6 + delta * 0.4;
            } else {
                handVelocity.y  *= 0.85;
            }
        }
        lastHandPos = { x: wrist.x, y: wrist.y };

        // 2. Pinch (Thumb tip=4, Index tip=8) -> Expand particles
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const dx = thumbTip.x - indexTip.x;
        const dy = thumbTip.y - indexTip.y;
        const pinchDistance = Math.sqrt(dx*dx + dy*dy);
        expansionFactor = Math.max(0, (pinchDistance - 0.05) * 5);

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
                    switchView(currentViewIndex);
                    lastSwitchTime = now;
                }
            }
        }
    } else {
        // Reset to defaults if no hand seen
        expansionFactor  *= 0.9;
        lastHandPos       = null;          // reset so no jump on re-entry
        // Coast with inertia, then decay to rest
        handRotation.x   += handVelocity.x;
        handRotation.y   += handVelocity.y;
        handVelocity.x   *= 0.88;
        handVelocity.y   *= 0.88;
    }
});

// Initialize camera and hand tracking only on desktop
if (!isMobile) {
    const cameraUtils = new Camera(videoElement, {
        onFrame: async () => { await hands.send({ image: videoElement }); },
        width: 320, height: 240
    });
    cameraUtils.start();
} else {
    // Hide loading message on mobile since we're not loading camera
    document.getElementById('loading').style.display = 'none';
}

// --- 10. ANIMATION LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

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
            for (let idx = range.start; idx < range.end; idx++) {
                const i3 = idx * 3;
                // Skip ring particles (they have their own rotation logic)
                if (particleBodyId[idx] === -5) continue;
                // Rotate local offset around Y axis for self-spin
                const lx = localOffsets[i3];
                const lz = localOffsets[i3 + 2];
                const rx = lx * cosA - lz * sinA;
                const rz = lx * sinA + lz * cosA;
                basePositions[i3]     = ox + rx;
                basePositions[i3 + 1] = oy + localOffsets[i3 + 1];
                basePositions[i3 + 2] = oz + rz;
            }
        }
    }

    // Sun gentle pulsation in solar system view (no blinking)
    if (isSolarSystemView && bodyRanges.length > 0) {
        const sunRange = bodyRanges[0];
        const pulse = Math.sin(time * 2) * 0.025 + 1.01; // Gentle size pulsation
        for (let idx = sunRange.start; idx < sunRange.end; idx++) {
            const i3 = idx * 3;
            basePositions[i3]     = localOffsets[i3] * pulse;
            basePositions[i3 + 1] = localOffsets[i3 + 1] * pulse;
            basePositions[i3 + 2] = localOffsets[i3 + 2] * pulse;
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
                basePositions[i3]     = moonCenterX + localOffsets[i3];
                basePositions[i3 + 1] = localOffsets[i3 + 1];
                basePositions[i3 + 2] = moonCenterZ + localOffsets[i3 + 2];
            }
        }
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
                const baseBright = sizeArr[i] > 4.5 ? 2.8 : (sizeArr[i] > 2.8 ? 1.8 : 1.0);
                colors[i3]   = baseBright * tw;
                colors[i3+1] = baseBright * tw * 0.95;
                colors[i3+2] = baseBright * tw * 1.05;
                
                // Subtle star drift movement (very slow rotation around center)
                const driftSpeed = 0.001 + (i % 11) * 0.0001;
                const driftAngle = time * driftSpeed + phase;
                const radius = Math.sqrt(localOffsets[i3] * localOffsets[i3] + localOffsets[i3+2] * localOffsets[i3+2]);
                basePositions[i3] = Math.cos(driftAngle) * radius;
                basePositions[i3+2] = Math.sin(driftAngle) * radius;
                // Keep Y position with slight wave
                basePositions[i3+1] = localOffsets[i3+1] + Math.sin(time * 0.2 + phase) * 0.5;
            }
            
            // Main Asteroid Belt movement (orbital motion)
            if (particleBodyId[i] === -2) {
                const orbitSpeed = 0.008 + (i % 13) * 0.002; // varied speeds
                const phase = i * 23.7;
                const angle = time * orbitSpeed + phase;
                const radius = Math.sqrt(localOffsets[i3] * localOffsets[i3] + localOffsets[i3+2] * localOffsets[i3+2]);
                basePositions[i3] = Math.cos(angle) * radius;
                basePositions[i3+2] = Math.sin(angle) * radius;
                // Slight vertical oscillation
                basePositions[i3+1] = localOffsets[i3+1] + Math.sin(time * 0.5 + phase) * 1.5;
            }
            
            // Kuiper Belt movement (slower orbital motion)
            if (particleBodyId[i] === -3) {
                const orbitSpeed = 0.003 + (i % 17) * 0.001; // slower than main belt
                const phase = i * 31.4;
                const angle = time * orbitSpeed + phase;
                const radius = Math.sqrt(localOffsets[i3] * localOffsets[i3] + localOffsets[i3+2] * localOffsets[i3+2]);
                basePositions[i3] = Math.cos(angle) * radius;
                basePositions[i3+2] = Math.sin(angle) * radius;
                // Slight vertical oscillation
                basePositions[i3+1] = localOffsets[i3+1] + Math.sin(time * 0.3 + phase) * 2.0;
            }
            
            // Saturn's rings rotation with 26.7 deg tilt
            if (particleBodyId[i] === -5) {
                const saturnAngle = orbitAngles[6];
                const saturnX = Math.cos(saturnAngle) * BODIES[6].orbitR;
                const saturnZ = Math.sin(saturnAngle) * BODIES[6].orbitR;
                
                // Rotate in the FLAT ring plane first
                const flatRadius = Math.sqrt(localOffsets[i3] * localOffsets[i3] + localOffsets[i3+2] * localOffsets[i3+2]);
                const flatBaseAngle = Math.atan2(localOffsets[i3+2], localOffsets[i3]);
                const ringRotSpeed = 0.08;
                const newFlatAngle = flatBaseAngle + time * ringRotSpeed;
                const rotFlatX = Math.cos(newFlatAngle) * flatRadius;
                const rotFlatZ = Math.sin(newFlatAngle) * flatRadius;
                const flatY = localOffsets[i3+1];
                
                // Apply Saturn's 26.7 deg axial tilt (rotation around X axis)
                const SATURN_TILT = 0.466; // 26.7 degrees in radians
                const cosT = Math.cos(SATURN_TILT);
                const sinT = Math.sin(SATURN_TILT);
                const tiltedY = flatY * cosT - rotFlatZ * sinT;
                const tiltedZ = flatY * sinT + rotFlatZ * cosT;
                
                basePositions[i3]   = saturnX + rotFlatX;
                basePositions[i3+1] = tiltedY;
                basePositions[i3+2] = saturnZ + tiltedZ;
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
                    const moonCX = Math.cos(mAngle) * moon.orbitR;
                    const moonCZ = Math.sin(mAngle) * moon.orbitR;

                    // Self-rotation: rotate sphere offset around Y axis
                    const cosS = Math.cos(time * moon.spinSpeed);
                    const sinS = Math.sin(time * moon.spinSpeed);
                    const slx = localOffsets[i3];
                    const slz = localOffsets[i3+2];
                    const rx = slx * cosS - slz * sinS;
                    const rz = slx * sinS + slz * cosS;

                    basePositions[i3]   = parentX + moonCX + rx;
                    basePositions[i3+1] = localOffsets[i3+1]; // Y = sphere Y
                    basePositions[i3+2] = parentZ + moonCZ + rz;
                }
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
            planetViewCamZ = Math.max(planetViewCamZ, farthestMoonOrbit * (isMobile ? 2.2 : 1.8));
        }
    }
    const baseCamZ = isSolarSystemView ? (isMobile ? 350 : 280) : planetViewCamZ;
    const targetCamZ = Math.max(10, baseCamZ + userZoomOffset);
    camera.position.z += (targetCamZ - camera.position.z) * 0.06;

    // Use touch controls on mobile, hand tracking on desktop
    // On mobile: gyro sets the base orientation and touch drag adds an offset on top
    const activeRotationX = isMobile
        ? (gyroEnabled ? gyroRotationX + touchRotationX : touchRotationX)
        : handRotation.x;
    const activeRotationY = isMobile
        ? (gyroEnabled ? gyroRotationY + touchRotationY : touchRotationY)
        : handRotation.y;
    const activeExpansion = isMobile ? touchExpansion : expansionFactor;

    // Smooth rotation + base tilt for solar system orbital view
    const baseTiltX = isSolarSystemView ? -0.4 : 0;
    particleSystem.rotation.x += ((activeRotationX + baseTiltX) - particleSystem.rotation.x) * 0.18;
    particleSystem.rotation.y += (activeRotationY - particleSystem.rotation.y) * 0.18;

    // Always add a slow ambient spin
    particleSystem.rotation.y += 0.008; // Increased ambient spin

    // Dynamic particle size — scale with camera distance so particles maintain
    // consistent apparent size at all zoom levels (no giant blobs when close).
    // camDistScale < 1 when zoomed in, > 1 when zoomed out.
    const camDistScale = Math.sqrt(Math.max(10, camera.position.z) / 280);

    if (isSolarSystemView) {
        bloomPass.strength = 0.85;
        if (activeExpansion < 0.01) {
            material.size = 1.8 * camDistScale;
        } else {
            // Ramp up to peak at expansion=0.5, then shrink so individual particles
            // in planet spheres become distinct (more surface texture visible).
            const ramp = Math.min(activeExpansion / 0.5, 1.0);
            const shrink = Math.max(0, (activeExpansion - 0.5) * 0.55);
            material.size = (1.8 + ramp * 0.9 - shrink) * camDistScale;
        }
    } else {
        // Planet view: keep bloom strength constant regardless of zoom
        bloomPass.strength = 0.85;
        const baseSize = 1.8 + (activeExpansion * 0.5);
        const detailBoost = activeExpansion > 0.3 ? Math.min(activeExpansion * 0.4, 0.8) : 0;
        material.size = (baseSize + detailBoost) * camDistScale;
    }

    const pos = geometry.attributes.position.array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;

        const vx = basePositions[i3];
        const vy = basePositions[i3 + 1];
        const vz = basePositions[i3 + 2];

        let targetX, targetY, targetZ;

        if (isSolarSystemView && activeExpansion > 0.01) {
            // Improved zooming: maintain orbital spacing properly
            // Get particle's body ID to determine if it's a planet
            const bodyId = particleBodyId[i];
            
            if (bodyId >= 0 && bodyId < BODIES.length) {
                // Planet particles: scale orbit centre + gently grow local sphere for zoom detail
                const localX = localOffsets[i3];
                const localY = localOffsets[i3 + 1];
                const localZ = localOffsets[i3 + 2];
                
                // Orbit centre (planet position relative to Sun)
                const orbitCenterX = vx - localX;
                const orbitCenterY = vy - localY;
                const orbitCenterZ = vz - localZ;
                
                // Spread orbits outward with expansion
                const orbitScale = 1 + activeExpansion * 1.5;
                // Also grow each planet's sphere radius so surface detail becomes visible
                const localScale = 1 + activeExpansion * 0.45;
                
                targetX = orbitCenterX * orbitScale + localX * localScale;
                targetY = orbitCenterY * orbitScale + localY * localScale;
                targetZ = orbitCenterZ * orbitScale + localZ * localScale;
            } else if (bodyId === -1) {
                // Orbit ring lines: scale radius AND inclination Y for correct tilted orbits
                const orbitalRadius = Math.sqrt(vx * vx + vz * vz);
                const angle = Math.atan2(vz, vx);
                const orbitScale = 1 + activeExpansion * 1.5;
                targetX = Math.cos(angle) * orbitalRadius * orbitScale;
                targetY = vy * orbitScale;
                targetZ = Math.sin(angle) * orbitalRadius * orbitScale;
            } else if (bodyId === -2 || bodyId === -3) {
                // Asteroid and Kuiper belts - scale radially like orbits
                const orbitalRadius = Math.sqrt(vx * vx + vz * vz);
                const angle = Math.atan2(vz, vx);
                const scaledRadius = orbitalRadius * (1 + activeExpansion * 1.5);
                targetX = Math.cos(angle) * scaledRadius;
                targetY = vy + (vy * 0.2 * activeExpansion);
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
                const orbitScale = 1 + activeExpansion * 1.5;
                targetX = (vx - localX) * orbitScale + localX;
                targetY = (vy - localY) * orbitScale + localY;
                targetZ = (vz - localZ) * orbitScale + localZ;
            } else {
                // Stars and other particles - minimal expansion
                const wave = Math.sin(time * 2 + i) * 2 * activeExpansion;
                targetX = vx + (vx * activeExpansion * 0.3) + wave;
                targetY = vy + (vy * activeExpansion * 0.3) + wave;
                targetZ = vz + (vz * activeExpansion * 0.3) + wave;
            }
        } else {
            // Planet view or no expansion - use original behavior
            const wave = Math.sin(time * 2 + i) * 5 * activeExpansion;
            targetX = vx + (vx * activeExpansion * 2) + wave;
            targetY = vy + (vy * activeExpansion * 2) + wave;
            targetZ = vz + (vz * activeExpansion * 2) + wave;
        }

        positions[i3]     += (targetX - positions[i3])     * 0.05;
        positions[i3 + 1] += (targetY - positions[i3 + 1]) * 0.05;
        positions[i3 + 2] += (targetZ - positions[i3 + 2]) * 0.05;
    }

    geometry.attributes.position.needsUpdate = true;
    composer.render();
}

animate();
