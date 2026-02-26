// --- 1. THREE.JS SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000005); // Deep space background
// Removed fog to prevent dimming when zooming/expanding

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 150;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.NoToneMapping; // No tone compression — pure vivid colors
document.body.appendChild(renderer.domElement);

// --- POST-PROCESSING (BLOOM) ---
const renderScene = new THREE.RenderPass(scene, camera);
const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.4;  // High threshold: only Sun & mega-bright stars glow, planets stay crisp
bloomPass.strength  = 0.9;  // Moderate glow — visible but not washed out
bloomPass.radius    = 0.3;  // Tight glow spike, not a blurry haze

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
sizes.fill(0.8);
geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

const material = new THREE.PointsMaterial({
    size: 1.5, // Reduced from 2.0 for sharper details
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    map: createParticleTexture(),
    depthWrite: false
});

const particleSystem = new THREE.Points(geometry, material);
scene.add(particleSystem);

// --- 3. SOLAR SYSTEM BODY DATA (for orbital view) ---
// Deep vivid colors for maximum visibility
const BODIES = [
    { name: "Sun",     orbitR: 0,   r: 13,  speed: 0,    clrs: [0xff4400, 0xff7700, 0xffbb00, 0xffdd22] },
    { name: "Mercury", orbitR: 20,  r: 1.8, speed: 0.48, clrs: [0xc0a888, 0xd8c8a8, 0xb09878] },
    { name: "Venus",   orbitR: 28,  r: 2.6, speed: 0.35, clrs: [0xffcc55, 0xeea830, 0xdd9922] },
    { name: "Earth",   orbitR: 37,  r: 3.0, speed: 0.30, clrs: [0x0066ff, 0x0099ff, 0x00cc44, 0x0055ee] },
    { name: "Mars",    orbitR: 45,  r: 2.2, speed: 0.24, clrs: [0xff2200, 0xee3300, 0xdd2200, 0xcc1100] },
    { name: "Jupiter", orbitR: 70,  r: 7.5, speed: 0.13, clrs: [0xeeaa55, 0xcc7733, 0xffcc88, 0xdd8833] },
    { name: "Saturn",  orbitR: 86,  r: 6.0, speed: 0.10, clrs: [0xffdd77, 0xeebb44, 0xffcc55], hasRings: true, ringClrs: [0xeedd88, 0xccaa55, 0xaa8844] },
    { name: "Uranus",  orbitR: 100, r: 4.0, speed: 0.07, clrs: [0x22ccff, 0x55eeff, 0x33bbee] },
    { name: "Neptune", orbitR: 112, r: 3.8, speed: 0.05, clrs: [0x2255ff, 0x3377ff, 0x4499ff] }
];

// Particle budgets per body in solar system view (total: 50000)
const BODY_BUDGETS = [5000, 400, 600, 800, 500, 3000, 2500, 1300, 1100]; // sum = 15200
const ASTEROID_BUDGET = 15000;      // Main belt (Mars–Jupiter)
const KUIPER_BUDGET = 6000;         // Kuiper belt (beyond Neptune)
const SCATTERED_BUDGET = 3000;      // Rogue/scattered asteroids throughout space
const ORBIT_LINE_BUDGET = 4000;
const STAR_BUDGET = 26800; // massive star field for realistic look

let orbitAngles = BODIES.map(() => Math.random() * Math.PI * 2);
let bodyRanges = [];

// --- 4. INDIVIDUAL PLANET VIEW DATA (for fist-switch cycling) ---
const PLANET_VIEWS = [
    { name: "Solar System", isSolarSystem: true },
    { name: "Sun",     radius: 50, main: 0xff5500, second: 0xffbb00, third: 0xff2200 },
    { name: "Mercury", radius: 15, main: 0xc0a888, second: 0xd8c8a8 },
    { name: "Venus",   radius: 22, main: 0xffcc55, second: 0xeea830 },
    { name: "Earth",   radius: 25, main: 0x0066ff, second: 0x00cc44 },
    { name: "Mars",    radius: 18, main: 0xff2200, second: 0xee3300 },
    { name: "Jupiter", radius: 45, main: 0xeeaa55, second: 0xcc7733, third: 0xffcc88 },
    { name: "Saturn",  radius: 38, main: 0xffdd77, hasRings: true, ringClr: 0xeedd88 },
    { name: "Uranus",  radius: 30, main: 0x22ccff, second: 0x55eeff },
    { name: "Neptune", radius: 28, main: 0x2255ff, second: 0x3377ff }
];

