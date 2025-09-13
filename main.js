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
  warnFrames: 240,      // 4 seconds warning before eye color change (increased from 3)
  flash1: 80,           // First warning flash timing (proportionally adjusted)
  flash2: 160,          // Second flash timing (proportionally adjusted)
  flash3: 200,          // Third flash timing (proportionally adjusted)
  shieldCooldown: 180,  // 3 seconds between shield uses (reduced from 4)
  maxFireflies: 35,     // Population limit (increased from 25)
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

// Initialize audio context when needed (requires user gesture)
const initAudio = () => {
  if (!a) {
    try {
      a = new AudioContext();
    } catch (err) {
      return false;
    }
  }
  // Resume if suspended (required after user gesture)
  if (a.state === 'suspended') {
    a.resume().catch(() => false);
  }
  return a.state === 'running' || a.state === 'suspended';
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

// Unified shield audio system
let shieldHumOscillator = null;
let shieldHumGain = null;

const playShieldChime = () => {
  if (!audioEnabled || !initAudio()) return;
  
  // Ethereal chime sound - two overlapping tones
  const freq1 = 800;
  const freq2 = 1200;
  
  [freq1, freq2].forEach((freq, i) => {
    const osc = a.createOscillator();
    const gain = a.createGain();
    
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.value = 0.08 * (i === 0 ? 1 : 0.6); // Second tone quieter
    gain.gain.exponentialRampToValueAtTime(0.01, a.currentTime + 0.3);
    
    osc.connect(gain).connect(a.destination);
    osc.start();
    osc.stop(a.currentTime + 0.3);
  });
};

const startShieldHum = () => {
  if (!audioEnabled || !initAudio() || shieldHumOscillator) return;
  
  shieldHumOscillator = a.createOscillator();
  shieldHumGain = a.createGain();
  
  shieldHumOscillator.frequency.value = 80; // Deep space-like hum
  shieldHumOscillator.type = 'sine';
  shieldHumGain.gain.value = 0.03; // Atmospheric volume
  
  shieldHumOscillator.connect(shieldHumGain).connect(a.destination);
  shieldHumOscillator.start();
};

const stopShieldHum = () => {
  if (shieldHumOscillator) {
    shieldHumOscillator.stop();
    shieldHumOscillator = null;
    shieldHumGain = null;
  }
};

// Unified shield audio handler - determines what sound to play
const handleShieldAudio = (isHoldAction = false) => {
  if (isHoldAction) {
    // For holds: just start the deep hum, no chime
    startShieldHum();
  } else {
    // For taps: just play the chime, no hum
    playShieldChime();
  }
};

// ===== BACKGROUND MUSIC SYSTEM =====
// Gentle, relaxing ambient music - soft plucked notes, not sustained organ tones
// Inspired by lo-fi ambient games like Journey, GRIS, Ori
// Features: short gentle notes with natural decay, lots of space between sounds
let bgMusic = null;
let bgGain = null;
let musicPlaying = false;
let audioStarted = false;

// Pentatonic scale in A minor (no harsh intervals, naturally harmonious)
const notes = {
  A3: 220.00, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00,
  A4: 440.00, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99
};

const createBgMusic = () => {
  if (!audioEnabled || !initAudio() || bgMusic) return;
  
  // Master gain control
  bgGain = a.createGain();
  bgGain.gain.value = 0;
  bgGain.connect(a.destination);
  
  let timeouts = [];
  const bpm = 60; // Slow, relaxing tempo
  const beatDuration = 60000 / bpm; // 1000ms per beat
  
  // Simple, gentle melody with lots of space - like wind chimes
  const gentleMelody = [
    // Bar 1: Soft opening
    { note: 'A4', beat: 0 },
    { note: 'C5', beat: 2.5 },
    
    // Bar 2: Higher sparkle (sparse)
    { note: 'E5', beat: 5 },
    { note: 'D5', beat: 7.5 },
    
    // Bar 3: Gentle descent
    { note: 'G4', beat: 10 },
    { note: 'A4', beat: 12 },
    
    // Bar 4: Rest and resolution
    { note: 'C4', beat: 15 }
  ];
  
  // Occasional bass note for grounding (not sustained)
  const gentleBass = [
    { note: 'A3', beat: 0 },
    { note: 'A3', beat: 8 }  // Only twice per 16-beat cycle
  ];
  
  const playGentleNote = (frequency, startBeat, isLowNote = false) => {
    const startTime = startBeat * beatDuration;
    
    const timeout = setTimeout(() => {
      if (!bgMusic) return;
      
      const osc = a.createOscillator();
      const gain = a.createGain();
      const filter = a.createBiquadFilter();
      
      // Soft sine wave (not harsh triangle)
      osc.type = 'sine';
      osc.frequency.value = frequency;
      
      // Very gentle low-pass filter to make it warm and soft
      filter.type = 'lowpass';
      filter.frequency.value = isLowNote ? 400 : 1000; // Even softer filtering
      filter.Q.value = 0.1; // Very gentle slope
      
      // Short, plucked envelope - like a gentle bell that fades quickly
      const now = a.currentTime;
      const volume = isLowNote ? 0.03 : 0.04; // Very quiet
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.02); // Quick, gentle attack
      gain.gain.exponentialRampToValueAtTime(volume * 0.3, now + 0.3); // Quick fade to sustain
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2); // Long, natural release
      
      osc.connect(filter).connect(gain).connect(bgGain);
      osc.start(now);
      osc.stop(now + 2); // Stop after 2 seconds - no endless sustain
      
    }, startTime);
    
    timeouts.push(timeout);
  };
  
  const playGentlePattern = () => {
    // Clear previous timeouts to prevent buildup
    timeouts.forEach(clearTimeout);
    timeouts = [];
    
    // Play sparse bass notes (grounding)
    gentleBass.forEach(({ note, beat }) => {
      playGentleNote(notes[note], beat, true);
    });
    
    // Play main melody (very spaced out)
    gentleMelody.forEach(({ note, beat }) => {
      playGentleNote(notes[note], beat, false);
    });
    
    // Schedule next loop (16 beats, but with gap for silence)
    const loopTimeout = setTimeout(() => {
      if (bgMusic && musicPlaying) playGentlePattern();
    }, (16 + 4) * beatDuration); // 4 extra beats of silence between loops
    
    timeouts.push(loopTimeout);
  };
  
  bgMusic = {
    cleanup: () => {
      timeouts.forEach(clearTimeout);
      timeouts = [];
    },
    playGentlePattern
  };
  
  musicPlaying = false;
};

// Smooth volume transitions
const fadeBgMusic = (targetVol, duration = 1) => {
  if (!bgGain) return;
  bgGain.gain.cancelScheduledValues(a.currentTime);
  bgGain.gain.exponentialRampToValueAtTime(Math.max(0.001, targetVol), a.currentTime + duration);
};

// Test audio with a simple beep
const testAudio = () => {
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.frequency.value = 440;
  osc.type = 'sine';
  gain.gain.value = 0.3;
  gain.gain.exponentialRampToValueAtTime(0.01, a.currentTime + 0.5);
  osc.connect(gain).connect(a.destination);
  osc.start();
  osc.stop(a.currentTime + 0.5);
};

// Initialize audio on first user interaction
const startAudioOnUserGesture = () => {
  console.log('🎵 startAudioOnUserGesture called - audioStarted:', audioStarted, 'audioEnabled:', audioEnabled);
  if (!audioStarted && audioEnabled) {
    console.log('🎵 Attempting to init audio...');
    if (initAudio() && a.state !== 'suspended') {
      console.log('🎵 Audio initialized successfully, state:', a.state);
      audioStarted = true;
      
      // Test audio first
      testAudio();
      
      // Start background music after successful audio init
      setTimeout(() => {
        console.log('🎵 Delayed music start - audioEnabled:', audioEnabled, 'pageVisible:', pageVisible, 'gameStarted:', gameStarted);
        if (audioEnabled && pageVisible && gameStarted) startBgMusic();
      }, 600); // Wait for test beep to finish
    } else {
      console.log('🎵 Audio init failed or suspended, state:', a ? a.state : 'no context');
    }
  }
  
  // For debugging: always try to start music if audio is ready but music isn't playing
  if (audioStarted && audioEnabled && (!bgMusic || !musicPlaying)) {
    console.log('🎵 Attempting to start music directly...');
    startBgMusic();
  }
};

// Start/resume music with gentle fade-in
const startBgMusic = () => {
  if (!audioEnabled || !audioStarted) return;
  if (!bgMusic) createBgMusic();
  if (bgMusic && !musicPlaying) {
    fadeBgMusic(0.15, 3); // Very gentle fade-in over 3 seconds
    musicPlaying = true;
    // Start the gentle pattern
    setTimeout(() => {
      if (bgMusic && musicPlaying) bgMusic.playGentlePattern();
    }, 1000); // Longer delay for gentle introduction
  }
};

// Pause for tab switches - keeps oscillators alive for instant resume
const pauseBgMusic = () => {
  if (bgMusic && musicPlaying) {
    fadeBgMusic(0.001, 0.5); // Near-silent but not stopped
    musicPlaying = false;
  }
};

// Full cleanup - use when audio disabled or game ends
const stopBgMusic = () => {
  if (bgMusic) {
    if (bgMusic.cleanup) bgMusic.cleanup(); // Clear all timeouts
    bgMusic = null;
    musicPlaying = false;
  }
};

// Public API functions for background music
const playBackground = () => {
  if (!audioStarted && audioEnabled) {
    if (initAudio() && a.state !== 'suspended') {
      audioStarted = true;
    }
  }
  startBgMusic();
};

const stopBackground = () => {
  stopBgMusic();
};

// Ominous game over sound - dark and atmospheric like Inscryption
const playGameOverMelody = () => {
  if (!audioEnabled || !initAudio()) return;
  
  // Dark, unsettling chord progression - minor seconds and tritones
  // Like the darkness closing in when your light fails
  const ominousSounds = [
    // Low rumbling bass - the void approaching
    { freq: 55, time: 0, duration: 3.0, volume: 0.08, type: 'sawtooth' },
    
    // Dissonant high whistle - unsettling
    { freq: 1760, time: 0.3, duration: 0.8, volume: 0.03, type: 'sine' },
    
    // Minor second interval - very tense
    { freq: 220, time: 0.8, duration: 1.5, volume: 0.06, type: 'triangle' },
    { freq: 233, time: 0.9, duration: 1.4, volume: 0.05, type: 'triangle' },
    
    // Descending chromatic notes - darkness falling
    { freq: 392, time: 1.5, duration: 0.7, volume: 0.04, type: 'sine' },
    { freq: 370, time: 2.0, duration: 0.8, volume: 0.04, type: 'sine' },
    { freq: 349, time: 2.5, duration: 1.0, volume: 0.03, type: 'sine' }
  ];
  
  ominousSounds.forEach(({ freq, time, duration, volume, type }) => {
    setTimeout(() => {
      if (!audioEnabled) return;
      
      const osc = a.createOscillator();
      const gain = a.createGain();
      const filter = a.createBiquadFilter();
      
      osc.type = type;
      osc.frequency.value = freq;
      
      // Different filtering for different frequency ranges
      filter.type = 'lowpass';
      if (freq < 100) {
        // Bass rumble - very low pass
        filter.frequency.value = 150;
        filter.Q.value = 2;
      } else if (freq > 1000) {
        // High whistle - band pass for eeriness
        filter.type = 'bandpass';
        filter.frequency.value = freq;
        filter.Q.value = 5;
      } else {
        // Mid range - slight low pass for darkness
        filter.frequency.value = 400;
        filter.Q.value = 0.8;
      }
      
      // Atmospheric envelope - slow rise, haunting sustain
      const now = a.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.3); // Slow, ominous rise
      gain.gain.setValueAtTime(volume, now + duration * 0.7); // Hold the tension
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration); // Fade into darkness
      
      osc.connect(filter).connect(gain).connect(a.destination);
      osc.start(now);
      osc.stop(now + duration);
      
    }, time * 1000);
  });
};

// Dawn breaking victory sound - light, hopeful, triumphant
const playDawnBreaksVictory = () => {
  if (!audioEnabled || !initAudio()) return;
  
  // Multi-layered dawn breaking sound - like sunrise over darkness
  const dawnSounds = [
    // Warm bass foundation - the earth awakening
    { freq: 110, time: 0, duration: 4.0, volume: 0.06, type: 'sine' },
    { freq: 165, time: 0.2, duration: 3.8, volume: 0.04, type: 'sine' },
    
    // Rising major triad - hope emerging
    { freq: 264, time: 0.5, duration: 1.2, volume: 0.08, type: 'triangle' }, // C4
    { freq: 330, time: 0.8, duration: 1.2, volume: 0.07, type: 'triangle' }, // E4  
    { freq: 396, time: 1.1, duration: 1.2, volume: 0.06, type: 'triangle' }, // G4
    
    // Ascending melody - light breaking through
    { freq: 523, time: 1.5, duration: 0.8, volume: 0.09, type: 'sine' }, // C5
    { freq: 659, time: 2.0, duration: 0.8, volume: 0.08, type: 'sine' }, // E5
    { freq: 784, time: 2.5, duration: 1.0, volume: 0.07, type: 'sine' }, // G5
    { freq: 1047, time: 3.0, duration: 1.5, volume: 0.06, type: 'sine' }, // C6 - triumph!
    
    // Gentle high sparkles - first rays of sunlight
    { freq: 1319, time: 3.2, duration: 0.6, volume: 0.03, type: 'sine' },
    { freq: 1568, time: 3.5, duration: 0.6, volume: 0.02, type: 'sine' },
    { freq: 2093, time: 3.8, duration: 0.8, volume: 0.02, type: 'sine' }
  ];
  
  dawnSounds.forEach(({ freq, time, duration, volume, type }) => {
    setTimeout(() => {
      if (!audioEnabled) return;
      
      const osc = a.createOscillator();
      const gain = a.createGain();
      const filter = a.createBiquadFilter();
      
      osc.type = type;
      osc.frequency.value = freq;
      
      // Warm, golden filtering like sunlight
      filter.type = 'lowpass';
      if (freq < 200) {
        // Warm bass - let the fundamental through
        filter.frequency.value = 300;
        filter.Q.value = 0.3;
      } else if (freq > 1000) {
        // High sparkles - gentle brightness, not harsh
        filter.frequency.value = freq * 0.8;
        filter.Q.value = 0.5;
      } else {
        // Mid range - warm and full
        filter.frequency.value = 1200;
        filter.Q.value = 0.4;
      }
      
      // Gentle, hopeful envelope - like dawn slowly breaking
      const now = a.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.2); // Gradual, hopeful rise
      gain.gain.setValueAtTime(volume, now + duration * 0.6); // Sustain the joy
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration); // Gentle fade to peace
      
      osc.connect(filter).connect(gain).connect(a.destination);
      osc.start(now);
      osc.stop(now + duration);
      
    }, time * 1000);
  });
};

