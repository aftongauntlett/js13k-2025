// js13k-2025: The Cat & the Luminid - Clean Rebuild
// A firefly collection game where you guide light to feed an ancient cat

// ===== CONSTANTS & CONFIGURATION =====
const TAU = Math.PI * 2;
const F = Math.floor;
const r = Math.random;
const sin = Math.sin;
const cos = Math.cos;

// Game balance constants
const CFG = {
  catEyeRadius: 40,
  warnFrames: 180,      // 3 seconds warning before eye color change
  flash1: 60,           // First warning flash timing
  flash2: 120,          // Second flash timing  
  flash3: 150,          // Third flash timing
  shieldCooldown: 240,  // 4 seconds between shield uses
  maxFireflies: 25,     // Population limit
  deliveryRadius: 80,   // Delivery zone size
};

// ===== UTILITY FUNCTIONS =====

// Math utilities
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const hyp = (dx, dy) => Math.hypot(dx, dy);
const d2 = (ax, ay, bx, by) => { ax -= bx; ay -= by; return ax * ax + ay * ay; };

// Canvas shortcuts
const setFill = (color) => x.fillStyle = color;
const setStroke = (color) => x.strokeStyle = color;
const setLineWidth = (width) => x.lineWidth = width;
const BLACK = (alpha = 1) => `rgba(0,0,0,${alpha})`;

// Game state helpers
const getDifficulty = () => F(score / 50);
const getSpeedMultiplier = () => 1 + (score / 200);
const getRequiredFireflies = () => Math.max(1, F(score / 100) + 1);

// ===== AUDIO SYSTEM =====
let a; // AudioContext

// Initialize audio context when needed
const initAudio = () => {
  if (!a) {
    try {
      a = new AudioContext();
      if (a.state === 'suspended') a.resume();
    } catch (err) {
      return false;
    }
  }
  return true;
};

// Simple tone generator for sound effects
const playTone = (freq, duration = 0.2, volume = 0.1) => {
  if (!audioEnabled || !initAudio()) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.frequency.value = freq;
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.01, a.currentTime + duration);
  osc.connect(gain).connect(a.destination);
  osc.start();
  osc.stop(a.currentTime + duration);
};

// ===== GAME STATE VARIABLES =====

// Canvas and rendering
let c, x, w, h;

// Mouse state
let mx = 0, my = 0, lastMx = 0, lastMy = 0;
let mousePressed = false, mouseDownTime = 0;
let mouseMoving = false, lastMovementTime = 0;
let mouseInBounds = true;

// Player state
let charging = false;
let glowPower = 0, flashTimer = 0, quickFlashPower = 0;
let manaEnergy = 100;
let summonHeat = 0, summonOverheated = false, overheatStunned = false;

// Shield system
let shieldActive = false, shieldCooldown = 0, lastShieldTime = 0;

// Game state
let score = 0, gameStarted = true, gameOver = false;
let totalCollected = 0, totalLost = 0;
let startTime = null, runStartTime = null;
let audioEnabled = true, pageVisible = true;

// Cat system
let catEyeColor = "gold", catEyeChangeTimer = 0, nextColorChangeTime = 600;
let lastWarningState = false, colorChangesEnabled = true;
let mouseNearCat = false, catProximity = 0;

// Tutorial system
let tutorialComplete = localStorage.getItem('tutorialComplete') === 'true';
let tutorialStep = 0, firstDeliveryMade = false, tutorialTimer = 0;
let showHelp = false;

// Game objects
let particles = [];
let otherFireflies = [];
let scoreTexts = [];
let clickSparkles = [];
let stars = [];
let catEyes = [];

// ===== STAR BACKGROUND SYSTEM =====

// Initialize star field
const initStars = () => {
  stars = [];
  for (let i = 0; i < 150; i++) {
    stars.push({
      x: r() * w,
      y: r() * h,
      size: r() * 2 + 0.5,
      alpha: r() * 0.8 + 0.2,
      twinkleSpeed: r() * 0.02 + 0.01,
      twinkleOffset: r() * TAU,
    });
  }
};

// Render animated star background
const drawStars = (now) => {
  setFill("#0a0a1a"); // Deep night background
  x.fillRect(0, 0, w, h);
  
  stars.forEach(star => {
    // Gentle twinkling animation
    const twinkle = sin(now * star.twinkleSpeed + star.twinkleOffset) * 0.3 + 0.7;
    const alpha = star.alpha * twinkle;
    
    setFill(`rgba(255, 255, 255, ${alpha})`);
    x.beginPath();
    x.arc(star.x, star.y, star.size, 0, TAU);
    x.fill();
  });
};

// ===== FOREST BACKGROUND SYSTEM =====

// Draw atmospheric forest silhouettes
const drawForest = () => {
  // Ground layer
  setFill("#1a1a0a");
  x.fillRect(0, h * 0.8, w, h * 0.2);
  
  // Tree silhouettes - simple but atmospheric
  setFill("#0d0d0d");
  
  // Left side trees
  drawTree(w * 0.05, h * 0.8, 80, 120);
  drawTree(w * 0.15, h * 0.75, 100, 150);
  drawTree(w * 0.25, h * 0.82, 60, 100);
  
  // Right side trees
  drawTree(w * 0.75, h * 0.85, 70, 110);
  drawTree(w * 0.85, h * 0.78, 90, 140);
  drawTree(w * 0.95, h * 0.83, 65, 95);
  
  // Distant mountain silhouettes
  setFill("#0f0f0f");
  x.beginPath();
  x.moveTo(0, h * 0.6);
  x.lineTo(w * 0.3, h * 0.4);
  x.lineTo(w * 0.7, h * 0.5);
  x.lineTo(w, h * 0.3);
  x.lineTo(w, h);
  x.lineTo(0, h);
  x.closePath();
  x.fill();
};

// Simple tree silhouette helper
const drawTree = (x_pos, y_pos, width, height) => {
  // Trunk
  const trunkWidth = width * 0.2;
  x.fillRect(x_pos - trunkWidth / 2, y_pos, trunkWidth, height * 0.3);
  
  // Crown - organic irregular shape
  x.beginPath();
  x.arc(x_pos, y_pos - height * 0.2, width * 0.6, 0, TAU);
  x.fill();
  
  // Additional crown layers for depth
  x.beginPath();
  x.arc(x_pos - width * 0.2, y_pos - height * 0.4, width * 0.4, 0, TAU);
  x.fill();
  
  x.beginPath();
  x.arc(x_pos + width * 0.15, y_pos - height * 0.35, width * 0.45, 0, TAU);
  x.fill();
};

// ===== CAT SYSTEM =====

// Whisker constants from original
const WHISKERS = [
  { len: 110, yOff: 45, spread: -25 }, // top
  { len: 120, yOff: 55, spread: 0 },   // middle (longest)
  { len: 110, yOff: 65, spread: 25 }   // bottom
];

// Helper function for cat eye color logic
const getCatEyeColors = () => {
  switch (catEyeColor) {
    case "gold": return { hex: "#ffdd00", r: 255, g: 221, b: 0 };
    case "purple": return { hex: "#8844ff", r: 136, g: 68, b: 255 };
    case "pink": return { hex: "#ff44aa", r: 255, g: 68, b: 170 };
    default: return { hex: "#ffdd00", r: 255, g: 221, b: 0 };
  }
};

