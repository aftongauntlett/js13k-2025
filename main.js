// js13k-2025 Firefly Cat Game - Optimized

// Lightweight audio system
let a; // AudioContext

// Game state and utility functions
let getDifficulty = () => F(score / 50); // Consolidated difficulty scaling
let getSpeedMultiplier = () => 1 + (score / 200);
let getRequiredFireflies = () => Math.max(1, F(score / 100) + 1);
let addScoreText = (text, x, y, color = "#ffffff", life = 120) => {
  scoreTexts.push({ text, x, y, life: 0, maxLife: life, color });
};
let canSummon = () => !summonOverheated && manaEnergy >= 10;
let canShield = () => manaEnergy > 0 && shieldCooldown === 0 && !summonOverheated;
let useMana = (amount) => { manaEnergy = Math.max(0, manaEnergy - amount); };
let addMana = (amount) => { manaEnergy = Math.min(100, manaEnergy + amount); };

let clamp = (val, min, max) => Math.max(min, Math.min(max, val));

// Distance calculation helpers
const hyp = (dx,dy)=>Math.hypot(dx,dy); // Use when you need actual distance
const d2 = (ax,ay,bx,by)=>{ax-=bx; ay-=by; return ax*ax+ay*ay}; // Use for radius checks

// Initialize audio only when needed
let I = () => {
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

// Simple tone generator
let T = (f, d = .2, v = .1) => {
  if (!audioEnabled || !I()) return;
  let o = a.createOscillator(), g = a.createGain();
  o.frequency.value = f;
  g.gain.value = v;
  g.gain.exponentialRampToValueAtTime(.01, a.currentTime + d);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + d);
};

const c = document.getElementById("c"),
  x = c.getContext("2d"),
  TAU = Math.PI * 2,
  M = Math, // Math shortcut
  r = M.random, // Math.random shortcut
  F = M.floor; // Math.floor shortcut

// Hoisted whisker constants for better performance and compression
const WHISKERS = [
  { len: 110, yOff: 45, spread: -25 }, // top
  { len: 120, yOff: 55, spread: 0 },   // middle (longest)
  { len: 110, yOff: 65, spread: 25 }   // bottom
];
const { sin, cos } = Math;

// Canvas state batching to reduce redundant style changes
let lastBlur = 0, lastShadow = '', lastFill = '', lastStroke = '', lastLineWidth = 0;
const setBlur = (b, c) => { if (b !== lastBlur || c !== lastShadow) { x.shadowBlur = b; x.shadowColor = c; lastBlur = b; lastShadow = c; } };
const setFill = (c) => { if (c !== lastFill) { x.fillStyle = c; lastFill = c; } };
const setStroke = (c) => { if (c !== lastStroke) { x.strokeStyle = c; lastStroke = c; } };
const setLineWidth = (w) => { if (w !== lastLineWidth) { x.lineWidth = w; lastLineWidth = w; } };

// Color helper for better compression
const RGBA = (r, g, b, a) => `rgba(${r},${g},${b},${a})`;

// Common colors
const WHITE = (a) => RGBA(255, 255, 255, a);
const BLACK = (a) => RGBA(0, 0, 0, a);
const LIGHT_GRAY = (a) => RGBA(200, 200, 200, a);
const GREEN = (a) => RGBA(0, 255, 0, a);
const LIGHT_GREEN = (a) => RGBA(0, 255, 100, a);
const YELLOW = (a) => RGBA(255, 255, 0, a);
const RED = (a) => RGBA(255, 0, 0, a);
const BLUE = (a) => RGBA(150, 200, 255, a);

// Sparkle color table [fillColor, shadowColor]
const SPK = [['255,255,136','#ffff88'], ['255,255,255','white']];

// Input hold helper - 150ms threshold for shield activation
const held150 = (now) => (mousePressed && now - mouseDownTime >= 150) || (spacePressed && now - spaceDownTime >= 150);

// Configuration constants for tuning behavior
const CFG = {
  warnFrames: 180,     // 3-second warning period (180 frames at 60fps)
  flash1: 60,          // Flash 1 timing (0-60)
  flash2: 120,         // Flash 2 timing (60-120) 
  flash3: 150,         // Flash 3 timing (120-150)
  shieldCooldown: 180, // 3-second shield cooldown
  deliveryRadius: 120, // Cat nose proximity detection (squared: 120*120)
};

// Firefly rendering helpers
const drawBody = (f) => {
  setFill(f.isManaFirefly ? "#2d1810" : "#333");
  x.beginPath();
  x.arc(f.x, f.y, f.isManaFirefly ? 4.5 : 3.5, 0, TAU);
  x.fill();
};

const radialGlow = (fx, fy, radius, stops) => {
  let grad = x.createRadialGradient(fx, fy, 0, fx, fy, radius);
  for (let i = 0; i < stops.length; i += 2) {
    grad.addColorStop(stops[i], stops[i + 1]);
  }
  return grad;
};

const drawGlow = (f, now) => {
  if (f.isManaFirefly) {
    // Special mana firefly glow with heartbeat
    let heartbeatPulse = sin(f.manaHeartbeat) * 0.3 + 0.7;
    let baseGlow = sin(f.glowPhase * 0.5) * 0.2 + 0.8;
    let manaGlow = heartbeatPulse * baseGlow * 1.5;
    
    setFill(radialGlow(f.x, f.y, 25 * manaGlow, [
      0, `rgba(255, 180, 0, ${manaGlow})`,
      0.3, `rgba(255, 140, 0, ${manaGlow * 0.8})`,
      0.7, `rgba(255, 100, 0, ${manaGlow * 0.4})`,
      1, `rgba(255, 60, 0, 0)`
    ]));
    x.beginPath();
    x.arc(f.x, f.y, 25 * manaGlow, 0, TAU);
    x.fill();
    return;
  }

  // Normal firefly glow calculation (reuse existing logic)
  let g1, g2, glow;
  
  // Base glow calculation
  g1 = sin(f.flashTimer * 2) * 0.3 + 0.7;
  g2 = sin(f.glowPhase * 0.7) * 0.2 + 0.8;
  glow = g1 * g2;
  
  // Flash logic
  f.nextFlashTime = (f.nextFlashTime || 120) - 1;
  if (f.nextFlashTime <= 0) {
    let flashIntensity = sin(f.flashTimer * 8) * 0.5 + 0.5;
    glow += flashIntensity * 0.4;
    if (f.flashTimer > 6) {
      f.flashTimer = 0;
      f.nextFlashTime = M.random() * 300 + 180;
    }
  }
  
  // Summon glow
  if (f.summonGlow > 0) {
    glow += (f.summonGlow / 120) * 1.5;
  }

  // Captured firefly special handling
  if (f.captured) {
    let timeUntilChange = nextColorChangeTime - catEyeChangeTimer;
    let isWarning = timeUntilChange <= 60;
    
    if (isWarning && timeUntilChange <= 30) {
      glow = 0.3 + Math.abs(sin(f.flashTimer * 8) * cos(f.flashTimer * 5)) * 0.7;
    } else if (isWarning) {
      glow = 0.5 + sin(f.flashTimer * 4) * cos(f.flashTimer * 3) * 0.5;
    } else {
      glow = 0.8 + sin(f.flashTimer * 2) * 0.2;
    }
  }

  // Draw glow if bright enough
  if (glow > 0.3) {
    let size = 3 + glow * 4;
    let blur = 12 + glow * 20;
    let color;

    if (f.captured) {
      color = getCapturedFireflyColor(glow);
    } else if (f.type === "red") {
      color = `rgb(255,${80 + glow * 100},80)`;
    } else {
      color = `rgb(${100 + glow * 100},255,${80 + glow * 100})`;
    }

    setBlur(blur, color);
    setFill(color);
    x.beginPath();
    x.arc(f.x, f.y, size, 0, TAU);
    x.fill();
    setBlur(0, ''); // Reset blur
    
    // Shield effect for captured fireflies
    if (shieldActive && f.captured) {
      let shieldTime = now - lastShieldTime;
      let shieldRadius = 15 + sin(shieldTime * 0.008 + f.x * 0.01) * 2;
      let shieldAlpha = 0.2 + sin(shieldTime * 0.015 + f.y * 0.01) * 0.1;
      
      x.save();
      x.globalAlpha = shieldAlpha;
      setStroke("rgba(100, 150, 255, 0.6)");
      setLineWidth(2);
      x.setLineDash([4, 2]);
      x.lineDashOffset = -shieldTime * 0.03;
      x.beginPath();
      x.arc(f.x, f.y, shieldRadius, 0, TAU);
      x.stroke();
      x.setLineDash([]);
      x.restore();
    }
  }
};

let w,
  h,
  mx = 0,
  my = 0,
  glowPower = 0,
  charging = false,
  mouseMoving = false, // Track if mouse is currently moving
  lastMovementTime = 0, // When mouse last moved
  movementBuffer = 300, // Reduced to 0.3 seconds for quicker response
  maxed = false,
  flashTimer = 0,
  quickFlashPower = 0,
  floatTimer = 0,
  lastMx = 0,
  lastMy = 0,
  particles = [],
  otherFireflies = [],
  score = 0,
  catEyes = [],
  stars = [],
  orbitingFireflies = [], // Fireflies being absorbed by the cat
  scoreTexts = [],
  audioEnabled = true,
  gameOver = false,
  gameStarted = true,
  catEyeColor = "gold",
  catEyeChangeTimer = 0,
  nextColorChangeTime = 600 + F(r() * 300),
  startTime = null,
  lastWarningState = false,
  totalCollected = 0,  // Total fireflies collected across all runs
  totalLost = 0,       // Total fireflies lost across all runs
  runStartTime = null, // Start time of current run
  colorChangesEnabled = true, // Enable eye color changes immediately
  collectedCount = 0,  // Count collected fireflies
  summonHeat = 0, // Heat buildup from summoning (0-100)
  summonOverheated = false, // Whether system is overheated
  overheatCooldown = 0, // Frames until overheating ends
  overheatStunned = false, // Player movement disabled during overheat
  mouseNearCat = false, // Track if mouse is near cat's face
  catProximity = 0,     // How close mouse is to cat (0-1)
  mouseInBounds = true, // Track if mouse is within canvas bounds
  
  // Tutorial system - cleaner implementation
  tutorialComplete = localStorage.getItem('tutorialComplete') === 'true',
  tutorialStep = 0,     // Current tutorial step
  firstDeliveryMade = false, // Track first successful delivery
  tutorialTimer = 0,    // Timer for tutorial animations
  showHelp = false,     // Help menu state
  
  // Input state tracking  
  mousePressed = false, spacePressed = false,
  mouseDownTime = 0, spaceDownTime = 0,
  
  // Enhanced summoning visual effects - simplified
  clickSparkles = [],   // Simple sparkle effects at click points
  manaEnergy = 100,     // Energy for mana (0-100) - used for summoning and shielding
  shieldActive = false, // Whether shield is currently active
  shieldCooldown = 0,   // Cooldown after shield use
  lastShieldTime = 0,   // Track when shield was last used for forgiveness
  manaFlashTimer = 0;   // Red flash when trying to use abilities with 0 mana

