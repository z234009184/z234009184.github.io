/**
 * Starfield + Meteor Background
 * Multi-layer starry sky with twinkling stars & shooting meteors
 */
(function () {
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas.getContext('2d');

  let width, height;
  let mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let stars = [];
  let meteors = [];
  let frame = 0;

  // ─── Config ────────────────────────────────
  const STAR_COUNT = 280;
  const LAYERS = [
    { count: 120, baseSize: 0.6, speed: 0.3, alphaBase: 0.5, distance: 800 },
    { count: 100, baseSize: 1.2, speed: 0.6, alphaBase: 0.7, distance: 500 },
    { count:  60, baseSize: 1.8, speed: 1.0, alphaBase: 0.9, distance: 300 },
  ];
  const METEOR_INTERVAL_MIN = 3000;
  const METEOR_INTERVAL_MAX = 8000;
  let nextMeteor = frame + randomInt(60, 200);
  const METEOR_COLORS = ['#ffffff', '#ffe9c4', '#d4bfff', '#a0d8ef', '#e8a838'];

  // ─── Helpers ───────────────────────────────
  function randomInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function randomFloat(a, b) { return Math.random() * (b - a) + a; }

  // ─── Star ──────────────────────────────────
  class Star {
    constructor(layer) {
      this.layer = layer;
      this.x = Math.random() * 200 - 100;  // % offset from center
      this.y = Math.random() * 200 - 100;
      this.z = layer.distance;
      this.size = layer.baseSize * randomFloat(0.4, 1.6);
      this.twinklePhase = randomFloat(0, Math.PI * 2);
      this.twinkleSpeed = randomFloat(0.008, 0.03);
      this.twinkleAmp = randomFloat(0.3, 0.7);
      this.hue = randomFloat(30, 60); // warm white-to-gold range
    }

    draw(ctx, ox, oy, layerSpeed) {
      // Parallax offset from mouse
      const px = this.x + ox / this.z * layerSpeed * 40;
      const py = this.y + oy / this.z * layerSpeed * 40;

      // Screen position
      const sx = width / 2 + (px / 100) * width / 2;
      const sy = height / 2 + (py / 100) * height / 2;

      if (sx < -10 || sx > width + 10 || sy < -10 || sy > height + 10) return;

      // Twinkle
      const twinkle = Math.sin(frame * this.twinkleSpeed + this.twinklePhase);
      const alpha = this.layer.alphaBase + twinkle * this.twinkleAmp;
      const clampedAlpha = Math.max(0.05, Math.min(1, alpha));

      const distFromCenter = Math.abs(py) / 100; // 0..1
      const size = this.size * (1 + twinkle * 0.3);

      ctx.beginPath();

      // Bright stars get a glow
      if (size > 1.5 && clampedAlpha > 0.5) {
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, size * 3);
        glow.addColorStop(0, `hsla(${this.hue}, 40%, 90%, ${clampedAlpha * 0.5})`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.arc(sx, sy, size * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${this.hue}, 20%, ${85 + twinkle * 15}%, ${clampedAlpha})`;
      ctx.fill();
    }
  }

  // ─── Meteor ────────────────────────────────
  class Meteor {
    constructor() {
      this.reset();
    }

    reset() {
      // Start from a random edge
      const edge = randomInt(0, 3);
      switch (edge) {
        case 0: // top
          this.x = randomFloat(0, width);
          this.y = -20;
          break;
        case 1: // right
          this.x = width + 20;
          this.y = randomFloat(0, height * 0.6);
          break;
        case 2: // bottom
          this.x = randomFloat(0, width);
          this.y = height + 20;
          break;
        case 3: // left
          this.x = -20;
          this.y = randomFloat(0, height * 0.6);
          break;
      }

      const angle = randomFloat(-0.8, -0.3); // downward angle
      const speed = randomFloat(4, 9);
      this.vx = Math.cos(angle) * speed;
      this.vy = -Math.sin(angle) * speed;
      this.len = randomInt(40, 120);
      this.color = METEOR_COLORS[randomInt(0, METEOR_COLORS.length - 1)];
      this.life = 1.0;
      this.decay = randomFloat(0.008, 0.025);
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.life -= this.decay;
    }

    draw(ctx) {
      if (this.life <= 0) return;
      const tailX = this.x - this.vx * this.len;
      const tailY = this.y - this.vy * this.len;

      const grad = ctx.createLinearGradient(this.x, this.y, tailX, tailY);
      grad.addColorStop(0, this.color);
      grad.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(tailX, tailY);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5 * this.life;
      ctx.globalAlpha = this.life;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Head glow
      if (this.life > 0.3) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2 * this.life, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life * 0.7;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  // ─── Setup ─────────────────────────────────
  function createStars() {
    stars = [];
    LAYERS.forEach((layer) => {
      for (let i = 0; i < layer.count; i++) {
        stars.push(new Star(layer));
      }
    });
  }

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  // ─── Animation Loop ────────────────────────
  function animate() {
    ctx.clearRect(0, 0, width, height);

    // Dark background gradient
    const bgGrad = ctx.createRadialGradient(width / 2, height * 0.4, 0, width / 2, height / 2, Math.max(width, height));
    bgGrad.addColorStop(0, '#0d0d18');
    bgGrad.addColorStop(1, '#05050a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle nebula glow
    const nx = width * 0.65 + (mouse.x / width * 100);
    const ny = height * 0.3 + (mouse.y / height * 60);
    const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, Math.min(width, height) * 0.5);
    ng.addColorStop(0, 'rgba(30, 20, 60, 0.12)');
    ng.addColorStop(0.5, 'rgba(20, 10, 40, 0.04)');
    ng.addColorStop(1, 'transparent');
    ctx.fillStyle = ng;
    ctx.fillRect(0, 0, width, height);

    const n2x = width * 0.3 - (mouse.x / width * 80);
    const n2y = height * 0.7 - (mouse.y / height * 40);
    const ng2 = ctx.createRadialGradient(n2x, n2y, 0, n2x, n2y, Math.min(width, height) * 0.35);
    ng2.addColorStop(0, 'rgba(40, 25, 15, 0.08)');
    ng2.addColorStop(1, 'transparent');
    ctx.fillStyle = ng2;
    ctx.fillRect(0, 0, width, height);

    // Draw stars
    const ox = mouse.x - width / 2;
    const oy = mouse.y - height / 2;
    stars.forEach(s => s.draw(ctx, ox, oy, s.layer.speed));

    // Meteors
    if (frame >= nextMeteor) {
      meteors.push(new Meteor());
      nextMeteor = frame + randomInt(METEOR_INTERVAL_MIN / 16, METEOR_INTERVAL_MAX / 16);
      // Occasionally spawn a pair
      if (Math.random() < 0.3) {
        meteors.push(new Meteor());
      }
    }

    for (let i = meteors.length - 1; i >= 0; i--) {
      meteors[i].update();
      if (meteors[i].life <= 0) {
        meteors.splice(i, 1);
      } else {
        meteors[i].draw(ctx);
      }
    }

    // Limit max meteors
    if (meteors.length > 6) meteors.splice(0, meteors.length - 6);

    // Smooth mouse interpolation
    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;

    frame++;
    requestAnimationFrame(animate);
  }

  // ─── Events ────────────────────────────────
  window.addEventListener('resize', () => { resize(); createStars(); });
  window.addEventListener('mousemove', (e) => {
    mouse.targetX = e.clientX;
    mouse.targetY = e.clientY;
  });
  window.addEventListener('mouseout', () => {
    mouse.targetX = width / 2;
    mouse.targetY = height / 2;
  });

  // Init
  resize();
  createStars();
  animate();
})();
