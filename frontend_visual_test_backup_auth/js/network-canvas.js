/**
 * HydroCybernetics Conceptual Platform Architecture Visual
 * 
 * Communicates the 4-tier cyber-physical framework:
 *   [01] PHYSICAL NETWORK
 *            ↓
 *   [02] DIGITAL TWIN
 *            ↓
 *   [03] HYDRAULIC SIMULATION
 *            ↓
 *   [04] DECISION SUPPORT
 * 
 * Note: This is an abstract conceptual visualization of system layers,
 * with NO simulated network topology, NO specific node/pipe IDs, and NO fake telemetry.
 */

class PlatformVisual {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.animationFrameId = null;
    this.time = 0;

    // 4 Architectural Tiers
    this.layers = [
      {
        num: '04',
        name: 'DECISION SUPPORT',
        detail: 'Municipal Guidance • Alert Dispatch • Public Information',
        color: '#2dd4bf',
        accent: 'rgba(45, 212, 191, 0.15)'
      },
      {
        num: '03',
        name: 'HYDRAULIC SIMULATION',
        detail: 'Physics-Based Modeling • Scenario Analysis • Divergence Calculation',
        color: '#14b8a6',
        accent: 'rgba(20, 184, 166, 0.12)'
      },
      {
        num: '02',
        name: 'DIGITAL TWIN',
        detail: 'Geospatial GIS Alignment • System State Synchronization',
        color: '#38bdf8',
        accent: 'rgba(56, 189, 248, 0.12)'
      },
      {
        num: '01',
        name: 'PHYSICAL NETWORK',
        detail: 'Distribution Mains • Field Transducers • Flow Meters • Reservoirs',
        color: '#94a3b8',
        accent: 'rgba(148, 163, 184, 0.10)'
      }
    ];

    this.particles = [];
    this.initParticles();
    this.resize();

    this.handleResize = this.resize.bind(this);
    window.addEventListener('resize', this.handleResize);

    this.start();
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < 18; i++) {
      this.particles.push({
        xOffset: 0.2 + Math.random() * 0.6,
        progress: Math.random(),
        speed: 0.002 + Math.random() * 0.003,
        size: 1.5 + Math.random() * 1.5,
        color: i % 2 === 0 ? '#2dd4bf' : '#38bdf8'
      });
    }
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  start() {
    const render = () => {
      this.draw();
      this.animationFrameId = requestAnimationFrame(render);
    };
    render();
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.handleResize);
  }

  draw() {
    if (!this.ctx || !this.width || !this.height) return;

    this.time += 0.015;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Clear background
    ctx.fillStyle = '#0b192c';
    ctx.fillRect(0, 0, w, h);

    // Subtle Architectural Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridSize = 28;

    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Geometry Bounds for Tier Blocks
    const paddingX = 24;
    const paddingY = 48;
    const availableHeight = h - paddingY * 2;
    const layerHeight = 44;
    const spacing = (availableHeight - layerHeight * 4) / 3;

    // Draw Vertical Flow Channels (Coupling lines between layers)
    const channelPositions = [0.25, 0.5, 0.75];
    channelPositions.forEach(relX => {
      const cx = w * relX;
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(cx, paddingY + layerHeight / 2);
      ctx.lineTo(cx, paddingY + 3 * (layerHeight + spacing) + layerHeight / 2);
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.2)';
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.setLineDash([]); // Reset
    });

    // Animate subtle data flow pulses moving up/down the channels
    this.particles.forEach(p => {
      p.progress += p.speed;
      if (p.progress > 1) {
        p.progress = 0;
        p.xOffset = 0.2 + Math.random() * 0.6;
      }

      const px = w * p.xOffset;
      const startY = paddingY + 3 * (layerHeight + spacing);
      const endY = paddingY;
      const py = startY - (startY - endY) * p.progress;

      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Render the 4 Architecture Tier Blocks
    this.layers.forEach((layer, idx) => {
      const topY = paddingY + idx * (layerHeight + spacing);
      const blockWidth = w - paddingX * 2;

      // Tier Container Background
      ctx.fillStyle = 'rgba(16, 35, 59, 0.85)';
      ctx.strokeStyle = idx === 0 ? 'rgba(45, 212, 191, 0.4)' : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;

      // Rounded Block
      const r = 6;
      ctx.beginPath();
      ctx.roundRect(paddingX, topY, blockWidth, layerHeight, r);
      ctx.fill();
      ctx.stroke();

      // Left Accent Strip
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.roundRect(paddingX, topY, 4, layerHeight, [r, 0, 0, r]);
      ctx.fill();

      // Tier Number Tag
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillStyle = layer.color;
      ctx.fillText(`[${layer.num}]`, paddingX + 14, topY + 26);

      // Tier Title
      ctx.font = '600 12px "Inter", sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(layer.name, paddingX + 48, topY + 26);

      // Connector Arrow between tiers (if not bottom layer)
      if (idx < 3) {
        const arrowY = topY + layerHeight + spacing / 2;
        ctx.beginPath();
        ctx.moveTo(w / 2, arrowY - 4);
        ctx.lineTo(w / 2, arrowY + 4);
        ctx.strokeStyle = 'rgba(45, 212, 191, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
  }
}

window.NetworkCanvas = PlatformVisual;
window.PlatformVisual = PlatformVisual;
