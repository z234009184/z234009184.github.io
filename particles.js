/**
 * Starfield + Meteor Background (Optimized)
 * Performance-focused: pre-rendered background, batched draws, DPR-aware.
 * Visually subtle: fewer/dimmer stars so content stays readable.
 */
(function () {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: false });

  // Respect users who prefer reduced motion
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── State ──────────────────────────────────
  let width = 0, height = 0, dpr = 1;
  let mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let stars = [];
  let meteors = [];
  let frame = 0;
  let nextMeteor = 0;

  // Off-screen canvas for the static background (drawn once per resize)
  let bgCanvas = null;
  let bgCtx = null;

  // ─── Config ─────────────────────────────────
  // Total stars dropped from 280 → 90 (≈70% fewer). Divided into layers.
  const LAYERS = [
    { count: 45, baseSize: 0.5, speed: 0.3, alphaBase: 0.18, twinkleAmp: 0.12 },
    { count: 30, baseSize: 0.9, speed: 0.6, alphaBase: 0.28, twinkleAmp: 0.18 },
    { count: 15, baseSize: 1.4, speed: 1.0, alphaBase: 0.42, twinkleAmp: 0.22 },
  ];
  const METEOR_INTERVAL_MIN = 4000;
  const METEOR_INTERVAL_MAX = 9000;
  const METEOR_COLORS = ['#ffffff', '#ffe9c4', '#a0d8ef'];

  // ─── Helpers ────────────────────────────────
  const randomInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const randomFloat = (a, b) => Math.random() * (b - a) + a;

  // ─── Star ───────────────────────────────────
  class Star {
    constructor(layer) {
      this.layer = layer;
      // Position in viewport space (px), not virtual 0-100 units
      this.x = 0;
      this.y = 0;
      this.size = layer.baseSize * randomFloat(0.5, 1.4);
      this.twinklePhase = randomFloat(0, Math.PI * 2);
      // Slower twinkle → fewer redraw "events" perceptually
      this.twinkleSpeed = randomFloat(0.004, 0.015);
      // Mostly cool whites with a few warm ones — less "white dot" feel
      this.hue = Math.random() < 0.85
        ? randomFloat(200, 230)   // cool blue-white
        : randomFloat(35, 50);    // warm gold accent
    }
  }

  // ─── Meteor ─────────────────────────────────
  class Meteor {
    constructor() { this.reset(); }

    reset() {
      const edge = randomInt(0, 3);
      switch (edge) {
        case 0: this.x = randomFloat(0, width); this.y = -20; break;
        case 1: this.x = width + 20; this.y = randomFloat(0, height * 0.5); break;
        case 2: this.x = randomFloat(0, width); this.y = height + 20; break;
        case 3: this.x = -20; this.y = randomFloat(0, height * 0.5); break;
      }
      const angle = randomFloat(-0.8, -0.3);
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

    draw(c) {
      if (this.life <= 0) return;
      const tailX = this.x - this.vx * this.len;
      const tailY = this.y - this.vy * this.len;
      const grad = c.createLinearGradient(this.x, this.y, tailX, tailY);
      grad.addColorStop(0, this.color);
      grad.addColorStop(1, 'transparent');
      c.beginPath();
      c.moveTo(this.x, this.y);
      c.lineTo(tailX, tailY);
      c.strokeStyle = grad;
      c.lineWidth = 1.5 * this.life;
      c.globalAlpha = this.life;
      c.stroke();
      c.globalAlpha = 1;
    }
  }

  // ─── Setup ──────────────────────────────────
  function createStars() {
    stars = [];
    for (const layer of LAYERS) {
      for (let i = 0; i < layer.count; i++) {
        const s = new Star(layer);
        s.x = Math.random() * width;
        s.y = Math.random() * height;
        stars.push(s);
      }
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2); // cap at 2x to avoid 4x cost
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels

    // Pre-render the static background once per resize
    buildBackground();
  }

  // Background is fully static — draw it ONCE and blit it every frame.
  function buildBackground() {
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = width;
    bgCanvas.height = height;
    bgCtx = bgCanvas.getContext('2d');

    // Base radial gradient
    const bg = bgCtx.createRadialGradient(
      width / 2, height * 0.4, 0,
      width / 2, height / 2, Math.max(width, height)
    );
    bg.addColorStop(0, '#0d0d18');
    bg.addColorStop(1, '#05050a');
    bgCtx.fillStyle = bg;
    bgCtx.fillRect(0, 0, width, height);

    // Two subtle nebula glows (cheaper to bake into one canvas)
    const n1 = bgCtx.createRadialGradient(
      width * 0.65, height * 0.3, 0,
      width * 0.65, height * 0.3, Math.min(width, height) * 0.5
    );
    n1.addColorStop(0, 'rgba(30, 20, 60, 0.10)');
    n1.addColorStop(1, 'transparent');
    bgCtx.fillStyle = n1;
    bgCtx.fillRect(0, 0, width, height);

    const n2 = bgCtx.createRadialGradient(
      width * 0.3, height * 0.7, 0,
      width * 0.3, height * 0.7, Math.min(width, height) * 0.35
    );
    n2.addColorStop(0, 'rgba(40, 25, 15, 0.07)');
    n2.addColorStop(1, 'transparent');
    bgCtx.fillStyle = n2;
    bgCtx.fillRect(0, 0, width, height);
  }

  // ─── Animation Loop ─────────────────────────
  function animate() {
    // Blit pre-rendered background — one drawImage per frame instead of 3 gradients
    if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0);

    // Mouse parallax offset (in CSS px)
    const ox = mouse.x - width / 2;
    const oy = mouse.y - height / 2;

    // Batched star draw: one path per layer, single fillStyle group
    // (huge win over the old per-star beginPath/fill)
    if (!reducedMotion) {
      for (const layer of LAYERS) {
        ctx.beginPath();
        for (const s of stars) {
          if (s.layer !== layer) continue;
          const px = s.x + ox * layer.speed * 0.04;
          const py = s.y + oy * layer.speed * 0.04;
          if (px < -2 || px > width + 2 || py < -2 || py > height + 2) continue;
          ctx.moveTo(px + s.size, py);
          ctx.arc(px, py, s.size, 0, Math.PI * 2);
        }
        ctx.fillStyle = layer._fillStyle || (layer._fillStyle = `hsla(0,0%,100%,${layer.alphaBase})`);
        ctx.fill();
      }

      // Subtle per-star twinkle: only redraw a small subset each frame
      // (10% of stars per frame on average — 9 path ops total vs 90)
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = frame % 4; i < stars.length; i += 4) {
        const s = stars[i];
        const tw = Math.sin(frame * s.twinkleSpeed + s.twinklePhase);
        const a = s.layer.alphaBase + tw * s.layer.twinkleAmp;
        if (a <= 0.05) continue;
        const px = s.x + ox * s.layer.speed * 0.04;
        const py = s.y + oy * s.layer.speed * 0.04;
        if (px < -2 || px > width + 2 || py < -2 || py > height + 2) continue;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(px, py, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      // Reduced motion: one batched static draw, no animation
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      for (const s of stars) {
        ctx.moveTo(s.x + s.size, s.y);
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    // Meteors — same logic as before, low frequency
    if (frame >= nextMeteor) {
      meteors.push(new Meteor());
      nextMeteor = frame + randomInt(METEOR_INTERVAL_MIN / 16, METEOR_INTERVAL_MAX / 16);
    }
    for (let i = meteors.length - 1; i >= 0; i--) {
      meteors[i].update();
      if (meteors[i].life <= 0) meteors.splice(i, 1);
      else meteors[i].draw(ctx);
    }
    if (meteors.length > 4) meteors.length = 4;

    // Smooth mouse interpolation
    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;

    frame++;
    requestAnimationFrame(animate);
  }

  // ─── Events ─────────────────────────────────
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); createStars(); }, 150);
  });
  window.addEventListener('mousemove', (e) => {
    mouse.targetX = e.clientX;
    mouse.targetY = e.clientY;
  });
  window.addEventListener('mouseout', () => {
    mouse.targetX = width / 2;
    mouse.targetY = height / 2;
  });

  // Pause animation when tab is hidden — saves CPU/battery
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (!rafId) {
      animate();
    }
  });

  // ─── Init ───────────────────────────────────
  let rafId = 0;
  resize();
  createStars();
  rafId = requestAnimationFrame(animate);
})();