// Initialize cat eyes
const initCatEyes = () => {
  catEyes = [{ x: w / 2, y: h * 0.1, blinkTimer: 0, isBlinking: false, blinkDuration: 0 }];
};

// Optimized whisker drawing function
const drawWhiskers = (dir, eyeX, eyeY, twitch, now) => {
  const baseX = eyeX + dir * 130;
  
  for (let i = 0; i < WHISKERS.length; i++) {
    const w = WHISKERS[i];
    const sy = eyeY + w.yOff;
    const ex = baseX + dir * w.len;
    const ey = sy + w.spread + twitch;

    // Main whisker line
    x.beginPath();
    x.moveTo(baseX, sy);
    x.lineTo(ex, ey);
    x.stroke();

    // Stars: 2 on middle whisker, 1 on others
    const starCount = i === 1 ? 2 : 1;
    for (let s = 0; s < starCount; s++) {
      const pos = starCount === 2 ? (s + 1) / 3 : 0.6;
      const sx = baseX + dir * (w.len * pos);
      const sy2 = sy + w.spread * pos;

      // Unified twinkle formula
      let tw = sin(now * 0.001 + s * 2.2 + i * 3.1) * 0.5 + 0.5;
      tw += catProximity * 0.5; // Keep proximity boost
      const alpha = 0.3 + Math.min(0.7, tw * 0.7);

      // Draw star
      setFill(`rgba(255, 255, 255, ${alpha})`);
      x.beginPath();
      x.arc(sx, sy2, 1.5, 0, TAU);
      x.fill();

      // Subtle glow for brighter stars
      if (tw > 0.7) {
        x.shadowBlur = 3;
        x.shadowColor = `rgba(255, 255, 255, 0.5)`;
        x.beginPath();
        x.arc(sx, sy2, 0.75, 0, TAU);
        x.fill();
        x.shadowBlur = 0; // Reset
      }
    }
  }
};

// Draw the complete cat face with eyes, nose, and whiskers
const drawCatEyes = (now) => {
  if (catEyes.length === 0) return;
  
  const eye = catEyes[0];
  const eyeX = eye.x;
  const eyeY = eye.y;

  // Calculate mouse proximity to cat's face for interactive effects
  const noseX = w / 2;
  const noseY = h * 0.2;
  const dx = mx - noseX;
  const dy = my - noseY;
  const distSq = dx * dx + dy * dy;
  catProximity = Math.max(0, 1 - hyp(dx, dy) / 150); // 0-1 based on distance
  mouseNearCat = distSq < CFG.deliveryRadius * CFG.deliveryRadius;

  // Check if we're in the warning period
  const timeUntilChange = nextColorChangeTime - catEyeChangeTimer;
  const isWarning = timeUntilChange <= CFG.warnFrames;
  let flashIntensity = 1;
  
  if (isWarning && otherFireflies.some(f => f.captured)) {
    const flashPhase = CFG.warnFrames - timeUntilChange;
    const shouldFlash = 
      (flashPhase >= CFG.flash1 && flashPhase < CFG.flash1 + 20) ||
      (flashPhase >= CFG.flash2 && flashPhase < CFG.flash2 + 20) ||
      (flashPhase >= CFG.flash3 && flashPhase < CFG.flash3 + 20);
    
    if (shouldFlash) {
      flashIntensity = 1.5; // Enhanced flash
    }
  }

  // Get color based on current cat eye color
  const colors = getCatEyeColors();
  const eyeColor = colors.hex;
  const shadowColor = colors.hex + "ff";

  // Mouse tracking for pupils
  const mouseDistX = mx - eyeX;
  const mouseDistY = my - eyeY;
  const maxPupilMove = 12;
  const pupilOffsetX = clamp(mouseDistX * 0.04, -maxPupilMove, maxPupilMove);
  const pupilOffsetY = clamp(mouseDistY * 0.04, -maxPupilMove, maxPupilMove);

  if (!eye.isBlinking) {
    // Apply flash intensity to the glow
    x.shadowColor = shadowColor;
    x.shadowBlur = 50 * flashIntensity;

    // Left eye - tilted oval
    x.save();
    x.translate(eyeX - 100, eyeY);
    x.rotate(0.3);
    x.fillStyle = eyeColor + F(215 * flashIntensity).toString(16).padStart(2, '0');
    x.beginPath();
    x.ellipse(0, 0, 70, 30, 0, 0, TAU);
    x.fill();
    x.restore();

    // Right eye - tilted oval
    x.save();
    x.translate(eyeX + 100, eyeY);
    x.rotate(-0.3);
    x.fillStyle = eyeColor + F(215 * flashIntensity).toString(16).padStart(2, '0');
    x.beginPath();
    x.ellipse(0, 0, 70, 30, 0, 0, TAU);
    x.fill();
    x.restore();

    x.shadowBlur = 0;

    // Diamond pupils
    x.fillStyle = "#000";

    // Left pupil
    x.save();
    x.translate(eyeX - 100 + pupilOffsetX, eyeY + pupilOffsetY);
    x.rotate(0.3);
    x.beginPath();
    x.moveTo(0, -12);
    x.lineTo(6, 0);
    x.lineTo(0, 12);
    x.lineTo(-6, 0);
    x.closePath();
    x.fill();
    x.restore();

    // Right pupil
    x.save();
    x.translate(eyeX + 100 + pupilOffsetX, eyeY + pupilOffsetY);
    x.rotate(-0.3);
    x.beginPath();
    x.moveTo(0, -12);
    x.lineTo(6, 0);
    x.lineTo(0, 12);
    x.lineTo(-6, 0);
    x.closePath();
    x.fill();
    x.restore();
  }

  // Cat nose and whiskers - OUTSIDE the blinking check so they stay visible
  let noseAlpha = 0.4;
  let noseGlow = 0;
  
  // Make nose glow based on mouse proximity
  if (mouseNearCat) {
    const proximityTwinkle = sin(now * 0.015) * 0.5 + 0.5;
    noseAlpha = 0.4 + (catProximity * 0.6) + (proximityTwinkle * catProximity * 0.3);
    noseGlow = (catProximity * 25) + (proximityTwinkle * catProximity * 10);
  }
  
  x.strokeStyle = `rgba(255, 255, 255, ${noseAlpha})`;
  x.lineWidth = 1.5;
  x.globalAlpha = noseAlpha;
  
  // Add glow effect when twinkling
  if (noseGlow > 0) {
    x.shadowBlur = noseGlow;
    x.shadowColor = `rgba(255, 255, 255, 0.8)`;
  }
  
  x.beginPath();
  x.moveTo(eyeX - 8, eyeY + 40);
  x.lineTo(eyeX + 8, eyeY + 40);
  x.lineTo(eyeX, eyeY + 52);
  x.closePath();
  x.stroke();
  
  // Reset shadow
  x.shadowBlur = 0;

  // Cat whiskers - enhanced with mouse proximity effects
  const whiskerBreathing = sin(now * 0.002) * 0.5 + 0.5;
  const proximityEffect = catProximity * 0.6;
  const whiskerAlpha = 0.3 + (whiskerBreathing * 0.4) + proximityEffect;
  const whiskerGlow = (whiskerBreathing * 8) + (catProximity * 15);
  
  // Add twitch effect when mouse is very close
  const whiskerTwitch = mouseNearCat ? sin(now * 0.02) * catProximity * 3 : 0;
  
  // Batch canvas state for whiskers
  setStroke(`rgba(255, 255, 255, ${Math.min(1, whiskerAlpha)})`);
  setLineWidth(1);
  x.globalAlpha = Math.min(1, whiskerAlpha);
  
  // Add gentle glow to whiskers
  if (whiskerGlow > 0) {
    x.shadowBlur = whiskerGlow;
    x.shadowColor = `rgba(255, 255, 255, 0.3)`;
  }
  
  // Draw left and right whiskers
  drawWhiskers(-1, eyeX, eyeY, whiskerTwitch, now);
  drawWhiskers(1, eyeX, eyeY, whiskerTwitch, now);

  // Reset shadow effects and alpha
  x.shadowBlur = 0;
  x.globalAlpha = 1;
};