// Helper function for cat eye color logic - reduces repeated code
function getCatEyeColors() {
  switch (catEyeColor) {
    case "gold": return { hex: "#ffdd00", r: 255, g: 221, b: 0 };
    case "purple": return { hex: "#8844ff", r: 136, g: 68, b: 255 };
    case "pink": return { hex: "#ff44aa", r: 255, g: 68, b: 170 };
    default: return { hex: "#ffdd00", r: 255, g: 221, b: 0 }; // fallback to gold
  }
}

function getCapturedFireflyColor(glow) {
  let colors = getCatEyeColors();
  
  switch (catEyeColor) {
    case "gold":
      // Gold: use red channel, boost green, zero blue
      return `rgb(${colors.r},${180 + glow * 75},0)`;
    case "purple":
      // Purple: boost red, keep low green, use blue channel
      return `rgb(${180 + glow * 75},80,${colors.b})`;
    case "pink":
      // Pink: use red channel, boost green, use blue channel
      return `rgb(${colors.r},${80 + glow * 100},${colors.b})`;
    default:
      // Fallback green
      return `rgb(${100 + glow * 100},255,${80 + glow * 100})`;
  }
}

function R() {
  w = innerWidth;
  h = innerHeight;
  c.width = w;
  c.height = h;
  initBackground();
}

function initBackground() {
  catEyes = [{ x: w / 2, y: h * 0.1, blinkTimer: 0, isBlinking: false, blinkDuration: 0 }];

  // Simple stars
  stars = [];
  for (let i = 0; i < 50; i++) {
    stars.push({
      x: r() * w,
      y: r() * h * 0.3,
      size: r() * 2 + 1,
      twinkle: r() * TAU,
      twinkleSpeed: 0.02 + r() * 0.03,
    });
  }
}

function drawBackground() {
  // Simple dark sky
  setFill("#050510");
  x.fillRect(0, 0, w, h * 0.3);
  
  // Ground
  setFill("#0c0c10"); 
  x.fillRect(0, h * 0.3, w, h);
  
  // Simple stars
  for (let i = 0; i < stars.length; i++) {
    let star = stars[i];
    star.twinkle += star.twinkleSpeed;
    let alpha = 0.3 + (sin(star.twinkle) * 0.5 + 0.5) * 0.7;
    setFill(WHITE(alpha));
    x.fillRect(star.x, star.y, star.size, star.size);
  }
}

function drawGrass() {
  // Simple ground line
  setFill("#0c0c10");
  x.fillRect(0, h - 10, w, 10);
}

