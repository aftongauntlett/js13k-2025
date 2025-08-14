// js13k-2025 Black Cat - Firefly
const c = document.getElementById("c"),
  x = c.getContext("2d");
let w,
  h,
  mx = 0,
  my = 0,
  glowPower = 0,
  charging = false,
  maxed = false,
  flashTimer = 0,
  keyDownTime = 0,
  quickFlashPower = 0,
  floatTimer = 0,
  lastMx = 0,
  lastMy = 0,
  particles = [],
  otherFireflies = [],
  score = 0;

function R() {
  w = window.innerWidth;
  h = window.innerHeight;
  c.width = w;
  c.height = h;
}

function spawnFirefly() {
  otherFireflies.push({
    x: Math.random() * w,
    y: Math.random() * h,
    floatTimer: Math.random() * Math.PI * 2,
    flashTimer: Math.random() * Math.PI * 2,
    glowPhase: Math.random() * Math.PI * 2,
    rescued: false,
    rescueTimer: 0,
    vx: 0,
    vy: 0,
  });
}

c.onmousemove = (e) => {
  mx = e.clientX;
  my = e.clientY;
};

document.onkeydown = (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (!charging) {
      keyDownTime = Date.now();
      charging = true;
    }
  }
};

document.onkeyup = (e) => {
  if (e.code === "Space") {
    charging = false;
    let d = Date.now() - keyDownTime;
    if (d < 150) quickFlashPower = 80;
    else if (d < 500) quickFlashPower = 40;
  }
};

window.onresize = R;
R();

for (let i = 0; i < 4; i++) spawnFirefly();

function L() {
  floatTimer += 0.1;
  let isIdle = mx === lastMx && my === lastMy;
  let fx = mx + (isIdle ? Math.sin(floatTimer) * 0.8 : 0);
  let fy = my + (isIdle ? Math.cos(floatTimer * 1.2) * 0.5 : 0);
  lastMx = mx;
  lastMy = my;

  if (Math.random() < 0.08) {
    particles.push({
      x: fx + (Math.random() - 0.5) * 8,
      y: fy + (Math.random() - 0.5) * 8,
      t: 0,
      isBurst: false,
    });
  }

  if (charging && Math.random() < 0.4) {
    let a = Math.random() * Math.PI * 2;
    let s = 0.3 + Math.random() * 0.7;
    particles.push({
      x: fx + (Math.random() - 0.5) * 2,
      y: fy + (Math.random() - 0.5) * 2,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      t: 0,
      isBurst: true,
    });
  }

  particles = particles.filter((p) => {
    p.t += 0.04;
    if (p.isBurst) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.995;
      p.vy *= 0.995;
    }
    return p.t < 3.5;
  });

  otherFireflies.forEach((f) => {
    if (f.rescued) return;

    f.floatTimer += 0.08 + Math.random() * 0.04;
    f.x += Math.sin(f.floatTimer) * 0.3;
    f.y += Math.cos(f.floatTimer * 1.3) * 0.2;
    f.flashTimer += 0.05 + Math.random() * 0.03;
    f.glowPhase += 0.1;

    if (charging || glowPower > 20) {
      let dx = fx - f.x,
        dy = fy - f.y;
      let dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 200) {
        let force = ((charging ? 0.03 : 0.01) * (200 - dist)) / 200;
        f.vx += (dx / dist) * force;
        f.vy += (dy / dist) * force;
      }

      f.x += f.vx;
      f.y += f.vy;
      f.vx *= 0.98;
      f.vy *= 0.98;

      if (dist < 25) {
        f.rescued = true;
        f.rescueTimer = 0;
        score++;
        for (let i = 0; i < 8; i++) {
          let a = (i / 8) * Math.PI * 2;
          particles.push({
            x: f.x,
            y: f.y,
            vx: Math.cos(a) * 2,
            vy: Math.sin(a) * 2 - 1,
            t: 0,
            isBurst: true,
          });
        }
        setTimeout(() => spawnFirefly(), 1000 + Math.random() * 2000);
      }
    }
  });

  otherFireflies = otherFireflies.filter((f) => !f.rescued || f.y > -50);

  if (charging && glowPower < 120) glowPower += 1.5;
  else if (!charging && glowPower > 0) glowPower -= glowPower > 100 ? 0.3 : 1;

  if (quickFlashPower > 0) quickFlashPower -= 4;

  maxed = glowPower > 100;
  if (maxed) {
    flashTimer += 0.3;
    if (Math.sin(flashTimer) < -0.7) glowPower = 0;
  }

  x.fillStyle = "#101020";
  x.fillRect(0, 0, w, h);

  particles.forEach((p) => {
    let alpha = Math.sin(p.t * 3) * 0.4 + 0.3;
    if (alpha > 0) {
      x.fillStyle = `rgba(150,255,150,${alpha})`;
      x.beginPath();
      x.arc(p.x, p.y, 0.8, 0, Math.PI * 2);
      x.fill();
    }
  });

  otherFireflies.forEach((f) => {
    if (f.rescued) {
      f.rescueTimer += 0.1;
      f.y -= 2 + f.rescueTimer * 0.5;
      f.x += Math.sin(f.rescueTimer * 2) * 1.5;
    }

    x.fillStyle = "#333";
    x.beginPath();
    x.arc(f.x, f.y, 2.5, 0, Math.PI * 2);
    x.fill();

    let g1 = Math.sin(f.flashTimer) * 0.5 + 0.5;
    let g2 = Math.sin(f.glowPhase * 0.7) * 0.3 + 0.7;
    let glow = g1 * g2;

    if (f.rescued && f.rescueTimer < 1) glow = 1;

    if (glow > 0.3) {
      let size = 2 + glow * 3;
      let blur = 8 + glow * 15;
      let color =
        f.rescued && f.rescueTimer < 1
          ? `rgb(255,255,${200 + Math.sin(f.rescueTimer * 20) * 55})`
          : `rgb(${120 + glow * 80},255,${100 + glow * 80})`;

      x.shadowBlur = blur;
      x.shadowColor = color;
      x.fillStyle = color;
      x.beginPath();
      x.arc(f.x, f.y, size, 0, Math.PI * 2);
      x.fill();
      x.shadowBlur = 0;
    }
  });

  x.fillStyle = "#444";
  x.beginPath();
  x.arc(fx, fy, 3, 0, Math.PI * 2);
  x.fill();

  let totalGlow = Math.max(glowPower, quickFlashPower);
  if (totalGlow > 0) {
    let i = Math.min(totalGlow / 100, 1);
    let size = 3 + i * 4;
    let blur = 15 + i * 25;
    let color = `rgb(${100 + i * 100},${150 + i * 105},255)`;

    x.shadowBlur = blur;
    x.shadowColor = color;
    x.fillStyle = color;
    x.beginPath();
    x.arc(fx, fy, size, 0, Math.PI * 2);
    x.fill();
    x.shadowBlur = 0;
  }

  x.fillStyle = "rgba(255,255,255,0.7)";
  x.font = "16px monospace";
  x.fillText(`Rescued: ${score}`, 20, 30);

  requestAnimationFrame(L);
}
L();