// Update cat eye color changes and warnings
const updateCatEyes = (now) => {
  catEyeChangeTimer++;
  
  // Warning system - gives player time to react
  const timeUntilChange = nextColorChangeTime - catEyeChangeTimer;
  const isWarning = timeUntilChange <= CFG.warnFrames;
  
  // Play warning sound when warning period starts
  if (isWarning && !lastWarningState && otherFireflies.some(f => f.captured)) {
    playTone(1000, 0.1, 0.08);
  }
  lastWarningState = isWarning;
  
  // Time for color change
  if (catEyeChangeTimer >= nextColorChangeTime) {
    handleColorChange(now);
    setNextColorChangeTime();
  }
  
  // Update blinking animation
  catEyes.forEach(eye => {
    eye.blinkTimer++;
    if (!eye.isBlinking && eye.blinkTimer > 1200) { // Blink every 20 seconds
      eye.isBlinking = true;
      eye.blinkDuration = 10;
      eye.blinkTimer = 0;
    } else if (eye.isBlinking) {
      eye.blinkDuration--;
      if (eye.blinkDuration <= 0) {
        eye.isBlinking = false;
      }
    }
  });
};

// Handle color change mechanics and shield protection
const handleColorChange = (now) => {
  const capturedFireflies = otherFireflies.filter(f => f.captured);
  
  if (capturedFireflies.length === 0) {
    // No fireflies captured - just change color
    changeToNewColor();
    return;
  }
  
  // Check shield protection
  if (shieldActive) {
    handleShieldProtection(capturedFireflies, now);
  } else {
    // No shield - full penalty
    handleNoPenalty(capturedFireflies);
  }
  
  changeToNewColor();
};

// Shield protection with timing-based effectiveness
const handleShieldProtection = (capturedFireflies, now) => {
  const warningPhase = nextColorChangeTime - catEyeChangeTimer;
  let protectionRate, timingQuality;
  
  // Timing-based shield effectiveness
  if (warningPhase >= CFG.flash2 && warningPhase <= CFG.flash3) {
    protectionRate = 1.0; // Perfect timing - 100% protection
    timingQuality = "PERFECT";
  } else if (warningPhase >= CFG.flash1 && warningPhase <= CFG.flash2) {
    protectionRate = 0.85; // Great timing - 85% protection  
    timingQuality = "GREAT";
  } else if (warningPhase >= CFG.flash3 && warningPhase <= CFG.warnFrames) {
    protectionRate = 0.7; // Good timing - 70% protection
    timingQuality = "GOOD";
  } else {
    protectionRate = 0.5; // Late timing - 50% protection
    timingQuality = "LATE";
  }
  
  const firefliesLost = F(capturedFireflies.length * (1 - protectionRate));
  const firefliesProtected = capturedFireflies.length - firefliesLost;
  
  // Apply protection results
  if (firefliesLost > 0) {
    score -= firefliesLost;
    releaseCapturedFireflies(firefliesLost);
  }
  
  // Shield consumed after use
  shieldActive = false;
  shieldCooldown = CFG.shieldCooldown + getDifficulty() * 4;
  
  // Audio feedback based on timing
  const soundFreqs = { "PERFECT": 300, "GREAT": 250, "GOOD": 200, "LATE": 180 };
  playTone(soundFreqs[timingQuality], 0.2, 0.15);
  
  // Visual feedback
  const protectionText = firefliesLost === 0 ? 
    `${timingQuality} SHIELD!` : 
    `${timingQuality}: ${firefliesProtected} SAVED, ${firefliesLost} LOST`;
  
  addScoreText(protectionText, w / 2, h / 2 - 100, getTimingColor(timingQuality), 180);
};

// No shield protection - full penalty
const handleNoPenalty = (capturedFireflies) => {
  score -= capturedFireflies.length;
  totalLost += capturedFireflies.length;
  
  // Force release all captured fireflies
  charging = false;
  glowPower = 0;
  
  // Create dispersal effect
  capturedFireflies.forEach(f => createDispersalEffect(f));
  
  // Remove captured fireflies with some respawning
  const firefliesKept = F(capturedFireflies.length * 0.5);
  releaseCapturedFireflies(capturedFireflies.length);
  
  // Respawn some fireflies to maintain population
  for (let i = 0; i < firefliesKept; i++) {
    spawnFirefly();
  }
  
  playTone(150, 0.3, 0.1);
  addScoreText(`NO SHIELD! -${capturedFireflies.length}`, mx, my - 50, "#ff4444", 150);
};

// Helper functions for cat system
const changeToNewColor = () => {
  const colors = ["pink", "purple", "gold"];
  let newColor;
  do {
    newColor = colors[F(r() * colors.length)];
  } while (newColor === catEyeColor);
  
  catEyeColor = newColor;
  catEyeChangeTimer = 0;
  lastWarningState = false;
};

const setNextColorChangeTime = () => {
  const gameTime = Date.now() - (startTime || Date.now());
  const gameMinutes = gameTime / 60000;
  
  // Progressive difficulty - timing gets faster over time
  let minTime = 480, maxTime = 900; // 8-15 seconds base
  
  if (gameMinutes > 1) {
    const midGameFactor = Math.min(1, (gameMinutes - 1) / 2);
    minTime = F(480 - (240 * midGameFactor)); // Down to 4 seconds
    maxTime = F(900 - (400 * midGameFactor)); // Down to 8.3 seconds
  }
  
  if (gameMinutes > 3) {
    const lateGameFactor = Math.min(1, (gameMinutes - 3) / 2);
    minTime = F(180 - (60 * lateGameFactor)); // Down to 2 seconds
    maxTime = F(420 - (120 * lateGameFactor)); // Down to 5 seconds
  }
  
  nextColorChangeTime = minTime + F(r() * (maxTime - minTime));
};

const releaseCapturedFireflies = (count) => {
  let released = 0;
  otherFireflies.forEach(f => {
    if (f.captured && released < count) {
      f.captured = false;
      released++;
    }
  });
};

