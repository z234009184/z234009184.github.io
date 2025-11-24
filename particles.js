/**
 * Top-Down Water Ripple Particle Animation
 * Creates a 3D grid of particles that ripple like water from the mouse position
 */

const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
// Mouse position in 3D grid space (approximate)
let mouse = { x: 0, y: 0, active: false };
// Ripple center physics
let rippleCenter = { x: 0, y: 0, vx: 0, vy: 0 };
let time = 0;

// Configuration
const config = {
    particleSpacing: 25,
    rows: 0,
    cols: 0,
    waveSpeed: 0.025, // Slower speed (was 0.05)
    waveAmplitude: 35,
    waveFrequency: 0.02, // Slightly looser waves
    focalLength: 300,
    viewAngle: 0.8,
    baseY: 100,
    colors: ['#4facfe', '#00f2fe', '#00d4ff'],
    // Physics config
    springStrength: 0.005, // Low strength = heavy feel (slow acceleration)
    friction: 0.90 // Damping to prevent endless oscillation
};

class Particle {
    constructor(x, z) {
        this.x = x; // Grid X
        this.y = 0; // Grid Y (Height)
        this.z = z; // Grid Z (Depth)

        this.ox = x;
        this.oz = z;

        this.size = 1.2;
        this.color = config.colors[Math.floor(Math.random() * config.colors.length)];
    }

    update() {
        // Calculate distance from the physics-based "ripple center"
        const dx = this.ox - rippleCenter.x;
        const dz = this.oz - rippleCenter.y; // rippleCenter.y maps to Z depth
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Radial Sine Wave Function
        this.y = Math.sin(distance * config.waveFrequency - time * 2) * config.waveAmplitude;
    }

    draw() {
        // 3D Projection with Rotation
        // Rotate around X axis to get top-down view
        // y' = y*cos(theta) - z*sin(theta)
        // z' = y*sin(theta) + z*cos(theta)

        const cos = Math.cos(config.viewAngle);
        const sin = Math.sin(config.viewAngle);

        const rx = this.x;
        const ry = this.y * cos - this.z * sin; // Rotated Y
        const rz = this.y * sin + this.z * cos; // Rotated Z

        // Perspective Projection
        const depth = config.focalLength + rz + 600; // Push back
        const scale = config.focalLength / depth;

        if (scale > 0) {
            const screenX = rx * scale + width / 2;
            const screenY = (ry + config.baseY) * scale + height / 2;

            // Size attenuation
            const size = this.size * scale * 2;

            ctx.beginPath();
            ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;

            // Depth-based opacity (fog)
            // Particles further back (higher z) should be dimmer
            // In our rotated view, 'rz' represents depth
            let alpha = (1 - (rz + 500) / 2000);
            alpha = Math.max(0, Math.min(1, alpha));

            ctx.globalAlpha = alpha;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }
}

function init() {
    resize();
    createParticles();
    animate();
}

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;

    // Grid needs to be larger than screen to cover rotation gaps
    config.cols = Math.ceil(width / config.particleSpacing) + 30;
    config.rows = Math.ceil(height / config.particleSpacing) + 30;
}

function createParticles() {
    particles = [];

    const startX = -(config.cols * config.particleSpacing) / 2;
    const startZ = -(config.rows * config.particleSpacing) / 2;

    for (let i = 0; i < config.cols; i++) {
        for (let j = 0; j < config.rows; j++) {
            const x = startX + i * config.particleSpacing;
            const z = startZ + j * config.particleSpacing;
            particles.push(new Particle(x, z));
        }
    }
}

function animate() {
    ctx.clearRect(0, 0, width, height);

    time += config.waveSpeed;

    // Update Ripple Center Physics
    // Target is mouse if active, or a wandering point if idle
    let targetX = mouse.active ? mouse.x : Math.sin(time * 0.5) * 200;
    let targetY = mouse.active ? mouse.y : Math.cos(time * 0.5) * 200;

    // Spring force: F = (target - current) * k
    const fx = (targetX - rippleCenter.x) * config.springStrength;
    const fy = (targetY - rippleCenter.y) * config.springStrength;

    // Acceleration: v += F
    rippleCenter.vx += fx;
    rippleCenter.vy += fy;

    // Friction: v *= friction
    rippleCenter.vx *= config.friction;
    rippleCenter.vy *= config.friction;

    // Position: p += v
    rippleCenter.x += rippleCenter.vx;
    rippleCenter.y += rippleCenter.vy;

    // Sort by depth (Rotated Z) for correct occlusion
    // We need to calculate rotated Z for sorting
    const sin = Math.sin(config.viewAngle);
    const cos = Math.cos(config.viewAngle);

    particles.sort((a, b) => {
        const az = a.y * sin + a.z * cos;
        const bz = b.y * sin + b.z * cos;
        return bz - az;
    });

    particles.forEach(particle => {
        particle.update();
        particle.draw();
    });

    requestAnimationFrame(animate);
}

// Event Listeners
window.addEventListener('resize', () => {
    resize();
    createParticles();
});

window.addEventListener('mousemove', (e) => {
    mouse.active = true;
    // Map screen coordinates to 3D grid coordinates (Rough approximation)
    // Center is (0,0)
    mouse.x = (e.clientX - width / 2) * 2;
    mouse.y = (e.clientY - height / 2) * 2; // In top-down view, screen Y maps to Z
});

window.addEventListener('mouseout', () => {
    mouse.active = false;
});

// Start
init();
