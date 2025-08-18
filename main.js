// js13k-2025 Firefly Cat Game - Optimized

// Lightweight audio system
let a, // AudioContext
e = 0; // audioEnabled (0=false, 1=true)

// Initialize audio only when needed
let I = () => {
  if (!a) {
    try {
      a = new AudioContext();
      e = 1;
      if (a.state === 'suspended') {
        a.resume().catch(err => console.warn('AudioContext resume failed:', err));
      }
    } catch (err) {
      console.warn('AudioContext creation failed:', err);
      return false;
    }
  }
  return true;
};

// Simple tone generator - optimized with lazy initialization
let T = (f, d = .2, v = .1, t = 'sine') => {
  if (!audioEnabled || !I()) return; // Only initialize when actually playing
  let o = a.createOscillator(),
      g = a.createGain();
  o.frequency.value = f;
  o.type = t;
  g.gain.value = v;
  g.gain.exponentialRampToValueAtTime(.01, a.currentTime + d);
  o.connect(g);
  g.connect(a.destination);
  o.start();
  o.stop(a.currentTime + d);
};

// Game sounds - ultra compact
let playFireflyPickup = () => T(800, .2, .1);
let playDeliveryPurr = () => T(200, .5, .15);
let playColorChange = () => T(1000, .1, .08);
let playSummonChime = () => T(600, .15, .1);
let playPenalty = () => T(150, .3, .1);

// Legacy compatibility
let initAudio = I;
let audioCtx = null;
let audioInitialized = false;
let playColorWarning = playColorChange;
let playTone = T;
let playBackgroundNote = () => {};
let startBackgroundMusic = () => {};
let stopBackgroundMusic = () => {};
let musicTimer = 0;
let musicInterval = 0;
let musicEnabled = false;

const c = document.getElementById("c"),
  x = c.getContext("2d"),
  TAU = Math.PI * 2,
  M = Math, // Math shortcut
  r = M.random, // Math.random shortcut
  F = M.floor; // Math.floor shortcut

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
  score = 0,
  catEyes = [],
  horizonBlades = [], // Pre-generated horizon grass blade data
  mouseInBounds = true,
  scoreTexts = [],
  audioEnabled = true, // Lightweight audio system enabled
  gamePaused = false,
  windowFocused = true,
  gameOver = false,
  gameStarted = false, // New state for story screen
  catEyeColor = "gold",
  catEyeChangeTimer = 0,
  nextColorChangeTime = 360 + F(r() * 240), // Random 6-10 seconds initially
  stars = [],
  grassBlades = [],
  parallaxGrass = [],
  startTime = null,
  lastWarningState = false,
  totalCollected = 0,  // Total fireflies collected across all runs
  totalLost = 0,       // Total fireflies lost across all runs
  runStartTime = null; // Start time of current run

function R() {
  w = innerWidth;
  h = innerHeight;
  c.width = w;
  c.height = h;
  initBackground();
}

function initBackground() {
  catEyes = [
    {
      x: w / 2,
      y: h * 0.1,
      blinkTimer: 0,
      isBlinking: false,
      blinkDuration: 0,
    },
  ];

  // Generate background stars
  stars = [];
  for (let i = 0; i < 100; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h * 0.3, // Stars only in upper portion
      size: Math.random() * 1.5 + 0.5,
      twinkle: Math.random() * TAU,
      twinkleSpeed: 0.02 + Math.random() * 0.03,
    });
  }

  // Generate grass blades
  grassBlades = [];
  for (let i = 0; i < 80; i++) {
    grassBlades.push({
      x: Math.random() * w,
      y: h - 10 - Math.random() * 40, // Start from ground level, vary height
      height: 20 + Math.random() * 60,
      width: 3 + Math.random() * 4,
      sway: Math.random() * TAU,
      swaySpeed: 0.01 + Math.random() * 0.02,
      bend: 0.1 + Math.random() * 0.3, // How much the blade curves
    });
  }

  // Generate parallax grass throughout the play area
  parallaxGrass = [];
  for (let i = 0; i < 120; i++) { // Much more grass - tripled from 40 to 120
    let layer = Math.random() < 0.5 ? "back" : "front"; // Behind or in front of fireflies
    parallaxGrass.push({
      x: Math.random() * w,
      y: h * 0.4 + Math.random() * (h * 0.5), // Throughout grass area
      height: 20 + Math.random() * 90, // More variation in heights
      width: 2 + Math.random() * 5, // Base width for tapering
      layer: layer,
      depth: Math.random(), // For parallax effect
      sway: Math.random() * TAU,
      swaySpeed: 0.005 + Math.random() * 0.01, // Slower than horizon grass
      alpha: layer === "back" ? 0.15 + Math.random() * 0.25 : 0.3 + Math.random() * 0.4,
    });
  }

  // Initialize horizon grass blades with static properties
  horizonBlades = [];
  let bladeLayers = [
    { count: 25, spacing: 1/24, heightBase: 40, heightVar: 30, widthBase: 6, widthVar: 4 },
    { count: 40, spacing: 1/39, heightBase: 25, heightVar: 20, widthBase: 4, widthVar: 3 },
    { count: 60, spacing: 1/59, heightBase: 15, heightVar: 15, widthBase: 3, widthVar: 2 }
  ];
  
  bladeLayers.forEach((layer, layerIndex) => {
    for (let i = 0; i < layer.count; i++) {
      let pos = i * layer.spacing;
      horizonBlades.push({
        x: w * pos,
        xOffset: (Math.random() - 0.5) * 20, // Static random offset
        pos: pos,
        width: layer.widthBase + (i % 4) * layer.widthVar,
        height: layer.heightBase + (i % 6) * layer.heightVar,
        swayPhase: i * 0.3 + layerIndex, // Static phase offset
        layerIndex: layerIndex
      });
    }
  });
}