const getTimingColor = (quality) => {
  const colors = { "LATE": "#ff8844", "GOOD": "#ffdd00", "GREAT": "#88ff44", "PERFECT": "#00ff88" };
  return colors[quality] || "#ffaa00";
};

// Draw the delivery zone between the cat's eyes
const drawDeliveryZone = (now) => {
  const centerX = w / 2;
  const centerY = h * 0.2; // Match the cat nose position
  const requiredFireflies = getRequiredFireflies();
  const capturedCount = otherFireflies.filter(f => f.captured).length;
  
  // Subtle dotted circle instead of pulsating solid
  const radius = CFG.deliveryRadius;
  
  // Zone color based on delivery readiness
  const canDeliver = capturedCount >= requiredFireflies;
  const strokeColor = canDeliver ? "#00ff0060" : "#ffffff30";
  
  x.save();
  setStroke(strokeColor);
  setLineWidth(2);
  
  // Create dotted line pattern
  x.setLineDash([8, 6]); // 8px dash, 6px gap
  x.lineDashOffset = -(now * 0.02) % 14; // Slow rotation animation
  
  x.beginPath();
  x.arc(centerX, centerY, radius, 0, TAU);
  x.stroke();
  
  x.setLineDash([]); // Reset dash pattern
  x.restore();
  
  // Delivery requirements text - positioned below the zone
  setFill("#ffffff80");
  x.font = "12px monospace";
  x.textAlign = "center";
  x.fillText(
    `${capturedCount}/${requiredFireflies} fireflies`, 
    centerX, centerY + radius + 20
  );
  
  if (canDeliver) {
    setFill("#00ff0080");
    x.fillText("Ready to deliver!", centerX, centerY + radius + 35);
  }
};

// ===== SCORE SYSTEM =====

// Add floating score text
const addScoreText = (text, x, y, color = "#ffffff", life = 120) => {
  scoreTexts.push({ text, x, y, life: 0, maxLife: life, color });
};

// Update and draw floating score texts
const drawScoreTexts = () => {
  scoreTexts.forEach(text => {
    const progress = text.life / text.maxLife;
    const alpha = 1 - progress; // Fade out over time
    
    setFill(text.color + Math.floor(alpha * 255).toString(16).padStart(2, '0'));
    x.font = "16px monospace";
    x.textAlign = "center";
    x.fillText(text.text, text.x, text.y - text.life * 0.5);
    
    text.life++;
  });
  
  // Remove expired texts
  scoreTexts = scoreTexts.filter(text => text.life < text.maxLife);
};

// ===== FIREFLIES SYSTEM =====

// Spawn a new firefly at random location
const spawnFirefly = () => {
  if (otherFireflies.length >= CFG.maxFireflies) return;
  
  otherFireflies.push({
    x: r() * w,
    y: h * 0.3 + r() * h * 0.5, // Keep in lower 2/3 of screen
    captured: false,
    captureOffset: { x: 0, y: 0 },
    floatTimer: r() * TAU,
    flashTimer: r() * TAU,
    roamTarget: null,
    fadeIn: 0, // For smooth spawning
    glowIntensity: 0.5 + r() * 0.5,
    size: 2 + r() * 2,
  });
};

// Update firefly behavior and movement
const updateFireflies = (playerX, playerY) => {
  const speedMultiplier = getSpeedMultiplier();
  
  otherFireflies.forEach(firefly => {
    if (firefly.captured) {
      // Captured fireflies orbit around player
      updateCapturedFirefly(firefly, playerX, playerY);
    } else {
      // Free fireflies roam and react to player
      updateFreeFirefly(firefly, playerX, playerY, speedMultiplier);
    }
    
    // Update visual effects
    firefly.floatTimer += 0.03 + r() * 0.02;
    firefly.flashTimer += 0.04 + r() * 0.02;
  });
};

// Update behavior for captured fireflies
const updateCapturedFirefly = (firefly, playerX, playerY) => {
  // Smooth orbit around player with offset
  const targetX = playerX + firefly.captureOffset.x;
  const targetY = playerY + firefly.captureOffset.y;
  
  // Gentle movement toward target position
  firefly.x += (targetX - firefly.x) * 0.15;
  firefly.y += (targetY - firefly.y) * 0.15;
  
  // Add floating motion
  firefly.x += sin(firefly.floatTimer) * 0.3;
  firefly.y += cos(firefly.floatTimer * 1.3) * 0.2;
};

// Update behavior for free fireflies
const updateFreeFirefly = (firefly, playerX, playerY, speedMultiplier) => {
  // Handle fade-in for newly spawned fireflies
  if (firefly.fadeIn < 1) {
    firefly.fadeIn += 0.03;
    return;
  }
  
  // Check for player capture when charging
  if (charging) {
    const distSq = d2(firefly.x, firefly.y, playerX, playerY);
    if (distSq < 25 * 25) { // 25 pixel capture radius
      captureFirefly(firefly, playerX, playerY);
      return;
    }
  }
  
  // Natural roaming behavior
  if (!firefly.roamTarget || 
      Math.abs(firefly.x - firefly.roamTarget.x) < 30 && 
      Math.abs(firefly.y - firefly.roamTarget.y) < 30) {
    
    // Set new roaming destination
    firefly.roamTarget = {
      x: r() * w,
      y: h * 0.35 + r() * h * 0.5, // Stay in grass area
    };
  }
  
  // Move toward roam target
  const dx = firefly.roamTarget.x - firefly.x;
  const dy = firefly.roamTarget.y - firefly.y;
  const distance = hyp(dx, dy);
  
  if (distance > 5) {
    const speed = (0.3 + r() * 0.2) * speedMultiplier;
    firefly.x += (dx / distance) * speed;
    firefly.y += (dy / distance) * speed;
  }
  
  // Add gentle floating wobble
  firefly.x += sin(firefly.floatTimer) * 0.2 * speedMultiplier;
  firefly.y += cos(firefly.floatTimer * 1.3) * 0.15 * speedMultiplier;
  
  // Keep fireflies in bounds
  firefly.x = clamp(firefly.x, 20, w - 20);
  firefly.y = clamp(firefly.y, h * 0.3, h - 20);
};

// Capture a firefly
const captureFirefly = (firefly, playerX, playerY) => {
  firefly.captured = true;
  firefly.captureOffset.x = firefly.x - playerX + (r() - 0.5) * 20;
  firefly.captureOffset.y = firefly.y - playerY + (r() - 0.5) * 20;
  
  playTone(800, 0.2, 0.1); // Capture sound
  
  // Create capture particles
  for (let i = 0; i < 5; i++) {
    const angle = r() * TAU;
    particles.push({
      x: firefly.x,
      y: firefly.y,
      vx: cos(angle) * 2,
      vy: sin(angle) * 2,
      life: 0,
      maxLife: 30,
      size: 1 + r(),
      color: "#00aaff",
      isBurst: true,
    });
  }
};

