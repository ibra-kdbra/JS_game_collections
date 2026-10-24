/**
 * Interactive 3D Procedural WebGL Background System
 * Pure code-driven background - Zero static images!
 * 
 * Main Page: Cyber Particle Constellation & Interactive HUD Grid
 * Art Lab: 3D Mathematical Wave Surface Mesh & Topological Vector Flow
 */

import * as THREE from '../vendor/three/three.module.min.js';

class DynamicBackgroundEffect {
    constructor(container) {
        this.container = container;
        this.isRunning = true;
        this.lastFrame = 0;
        this.frameInterval = 1000 / 30; // 30fps cap for energy efficiency

        this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
        // Respect reduced motion: draw one still frame instead of animating.
        this.stillFrame = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.isArtLab = !!document.getElementById('artlab-body') || window.location.pathname.includes('Art_Lab');

        this.config = {
            colorYellow: 0xfacc15,
            colorOrange: 0xff9900,
            colorCyan: 0x00f0ff,
            colorDark: 0x09090b
        };

        this.init();
        if (this.isArtLab) {
            this.createArtLabMesh();
        } else {
            this.createMainHubParticles();
        }
        this.bindEvents();
        if (this.stillFrame) {
            this.isRunning = false;
            this.renderer.render(this.scene, this.camera);
        } else {
            this.animate();
        }
    }

    init() {
        this.scene = new THREE.Scene();
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 100);
        this.camera.position.z = this.isArtLab ? 3 : 2.5;

        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: false,
            powerPreference: 'low-power',
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.setClearColor(0x000000, 0);

        const canvas = this.renderer.domElement;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.zIndex = '-1';
        canvas.style.pointerEvents = 'none';