// ===== GAME STATE VARIABLES =====

// Canvas and rendering
let c, x, w, h;

// Responsive design
let isScreenTooSmall = false;
const MIN_WIDTH = 900;  
const MIN_HEIGHT = 600; 

// Mobile/touch device detection
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
};

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
let lastOverheatAttempt = 0; // Track when player tried to use abilities while overheated

// Shield system
let shieldActive = false, shieldCooldown = 0, lastShieldTime = 0;

// Input state tracking
let spacePressed = false;
let spaceActivationTime = 0;
let shieldActivationTime = 0; // Track which activation we're dealing with
let hasPlayedChime = false;
const HOLD_THRESHOLD = 150; // ms - anything longer is considered a "hold"

// Game state
let score = 0, gameStarted = true, gameOver = false;
let gameOverTime = null; // Stores the time when game ended for frozen display
let totalCollected = 0, totalLost = 0;
let deliveryStreak = 0, bestStreak = 0; // New streak tracking
let startTime = null, runStartTime = null;
let audioEnabled = true, pageVisible = true;
let lastSpawnTime = 0; // For progressive difficulty spawning

// Night survival system
const NIGHT_DURATION = 600000; // 10 minutes = 600,000 milliseconds
let gameWon = false;

// Cat system
let catEyeColor = "gold", catEyeChangeTimer = 0, nextColorChangeTime = 600;
let lastWarningState = false, colorChangesEnabled = true;
let mouseNearCat = false, catProximity = 0;

// Tutorial system
let tutorialComplete = localStorage.getItem('tutorialComplete') === 'true';
let tutorialStep = 0, firstDeliveryMade = false, tutorialTimer = 0;
let tutorialStep1Timer = 0; // Track time spent on step 1 (summoning phase)
let tutorialStep3Timer = 0; // Track time spent on step 3
let tutorialStep4Timer = 0; // Track time spent on step 4
let tutorialMissedShield = false; // Track if player missed a shield during tutorial
let showHelp = false;
let helpScrollOffset = 0; // For scrolling help content
let showTutorialElements = false; // Show ring and count during tutorial only
let helpOpenTime = 0; // When help menu was opened
let totalHelpPauseTime = 0; // Total time spent with help menu open

// Game objects
let particles = [];
let otherFireflies = [];
let scoreTexts = [];
let clickSparkles = [];
let stars = [];
let catEyes = [];

// Summoning feedback
let summonFeedback = { active: false, text: "", life: 0, maxLife: 180, summonCount: 0 };
let lastSummonTime = 0;

// ===== STAR BACKGROUND SYSTEM =====

// Initialize star field
const initStars = () => {
  stars = [];
  
  // Regular stars (fewer, smaller)
  for (let i = 0; i < 100; i++) {
    const starType = r(); // Random number to determine star behavior
    let twinkleSpeed, baseAlpha;
    
    if (starType < 0.3) {
      // 30% - Static bright stars (no twinkling)
      twinkleSpeed = 0;
      baseAlpha = r() * 0.4 + 0.6; // Bright and steady
    } else if (starType < 0.6) {
      // 30% - Slow fade in/out stars
      twinkleSpeed = r() * 0.005 + 0.002; // Very slow
      baseAlpha = r() * 0.6 + 0.3;
    } else {
      // 40% - Normal twinkling stars
      twinkleSpeed = r() * 0.01 + 0.005; // Slower than before
      baseAlpha = r() * 0.5 + 0.3;
    }
    
    stars.push({
      x: r() * w,
      y: r() * h,
      size: r() * 1.2 + 0.3, // Smaller than before (was 2 + 0.5)
      alpha: baseAlpha,
      twinkleSpeed: twinkleSpeed,
      twinkleOffset: r() * TAU,
      type: 'regular'
    });
  }
  
  // Add tiny dust particles
  for (let i = 0; i < 200; i++) {
    stars.push({
      x: r() * w,
      y: r() * h,
      size: r() * 0.3 + 0.1, // Very small
      alpha: r() * 0.3 + 0.1, // Dim
      twinkleSpeed: r() * 0.003 + 0.001, // Very slow twinkle
      twinkleOffset: r() * TAU,
      type: 'dust'
    });
  }
  
  // Create milky way band - diagonal across sky
  const milkyWayStars = 80;
  const centerX = w * 0.7; // Off-center
  const centerY = h * 0.3; 
  const bandWidth = w * 0.6;
  const bandHeight = h * 0.4;
  
  for (let i = 0; i < milkyWayStars; i++) {
    // Create elliptical distribution for milky way
    const angle = r() * TAU;
    const radiusX = (r() * 0.8 + 0.2) * bandWidth / 2;
    const radiusY = (r() * 0.6 + 0.2) * bandHeight / 2;
    
    const starX = centerX + cos(angle) * radiusX;
    const starY = centerY + sin(angle) * radiusY;
    
    // Only add if within screen bounds
    if (starX >= 0 && starX <= w && starY >= 0 && starY <= h) {
      stars.push({
        x: starX,
        y: starY,
        size: r() * 0.4 + 0.1, // Tiny milky way dust
        alpha: r() * 0.4 + 0.1, // Dim
        twinkleSpeed: r() * 0.002 + 0.0005, // Very subtle movement
        twinkleOffset: r() * TAU,
        type: 'milkyway'
      });
    }
  }
};

// Render animated star background
const drawStars = (now) => {
  setFill("#0a0a1a"); // Deep night background
  x.fillRect(0, 0, w, h);
  
  stars.forEach(star => {
    let alpha;
    
    if (star.twinkleSpeed === 0) {
      // Static stars - no animation
      alpha = star.alpha;
    } else {
      // Animated stars - gentle twinkling or slow fading
      const twinkle = sin(now * star.twinkleSpeed + star.twinkleOffset) * 0.4 + 0.6;
      alpha = star.alpha * twinkle;
    }
    
    setFill(`rgba(255, 255, 255, ${alpha})`);
    x.beginPath();
    x.arc(star.x, star.y, star.size, 0, TAU);
    x.fill();
  });
};

// ===== FOREST & VINE BACKGROUND SYSTEM =====

// Vine silhouette system with parallax layers
let vineShapes = [];

// Initialize Tim Burton-style twisted vine system
const initVines = () => {
  vineShapes = [];
  
  // Left corner twisted vine - growing from bottom left
  vineShapes.push({
    type: 'leftCorner',
    depth: 1.0,
    segments: createTwistedVinePath('left')
  });
  
  // Right corner twisted vine - growing from bottom right
  vineShapes.push({
    type: 'rightCorner',
    depth: 1.0,
    segments: createTwistedVinePath('right')
  });
  
  // Bottom center vine - growing upward
  vineShapes.push({
    type: 'bottomCenter',
    depth: 0.8,
    segments: createTwistedVinePath('bottom')
  });
  
  // Background parallax vines - smaller and lighter
  vineShapes.push({
    type: 'leftBackground',
    depth: 0.6,
    segments: createTwistedVinePath('leftSmall')
  });
  
  vineShapes.push({
    type: 'rightBackground',
    depth: 0.6,
    segments: createTwistedVinePath('rightSmall')
  });
  
  vineShapes.push({
    type: 'bottomBackground1',
    depth: 0.5,
    segments: createTwistedVinePath('bottomSmall1')
  });
  
  vineShapes.push({
    type: 'bottomBackground2',
    depth: 0.5,
    segments: createTwistedVinePath('bottomSmall2')
  });
};

// Create curved vine paths with Burton-style twists and thorns
const createTwistedVinePath = (direction) => {
  const segments = [];
  const segmentCount = 25;
  
  for (let i = 0; i < segmentCount; i++) {
    const t = i / (segmentCount - 1);
    
    let x, y, thickness, thorns = [];
    
    if (direction === 'left') {
      // Left vine: starts at bottom-left, curves up and inward with spirals - WIDER
      const baseX = t * w * 0.2;
      const baseY = h * 0.95 - (t * h * 0.5);
      
      const spiral = sin(t * Math.PI * 4) * (w * 0.08) * (1 - t * 0.5);
      const coil = cos(t * Math.PI * 6) * (w * 0.04) * (1 - t * 0.7);
      
      x = w * 0.02 + baseX + spiral;
      y = baseY + coil;
      thickness = (1 - t * 0.8) * 10;
      
      // Add thorns every few segments
      if (i % 2 === 0) {
        thorns = [
          { angle: t * 3 + 1, length: 8 + t * 6 },
          { angle: t * 3 + 4, length: 6 + t * 4 }
        ];
      }
      
    } else if (direction === 'right') {
      // Right vine: mirror of left vine - WIDER
      const baseX = t * w * 0.2;
      const baseY = h * 0.95 - (t * h * 0.5);
      
      const spiral = sin(t * Math.PI * 4) * (w * 0.08) * (1 - t * 0.5);
      const coil = cos(t * Math.PI * 6) * (w * 0.04) * (1 - t * 0.7);
      
      x = w * 0.98 - baseX - spiral;
      y = baseY + coil;
      thickness = (1 - t * 0.8) * 10;
      
      // Add thorns every few segments
      if (i % 2 === 0) {
        thorns = [
          { angle: t * 3 + 2, length: 8 + t * 6 },
          { angle: t * 3 + 5, length: 6 + t * 4 }
        ];
      }
      
    } else if (direction === 'leftSmall') {
      // Smaller background left vine for parallax
      const baseX = t * w * 0.12;
      const baseY = h * 0.9 - (t * h * 0.3);
      
      const spiral = sin(t * Math.PI * 3) * (w * 0.04) * (1 - t * 0.6);
      const coil = cos(t * Math.PI * 4) * (w * 0.02) * (1 - t * 0.8);
      
      x = w * 0.1 + baseX + spiral;
      y = baseY + coil;
      thickness = (1 - t * 0.9) * 6;
      
      // Fewer, smaller thorns
      if (i % 3 === 0) {
        thorns = [{ angle: t * 2 + 1, length: 4 + t * 3 }];
      }
      
    } else if (direction === 'rightSmall') {
      // Smaller background right vine for parallax
      const baseX = t * w * 0.12;
      const baseY = h * 0.9 - (t * h * 0.3);
      
      const spiral = sin(t * Math.PI * 3) * (w * 0.04) * (1 - t * 0.6);
      const coil = cos(t * Math.PI * 4) * (w * 0.02) * (1 - t * 0.8);
      
      x = w * 0.9 - baseX - spiral;
      y = baseY + coil;
      thickness = (1 - t * 0.9) * 6;
      
      // Fewer, smaller thorns
      if (i % 3 === 0) {
        thorns = [{ angle: t * 2 + 2, length: 4 + t * 3 }];
      }
      
    } else if (direction === 'bottomSmall1' || direction === 'bottomSmall2') {
      // Small background briar patches
      const isSecond = direction === 'bottomSmall2';
      const centerX = isSecond ? w * 0.75 : w * 0.25;
      const spread = (t - 0.5) * w * 0.15;
      const baseY = t * h * 0.08;
      
      const wave1 = sin(t * Math.PI * 6) * (h * 0.02);
      const wave2 = cos(t * Math.PI * 2) * (h * 0.015);
      
      x = centerX + spread;
      y = h - baseY + wave1 + wave2;
      thickness = (1 - t * 0.8) * 4;
      
      // Small briar thorns
      if (i % 2 === 0) {
        thorns = [{ angle: t * 4, length: 3 + t * 2 }];
      }
      
    } else { // bottom - main briar
      // Bottom briar: spreads horizontally along bottom like thorny undergrowth
      const spread = (t - 0.5) * w * 0.6;
      const baseY = t * h * 0.15;
      
      const wave1 = sin(t * Math.PI * 8) * (h * 0.03);
      const wave2 = cos(t * Math.PI * 3) * (h * 0.02);
      const thornyness = sin(t * Math.PI * 12) * (h * 0.01);
      
      x = w * 0.5 + spread;
      y = h - baseY + wave1 + wave2 + thornyness;
      thickness = (1 - t * 0.7) * 8;
      
      // Dense thorns for main briar
      if (i % 2 === 0) {
        thorns = [
          { angle: t * 4 + 1.5, length: 6 + t * 4 },
          { angle: t * 4 + 4.5, length: 5 + t * 3 }
        ];
      }
    }
    
    segments.push({ x, y, thickness, thorns });
  }
  
  return segments;
};

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
  
  // Distant mountain silhouettes with horizon glow matching cat eyes
  // First draw the glow behind the mountains
  x.save();
  const catColors = getCatEyeColors();
  x.shadowColor = catColors.rgba(0.3); // More subtle cat eye color glow
  x.shadowBlur = 40; // Larger, softer glow
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
  x.restore();
  
  // Then draw the mountains again without glow for clean edges
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
  
  // Draw background vines (furthest parallax layer)
  drawVineSilhouettes('background');
};

// Draw elegant vine silhouettes with Burton-style curves
const drawVineSilhouettes = (layer, now = performance.now()) => {
  if (!vineShapes.length) return;
  
  const vinesToDraw = vineShapes.filter(vine => 
    layer === 'all' || 
    (layer === 'background' && vine.depth < 0.9) ||
    (layer === 'foreground' && vine.depth >= 0.9)
  );
  
  vinesToDraw.forEach((vine, index) => {
    if (!vine.segments || vine.segments.length < 2) return;
    
    // Very subtle breathing animation
    const breathe = sin(now * 0.001 + index * 0.3) * 1.5;
    
    // Color based on depth for parallax effect - darker background vines
    let vineColor;
    if (vine.depth >= 1.0) {
      vineColor = "#000000"; // Pure black for foreground
    } else if (vine.depth >= 0.8) {
      vineColor = "#050505"; // Very dark for mid-ground
    } else if (vine.depth >= 0.6) {
      vineColor = "#0a0a0a"; // Darker for background parallax
    } else {
      vineColor = "#101010"; // Darkest for far background
    }
    
    setFill(vineColor);
    setStroke(vineColor);
    
    vine.segments.forEach((segment, i) => {
      const breatheEffect = breathe * (1 - i / vine.segments.length) * 0.5;
      const x_pos = segment.x + breatheEffect;
      const y_pos = segment.y;
      const radius = Math.max(0.5, segment.thickness);
      
      // Draw overlapping circles to create smooth vine body
      x.beginPath();
      x.arc(x_pos, y_pos, radius, 0, TAU);
      x.fill();
      
      // Connect segments with lines for seamless vine
      if (i > 0) {
        const prevSegment = vine.segments[i - 1];
        const prevBreath = breathe * (1 - (i - 1) / vine.segments.length) * 0.5;
        
        setLineWidth(radius * 2);
        x.beginPath();
        x.moveTo(prevSegment.x + prevBreath, prevSegment.y);
        x.lineTo(x_pos, y_pos);
        x.stroke();
      }
      
      // Draw thorns directly from segment
      if (segment.thorns) {
        segment.thorns.forEach(thorn => {
          const thornTipX = x_pos + cos(thorn.angle) * thorn.length;
          const thornTipY = y_pos + sin(thorn.angle) * thorn.length;
          
          // Simple line thorn
          setLineWidth(2);
          x.beginPath();
          x.moveTo(x_pos, y_pos);
          x.lineTo(thornTipX, thornTipY);
          x.stroke();
          
          // Thorn tip - small triangle
          const tipSize = 2;
          x.beginPath();
          x.moveTo(thornTipX, thornTipY);
          x.lineTo(thornTipX - cos(thorn.angle - 0.5) * tipSize, thornTipY - sin(thorn.angle - 0.5) * tipSize);
          x.lineTo(thornTipX - cos(thorn.angle + 0.5) * tipSize, thornTipY - sin(thorn.angle + 0.5) * tipSize);
          x.closePath();
          x.fill();
        });
      }
    });
  });
};