// Draw all fireflies with their glowing effects
const drawFireflies = (now) => {
  otherFireflies.forEach(firefly => {
    const alpha = firefly.fadeIn;
    if (alpha <= 0) return;
    
    // Firefly color based on state
    const baseColor = firefly.captured ? "#00aaff" : "#ffff88";
    const isFlashing = sin(firefly.flashTimer) > 0.6;
    const flashIntensity = isFlashing ? 1.5 : 0.8;
    
    // Glow effect
    const glowRadius = firefly.size * 3 * flashIntensity;
    const gradient = x.createRadialGradient(
      firefly.x, firefly.y, 0,
      firefly.x, firefly.y, glowRadius
    );
    gradient.addColorStop(0, baseColor + Math.floor(alpha * 255 * 0.8).toString(16).padStart(2, '0'));
    gradient.addColorStop(0.7, baseColor + Math.floor(alpha * 255 * 0.3).toString(16).padStart(2, '0'));
    gradient.addColorStop(1, "transparent");
    
    // Draw glow
    setFill(gradient);
    x.beginPath();
    x.arc(firefly.x, firefly.y, glowRadius, 0, TAU);
    x.fill();
    
    // Draw firefly body
    setFill(baseColor + Math.floor(alpha * 255).toString(16).padStart(2, '0'));
    x.beginPath();
    x.arc(firefly.x, firefly.y, firefly.size, 0, TAU);
    x.fill();
  });
};

// Check delivery zone for captured fireflies
const checkDeliveryZone = (playerX, playerY) => {
  const centerX = w / 2;
  const centerY = h * 0.2; // Match the cat nose position
  const distance = hyp(playerX - centerX, playerY - centerY);
  
  if (distance < CFG.deliveryRadius) {
    const capturedFireflies = otherFireflies.filter(f => f.captured);
    const requiredFireflies = getRequiredFireflies();
    
    if (capturedFireflies.length >= requiredFireflies) {
      deliverFireflies(capturedFireflies);
      return true;
    }
  }
  
  return false;
};

// Deliver captured fireflies to the cat
const deliverFireflies = (capturedFireflies) => {
  const bonusMultiplier = Math.max(1, F(capturedFireflies.length / 3));
  const pointsAwarded = capturedFireflies.length * bonusMultiplier;
  
  score += pointsAwarded;
  totalCollected += capturedFireflies.length;
  
  // Remove delivered fireflies
  otherFireflies = otherFireflies.filter(f => !f.captured);
  
  // Reset summoning heat as reward
  summonHeat = Math.max(0, summonHeat - capturedFireflies.length * 15);
  if (summonOverheated && summonHeat <= 40) {
    summonOverheated = false;
  }
  
  // Restore some mana
  manaEnergy = Math.min(100, manaEnergy + capturedFireflies.length * 5);
  
  // Visual feedback
  addScoreText(`+${pointsAwarded}`, w / 2, h / 2, "#00ff00", 120);
  
  // Spawn new fireflies to maintain population
  const spawnCount = Math.min(3, capturedFireflies.length);
  for (let i = 0; i < spawnCount; i++) {
    spawnFirefly();
  }
  
  playTone(600, 0.3, 0.15); // Delivery success sound
  
  // Tutorial progression
  if (!firstDeliveryMade) {
    firstDeliveryMade = true;
    if (!tutorialComplete && tutorialStep < 3) {
      tutorialStep++;
    }
  }
  
  // Complete tutorial after enough deliveries
  if (!tutorialComplete && score >= 50) {
    tutorialComplete = true;
    localStorage.setItem('tutorialComplete', 'true');
    addScoreText('Tutorial Complete!', w / 2, h / 2 + 30, '#00ff00', 180);
  }
};

// ===== PLAYER SYSTEM =====

// Get current player position (follows mouse)
const getPlayerPosition = () => {
  return { x: mx, y: my };
};

// Update player state
const updatePlayer = (now) => {
  // Track mouse movement for auto-charging
  const movementThreshold = 5;
  const timeSinceMovement = now - lastMovementTime;
  
  if (Math.abs(mx - lastMx) > movementThreshold || Math.abs(my - lastMy) > movementThreshold) {
    mouseMoving = true;
    lastMovementTime = now;
    charging = true; // Auto-charge when moving
  } else if (timeSinceMovement > 300) { // 300ms buffer
    mouseMoving = false;
  }
  
  // Update glow power based on movement
  if (mouseMoving || charging) {
    glowPower = Math.min(100, glowPower + 2);
  } else {
    glowPower = Math.max(0, glowPower - 1);
  }
  
  // Quick flash effect
  if (quickFlashPower > 0) {
    quickFlashPower = Math.max(0, quickFlashPower - 3);
  }
  
  // Update summoning heat system
  updateSummonHeat();
  
  // Update shield cooldown
  if (shieldCooldown > 0) {
    shieldCooldown--;
  }
  
  // Deactivate shield if mana depleted or time expired
  if (shieldActive) {
    const shieldDuration = now - lastShieldTime;
    if (manaEnergy <= 0 || shieldDuration > 3000) { // 3 second max duration
      shieldActive = false;
    } else {
      // Drain mana while shield is active
      manaEnergy = Math.max(0, manaEnergy - 0.1);
    }
  }
  
  // Regenerate mana slowly over time
  if (!shieldActive && manaEnergy < 100) {
    manaEnergy = Math.min(100, manaEnergy + 0.05);
  }
};

// Update summoning heat system
const updateSummonHeat = () => {
  // Cool down heat over time
  if (summonHeat > 0) {
    summonHeat = Math.max(0, summonHeat - 0.2);
  }
  
  // Check for overheating
  if (summonHeat >= 100 && !summonOverheated) {
    summonOverheated = true;
    overheatStunned = true;
    overheatCooldown = 180; // 3 seconds of cooldown
    addScoreText("OVERHEATED!", mx, my - 30, "#ff4444", 120);
    playTone(200, 0.5, 0.1); // Overheat warning sound
  }
  
  // Handle overheat cooldown
  if (summonOverheated) {
    overheatCooldown--;
    if (overheatCooldown <= 0) {
      overheatStunned = false;
    }
    if (summonHeat <= 30) { // Cooled down enough
      summonOverheated = false;
      overheatCooldown = 0;
    }
  }
};

// Draw the player firefly (luminid)
const drawPlayerFirefly = (playerX, playerY, now) => {
  // Don't draw if player is off-screen or stunned
  if (!mouseInBounds && !charging) return;
  
  // Player firefly appearance
  const isMoving = mouseMoving || charging;
  const firefly_color = isMoving ? "#00aaff" : "#aaaacc"; // Cyan when moving, gray when idle
  
  // Overheated appearance
  if (summonOverheated) {
    const sputter = sin(now * 0.05) * 0.5 + 0.5;
    const stutterColor = sputter > 0.3 ? "#ff4444" : "#441111";
    
    // Erratic movement when stunned
    if (overheatStunned) {
      playerX += (r() - 0.5) * 4;
      playerY += (r() - 0.5) * 4;
    }
    
    setFill(stutterColor);
  } else {
    setFill(firefly_color);
  }
  
  // Draw main firefly body
  x.beginPath();
  x.arc(playerX, playerY, 3, 0, TAU);
  x.fill();
  
  // Calculate total glow intensity
  const baseGlow = 20;
  const enhancedGlow = charging ? 40 : 0;
  const shieldGlow = shieldActive ? 50 : 0;
  const totalGlow = Math.max(glowPower, quickFlashPower, baseGlow + enhancedGlow + shieldGlow);
  
  // Draw glow effect
  const glowIntensity = totalGlow / 100;
  const glowColor = isMoving ? 
    `rgba(0, 170, 255, ${glowIntensity * 0.6})` : 
    `rgba(170, 170, 204, ${glowIntensity * 0.6})`;
  
  const gradient = x.createRadialGradient(
    playerX, playerY, 0,
    playerX, playerY, totalGlow
  );
  gradient.addColorStop(0, glowColor);
  gradient.addColorStop(1, "transparent");
  
  setFill(gradient);
  x.beginPath();
  x.arc(playerX, playerY, totalGlow, 0, TAU);
  x.fill();
  
  // Draw mana/shield indicator around player
  drawPlayerManaRing(playerX, playerY, now);
};