        this.container.appendChild(canvas);
    }

    createMainHubParticles() {
        const particleCount = 120;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        this.velocities = [];

        const colorPalette = [
            new THREE.Color(this.config.colorYellow),
            new THREE.Color(this.config.colorOrange),
            new THREE.Color(this.config.colorCyan),
        ];

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            positions[i3] = (Math.random() - 0.5) * 4;
            positions[i3 + 1] = (Math.random() - 0.5) * 4;
            positions[i3 + 2] = (Math.random() - 0.5) * 3 - 0.5;

            const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
            colors[i3] = col.r;
            colors[i3 + 1] = col.g;
            colors[i3 + 2] = col.b;

            sizes[i] = 0.02 + Math.random() * 0.025;

            this.velocities.push({
                x: (Math.random() - 0.5) * 0.0015,
                y: -0.002 - Math.random() * 0.002,
                z: (Math.random() - 0.5) * 0.001
            });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: { opacity: { value: 0.55 } },
            vertexShader: `
                attribute float size;
                varying vec3 vColor;
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (350.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform float opacity;
                varying vec3 vColor;
                void main() {
                    float dist = length(gl_PointCoord - vec2(0.5));
                    if (dist > 0.5) discard;
                    float alpha = smoothstep(0.5, 0.0, dist) * opacity;
                    gl_FragColor = vec4(vColor, alpha);
                }
            `,
            transparent: true,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    createArtLabMesh() {
        // 3D Mathematical Wave Topographic Wireframe Mesh
        const rows = 40;
        const cols = 40;
        const count = rows * cols;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        this.waveGrid = { rows, cols, count };

        const yellowCol = new THREE.Color(this.config.colorYellow);
        const cyanCol = new THREE.Color(this.config.colorCyan);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const idx = (r * cols + c) * 3;
                const u = (c / cols - 0.5) * 6;
                const v = (r / rows - 0.5) * 6;

                positions[idx] = u;
                positions[idx + 1] = (Math.sin(u) + Math.cos(v)) * 0.25;
                positions[idx + 2] = v;

                const mixFactor = (u + 3) / 6;
                const col = yellowCol.clone().lerp(cyanCol, mixFactor);
                colors[idx] = col.r;
                colors[idx + 1] = col.g;
                colors[idx + 2] = col.b;
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.025,
            vertexColors: true,
            transparent: true,
            opacity: 0.45,
            blending: THREE.AdditiveBlending,
        });

        this.waveMesh = new THREE.Points(geometry, material);
        this.waveMesh.rotation.x = 0.8;
        this.waveMesh.position.y = -0.5;
        this.scene.add(this.waveMesh);
    }

    animate = (timestamp = 0) => {
        if (!this.isRunning) return;
        requestAnimationFrame(this.animate);

        const delta = timestamp - this.lastFrame;
        if (delta < this.frameInterval) return;
        this.lastFrame = timestamp - (delta % this.frameInterval);

        // Smooth mouse lag
        this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.05;
        this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.05;

        this.camera.position.x = this.mouse.x * 0.3;
        this.camera.position.y = -this.mouse.y * 0.3;
        this.camera.lookAt(0, 0, 0);

        const time = timestamp * 0.001;

        if (this.isArtLab && this.waveMesh) {
            // Animate 3D mathematical wave topography
            const positions = this.waveMesh.geometry.attributes.position.array;
            const { rows, cols } = this.waveGrid;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const idx = (r * cols + c) * 3;
                    const u = positions[idx];
                    const v = positions[idx + 2];
                    positions[idx + 1] = Math.sin(u * 1.5 + time * 1.2) * 0.2 + Math.cos(v * 1.5 + time * 0.8) * 0.2;
                }
            }
            this.waveMesh.geometry.attributes.position.needsUpdate = true;
            this.waveMesh.rotation.z = Math.sin(time * 0.2) * 0.05;
        } else if (this.particles) {
            // Animate particle matrix
            const positions = this.particles.geometry.attributes.position.array;
            const count = positions.length / 3;

            for (let i = 0; i < count; i++) {
                const i3 = i * 3;
                const vel = this.velocities[i];

                positions[i3] += vel.x;
                positions[i3 + 1] += vel.y;
                positions[i3 + 2] += vel.z;

                if (positions[i3 + 1] < -2.2) {
                    positions[i3 + 1] = 2.2;
                    positions[i3] = (Math.random() - 0.5) * 4;
                }
            }
            this.particles.geometry.attributes.position.needsUpdate = true;
        }

        this.renderer.render(this.scene, this.camera);
    }

    bindEvents() {
        if (this.stillFrame) {
            window.addEventListener('resize', () => {
                this.onResize();
                this.renderer.render(this.scene, this.camera);
            }, { passive: true });
            return;
        }

        window.addEventListener('mousemove', (e) => {
            this.mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
            this.mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
        }, { passive: true });

        window.addEventListener('resize', this.onResize.bind(this), { passive: true });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pause();
            } else {
                this.resume();
            }
        });
    }

    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    pause() {
        this.isRunning = false;
    }

    resume() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.animate();
        }
    }

    destroy() {
        this.isRunning = false;
        if (this.particles) {
            this.particles.geometry.dispose();
            this.particles.material.dispose();
        }
        if (this.waveMesh) {
            this.waveMesh.geometry.dispose();
            this.waveMesh.material.dispose();
        }
        this.renderer.dispose();
        this.container.removeChild(this.renderer.domElement);
    }
}

let dropEffect = null;

function initDropEffect() {
    const container = document.getElementById('drop-effect-container') || document.body;
    try {
        dropEffect = new DynamicBackgroundEffect(container);
    } catch {
        // No WebGL (old device, blocked GPU): the CSS gradient background remains.
    }
}

export { DynamicBackgroundEffect as DropEffect, initDropEffect };

// Start after the page is interactive so the background never delays content.
const start = () => ('requestIdleCallback' in window ? requestIdleCallback(initDropEffect, { timeout: 1500 }) : setTimeout(initDropEffect, 200));
if (document.readyState === 'complete') {
    start();
} else {
    window.addEventListener('load', start, { once: true });
}
