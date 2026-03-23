# 🌌 Celestial Particle: Hand-Tracked 3D Solar System

![Project Preview](https://via.placeholder.com/1200x600/000000/FFFFFF?text=Celestial+Particle+Preview)

A premium, high-performance 3D solar system visualization built with **Three.js** and powered by **MediaPipe AI** for immersive hand-tracked navigation. Experience the cosmos through a cloud of 130,000+ dynamic particles, procedurally generated celestial bodies, and interactive orbital mechanics.

## ✨ Features

- **130,000+ Dynamic Particles**: High-performance rendering of the entire solar system using `BufferGeometry` and custom GLSL-inspired logic.
- **AI-Powered Hand Tracking**: Navigate deep space naturally with your hands. Use gestures to rotate, zoom, and switch between planets.
- **Procedural Cosmos**: No external textures or images. Every planet's surface, Saturn's rings, the asteroid belt, and deep-space starfields are generated mathematically using noise and trigonometry.
- **Realistic Astronomical Visuals**: Includes limb darkening, atmospheric bloom, planetary inclinations, and accurate moon systems for all major planets.
- **Dual Perspective**: Seamlessly switch between a broad Solar System view and detailed high-fidelity individual planet views.
- **Responsive Design**: Fluid experience across desktop and mobile devices.

## 🚀 Technologies Used

- **Three.js**: Core 3D engine for WebGL rendering.
- **MediaPipe Hands**: Real-time hand landmark detection and gesture recognition.
- **Vanilla JavaScript**: High-performance procedural generation and animation loops.
- **CSS3**: Premium glassmorphic UI and layout.

## 🎮 Controls

### 🖐️ Hand Tracking Gestures
*Requires a webcam*

- **Rotate**: Move your wrist to pan and rotate the universe.
- **Pinch (Thumb + Index)**: Bring your fingers together or apart to "expand" the orbits and zoom in/out.
- **Thumbs Up (Right Hand)**: Navigate to the **Next** planet.
- **Thumbs Up (Left Hand)**: Navigate to the **Previous** planet.

### 🖱️ Mouse & Keyboard
- **Left Click & Drag**: Rotate the camera.
- **Scroll Wheel**: Deep zoom into focus.
- **Single Click (on planet)**: Focus camera on the selected planet.
- **Double Click (on planet)**: Enter the high-detail individual planet view.
- **Double Click (empty space)**: Return to the full Solar System view.
- **Escape**: Clear current focus.

## 🛠️ Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/chinmoy31112/Celestial-Particle.git
   ```
2. **Open the project**:
   Simply open `index.html` in any modern web browser or serve it using a local live server extension.

3. **Enable Camera**:
   When prompted, allow camera access to enable the hand-tracking features.

## 📂 Project Structure

- `index.html`: Entry point & UI structure.
- `script.js`: Three.js engine, procedural generation, and MediaPipe logic.
- `style.css`: Visual styling and premium aesthetics.

## 🛡️ License

Creative Commons Attribution 4.0 International (CC BY 4.0).

---
*Created with 💙 for the love of the cosmos.*