let currentViewIndex = 0;
let isSolarSystemView = true;

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

        if (body.hasRings) {
            const sphereN = Math.floor(budget * 0.6);
            const ringN = budget - sphereN;

            for (let p = 0; p < sphereN; p++) {
                const i3 = idx * 3;
                const phi = Math.acos(-1 + (2 * p) / sphereN);
                const theta = Math.sqrt(sphereN * Math.PI) * phi;
                const n = 1 + (Math.random() - 0.5) * 0.08;
                const lx = body.r * Math.cos(theta) * Math.sin(phi) * n;
                const ly = body.r * Math.sin(theta) * Math.sin(phi) * n;
                const lz = body.r * Math.cos(phi) * n;
                localOffsets[i3]=lx; localOffsets[i3+1]=ly; localOffsets[i3+2]=lz;
                basePositions[i3]=ox+lx; basePositions[i3+1]=ly; basePositions[i3+2]=oz+lz;
                particleBodyId[idx] = b;
                const c = new THREE.Color(body.clrs[Math.floor(Math.random()*body.clrs.length)]);
                c.r+=(Math.random()-0.5)*0.05; c.g+=(Math.random()-0.5)*0.05; c.b+=(Math.random()-0.5)*0.05;
                
                let intensity = (b === 0) ? 3.5 : 1.8;
                colors[i3]=Math.max(0, c.r * intensity); 
                colors[i3+1]=Math.max(0, c.g * intensity); 
                colors[i3+2]=Math.max(0, c.b * intensity);
                idx++;
            }
            for (let p = 0; p < ringN; p++) {
                const i3 = idx * 3;
                const ra = Math.random() * Math.PI * 2;
                const rr = body.r * 1.4 + Math.random() * body.r * 1.2;
                const lx = Math.cos(ra)*rr;
                const ly = (Math.random()-0.5)*0.8;
                const lz = Math.sin(ra)*rr;
                localOffsets[i3]=lx; localOffsets[i3+1]=ly; localOffsets[i3+2]=lz;
                basePositions[i3]=ox+lx; basePositions[i3+1]=ly; basePositions[i3+2]=oz+lz;
                particleBodyId[idx] = b;
                const c = new THREE.Color(body.ringClrs[Math.floor(Math.random()*body.ringClrs.length)]);
                colors[i3]=c.r * 1.2; colors[i3+1]=c.g * 1.2; colors[i3+2]=c.b * 1.2;
                idx++;
            }
        } else {
            for (let p = 0; p < budget; p++) {
                const i3 = idx * 3;
                const phi = Math.acos(-1 + (2 * p) / budget);
                const theta = Math.sqrt(budget * Math.PI) * phi;
                const n = 1 + (Math.random() - 0.5) * 0.08;
                const lx = body.r * Math.cos(theta) * Math.sin(phi) * n;
                const ly = body.r * Math.sin(theta) * Math.sin(phi) * n;
                const lz = body.r * Math.cos(phi) * n;
                localOffsets[i3]=lx; localOffsets[i3+1]=ly; localOffsets[i3+2]=lz;
                basePositions[i3]=ox+lx; basePositions[i3+1]=ly; basePositions[i3+2]=oz+lz;
                particleBodyId[idx] = b;
                const c = new THREE.Color(body.clrs[Math.floor(Math.random()*body.clrs.length)]);
                c.r+=(Math.random()-0.5)*0.05; c.g+=(Math.random()-0.5)*0.05; c.b+=(Math.random()-0.5)*0.05;
                
                let intensity = (b === 0) ? 3.5 : 1.8;
                colors[i3]=Math.max(0, c.r * intensity); 
                colors[i3+1]=Math.max(0, c.g * intensity); 
                colors[i3+2]=Math.max(0, c.b * intensity);
                idx++;
            }
        }
        bodyRanges.push({ start: startIdx, end: idx, bodyIdx: b });
    }

    // --- MAIN Asteroid Belt (between Mars r=45 and Jupiter r=70) ---
    for (let p = 0; p < ASTEROID_BUDGET; p++) {
        const i3 = idx * 3;
        const a = Math.random() * Math.PI * 2;
        const r = 49 + Math.random() * 19;
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
        colors[i3]=cr*3.5; colors[i3+1]=cg*3.5; colors[i3+2]=cb*3.5;
        sizes[idx] = Math.random() > 0.95 ? 3.0+Math.random()*2.5 : 1.0+Math.random()*0.8;
        idx++;
    }

    // --- KUIPER BELT (beyond Neptune r=112) ---
    for (let p = 0; p < KUIPER_BUDGET; p++) {
        const i3 = idx * 3;
        const a = Math.random() * Math.PI * 2;
        const r = 120 + Math.random() * 40; // 120–160 range
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
        colors[i3]=cr*2.5; colors[i3+1]=cg*2.5; colors[i3+2]=cb*2.5;
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
        // Very bright so they pop against the dark background like lit space rocks
        const brightness = 3.5 + Math.random() * 2.0;
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
            colors[i3] = cr * 8.0; colors[i3+1] = cg * 8.0; colors[i3+2] = cb * 8.0;
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
            colors[i3] = cr * 5.0; colors[i3+1] = cg * 5.0; colors[i3+2] = cb * 5.0;
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
            colors[i3] = cr * 3.0; colors[i3+1] = cg * 3.0; colors[i3+2] = cb * 3.0;
            sizes[idx] = 2.0 + Math.random() * 1.5;
        } else {
            // Background star dust - tiny but visible, fills the sky
            particleBodyId[idx] = -1;
            const brightness = 0.5 + Math.random() * 1.5;
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

    const PLANET_PARTICLES = Math.floor(PARTICLE_COUNT * 0.75);
    const STAR_PARTICLES = PARTICLE_COUNT - PLANET_PARTICLES;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        particleBodyId[i] = -1;

        // Background stars for planet views
        if (i >= PLANET_PARTICLES) {
            const sr = 200 + Math.random()*400;
            const st = Math.random()*Math.PI*2;
            const sp = Math.random()*Math.PI;
            basePositions[i3]   = sr*Math.sin(sp)*Math.cos(st);
            basePositions[i3+1] = sr*Math.sin(sp)*Math.sin(st);
            basePositions[i3+2] = sr*Math.cos(sp);
            const brightness = 0.3 + Math.random()*0.7;
            colors[i3]=brightness; colors[i3+1]=brightness;
            colors[i3+2]=brightness*(0.9+Math.random()*0.1);
            continue;
        }

        if (view.hasRings && i > PLANET_PARTICLES * 0.7) {
            const angle = Math.random() * Math.PI * 2;
            const r = view.radius * 1.5 + Math.random() * view.radius * 1.2;
            basePositions[i3]     = Math.cos(angle) * r;
            basePositions[i3 + 1] = (Math.random() - 0.5) * 2;
            basePositions[i3 + 2] = Math.sin(angle) * r;
            const ringColor = new THREE.Color(view.ringClr || 0xaaaaaa).lerp(new THREE.Color(0x555555), Math.random());
            colors[i3] = ringColor.r * 1.5; colors[i3+1] = ringColor.g * 1.5; colors[i3+2] = ringColor.b * 1.5;
            continue;
        }

        const total = view.hasRings ? PLANET_PARTICLES * 0.7 : PLANET_PARTICLES;
        const phi   = Math.acos(-1 + (2 * i) / total);
        const theta = Math.sqrt(total * Math.PI) * phi;

        const x = view.radius * Math.cos(theta) * Math.sin(phi);
        const y = view.radius * Math.sin(theta) * Math.sin(phi);
        const z = view.radius * Math.cos(phi);

        const noise = 1 + (Math.random() - 0.5) * 0.1;
        basePositions[i3]     = x * noise;
        basePositions[i3 + 1] = y * noise;
        basePositions[i3 + 2] = z * noise;

        let pColor = new THREE.Color(view.main);
        if (view.second) {
            const mix = Math.sin(y * 0.2) * 0.5 + 0.5 + (Math.random() * 0.2);
            pColor.lerp(new THREE.Color(view.second), mix);
        }
        if (view.third) {
            pColor.lerp(new THREE.Color(view.third), Math.random() * 0.3);
        }
        
        let intensity = (view.name === "Sun") ? 3.5 : 1.8;
        colors[i3] = pColor.r * intensity; 
        colors[i3 + 1] = pColor.g * intensity; 
        colors[i3 + 2] = pColor.b * intensity;
    }

    geometry.attributes.color.needsUpdate = true;
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