// Check if a point is behind vine silhouettes (for firefly depth effect)
const isPointBehindVines = (px, py) => {
  return vineShapes.some(vine => {
    if (vine.depth < 0.9) return false; // Only foreground vines can occlude
    
    // Check if point is near any vine segment
    return vine.segments && vine.segments.some(segment => {
      const distance = hyp(px - segment.x, py - segment.y);
      return distance < segment.thickness * 1.5;
    });
  });
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
  { len: 140, yOff: 55, spread: 0 },   // middle (longer than others)
  { len: 110, yOff: 65, spread: 25 }   // bottom
];

// Helper function for cat eye color logic with centralized flashing
const getCatEyeColors = () => {
  let baseColor;
  switch (catEyeColor) {
    case "gold": baseColor = { hex: "#ffdd00", r: 255, g: 221, b: 0 }; break;
    case "purple": baseColor = { hex: "#8844ff", r: 136, g: 68, b: 255 }; break;
    case "pink": baseColor = { hex: "#ff44aa", r: 255, g: 68, b: 170 }; break;
    default: baseColor = { hex: "#ffdd00", r: 255, g: 221, b: 0 }; break;
  }
  
  // Apply flashing effect if active
  if (flashTimer > 0) {
    // Flash to white for danger warnings
    const flashIntensity = flashTimer / 200; // Normalize to 0-1
    return {
      hex: `#${Math.floor(255 - (255 - baseColor.r) * flashIntensity).toString(16).padStart(2, '0')}${Math.floor(255 - (255 - baseColor.g) * flashIntensity).toString(16).padStart(2, '0')}${Math.floor(255 - (255 - baseColor.b) * flashIntensity).toString(16).padStart(2, '0')}`,
      r: Math.floor(255 - (255 - baseColor.r) * flashIntensity),
      g: Math.floor(255 - (255 - baseColor.g) * flashIntensity),
      b: Math.floor(255 - (255 - baseColor.b) * flashIntensity),
      rgba: (alpha = 1) => `rgba(${Math.floor(255 - (255 - baseColor.r) * flashIntensity)}, ${Math.floor(255 - (255 - baseColor.g) * flashIntensity)}, ${Math.floor(255 - (255 - baseColor.b) * flashIntensity)}, ${alpha})`
    };
  }
  
  // Add rgba helper for convenience
  baseColor.rgba = (alpha = 1) => `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`;
  return baseColor;
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
    
    // Add natural downward curve for realistic whisker shape
    const isMiddleWhisker = i === 1;
    const curveAmount = isMiddleWhisker ? 15 : 8; // More curve for middle whiskers
    const ex = baseX + dir * w.len;
    const ey = sy + w.spread + twitch + curveAmount; // Downward curve

    // Draw whisker with curve using quadratic curve
    x.beginPath();
    x.moveTo(baseX, sy);
    // Control point for natural whisker curve
    const controlX = baseX + dir * (w.len * 0.7);
    const controlY = sy + (w.spread + twitch) * 0.5;
    x.quadraticCurveTo(controlX, controlY, ex, ey);
    x.stroke();

    // Stars: 2 on middle whisker, 1 on others
    const starCount = i === 1 ? 2 : 1;
    for (let s = 0; s < starCount; s++) {
      const pos = starCount === 2 ? (s + 1) / 3 : 0.6;
      
      // Position stars along the curved whisker path
      const t = pos;
      const sx = baseX + dir * (w.len * t);
      const sy2 = sy + (w.spread + twitch + curveAmount) * t * 0.7; // Follow curve

      // Enhanced twinkle formula with proximity responsiveness
      let tw = sin(now * 0.002 + s * 2.2 + i * 3.1) * 0.5 + 0.5; // Faster base twinkle
      const proximityTwinkle = sin(now * 0.003 + s * 1.8 + i * 2.4) * 0.4 + 0.6; // Additional layer
      tw = (tw + proximityTwinkle) * 0.5; // Combine effects
      tw += catProximity * 0.7; // Stronger proximity boost
      
      const alpha = 0.2 + Math.min(0.8, tw * 0.8); // Brighter range

      // Draw star with enhanced glow
      setFill(`rgba(255, 255, 255, ${alpha})`);
      x.beginPath();
      x.arc(sx, sy2, 1.5, 0, TAU);
      x.fill();

      // Enhanced glow for twinkling stars
      if (tw > 0.6 || catProximity > 0.3) {
        const glowIntensity = Math.min(1, tw + catProximity * 0.5);
        x.shadowBlur = 4 + glowIntensity * 3;
        x.shadowColor = `rgba(255, 255, 255, ${0.6 * glowIntensity})`;
        x.beginPath();
        x.arc(sx, sy2, 0.75 + glowIntensity * 0.5, 0, TAU);
        x.fill();
        x.shadowBlur = 0; // Reset
      }
    }
  }
};

// Draw mystical grin outline using twinkling stars
const drawMysticalGrin = (eyeX, eyeY, now, mouseInSky, catProximity) => {
  const grinCenterX = eyeX;
  const grinCenterY = eyeY + 85; // Moved up toward nose
  
  // Create the ":3" cat mouth - two curves that angle INWARD toward center
  const starsPerSide = 6; // Fewer stars for cleaner look
  const sideWidth = 70; // Width of each side curve
  const curveHeight = 18; // How much each curve rises toward center
  const separation = 20; // Gap between the two curves at center
  
  // Base brightness - dim by default, bright on sky hover
  const baseAlpha = mouseInSky ? 0.6 : 0.2; // Dimmer when not hovered
  const hoverBoost = mouseInSky ? catProximity * 0.4 : 0; // Extra brightness on proximity
  
  // LEFT side of the ":3" mouth - curves inward (downward and rightward)
  for (let i = 0; i < starsPerSide; i++) {
    const t = i / (starsPerSide - 1); // 0 to 1
    const starX = grinCenterX - separation - t * sideWidth; // Start from center, go left
    
    // Curve that goes DOWN and INWARD - like the left side of a heart bottom
    const curveAmount = sin(t * Math.PI) * curveHeight; // Sine gives smooth curve
    const starY = grinCenterY + curveAmount; // Add to go downward
    
    // Random twinkling timing for each star - slower when not hovered
    const twinkleSpeed = mouseInSky ? 0.006 : 0.002; // Faster sparkle on hover
    const starPhase = now * twinkleSpeed + i * 1.3; // Faster, more random
    const twinkle = sin(starPhase) * 0.5 + 0.5;
    const alpha = baseAlpha + (twinkle * 0.3) + hoverBoost;
    const starSize = 1.0 + (twinkle * 0.4) + (hoverBoost * 0.5);
    
    x.shadowColor = `rgba(255, 255, 255, ${alpha * 0.9})`;
    x.shadowBlur = starSize * 3;
    setFill(`rgba(255, 255, 255, ${alpha})`);
    x.beginPath();
    x.arc(starX, starY, starSize, 0, TAU);
    x.fill();
    x.shadowBlur = 0;
  }
  
  // RIGHT side of the ":3" mouth - curves inward (downward and leftward)  
  for (let i = 0; i < starsPerSide; i++) {
    const t = i / (starsPerSide - 1); // 0 to 1
    const starX = grinCenterX + separation + t * sideWidth; // Start from center, go right
    
    // Same curve but mirrored - goes DOWN and INWARD
    const curveAmount = sin(t * Math.PI) * curveHeight;
    const starY = grinCenterY + curveAmount; // Add to go downward
    
    // Different random timing for right side
    const twinkleSpeed = mouseInSky ? 0.006 : 0.002; // Faster sparkle on hover
    const starPhase = now * twinkleSpeed + (i + starsPerSide) * 0.9; // Different offset
    const twinkle = sin(starPhase) * 0.5 + 0.5;
    const alpha = baseAlpha + (twinkle * 0.3) + hoverBoost;
    const starSize = 1.0 + (twinkle * 0.4) + (hoverBoost * 0.5);
    
    x.shadowColor = `rgba(255, 255, 255, ${alpha * 0.9})`;
    x.shadowBlur = starSize * 3;
    setFill(`rgba(255, 255, 255, ${alpha})`);
    x.beginPath();
    x.arc(starX, starY, starSize, 0, TAU);
    x.fill();
    x.shadowBlur = 0;
  }
  
  // Single center point where both curves meet
  const twinkleSpeed = mouseInSky ? 0.005 : 0.002;
  const centerPhase = now * twinkleSpeed + 2.7; // Different timing
  const centerTwinkle = sin(centerPhase) * 0.5 + 0.5;
  const centerAlpha = baseAlpha + (centerTwinkle * 0.3) + hoverBoost;
  
  x.shadowColor = `rgba(255, 255, 255, ${centerAlpha * 0.8})`;
  x.shadowBlur = 4;
  setFill(`rgba(255, 255, 255, ${centerAlpha})`);
  x.beginPath();
  x.arc(grinCenterX, grinCenterY + curveHeight * 0.7, 0.8 + centerTwinkle * 0.3 + hoverBoost * 0.3, 0, TAU);
  x.fill();
  x.shadowBlur = 0;
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

  // Check if we're in the warning period (but skip warning during early tutorial)
  const timeUntilChange = nextColorChangeTime - catEyeChangeTimer;
  const isWarning = timeUntilChange <= CFG.warnFrames && (tutorialComplete || tutorialStep >= 2);
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

  // Mouse tracking for pupils with better bounds checking
  const mouseDistX = mx - eyeX;
  const mouseDistY = my - eyeY;
  
  // Calculate pupil dilation based on distance to nose
  const basePupilWidth = 4;
  const maxPupilWidth = 12;
  
  // Use existing nose coordinates and calculate distance
  const distanceToNose = Math.sqrt((mx - noseX) * (mx - noseX) + (my - noseY) * (my - noseY));
  
  // Maximum distance for dilation effect (when pupils should be smallest)
  const maxDistance = 200; // Adjust this to control the proximity range
  
  // Invert the distance - closer to nose = larger pupils
  const proximityFactor = Math.max(0, 1 - (distanceToNose / maxDistance));
  const pupilWidth = basePupilWidth + (maxPupilWidth - basePupilWidth) * proximityFactor;
  
  // Reduce max movement based on eye size and pupil width to prevent overlap
  // Eye is 85x28, so we need to account for pupil size and eye rotation
  const maxPupilMove = Math.min(8, (85 - pupilWidth) / 2 - 5); // Leave 5px buffer
  const pupilOffsetX = clamp(mouseDistX * 0.03, -maxPupilMove, maxPupilMove); // Reduced sensitivity
  const pupilOffsetY = clamp(mouseDistY * 0.03, -maxPupilMove, maxPupilMove);

  if (!eye.isBlinking) {
    // Create subtle, ethereal eye glow that blends with the night sky
    const subtleGlow = 30 * flashIntensity;
    const atmosphericGlow = 50 * flashIntensity;
    
    // Very subtle atmospheric glow - like distant stars
    x.shadowColor = shadowColor;
    x.shadowBlur = atmosphericGlow;

    // Left eye - more elongated and mystical shape with better visibility
    x.save();
    x.translate(eyeX - 120, eyeY); // Wider spacing for larger cat face
    x.rotate(0.3);
    // Increased opacity for better visibility while keeping ethereal feel
    x.fillStyle = eyeColor + F(90 * flashIntensity).toString(16).padStart(2, '0'); 
    x.beginPath();
    x.ellipse(0, 0, 85, 28, 0, 0, TAU); // Slightly larger eyes
    x.fill();
    x.restore();

    // Subtle inner shimmer for left eye
    x.save();
    x.translate(eyeX - 120, eyeY);
    x.rotate(0.3);
    x.shadowBlur = subtleGlow;
    x.fillStyle = eyeColor + F(45 * flashIntensity).toString(16).padStart(2, '0'); // Bit more visible
    x.beginPath();
    x.ellipse(0, 0, 95, 33, 0, 0, TAU); // Soft outer glow
    x.fill();
    x.restore();

    // Right eye - more elongated and mystical shape with better visibility
    x.save();
    x.translate(eyeX + 120, eyeY); // Wider spacing for larger cat face
    x.rotate(-0.3);
    x.fillStyle = eyeColor + F(90 * flashIntensity).toString(16).padStart(2, '0');
    x.beginPath();
    x.ellipse(0, 0, 85, 28, 0, 0, TAU); // Slightly larger eyes
    x.fill();
    x.restore();

    // Subtle inner shimmer for right eye
    x.save();
    x.translate(eyeX + 120, eyeY);
    x.rotate(-0.3);
    x.shadowBlur = subtleGlow;
    x.fillStyle = eyeColor + F(45 * flashIntensity).toString(16).padStart(2, '0'); // Bit more visible
    x.beginPath();
    x.ellipse(0, 0, 95, 33, 0, 0, TAU); // Soft outer glow
    x.fill();
    x.restore();

    x.shadowBlur = 0;

    // Vertical slit pupils - using softer night sky color instead of harsh black
    x.fillStyle = "#0a0a1a"; // Same as sky background for natural blending
    
    // Pupil width already calculated above for bounds checking

    // Left pupil - vertical slit with curiosity-based dilation and proper bounds
    x.save();
    x.translate(eyeX - 120 + pupilOffsetX, eyeY + pupilOffsetY);
    x.rotate(0.3); // Match the eye rotation
    x.beginPath();
    x.ellipse(0, 0, pupilWidth, 20, 0, 0, TAU); // Width changes with curiosity, height stays 20px
    x.fill();
    x.restore();

    // Right pupil - vertical slit with curiosity-based dilation and proper bounds
    x.save();
    x.translate(eyeX + 120 + pupilOffsetX, eyeY + pupilOffsetY);
    x.rotate(-0.3); // Match the eye rotation
    x.beginPath();
    x.ellipse(0, 0, pupilWidth, 20, 0, 0, TAU); // Width changes with curiosity, height stays 20px
    x.fill();
    x.restore();
  }

  // Cat nose and whiskers - OUTSIDE the blinking check so they stay visible
  let noseAlpha = 0.4;
  let noseGlow = 0;
  
  // Make nose glow based on mouse proximity - enhanced twinkling
  if (mouseNearCat) {
    const proximityTwinkle = sin(now * 0.008) * 0.5 + 0.5; // Faster twinkling
    const secondaryTwinkle = sin(now * 0.012 + 1.5) * 0.3 + 0.7; // Secondary layer
    const combinedTwinkle = proximityTwinkle * secondaryTwinkle;
    
    noseAlpha = 0.4 + (catProximity * 0.8) + (combinedTwinkle * catProximity * 0.5);
    noseGlow = (catProximity * 35) + (combinedTwinkle * catProximity * 20);
  }
  
  x.strokeStyle = `rgba(255, 255, 255, ${noseAlpha})`;
  x.lineWidth = 1.5;
  x.globalAlpha = noseAlpha;
  
  // Add glow effect when twinkling
  if (noseGlow > 0) {
    x.shadowBlur = noseGlow;
    x.shadowColor = `rgba(255, 255, 255, 0.9)`;
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
  const whiskerBreathing = sin(now * 0.003) * 0.5 + 0.5; // Slightly faster
  const proximityEffect = catProximity * 0.8; // More pronounced proximity effect
  const whiskerAlpha = 0.3 + (whiskerBreathing * 0.5) + proximityEffect;
  const whiskerGlow = (whiskerBreathing * 12) + (catProximity * 25); // More glow
  
  // Only twitch when mouse is in sky area (above skyline at h * 0.65)
  const mouseInSky = my < h * 0.65;
  const skyTwitch = mouseInSky && mouseNearCat ? sin(now * 0.02) * catProximity * 3 : 0; // Subtle sky twitch
  const whiskerTwitch = skyTwitch; // Remove base constant twitching
  
  // Batch canvas state for whiskers
  setStroke(`rgba(255, 255, 255, ${Math.min(1, whiskerAlpha)})`);
  setLineWidth(1);
  x.globalAlpha = Math.min(1, whiskerAlpha);
  
  // Enhanced glow for whiskers when near cat
  if (whiskerGlow > 0) {
    x.shadowBlur = whiskerGlow;
    x.shadowColor = `rgba(255, 255, 255, 0.5)`;
  }
  
  // Draw left and right whiskers
  drawWhiskers(-1, eyeX, eyeY, whiskerTwitch, now);
  drawWhiskers(1, eyeX, eyeY, whiskerTwitch, now);

  // Reset shadow effects and alpha
  x.shadowBlur = 0;
  x.globalAlpha = 1;
  
  // Draw mystical grin outline - testing mode (always visible)
  drawMysticalGrin(eyeX, eyeY, now, mouseInSky, catProximity);
};

// Update cat eye color changes and warnings
const updateCatEyes = (now) => {
  // During tutorial steps 0-1.5, keep cat eyes stable for learning
  if (!tutorialComplete && tutorialStep < 2) {
    // Still update blinking animation during tutorial
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
    return; // Skip hunger/color change logic during early tutorial
  }
  
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
  
  // Handle captured fireflies (existing logic)
  if (capturedFireflies.length > 0) {
    if (shieldActive) {
      handleShieldProtection(capturedFireflies, now);
    } else {
      // No shield - partial penalty
      handleNoPenalty(capturedFireflies);
    }
  }
  
  // Handle free fireflies - now they're also protected by shields!
  const freeFireflies = otherFireflies.filter(f => !f.captured);
  if (freeFireflies.length > 0 && !shieldActive) {
    // No shield active - remove only some free fireflies (not all!)
    const firefliesEaten = Math.ceil(freeFireflies.length * 0.5); // Only eat 50% of free fireflies
    const firefliesSaved = freeFireflies.length - firefliesEaten;
    
    // Remove eaten fireflies
    for (let i = 0; i < firefliesEaten && freeFireflies.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * freeFireflies.length);
      const firefly = freeFireflies.splice(randomIndex, 1)[0];
      const fireflyIndex = otherFireflies.indexOf(firefly);
      if (fireflyIndex > -1) {
        otherFireflies.splice(fireflyIndex, 1);
      }
    }
    
    totalLost += firefliesEaten;
    
    // Show feedback only if we're not already showing shield feedback
    if (capturedFireflies.length === 0) {
      clearShieldFeedback();
      addScoreText(`-${firefliesEaten}`, w / 2, h / 2, "#ffaa44", 300);
    }
  }
  
  changeToNewColor();
};

