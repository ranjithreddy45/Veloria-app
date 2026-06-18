"use client";

// ============================================================
// celebrate() — a tiny, dependency-free confetti burst.
// Used for reward moments (earning Velos points, winning a deal, confirming a
// booking, hitting a target). Self-contained canvas, auto-removes, and honours
// prefers-reduced-motion. Purely cosmetic — never blocks or affects app logic.
// ============================================================

type CelebrateOptions = {
  /** Number of confetti particles. Default 90. */
  particleCount?: number;
  /** Horizontal origin 0–1 (0 = left, 1 = right). Default 0.5. */
  x?: number;
  /** Vertical origin 0–1 (0 = top, 1 = bottom). Default 0.35. */
  y?: number;
  /** Spread in degrees. Default 70. */
  spread?: number;
};

const COLORS = [
  "#7c3aed", // brand violet
  "#a78bfa",
  "#f59e0b", // gold
  "#34c759", // green
  "#ff5a8a", // pink
  "#22d3ee", // cyan
];

let lastFire = 0;

export function celebrate(opts: CelebrateOptions = {}): void {
  if (typeof window === "undefined") return;

  // Respect reduced-motion — no animation for users who opt out.
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  // Debounce so rapid triggers don't stack canvases.
  const now = Date.now();
  if (now - lastFire < 400) return;
  lastFire = now;

  const count = opts.particleCount ?? 90;
  const originX = (opts.x ?? 0.5) * window.innerWidth;
  const originY = (opts.y ?? 0.35) * window.innerHeight;
  const spread = ((opts.spread ?? 70) * Math.PI) / 180;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483647";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  type P = {
    x: number; y: number; vx: number; vy: number;
    rot: number; vr: number; size: number; color: string; life: number;
  };

  const baseAngle = -Math.PI / 2; // upward
  const particles: P[] = Array.from({ length: count }, () => {
    const angle = baseAngle + (Math.random() - 0.5) * spread;
    const speed = 6 + Math.random() * 8;
    return {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      size: 5 + Math.random() * 6,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      life: 1,
    };
  });

  const gravity = 0.32;
  const drag = 0.985;
  let frame = 0;

  function tick() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      p.vx *= drag;
      p.vy = p.vy * drag + gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 0.012;
      if (p.life > 0 && p.y < canvas.height + 40) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    }
    frame++;
    if (alive && frame < 240) {
      requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(tick);
}