function drawBackground() {
  // Sky gradient - darker at top, lighter at horizon
  let horizonY = h * 0.3;
  
  // Upper sky (behind cat) - dark starry night
  let gradient = x.createLinearGradient(0, 0, 0, horizonY);
  gradient.addColorStop(0, "#050510"); // Very dark at top
  gradient.addColorStop(1, "#101020"); // Slightly lighter at horizon
  x.fillStyle = gradient;
  x.fillRect(0, 0, w, horizonY);
  
  // Draw twinkling stars
  stars.forEach(star => {
    star.twinkle += star.twinkleSpeed;
    let twinkleIntensity = Math.sin(star.twinkle) * 0.5 + 0.5;
    let alpha = 0.3 + twinkleIntensity * 0.7;
    
    x.fillStyle = `rgba(255,255,255,${alpha})`;
    x.beginPath();
    x.arc(star.x, star.y, star.size, 0, TAU);
    x.fill();
    
    // Add subtle glow to brighter stars
    if (twinkleIntensity > 0.7) {
      x.shadowBlur = 3;
      x.shadowColor = "rgba(255,255,255,0.5)";
      x.beginPath();
      x.arc(star.x, star.y, star.size * 0.5, 0, TAU);
      x.fill();
      x.shadowBlur = 0;
    }
  });
  
  // Fill the bottom area with dark night color to match the theme
  x.fillStyle = "#0c0c10"; // Dark blue-gray to match night sky
  x.fillRect(0, h * 0.3, w, h - h * 0.3);
}

function drawHorizonGrass() {
  // Horizon line with gentle hills - using pre-generated blade data
  let baseHorizonY = h * 0.3;
  let time = Date.now() * 0.001;
  
  horizonBlades.forEach((blade) => {
    let bladeX = blade.x + blade.xOffset; // Use pre-generated static offset
    
    // Add gentle hills to horizon - sine wave variation
    let hillOffset = Math.sin(blade.pos * Math.PI * 2.5) * 15 + Math.sin(blade.pos * Math.PI * 5) * 8;
    let horizonY = baseHorizonY + hillOffset;
    
    let sway = Math.sin(time + blade.swayPhase) * 3; // Use pre-generated phase
    
    // Extend blades down below horizon to fill gaps - taller blades go deeper
    let baseY = horizonY + Math.max(20, blade.height * 0.3); // Extend down based on blade height
    
    // Use dark variations of black/gray with slightly different opacity per layer
    let baseAlpha = 0.4 + blade.layerIndex * 0.1; // Front layers more opaque
    let gradient = x.createLinearGradient(bladeX, baseY, bladeX + sway, horizonY - blade.height);
    gradient.addColorStop(0, `rgba(8, 8, 12, ${baseAlpha})`); // Very dark blue-gray base
    gradient.addColorStop(0.7, `rgba(12, 12, 16, ${baseAlpha * 0.7})`); // Slightly lighter
    gradient.addColorStop(1, `rgba(16, 16, 20, ${baseAlpha * 0.4})`); // Lighter tip, more transparent
    
    x.fillStyle = gradient;
    
    // Draw more organic, curved blade shape that extends below horizon
    x.beginPath();
    x.moveTo(bladeX - blade.width/2, baseY); // Start below horizon
    
    let midX = bladeX + sway * 0.5;
    let midY = horizonY - blade.height * 0.6;
    let tipX = bladeX + sway;
    let tipY = horizonY - blade.height;
    
    x.quadraticCurveTo(midX - blade.width/4, midY, tipX, tipY);
    x.quadraticCurveTo(midX + blade.width/4, midY, bladeX + blade.width/2, baseY);
    x.closePath();
    x.fill();
  });
}

function drawGrass() {
  // Ground line only - no animated grass blades
  x.strokeStyle = "#0c0c10"; // Match dark night background
  x.lineWidth = 3;
  x.beginPath();
  x.moveTo(0, h - 10);
  x.lineTo(w, h - 10);
  x.stroke();
}

