// --- 1. THREE.JS SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 150;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- 2. PARTICLE SYSTEM SETUP ---
const particleCount = 25000;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
const colors = new Float32Array(particleCount * 3);
const targetPositions = new Float32Array(particleCount * 3);
const basePositions = new Float32Array(particleCount * 3);

// Initialize arrays
for (let i = 0; i < particleCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 500; // Start scattered
    colors[i] = 1;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({
    size: 0.8,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
});

const particleSystem = new THREE.Points(geometry, material);
scene.add(particleSystem);

// --- 3. PLANET DATA GENERATOR ---
const planets = [
    { name: "Sun", radius: 50, color: new THREE.Color(0xffaa00) },
    { name: "Mercury", radius: 10, color: new THREE.Color(0xaaaaaa) },
    { name: "Venus", radius: 18, color: new THREE.Color(0xffcc66) },
    { name: "Earth", radius: 20, color: new THREE.Color(0x3399ff), secondaryColor: new THREE.Color(0x33cc33) },
    { name: "Mars", radius: 14, color: new THREE.Color(0xff3300) },
    { name: "Jupiter", radius: 45, color: new THREE.Color(0xcc9966), secondaryColor: new THREE.Color(0xffddaa) },
    { name: "Saturn", radius: 38, color: new THREE.Color(0xe6ca81), hasRings: true },
    { name: "Uranus", radius: 28, color: new THREE.Color(0x66ccff) },
    { name: "Neptune", radius: 26, color: new THREE.Color(0x3333ff) }
];

let currentPlanetIndex = 0;

function generatePlanetGeometry(planet) {
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;

        // Generate Ring for Saturn
        if (planet.hasRings && i > particleCount * 0.7) {
            const angle = Math.random() * Math.PI * 2;
            const r = planet.radius * 1.5 + Math.random() * planet.radius * 1.2;
            basePositions[i3]     = Math.cos(angle) * r;
            basePositions[i3 + 1] = (Math.random() - 0.5) * 2;
            basePositions[i3 + 2] = Math.sin(angle) * r;

            const ringColor = new THREE.Color(0xaaaaaa).lerp(new THREE.Color(0x555555), Math.random());
            colors[i3] = ringColor.r; colors[i3+1] = ringColor.g; colors[i3+2] = ringColor.b;
            continue;
        }

        // Generate Sphere points (even distribution)
        const phi   = Math.acos(-1 + (2 * i) / (planet.hasRings ? particleCount * 0.7 : particleCount));
        const theta = Math.sqrt((planet.hasRings ? particleCount * 0.7 : particleCount) * Math.PI) * phi;

        const x = planet.radius * Math.cos(theta) * Math.sin(phi);
        const y = planet.radius * Math.sin(theta) * Math.sin(phi);
        const z = planet.radius * Math.cos(phi);

        // Add some surface noise
        const noise = 1 + (Math.random() - 0.5) * 0.1;
        basePositions[i3]     = x * noise;
        basePositions[i3 + 1] = y * noise;
        basePositions[i3 + 2] = z * noise;

        // Colors
        let pColor = planet.color.clone();
        if (planet.secondaryColor) {
            const mix = Math.sin(y * 0.2) * 0.5 + 0.5 + (Math.random() * 0.2);
            pColor.lerp(planet.secondaryColor, mix);
        }
        colors[i3] = pColor.r; colors[i3 + 1] = pColor.g; colors[i3 + 2] = pColor.b;
    }
    geometry.attributes.color.needsUpdate = true;
    document.getElementById('planet-name').innerText = planet.name;
}

generatePlanetGeometry(planets[currentPlanetIndex]);

// --- 4. MEDIA PIPE HAND TRACKING ---
const videoElement = document.getElementById('webcam');
let handRotation   = { x: 0, y: 0 };
let expansionFactor = 0;
let lastSwitchTime  = 0;

const hands = new Hands({ locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
});

hands.onResults((results) => {
    document.getElementById('loading').style.display = 'none';

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        // 1. Hand Position -> Rotate system
        const wrist = landmarks[0];
        handRotation.x = (wrist.y - 0.5) * 3;
        handRotation.y = (wrist.x - 0.5) * 3;

        // 2. Pinch (Thumb tip=4, Index tip=8) -> Expand particles
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const dx = thumbTip.x - indexTip.x;
        const dy = thumbTip.y - indexTip.y;
        const pinchDistance = Math.sqrt(dx*dx + dy*dy);
        expansionFactor = Math.max(0, (pinchDistance - 0.05) * 5);

        // 3. Fist Detection -> Switch Planet
        const pinkyTip = landmarks[20];
        const dIndex = Math.sqrt(Math.pow(wrist.x - indexTip.x, 2) + Math.pow(wrist.y - indexTip.y, 2));
        const dPinky = Math.sqrt(Math.pow(wrist.x - pinkyTip.x, 2) + Math.pow(wrist.y - pinkyTip.y, 2));

        if (dIndex < 0.2 && dPinky < 0.2) {
            const now = Date.now();
            if (now - lastSwitchTime > 1500) {
                currentPlanetIndex = (currentPlanetIndex + 1) % planets.length;
                generatePlanetGeometry(planets[currentPlanetIndex]);
                lastSwitchTime = now;
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

// --- 5. ANIMATION LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    // Smooth rotation based on hand
    particleSystem.rotation.x += (handRotation.x - particleSystem.rotation.x) * 0.1;
    particleSystem.rotation.y += (handRotation.y - particleSystem.rotation.y) * 0.1;

    // Always add a slow ambient spin
    particleSystem.rotation.y += 0.005;

    const positions = geometry.attributes.position.array;

    for (let i = 0; i < particleCount; i++) {
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

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
