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
  particles = [];

function R() {
  w = window.innerWidth;
  h = window.innerHeight;
  c.width = w;
  c.height = h;
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
    let pressDuration = Date.now() - keyDownTime;
    if (pressDuration < 150) quickFlashPower = 80;
    else if (pressDuration < 500) quickFlashPower = 40;
  }
};

window.onresize = R;
R();

function L() {
  floatTimer += 0.1;
  let isIdle = mx === lastMx && my === lastMy;
  let fx = mx + (isIdle ? Math.sin(floatTimer) * 0.8 : 0);
  let fy = my + (isIdle ? Math.cos(floatTimer * 1.2) * 0.5 : 0);
  lastMx = mx;
  lastMy = my;

  // Regular particles
  if (Math.random() < 0.08) {
    particles.push({
      x: fx + (Math.random() - 0.5) * 8,
      y: fy + (Math.random() - 0.5) * 8,
      t: 0,
      isBurst: false,
    });
  }

  // Continuous fairy dust while holding spacebar
  if (charging && Math.random() < 0.4) {
    let angle = Math.random() * Math.PI * 2;
    let speed = 0.3 + Math.random() * 0.7;
    particles.push({
      x: fx + (Math.random() - 0.5) * 2,
      y: fy + (Math.random() - 0.5) * 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
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

  // Draw particles
  particles.forEach((p) => {
    let alpha = Math.sin(p.t * 3) * 0.4 + 0.3;
    if (alpha > 0) {
      x.fillStyle = `rgba(150,255,150,${alpha})`;
      x.beginPath();
      x.arc(p.x, p.y, 0.8, 0, Math.PI * 2);
      x.fill();
    }
  });

  // Draw firefly body
  x.fillStyle = "#444";
  x.beginPath();
  x.arc(fx, fy, 3, 0, Math.PI * 2);
  x.fill();

  // Draw glow
  let totalGlow = Math.max(glowPower, quickFlashPower);
  if (totalGlow > 0) {
    let i = Math.min(totalGlow / 100, 1);
    let size = 3 + i * 4;
    let blur = 15 + i * 25;
    let color = `rgb(${150 + i * 50},255,${120 + i * 40})`;

    x.shadowBlur = blur;
    x.shadowColor = color;
    x.fillStyle = color;
    x.beginPath();
    x.arc(fx, fy, size, 0, Math.PI * 2);
    x.fill();
    x.shadowBlur = 0;
  }

  requestAnimationFrame(L);
}
L();