function drawParallaxGrass(layer) {
  // Draw parallax grass blades for specified layer (back or front)
  parallaxGrass.forEach(blade => {
    if (blade.layer !== layer) return;
    
    blade.sway += blade.swaySpeed;
    let swayOffset = Math.sin(blade.sway) * 3 * (1 - blade.depth);
    
    // More visible but still subtle - dark gray/black variations
    let baseAlpha = layer === "back" ? 0.15 + blade.depth * 0.2 : 0.25 + blade.depth * 0.3;
    x.globalAlpha = baseAlpha;
    
    // Dark gray/black variations instead of green - fits the night theme better
    let baseGray = 6 + blade.depth * 8; // Dark gray base
    let r = Math.floor(baseGray + 2); // Slightly warmer
    let g = Math.floor(baseGray + 2); // Slightly warmer  
    let b = Math.floor(baseGray + 4); // Slightly more blue for night feel
    
    // Create subtle gradient for each blade
    let gradient = x.createLinearGradient(blade.x, blade.y, blade.x + swayOffset, blade.y - blade.height);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.8)`); // Darker base
    gradient.addColorStop(0.7, `rgba(${r + 4}, ${g + 4}, ${b + 6}, 0.6)`); // Slightly lighter middle  
    gradient.addColorStop(1, `rgba(${r + 8}, ${g + 8}, ${b + 12}, 0.3)`); // Lighter, more transparent tip
    
    x.fillStyle = gradient;
    
    // Draw more organic grass blade with slight curve
    let baseWidth = blade.width * (0.4 + blade.depth * 1.2); // Slightly thicker for visibility
    let baseX = blade.x;
    let baseY = blade.y;
    let tipX = blade.x + swayOffset;
    let tipY = blade.y - blade.height;
    
    x.beginPath();
    x.moveTo(baseX - baseWidth/2, baseY);
    
    let midX = baseX + swayOffset * 0.5;
    let midY = baseY - blade.height * 0.6;
    x.quadraticCurveTo(midX - baseWidth/4, midY, tipX, tipY);
    x.quadraticCurveTo(midX + baseWidth/4, midY, baseX + baseWidth/2, baseY);
    x.closePath();
    x.fill();
  });
  
  x.globalAlpha = 1; // Reset alpha
}

// Cat Eyes System
function updateCatEyes() {
  // Handle color changing timer for visual variety
  catEyeChangeTimer++;
  
  // Check for warning state and play warning sound when it starts
  let timeUntilChange = nextColorChangeTime - catEyeChangeTimer;
  let isWarning = timeUntilChange <= 60;
  
  if (isWarning && !lastWarningState && otherFireflies.some(f => f.captured)) {
    // Warning just started and player has fireflies - play warning sound
    if (audioEnabled) playColorWarning();
  }
  lastWarningState = isWarning;
  
  if (catEyeChangeTimer >= nextColorChangeTime) {
    // Penalize captured fireflies when color changes
    let capturedFireflies = otherFireflies.filter(f => f.captured);
    if (capturedFireflies.length > 0) {
      score -= capturedFireflies.length; // -1 point per captured firefly
      
      // Show penalty text
      scoreTexts.push({
        text: `-${capturedFireflies.length}`,
        x: mx, // Show penalty at player position, not cat
        y: my - 50, // Above the player firefly
        life: 0,
        maxLife: 120,
        color: "#ff0000", // Red for penalty
      });
      
      // Force release all captured fireflies and stop charging
      charging = false; // Force player to drop fireflies
      glowPower = 0; // Reset glow power
      totalLost += capturedFireflies.length; // Track total lost
      capturedFireflies.forEach(f => {
        f.captured = false;
        // Disperse them randomly
        let targetX = Math.random() * w;
        let targetY = h * 0.3 + Math.random() * (h * 0.5);
        let dx = targetX - f.x;
        let dy = targetY - f.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        let speed = 3 + Math.random() * 2;
        f.vx = (dx / distance) * speed;
        f.vy = (dy / distance) * speed;
        f.x += f.vx;
        f.y += f.vy;
        f.vx *= 0.98;
        f.vy *= 0.98;
      });
      
      if (audioEnabled) playPenalty(capturedFireflies.length); // Penalty sound
    }
    
    // Change to a new random color for visual interest (no green)
    let colors = ["blue", "purple", "gold"];
    let newColor;
    do {
      newColor = colors[Math.floor(Math.random() * colors.length)];
    } while (newColor === catEyeColor); // Ensure it's different from current
    
    catEyeColor = newColor;
    catEyeChangeTimer = 0;
    lastWarningState = false; // Reset warning state for next cycle
    
    // Random timing with a reasonable cap - never too fast, but unpredictable
    let gameTime = Date.now() - (startTime || Date.now());
    let minTime = 240; // Minimum 4 seconds (capped so it never gets too fast)
    let maxTime = 600; // Maximum 10 seconds
    
    // Gradually reduce the maximum time but never below the minimum
    let difficultyFactor = Math.min(0.7, gameTime / 120000); // Over 2 minutes
    let adjustedMaxTime = Math.floor(maxTime - (maxTime - minTime - 60) * difficultyFactor);
    
    // Random time between min and adjusted max
    nextColorChangeTime = minTime + Math.floor(Math.random() * (adjustedMaxTime - minTime));
    
    // REMOVED - was driving user mad
    // if (audioEnabled) playColorChange(); // Color change sound
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

function drawCatEyes() {
  if (catEyes.length > 0) {
    let eye = catEyes[0];
    let eyeX = eye.x;
    let eyeY = eye.y;

    // Check if we're in the warning period (last 1 second = 60 frames)
    let timeUntilChange = nextColorChangeTime - catEyeChangeTimer;
    let isWarning = timeUntilChange <= 60;
    let flashIntensity = 1;
    
    if (isWarning) {
      // More subtle flash effect - reduced intensity range
      let flashSpeed = Math.max(0.3, timeUntilChange / 60); // Faster as time runs out
      flashIntensity = 0.7 + 0.3 * (Math.sin(catEyeChangeTimer * (1 / flashSpeed)) * 0.5 + 0.5);
    }

    // Get color based on current cat eye color
    let eyeColor, shadowColor;
    switch (catEyeColor) {
      case "gold":
        eyeColor = "#ffdd00";
        shadowColor = "#ffdd00ff";
        break;
      case "purple":
        eyeColor = "#8844ff";
        shadowColor = "#8844ffff";
        break;
      case "blue":
        eyeColor = "#4488ff";
        shadowColor = "#4488ffff";
        break;
      default: // fallback to gold
        eyeColor = "#ffdd00";
        shadowColor = "#ffdd00ff";
    }

    // Mouse tracking for pupils
    let mouseDistX = mx - eyeX;
    let mouseDistY = my - eyeY;
    let maxPupilMove = 12;
    let pupilOffsetX = Math.max(
      -maxPupilMove,
      Math.min(maxPupilMove, mouseDistX * 0.04)
    );
    let pupilOffsetY = Math.max(
      -maxPupilMove,
      Math.min(maxPupilMove, mouseDistY * 0.04)
    );

    if (!eye.isBlinking) {
      // Apply flash intensity to the glow
      x.shadowColor = shadowColor;
      x.shadowBlur = 50 * flashIntensity;

      // Left eye - tilted oval
      x.save();
      x.translate(eyeX - 100, eyeY);
      x.rotate(0.3);
      x.fillStyle = eyeColor + Math.floor(215 * flashIntensity).toString(16).padStart(2, '0');
      x.beginPath();
      x.ellipse(0, 0, 70, 30, 0, 0, TAU);
      x.fill();
      x.restore();

      // Right eye - tilted oval
      x.save();
      x.translate(eyeX + 100, eyeY);
      x.rotate(-0.3);
      x.fillStyle = eyeColor + Math.floor(215 * flashIntensity).toString(16).padStart(2, '0');
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
    // Cat nose - triangle with point at bottom, positioned lower, slightly larger
    let capturedCount = otherFireflies.filter(f => f.captured).length;
    let noseAlpha = 0.4;
    let noseGlow = 0;
    
    // Make nose twinkle when player has captured fireflies
    if (capturedCount > 0) {
      let twinkleSpeed = 0.01 + (capturedCount * 0.002); // Faster with more fireflies
      let twinkle = Math.sin(Date.now() * twinkleSpeed) * 0.5 + 0.5;
      noseAlpha = 0.4 + (twinkle * 0.6); // Varies from 0.4 to 1.0
      noseGlow = twinkle * 15; // Glow effect
    }
    
    x.strokeStyle = `rgba(255, 255, 255, ${noseAlpha})`;
    x.lineWidth = 1.5;
    x.globalAlpha = noseAlpha;
    
    // Add glow effect when twinkling
    if (noseGlow > 0) {
      x.shadowBlur = noseGlow;
      x.shadowColor = "rgba(255, 255, 255, 0.8)";
    }
    
    x.beginPath();
    x.moveTo(eyeX - 8, eyeY + 40); // Top left (larger - was 6, now 8)
    x.lineTo(eyeX + 8, eyeY + 40); // Top right  
    x.lineTo(eyeX, eyeY + 52); // Bottom point (larger - was 50, now 52)
    x.closePath();
    x.stroke();
    
    // Reset shadow
    x.shadowBlur = 0;

    // Cat whiskers - longer, with natural spread pattern and gentle breathing twinkle
    // Create gentle breathing effect for whiskers
    let whiskerBreathing = Math.sin(Date.now() * 0.002) * 0.5 + 0.5; // Slow, breathing-like
    let whiskerAlpha = 0.3 + (whiskerBreathing * 0.4); // Varies from 0.3 to 0.7
    let whiskerGlow = whiskerBreathing * 8; // Subtle glow
    
    x.strokeStyle = `rgba(255, 255, 255, ${whiskerAlpha})`;
    x.lineWidth = 1;
    
    // Add gentle glow to whiskers
    if (whiskerGlow > 0) {
      x.shadowBlur = whiskerGlow;
      x.shadowColor = "rgba(255, 255, 255, 0.3)";
    }
    
    // Left whiskers - 3 total, spreading out from nose area
    let leftWhiskers = [
      { length: 110, startY: eyeY + 45, spread: -25 },  // Top whisker - spreads up
      { length: 120, startY: eyeY + 55, spread: 0 },    // Middle whisker (longest) - straight
      { length: 110, startY: eyeY + 65, spread: 25 }    // Bottom whisker - spreads down
    ];
    
    leftWhiskers.forEach((whisker, i) => {
      // Start closer to nose, end further spread
      let startX = eyeX - 130; // Closer to nose
      let endX = eyeX - 130 - whisker.length; // Longer reach
      let endY = whisker.startY + whisker.spread; // Natural spread pattern
      
      // Main whisker line
      x.globalAlpha = whiskerAlpha; // Use breathing alpha instead of fixed 0.4
      x.beginPath();
      x.moveTo(startX, whisker.startY);
      x.lineTo(endX, endY);
      x.stroke();
      
      // Only 1-2 stars per whisker, using sky star style
      let starCount = i === 1 ? 2 : 1; // Middle whisker gets 2 stars, others get 1
      for (let s = 0; s < starCount; s++) {
        let starPos = starCount === 2 ? (s + 1) / 3 : 0.6; // Position along whisker
        let starX = startX - (whisker.length * starPos);
        let starY = whisker.startY + (whisker.spread * starPos);
        
        // Use same twinkling logic as sky stars
        let twinkle = Math.sin(Date.now() * 0.001 + s * 2 + i * 3) * 0.5 + 0.5;
        let alpha = 0.3 + twinkle * 0.7; // Same as sky stars
        
        x.fillStyle = `rgba(255,255,255,${alpha})`;
        x.globalAlpha = 1;
        x.beginPath();
        x.arc(starX, starY, 1.5, 0, Math.PI * 2); // Same size as sky stars
        x.fill();
        
        // Add subtle glow to brighter stars (same as sky stars)
        if (twinkle > 0.7) {
          x.shadowBlur = 3;
          x.shadowColor = "rgba(255,255,255,0.5)";
          x.beginPath();
          x.arc(starX, starY, 0.75, 0, Math.PI * 2);
          x.fill();
          x.shadowBlur = 0;
        }
      }
    });
    
    // Right whiskers - 3 total, spreading out from nose area
    let rightWhiskers = [
      { length: 110, startY: eyeY + 45, spread: -25 },  // Top whisker - spreads up
      { length: 120, startY: eyeY + 55, spread: 0 },    // Middle whisker (longest) - straight
      { length: 110, startY: eyeY + 65, spread: 25 }    // Bottom whisker - spreads down
    ];
    
    rightWhiskers.forEach((whisker, i) => {
      // Start closer to nose, end further spread
      let startX = eyeX + 130; // Closer to nose
      let endX = eyeX + 130 + whisker.length; // Longer reach
      let endY = whisker.startY + whisker.spread; // Natural spread pattern
      
      // Main whisker line
      x.globalAlpha = whiskerAlpha; // Use breathing alpha instead of fixed 0.4
      x.beginPath();
      x.moveTo(startX, whisker.startY);
      x.lineTo(endX, endY);
      x.stroke();
      
      // Only 1-2 stars per whisker, using sky star style
      let starCount = i === 1 ? 2 : 1; // Middle whisker gets 2 stars, others get 1
      for (let s = 0; s < starCount; s++) {
        let starPos = starCount === 2 ? (s + 1) / 3 : 0.6; // Position along whisker
        let starX = startX + (whisker.length * starPos);
        let starY = whisker.startY + (whisker.spread * starPos);
        
        // Use same twinkling logic as sky stars
        let twinkle = Math.sin(Date.now() * 0.001 + s * 2.5 + i * 3.5 + 10) * 0.5 + 0.5;
        let alpha = 0.3 + twinkle * 0.7; // Same as sky stars
        
        x.fillStyle = `rgba(255,255,255,${alpha})`;
        x.globalAlpha = 1;
        x.beginPath();
        x.arc(starX, starY, 1.5, 0, Math.PI * 2); // Same size as sky stars
        x.fill();
        
        // Add subtle glow to brighter stars (same as sky stars)
        if (twinkle > 0.7) {
          x.shadowBlur = 3;
          x.shadowColor = "rgba(255,255,255,0.5)";
          x.beginPath();
          x.arc(starX, starY, 0.75, 0, Math.PI * 2);
          x.fill();
          x.shadowBlur = 0;
        }
      }
    });

    // Reset shadow effects and alpha
    x.shadowBlur = 0;
    x.globalAlpha = 1; // Reset alpha
  }
}

// Firefly System
function spawnFirefly(summoned = false) {
  let x = Math.random() * w;
  let y = h * 0.3 + Math.random() * (h * 0.5);

  // All fireflies are green
  let type = "green";
  let value = 1; // All fireflies worth 1 point

  let newFirefly = {
    x: x,
    y: y,
    type: type,
    value: value,
    floatTimer: Math.random() * TAU,
    flashTimer: Math.random() * TAU,
    glowPhase: Math.random() * TAU,
    captured: false,
    fadeIn: summoned ? 0 : 1,
    vx: 0,
    vy: 0,
    captureOffset: { x: 0, y: 0 },
  };

  otherFireflies.push(newFirefly);
}

function updateFireflies(fx, fy) {
  otherFireflies.forEach((f) => {
    if (f.captured) {
      // Captured fireflies drift towards player with floating motion
      if (charging) {
        let targetX = fx + f.captureOffset.x;
        let targetY = fy + f.captureOffset.y;

        // Gentle drift towards target position with floating
        f.floatTimer += 0.15;
        let floatX = Math.sin(f.floatTimer) * 8;
        let floatY = Math.cos(f.floatTimer * 1.4) * 6;

        f.x += (targetX + floatX - f.x) * 0.1;
        f.y += (targetY + floatY - f.y) * 0.1;
      } else {
        // Space released - disperse to random gameplay areas
        f.captured = false;
        
        // Choose random target position within gameplay area
        let targetX = Math.random() * w;
        let targetY = h * 0.3 + Math.random() * (h * 0.5); // Stay in main gameplay zone
        
        // Calculate direction and distance to target
        let dx = targetX - f.x;
        let dy = targetY - f.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        
        // Normalize and apply reasonable speed
        let speed = 3 + Math.random() * 2; // Moderate dispersal speed
        f.vx = (dx / distance) * speed;
        f.vy = (dy / distance) * speed;
        
        // Apply velocity immediately for dispersal
        f.x += f.vx;
        f.y += f.vy;
        f.vx *= 0.98; // Start deceleration
        f.vy *= 0.98;
        
        if (audioEnabled) playTone(350, 0.15, 0.06);
      }
    } else {
      // Handle fade-in for summoned fireflies
      if (f.fadeIn < 1) {
        f.fadeIn += 0.03;
        f.fadeIn = Math.min(1, f.fadeIn);
      }

      // Normal floating behavior - increased movement for better visibility
      f.floatTimer += 0.08 + Math.random() * 0.04;
      f.x += Math.sin(f.floatTimer) * 0.8; // Increased from 0.3 to 0.8
      f.y += Math.cos(f.floatTimer * 1.3) * 0.5; // Increased from 0.2 to 0.5
      f.flashTimer += 0.05 + Math.random() * 0.03;
      f.glowPhase += 0.1;

      // Apply velocity from previous dispersing (if any)
      if (Math.abs(f.vx) > 0.01 || Math.abs(f.vy) > 0.01) {
        f.x += f.vx;
        f.y += f.vy;
        f.vx *= 0.98; // Slower deceleration for longer distance travel
        f.vy *= 0.98;
      }

      if (charging || glowPower > 20) {
        let dx = fx - f.x,
          dy = fy - f.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 200) {
          let force = ((charging ? 0.03 : 0.01) * (200 - dist)) / 200;
          f.vx += (dx / dist) * force;
          f.vy += (dy / dist) * force;
        }

        // Capture firefly when close and charging
        if (charging && dist < 25) {
          f.captured = true;
          f.captureOffset.x = f.x - fx + (Math.random() - 0.5) * 20;
          f.captureOffset.y = f.y - fy + (Math.random() - 0.5) * 20;
          if (audioEnabled) playFireflyPickup();

          // Capture particles
          for (let i = 0; i < 5; i++) {
            let a = Math.random() * TAU;
            particles.push({
              x: f.x,
              y: f.y,
              vx: Math.cos(a) * 1,
              vy: Math.sin(a) * 1,
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

function checkDeliveryZone(fx, fy) {
  // Define delivery zone between cat eyes
  let deliveryX = w / 2; // Center between eyes
  let deliveryY = h * 0.25; // Cat nose/mouth area
  let deliveryRadius = 60; // Generous delivery area
  
  // Check if player is in delivery zone with captured fireflies
  let dx = fx - deliveryX;
  let dy = fy - deliveryY;
  let dist = Math.sqrt(dx * dx + dy * dy);
  
  let capturedFireflies = otherFireflies.filter(f => f.captured);
  
  if (dist < deliveryRadius && capturedFireflies.length > 0 && charging) {
    // Successful delivery - award points
    score += capturedFireflies.length;
    totalCollected += capturedFireflies.length; // Track total collected
    
    // Show success text
    scoreTexts.push({
      text: `+${capturedFireflies.length}`,
      x: deliveryX,
      y: deliveryY - 30,
      life: 0,
      maxLife: 90,
      color: "#00ff00", // Green for success
    });
    
    // Create flutter-away effect - fireflies transform to cat's color and float away
    capturedFireflies.forEach((f, i) => {
      for (let j = 0; j < 8; j++) { // More particles per firefly for magical effect
        particles.push({
          x: deliveryX + (r() - 0.5) * 40,
          y: deliveryY + (r() - 0.5) * 20,
          vx: (r() - 0.5) * 4,
          vy: -1 - r() * 2, // Float upward
          size: 2 + r() * 3,
          life: 0,
          maxLife: 60 + r() * 40,
          color: catEyeColor, // Transform to cat's current color
          alpha: 0.8,
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
    
    if (audioEnabled) playDeliveryPurr(capturedFireflies.length); // Success sound
  }
}

function drawFireflies() {
  otherFireflies.forEach((f) => {
    // Handle fade in for summoned fireflies
    let alpha = f.fadeIn || 1;
    if (alpha <= 0) return;

    x.globalAlpha = alpha;
    x.fillStyle = "#333";
    x.beginPath();
    x.arc(f.x, f.y, 3.5, 0, TAU); // Larger firefly body
    x.fill();

    let g1 = Math.sin(f.flashTimer) * 0.5 + 0.5;
    let g2 = Math.sin(f.glowPhase * 0.7) * 0.3 + 0.7;
    let glow = g1 * g2;

    // Captured fireflies glow brighter and more consistently
    if (f.captured) {
      // Check if color change is imminent for erratic flashing
      let timeUntilChange = nextColorChangeTime - catEyeChangeTimer;
      let isWarning = timeUntilChange <= 60;
      
      if (isWarning && timeUntilChange <= 30) {
        // Very erratic flashing in final 30 frames (0.5 seconds)
        glow = 0.3 + Math.abs(Math.sin(f.flashTimer * 8) * Math.cos(f.flashTimer * 5)) * 0.7;
      } else if (isWarning) {
        // Moderate erratic flashing in warning period
        glow = 0.5 + Math.sin(f.flashTimer * 4) * Math.cos(f.flashTimer * 3) * 0.5;
      } else {
        // Normal captured glow
        glow = 0.8 + Math.sin(f.flashTimer * 2) * 0.2;
      }
    }

    // Allow fireflies to dim properly - removed artificial minimum

    if (glow > 0.3) {
      let size = 3 + glow * 4; // Larger glow size
      let blur = 12 + glow * 20; // More blur for better visibility
      let color;

      if (f.captured) {
        // Captured fireflies take on the player's current color
        switch (catEyeColor) {
          case "gold":
            color = `rgb(255,${180 + glow * 75},0)`; // Gold
            break;
          case "purple":
            color = `rgb(${180 + glow * 75},80,255)`; // Purple
            break;
          case "blue":
            color = `rgb(80,${130 + glow * 125},255)`; // Blue
            break;
          default:
            color = `rgb(${100 + glow * 100},255,${80 + glow * 100})`; // Fallback green
        }
      } else {
        // All fireflies are green when not captured
        color = `rgb(${100 + glow * 100},255,${80 + glow * 100})`; // Brighter green
      }

      x.shadowBlur = blur;
      x.shadowColor = color;
      x.fillStyle = color;
      x.beginPath();
      x.arc(f.x, f.y, size, 0, TAU);
      x.fill();
      x.shadowBlur = 0;
    }

    x.globalAlpha = 1; // Reset alpha
  });
} // Particle System
function updateParticles(fx, fy) {
  if (Math.random() < 0.08) {
    particles.push({
      x: fx + (Math.random() - 0.5) * 8,
      y: fy + (Math.random() - 0.5) * 8,
      t: 0,
      isBurst: false,
    });
  }

  if (charging && Math.random() < 0.4) {
    let a = Math.random() * TAU;
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
}

function drawParticles() {
  particles.forEach((p) => {
    let alpha = Math.sin(p.t * 3) * 0.4 + 0.3;
    if (alpha > 0) {
      x.fillStyle = `rgba(150,255,150,${alpha})`;
      x.beginPath();
      x.arc(p.x, p.y, 0.8, 0, TAU);
      x.fill();
    }
  });
}

function drawPlayerFirefly(fx, fy) {
  // Get color based on current cat eye color to help player
  let firefly_color, shadowColor, baseR, baseG, baseB;
  switch (catEyeColor) {
    case "gold":
      firefly_color = "#ffdd00";
      shadowColor = "#ffdd00";
      baseR = 255; baseG = 221; baseB = 0;
      break;
    case "purple":
      firefly_color = "#8844ff";
      shadowColor = "#8844ff";
      baseR = 136; baseG = 68; baseB = 255;
      break;
    case "blue":
      firefly_color = "#4488ff";
      shadowColor = "#4488ff";
      baseR = 68; baseG = 136; baseB = 255;
      break;
    default: // fallback to gold
      firefly_color = "#ffdd00";
      shadowColor = "#ffdd00";
      baseR = 255; baseG = 221; baseB = 0;
  }

  // Check if we're in the warning period and apply erratic flash effect
  let timeUntilChange = nextColorChangeTime - catEyeChangeTimer;
  let isWarning = timeUntilChange <= 60;
  let flashIntensity = 1;
  
  if (isWarning && timeUntilChange <= 30) {
    // Very erratic flashing in final 30 frames - player needs urgent warning!
    flashIntensity = 0.4 + Math.abs(Math.sin(floatTimer * 12) * Math.cos(floatTimer * 8)) * 0.6;
  } else if (isWarning) {
    // Moderate erratic flashing in warning period
    let flashSpeed = Math.max(0.3, timeUntilChange / 60);
    flashIntensity = 0.3 + 0.7 * (Math.sin(catEyeChangeTimer * (1 / flashSpeed)) * 0.5 + 0.5);
  }

  // Apply flash intensity to the base firefly
  x.fillStyle = firefly_color;
  x.globalAlpha = flashIntensity;
  x.beginPath();
  x.arc(fx, fy, 3, 0, TAU);
  x.fill();
  x.globalAlpha = 1; // Reset alpha

  let totalGlow = Math.max(glowPower, quickFlashPower);
  let baseGlow = 20;
  let enhancedGlow = charging ? 40 : 0;
  totalGlow = Math.max(totalGlow, baseGlow + enhancedGlow);

  if (totalGlow > 0) {
    let i = Math.min(totalGlow / 100, 1);
    let size = 3 + i * 5;
    let blur = 15 + i * 30;
    
    // Use the cat eye color for glow with flash intensity
    let glowR = Math.floor(baseR * 0.6 + baseR * 0.4 * i) * flashIntensity;
    let glowG = Math.floor(baseG * 0.6 + baseG * 0.4 * i) * flashIntensity;
    let glowB = Math.floor(baseB * 0.6 + baseB * 0.4 * i) * flashIntensity;
    let color = `rgb(${glowR},${glowG},${glowB})`;

    x.shadowBlur = blur * flashIntensity;
    x.shadowColor = shadowColor;
    x.fillStyle = color;
    x.globalAlpha = flashIntensity;
    x.beginPath();
    x.arc(fx, fy, size, 0, TAU);
    x.fill();
    x.shadowBlur = 0;
    x.globalAlpha = 1; // Reset alpha
  }
}

// Input Handling
c.onmousemove = (e) => {
  mx = e.clientX;
  my = e.clientY;
  mouseInBounds = true;
};

c.onmouseleave = () => {
  mouseInBounds = false;
};

c.onmouseenter = () => {
  mouseInBounds = true;
};

c.onmousedown = (e) => {
  // Start game from story screen
  if (!gameStarted) {
    gameStarted = true;
    return;
  }
  
  let clickX = e.clientX;
  let clickY = e.clientY;

  // Check for restart click when game over
  if (gameOver) {
    // Reset game state
    gameOver = false;
    gameStarted = false; // Return to story screen
    score = 0; // Reset score for new run
    glowPower = 0;
    charging = false;
    scoreTexts = [];
    otherFireflies = [];
    catEyeColor = "gold";
    catEyeChangeTimer = 0;
    nextColorChangeTime = 360 + Math.floor(Math.random() * 240); // Random 6-10 seconds on restart
    lastWarningState = false; // Reset warning state
    startTime = Date.now(); // Reset start time for difficulty scaling
    runStartTime = Date.now(); // Reset run timer
    for (let i = 0; i < 20; i++) spawnFirefly(); // Increased from 10 to 20
    if (audioEnabled) playTone(600, 0.2, 0.1); // Restart sound
    return;
  }

  // Start charging (same as spacebar down)
  if (!charging) {
    keyDownTime = Date.now();
    charging = true;
    if (audioEnabled) playTone(250, 0.2, 0.05);
  }
};

c.onmouseup = (e) => {
  // Stop charging (same as spacebar up)
  if (charging) {
    charging = false;
    let d = Date.now() - keyDownTime;

    if (d < 150) {
      quickFlashPower = 80;
      if (audioEnabled) {
        playTone(400, 0.3, 0.08);
        playSummonChime(); // Add magical summoning sound
      }

      // Summon fireflies on quick tap
      if (otherFireflies.length < 25) { // Increased from 15 to 25
        let summonCount = Math.min(3, 25 - otherFireflies.length); // Summon more at once
        for (let i = 0; i < summonCount; i++) {
          setTimeout(() => spawnFirefly(true), i * 200);
        }
      }
    } else if (d < 500) {
      quickFlashPower = 40;
      if (audioEnabled) playTone(350, 0.25, 0.06);
    }
  }
};

c.onclick = (e) => {
  // This event fires after mousedown/mouseup, so we don't need additional logic here
  // The charging logic is already handled by mousedown/mouseup
};

document.onkeydown = (e) => {
  // Start game from story screen
  if (!gameStarted) {
    gameStarted = true;
    return;
  }
  
  // Handle mute toggle with M key
  if (e.code === "KeyM") {
    e.preventDefault();
    audioEnabled = !audioEnabled;
    if (audioEnabled) {
      startBackgroundMusic(); // Start background music when audio enabled
      // Soft confirmation chime
      zzfx(...[.2,,600,.01,.2,.3,1,1.2,,,,,,.08]); 
    } else {
      stopBackgroundMusic(); // Stop background music when audio disabled
    }
    return;
  }

  // Test audio with maximum volume (T key)
  if (e.code === "KeyT") {
    e.preventDefault();
    console.log("TESTING AUDIO WITH MAXIMUM VOLUME");
    if (audioEnabled && audioCtx && audioInitialized) {
      // Generate a simple loud beep
      let testData = zzfx(...[,,800,.1,.3,.3,1,0,,,,,,,1]);
      console.log("Test audio data length:", testData.length);
      zzfxP(testData, 2.0); // Double volume
      
      // Also try direct oscillator test
      try {
        let oscillator = audioCtx.createOscillator();
        let gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = 440;
        gainNode.gain.value = 0.3;
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
        console.log("Direct oscillator test played");
      } catch (e) {
        console.error("Direct oscillator test failed:", e);
      }
    } else {
      console.log("Audio not ready:", { audioEnabled, audioCtx: !!audioCtx, audioInitialized });
    }
    return;
  }

  // Simple buffer test (Y key) - bypass zzfx entirely
  if (e.code === "KeyY") {
    e.preventDefault();
    console.log("TESTING SIMPLE BUFFER AUDIO");
    if (audioEnabled && audioCtx && audioInitialized) {
      try {
        // Create a simple sine wave manually
        let sampleRate = 44100;
        let duration = 0.2; // 200ms
        let frequency = 800; // 800Hz
        let samples = Math.floor(sampleRate * duration);
        
        let buffer = audioCtx.createBuffer(1, samples, sampleRate);
        let channelData = buffer.getChannelData(0);
        
        // Generate simple sine wave
        for (let i = 0; i < samples; i++) {
          channelData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
        }
        
        let source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start();
        
        console.log("Simple buffer test played - should hear 800Hz tone");
      } catch (e) {
        console.error("Simple buffer test failed:", e);
      }
    }
    return;
  }

  if (e.code === "Space") {
    e.preventDefault();

    if (!charging) {
      keyDownTime = Date.now();
      charging = true;
      if (audioEnabled) playTone(250, 0.2, 0.05);
    }
  }
};

document.onkeyup = (e) => {
  if (e.code === "Space") {
    // Stop charging (same logic as mouse up)
    if (charging) {
      charging = false;
      let d = Date.now() - keyDownTime;

      if (d < 150) {
        quickFlashPower = 80;
        if (audioEnabled) playTone(400, 0.3, 0.08);

        // Summon fireflies on quick tap
        if (otherFireflies.length < 25) { // Increased from 15 to 25
          let summonCount = Math.min(3, 25 - otherFireflies.length);
          for (let i = 0; i < summonCount; i++) {
            setTimeout(() => spawnFirefly(true), i * 200);
          }
        }
      } else if (d < 500) {
        quickFlashPower = 40;
        if (audioEnabled) playTone(350, 0.25, 0.06);
      }
    }
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
    x.fillStyle = "#000";
    x.fillText(text.text, -1, 1); // Shadow
    x.fillText(text.text, 1, 1);
    x.fillText(text.text, -1, -1);
    x.fillText(text.text, 1, -1);

    x.fillStyle = text.color || "#ffff00"; // Use text color or default yellow
    x.fillText(text.text, 0, 0);

    x.restore();
  });
}

// UI System
function drawUI() {
  // Story opening screen
  if (!gameStarted) {
    // Semi-transparent dark overlay
    x.fillStyle = "rgba(0,0,0,0.7)";
    x.fillRect(0, 0, w, h);
    
    x.textAlign = "center";
    x.fillStyle = "#ffffff";
    
    // Title
    x.font = "32px serif";
    x.fillText("The Cat & the Luminid", w / 2, h / 2 - 140);
    
    // Story text
    x.font = "16px serif";
    x.fillStyle = "#cccccc";
    let storyLines = [
      "On nights that never end, a Cat watches with eyes that shift like turning glass.",
      "A Luminid drifts below, gathering fireflies that gleam in matching colors.",
      "The Cat changes, the fireflies scatter, and the Luminid flickers —",
      "whether in chase or escape, no one can say."
    ];
    
    storyLines.forEach((line, i) => {
      x.fillText(line, w / 2, h / 2 - 80 + i * 25);
    });
    
    // Instructions
    x.font = "14px serif";
    x.fillStyle = "#999999";
    x.fillText("(Move with your mouse. Glow with space or click. Gather, match, deliver… before the Cat's eyes change again.)", w / 2, h / 2 + 40);
    
    // Separator
    x.fillStyle = "#666666";
    x.fillText("⸻", w / 2, h / 2 + 70);
    
    // Start prompt
    x.font = "18px serif";
    x.fillStyle = "#ffffff";
    x.fillText("Click or press any key to begin", w / 2, h / 2 + 100);
    
    x.textAlign = "left";
    return;
  }
  
  // Current score display (top right)
  x.font = "16px monospace";
  x.fillStyle = "#ffffff";
  x.textAlign = "right";
  x.fillText(`Score: ${score}`, w - 20, 30);
  
  // Statistics display (top right, below score)
  x.font = "12px monospace";
  x.fillStyle = "#aaaaaa";
  x.fillText(`Total: ${totalCollected} | Lost: ${totalLost}`, w - 20, 50);
  
  // Run timer (top right, below stats)
  if (runStartTime) {
    let runTime = Math.floor((Date.now() - runStartTime) / 1000);
    let minutes = Math.floor(runTime / 60);
    let seconds = runTime % 60;
    x.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, w - 20, 70);
  }
  
  x.textAlign = "left"; // Reset text alignment
  
  // Audio status display
  x.font = "12px monospace";
  let audioText = audioEnabled ? "M: Unmute" : "M: Mute";
  let audioWidth = x.measureText(audioText).width;
  x.fillStyle = "rgba(0,0,0,0.5)";
  x.fillRect(20, h - 50, audioWidth + 10, 30); // Add 10px padding (5px each side)
  x.fillStyle = audioEnabled ? "#44ff44" : "#ff4444";
  x.fillText(audioText, 25, h - 32);

  // Game over screen
  if (gameOver) {
    x.fillStyle = "rgba(0,0,0,0.8)";
    x.fillRect(0, 0, w, h);

    x.fillStyle = "#ffffff";
    x.font = "36px monospace";
    x.textAlign = "center";
    x.fillText("GAME OVER!", w / 2, h / 2 - 80);

    x.font = "24px monospace";
    x.fillText(`Final Score: ${score}`, w / 2, h / 2 - 40);
    
    x.font = "16px monospace";
    x.fillStyle = "#aaaaaa";
    x.fillText(`Total Collected: ${totalCollected}`, w / 2, h / 2 - 10);
    x.fillText(`Total Lost: ${totalLost}`, w / 2, h / 2 + 10);
    
    if (runStartTime) {
      let runTime = Math.floor((Date.now() - runStartTime) / 1000);
      let minutes = Math.floor(runTime / 60);
      let seconds = runTime % 60;
      x.fillText(`Run Time: ${minutes}:${seconds.toString().padStart(2, '0')}`, w / 2, h / 2 + 30);
    }

    x.fillStyle = "#ffffff";
    x.fillText("Click to restart", w / 2, h / 2 + 60);

    x.textAlign = "left";
  }
}

// Main Game Loop
function L() {
  drawBackground();
  drawCatEyes(); // Draw cat eyes after background but before horizon grass
  drawHorizonGrass(); // Draw tall grass blades in front of cat eyes
  drawGrass();

  if (!gameStarted) {
    // Only draw UI (story screen) when game hasn't started
    drawUI();
    requestAnimationFrame(L);
    return;
  }

  floatTimer += 0.1;

  // Background music timer
  if (musicEnabled) {
    musicTimer++;
    if (musicTimer >= musicInterval) {
      playBackgroundNote();
      musicTimer = 0;
      musicInterval = 300 + Math.random() * 600; // Random 5-15 second intervals
    }
  }

  // Handle mouse out of bounds - drift toward center
  if (!mouseInBounds) {
    let centerX = w / 2;
    let centerY = h / 2;
    mx += (centerX - mx) * 0.02; // Gentle drift toward center
    my += (centerY - my) * 0.02;
  }

  let isIdle = mx === lastMx && my === lastMy;
  let fx = mx + (isIdle ? Math.sin(floatTimer) * 0.8 : 0);
  let fy = my + (isIdle ? Math.cos(floatTimer * 1.2) * 0.5 : 0);
  lastMx = mx;
  lastMy = my;

  // Update timer logic removed - no more time limit

  updateCatEyes();
  updateParticles(fx, fy);
  updateFireflies(fx, fy);

  // Update score texts
  scoreTexts = scoreTexts.filter((text) => {
    text.life++;
    text.y -= 0.5; // Float upward
    return text.life < text.maxLife;
  });

  // Update player glow
  if (charging && glowPower < 120) glowPower += 1.5;
  else if (!charging && glowPower > 0) glowPower -= glowPower > 100 ? 0.3 : 1;
  if (quickFlashPower > 0) quickFlashPower -= 4;

  maxed = glowPower > 100;
  if (maxed) {
    flashTimer += 0.3;
    if (Math.sin(flashTimer) < -0.7) glowPower = 0;
  }


  drawParticles();
  drawParallaxGrass("back"); // Draw background grass behind fireflies
  drawFireflies();
  drawPlayerFirefly(fx, fy);
  drawParallaxGrass("front"); // Draw foreground grass in front of fireflies
  drawScoreTexts();
  drawUI();

  requestAnimationFrame(L);
}

// Window focus/blur handling - stop sounds when in other apps
window.addEventListener('blur', () => {
  windowFocused = false;
});

window.addEventListener('focus', () => {
  windowFocused = true;
});

// Initialize
window.onresize = R;
R();
startTime = Date.now(); // Initialize game start time
runStartTime = Date.now(); // Initialize run start time for statistics
for (let i = 0; i < 20; i++) spawnFirefly(); // Increased from 10 to 20

L();