// Cat Eyes System
function updateCatEyes(now) {
  // Progress color timer
  catEyeChangeTimer++;
  
  // Check for warning state and play warning sound when it starts
  let timeUntilChange = nextColorChangeTime - catEyeChangeTimer;
  let isWarning = timeUntilChange <= CFG.warnFrames; // Extended warning period (3 seconds for Mario Kart-style countdown)
  
  if (isWarning && !lastWarningState && otherFireflies.some(f => f.captured)) {
    // Warning just started and player has fireflies - play warning sound
    T(1000, .1, .08); // Color change warning sound
  }
  lastWarningState = isWarning;
  
  if (catEyeChangeTimer >= nextColorChangeTime) {
    // Check if shield is active OR was recently active (forgiving window)
    let recentShieldUse = now - (lastShieldTime || 0) < 2000; // 2 second grace window
    let capturedFireflies = otherFireflies.filter(f => f.captured);
    
    if (shieldActive || recentShieldUse) {
      // Calculate timing quality based on Mario Kart-style 3-flash countdown
      let framesUntilChange = nextColorChangeTime - catEyeChangeTimer;
      let warningPhase = CFG.warnFrames - framesUntilChange; // How far into the 3-second warning we are
      
      let protectionRate;
      let timingQuality;
      
      // Perfect timing: shield activated during flash 2 (frames 60-120 of warning)
      if (warningPhase >= CFG.flash1 && warningPhase <= CFG.flash2) {
        protectionRate = 1.0; // 100% protection - Mario Kart style perfect timing!
        timingQuality = "PERFECT";
      } 
      // Great timing: shield activated during flash 1 or early flash 3 (frames 0-60 or 120-150)
      else if ((warningPhase >= 0 && warningPhase <= CFG.flash1) || (warningPhase >= CFG.flash2 && warningPhase <= CFG.flash3)) {
        protectionRate = 0.85; // 85% protection  
        timingQuality = "GREAT";
      } 
      // Good timing: shield activated during late flash 3 or just before change (frames 150-180)
      else if (warningPhase >= CFG.flash3 && warningPhase <= CFG.warnFrames) {
        protectionRate = 0.7; // 70% protection
        timingQuality = "GOOD";
      } 
      // Late timing: shield activated too early (before warning) or after change
      else {
        protectionRate = 0.5; // 50% protection
        timingQuality = "LATE";
      }
      
      let firefliesLost = F(capturedFireflies.length * (1 - protectionRate));
      let firefliesProtected = capturedFireflies.length - firefliesLost;
      
      if (firefliesLost > 0) {
        score -= firefliesLost; // Still lose some points
        
        // Remove some captured fireflies (the unprotected ones)
        let lostCount = 0;
        otherFireflies.forEach(f => {
          if (f.captured && lostCount < firefliesLost) {
            f.captured = false;
            lostCount++;
          }
        });
      }
      
      shieldActive = false; // Shield is consumed
      shieldCooldown = CFG.shieldCooldown + getDifficulty() * 4; // Progressive cooldown
      
      // Different sounds for different timing quality
      if (timingQuality === "PERFECT") {
        T(300, .2, .15); // Higher pitch perfect sound
      } else if (timingQuality === "GREAT") {
        T(250, .25, .12); // Good timing sound
      } else {
        T(180, .25, .1); // Standard shield block sound
      }
      
      // Show shield success text with timing feedback
      let protectionText = firefliesLost === 0 ? `${timingQuality} SHIELD!` :
        `${timingQuality}: ${firefliesProtected} SAVED, ${firefliesLost} LOST`;
      
      // Color based on timing quality
      let colors = ["#ff8844", "#ffdd00", "#88ff44", "#00ff88"]; // Late, Good, Great, Perfect
      let colorIndex = ["LATE", "GOOD", "GREAT", "PERFECT"].indexOf(timingQuality);
      let textColor = colors[colorIndex] || "#ffaa00";
      
      addScoreText(protectionText, w / 2, h / 2 - 100, textColor, 180);
    } else {
      // Normal penalty when no shield active
      if (capturedFireflies.length > 0) {
        score -= capturedFireflies.length; // -1 point per captured firefly
        
        // Show penalty text with educational feedback
        addScoreText(`NO SHIELD! -${capturedFireflies.length}`, mx, my - 50, "#ff4444", 150);
        
        // Force release all captured fireflies and stop charging
        charging = false; // Force player to drop fireflies
        glowPower = 0; // Reset glow power
        totalLost += capturedFireflies.length; // Track total lost
        
        // Create small dispersal effect for lost fireflies
        capturedFireflies.forEach(f => {
          for (let i = 0; i < 3; i++) {
            particles.push({
              x: f.x,
              y: f.y,
              vx: (r() - 0.5) * 3,
              vy: (r() - 0.5) * 3,
              size: 1 + r(),
              life: 0,
              maxLife: 20 + r() * 15,
              color: "#ff6666", // Reddish for penalty
              alpha: 0.7,
              glow: true,
            });
          }
        });
        
        // Remove some of the lost fireflies to prevent accumulation
        // Keep a reasonable population but remove some to prevent lag
        let firefliesKept = F(capturedFireflies.length * 0.5); // Keep 50% of lost fireflies
        let firefliesRemoved = capturedFireflies.length - firefliesKept;
        
        // Remove the fireflies that are truly lost
        otherFireflies = otherFireflies.filter(f => !f.captured);
        
        // Respawn only the kept fireflies in new locations (fresh state)
        for (let i = 0; i < firefliesKept; i++) {
          spawnFirefly(); // Creates fresh fireflies without accumulated velocity
        }
        
        T(150, .3, .1); // Penalty sound
      }
    }
    
    // Change to a new random color for visual interest (no green)
    let colors = ["pink", "purple", "gold"];
    let newColor;
    do {
      newColor = colors[F(r() * colors.length)];
    } while (newColor === catEyeColor); // Ensure it's different from current
    
    catEyeColor = newColor;
    catEyeChangeTimer = 0;
    lastWarningState = false; // Reset warning state for next cycle
    
    // Progressive difficulty curve based on score and time
    let gameTime = now - (startTime || now);
    let gameMinutes = gameTime / 60000;
    
    // Early Game (0-1 min): Predictable, forgiving
    let minTime = 480; // 8 seconds base
    let maxTime = 900; // 15 seconds base
    
    if (gameMinutes > 1) {
      // Mid Game (1-3 mins): Speed up and add unpredictability
      let midGameFactor = Math.min(1, (gameMinutes - 1) / 2); // 0 to 1 over 2 minutes
      minTime = F(480 - (240 * midGameFactor)); // Down to 4 seconds
      maxTime = F(900 - (400 * midGameFactor)); // Down to 8.3 seconds
      
      // Add fake-outs and double shifts
      if (r() < 0.1 + (midGameFactor * 0.1)) {
        // 10-20% chance of very short interval (fake-out)
        minTime = F(minTime * 0.5);
        maxTime = F(maxTime * 0.6);
      }
    }
    
    if (gameMinutes > 3) {
      // Late Game (3+ mins): Chaos mode
      let lateGameFactor = Math.min(1, (gameMinutes - 3) / 2); // 0 to 1 over next 2 minutes
      minTime = F(180 - (60 * lateGameFactor)); // Down to 2 seconds
      maxTime = F(420 - (120 * lateGameFactor)); // Down to 5 seconds
      
      // Higher chance of instant double-shifts
      if (r() < 0.15 + (lateGameFactor * 0.15)) {
        nextColorChangeTime = 60 + F(r() * 120); // 1-3 seconds
        return; // Skip normal calculation
      }
    }
    
    // Random time between calculated min and max
    nextColorChangeTime = minTime + F(r() * (maxTime - minTime));
  }

  catEyes.forEach((eye) => {
    eye.blinkTimer++;
    // Increased blink interval to 1200 frames (20 seconds at 60fps) to make it less frequent
    if (!eye.isBlinking && eye.blinkTimer > 1200) {
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
}

// Optimized whisker drawing function
// dir: -1 (left) or 1 (right), eyeX/eyeY: eye center, twitch: whiskerTwitch, now: cached time
function drawWhiskers(dir, eyeX, eyeY, twitch, now) {
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

      // Unified twinkle formula (no side-specific offsets needed)
      let tw = sin(now * 0.001 + s * 2.2 + i * 3.1) * 0.5 + 0.5;
      tw += catProximity * 0.5; // Keep proximity boost
      const alpha = 0.3 + Math.min(0.7, tw * 0.7);

      // Draw star
      setFill(WHITE(alpha));
      x.beginPath();
      x.arc(sx, sy2, 1.5, 0, TAU);
      x.fill();

      // Subtle glow for brighter stars
      if (tw > 0.7) {
        setBlur(3, WHITE(0.5));
        x.beginPath();
        x.arc(sx, sy2, 0.75, 0, TAU);
        x.fill();
        setBlur(0, ''); // Reset to avoid affecting later draws
      }
    }
  }
}

function drawCatEyes(now) {
  if (catEyes.length > 0) {
    let eye = catEyes[0];
    let eyeX = eye.x;
    let eyeY = eye.y;

    // Calculate mouse proximity to cat's face for interactive effects
    let noseX = w / 2;
    let noseY = h * 0.2;
    let dx = mx - noseX;
    let dy = my - noseY;
    let distSq = dx*dx + dy*dy;
    catProximity = Math.max(0, 1 - hyp(dx, dy) / 150); // 0-1 based on distance
    mouseNearCat = distSq < CFG.deliveryRadius*CFG.deliveryRadius; // Use squared distance for comparison

    // Check if we're in the warning period (last 2 seconds = 120 frames)
    let timeUntilChange = nextColorChangeTime - catEyeChangeTimer;
    let isWarning = timeUntilChange <= 120;
    let flashIntensity = 1;
    
    if (isWarning) {
      // More subtle flash effect - reduced intensity range
      let flashSpeed = Math.max(0.3, timeUntilChange / 120); // Faster as time runs out
      flashIntensity = 0.7 + 0.3 * (sin(catEyeChangeTimer * (1 / flashSpeed)) * 0.5 + 0.5);
    }

    // Get color based on current cat eye color
    let colors = getCatEyeColors();
    let eyeColor = colors.hex;
    let shadowColor = colors.hex + "ff"; // Add full alpha

    // Mouse tracking for pupils
    let mouseDistX = mx - eyeX;
    let mouseDistY = my - eyeY;
    let maxPupilMove = 12;
    let pupilOffsetX = clamp(mouseDistX * 0.04, -maxPupilMove, maxPupilMove);
    let pupilOffsetY = clamp(mouseDistY * 0.04, -maxPupilMove, maxPupilMove);

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
    // Cat nose - triangle with point at bottom, enhanced with proximity only
    let noseAlpha = 0.4;
    let noseGlow = 0;
    
    // Make nose glow based on mouse proximity only (not captured fireflies)
    if (mouseNearCat) {
      let proximityTwinkle = sin(now * 0.015) * 0.5 + 0.5; // Gentle breathing effect
      noseAlpha = 0.4 + (catProximity * 0.6) + (proximityTwinkle * catProximity * 0.3); // Enhanced with mouse proximity
      noseGlow = (catProximity * 25) + (proximityTwinkle * catProximity * 10); // Strong glow when mouse is near
    }
    
    x.strokeStyle = WHITE(noseAlpha);
    x.lineWidth = 1.5;
    x.globalAlpha = noseAlpha;
    
    // Add glow effect when twinkling
    if (noseGlow > 0) {
      x.shadowBlur = noseGlow;
      x.shadowColor = WHITE(0.8);
    }
    
    x.beginPath();
    x.moveTo(eyeX - 8, eyeY + 40); // Top left (larger - was 6, now 8)
    x.lineTo(eyeX + 8, eyeY + 40); // Top right  
    x.lineTo(eyeX, eyeY + 52); // Bottom point (larger - was 50, now 52)
    x.closePath();
    x.stroke();
    
    // Reset shadow
    x.shadowBlur = 0;

    // Cat whiskers - enhanced with mouse proximity effects
    // Create gentle breathing effect for whiskers + mouse proximity enhancement
    let whiskerBreathing = sin(now * 0.002) * 0.5 + 0.5; // Slow, breathing-like
    let proximityEffect = catProximity * 0.6; // Extra glow when mouse is near
    let whiskerAlpha = 0.3 + (whiskerBreathing * 0.4) + proximityEffect; // Enhanced with proximity
    let whiskerGlow = (whiskerBreathing * 8) + (catProximity * 15); // Much more glow when near
    
    // Add twitch effect when mouse is very close
    let whiskerTwitch = mouseNearCat ? sin(now * 0.02) * catProximity * 3 : 0;
    
    // Batch canvas state for whiskers
    setStroke(WHITE(Math.min(1, whiskerAlpha)));
    setLineWidth(1);
    x.globalAlpha = Math.min(1, whiskerAlpha);
    
    // Add gentle glow to whiskers
    if (whiskerGlow > 0) {
      setBlur(whiskerGlow, WHITE(0.3));
    }
    
    // Draw left and right whiskers using optimized function
    drawWhiskers(-1, eyeX, eyeY, whiskerTwitch, now); // Left whiskers
    drawWhiskers(1, eyeX, eyeY, whiskerTwitch, now);  // Right whiskers

    // Reset shadow effects and alpha
    setBlur(0, '');
    x.globalAlpha = 1; // Reset alpha
  }
}

// Firefly System
function spawnFirefly(summoned = false, forceManaFirefly = false) {
  // For summoned fireflies, spawn from bottom of screen and make them obvious
  let x, y;
  if (summoned) {
    x = r() * w;
    y = h + 20; // Start below screen
  } else {
    x = r() * w;
    y = h * 0.3 + r() * (h * 0.5);
  }

  // Determine firefly type
  let type = "green";
  let value = 1;
  let isManaFirefly = false;
  
  // Special mana firefly spawns when resources are critically low
  if (forceManaFirefly || (!summoned && manaEnergy < 20 && r() < 0.008)) { // ~0.8% chance when low mana
    type = "mana";
    value = 1; // Same capture value, but special mana restoration
    isManaFirefly = true;
  }

  let newFirefly = {
    x: x,
    y: y,
    type: type,
    value: value,
    floatTimer: r() * TAU,
    flashTimer: r() * TAU,
    glowPhase: r() * TAU,
    captured: false,
    fadeIn: summoned ? 0 : 1,
    captureOffset: { x: 0, y: 0 },
    summoned: summoned, // Track if this was summoned
    summonSpeed: summoned ? 2 + r() * 2 : 0, // Initial upward speed for summoned fireflies
    summonGlow: summoned ? 120 : 0, // Extra glow for summoned fireflies
    // New roaming properties
    roamTarget: null, // Will be set on first update
    roamSpeed: isManaFirefly ? 0.2 + r() * 0.2 : 0.3 + r() * 0.4, // Slower, more deliberate movement for mana fireflies
    flashCycle: r() * TAU,
    nextFlashTime: r() * 180 + 60, // Random initial flash time
    // Special mana firefly properties
    isManaFirefly: isManaFirefly,
    manaHeartbeat: 0, // For special pulsing effect
    trailParticles: isManaFirefly ? [] : null, // Golden particle trail for mana fireflies
  };

  // Prevent firefly population from growing too large (causes lag)
  let maxFireflies = 25; // Reduced limit for better performance
  if (otherFireflies.length < maxFireflies) {
    otherFireflies.push(newFirefly);
  }
}

// Simple, responsive clicking effects
function createClickSparkles(mouseX, mouseY) {
  // Create 8-10 sparkles at click point for better visibility
  let count = 8 + F(r() * 3);
  for (let i = 0; i < count; i++) {
    clickSparkles.push({
      x: mouseX + (r() - 0.5) * 30,
      y: mouseY + (r() - 0.5) * 30,
      vx: (r() - 0.5) * 6,
      vy: (r() - 0.5) * 6 - 2, // More upward bias
      size: 2 + r() * 3, // Bigger sparkles
      life: 30 + r() * 20,
      maxLife: 50,
      w: r() > 0.3 ? 1 : 0 // 1=white, 0=yellow
    });
  }
}

function updateClickEffects() {
  // Update sparkles
  clickSparkles = clickSparkles.filter(sparkle => {
    sparkle.x += sparkle.vx;
    sparkle.y += sparkle.vy;
    sparkle.vy += 0.1; // Gravity
    sparkle.vx *= 0.98; // Air resistance
    sparkle.life--;
    return sparkle.life > 0;
  });
  
  // Update mana energy and cooldown
  if (shieldCooldown > 0) {
    shieldCooldown--;
  }
  // Removed automatic energy recovery - only refills when delivering fireflies
  
  if (shieldActive) {
    manaEnergy -= 1; // Slower drain while active for longer shield duration
    if (manaEnergy <= 0) {
      shieldActive = false;
      shieldCooldown = 180; // 3 second cooldown after depletion
    }
  }
}

function drawClickEffects() {
  // Draw simple sparkles
  clickSparkles.forEach(sparkle => {
    let alpha = sparkle.life / sparkle.maxLife;
    let colors = SPK[sparkle.w];
    setFill(`rgba(${colors[0]},${alpha})`);
    
    setBlur(8 * alpha, colors[1]);
    x.beginPath();
    x.arc(sparkle.x, sparkle.y, sparkle.size * alpha, 0, TAU);
    x.fill();
  });
  
  setBlur(0, ''); // Reset blur after sparkles
  
  // Help icon in top-right corner (moved since we removed mana bar)
  if (gameStarted && !gameOver) {
    setFill(WHITE(0.5));
    x.font = "14px serif";
    x.fillText("?", w - 30, 25);
    x.font = "10px monospace";
    x.fillText("R", w - 30, 35);
  }
}

function updateFireflies(fx, fy) {
  otherFireflies.forEach((f) => {
    // Special particle trail for mana fireflies
    if (f.isManaFirefly && r() < 0.3) { // 30% chance each frame
      particles.push({
        x: f.x + (r() - 0.5) * 6,
        y: f.y + (r() - 0.5) * 6,
        vx: (r() - 0.5) * 0.5,
        vy: (r() - 0.5) * 0.5,
        size: 1 + r(),
        life: 0,
        maxLife: 25 + r() * 15,
        color: "#ffb400", // Golden particles
        alpha: 0.6,
        glow: true,
      });
    }
    
    // Handle summoned firefly effects
    if (f.summoned) {
      // Fly upward with direct position movement
      f.y -= f.summonSpeed;
      f.summonSpeed *= 0.98; // Gradually slow down
      
      // Fade in effect
      if (f.fadeIn < 1) {
        f.fadeIn += 0.05;
      }
      
      // Reduce summon glow over time
      if (f.summonGlow > 0) {
        f.summonGlow -= 2;
      }
      
      // Stop being "summoned" once fully faded in and settled
      if (f.fadeIn >= 1 && f.summonGlow <= 0) {
        f.summoned = false;
      }
    }
    
    if (f.captured) {
      // Captured fireflies drift towards player with floating motion
      if (charging) {
        let targetX = fx + f.captureOffset.x;
        let targetY = fy + f.captureOffset.y;

        // Gentle drift towards target position with floating
        f.floatTimer += 0.15;
        let floatX = sin(f.floatTimer) * 8;
        let floatY = cos(f.floatTimer * 1.4) * 6;

        f.x += (targetX + floatX - f.x) * 0.1;
        f.y += (targetY + floatY - f.y) * 0.1;
      } else {
        // Space released - disperse to random gameplay areas
        f.captured = false;
        
        // Choose random target position within gameplay area
        let targetX = r() * w;
        let targetY = h * 0.3 + r() * (h * 0.5); // Stay in main gameplay zone
        
        // Calculate direction and distance to target
        let dx = targetX - f.x;
        let dy = targetY - f.y;
        let distance = hyp(dx, dy);
        
        // Apply direct position movement for dispersal
        let speed = 3 + r() * 2; // Moderate dispersal speed
        let moveX = (dx / distance) * speed;
        let moveY = (dy / distance) * speed;
        
        f.x += moveX;
        f.y += moveY;
        
        T(350, 0.15, 0.06); // Firefly pickup sound
      }
    } else {
      // Handle fade-in for summoned fireflies
      if (f.fadeIn < 1) {
        f.fadeIn += 0.03;
        f.fadeIn = Math.min(1, f.fadeIn);
      }

      // Normal floating behavior - more naturalistic roaming
      let speedMultiplier = getSpeedMultiplier(); // Gets faster as score increases
      
      // Add slow roaming movement - fireflies actually travel to different areas
      if (!f.roamTarget || Math.abs(f.x - f.roamTarget.x) < 30 && Math.abs(f.y - f.roamTarget.y) < 30) {
        // Set new roaming target
        f.roamTarget = {
          x: r() * w,
          y: h * 0.35 + r() * (h * 0.45) // Stay in grass area
        };
        f.roamSpeed = 0.3 + r() * 0.4; // Vary roaming speed
      }
      
      // Gentle movement toward roam target (but cap the distance moved per frame)
      let dx = f.roamTarget.x - f.x;
      let dy = f.roamTarget.y - f.y;
      let distSq = dx*dx + dy*dy;
      if (distSq > 25) { // 5*5 = 25
        let dist = hyp(dx, dy); // Only compute distance when needed for normalization
        let maxMove = f.roamSpeed * speedMultiplier;
        f.x += Math.max(-maxMove, Math.min(maxMove, (dx / dist) * maxMove));
        f.y += Math.max(-maxMove, Math.min(maxMove, (dy / dist) * maxMove));
      }
      
      // Add gentle floating wobble on top of roaming (but smaller)
      f.floatTimer += (0.04 + r() * 0.02) * speedMultiplier; // Slower, less erratic
      f.x += sin(f.floatTimer) * (0.2 * speedMultiplier); // Much smaller wobble
      f.y += cos(f.floatTimer * 1.3) * (0.15 * speedMultiplier); // Much smaller wobble
      
      // Only apply gentle downward nudge if firefly is above the grass line (too high)
      if (f.y < h * 0.35) { // If above grass area
        f.y += 0.2; // Gentle push down toward grass area
      }
      
      // More realistic firefly flashing - but faster for game aesthetics
      f.flashTimer += 0.04 + r() * 0.02; // Medium progression for base glow
      
      // Flash cycle for occasional bright flashes
      f.flashCycle = (f.flashCycle || 0) + (0.02 + r() * 0.01);
      if (f.flashCycle > TAU) {
        f.flashCycle = 0;
        // Trigger occasional flash randomly
        if (r() < 0.3) { // 30% chance to start a flash cycle
          f.nextFlashTime = r() * 60 + 30; // Start flash soon
        }
      }
      
      f.glowPhase += 0.06; // Slightly faster glow progression

      // Keep fireflies within screen bounds with gentle wrapping
      if (f.x < -10) f.x = w + 10; // Wrap left to right
      if (f.x > w + 10) f.x = -10; // Wrap right to left
      if (f.y < h * 0.25) f.y = h * 0.3; // Don't go too high (keep below sky area)
      if (f.y > h - 20) f.y = h * 0.7; // Don't go too low (keep above bottom edge)

      if (charging || glowPower > 20) {
        let dx = fx - f.x,
          dy = fy - f.y;
        let distSq = dx*dx + dy*dy;

        if (distSq < 200*200) {
          // Use direct position movement instead of velocity for attraction
          let dist = hyp(dx, dy); // Only compute distance when needed for normalization
          let force = ((charging ? 0.8 : 0.3) * (200 - dist)) / 200;
          let maxAttraction = 2; // Cap the attraction movement per frame
          let moveX = Math.max(-maxAttraction, Math.min(maxAttraction, (dx / dist) * force));
          let moveY = Math.max(-maxAttraction, Math.min(maxAttraction, (dy / dist) * force));
          f.x += moveX;
          f.y += moveY;
        }

        // Capture firefly when close and charging
        if (charging && distSq < 25*25) {
          f.captured = true;
          f.captureOffset.x = f.x - fx + (r() - 0.5) * 20;
          f.captureOffset.y = f.y - fy + (r() - 0.5) * 20;
          T(800, .2, .1); // Pickup sound

          // Capture particles
          for (let i = 0; i < 5; i++) {
            let a = r() * TAU;
            particles.push({
              x: f.x,
              y: f.y,
              vx: cos(a) * 1,
              vy: sin(a) * 1,
              t: 0,
              isBurst: true,
            });
          }
        }
      }
    }
  });

  // Check for delivery to cat (between the eyes)
  checkDeliveryZone(fx, fy);
}

function updateOrbitingFireflies() {
  orbitingFireflies = orbitingFireflies.filter(f => {
    f.life++;
    
    // Spiral inward while orbiting
    f.angle += f.orbitSpeed;
    f.radius -= f.spiralSpeed;
    
    // Update position based on orbital motion
    f.x = f.centerX + cos(f.angle) * f.radius;
    f.y = f.centerY + sin(f.angle) * f.radius;
    
    // Fade out as it approaches center
    f.alpha = 1 - (f.life / f.maxLife);
    
    // When it reaches the center or times out, create burst effect
    if (f.radius <= 5 || f.life >= f.maxLife) {
      // Create sparkle burst at absorption point
      for (let i = 0; i < 6; i++) {
        particles.push({
          x: f.x,
          y: f.y,
          vx: (r() - 0.5) * 4,
          vy: (r() - 0.5) * 4,
          size: 1 + r() * 2,
          life: 0,
          maxLife: 30 + r() * 20,
          color: catEyeColor,
          alpha: 0.8,
          glow: true,
        });
      }
      return false; // Remove this orbiting firefly
    }
    
    return true; // Keep this orbiting firefly
  });
}

// Optimized ring drawing helper
// cx,cy: center, r: radius, stroke: stroke color, alpha: opacity, lineWidth: width, dashed: dash pattern or null
function drawRing(cx, cy, r, stroke, alpha, lineWidth, dashed) {
  setStroke(stroke.replace('ALPHA', alpha)); // Replace placeholder with actual alpha
  setLineWidth(lineWidth);
  if (dashed) x.setLineDash(dashed);
  x.beginPath();
  x.arc(cx, cy, r, 0, TAU);
  x.stroke();
  if (dashed) x.setLineDash([]); // Reset dash only if it was set
}

function drawDeliveryZone(now) {
  if (!gameStarted || gameOver) return;
  
  let noseX = w / 2;
  let noseY = h * 0.2;
  let noseRadius = 50; // Match the smaller delivery zone
  let capturedFireflies = otherFireflies.filter(f => f.captured);
  let requiredFireflies = Math.max(1, F(score / 100) + 1);
  
  // Tutorial: Show prominent delivery zone for first-time players
  if (!tutorialComplete && capturedFireflies.length > 0 && !firstDeliveryMade) {
    let pulse = 0.6 + 0.4 * sin(now * 0.008); // Strong pulse
    
    // Large, prominent outer circle
    drawRing(noseX, noseY, noseRadius + 20, LIGHT_GREEN('ALPHA'), pulse, 4, null);
    
    // Inner glow effect
    drawRing(noseX, noseY, noseRadius + 15, LIGHT_GREEN('ALPHA'), pulse * 0.3, 8, null);
    
    // Tutorial text with elegant font
    x.textAlign = 'center';
    x.font = '22px Georgia, serif';
    setFill(WHITE(pulse));
    x.fillText('Deliver fireflies here!', noseX, noseY + noseRadius + 60);
    
    // Additional helpful text
    x.font = '16px Georgia, serif';
    setFill(LIGHT_GRAY(pulse * 0.8));
    x.fillText('Move close to the cat\'s nose', noseX, noseY + noseRadius + 85);
    return; // Don't show normal indicators during tutorial
  }
  
  // Normal gameplay: Minimal UI
  if (capturedFireflies.length > 0) {
    let canDeliver = capturedFireflies.length >= requiredFireflies;
    let alpha = 0.15 + sin(now * 0.005) * 0.05; // Very subtle pulse
    
    // Minimal zone circle with appropriate color
    let color = canDeliver ? GREEN('ALPHA') : YELLOW('ALPHA');
    drawRing(noseX, noseY, noseRadius, color, alpha, 1, [3, 3]);
    
    // Subtle requirement text
    if (capturedFireflies.length < requiredFireflies) {
      x.textAlign = 'center';
      x.font = '16px Georgia, serif';
      setFill(WHITE(alpha * 3));
      x.fillText(`${capturedFireflies.length}/${requiredFireflies}`, noseX, noseY + noseRadius + 20);
    }
  }
}

function checkDeliveryZone(fx, fy) {
  // Define delivery zone at cat's nose - more precise and rewarding
  let noseX = w / 2; // Center between eyes
  let noseY = h * 0.2; // Cat nose area (above skyline)
  let noseRadius = 50; // Smaller, focused on mouth area for orbital effect
  
  let capturedFireflies = otherFireflies.filter(f => f.captured);
  let dx = fx - noseX;
  let dy = fy - noseY;
  let distSq = dx*dx + dy*dy;
  
  // Check if player is in nose delivery zone with captured fireflies
  let requiredFireflies = getRequiredFireflies(); // Need more fireflies as score increases
  if (distSq < noseRadius*noseRadius && capturedFireflies.length >= requiredFireflies) {
    // Successful delivery - award points based on progressive difficulty
    let bonusMultiplier = Math.max(1, getDifficulty() + 1); // Bonus points for higher difficulty
    let pointsAwarded = capturedFireflies.length * bonusMultiplier;
    score += pointsAwarded;
    totalCollected += capturedFireflies.length; // Track total collected
    
    // Tutorial tracking
    if (!firstDeliveryMade) {
      firstDeliveryMade = true;
      if (!tutorialComplete) {
        tutorialStep++;
      }
    }
    
    // Complete tutorial after a few deliveries
    if (!tutorialComplete && score >= 50) {
      tutorialComplete = true;
      localStorage.setItem('tutorialComplete', 'true');
      addScoreText('Tutorial Complete!', w/2, h/2, '#00ff00', 180);
    }
    
    // Reset heat when delivering fireflies (reward for proper gameplay)
    summonHeat = Math.max(0, summonHeat - (capturedFireflies.length * 15)); // Cool down significantly
    if (summonOverheated && summonHeat <= 40) {
      summonOverheated = false; // End overheat early if cooled down enough
      overheatCooldown = 0;
      overheatStunned = false;
    }
    
    // Refill mana energy when delivering fireflies (sacrifice them for mana)
    let manaFireflies = capturedFireflies.filter(f => f.isManaFirefly);
    let normalFireflies = capturedFireflies.filter(f => !f.isManaFirefly);
    
    // Normal fireflies give +10 mana each
    addMana(normalFireflies.length * 10);
    
    // Special mana fireflies restore full mana!
    if (manaFireflies.length > 0) {
      manaEnergy = 100; // Full restore
      // Create special visual effect for mana restoration
      for (let i = 0; i < 15; i++) {
        particles.push({
          x: fx + (r() - 0.5) * 40,
          y: fy + (r() - 0.5) * 40,
          vx: (r() - 0.5) * 4,
          vy: (r() - 0.5) * 4 - 1, // Slight upward bias
          size: 2 + r() * 2,
          life: 0,
          maxLife: 40 + r() * 20,
          color: "#ffb400", // Golden color
          alpha: 0.8,
          glow: true,
        });
      }
      
      // Special score text for mana restoration
      addScoreText("MANA RESTORED!", fx, fy - 50, "gold", 120);
    }
    
    // Show success text at player position
    addScoreText(`+${pointsAwarded}`, fx, fy - 30, "#00ff00", 90);
    
    // Create flutter-away effect and start orbital absorption
    capturedFireflies.forEach((f, i) => {
      // Create orbiting firefly for mystical absorption effect
      orbitingFireflies.push({
        x: f.x,
        y: f.y,
        centerX: noseX,
        centerY: noseY,
        angle: Math.atan2(f.y - noseY, f.x - noseX), // Current angle from center
        radius: hyp(f.x - noseX, f.y - noseY), // Current distance
        orbitSpeed: 0.15 + r() * 0.1, // How fast it orbits
        spiralSpeed: 0.8 + r() * 0.4, // How fast it spirals inward
        life: 0,
        maxLife: 180, // 3 seconds to spiral in
        color: getCapturedFireflyColor(),
        size: 3 + r() * 2,
        glow: 0.8 + r() * 0.4
      });
      
      // Create fewer flutter particles since we have the orbital effect
      for (let j = 0; j < 4; j++) { // Reduced from 8
        particles.push({
          x: f.x + (r() - 0.5) * 20,
          y: f.y + (r() - 0.5) * 10,
          vx: (r() - 0.5) * 2,
          vy: -0.5 - r() * 1, // Float upward toward cat
          size: 1 + r() * 2,
          life: 0,
          maxLife: 40 + r() * 20,
          color: catEyeColor, // Transform to cat's current color
          alpha: 0.6,
          glow: true,
          flutterTimer: r() * TAU,
        });
      }
    });
    
    // Remove delivered fireflies
    otherFireflies = otherFireflies.filter(f => !f.captured);
    
    // Spawn new fireflies to replace delivered ones
    for (let i = 0; i < capturedFireflies.length; i++) {
      spawnFirefly();
    }
    
    T(200, .5, .15); // Delivery purr
  }
}

function drawFireflies(now) {
  otherFireflies.forEach((f) => {
    // Handle fade in for summoned fireflies
    let alpha = f.fadeIn || 1;
    if (alpha <= 0) return;

    x.globalAlpha = alpha;
    
    // Update mana firefly heartbeat
    if (f.isManaFirefly) {
      f.manaHeartbeat += 0.15;
    }
    
    // Draw body using helper
    drawBody(f);
    
    // Draw glow using helper  
    drawGlow(f, now);

    x.globalAlpha = 1; // Reset alpha
  });
  
  // Draw orbiting fireflies (being absorbed by cat)
  orbitingFireflies.forEach((f) => {
    x.globalAlpha = f.alpha || 1;
    
    // Draw firefly body
    x.fillStyle = "#333";
    x.beginPath();
    x.arc(f.x, f.y, f.size, 0, TAU);
    x.fill();
    
    // Draw glow
    if (f.glow > 0.3) {
      let size = f.size + f.glow * 3;
      let blur = 8 + f.glow * 12;
      setBlur(blur, f.color);
      x.fillStyle = f.color;
      x.beginPath();
      x.arc(f.x, f.y, size, 0, TAU);
      x.fill();
    }
    
    x.globalAlpha = 1;
  });
  
  setBlur(0, ''); // Reset blur after firefly rendering
} // End of firefly rendering
function updateParticles(fx, fy) {
  if (r() < 0.08) {
    particles.push({
      x: fx + (r() - 0.5) * 8,
      y: fy + (r() - 0.5) * 8,
      t: 0,
      isBurst: false,
    });
  }

  if (charging && r() < 0.4) {
    let a = r() * TAU;
    let s = 0.3 + r() * 0.7;
    particles.push({
      x: fx + (r() - 0.5) * 2,
      y: fy + (r() - 0.5) * 2,
      vx: cos(a) * s,
      vy: sin(a) * s,
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
}

function drawParticles() {
  particles.forEach((p) => {
    let alpha = sin(p.t * 3) * 0.4 + 0.3;
    if (alpha > 0) {
      x.fillStyle = `rgba(150,255,150,${alpha})`;
      x.beginPath();
      x.arc(p.x, p.y, 0.8, 0, TAU);
      x.fill();
    }
  });
}

function drawPlayerFirefly(fx, fy, now) {
  // Player firefly: vibrant cyan-blue when moving, brighter gray-white when idle
  let isMoving = mouseMoving || charging;
  let firefly_color = isMoving ? "#00aaff" : "#aaaacc"; // Vibrant cyan-blue when moving, brighter gray-white when idle
  let shadowColor = isMoving ? "#00aaff" : "#8888aa";
  
  // Sputtering effect when overheated
  if (summonOverheated) {
    let sputter = sin(now * 0.05) * 0.5 + 0.5; // Fast flicker
    firefly_color = sputter > 0.3 ? "#ff4444" : "#441111"; // Red sputtering
    shadowColor = "#ff4444";
    
    // Add erratic movement during stun
    if (overheatStunned) {
      fx += (r() - 0.5) * 4;
      fy += (r() - 0.5) * 4;
    }
  }
  
  // Draw the base firefly
  setFill(firefly_color);
  x.beginPath();
  x.arc(fx, fy, 3, 0, TAU);
  x.fill();

  let totalGlow = Math.max(glowPower, quickFlashPower);
  let baseGlow = 20;
  let enhancedGlow = charging ? 40 : 0;
  let shieldGlow = shieldActive ? 50 : 0; // Dramatic glow when shield is active
  
  totalGlow = Math.max(totalGlow, baseGlow + enhancedGlow + shieldGlow);

  // Draw circular shield/mana indicator around player firefly (Dead Space style)
  let capturedCount = otherFireflies.filter(f => f.captured).length;
  let baseRadius = 18 + Math.min(capturedCount * 2, 12); // Grows with captured fireflies
  let ringWidth = 3;
  
  // Always show the circular indicator (unless completely overheated)
  if (!summonOverheated || overheatCooldown < 120) {
    // Background ring (gray)
    x.strokeStyle = "rgba(100, 100, 100, 0.3)";
    x.lineWidth = ringWidth;
    x.beginPath();
    x.arc(fx, fy, baseRadius, 0, TAU);
    x.stroke();
    
    if (!summonOverheated) {
      // Mana level ring (blue/teal)
      let manaProgress = manaEnergy / 100;
      let manaAngle = manaProgress * TAU;
      
      let canUseShield = manaEnergy > 0 && shieldCooldown === 0 && !summonOverheated;
      let pulseIntensity = canUseShield ? 0.7 + sin(now * 0.01) * 0.3 : 0.6;
      
      x.strokeStyle = `rgba(100, 180, 180, ${pulseIntensity})`;
      x.lineWidth = ringWidth;
      x.beginPath();
      x.arc(fx, fy, baseRadius, -Math.PI/2, -Math.PI/2 + manaAngle);
      x.stroke();
      
      // Heat overlay (yellow/orange/red)
      if (summonHeat > 0) {
        let heatProgress = summonHeat / 100;
        let heatAngle = heatProgress * TAU;
        
        let heatColor = heatProgress > 0.8 ? "255, 100, 100" : 
                       heatProgress > 0.5 ? "255, 180, 100" : "255, 255, 100";
        let heatAlpha = 0.4 + heatProgress * 0.4;
        
        x.strokeStyle = `rgba(${heatColor}, ${heatAlpha})`;
        x.lineWidth = ringWidth + 1;
        x.beginPath();
        x.arc(fx, fy, baseRadius + 1, -Math.PI/2, -Math.PI/2 + heatAngle);
        x.stroke();
      }
      
      // Active shield effect
      if (shieldActive) {
        let shieldTime = now - lastShieldTime;
        let shieldPulse = 0.8 + sin(shieldTime * 0.02) * 0.2;
        
        x.strokeStyle = BLUE(shieldPulse);
        x.lineWidth = ringWidth + 2;
        setBlur(8, BLUE(0.6));
        x.beginPath();
        x.arc(fx, fy, baseRadius + 2, 0, TAU);
        x.stroke();
        
        // Rotating energy particles
        for (let i = 0; i < 4; i++) {
          let angle = (shieldTime * 0.005 + i * TAU / 4);
          let particleX = fx + cos(angle) * (baseRadius + 4);
          let particleY = fy + sin(angle) * (baseRadius + 4);
          
          x.fillStyle = BLUE(shieldPulse);
          x.beginPath();
          x.arc(particleX, particleY, 1.5, 0, TAU);
          x.fill();
        }
        
        setBlur(0, ''); // Reset blur after shield effects
      }
      
      // Mana insufficient flash - red ring flash when trying to use abilities without mana
      if (manaFlashTimer > 0) {
        let flashIntensity = manaFlashTimer / 30; // Fade from 1 to 0
        let flashAlpha = flashIntensity * 0.7; // More visible on the ring than screen flash
        
        x.strokeStyle = `rgba(255, 80, 80, ${flashAlpha})`;
        x.lineWidth = ringWidth + 1;
        setBlur(4, `rgba(255, 80, 80, ${flashAlpha * 0.5})`);
        x.beginPath();
        x.arc(fx, fy, baseRadius + 1, 0, TAU);
        x.stroke();
      }
    } else {
      // Overheated: show red sputter effect
      let sputterIntensity = sin(now * 0.05) * 0.5 + 0.5;
      if (sputterIntensity > 0.7) {
        x.strokeStyle = `rgba(255, 80, 80, ${sputterIntensity * 0.6})`;
        x.lineWidth = ringWidth;
        x.beginPath();
        x.arc(fx, fy, baseRadius, 0, TAU * sputterIntensity);
        x.stroke();
      }
    }
  }

  if (totalGlow > 0) {
    let i = Math.min(totalGlow / 100, 1);
    let size = 3 + i * 5;
    let blur = 15 + i * 30;
    
    // Player glow: vibrant cyan-blue when moving, muted gray-white when idle
    let isMoving = mouseMoving || charging;
    let glowIntensity = i; // Use the calculated glow intensity
    let color;
    
    if (isMoving) {
      // Vibrant cyan-blue glow when moving
      let glowR = F(0 * glowIntensity);      // No red for pure cyan
      let glowG = F(170 * glowIntensity);    // Strong green component
      let glowB = F(255 * glowIntensity);    // Full blue component
      color = `rgb(${glowR},${glowG},${glowB})`;
    } else {
      // Brighter gray-white glow when idle  
      let glowR = F(170 * glowIntensity);
      let glowG = F(170 * glowIntensity); 
      let glowB = F(204 * glowIntensity);
      color = `rgb(${glowR},${glowG},${glowB})`;
    }

    setBlur(blur, shadowColor);
    x.fillStyle = color;
    x.beginPath();
    x.arc(fx, fy, size, 0, TAU);
    x.fill();
    x.globalAlpha = 1; // Reset alpha
  }
}

// Input Handling
c.onmousemove = (e) => {
  lastMx = mx;
  lastMy = my;
  mx = e.clientX;
  my = e.clientY;
  mouseInBounds = true;
  
  // Don't process game movement when help is open or player is stunned
  if (overheatStunned) return;
  
  // Track mouse movement for automatic collection
  mouseMoving = true;
  lastMovementTime = Date.now();
  charging = true; // Auto-charge when moving
};

c.onmouseleave = () => {
  mouseInBounds = false;
};

c.onmouseenter = () => {
  mouseInBounds = true;
};

c.onmousedown = (e) => {
  // Check for restart click when game over
  if (gameOver) {
    // Reset game state
    gameOver = false;
    score = 0; // Reset score for new run
    glowPower = 0;
    charging = false;
    mouseMoving = false;
    scoreTexts = [];
    otherFireflies = [];
    catEyeColor = "gold";
    catEyeChangeTimer = 0;
    nextColorChangeTime = 600 + F(r() * 300); // Random 10-15 seconds on restart (forgiving)
    lastWarningState = false; // Reset warning state
    summonHeat = 0; // Reset heat system
    summonOverheated = false; // Reset overheat state
    overheatCooldown = 0; // Reset overheat cooldown
    overheatStunned = false; // Reset stun state
    mouseNearCat = false; // Reset cat proximity
    catProximity = 0; // Reset proximity value
    
    // Reset tutorial state
    tutorialStep = 0;
    tutorialTimer = 0;
    firstDeliveryMade = false;
    
    // Reset click effects
    clickSparkles = [];
    manaEnergy = 100; // Fixed: use manaEnergy
    shieldActive = false;
    shieldCooldown = 0;
    lastShieldTime = 0;
    
    startTime = Date.now(); // Reset start time for difficulty scaling
    runStartTime = Date.now(); // Reset run timer
    // Spawn starting fireflies (fewer for tutorial, more for experienced players)
    let spawnCount = tutorialComplete ? 20 : 8;
    for (let i = 0; i < spawnCount; i++) spawnFirefly();
    if (audioEnabled) T(600, 0.2, 0.1); // Restart sound
    return;
  }

  // Track mouse press
  mousePressed = true;
  mouseDownTime = Date.now();
};

c.onmouseup = (e) => {
  if (!gameStarted || gameOver) return;
  
  let holdDuration = Date.now() - mouseDownTime;
  mousePressed = false;

  // Quick click summoning with heat system
  if (holdDuration < 150) {
    if (canSummon()) {
      createClickSparkles(e.clientX, e.clientY);
      spawnFirefly("red"); // Each click summons 1 firefly
      useMana(10); // Fixed 10 mana cost
      summonHeat = Math.min(100, summonHeat + 8); // Add heat per click
      T(800, 0.1, 0.1); // Click sound
      
      // Check for overheat
      if (summonHeat >= 100) {
        summonOverheated = true;
        overheatCooldown = 300; // 5 seconds of overheat penalty - substantial punishment
        overheatStunned = true; // Player can't move during initial stun
        T(200, 0.3, 0.15); // Overheat warning sound
      }
    } else if (summonOverheated) {
      T(120, 0.08, 0.03); // Subtle bonk sound when overheated - lower pitch and volume
    } else if (manaEnergy < 10) {
      // Not enough mana - red flash and subtle sound
      manaFlashTimer = 30; // 0.5 seconds of red flash
      T(100, 0.06, 0.02); // Very subtle "empty" sound
    }
  }
  
  // Deactivate shield when mouse released (if it was from holding)
  if (shieldActive && holdDuration >= 150) {
    shieldActive = false;
    shieldCooldown = 180; // 3 second cooldown
  }
};

c.onclick = (e) => {
  // This event fires after mousedown/mouseup, so we don't need additional logic here
  // The charging logic is already handled by mousedown/mouseup
};

document.onkeydown = (e) => {
  // Handle mute toggle with M key
  if (e.code === "KeyM") {
    e.preventDefault();
    audioEnabled = !audioEnabled;
    if (audioEnabled) {
      T(600, 0.1, 0.08); // Soft confirmation chime
    }
    return;
  }

  // Handle rules toggle with R key, and ESC to close
  if (e.code === "KeyR" || e.code === "Escape") {
    e.preventDefault();
    showHelp = !showHelp;
    return;
  }

  // Handle shield with spacebar
  if (e.code === "Space") {
    e.preventDefault();
    
    if (!spacePressed) {
      spacePressed = true;
      spaceDownTime = Date.now();
    }
    return;
  }
};

document.onkeyup = (e) => {
  if (!gameStarted || gameOver) return;
  
  if (e.code === "Space") {
    e.preventDefault();
    
    let holdDuration = Date.now() - spaceDownTime;
    spacePressed = false;

    if (holdDuration < 150) { 
      // Quick spacebar tap - summon firefly with heat system
      if (!summonOverheated && manaEnergy >= 10) {
        createClickSparkles(mx, my); // Use current mouse position
        spawnFirefly("red"); // Each tap summons 1 firefly
        manaEnergy = Math.max(0, manaEnergy - 10); // Fixed 10 mana cost
        summonHeat = Math.min(100, summonHeat + 8); // Add heat per tap
        T(800, 0.1, 0.1); // Click sound
        
        // Check for overheat
        if (summonHeat >= 100) {
          summonOverheated = true;
          overheatCooldown = 300; // 5 seconds of overheat penalty - substantial punishment
          overheatStunned = true; // Player can't move during initial stun
          T(200, 0.3, 0.15); // Overheat warning sound
        }
      } else if (summonOverheated) {
        T(120, 0.08, 0.03); // Subtle bonk sound when overheated - lower pitch and volume
      } else if (manaEnergy < 10) {
        // Not enough mana - red flash and subtle sound
        manaFlashTimer = 30; // 0.5 seconds of red flash
        T(100, 0.06, 0.02); // Very subtle "empty" sound
      }
    }
    
    // Deactivate shield when spacebar released (if it was from holding)
    if (shieldActive && holdDuration >= 150) {
      shieldActive = false;
      shieldCooldown = 180; // 3 second cooldown
    }
    return;
  }
};

// Score Text System
function drawScoreTexts() {
  scoreTexts.forEach((text) => {
    let progress = text.life / text.maxLife;
    let alpha, scale;

    if (progress < 0.2) {
      // Fade in and grow phase
      alpha = progress / 0.2;
      scale = 0.5 + (progress / 0.2) * 0.8; // Grow from 50% to 130%
    } else if (progress < 0.8) {
      // Stable phase
      alpha = 1;
      scale = 1.3;
    } else {
      // Fade out phase
      alpha = (1 - progress) / 0.2;
      scale = 1.3;
    }

    x.save();
    x.globalAlpha = alpha;
    x.translate(text.x, text.y);
    x.scale(scale, scale);

    // Draw text with outline for visibility
    x.font = "bold 20px monospace";
    setFill("#000");
    x.fillText(text.text, -1, 1); // Shadow
    x.fillText(text.text, 1, 1);
    x.fillText(text.text, -1, -1);
    x.fillText(text.text, 1, -1);

    setFill(text.color || "#ffff00"); // Use text color or default yellow
    x.fillText(text.text, 0, 0);

    x.restore();
  });
}

// UI System
function drawUI() {
  // Story opening screen
  if (!gameStarted) {
    // Semi-transparent dark overlay
    setFill(BLACK(0.7));
    x.fillRect(0, 0, w, h);
    
    x.textAlign = "center";
    setFill("#ffffff");
    
    // Title
    x.font = "32px serif";
    x.fillText("The Cat & the Luminid", w / 2, h / 2 - 140);
    
    // Story text
    x.font = "16px serif";
    setFill("#cccccc");
    let storyLines = [
      "The Cat feeds on light to keep the endless night alive.",
      "You are the Luminid, guide of fireflies, protector and sacrificer.",
      "Feed the Cat or dawn will come and the magic will end.",
      "How long can you survive the night's growing hunger?"
    ];
    
    storyLines.forEach((line, i) => {
      x.fillText(line, w / 2, h / 2 - 80 + i * 25);
    });
    
    // Instructions
    x.font = "14px serif";
    x.fillStyle = "#999999";
    x.fillText("(Move your mouse to gather fireflies and sacrifice them to The Cat)", w / 2, h / 2 + 40);
    
    // Separator
    x.fillStyle = "#666666";
    x.fillText("⸻", w / 2, h / 2 + 70);
    
    // Simple hint
    x.font = "12px serif";
    x.fillStyle = "#888888";
    x.fillText("Press 'R' for rules once you start playing", w / 2, h / 2 + 90);
    
    // Start prompt - moved lower to avoid overlap
    x.font = "18px serif";
    x.fillStyle = "#ffffff";
    x.fillText("Click or press any key to begin", w / 2, h / 2 + 130);
    
    x.textAlign = "left";
    return;
  }
  
  // Current score display (top right)
  x.font = "18px monospace";
  x.fillStyle = "#ffffff";
  x.textAlign = "right";
  x.fillText(`Score: ${score}`, w - 20, 30);
  
  // Run timer (top right, below score) - moved up to avoid overcrowding
  if (runStartTime) {
    let runTime = F((Date.now() - runStartTime) / 1000);
    let minutes = F(runTime / 60);
    let seconds = runTime % 60;
    x.font = "14px monospace";
    x.fillStyle = "#aaaaaa";
    x.textAlign = "right";
    x.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, w - 20, 55);
  }

  x.textAlign = "left"; // Reset text alignment  // Audio status and rules display
  x.font = "12px monospace";
  let audioText = audioEnabled ? "M: Unmute" : "M: Mute";
  let rulesText = "R: Rules";
  let combinedText = `${audioText} | ${rulesText}`;
  let combinedWidth = x.measureText(combinedText).width;
  x.fillStyle = "rgba(0,0,0,0.5)";
  x.fillRect(20, h - 50, combinedWidth + 10, 30); // Add 10px padding (5px each side)
  x.fillStyle = audioEnabled ? "#44ff44" : "#ff4444";
  x.fillText(audioText, 25, h - 32);
  x.fillStyle = "#aaaaaa";
  x.fillText(" | ", 25 + x.measureText(audioText).width, h - 32);
  x.fillStyle = "#88ccff";
  x.fillText(rulesText, 25 + x.measureText(audioText + " | ").width, h - 32);

  // Game over screen
  if (gameOver) {
    x.fillStyle = "rgba(0,0,0,0.8)";
    x.fillRect(0, 0, w, h);

    x.fillStyle = "#ffffff";
    x.font = "36px monospace";
    x.textAlign = "center";
    x.fillText("DAWN BREAKS", w / 2, h / 2 - 100);

    x.font = "18px serif";
    x.fillStyle = "#cccccc";
    x.fillText("The night you protected has ended", w / 2, h / 2 - 70);

    x.font = "24px monospace";
    x.fillStyle = "#ffffff";
    x.fillText(`Final Score: ${score}`, w / 2, h / 2 - 40);
    
    x.font = "16px monospace";
    x.fillStyle = "#aaaaaa";
    x.fillText(`Fireflies Sacrificed: ${totalCollected}`, w / 2, h / 2 - 10);
    x.fillText(`Fireflies Lost to Dawn: ${totalLost}`, w / 2, h / 2 + 10);
    
    if (runStartTime) {
      let runTime = F((Date.now() - runStartTime) / 1000);
      let minutes = F(runTime / 60);
      let seconds = runTime % 60;
      x.fillText(`Night Survived: ${minutes}:${seconds.toString().padStart(2, '0')}`, w / 2, h / 2 + 30);
    }

    x.font = "14px serif";
    x.fillStyle = "#888888";
    x.fillText("The Cat waits for another night...", w / 2, h / 2 + 55);

    x.fillStyle = "#ffffff";
    x.font = "16px monospace";
    x.fillText("Click to begin a new night", w / 2, h / 2 + 80);

    x.textAlign = "left";
  }
}

// Help System - Elegant implementation with glowing effects
function drawHelp() {
  if (!showHelp) return;
  
  // Dark overlay
  x.fillStyle = "rgba(0,0,0,0.9)";
  x.fillRect(0, 0, w, h);
  
  // Centered content with glow effect
  x.textAlign = "center";
  
  // Title with glow
  x.font = "bold 36px serif";
  x.shadowBlur = 20;
  x.shadowColor = "rgba(100, 200, 200, 0.8)";
  x.fillStyle = "rgba(150, 220, 220, 1.0)";
  x.fillText("The Cat & the Luminid", w / 2, h / 2 - 180);
  x.shadowBlur = 0;
  
  // CONTROLS section
  x.font = "bold 20px serif";
  x.shadowBlur = 10;
  x.shadowColor = "rgba(100, 200, 200, 0.6)";
  x.fillStyle = "rgba(120, 200, 200, 1.0)";
  x.fillText("CONTROLS", w / 2, h / 2 - 120);
  x.shadowBlur = 0;
  
  x.font = "18px serif";
  x.fillStyle = "#ffffff";
  x.fillText("Move mouse to gather fireflies", w / 2, h / 2 - 95);
  x.fillText("Quick tap: summon fireflies (causes heat)", w / 2, h / 2 - 75);
  x.fillText("Hold down: shield during eye flashes", w / 2, h / 2 - 55);
  
  // GAMEPLAY section  
  x.font = "bold 20px serif";
  x.shadowBlur = 10;
  x.shadowColor = "rgba(100, 200, 200, 0.6)";
  x.fillStyle = "rgba(120, 200, 200, 1.0)";
  x.fillText("GAMEPLAY", w / 2, h / 2 - 10);
  x.shadowBlur = 0;
  
  x.font = "18px serif";
  x.fillStyle = "#ffffff";
  x.fillText("Bring fireflies to cat's nose to sacrifice", w / 2, h / 2 + 15);
  x.fillText("Normal fireflies restore +10 mana", w / 2, h / 2 + 35);
  x.fillText("Golden fireflies restore FULL mana!", w / 2, h / 2 + 55);
  x.fillText("Perfect shield timing = 100% protection", w / 2, h / 2 + 75);
  
  // TIPS section
  x.font = "bold 20px serif";
  x.shadowBlur = 10;
  x.shadowColor = "rgba(100, 200, 200, 0.6)";
  x.fillStyle = "rgba(120, 200, 200, 1.0)";
  x.fillText("TIPS", w / 2, h / 2 + 115);
  x.shadowBlur = 0;
  
  x.font = "18px serif";
  x.fillStyle = "#ffffff";
  x.fillText("Mana drains over time - stay active!", w / 2, h / 2 + 140);
  x.fillText("Moving prevents firefly loss", w / 2, h / 2 + 160);
  
  // Close instruction - bottom center for better UI flow
  x.font = "16px serif";
  x.fillStyle = "rgba(150, 150, 150, 0.9)";
  x.fillText("Press R or ESC to close", w / 2, h / 2 + 195);
}

// Tutorial guidance system
function drawTutorialGuidance() {
  if (tutorialComplete) return;
  
  x.textAlign = 'center';
  
  // Show initial guidance
  if (tutorialStep === 0 && otherFireflies.length > 0) {
    x.font = '18px Georgia, serif';
    x.fillStyle = 'rgba(255, 255, 255, 0.9)';
    x.fillText('Click to summon fireflies!', w / 2, h - 80);
    
    x.font = '14px Georgia, serif';
    x.fillStyle = 'rgba(200, 200, 200, 0.8)';
    x.fillText('Move near them to collect', w / 2, h - 60);
    x.fillText('Summoning costs mana (blue bar)', w / 2, h - 40);
  }
  
  // Show shield tutorial when they have fireflies
  if (tutorialStep >= 1 && !firstDeliveryMade) {
    let capturedFireflies = otherFireflies.filter(f => f.captured);
    if (capturedFireflies.length > 0) {
      x.font = '16px Georgia, serif';
      x.fillStyle = 'rgba(255, 255, 100, 0.9)';
      x.fillText('Hold SPACE for shield protection!', w / 2, h - 100);
      
      x.font = '14px Georgia, serif';
      x.fillStyle = 'rgba(200, 200, 200, 0.8)';
      x.fillText('Shield protects from dawn (when cat eyes change)', w / 2, h - 80);
      x.fillText('Shield also costs mana', w / 2, h - 60);
    }
  }
  
  // Show delivery tutorial after first delivery
  if (firstDeliveryMade && !tutorialComplete && score < 30) {
    x.font = '16px Georgia, serif';
    x.fillStyle = 'rgba(100, 255, 100, 0.9)';
    x.fillText('Delivering fireflies restores mana!', w / 2, h - 80);
    
    x.font = '14px Georgia, serif';
    x.fillStyle = 'rgba(200, 200, 200, 0.8)';
    x.fillText('Balance summoning, shielding, and delivering', w / 2, h - 60);
  }
}

// Main Game Loop
function L() {
  let now = Date.now(); // Cache Date.now() at start of frame
  
  drawBackground();
  drawCatEyes(now);
  drawGrass();

  // Always process some basic game updates even when help is shown
  floatTimer += 0.1;

  // Draw help overlay if enabled
  if (showHelp) {
    drawHelp();
    // Still need to continue the main loop for the frame to complete
    // Just draw UI and finish
    drawUI();
    requestAnimationFrame(L);
    return;
  }

  // Main game logic only runs when help is not shown
  // Handle mouse movement detection with extended grace period for trackpad users
  // Disable movement buffer when shield is active (simpler approach)
  let shouldDisableMovement = shieldActive;
  
  if (mouseMoving && !shouldDisableMovement && now - lastMovementTime > movementBuffer) { // Reduced to 300ms for quicker response
    mouseMoving = false;
    charging = false; // Stop charging when movement buffer expires
    glowPower = 0; // Immediate dispersion after buffer
  }
  
  // If shield is active or holding, keep charging active
  if (shouldDisableMovement) {
    charging = true;
    mouseMoving = false; // Don't let movement buffer interfere
  }

  // Handle mouse out of bounds - drift toward center
  if (!mouseInBounds) {
    let centerX = w / 2;
    let centerY = h / 2;
    mx += (centerX - mx) * 0.02; // Gentle drift toward center
    my += (centerY - my) * 0.02;
  }

  let isIdle = mx === lastMx && my === lastMy;
  let fx = mx + (isIdle ? sin(floatTimer) * 0.8 : 0);
  let fy = my + (isIdle ? cos(floatTimer * 1.2) * 0.5 : 0);
  lastMx = mx;
  lastMy = my;

  // Update timer logic removed - no more time limit

  updateCatEyes(now);
  updateParticles(fx, fy);
  updateFireflies(fx, fy);
  updateOrbitingFireflies();

  // Update score texts
  scoreTexts = scoreTexts.filter((text) => {
    text.life++;
    text.y -= 0.5; // Float upward
    return text.life < text.maxLife;
  });

  // Activate shield if holding mouse or space for 150ms+
  if (held150(now) && 
      manaEnergy > 0 && !shieldActive && shieldCooldown === 0 && !summonOverheated) {
    shieldActive = true;
    lastShieldTime = now;
    T(600, 0.1, 0.1); // Shield activation sound
    
    // Tutorial progression - advance when they use shield
    if (!tutorialComplete && tutorialStep === 0) {
      tutorialStep = 1;
    }
  } else if (held150(now) && 
             manaEnergy <= 0 && !shieldActive && shieldCooldown === 0 && !summonOverheated) {
    // Trying to shield with no mana - red flash and subtle sound
    manaFlashTimer = 30; // 0.5 seconds of red flash
    T(100, 0.06, 0.02); // Very subtle "empty" sound
  }
  
  // Drain mana while shield is active - gets more expensive over time
  if (shieldActive) {
    let drainRate = 1 + getDifficulty(); // Drain faster as score increases
    manaEnergy = Math.max(0, manaEnergy - drainRate);
    if (manaEnergy === 0) {
      shieldActive = false;
      shieldCooldown = 180 + getDifficulty() * 3.6; // Longer cooldown as score increases
    }
  }
  
  // Update shield cooldown
  if (shieldCooldown > 0) {
    shieldCooldown--;
  }
  
  // NO automatic mana regeneration - mana only comes from sacrificing fireflies!
  // This makes resource management much more strategic
  
  // Passive mana drain - slowly depletes to encourage active play
  if (manaEnergy > 0 && !shieldActive) {
    // Very slow drain: about 1 mana every 4 seconds (0.25 per second at 60fps)
    // Gets slightly faster as score increases to add progressive pressure
    let passiveDrain = 0.004 + (score * 0.00001); // Base 0.004, increases very slowly with score
    manaEnergy = Math.max(0, manaEnergy - passiveDrain);
  }

  // Update heat system
  if (summonOverheated) {
    overheatCooldown--;
    if (overheatCooldown <= 0) {
      summonOverheated = false;
      overheatStunned = false;
      summonHeat = 40; // Start cooling down from 40% when overheat ends (lower than before)
    }
    // During first 60 frames (1 second), player is stunned and can't move
    if (overheatCooldown > 240) {
      overheatStunned = true;
    } else {
      overheatStunned = false;
    }
  } else {
    // Cool down heat gradually when not overheated
    if (summonHeat > 0) {
      summonHeat = Math.max(0, summonHeat - 0.6); // Slightly slower cooling for more strategic play
    }
  }

  // Update player glow
  if (charging && glowPower < 120) glowPower += 1.5;
  else if (!charging && glowPower > 0) glowPower -= glowPower > 100 ? 0.3 : 1;
  if (quickFlashPower > 0) quickFlashPower -= 4;
  
  // Update mana flash timer
  if (manaFlashTimer > 0) manaFlashTimer--;
  
  // DEBUG: Log array sizes to detect memory leaks
  // Update summoning visual effects
  updateClickEffects();

  maxed = glowPower > 100;
  if (maxed) {
    flashTimer += 0.3;
    if (sin(flashTimer) < -0.7) glowPower = 0;
  }


  drawParticles();
  drawFireflies(now);
  drawPlayerFirefly(fx, fy, now);
  drawDeliveryZone(now); // Show delivery requirements
  drawClickEffects(); // Draw simple click sparkles and shield meter
  drawScoreTexts();
  drawUI();
  drawTutorialGuidance(); // Show tutorial hints for new players

  // Screen flash effect synced with cat eye warning flashes
  if (gameStarted && !gameOver && colorChangesEnabled) {
    let timeUntilChange = nextColorChangeTime - catEyeChangeTimer;
    let isWarning = timeUntilChange <= 180; // 3 seconds total warning (60 frames per flash)
    
    if (isWarning && otherFireflies.some(f => f.captured)) {
      // Mario Kart style: 3 distinct flashes with perfect timing opportunity
      let flashNumber = F((180 - timeUntilChange) / 60); // 0, 1, or 2 (for flashes 1, 2, 3)
      let flashProgress = ((180 - timeUntilChange) % 60) / 60; // 0 to 1 within each flash
      
      // Each flash lasts exactly 1 second (60 frames)
      let flashAlpha = 0;
      
      if (flashNumber < 3) { // Only flash 3 times
        // Softer red color and gentle pulse pattern
        let pulseIntensity = sin(flashProgress * Math.PI); // Smooth 0-1-0 curve for each flash
        
        // Progressive urgency: flash 1 = gentle, flash 2 = medium, flash 3 = urgent
        let baseIntensity = [0.08, 0.12, 0.18][flashNumber]; // Softer than before
        flashAlpha = baseIntensity * pulseIntensity;
        
        // Softer red color (was 255,50,50 - now 200,80,80 for less harsh feel)
        x.fillStyle = `rgba(200, 80, 80, ${flashAlpha})`;
        x.fillRect(0, 0, w, h);
        
        // Perfect timing window: activate shield during flash 2 for optimal protection
        // This gives players clear visual feedback about the timing sweet spot
      }
    }
  }

  // Periodic cleanup to prevent memory leaks - run every 5 seconds
  if (now % 5000 < 50) {
    // Only clean up arrays that actually need it, not fireflies!
    // The firefly disappearing bug was caused by removing captured fireflies here
    
    // Limit array sizes as a backup
    if (particles.length > 100) particles = particles.slice(-50);
    if (clickSparkles.length > 50) clickSparkles = clickSparkles.slice(-25);
    if (scoreTexts.length > 20) scoreTexts = scoreTexts.slice(-10);
  }

  requestAnimationFrame(L);
}

// Initialize
window.onresize = R;
R();
startTime = Date.now(); // Initialize game start time
runStartTime = Date.now(); // Initialize run start time for statistics
// Spawn initial fireflies (tutorial-aware)
let initialFireflies = tutorialComplete ? 20 : 8;
for (let i = 0; i < initialFireflies; i++) spawnFirefly();

L();