// Draw circular mana/shield indicator around player
const drawPlayerManaRing = (playerX, playerY, now) => {
  const capturedCount = otherFireflies.filter(f => f.captured).length;
  const baseRadius = 18 + Math.min(capturedCount * 2, 12);
  
  x.save();
  
  // Mana ring (background)
  const manaAngle = (manaEnergy / 100) * TAU;
  setStroke("#ffffff40");
  setLineWidth(3);
  x.beginPath();
  x.arc(playerX, playerY, baseRadius, 0, TAU);
  x.stroke();
  
  // Mana fill
  if (manaEnergy > 0) {
    setStroke(manaEnergy > 50 ? "#00ff88" : "#ffaa00");
    setLineWidth(3);
    x.beginPath();
    x.arc(playerX, playerY, baseRadius, -Math.PI / 2, -Math.PI / 2 + manaAngle);
    x.stroke();
  }
  
  // Shield indicator
  if (shieldActive) {
    const shieldRadius = baseRadius + 8;
    const rotation = now * 0.01;
    
    setStroke("rgba(100, 150, 255, 0.8)");
    setLineWidth(3);
    x.setLineDash([8, 4]);
    x.lineDashOffset = -rotation * 10;
    x.beginPath();
    x.arc(playerX, playerY, shieldRadius, 0, TAU);
    x.stroke();
    x.setLineDash([]);
  }
  
  // Overheat warning
  if (summonOverheated) {
    const warningRadius = baseRadius + 12;
    const pulse = sin(now * 0.1) * 0.5 + 0.5;
    
    setStroke(`rgba(255, 68, 68, ${pulse})`);
    setLineWidth(4);
    x.beginPath();
    x.arc(playerX, playerY, warningRadius, 0, TAU);
    x.stroke();
  }
  
  x.restore();
};

// ===== PARTICLES & EFFECTS SYSTEM =====

// Update all particle effects
const updateParticles = () => {
  // Update regular particles
  particles.forEach(particle => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life++;
    
    // Apply gravity and air resistance
    if (!particle.isBurst) {
      particle.vy += 0.1; // Gravity
      particle.vx *= 0.98; // Air resistance
      particle.vy *= 0.98;
    }
  });
  
  // Remove expired particles
  particles = particles.filter(p => p.life < p.maxLife);
  
  // Update click sparkles
  clickSparkles.forEach(sparkle => {
    sparkle.life++;
    sparkle.x += sparkle.vx;
    sparkle.y += sparkle.vy;
    sparkle.vx *= 0.95;
    sparkle.vy *= 0.95;
  });
  
  // Remove expired sparkles
  clickSparkles = clickSparkles.filter(s => s.life < s.maxLife);
};

// Draw all particle effects
const drawParticles = () => {
  // Draw regular particles
  particles.forEach(particle => {
    const progress = particle.life / particle.maxLife;
    const alpha = 1 - progress;
    const size = particle.size * (1 - progress * 0.5);
    
    if (particle.glow) {
      // Glowing particle with gradient
      const gradient = x.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, size * 3
      );
      gradient.addColorStop(0, particle.color + Math.floor(alpha * 255).toString(16).padStart(2, '0'));
      gradient.addColorStop(1, "transparent");
      
      setFill(gradient);
      x.beginPath();
      x.arc(particle.x, particle.y, size * 3, 0, TAU);
      x.fill();
    }
    
    // Particle core
    setFill(particle.color + Math.floor(alpha * 255).toString(16).padStart(2, '0'));
    x.beginPath();
    x.arc(particle.x, particle.y, size, 0, TAU);
    x.fill();
  });
  
  // Draw click sparkles
  clickSparkles.forEach(sparkle => {
    const progress = sparkle.life / sparkle.maxLife;
    const alpha = 1 - progress;
    const size = sparkle.size * (1 - progress * 0.3);
    
    setFill(`rgba(255, 255, 255, ${alpha})`);
    x.beginPath();
    x.arc(sparkle.x, sparkle.y, size, 0, TAU);
    x.fill();
  });
};

// Create dispersal effect when fireflies are lost
const createDispersalEffect = (firefly) => {
  for (let i = 0; i < 3; i++) {
    particles.push({
      x: firefly.x,
      y: firefly.y,
      vx: (r() - 0.5) * 3,
      vy: (r() - 0.5) * 3,
      size: 1 + r(),
      life: 0,
      maxLife: 20 + r() * 15,
      color: "#ff6666",
      alpha: 0.7,
      glow: true,
    });
  }
};

// Create click effect at mouse position
const createClickEffect = (x, y) => {
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * TAU;
    clickSparkles.push({
      x: x,
      y: y,
      vx: cos(angle) * (2 + r() * 3),
      vy: sin(angle) * (2 + r() * 3),
      size: 1 + r() * 2,
      life: 0,
      maxLife: 30 + r() * 20,
    });
  }
};

// Summoning effect for new fireflies
const createSummonEffect = (x, y) => {
  for (let i = 0; i < 6; i++) {
    const angle = r() * TAU;
    particles.push({
      x: x,
      y: y,
      vx: cos(angle) * (1 + r() * 2),
      vy: sin(angle) * (1 + r() * 2),
      size: 1 + r(),
      life: 0,
      maxLife: 40 + r() * 20,
      color: "#88ff88",
      glow: true,
    });
  }
};

// ===== INPUT HANDLING SYSTEM =====

// Helper to check if input has been held for minimum duration
const held150 = (now) => {
  return (mousePressed && (now - mouseDownTime) >= 150);
};

// Mouse movement handler
const handleMouseMove = (e) => {
  lastMx = mx;
  lastMy = my;
  mx = e.clientX;
  my = e.clientY;
  mouseInBounds = true;
  
  // Don't process movement when stunned
  if (overheatStunned) return;
  
  mouseMoving = true;
  lastMovementTime = Date.now();
  charging = true; // Auto-charge when moving
};

// Mouse down handler
const handleMouseDown = (e) => {
  if (gameOver) {
    restartGame();
    return;
  }
  
  mousePressed = true;
  mouseDownTime = Date.now();
  
  createClickEffect(mx, my);
};

