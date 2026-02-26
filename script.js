// --- 1. THREE.JS SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 150;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- 2. PARTICLE SYSTEM SETUP ---
const PARTICLE_COUNT = 25000;
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
    size: 1.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
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

// Particle budgets per body in solar system view (total: 25000)
const BODY_BUDGETS = [3800, 350, 500, 650, 450, 2400, 2100, 1100, 900]; // sum = 12250
const ASTEROID_BUDGET = 4000;
const ORBIT_LINE_BUDGET = 3200;
const STAR_BUDGET = 5550; // includes big stars

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
                // Boost saturation for deep visibility
                c.r = Math.min(1, c.r * 1.6); c.g = Math.min(1, c.g * 1.6); c.b = Math.min(1, c.b * 1.6);
                colors[i3]=c.r; colors[i3+1]=c.g; colors[i3+2]=c.b;
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
                colors[i3]=c.r; colors[i3+1]=c.g; colors[i3+2]=c.b;
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
                // Boost saturation for deep visibility
                c.r = Math.min(1, c.r * 1.6); c.g = Math.min(1, c.g * 1.6); c.b = Math.min(1, c.b * 1.6);
                colors[i3]=c.r; colors[i3+1]=c.g; colors[i3+2]=c.b;
                idx++;
            }
        }
        bodyRanges.push({ start: startIdx, end: idx, bodyIdx: b });
    }

    // --- Asteroid Belt (between Mars 45 and Jupiter 70) - deeper/richer colors ---
    for (let p = 0; p < ASTEROID_BUDGET; p++) {
        const i3 = idx * 3;
        const a = Math.random() * Math.PI * 2;
        const r = 52 + Math.random() * 14;
        // Cluster asteroids with varying density
        const clump = Math.sin(a * 3) * 2;
        const lx = Math.cos(a) * (r + clump) + (Math.random()-0.5)*2.5;
        const ly = (Math.random()-0.5)*3.0;
        const lz = Math.sin(a) * (r + clump) + (Math.random()-0.5)*2.5;
        localOffsets[i3]=lx; localOffsets[i3+1]=ly; localOffsets[i3+2]=lz;
        basePositions[i3]=lx; basePositions[i3+1]=ly; basePositions[i3+2]=lz;
        particleBodyId[idx] = -2;
        // Deep rich rocky colors: dark brown, charcoal, rust, slate
        const type = Math.random();
        let cr, cg, cb;
        if (type < 0.3) { // dark charcoal
            cr = 0.18 + Math.random()*0.12; cg = 0.16 + Math.random()*0.10; cb = 0.14 + Math.random()*0.08;
        } else if (type < 0.6) { // deep rust/brown
            cr = 0.35 + Math.random()*0.2; cg = 0.18 + Math.random()*0.12; cb = 0.08 + Math.random()*0.08;
        } else if (type < 0.8) { // warm tan
            cr = 0.45 + Math.random()*0.15; cg = 0.32 + Math.random()*0.12; cb = 0.18 + Math.random()*0.1;
        } else { // metallic gray
            const g = 0.3 + Math.random()*0.2;
            cr = g + 0.04; cg = g; cb = g - 0.02;
        }
        colors[i3]=cr; colors[i3+1]=cg; colors[i3+2]=cb;
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
            colors[i3]=0.10; colors[i3+1]=0.15; colors[i3+2]=0.28;
            idx++;
        }
    }

    // --- Background Stars (with some big bright ones) ---
    const BIG_STAR_COUNT = 60; // number of prominent big stars
    let starIdx = 0;
    while (idx < PARTICLE_COUNT) {
        const i3 = idx * 3;
        const isBig = starIdx < BIG_STAR_COUNT;
        const sr = isBig ? (180 + Math.random()*200) : (250 + Math.random()*350);
        const st = Math.random()*Math.PI*2;
        const sp = Math.random()*Math.PI;
        const lx = sr*Math.sin(sp)*Math.cos(st);
        const ly = sr*Math.sin(sp)*Math.sin(st);
        const lz = sr*Math.cos(sp);
        localOffsets[i3]=lx; localOffsets[i3+1]=ly; localOffsets[i3+2]=lz;
        basePositions[i3]=lx; basePositions[i3+1]=ly; basePositions[i3+2]=lz;
        particleBodyId[idx] = isBig ? -4 : -1; // -4 marks big stars
        if (isBig) {
            // Big bright star colors: white, blue-white, gold
            const t = Math.random();
            if (t < 0.5) { colors[i3]=1.0; colors[i3+1]=1.0; colors[i3+2]=1.0; } // white
            else if (t < 0.75) { colors[i3]=0.7; colors[i3+1]=0.85; colors[i3+2]=1.0; } // blue
            else { colors[i3]=1.0; colors[i3+1]=0.9; colors[i3+2]=0.6; } // gold
        } else {
            const brightness = 0.3 + Math.random()*0.7;
            colors[i3]=brightness; colors[i3+1]=brightness; colors[i3+2]=brightness*(0.9+Math.random()*0.1);
        }
        idx++;
        starIdx++;
    }

    geometry.attributes.color.needsUpdate = true;
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
            colors[i3] = ringColor.r; colors[i3+1] = ringColor.g; colors[i3+2] = ringColor.b;
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
        colors[i3] = pColor.r; colors[i3 + 1] = pColor.g; colors[i3 + 2] = pColor.b;
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
        orbitAngles[b] += BODIES[b].speed * 0.003;
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
            const spinSpeed = 0.02 + b * 0.003; // each planet spins slightly differently
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

    // Big star twinkling effect
    const sizeArr = geometry.attributes.position.array; // just for reference
    // We'll modulate color brightness for big stars to create twinkle
    if (isSolarSystemView) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            if (particleBodyId[i] === -4) {
                const i3 = i * 3;
                const tw = 0.85 + Math.sin(time * 3 + i * 17.3) * 0.15;
                // Scale the stored base color by twinkle
                colors[i3]   = Math.min(1, colors[i3] > 0.5 ? tw : colors[i3]);
                colors[i3+1] = Math.min(1, colors[i3+1] > 0.5 ? tw * colors[i3+1] : colors[i3+1]);
                colors[i3+2] = Math.min(1, colors[i3+2] > 0.5 ? tw : colors[i3+2]);
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
    particleSystem.rotation.y += 0.003;

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
    renderer.render(scene, camera);
}

animate();