// --- 9. MEDIAPIPE HAND TRACKING ---
// Left hand thumbs up = previous planet, Right hand thumbs up = next planet
const videoElement = document.getElementById('webcam');
let handRotation   = { x: 0, y: 0 };
let expansionFactor = 0;
let lastSwitchTime  = 0;

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

        // 1. Hand Position -> Rotate system (wider range for full control)
        const wrist = landmarks[0];
        handRotation.x = (wrist.y - 0.5) * 5;
        handRotation.y = (wrist.x - 0.5) * 5;

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
        handRotation.x   *= 0.95;
        handRotation.y   *= 0.95;
    }
});

const cameraUtils = new Camera(videoElement, {
    onFrame: async () => { await hands.send({ image: videoElement }); },
    width: 320, height: 240
});
cameraUtils.start();

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
            for (let idx = range.start; idx < range.end; idx++) {
                const i3 = idx * 3;
                // Rotate local offset around Y axis for self-spin
                const lx = localOffsets[i3];
                const lz = localOffsets[i3 + 2];
                const rx = lx * cosA - lz * sinA;
                const rz = lx * sinA + lz * cosA;
                basePositions[i3]     = ox + rx;
                basePositions[i3 + 1] = localOffsets[i3 + 1];
                basePositions[i3 + 2] = oz + rz;
            }
        }
    }

    // Sun glow pulsation in solar system view
    if (isSolarSystemView && bodyRanges.length > 0) {
        const sunRange = bodyRanges[0];
        const pulse = Math.sin(time * 3) * 0.03 + 1;
        for (let idx = sunRange.start; idx < sunRange.end; idx++) {
            const i3 = idx * 3;
            basePositions[i3]     = localOffsets[i3] * pulse;
            basePositions[i3 + 1] = localOffsets[i3 + 1] * pulse;
            basePositions[i3 + 2] = localOffsets[i3 + 2] * pulse;
        }
    }

    // Realistic star twinkling effect - each star twinkles at its own frequency
    const sizeArr = geometry.attributes.size.array; 
    if (isSolarSystemView) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            if (particleBodyId[i] === -4) {
                const i3 = i * 3;
                // Each star has unique twinkle speed and phase
                const speed1 = 2.0 + (i % 7) * 0.5;
                const speed2 = 3.0 + (i % 5) * 0.7;
                const phase = i * 17.3;
                // Combine two sine waves for realistic irregular twinkle
                const tw = 0.7 + Math.sin(time * speed1 + phase) * 0.2 + Math.sin(time * speed2 + phase * 0.7) * 0.1;
                // Pinpoint stars like picture — bright but not blooming blobs
                const baseBright = sizeArr[i] > 4.5 ? 3.5 : (sizeArr[i] > 2.8 ? 2.0 : 1.2);
                colors[i3]   = baseBright * tw;
                colors[i3+1] = baseBright * tw * 0.95;
                colors[i3+2] = baseBright * tw * 1.05;
            }
        }
        geometry.attributes.color.needsUpdate = true;
    }

    // Smooth camera zoom: pull back for solar system, closer for planets
    const targetCamZ = isSolarSystemView ? 200 : 150;
    camera.position.z += (targetCamZ - camera.position.z) * 0.03;

    // Smooth rotation + base tilt for solar system orbital view
    const baseTiltX = isSolarSystemView ? -0.4 : 0;
    particleSystem.rotation.x += ((handRotation.x + baseTiltX) - particleSystem.rotation.x) * 0.18;
    particleSystem.rotation.y += (handRotation.y - particleSystem.rotation.y) * 0.18;

    // Always add a slow ambient spin
    particleSystem.rotation.y += 0.008; // Increased ambient spin

    // Dynamic brightness for Solar System expansion (zooming/pinching)
    if (isSolarSystemView) {
        // On expand/zoom boost bloom slightly to keep brightness, but stay controlled
        bloomPass.strength = 0.9 + (expansionFactor * 0.8);
        material.size = 1.5 + (expansionFactor * 0.6);
    } else {
        bloomPass.strength = 0.9;
        material.size = 1.5;
    }

    const pos = geometry.attributes.position.array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;

        const vx = basePositions[i3];
        const vy = basePositions[i3 + 1];
        const vz = basePositions[i3 + 2];

        const wave = Math.sin(time * 2 + i) * 5 * expansionFactor;

        const targetX = vx + (vx * expansionFactor * 2) + wave;
        const targetY = vy + (vy * expansionFactor * 2) + wave;
        const targetZ = vz + (vz * expansionFactor * 2) + wave;

        positions[i3]     += (targetX - positions[i3])     * 0.05;
        positions[i3 + 1] += (targetY - positions[i3 + 1]) * 0.05;
        positions[i3 + 2] += (targetZ - positions[i3 + 2]) * 0.05;
    }

    geometry.attributes.position.needsUpdate = true;
    composer.render();
}

animate();