// Mouse up handler  
const handleMouseUp = (e) => {
  if (!gameStarted || gameOver) return;
  
  const holdDuration = Date.now() - mouseDownTime;
  mousePressed = false;
  
  // Quick click summoning
  if (holdDuration < 150 && canSummon()) {
    summonFirefly();
  }
};

// Keyboard handler
const handleKeyDown = (e) => {
  // Toggle audio
  if (e.code === "KeyM") {
    e.preventDefault();
    audioEnabled = !audioEnabled;
    if (audioEnabled && gameStarted && !showHelp && pageVisible) {
      setTimeout(startMusic, 100);
    } else {
      stopMusic();
    }
    return;
  }
  
  // Toggle help
  if (e.code === "KeyR" || e.code === "Escape") {
    e.preventDefault();
    showHelp = !showHelp;
    return;
  }
  
  // Shield with spacebar
  if (e.code === "Space") {
    e.preventDefault();
    if (!gameStarted) {
      gameStarted = true;
      return;
    }
    
    // Activate shield with space
    if (canShield()) {
      activateShield();
    }
  }
};

// Utility functions for input handling
const canSummon = () => !summonOverheated && manaEnergy >= 10;
const canShield = () => manaEnergy > 0 && shieldCooldown === 0 && !summonOverheated;

const summonFirefly = () => {
  if (!canSummon()) return;
  
  // Add heat for summoning
  summonHeat += 25;
  manaEnergy = Math.max(0, manaEnergy - 10);
  
  // Spawn firefly near mouse
  const spawnX = mx + (r() - 0.5) * 100;
  const spawnY = my + (r() - 0.5) * 100;
  
  otherFireflies.push({
    x: clamp(spawnX, 50, w - 50),
    y: clamp(spawnY, h * 0.3, h - 50),
    captured: false,
    captureOffset: { x: 0, y: 0 },
    floatTimer: r() * TAU,
    flashTimer: r() * TAU,
    roamTarget: null,
    fadeIn: 0,
    glowIntensity: 0.5 + r() * 0.5,
    size: 2 + r() * 2,
  });
  
  createSummonEffect(spawnX, spawnY);
  playTone(400, 0.15, 0.08);
  quickFlashPower = 50; // Visual feedback
};

const activateShield = () => {
  shieldActive = true;
  lastShieldTime = Date.now();
  playTone(600, 0.1, 0.1);
  
  // Tutorial progression
  if (!tutorialComplete && tutorialStep === 0) {
    tutorialStep = 1;
  }
};

const restartGame = () => {
  // Reset all game state
  gameOver = false;
  score = 0;
  glowPower = 0;
  charging = false;
  mouseMoving = false;
  particles = [];
  otherFireflies = [];
  scoreTexts = [];
  clickSparkles = [];
  
  // Reset cat system
  catEyeColor = "gold";
  catEyeChangeTimer = 0;
  nextColorChangeTime = 600 + F(r() * 300);
  lastWarningState = false;
  
  // Reset player systems
  summonHeat = 0;
  summonOverheated = false;
  overheatStunned = false;
  manaEnergy = 100;
  shieldActive = false;
  shieldCooldown = 0;
  lastShieldTime = 0;
  
  // Reset tutorial
  tutorialStep = 0;
  firstDeliveryMade = false;
  
  // Reset timing
  startTime = Date.now();
  runStartTime = Date.now();
  
  // Spawn initial fireflies
  const spawnCount = tutorialComplete ? 20 : 8;
  for (let i = 0; i < spawnCount; i++) {
    spawnFirefly();
  }
  
  playTone(600, 0.2, 0.1);
};

// ===== MUSIC SYSTEM =====
// Placeholder for background music system
let musicNodes = [];
let musicPlaying = false;

const startMusic = () => {
  // TODO: Implement ambient music system
  // Would include flowing arpeggios, sustained strings, and gentle melodies
  musicPlaying = true;
};

const stopMusic = () => {
  musicNodes.forEach(node => {
    if (node.stop) node.stop();
  });
  musicNodes = [];
  musicPlaying = false;
};

// ===== TUTORIAL SYSTEM =====

// Draw tutorial guidance for new players
const drawTutorialGuidance = () => {
  if (tutorialComplete || showHelp) return;
  
  tutorialTimer += 0.02;
  const pulse = sin(tutorialTimer) * 0.3 + 0.7;
  
  x.save();
  x.textAlign = "center";
  
  switch (tutorialStep) {
    case 0:
      // First step: Learn to use shield
      setFill(`rgba(255, 255, 255, ${pulse})`);
      x.font = "18px serif";
      x.fillText("Hold SPACE or MOUSE to activate shield", w / 2, h - 100);
      x.font = "14px serif";
      x.fillText("Protect fireflies when the cat's eyes flash red!", w / 2, h - 75);
      break;
      
    case 1:
      // Second step: Learn to move and collect
      setFill(`rgba(255, 255, 255, ${pulse})`);
      x.font = "18px serif";
      x.fillText("Move your mouse to collect fireflies", w / 2, h - 100);
      x.font = "14px serif";
      x.fillText("Your luminid (blue light) automatically captures nearby fireflies", w / 2, h - 75);
      break;
      
    case 2:
      // Third step: Learn to deliver
      setFill(`rgba(255, 255, 255, ${pulse})`);
      x.font = "18px serif";
      x.fillText("Bring fireflies to the delivery zone", w / 2, h - 100);
      x.font = "14px serif";
      x.fillText("Fly between the cat's eyes to feed the cat and score points", w / 2, h - 75);
      
      // Draw arrow pointing to delivery zone (updated position)
      const centerX = w / 2;
      const centerY = h * 0.2;
      drawArrow(centerX, centerY + 160, centerX, centerY + 120);
      break;
      
    case 3:
      // Final tutorial message
      setFill(`rgba(255, 255, 255, ${pulse})`);
      x.font = "18px serif";
      x.fillText("Click to summon more fireflies", w / 2, h - 100);
      x.font = "14px serif";
      x.fillText("Press 'R' for full rules. Survive as long as you can!", w / 2, h - 75);
      break;
  }
  
  x.restore();
};

// Draw simple arrow helper
const drawArrow = (fromX, fromY, toX, toY) => {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const headlen = 15;
  
  setStroke("#ffffff");
  setLineWidth(2);
  
  // Arrow line
  x.beginPath();
  x.moveTo(fromX, fromY);
  x.lineTo(toX, toY);
  x.stroke();
  
  // Arrow head
  x.beginPath();
  x.moveTo(toX, toY);
  x.lineTo(toX - headlen * cos(angle - Math.PI / 6), toY - headlen * sin(angle - Math.PI / 6));
  x.moveTo(toX, toY);
  x.lineTo(toX - headlen * cos(angle + Math.PI / 6), toY - headlen * sin(angle + Math.PI / 6));
  x.stroke();
};

// ===== UI SYSTEM =====

