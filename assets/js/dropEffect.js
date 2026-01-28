/**
 * Lightweight Three.js particle drop effect
 * Optimized for performance - won't kill the webpage
 * 
 * Features:
 * - Instanced rendering for efficiency
 * - 30fps cap for background (saves battery/CPU)
 * - Auto-pause when tab not visible
 * - Responsive to window resize
 * - Minimal memory footprint
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

class DropEffect {
    constructor(container) {
        this.container = container;
        this.isRunning = true;
        this.lastFrame = 0;
        this.frameInterval = 1000 / 30; // 30fps - smooth but efficient

        // Configuration - tweak these for different effects
        this.config = {
            particleCount: 150,      // Keep low for performance
            dropSpeed: 0.003,        // Fall speed
            spread: 2,               // Horizontal spread
            depth: 3,                // Depth range
            size: 0.015,             // Particle size
            opacity: 0.4,            // Particle opacity
            color1: 0x6366f1,        // Primary color (indigo)
            color2: 0xa855f7,        // Secondary color (purple)
            color3: 0xf472b6,        // Accent color (pink)
        };

        this.init();
        this.createParticles();
        this.bindEvents();
        this.animate();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();

        // Camera - orthographic for 2D-like effect
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 100);
        this.camera.position.z = 2;

        // Renderer with alpha for transparency
        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: false,         // Disable for performance
            powerPreference: 'low-power', // Optimize for efficiency
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Cap pixel ratio
        this.renderer.setClearColor(0x000000, 0); // Transparent background

        // Style the canvas
        this.renderer.domElement.style.position = 'fixed';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.style.zIndex = '-1';
        this.renderer.domElement.style.pointerEvents = 'none';

        this.container.appendChild(this.renderer.domElement);
    }

    createParticles() {
        const { particleCount, spread, depth, size, color1, color2, color3 } = this.config;

        // Geometry - simple points
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        const speeds = new Float32Array(particleCount);

        const colorOptions = [
            new THREE.Color(color1),
            new THREE.Color(color2),
            new THREE.Color(color3),
        ];

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;

            // Random positions
            positions[i3] = (Math.random() - 0.5) * spread;        // x
            positions[i3 + 1] = (Math.random() - 0.5) * 4 + 1;     // y (start above screen)
            positions[i3 + 2] = (Math.random() - 0.5) * depth - 1; // z

            // Random colors from palette
            const color = colorOptions[Math.floor(Math.random() * colorOptions.length)];
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;

            // Random sizes (variation)
            sizes[i] = size * (0.5 + Math.random() * 1.5);

            // Random speeds (variation)
            speeds[i] = this.config.dropSpeed * (0.5 + Math.random());
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        // Store speeds for animation
        this.speeds = speeds;

        // Custom shader material for soft glowing particles
        const material = new THREE.ShaderMaterial({
            uniforms: {
                opacity: { value: this.config.opacity },
            },
            vertexShader: `
        attribute float size;
        varying vec3 vColor;
        
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
            fragmentShader: `
        uniform float opacity;
        varying vec3 vColor;
        
        void main() {
          // Soft circular gradient
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

    animate = (timestamp = 0) => {
        if (!this.isRunning) return;

        requestAnimationFrame(this.animate);

        // Throttle to 30fps
        const delta = timestamp - this.lastFrame;
        if (delta < this.frameInterval) return;
        this.lastFrame = timestamp - (delta % this.frameInterval);

        // Update particle positions
        const positions = this.particles.geometry.attributes.position.array;
        const count = positions.length / 3;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;

            // Move down
            positions[i3 + 1] -= this.speeds[i];

            // Reset to top when below screen
            if (positions[i3 + 1] < -2.5) {
                positions[i3 + 1] = 2.5;
                positions[i3] = (Math.random() - 0.5) * this.config.spread;
            }

            // Subtle horizontal drift
            positions[i3] += (Math.random() - 0.5) * 0.001;
        }

        this.particles.geometry.attributes.position.needsUpdate = true;

        // Render
        this.renderer.render(this.scene, this.camera);
    }

    bindEvents() {
        // Handle resize
        window.addEventListener('resize', this.onResize.bind(this), { passive: true });

        // Pause when tab not visible (save resources!)
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
        this.particles.geometry.dispose();
        this.particles.material.dispose();
        this.renderer.dispose();
        this.container.removeChild(this.renderer.domElement);
    }
}

// Auto-initialize when DOM is ready
let dropEffect = null;

function initDropEffect() {
    // Create or use existing container
    let container = document.getElementById('drop-effect-container');
    if (!container) {
        container = document.body;
    }

    dropEffect = new DropEffect(container);
}

// Export for module usage
export { DropEffect, initDropEffect };

// Auto-init if not a module
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDropEffect);
} else {
    initDropEffect();
}