// Shield protection with timing-based effectiveness
const handleShieldProtection = (capturedFireflies, now) => {
  const warningPhase = nextColorChangeTime - catEyeChangeTimer;
  let protectionRate, timingQuality;
  
  // Timing-based shield effectiveness with tighter perfect window
  if (warningPhase >= CFG.flash2 + 5 && warningPhase <= CFG.flash2 + 15) {
    // Perfect shield: 10-frame window (0.16 seconds) - protects ALL fireflies!
    protectionRate = 1.0;
    timingQuality = "PERFECT";
    
    // PERFECT SHIELD: Protect ALL fireflies on screen, not just captured ones
    otherFireflies.forEach(firefly => {
      if (!firefly.captured) {
        firefly.perfectlyProtected = true; // Mark for protection
      }
    });
    
  } else if (warningPhase >= CFG.flash1 && warningPhase <= CFG.flash2) {
    protectionRate = 0.95; // Great timing - 95% protection (was 85%)
    timingQuality = "GREAT";
  } else if (warningPhase >= CFG.flash3 && warningPhase <= CFG.warnFrames) {
    protectionRate = 0.85; // Good timing - 85% protection (was 70%)
    timingQuality = "GOOD";
  } else {
    protectionRate = 0.7; // Late timing - 70% protection (was 50%)
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
  stopShieldHum(); // Stop the hum
  shieldCooldown = CFG.shieldCooldown + getDifficulty() * 4;
  
  // Audio feedback based on timing
  const soundFreqs = { "PERFECT": 300, "GREAT": 250, "GOOD": 200, "LATE": 180 };
  playTone(soundFreqs[timingQuality], 0.2, 0.15);
  
  // Visual feedback - minimal
  let protectionText;
  if (firefliesLost === 0) {
    protectionText = `SHIELD`;
  } else {
    protectionText = `-${firefliesLost}`;
  }
  
  // Clear any existing shield feedback to prevent stacking
  clearShieldFeedback();
  addScoreText(protectionText, w / 2, h / 2 - 80, getTimingColor(timingQuality), 300);
  
  // Tutorial progression - advance after successful shield use
  if (!tutorialComplete && tutorialStep === 2 && firefliesProtected > 0) {
    tutorialStep = 3; // Move to resource management tutorial
    tutorialMissedShield = false; // Reset missed shield flag
  }
};

// No shield protection - simplified penalty system
const handleNoPenalty = (capturedFireflies) => {
  // Lose only 50% of captured fireflies (much more forgiving)
  const firefliesLost = Math.ceil(capturedFireflies.length * 0.5);
  const firefliesSaved = capturedFireflies.length - firefliesLost;
  
  score -= firefliesLost;
  totalLost += firefliesLost;
  
  // Show what happened with single, clear message
  clearShieldFeedback();
  
  let noShieldText;
  if (firefliesLost > 0) {
    noShieldText = `-${firefliesLost}`;
  } else {
    noShieldText = `NO LOSS`;
  }
  
  addScoreText(noShieldText, w / 2, h / 2 - 60, "#ffaa44", 300);
  
  // Tutorial - track missed shields for repeat explanation (but don't show extra text)
  if (!tutorialComplete && tutorialStep === 2) {
    tutorialMissedShield = true;
    // The tutorial text itself will show the help - no need for extra messages here
  }
  
  // Release only the lost fireflies
  releaseCapturedFireflies(firefliesLost);
  
  // Continue charging if we have any fireflies left
  const remainingFireflies = capturedFireflies.length - firefliesLost;
  if (remainingFireflies > 0) {
    charging = true;
  } else {
    charging = false;
    glowPower = 0;
  }
  
  // Create dispersal effect only for lost fireflies
  for (let i = 0; i < firefliesLost; i++) {
    if (capturedFireflies[i]) {
      createDispersalEffect(capturedFireflies[i]);
    }
  }
  
  // Reduce shield cooldown since no shield was used
  shieldCooldown = Math.max(0, shieldCooldown - 30);
  
  playTone(150, 0.3, 0.1);
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
  
  // More forgiving progressive difficulty - longer times, slower progression
  let minTime = 600, maxTime = 1200; // 10-20 seconds base (increased from 8-15)
  
  if (gameMinutes > 2) { // Start difficulty increase later (was 1 minute)
    const midGameFactor = Math.min(1, (gameMinutes - 2) / 3); // Slower progression
    minTime = F(600 - (300 * midGameFactor)); // Down to 5 seconds (was 4)
    maxTime = F(1200 - (500 * midGameFactor)); // Down to 11.6 seconds (was 8.3)
  }
  
  if (gameMinutes > 5) { // Late game starts later (was 3 minutes)
    const lateGameFactor = Math.min(1, (gameMinutes - 5) / 3); // Slower late game
    minTime = F(300 - (120 * lateGameFactor)); // Down to 3 seconds (was 2)
    maxTime = F(700 - (200 * lateGameFactor)); // Down to 8.3 seconds (was 5)
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

// Draw the delivery zone near the cat
const drawDeliveryZone = (now) => {
  const centerX = w / 2;
  const centerY = h * 0.2; // Match the cat nose position
  const radius = 50; // Delivery zone radius for text positioning
  const requiredFireflies = getRequiredFireflies();
  const capturedCount = otherFireflies.filter(f => f.captured).length;
  const canDeliver = capturedCount >= requiredFireflies;

  // No visible delivery zone ring - zone is invisible but still functional
  
  x.save();
  
  x.setLineDash([]); // Reset dash pattern
  x.restore();
  
  // No delivery zone UI elements - zone is invisible but functional
};

// ===== SCORE SYSTEM =====

// Add floating score text
const addScoreText = (text, x, y, color = "#ffffff", life = 180) => { // Reduced for minimal text
  scoreTexts.push({ text, x, y, life: 0, maxLife: life, color });
};

// Clear existing shield feedback to prevent stacking
const clearShieldFeedback = () => {
  scoreTexts = scoreTexts.filter(text => 
    !text.text.includes('SHIELD') && 
    !text.text.includes('PERFECT') && 
    !text.text.includes('GREAT') && 
    !text.text.includes('GOOD') && 
    !text.text.includes('LATE')
  );
};

// Update and draw floating score texts
const drawScoreTexts = () => {
  scoreTexts.forEach(text => {
    const progress = text.life / text.maxLife;
    const alpha = 1 - progress; // Fade out over time
    
    // Different font sizes for different types of messages
    const isShortNumeric = /^[+\-]\d+$/.test(text.text.trim()) || /^\+\d+\s+PERFECT!$/.test(text.text);
    const isShieldMessage = text.text.includes('SHIELD') || text.text.includes('NO SHIELD');
    
    let fontSize;
    if (isShortNumeric) {
      // Dynamic font size for numbers: starts large (24px) and shrinks to normal (16px)
      const startSize = 24;
      const endSize = 16;
      fontSize = Math.floor(startSize - (startSize - endSize) * progress);
    } else if (isShieldMessage) {
      // Larger, more prominent text for shield messages
      fontSize = 24; // Constant large size for shield messages
    } else {
      // Keep consistent size for other text messages
      fontSize = 16;
    }
    
    const fontFamily = isShieldMessage ? "'Poiret One', sans-serif" : "'Lucida Console', 'Courier New', monospace";
    
    setFill(text.color + Math.floor(alpha * 255).toString(16).padStart(2, '0'));
    x.font = `${fontSize}px ${fontFamily}`;
    x.textAlign = "center";
    x.fillText(text.text, text.x, text.y - text.life * 0.3); // Slower movement for shield messages
    
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
    y: h * 0.65 + r() * h * 0.33, // From just below skyline to bottom (65% to 98% of screen)
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
    
    // Update visual effects - more natural firefly timing
    firefly.floatTimer += 0.02 + r() * 0.01; // Slower, more gentle floating
    firefly.flashTimer += 0.006 + r() * 0.004; // Much slower flash cycle for natural firefly behavior
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
  
  // Check for player capture when charging - but not when overheated
  if (charging && !summonOverheated) {
    const distSq = d2(firefly.x, firefly.y, playerX, playerY);
    if (distSq < 25 * 25) { // 25 pixel capture radius
      captureFirefly(firefly, playerX, playerY);
      return;
    }
  }
  
  // Repulsion from overheated player - fireflies avoid the exhausted player
  if (summonOverheated) {
    const distToPlayer = hyp(firefly.x - playerX, firefly.y - playerY);
    if (distToPlayer < 80) { // Repulsion zone around overheated player
      const repelAngle = Math.atan2(firefly.y - playerY, firefly.x - playerX);
      const repelForce = (80 - distToPlayer) / 80 * 2; // Stronger when closer
      firefly.x += Math.cos(repelAngle) * repelForce;
      firefly.y += Math.sin(repelAngle) * repelForce;
    }
  }
  
  // Natural roaming behavior
  if (!firefly.roamTarget || 
      Math.abs(firefly.x - firefly.roamTarget.x) < 30 && 
      Math.abs(firefly.y - firefly.roamTarget.y) < 30) {
    
    // Set new roaming destination
    firefly.roamTarget = {
      x: r() * w,
      y: h * 0.65 + r() * h * 0.33, // From just below skyline to bottom
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
  firefly.y = clamp(firefly.y, h * 0.65, h - 20); // From just below skyline to bottom
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
    
    // Natural firefly flashing behavior - they should actually fade out completely sometimes
    const flashCycle = sin(firefly.flashTimer) * 0.5 + 0.5; // 0 to 1 smooth transition
    const baseIntensity = firefly.captured ? 0.8 : 0.6; // Captured fireflies glow more
    
    // Real firefly behavior - they fade out completely then back in
    let visibility;
    if (flashCycle < 0.1) {
      visibility = 0; // Completely dark for brief moments
    } else if (flashCycle < 0.3) {
      visibility = (flashCycle - 0.1) / 0.2 * baseIntensity; // Fade in
    } else if (flashCycle > 0.8) {
      visibility = (1 - flashCycle) / 0.2 * baseIntensity; // Fade out
    } else {
      visibility = baseIntensity + (flashCycle - 0.3) * 0.4; // Stay bright in middle
    }
    
    if (visibility <= 0) return; // Skip drawing when invisible
    
    // Firefly colors with more magical glow
    let bodyColor, glowColor;
    if (firefly.captured) {
      // Magical blue for captured fireflies
      bodyColor = `rgba(120, 180, 255, ${visibility * alpha})`;
      glowColor = `rgba(150, 200, 255, ${visibility * alpha * 0.8})`;
    } else {
      // Magical green for wild fireflies
      bodyColor = `rgba(180, 255, 140, ${visibility * alpha})`;
      glowColor = `rgba(200, 255, 180, ${visibility * alpha * 0.8})`;
    }
    
    // Gentle floating movement
    const floatX = firefly.x + sin(firefly.floatTimer) * 0.8;
    const floatY = firefly.y + cos(firefly.floatTimer * 1.1) * 0.6;
    
    // Enhanced multi-layer glow for more magical effect
    const baseGlowRadius = firefly.size * 3;
    const maxGlowRadius = firefly.size * 8; // Increased for more magic
    const currentGlowRadius = baseGlowRadius + (maxGlowRadius - baseGlowRadius) * visibility;
    
    // Outer magical glow - larger and more ethereal
    const outerGradient = x.createRadialGradient(
      floatX, floatY, 0,
      floatX, floatY, currentGlowRadius
    );
    outerGradient.addColorStop(0, glowColor);
    outerGradient.addColorStop(0.2, `rgba(${firefly.captured ? '150, 200, 255' : '200, 255, 180'}, ${visibility * alpha * 0.4})`);
    outerGradient.addColorStop(0.5, `rgba(${firefly.captured ? '120, 180, 255' : '180, 255, 140'}, ${visibility * alpha * 0.15})`);
    outerGradient.addColorStop(1, "transparent");
    
    setFill(outerGradient);
    x.beginPath();
    x.arc(floatX, floatY, currentGlowRadius, 0, TAU);
    x.fill();
    
    // Inner bright core
    const coreRadius = firefly.size * 2;
    const coreGradient = x.createRadialGradient(
      floatX, floatY, 0,
      floatX, floatY, coreRadius
    );
    coreGradient.addColorStop(0, bodyColor);
    coreGradient.addColorStop(0.4, glowColor);
    coreGradient.addColorStop(1, "transparent");
    
    setFill(coreGradient);
    x.beginPath();
    x.arc(floatX, floatY, coreRadius, 0, TAU);
    x.fill();
    
    // Firefly body - small oval shape like real fireflies
    setFill(bodyColor);
    x.save();
    x.translate(floatX, floatY);
    x.scale(1, 0.8); // Slightly oval
    x.beginPath();
    x.arc(0, 0, firefly.size * 0.7, 0, TAU);
    x.fill();
    x.restore();
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
  // Streak bonus system
  deliveryStreak++;
  bestStreak = Math.max(bestStreak, deliveryStreak);
  
  // Simple scoring system
  const basePoints = capturedFireflies.length;
  const streakMultiplier = Math.min(3, 1 + (deliveryStreak - 1) * 0.5);
  const pointsAwarded = Math.floor(basePoints * streakMultiplier);
  
  score += pointsAwarded;
  totalCollected += capturedFireflies.length;
  
  // Remove delivered fireflies
  otherFireflies = otherFireflies.filter(f => !f.captured);
  
  // Reset summoning heat as reward
  summonHeat = Math.max(0, summonHeat - capturedFireflies.length * 15);
  if (summonOverheated && summonHeat <= 40) {
    summonOverheated = false;
  }
  
  // Restore bioluminescence based on fireflies delivered
  const manaBonus = capturedFireflies.length * 5;
  manaEnergy = Math.min(100, manaEnergy + manaBonus);
  
  // Visual feedback
  let feedbackText = `+${pointsAwarded}`;
  let feedbackColor = "#00ff00";
  
  // Color based on streak level
  if (deliveryStreak >= 5) {
    feedbackColor = "#ffaa00"; // Hot orange for big streaks
  } else if (deliveryStreak >= 3) {
    feedbackColor = "#88ff88"; // Bright green for good streaks
  }
  
  addScoreText(feedbackText, w / 2, h / 2, feedbackColor, 180); // Quick feedback
  
  // Spawn new fireflies to maintain population
  const spawnCount = Math.min(3, capturedFireflies.length);
  for (let i = 0; i < spawnCount; i++) {
    spawnFirefly();
  }
  
  playTone(600, 0.3, 0.15); // Delivery success sound
  
  // Tutorial progression
  if (!firstDeliveryMade) {
    firstDeliveryMade = true;
    showTutorialElements = false; // Hide tutorial elements after first delivery
    if (!tutorialComplete && tutorialStep === 0) {
      tutorialStep = 1; // Move to bioluminescence tutorial after first delivery
      tutorialStep1Timer = 0; // Reset step 1 timer
      // Spawn more fireflies for next phase
      for (let i = 0; i < 8; i++) {
        spawnFirefly();
      }
    }
  }
  
  // Advance from overheat tutorial step when player delivers fireflies
  if (!tutorialComplete && tutorialStep === 1.5) {
    tutorialStep = 2; // Move to shield tutorial after they learn to restore energy
    catEyeChangeTimer = 0; // Reset timer so player gets full cycle to learn
    setNextColorChangeTime(); // Set a fresh timing
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
  
  // Update summoning feedback
  if (summonFeedback.active) {
    summonFeedback.life++;
    
    // Check if user stopped summoning (no summon for 500ms)
    if (Date.now() - lastSummonTime > 500) {
      if (summonFeedback.summonCount > 0) {
        summonFeedback.text = `Summoned ${summonFeedback.summonCount} firefl${summonFeedback.summonCount === 1 ? 'y' : 'ies'}`;
        summonFeedback.life = 0; // Reset life to show the final count
        summonFeedback.maxLife = 120; // Show for 2 seconds
        summonFeedback.summonCount = 0; // Reset count
      }
    }
    
    // Remove feedback after its lifetime
    if (summonFeedback.life >= summonFeedback.maxLife) {
      summonFeedback.active = false;
    }
  }
  
  // Update shield cooldown
  if (shieldCooldown > 0) {
    shieldCooldown--;
  }
  
  // Deactivate shield if input released, bioluminescence depleted, or overheated
  if (shieldActive) {
    const inputHeld = spacePressed || mousePressed;
    
    if (!inputHeld || manaEnergy <= 0 || summonOverheated) {
      shieldActive = false;
      stopShieldHum(); // Stop the hum
      if (!inputHeld) {
        // No cooldown when released manually
        shieldCooldown = 0;
      } else {
        // Short cooldown when depleted/overheated
        shieldCooldown = 60; // 1 second
      }
    } else {
      // Drain bioluminescence while shield is active - reduced drain rate
      manaEnergy = Math.max(0, manaEnergy - 0.1); // Reduced from 0.15 to 0.1
      
      // Add heat for sustained shield use (slower than summoning)
      summonHeat += 0.4; // Reduced from 0.5 for more forgiving gameplay
    }
  }
  
  // Bioluminescence only regenerates when turning in fireflies - removed automatic regeneration
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
    overheatCooldown = 180; // 3 seconds of cooldown (60fps * 3)
    addScoreText("OVERHEATED!", mx, my - 30, "#ff4444", 300);
    playTone(200, 0.5, 0.1); // Overheat warning sound
    
    // Tutorial - advance to overheat explanation when it actually happens
    if (!tutorialComplete && tutorialStep === 1) {
      tutorialStep = 1.5; // Move to overheat explanation step
    }
    
    // Disperse captured fireflies aggressively
    otherFireflies.forEach(firefly => {
      if (firefly.captured) {
        firefly.captured = false;
        // Give them strong dispersal velocity away from player
        const disperseAngle = Math.atan2(firefly.y - my, firefly.x - mx);
        const disperseForce = 8 + r() * 4; // Strong dispersal force
        firefly.vx = Math.cos(disperseAngle) * disperseForce;
        firefly.vy = Math.sin(disperseAngle) * disperseForce;
        // Add some randomness to the dispersal
        firefly.vx += (r() - 0.5) * 6;
        firefly.vy += (r() - 0.5) * 6;
      }
    });
  }
  
  // Handle overheat cooldown - lasts exactly 3 seconds
  if (summonOverheated) {
    overheatCooldown--;
    if (overheatCooldown <= 0) {
      overheatStunned = false;
      summonOverheated = false; // End overheat after 3 seconds
      overheatCooldown = 0;
    }
  }
};

// Draw the player firefly (luminid)
const drawPlayerFirefly = (playerX, playerY, now) => {
  // Don't draw if player is off-screen or stunned
  if (!mouseInBounds && !charging) return;
  
  // Natural firefly movement - gentle up/down bob and slight sway
  const isMoving = mouseMoving || charging;
  const gentleBob = isMoving ? 0 : sin(now * 0.004) * 3; // Slow up/down when idle
  const gentleSway = isMoving ? 0 : sin(now * 0.0025) * 1.5; // Very gentle side sway
  
  // Apply natural movement
  const naturalX = playerX + gentleSway;
  const naturalY = playerY + gentleBob;
  
  // Natural firefly glow - smooth fade like real fireflies
  const glowCycle = sin(now * 0.002) * 0.5 + 0.5; // Slower, more natural breathing
  const baseIntensity = isMoving ? 0.9 : 0.6; // Dimmer when idle
  const naturalGlow = baseIntensity + glowCycle * 0.5; // Smooth fade range
  
  // Player firefly colors - magical pretty blue
  let bodyColor, glowColor;
  if (summonOverheated) {
    // Exhausted appearance - very dim
    const weakPulse = sin(now * 0.003) * 0.1 + 0.2;
    bodyColor = `rgba(80, 80, 80, ${weakPulse})`;
    glowColor = `rgba(60, 60, 60, ${weakPulse * 0.3})`;
  } else {
    // Beautiful magical blue firefly - special luminid species
    const blueIntensity = naturalGlow;
    bodyColor = `rgba(140, 200, 255, ${blueIntensity})`;
    glowColor = `rgba(180, 220, 255, ${blueIntensity * 0.6})`;
  }
  
  // Draw multiple glow layers for magical firefly effect
  const baseGlowRadius = 18;
  const maxGlowRadius = charging ? 40 : 28;
  const currentGlowRadius = baseGlowRadius + (maxGlowRadius - baseGlowRadius) * naturalGlow;
  
  // Outer magical glow
  const outerGradient = x.createRadialGradient(
    naturalX, naturalY, 0,
    naturalX, naturalY, currentGlowRadius
  );
  outerGradient.addColorStop(0, glowColor);
  outerGradient.addColorStop(0.3, `rgba(180, 220, 255, ${naturalGlow * 0.25})`);
  outerGradient.addColorStop(0.7, `rgba(140, 200, 255, ${naturalGlow * 0.1})`);
  outerGradient.addColorStop(1, "transparent");
  
  setFill(outerGradient);
  x.beginPath();
  x.arc(naturalX, naturalY, currentGlowRadius, 0, TAU);
  x.fill();
  
  // Inner bright core
  const innerGradient = x.createRadialGradient(
    naturalX, naturalY, 0,
    naturalX, naturalY, 10
  );
  innerGradient.addColorStop(0, bodyColor);
  innerGradient.addColorStop(0.5, `rgba(180, 220, 255, ${naturalGlow * 0.7})`);
  innerGradient.addColorStop(1, "transparent");
  
  setFill(innerGradient);
  x.beginPath();
  x.arc(naturalX, naturalY, 10, 0, TAU);
  x.fill();
  
  // Firefly body - small oval like real fireflies
  setFill(bodyColor);
  x.save();
  x.translate(naturalX, naturalY);
  x.scale(1, 0.75); // Oval shape
  x.beginPath();
  x.arc(0, 0, 3, 0, TAU);
  x.fill();
  x.restore();
  
  // Small white/light blue sparkles instead of large orbs
  if (!summonOverheated) {
    const sparkleCount = charging ? 8 : 4;
    const sparkleRadius = 16 + sin(now * 0.003) * 4;
    
    for (let i = 0; i < sparkleCount; i++) {
      const sparkleAngle = (now * 0.0008 + i * TAU / sparkleCount + sin(now * 0.002 + i)) % TAU;
      const sparkleDistance = sparkleRadius + sin(now * 0.005 + i * 2) * 6;
      const sparkleX = naturalX + cos(sparkleAngle) * sparkleDistance;
      const sparkleY = naturalY + sin(sparkleAngle) * sparkleDistance;
      
      // Individual sparkle twinkling
      const twinkle = sin(now * 0.006 + i * 1.2) * 0.5 + 0.5;
      const sparkleAlpha = twinkle * naturalGlow * 0.6;
      
      if (sparkleAlpha > 0.1) {
        // Small white/light blue sparkle
        x.shadowColor = "#aaccff";
        x.shadowBlur = 4;
        setFill(`rgba(220, 240, 255, ${sparkleAlpha})`);
        x.beginPath();
        x.arc(sparkleX, sparkleY, 0.8 + twinkle * 0.5, 0, TAU); // Much smaller
        x.fill();
        x.shadowBlur = 0;
      }
    }
  }
};

// Draw circular bioluminescence/shield indicator around player
const drawPlayerManaRing = (playerX, playerY, now) => {
  const capturedCount = otherFireflies.filter(f => f.captured).length;
  const baseRadius = 12 + Math.min(capturedCount * 1.5, 8); // Smaller, more subtle
  
  x.save();
  
  // Soft background ring - barely visible
  setStroke(`rgba(255, 255, 255, 0.1)`);
  setLineWidth(1);
  x.beginPath();
  x.arc(playerX, playerY, baseRadius, 0, TAU);
  x.stroke();
  
  // Bioluminescence indicator as soft floating dots
  if (manaEnergy > 0) {
    const dotCount = Math.ceil((manaEnergy / 100) * 8); // 0-8 dots based on mana
    
    for (let i = 0; i < dotCount; i++) {
      const angle = (i / 8) * TAU - Math.PI / 2; // Start from top
      const dotX = playerX + cos(angle) * baseRadius;
      const dotY = playerY + sin(angle) * baseRadius;
      const pulse = sin(now * 0.008 + i * 0.8) * 0.3 + 0.7;
      
      // Soft glowing dots using player firefly colors
      x.shadowColor = "#aaccff";
      x.shadowBlur = 4;
      setFill(`rgba(170, 204, 255, ${pulse * 0.6})`);
      x.beginPath();
      x.arc(dotX, dotY, 1, 0, TAU);
      x.fill();
      x.shadowBlur = 0;
    }
  }
  
  // Shield indicator - magical protective barrier
  if (shieldActive) {
    const shieldRadius = baseRadius + 8;
    const rotation = now * 0.005; // Slower rotation
    const pulse = sin(now * 0.01) * 0.3 + 0.7;
    
    // Shield uses magical energy color
    const shieldColor = summonOverheated ? "120, 120, 120" : "170, 220, 255";
    const shadowColor = summonOverheated ? "#888888" : "#aaddff";
    
    // Fewer, more subtle shield particles
    for (let i = 0; i < 4; i++) {
      const angle = rotation + i * TAU / 4;
      const runeX = playerX + cos(angle) * shieldRadius;
      const runeY = playerY + sin(angle) * shieldRadius;
      
      x.shadowColor = shadowColor;
      x.shadowBlur = summonOverheated ? 3 : 6;
      setFill(`rgba(${shieldColor}, ${pulse * (summonOverheated ? 0.4 : 0.8)})`);
      x.beginPath();
      x.arc(runeX, runeY, 1.5, 0, TAU);
      x.fill();
      x.shadowBlur = 0;
    }
    
    // Subtle shield ring
    x.shadowColor = shadowColor;
    x.shadowBlur = summonOverheated ? 5 : 10;
    setStroke(`rgba(${shieldColor}, ${pulse * 0.4 * (summonOverheated ? 0.5 : 1)})`);
    setLineWidth(1);
    x.setLineDash([4, 3]);
    x.lineDashOffset = -rotation * 6;
    x.beginPath();
    x.arc(playerX, playerY, shieldRadius - 2, 0, TAU);
    x.stroke();
    x.setLineDash([]);
    x.shadowBlur = 0;
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

// Mouse movement handler
const handleMouseMove = (e) => {
  // Don't process input when screen is too small
  if (isScreenTooSmall) return;
  
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
  console.log('🖱️ Mouse down detected');
  // Initialize audio on first user gesture
  startAudioOnUserGesture();
  
  // Don't process input when screen is too small
  if (isScreenTooSmall) return;
  
  if (showHelp) {
    // Closing help menu - add to total pause time
    totalHelpPauseTime += Date.now() - helpOpenTime;
    showHelp = false;
    return;
  }
  
  if (gameOver || gameWon) {
    restartGame();
    // Don't return - let the click continue to be processed for the new game
  }
  
  mousePressed = true;
  mouseDownTime = Date.now();
  hasPlayedChime = false; // Reset chime flag for mouse too
  
  // Set up delayed shield activation for hold detection
  if (canShield()) {
    setTimeout(() => {
      if (mousePressed && (Date.now() - mouseDownTime) >= HOLD_THRESHOLD) {
        // Still holding after delay - it's a hold action
        if (manaEnergy > 0 && !shieldActive && shieldCooldown === 0 && !summonOverheated) {
          activateShield(true); // true = hold action, play hum
        }
      }
    }, HOLD_THRESHOLD);
  }
  
  createClickEffect(mx, my);
};

// Mouse up handler  
const handleMouseUp = (e) => {
  // Don't process input when screen is too small
  if (isScreenTooSmall) return;
  
  if (!gameStarted || gameOver) return;
  
  const holdDuration = Date.now() - mouseDownTime;
  mousePressed = false;
  
  // Handle different actions based on hold duration
  if (holdDuration < HOLD_THRESHOLD) {
    // Quick click - check if it's for summoning or shielding
    if (canSummon()) {
      summonFirefly();
    } else if (canShield()) {
      // Quick shield tap
      activateShield(false); // false = tap action, play chime
      // Quick shield burst for taps
      setTimeout(() => {
        if (shieldActive) {
          shieldActive = false;
          stopShieldHum();
          shieldCooldown = 0; // No cooldown for taps
        }
      }, 100);
    }
  }
  
  hasPlayedChime = false; // Reset for next activation
};

// Keyboard handler
const handleKeyDown = (e) => {
  console.log('⌨️ Key down detected:', e.code);
  // Initialize audio on first user gesture
  startAudioOnUserGesture();
  
  // Allow some keys even when screen is too small
  if (isScreenTooSmall) {
    // Only allow audio toggle and help when screen is too small
    if (e.code === "KeyM") {
      e.preventDefault();
      audioEnabled = !audioEnabled;
    }
    return;
  }
  
  // Handle help menu navigation
  if (showHelp) {
    e.preventDefault();
    
    // Scroll controls when help is open
    if (e.code === "ArrowUp" || e.code === "KeyW") {
      helpScrollOffset = Math.max(0, helpScrollOffset - 30);
      return;
    }
    if (e.code === "ArrowDown" || e.code === "KeyS") {
      const maxScroll = window.helpMaxScroll || 400;
      helpScrollOffset = Math.min(maxScroll, helpScrollOffset + 30);
      return;
    }
    
    // Close help menu (any other key)
    totalHelpPauseTime += Date.now() - helpOpenTime;
    showHelp = false;
    helpScrollOffset = 0; // Reset scroll when closing
    return;
  }
  
  // Toggle audio
  if (e.code === "KeyM") {
    e.preventDefault();
    audioEnabled = !audioEnabled;
    if (audioEnabled && gameStarted && !showHelp && pageVisible) {
      // Try to start audio - will initialize if needed
      if (!audioStarted) startAudioOnUserGesture();
      setTimeout(startBgMusic, 100);
    } else {
      stopBgMusic();
      stopShieldHum(); // Also stop shield hum when audio disabled
    }
    return;
  }
  
  // Debug: Press B to force start background music
  if (e.code === "KeyB") {
    e.preventDefault();
    console.log('🎵 Manual music start triggered (B key)');
    if (!audioStarted) startAudioOnUserGesture();
    setTimeout(() => {
      console.log('🎵 Force starting background music...');
      startBgMusic();
    }, 100);
    return;
  }
  
  // Toggle help
  if (e.code === "Escape") {
    e.preventDefault();
    if (showHelp) {
      // Closing help menu - add to total pause time
      totalHelpPauseTime += Date.now() - helpOpenTime;
    } else {
      // Opening help menu - record start time
      helpOpenTime = Date.now();
    }
    showHelp = !showHelp;
    return;
  }
  
  // TODO: REMOVE - Testing shortcuts for development
  // Testing shortcut to trigger game over (C key)
  if (e.code === "KeyC") {
    e.preventDefault();
    if (!gameOver && !gameWon) {
      // Simply trigger the natural game over condition
      manaEnergy = 0;
      otherFireflies = []; // Remove all fireflies
    }
    return;
  }

  // TODO: REMOVE - Testing shortcut to keep tutorial always on (T key)
  if (e.code === "KeyT") {
    e.preventDefault();
    tutorialComplete = false;
    tutorialStep = 0;
    console.log("Tutorial mode forced on - step:", tutorialStep);
    return;
  }

  // TODO: REMOVE - Testing shortcut to trigger win screen (W key)
  if (e.code === "KeyW") {
    e.preventDefault();
    if (!gameOver && !gameWon) {
      // Set start time to make it look like full night duration has passed
      startTime = Date.now() - NIGHT_DURATION;
      console.log("Win condition triggered - timer set to 0");
    }
    return;
  }
  
  // Shield with spacebar
  if (e.code === "Space") {
    e.preventDefault();
    if (!gameStarted) {
      gameStarted = true;
      return;
    }
    
    // Only activate shield once when space is first pressed
    if (!spacePressed && canShield()) {
      spaceActivationTime = Date.now();
      shieldActivationTime = spaceActivationTime; // Track this specific activation
      hasPlayedChime = false; // Reset chime flag
      
      // Delay shield activation to determine if it's a tap or hold
      setTimeout(() => {
        if (spacePressed && shieldActivationTime === spaceActivationTime) {
          // Still holding after delay - it's a hold action
          activateShield(true); // true = hold action, play hum
        }
      }, HOLD_THRESHOLD);
    }
    spacePressed = true;
  }
};

// Handle key releases
const handleKeyUp = (e) => {
  // Don't process input when screen is too small
  if (isScreenTooSmall) return;
  
  if (e.code === "Space") {
    const holdDuration = Date.now() - spaceActivationTime;
    
    // If it was a quick tap (released before hold threshold)
    if (holdDuration < HOLD_THRESHOLD) {
      // Check for summoning first, then shield - same logic as mouse click
      if (canSummon()) {
        summonFirefly();
      } else if (canShield()) {
        // Quick shield tap
        activateShield(false); // false = tap action, play chime
        // Quick shield burst for taps
        setTimeout(() => {
          if (shieldActive) {
            shieldActive = false;
            stopShieldHum();
            shieldCooldown = 0; // No cooldown for taps
          }
        }, 100);
      }
    }
    
    spacePressed = false;
    hasPlayedChime = false; // Reset for next activation
  }
};

// Handle mouse wheel for help menu scrolling
const handleWheel = (e) => {
  // Only handle wheel events when help menu is open
  if (!showHelp) return;
  
  e.preventDefault();
  
  // Scroll the help content
  const scrollAmount = e.deltaY > 0 ? 30 : -30;
  const maxScroll = window.helpMaxScroll || 400;
  helpScrollOffset = Math.max(0, Math.min(maxScroll, helpScrollOffset + scrollAmount));
};

// Utility functions for input handling
const canSummon = () => !summonOverheated && manaEnergy >= 10;
const canShield = () => manaEnergy > 0 && shieldCooldown === 0 && !summonOverheated;

const summonFirefly = () => {
  if (!canSummon()) {
    // Record attempt while overheated for UI feedback
    if (summonOverheated) {
      lastOverheatAttempt = Date.now();
    }
    return;
  }
  
  // Add heat for summoning
  summonHeat += 25;
  manaEnergy = Math.max(0, manaEnergy - 10);
  
  // Track summoning for feedback
  if (!summonFeedback.active) {
    summonFeedback.active = true;
    summonFeedback.text = "Summoning fireflies...";
    summonFeedback.life = 0;
    summonFeedback.summonCount = 1;
  } else {
    summonFeedback.summonCount++;
  }
  lastSummonTime = Date.now();
  
  // No automatic tutorial progression here - let overheating or timer handle it
  
  // Spawn firefly near mouse
  const spawnX = mx + (r() - 0.5) * 100;
  const spawnY = my + (r() - 0.5) * 100;
  
  otherFireflies.push({
    x: clamp(spawnX, 50, w - 50),
    y: clamp(spawnY, h * 0.65, h - 50), // From just below skyline to bottom
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

const activateShield = (isHoldAction = false) => {
  if (summonOverheated) {
    // Record attempt while overheated for UI feedback
    lastOverheatAttempt = Date.now();
    return;
  }
  
  shieldActive = true;
  lastShieldTime = Date.now();
  
  // Play appropriate sound based on action type
  handleShieldAudio(isHoldAction);
  
  // Tutorial progression
  if (!tutorialComplete && tutorialStep === 0) {
    tutorialStep = 1;
  }
};

const restartGame = () => {
  // Reset all game state
  gameOver = false;
  gameWon = false; // Reset victory state
  gameOverTime = null; // Reset game over time
  gameStarted = true; // Ensure game is marked as started
  score = 0;
  totalCollected = 0;
  totalLost = 0;
  deliveryStreak = 0;
  bestStreak = 0;
  glowPower = 0;
  charging = false;
  mouseMoving = false;
  spacePressed = false; // Reset input state
  shieldActivationTime = 0; // Reset timing
  hasPlayedChime = false; // Reset chime state
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
  stopShieldHum(); // Stop any shield sounds
  shieldCooldown = 0;
  lastShieldTime = 0;
  
  // Reset and restart music
  if (audioEnabled && pageVisible) {
    fadeBgMusic(0.15, 1); // Restore normal music volume
  }
  
  // Reset tutorial
  tutorialComplete = false; // Reset tutorial state so it runs again
  tutorialStep = 0;
  tutorialStep1Timer = 0; // Reset step 1 timer
  tutorialStep3Timer = 0; // Reset step 3 timer
  tutorialStep4Timer = 0; // Reset step 4 timer
  tutorialMissedShield = false; // Reset missed shield flag
  firstDeliveryMade = false;
  showTutorialElements = true; // Show tutorial elements until first delivery
  
  // Reset timing
  startTime = Date.now();
  runStartTime = Date.now();
  totalHelpPauseTime = 0; // Reset help menu pause time
  helpOpenTime = 0;
  lastSpawnTime = Date.now(); // Reset spawn timer
  
  // Spawn initial fireflies - more generous starting counts
  let spawnCount;
  if (tutorialComplete) {
    spawnCount = 25; // Increased from 20
  } else if (tutorialStep === 0) {
    spawnCount = 8; // Increased from 5 for better tutorial experience
  } else {
    spawnCount = 15; // Increased from 12
  }
  for (let i = 0; i < spawnCount; i++) {
    spawnFirefly();
  }
  
  playTone(600, 0.2, 0.1);
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
      // First step: Collect 5 fireflies and deliver them
      setFill(`rgba(255, 255, 255, ${pulse})`);
      x.font = "20px 'Poiret One', sans-serif";
      x.fillText("Collect fireflies and lead them to The Cat in the Sky", w / 2, h - 100);
      
      // Highlight "Move your mouse" in green
      setFill(`rgba(255, 255, 255, ${pulse})`);
      x.fillText("", w / 2, h - 75);
      setFill(`rgba(100, 255, 100, ${pulse})`); // Green for input
      x.fillText("Move your mouse", w / 2, h - 75);
      
      // Show delivery zone ring around cat's mouth area
      const catX = w / 2;
      const catY = h * 0.2;
      const ringPulse = sin(tutorialTimer * 2) * 0.3 + 0.7;
      setStroke(`rgba(128, 128, 128, ${ringPulse * 0.6})`); // Gray instead of green
      setLineWidth(3);
      x.setLineDash([8, 8]);
      x.beginPath();
      x.arc(catX, catY + 50, 80, 0, TAU); // Around cat's mouth/nose area
      x.stroke();
      x.setLineDash([]);
      break;
      
    case 1:
      // Bioluminescence management - after first delivery
      setFill(`rgba(255, 255, 255, ${pulse})`);
      x.font = "20px 'Poiret One', sans-serif";
      x.fillText("Your bioluminescence attracts fireflies.", w / 2, h - 100);
      
      setFill(`rgba(100, 255, 100, ${pulse})`); // Green for input
      x.fillText("Click to summon more fireflies", w / 2, h - 75);
      break;
      
    case 1.5:
      // Overheat explanation - after summoning a few times
      setFill(`rgba(255, 255, 255, ${pulse})`);
      x.font = "18px 'Poiret One', sans-serif";
      x.fillText("CAREFUL! Too much summoning causes overheating.", w / 2, h - 110);
      x.fillText("Turn in fireflies to restore energy and prevent overload.", w / 2, h - 85);
      
      setFill(`rgba(255, 255, 100, ${pulse})`); // Yellow for warning
      x.fillText("More fireflies delivered = faster energy recovery", w / 2, h - 60);
      break;
      
    case 2:
      // Shield mechanics - after summoning and learning about mana
      setFill(`rgba(255, 255, 255, ${pulse})`);
      x.font = "20px 'Poiret One', sans-serif";
      x.fillText("Watch the cat's eyes carefully.", w / 2, h - 100);
      
      setFill(`rgba(100, 255, 100, ${pulse})`); // Green for input
      x.fillText("Hold SPACE or MOUSE when its eyes flash!", w / 2, h - 75);
      
      if (tutorialMissedShield) {
        setFill(`rgba(255, 100, 100, ${pulse})`); // Red for emphasis
        x.font = "16px 'Poiret One', sans-serif";
        x.fillText("Shield protects your fireflies from the cat's hunger", w / 2, h - 50);
      }
      break;
      
    case 3:
      // Resource management warning
      setFill(`rgba(255, 255, 255, ${pulse})`);
      x.font = "20px 'Poiret One', sans-serif";
      x.fillText("Overuse your powers and they'll abandon you", w / 2, h - 100);
      x.fillText("Manage resources carefully. The night is long and unforgiving", w / 2, h - 75);
      break;
      
    case 4:
      // Mana restoration step
      setFill(`rgba(100, 255, 255, ${pulse})`);
      x.font = "20px 'Poiret One', sans-serif";
      x.fillText("Energy restored! You're ready for the challenge.", w / 2, h - 100);
      x.fillText("Remember: Turn in fireflies to restore your power", w / 2, h - 75);
      break;
      
    case 5:
      // Final warning before full gameplay
      setFill(`rgba(255, 255, 255, ${pulse})`);
      x.font = "20px 'Poiret One', sans-serif";
      x.fillText("Now... survive until dawn. If you can", w / 2, h - 100);
      
      setFill(`rgba(100, 255, 100, ${pulse})`); // Green for input
      x.fillText("Press 'ESC' if you need reminding of the rules", w / 2, h - 75);
      break;
      
    case 6:
      // Tutorial completion message
      setFill(`rgba(100, 255, 100, ${pulse})`);
      x.font = "22px 'Poiret One', sans-serif";
      x.fillText("Tutorial Complete! Survive the night...", w / 2, h - 100);
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

// ===== RESPONSIVE DESIGN SYSTEM =====

// Draw screen size warning for mobile/small screens
const drawScreenSizeWarning = () => {
  if (!isScreenTooSmall) return;
  
  // Full screen overlay
  setFill(BLACK(0.95));
  x.fillRect(0, 0, w, h);
  
  x.save();
  x.textAlign = "center";
  
  const centerX = w / 2;
  const centerY = h / 2;
  
  // Title with glow effect
  setFill("#9a9be9");
  x.font = "32px 'Griffy', cursive";
  x.shadowColor = "#9a9be9";
  x.shadowBlur = 15;
  x.fillText("The Cat & the Luminid", centerX, centerY - 120);
  x.shadowBlur = 0;
  
  // Main message
  setFill("#ffffff");
  x.font = "24px 'Poiret One', sans-serif";
  
  if (isMobileDevice()) {
    x.fillText("This mystical experience requires", centerX, centerY - 60);
    x.fillText("a desktop or laptop computer", centerX, centerY - 30);
  } else {
    x.fillText("Please resize your browser window", centerX, centerY - 60);
    x.fillText("to enjoy the full experience", centerX, centerY - 30);
  }
  
  // Requirements
  setFill("#cccccc");
  x.font = "18px 'Poiret One', sans-serif";
  if (!isMobileDevice()) {
    x.fillText(`Minimum: ${MIN_WIDTH} × ${MIN_HEIGHT} pixels`, centerX, centerY + 20);
    
    // Current size info
    setFill("#999999");
    x.font = "16px 'Poiret One', sans-serif";
    x.fillText(`Current: ${w} × ${h} pixels`, centerX, centerY + 50);
  }
  
  // Instructions
  setFill("#69e4de");
  x.font = "20px 'Poiret One', sans-serif";
  x.shadowColor = "#69e4de";
  x.shadowBlur = 8;
  
  if (isMobileDevice()) {
    x.fillText("Please use a desktop or laptop computer", centerX, centerY + 100);
    x.fillText("for the optimal luminid experience", centerX, centerY + 130);
  } else {
    x.fillText("Try maximizing your browser window", centerX, centerY + 100);
    x.fillText("or adjusting your zoom level", centerX, centerY + 130);
  }
  
  x.shadowBlur = 0;
  
  x.restore();
};

// ===== UI SYSTEM =====

// Draw help overlay
const drawHelp = () => {
  if (!showHelp) return;
  
  // Semi-transparent overlay
  setFill(BLACK(0.8));
  x.fillRect(0, 0, w, h);
  
  x.save();
  
  // Title - centered, bold, and teal glowy - aligned with cat's eyes
  x.textAlign = "center";
  setFill("#9a9be9");
  x.font = "36px 'Griffy', cursive";
  x.shadowColor = "#9a9be9";
  x.shadowBlur = 12;
  x.fillText("The Cat & the Luminid", w / 2, h * 0.1);
  x.shadowBlur = 0; // Reset shadow
  
  // Rules text container - centered overall
  const rulesWidth = 600;
  const rulesX = (w - rulesWidth) / 2;
  x.font = "20px 'Poiret One', sans-serif";
  setFill("#cccccc");
  
  const rules = [
    "You are the Luminid, guide of fireflies in the eternal night.",
    "",
    "CONTROLS:",
    "- Move mouse to guide your luminid and collect fireflies",
    "- Tap to summon fireflies (costs bioluminescence)",
    "- Press and hold to activate protective shield (costs bioluminescence)",
    "- ESC for help menu • M to toggle audio",
    "",
    "OBJECTIVE:",
    "- Collect fireflies and deliver them to The Cat in the Sky",
    "- The Cat feeds on light to sustain the night",
    "- Survive until dawn (10 minutes) and live to see another night",
    "- Build delivery streaks for bonus points",
    "",
    "DANGER:",
    "- When The Cat's eyes begin to shift and change colors, be prepared",
    "- PERFECT timing (white flash) protects ALL fireflies in view",
    "- Good timing (yellow/green) saves most captured fireflies",
    "- Even without shield, some fireflies may escape to safety",
    "",
    "STRATEGY:",
    "- Manage bioluminescence wisely - summoning and shields costs magic",
    "- Don't overheat your luminid from excessive magic use",
    "- Master perfect shield timing for maximum protection",
    "- Watch for The Cat's eyes - it grows restless..."
  ];
  
  // Create clipping region for scrollable content
  x.save();
  const contentTop = h * 0.1 + 60;
  const contentHeight = h - contentTop - 100; // Leave space for close instruction
  x.beginPath();
  // Add padding only at top to prevent partial text rendering, keep bottom boundary strict
  x.rect(0, contentTop - 15, w, contentHeight + 15);
  x.clip();
  
  rules.forEach((rule, i) => {
    const y = contentTop + i * 24 - helpScrollOffset; // Apply scroll offset
    
    // Only render lines that are visible in the clipped area
    if (y > contentTop - 30 && y < contentTop + contentHeight + 30) {
      if (rule === "CONTROLS:" || rule === "OBJECTIVE:" || rule === "DANGER:" || rule === "STRATEGY:") {
        // Uppercase subtitles - teal glowy, centered
        x.textAlign = "center";
        setFill("#69e4de");
        x.shadowColor = "#69e4de";
        x.shadowBlur = 10;
        x.font = "bold 20px 'Poiret One', sans-serif";
        x.fillText(rule, w / 2, y);
      } else if (rule.startsWith("- ")) {
        // Bullet points with dashes
        x.textAlign = "center";
        setFill("#ffffff");
        x.shadowColor = "#ffffff";
        x.shadowBlur = 8;
        x.font = "15px 'Poiret One', sans-serif";
        x.fillText(rule, w / 2, y);
      } else if (rule !== "") {
        // Regular text - centered
        x.textAlign = "center";
        setFill("#e0e0e0");
        x.shadowBlur = 0;
        x.font = "20px 'Poiret One', sans-serif";
        x.fillText(rule, w / 2, y);
      }
      x.shadowBlur = 0; // Reset shadow after each line
    }
  });
  
  x.restore(); // Restore clipping
  
  // Scroll indicators and instructions
  const totalContentHeight = rules.length * 24;
  const maxScroll = Math.max(0, totalContentHeight - contentHeight + 50);
  
  // Update max scroll based on actual content
  if (maxScroll !== 400) {
    // Store the proper max scroll for wheel handler
    window.helpMaxScroll = maxScroll;
  }
  
  // Show scroll indicators if content is scrollable
  if (maxScroll > 0) {
    x.textAlign = "center";
    setFill("#69e4de");
    x.shadowColor = "#69e4de";
    x.shadowBlur = 8;
    x.font = "14px 'Poiret One', sans-serif";
    
    if (helpScrollOffset > 0) {
      x.fillText("↑ Scroll up (Arrow keys/Mouse wheel)", w / 2, contentTop - 10);
    }
    if (helpScrollOffset < maxScroll) {
      x.fillText("↓ Scroll down (Arrow keys/Mouse wheel)", w / 2, contentTop + contentHeight + 20);
    }
  }
  
  // "Press or click" text - centered and teal glowy
  x.textAlign = "center";
  setFill("#4dd0e1");
  x.shadowColor = "#4dd0e1";
  x.shadowBlur = 10;
  x.font = "bold 20px 'Poiret One', sans-serif";
  x.fillText("Press ESC or click to close", w / 2, h - 40);
  x.shadowBlur = 0;
  
  x.restore();
};

// Draw unified game over/victory screen
const drawGameOverScreen = () => {
  if (!gameOver && !gameWon) return;
  
  // Calculate survival time - use different logic for win vs loss
  let gameTime, gameMinutes, gameSeconds, timeString;
  if (gameWon) {
    // Victory: full night duration
    gameTime = NIGHT_DURATION;
    gameMinutes = Math.floor(gameTime / 60000);
    gameSeconds = Math.floor((gameTime % 60000) / 1000);
    timeString = `${gameMinutes}:${gameSeconds.toString().padStart(2, '0')}`;
  } else {
    // Game over: time survived until failure
    gameTime = gameOverTime ? (gameOverTime - (startTime || gameOverTime)) : 0;
    gameMinutes = Math.floor(gameTime / 60000);
    gameSeconds = Math.floor((gameTime % 60000) / 1000);
    timeString = `${gameMinutes}:${gameSeconds.toString().padStart(2, '0')}`;
  }
  
  // Calculate scores and bonuses
  const survivalMinutes = Math.max(gameTime / 60000, 0.1);
  const efficiencyScore = Math.floor((totalCollected * 60) / survivalMinutes);
  
  // Victory bonuses (only for wins)
  const survivalBonus = gameWon ? 1000 : 0;
  const perfectBonus = gameWon && totalLost === 0 ? 500 : 0;
  const streakBonus = gameWon ? bestStreak * 50 : 0;
  const finalScore = gameWon ? score + survivalBonus + perfectBonus + streakBonus : score;
  
  // Semi-transparent overlay
  setFill(BLACK(0.9));
  x.fillRect(0, 0, w, h);
  
  x.save();
  x.textAlign = "center";
  
  let currentY = h / 2 - 180; // Start higher for better spacing
  
  // Title with proper spacing
  if (gameWon) {
    setFill("#44cc44"); // Green for victory
    x.font = "48px 'Griffy', cursive";
    x.shadowColor = "#44cc44";
    x.shadowBlur = 15;
    x.fillText("DAWN BREAKS!", w / 2, currentY);
  } else {
    setFill("#cc4444"); // Red for game over
    x.font = "48px 'Griffy', cursive";
    x.shadowColor = "#cc4444";
    x.shadowBlur = 15;
    x.fillText("The Light Fades", w / 2, currentY);
  }
  x.shadowBlur = 0;
  currentY += 60; // Good spacing after title
  
  // Subtitle with consistent font
  setFill("#cccccc");
  x.font = "24px 'Poiret One', sans-serif";
  if (gameWon) {
    x.fillText("You survived the night!", w / 2, currentY);
  } else {
    x.fillText("Your bioluminescent journey ends", w / 2, currentY);
  }
  currentY += 50; // Space before stats
  
  // Key stats section - only the most important ones
  setFill("#ffffff");
  x.font = "22px 'Poiret One', sans-serif";
  
  x.fillText(`Fireflies Delivered: ${totalCollected}`, w / 2, currentY);
  currentY += 35;
  
  if (totalLost > 0) {
    x.fillText(`Fireflies Lost: ${totalLost}`, w / 2, currentY);
    currentY += 35;
  }
  
  x.fillText(`Time Survived: ${timeString}`, w / 2, currentY);
  currentY += 35;
  
  // Show streak only if notable
  if (bestStreak >= 3) {
    x.fillText(`Best Streak: ${bestStreak}x`, w / 2, currentY);
    currentY += 35;
  }
  
  currentY += 25; // Extra space before score section
  
  if (gameWon) {
    // Victory: Clean score breakdown
    setFill("#aaaaaa");
    x.font = "20px 'Poiret One', sans-serif";
    x.fillText(`Base Cat's Curiosity: ${score}`, w / 2, currentY);
    currentY += 30;
    
    if (survivalBonus > 0) {
      setFill("#88ff88");
      x.fillText(`+ Night Survival Bonus: ${survivalBonus}`, w / 2, currentY);
      currentY += 30;
    }
    
    if (streakBonus > 0) {
      setFill("#ffaa44");
      x.fillText(`+ Streak Bonus: ${streakBonus}`, w / 2, currentY);
      currentY += 30;
    }
    
    if (perfectBonus > 0) {
      setFill("#44ff44");
      x.fillText(`+ Perfect Run Bonus: ${perfectBonus}`, w / 2, currentY);
      currentY += 30;
    }
    
    currentY += 15; // Space before final score
    
    // Final score with emphasis
    setFill("#ffffff");
    x.font = "28px 'Poiret One', sans-serif";
    x.fillText(`Final Cat's Curiosity: ${finalScore}`, w / 2, currentY);
  } else {
    // Game over: Just show final score
    setFill("#ffffff");
    x.font = "24px 'Poiret One', sans-serif";
    x.fillText(`Final Cat's Curiosity: ${score}`, w / 2, currentY);
  }
  
  currentY += 60; // Good spacing before restart instruction
  
  // Restart instruction
  setFill("#bbbbbb");
  x.font = "20px 'Poiret One', sans-serif";
  x.fillText("Click to play again", w / 2, currentY);
  
  x.restore();
};

// Draw main UI elements with improved layout
const drawMainUI = () => {
  x.save();
  
  // === LEFT SIDE: Score and Streak ===
  x.textAlign = "left";
  
  // Score with dynamic color based on performance
  let scoreColor;
  if (score < 0) {
    scoreColor = "#ff9999"; // Pastel red for negative scores
  } else if (score < 100) {
    scoreColor = "#e6e6e6"; // Soft white for low scores
  } else if (score <= 200) {
    scoreColor = "#99ff99"; // Pastel green for good scores
  } else {
    scoreColor = "#ffcc99"; // Pastel orange for excellent scores
  }
  
  setFill(scoreColor);
  x.font = "22px 'Poiret One', sans-serif";
  x.fillText(`Cat's Curiosity: ${score}`, 20, 30);
  
  // Streak display (when active) - directly under score
  if (deliveryStreak >= 2) {
    const streakColor = deliveryStreak >= 5 ? "#ffcc99" : "#99ff99";
    setFill(streakColor);
    x.font = "18px 'Poiret One', sans-serif";
    x.fillText(`${deliveryStreak}x streak`, 20, 55);
  }
  
  // === TOP RIGHT: Time ===
  if (startTime && !gameOver && !gameWon) {
    // Calculate elapsed time, excluding time spent in help menu
    let elapsed = Date.now() - startTime - totalHelpPauseTime;
    // If help menu is currently open, subtract that time too
    if (showHelp) {
      elapsed -= (Date.now() - helpOpenTime);
    }
    const remaining = Math.max(0, NIGHT_DURATION - elapsed);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Color based on time remaining
    const timeColor = remaining < 60000 ? "#ff8844" : remaining < 180000 ? "#ffaa00" : "#88ddff";
    setFill(timeColor);
    x.font = "22px 'Poiret One', sans-serif";
    
    // Draw time at fixed position (right-aligned)
    x.textAlign = "right";
    x.fillText(timeText, w - 20, 30);
    
    // Draw label at fixed position (right-aligned, offset by fixed amount)
    x.fillText("Time Until Sunrise: ", w - 80, 30); // Fixed offset of 80px from right edge
  }
  
  // === LEFT SIDE: Bioluminescence and Shield (with gap) ===
  x.textAlign = "left";
  let leftY = 100; // Gap after streak
  
  // Bioluminescence display (always show) - use fixed cyan for readability
  setFill("#00dddd"); // Cyan color for good contrast against dark sky
  x.font = "18px 'Poiret One', sans-serif";
  x.fillText(`Bioluminescence: ${Math.floor(manaEnergy)}`, 20, leftY);
  leftY += 25;
  
  // Shield status
  if (shieldActive) {
    setFill("#99ccff");
    x.font = "18px 'Poiret One', sans-serif";
    x.fillText("SHIELD ACTIVE", 20, leftY);
  } else if (shieldCooldown > 0) {
    setFill("#cccccc");
    x.font = "18px 'Poiret One', sans-serif";
    x.fillText(`Shield: ${Math.ceil(shieldCooldown / 60)}s`, 20, leftY);
  } else {
    setFill("#99ff99");
    x.font = "18px 'Poiret One', sans-serif";
    x.fillText("Shield: Ready", 20, leftY);
  }
  leftY += 25;
  
  // === CENTER: Summoning Feedback ===
  if (summonFeedback.active) {
    const alpha = 1 - (summonFeedback.life / summonFeedback.maxLife);
    setFill(`rgba(255, 255, 255, ${alpha})`);
    x.textAlign = "center";
    x.font = "20px 'Poiret One', sans-serif";
    x.fillText(summonFeedback.text, w / 2, h / 2 - 150);
  }
  
  // === PLAYER CURSOR: Overheat/Heat Warning ===
  x.textAlign = "center";
  const recentAttempt = Date.now() - lastOverheatAttempt < 2000; // Show for 2 seconds after attempt
  
  if (summonOverheated || recentAttempt) {
    setFill("#ff9999");
    x.font = "18px 'Poiret One', sans-serif";
    // Position under player cursor for better visibility
    x.fillText("OVERHEATED", mx, my + 30);
  }
  
  // Tutorial step 1 timer - give players time to experience overheating
  if (!tutorialComplete && tutorialStep === 1) {
    tutorialStep1Timer++; // Count frames at step 1
    if (tutorialStep1Timer > 600) { // 10 seconds (60 fps * 10) - reduced for testing
      // If player hasn't overheated after 10 seconds, move to shield tutorial
      tutorialStep = 2; // Skip overheat explanation, go straight to shield tutorial
      catEyeChangeTimer = 0; // Reset timer so player gets full cycle to learn
      setNextColorChangeTime(); // Set a fresh timing
    }
  }
  
  // Tutorial progression - advance to final step when mana gets low OR after enough progress OR after time
  if (!tutorialComplete && tutorialStep === 3) {
    tutorialStep3Timer++; // Count frames at step 3
    if (manaEnergy <= 40 || 
        score >= 20 || 
        totalCollected >= 5 ||
        tutorialStep3Timer > 900 // 15 seconds (60 fps * 15)
    ) {
      tutorialStep = 4; // Move to mana restoration tutorial
      tutorialStep4Timer = 0; // Reset step 4 timer
      // Restore mana for the upcoming challenge
      manaEnergy = Math.min(100, manaEnergy + 30);
      addScoreText('+30', w / 2, h / 2 - 50, '#00ffff', 300);
    }
  }
  
  // Auto-complete tutorial after showing step 4 briefly
  if (!tutorialComplete && tutorialStep === 4) {
    tutorialStep4Timer++; // Count frames at step 4
    if (tutorialStep4Timer > 360 || // 6 seconds (60 fps * 6) - extended time
        score >= 15 || 
        totalCollected >= 3) {
      tutorialStep = 5; // Move to final preparation step
      tutorialStep4Timer = 0;
    }
  }
  
  // Final tutorial step - ensure player is ready for gameplay
  if (!tutorialComplete && tutorialStep === 5) {
    tutorialStep4Timer++; // Reuse timer for step 5
    if (tutorialStep4Timer > 240 || // 4 seconds
        score >= 10) {
      tutorialStep = 6; // Move to completion message step
      tutorialStep4Timer = 0; // Reset timer for completion message
    }
  }
  
  // Tutorial completion message step
  if (!tutorialComplete && tutorialStep === 6) {
    tutorialStep4Timer++; // Count frames showing completion message
    if (tutorialStep4Timer > 180) { // Show completion message for 3 seconds
      tutorialComplete = true;
      localStorage.setItem('tutorialComplete', 'true');
    }
  }
  
  // Tutorial completion message display
  if (tutorialComplete && tutorialStep === 6) {
    tutorialStep4Timer++; // Count frames showing completion message
    if (tutorialStep4Timer > 180) { // Show for 3 seconds
      tutorialStep = 7; // End tutorial display entirely
    }
  }
  
  // === BOTTOM RIGHT: Controls hint ===
  x.textAlign = "right";
  setFill("#666666");
  x.font = "14px 'Poiret One', sans-serif";
  x.fillText("Press 'ESC' for help • 'M' to toggle audio", w - 20, h - 20);
  
  // Testing shortcuts (always visible for development)
  setFill("#555555");
  x.font = "12px 'Poiret One', sans-serif";
  x.fillText("DEV: C-GameOver • T-Tutorial • W-Win", w - 20, h - 40);
  
  x.restore();
};

// Draw victory screen when player survives the night
// Main game loop - orchestrates all systems
function gameLoop() {
  const now = Date.now();
  
  const { x: playerX, y: playerY } = getPlayerPosition();
  
  // Only update game systems when game is active (not over or won) AND screen is adequate AND help menu is closed
  if (!gameOver && !gameWon && !isScreenTooSmall && !showHelp) {
    // Update all game systems
    updateCatEyes(now);
    updatePlayer(now);
    updateFireflies(playerX, playerY);
    updateParticles();
    
    // Note: Shield activation is now handled in input event handlers
    // to properly distinguish between taps and holds
    
    // Check for delivery
    if (charging) {
      checkDeliveryZone(playerX, playerY);
    }
    
    // Check for victory: surviving the night
    if (!gameWon && !gameOver && startTime && (Date.now() - startTime >= NIGHT_DURATION)) {
      gameWon = true;
      addScoreText('YOU SURVIVED THE NIGHT!', w / 2, h / 2, '#ffdd00', 600);
      playDawnBreaksVictory(); // Dawn breaking victory melody
      fadeBgMusic(0.25, 2); // Boost music volume for celebration
    }
    
    // Check game over condition: 0 mana AND 0 fireflies
    if (!gameOver && !gameWon && manaEnergy <= 0 && otherFireflies.length === 0) {
      gameOver = true;
      gameOverTime = Date.now(); // Capture the exact moment of game over
      addScoreText('Game Over!', w / 2, h / 2, '#ff4444', 300);
      playGameOverMelody(); // Calming reward melody instead of harsh tone
      fadeBgMusic(0.03, 3); // Fade music to very low volume over 3 seconds
    }
    
    // Progressive difficulty: spawn fireflies over time
    if (!gameOver && gameStarted && startTime) {
      const gameTime = now - startTime;
      const minutesPlayed = gameTime / 60000;
      
      // Base spawn rate: every 8 seconds, faster over time
      const baseSpawnInterval = Math.max(3000, 8000 - (minutesPlayed * 1000));
      const spawnInterval = baseSpawnInterval / (1 + deliveryStreak * 0.1); // Streaks make it harder
      
      if (now - lastSpawnTime > spawnInterval && otherFireflies.length < CFG.maxFireflies) {
        spawnFirefly();
        lastSpawnTime = now;
        
        // Chance for bonus firefly at higher difficulties
        if (minutesPlayed > 2 && r() < minutesPlayed * 0.05) {
          spawnFirefly();
        }
      }
      
      // Emergency Firefly Surge - when population gets dangerously low
      if (otherFireflies.length <= 3 && !tutorialComplete) {
        // During tutorial, always maintain at least 5 fireflies
        for (let i = 0; i < 3; i++) {
          spawnFirefly();
        }
      } else if (otherFireflies.length <= 5 && tutorialComplete && manaEnergy < 50) {
        // After tutorial, surge when low on both fireflies and mana
        for (let i = 0; i < 4; i++) {
          spawnFirefly();
        }
      }
    }
  } // End of active game updates
  
  // Update score texts animation - only when game is active AND screen is adequate
  if (!gameOver && !gameWon && !isScreenTooSmall) {
    scoreTexts.forEach(text => {
      text.life++;
      text.y -= 0.5; // Float upward
    });
    scoreTexts = scoreTexts.filter(text => text.life < text.maxLife);
  }
  
  // Render everything in proper order
  drawStars(now);
  drawForest();
  drawCatEyes(now);
  drawDeliveryZone(now);
  drawFireflies(now);
  drawPlayerFirefly(playerX, playerY, now);
  drawPlayerManaRing(playerX, playerY, now);
  drawParticles();
  drawScoreTexts();
  
  // Draw foreground vine silhouettes (parallax layers that can cover fireflies and cursor)
  drawVineSilhouettes('foreground', now);
  
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
  drawGameOverScreen();
  
  // Draw cursor firefly on top of overlays when they're active
  const overlaysActive = showHelp || gameOver || gameWon;
  if (overlaysActive && mouseInBounds) {
    drawPlayerFirefly(mx, my, now);
  }
  
  // Show screen size warning LAST - covers everything
  drawScreenSizeWarning();
  
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
    
    // Check if screen is too small for proper gameplay
    const wasTooSmall = isScreenTooSmall;
    isScreenTooSmall = (w < MIN_WIDTH || h < MIN_HEIGHT) || isMobileDevice();
    
    // If size changed, update systems accordingly
    if (wasTooSmall !== isScreenTooSmall) {
      if (!isScreenTooSmall) {
        // Screen became large enough - reinitialize systems
        initStars();
        initCatEyes();
        initVines();
      }
    } else if (!isScreenTooSmall) {
      // Screen is large enough and size changed - update systems
      initStars();
      initCatEyes();
      initVines();
    }
  };
  
  window.onresize = resize;
  resize();
  
  // Initialize game systems
  startTime = Date.now();
  runStartTime = Date.now();
  
  // Initialize visual systems
  initStars();
  initCatEyes();
  initVines();
  
  // Set first color change timing
  nextColorChangeTime = 600 + F(r() * 300); // 10-15 seconds initially
  
  // Set up event listeners
  c.addEventListener('mousemove', handleMouseMove);
  c.addEventListener('mousedown', handleMouseDown);
  c.addEventListener('mouseup', handleMouseUp);
  c.addEventListener('mouseleave', () => { mouseInBounds = false; });
  c.addEventListener('mouseenter', () => { mouseInBounds = true; });
  
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  document.addEventListener('wheel', handleWheel, { passive: false });
  
  // Page visibility handling for performance + audio
  document.addEventListener('visibilitychange', () => {
    pageVisible = !document.hidden;
    // Auto-pause/resume music and shield audio when tab becomes inactive/active
    if (pageVisible) {
      if (audioEnabled && audioStarted) startBgMusic();
    } else {
      pauseBgMusic();
      stopShieldHum(); // Also stop shield hum when tab inactive
    }
  });
  
  // Spawn initial fireflies
  const initialFireflies = tutorialComplete ? 20 : 8;
  for (let i = 0; i < initialFireflies; i++) {
    spawnFirefly();
  }
  
  // Background music will start on first user interaction (browser requirement)
  console.log('🎮 Game initialized - audioEnabled:', audioEnabled, 'pageVisible:', pageVisible, 'gameStarted:', gameStarted);
  
  // Start game loop
  gameLoop();
};

initGame();