// Draw help overlay
const drawHelp = () => {
  if (!showHelp) return;
  
  // Semi-transparent overlay
  setFill(BLACK(0.8));
  x.fillRect(0, 0, w, h);
  
  x.save();
  x.textAlign = "center";
  
  // Title
  setFill("#ffffff");
  x.font = "24px serif";
  x.fillText("The Cat & the Luminid - Rules", w / 2, 80);
  
  // Rules text
  x.font = "16px serif";
  setFill("#cccccc");
  
  const rules = [
    "You are the Luminid, guide of fireflies in the eternal night.",
    "",
    "🌟 CONTROLS:",
    "• Move mouse to guide your luminid and collect fireflies",
    "• Click to summon new fireflies (costs mana)",
    "• Hold SPACE or MOUSE to activate protective shield",
    "",
    "🎯 OBJECTIVE:",
    "• Collect fireflies and deliver them between the cat's eyes",
    "• The cat feeds on light to keep the night alive",
    "• Score points by successful deliveries",
    "",
    "⚠️ DANGER:",
    "• Cat's eyes change color and flash red as warning",
    "• Use shield during red flashes to protect captured fireflies",
    "• Perfect timing gives maximum protection",
    "• Without shield, all captured fireflies are lost",
    "",
    "💡 STRATEGY:",
    "• Manage your mana (blue ring around luminid)",
    "• Don't overheat from too much summoning",
    "• Game gets faster and more challenging over time",
    "",
    "Press 'R' or 'ESC' to close this help"
  ];
  
  rules.forEach((rule, i) => {
    const y = 120 + i * 22;
    if (rule.startsWith("🌟") || rule.startsWith("🎯") || rule.startsWith("⚠️") || rule.startsWith("💡")) {
      setFill("#ffdd00");
      x.font = "bold 16px serif";
    } else if (rule.startsWith("•")) {
      setFill("#aaaaaa");
      x.font = "14px serif";
    } else {
      setFill("#cccccc");
      x.font = "16px serif";
    }
    x.fillText(rule, w / 2, y);
  });
  
  x.restore();
};

// Draw main UI elements
const drawMainUI = () => {
  x.save();
  x.textAlign = "left";
  
  // Score
  setFill("#ffffff");
  x.font = "18px monospace";
  x.fillText(`Score: ${score}`, 20, 30);
  
  // Mana display
  const manaColor = manaEnergy > 50 ? "#00ff88" : manaEnergy > 20 ? "#ffaa00" : "#ff4444";
  setFill(manaColor);
  x.fillText(`Mana: ${Math.floor(manaEnergy)}`, 20, 55);
  
  // Shield status
  if (shieldActive) {
    setFill("#00aaff");
    x.fillText("SHIELD ACTIVE", 20, 80);
  } else if (shieldCooldown > 0) {
    setFill("#888888");
    x.fillText(`Shield cooldown: ${Math.ceil(shieldCooldown / 60)}s`, 20, 80);
  }
  
  // Overheat warning
  if (summonOverheated) {
    const flash = sin(Date.now() * 0.01) > 0;
    if (flash) {
      setFill("#ff4444");
      x.font = "bold 16px monospace";
      x.fillText("OVERHEATED!", 20, 105);
    }
  } else if (summonHeat > 70) {
    setFill("#ffaa00");
    x.fillText(`Heat: ${Math.floor(summonHeat)}%`, 20, 105);
  }
  
  // Controls hint
  x.textAlign = "right";
  setFill("#666666");
  x.font = "12px serif";
  x.fillText("Press 'R' for help • 'M' to toggle audio", w - 20, h - 20);
  
  x.restore();
};

// Main game loop - orchestrates all systems
function gameLoop() {
  const now = Date.now();
  const { x: playerX, y: playerY } = getPlayerPosition();
  
  // Update all game systems
  updateCatEyes(now);
  updatePlayer(now);
  updateFireflies(playerX, playerY);
  updateParticles();
  
  // Handle shield activation for held inputs
  if (held150(now) && manaEnergy > 0 && !shieldActive && 
      shieldCooldown === 0 && !summonOverheated) {
    shieldActive = true;
    lastShieldTime = now;
    playTone(600, 0.1, 0.1);
    
    if (!tutorialComplete && tutorialStep === 0) {
      tutorialStep = 1;
    }
  }
  
  // Check for delivery
  if (charging) {
    checkDeliveryZone(playerX, playerY);
  }
  
  // Update score texts animation
  scoreTexts.forEach(text => {
    text.life++;
    text.y -= 0.5; // Float upward
  });
  scoreTexts = scoreTexts.filter(text => text.life < text.maxLife);
  
  // Render everything in proper order
  drawStars(now);
  drawForest();
  drawCatEyes(now);
  drawDeliveryZone(now);
  drawFireflies(now);
  drawPlayerFirefly(playerX, playerY, now);
  drawParticles();
  drawScoreTexts();
  
  // Screen flash effect during cat eye warnings
  if (gameStarted && !gameOver && colorChangesEnabled) {
    const timeUntilChange = nextColorChangeTime - catEyeChangeTimer;
    const isWarning = timeUntilChange <= CFG.warnFrames;
    
    if (isWarning && otherFireflies.some(f => f.captured)) {
      const warningPhase = CFG.warnFrames - timeUntilChange;
      const shouldFlash = 
        (warningPhase >= CFG.flash1 && warningPhase < CFG.flash1 + 20) ||
        (warningPhase >= CFG.flash2 && warningPhase < CFG.flash2 + 20) ||
        (warningPhase >= CFG.flash3 && warningPhase < CFG.flash3 + 20);
      
      if (shouldFlash) {
        const flashIntensity = 0.15;
        setFill(`rgba(200, 80, 80, ${flashIntensity})`);
        x.fillRect(0, 0, w, h);
      }
    }
  }
  
  // UI and overlays
  drawMainUI();
  drawTutorialGuidance();
  drawHelp();
  
  // Periodic cleanup to prevent memory leaks
  if (now % 5000 < 50) {
    if (particles.length > 100) particles = particles.slice(-50);
    if (clickSparkles.length > 50) clickSparkles = clickSparkles.slice(-25);
  }
  
  requestAnimationFrame(gameLoop);
}

// Initialize canvas and start
const initGame = () => {
  c = document.getElementById('c');
  x = c.getContext('2d');
  
  const resize = () => {
    w = c.width = innerWidth;
    h = c.height = innerHeight;
    
    // Reinitialize systems that depend on screen size
    initStars();
    initCatEyes();
  };
  
  window.onresize = resize;
  resize();
  
  // Initialize game systems
  startTime = Date.now();
  runStartTime = Date.now();
  
  // Set first color change timing
  nextColorChangeTime = 600 + F(r() * 300); // 10-15 seconds initially
  
  // Set up event listeners
  c.addEventListener('mousemove', handleMouseMove);
  c.addEventListener('mousedown', handleMouseDown);
  c.addEventListener('mouseup', handleMouseUp);
  c.addEventListener('mouseleave', () => { mouseInBounds = false; });
  c.addEventListener('mouseenter', () => { mouseInBounds = true; });
  
  document.addEventListener('keydown', handleKeyDown);
  
  // Page visibility handling for performance
  document.addEventListener('visibilitychange', () => {
    pageVisible = !document.hidden;
  });
  
  // Spawn initial fireflies
  const initialFireflies = tutorialComplete ? 20 : 8;
  for (let i = 0; i < initialFireflies; i++) {
    spawnFirefly();
  }
  
  // Start game loop
  gameLoop();
};

initGame();
