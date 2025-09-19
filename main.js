
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
  maxFireflies: 60,     // Population limit (increased for more visual engagement)
  deliveryRadius: 80,   // Delivery zone size
  idleTimeout: 4000,    // 4 seconds before fireflies start dispersing when idle
  idleDispersalRate: 0.3, // 30% of fireflies disperse per second when idle
};

// Font system - magical fonts restored from original design
const FONTS = {
  title: "'Griffy', cursive", // Fantasy font for magical titles
  body: "'Poiret One', sans-serif", // Elegant font for UI text
  mono: "'Lucida Console', 'Courier New', monospace" // Monospace for game messages
};

// Font helper functions
const setFont = (size, type = 'body') => x.font = `${size}px ${FONTS[type]}`;
const setTitleFont = (size) => setFont(size, 'title');

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
const getSpeedMult = () => 1 + (score / 200);
const getReqFireflies = () => Math.max(1, F(score / 100) + 1);

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
  
  // Safety checks to prevent audio crashes
  if (!isFinite(freq) || freq <= 0) return;
  if (!isFinite(duration) || duration <= 0) return;
  if (!isFinite(volume) || volume <= 0) return;
  
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
let shieldNodes = null; // Will hold multiple oscillators for magical shimmer

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

const startShieldShimmer = () => {
  if (!audioEnabled || !initAudio() || shieldNodes) return;
  
  // Create warm, magical energy field sound with gentle harmonics
  shieldNodes = {
    oscillators: [],
    gains: [],
    filters: []
  };
  
  // Use warm, low-mid frequencies for a pleasant magical hum
  const baseFreq = 120; // Warm fundamental
  const harmonics = [1, 1.5, 2, 3]; // Natural harmonic series
  const volumes = [0.018, 0.011, 0.006, 0.003]; // Reduced volumes for better balance
  
  harmonics.forEach((harmonic, i) => {
    // Main harmonic oscillator
    const osc = a.createOscillator();
    const gain = a.createGain();
    const filter = a.createBiquadFilter();
    
    // Gentle LFO for magical breathing
    const lfo = a.createOscillator();
    const lfoGain = a.createGain();
    
    // Setup oscillator - warm sine wave
    osc.type = 'sine';
    osc.frequency.value = baseFreq * harmonic;
    
    // Soft low-pass filter for warmth
    filter.type = 'lowpass';
    filter.frequency.value = 400 + (harmonic * 100);
    filter.Q.value = 0.5; // Gentle filtering
    
    // Very slow, gentle breathing effect
    lfo.type = 'sine';
    lfo.frequency.value = 0.2 + (i * 0.1); // Slow, organic breathing
    lfoGain.gain.value = volumes[i] * 0.3; // Subtle modulation
    
    // Base volume
    gain.gain.value = volumes[i];
    
    // Connect breathing modulation
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    
    // Audio path: osc -> filter -> gain -> destination
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(a.destination);
    
    // Start everything
    osc.start();
    lfo.start();
    
    // Store references
    shieldNodes.oscillators.push(osc, lfo);
    shieldNodes.gains.push(gain, lfoGain);
    shieldNodes.filters.push(filter);
  });
};

const stopShieldShimmer = () => {
  if (shieldNodes) {
    // Stop all oscillators gracefully
    shieldNodes.oscillators.forEach(osc => {
      try {
        osc.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    });
    shieldNodes = null;
  }
};

// Unified shield audio handler - determines what sound to play
const handleShieldAudio = (isHoldAction = false) => {
  if (isHoldAction) {
    // For holds: just start the deep hum, no chime
    startShieldShimmer();
  } else {
    // For taps: just play the chime, no hum
    playShieldChime();
  }
};

// ===== BACKGROUND MUSIC SYSTEM =====
// Gentle ambient music with soft plucked notes and natural decay
// Features short gentle tones with space between sounds for atmosphere
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



// Initialize audio on first user interaction
const startAudioOnUserGesture = () => {
  if (!audioStarted && audioEnabled) {
    if (initAudio() && a.state !== 'suspended') {
      audioStarted = true;
      
      // Start background music after successful audio init
      if (audioEnabled && pageVisible && gameStarted) {
        startBgMusic();
      }
    }
  }
  
  // Always try to start music if audio is ready but music isn't playing
  if (audioStarted && audioEnabled && (!bgMusic || !musicPlaying)) {
    startBgMusic();
  }
};

// Start/resume music with gentle fade-in
const startBgMusic = () => {
  if (!audioEnabled) return;
  
  // Ensure audio is initialized
  if (!audioStarted) {
    if (initAudio() && a.state !== 'suspended') {
      audioStarted = true;
    } else {
      return; // Can't start audio
    }
  }
  
  if (!bgMusic) createBgMusic();
  if (bgMusic && !musicPlaying) {
    fadeBgMusic(0.22, 3); // Very gentle fade-in over 3 seconds
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



// Dark atmospheric game over melody
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
let screenShake = 0; // Screen shake intensity
let tabVisible = true; // Track if tab is visible/active
let autoPaused = false; // Track if game is auto-paused due to tab switch
let lastOverheatAttempt = 0; // Track when player tried to use abilities while overheated

// Shield system
let shieldActive = false, shieldCooldown = 0, lastShieldTime = 0;
let shieldCharging = false; // Track when shield is charging up
let shieldSuccessFlash = 0, shieldPerfectFlash = 0; // Success feedback timers

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

// Idle tracking for firefly dispersal
let lastPlayerMoveTime = Date.now();
let playerIsIdle = false;

// Nyx's curiosity tracking
let lastDeliveryTime = null;

// Night survival system
const NIGHT_DURATION = 180000; // 3 minutes = 180,000 milliseconds
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

// Whisker configuration for cat face
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
  
  // Draw mystical grin outline
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
    
    // Remove floating text for eaten fireflies - too much visual clutter
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
    
    // PERFECT feedback effects
    shieldPerfectFlash = 60; // 1 second white flash
    addScoreText('PERFECT TIMING!', w / 2, h / 2 - 100, '#ffffff', 300);
    playTone(800, 0.3, 0.05); // High rewarding tone
    
  } else if (warningPhase >= CFG.flash1 && warningPhase <= CFG.flash2) {
    protectionRate = 0.95; // Great timing - 95% protection (was 85%)
    timingQuality = "GREAT";
    
    // GREAT feedback effects
    shieldSuccessFlash = 30; // Brief blue flash
    addScoreText('GREAT TIMING!', w / 2, h / 2 - 80, '#66ccff', 240);
    playTone(600, 0.2, 0.08); // Success tone
    
  } else if (warningPhase >= CFG.flash3 && warningPhase <= CFG.warnFrames) {
    protectionRate = 0.85; // Good timing - 85% protection (was 70%)
    timingQuality = "GOOD";
    
    // Minor success feedback
    shieldSuccessFlash = 15; // Very brief flash
    addScoreText('GOOD TIMING', w / 2, h / 2 - 60, '#99ff99', 180);
    playTone(500, 0.15, 0.1); // Softer tone
    
  } else {
    protectionRate = 0.5; // Poor timing - only 50% protection
    timingQuality = "MISSED";
    
    // Missed timing feedback
    addScoreText('MISSED!', w / 2, h / 2 - 80, '#ff9999', 300);
    playTone(300, 0.3, 0.12); // Lower disappointed tone
  }
  
  const firefliesLost = F(capturedFireflies.length * (1 - protectionRate));
  const firefliesProtected = capturedFireflies.length - firefliesLost;
  
  // Apply protection results
  if (firefliesLost > 0) {
    score -= firefliesLost;
    deliveryStreak = 0; // Break streak when losing fireflies
    releaseCapturedFireflies(firefliesLost);
  }
  
  // Shield consumed after use
  shieldActive = false;
  stopShieldShimmer(); // Stop the shimmer
  shieldCooldown = CFG.shieldCooldown + getDifficulty() * 4;
  
  // Audio feedback based on timing
  const soundFreqs = { "PERFECT": 300, "GREAT": 250, "GOOD": 200, "LATE": 180 };
  playTone(soundFreqs[timingQuality], 0.2, 0.12);
  
  // Visual feedback handled by timing messages
  clearShieldFeedback();
  
  // Tutorial progression - advance after successful shield use
  if (!tutorialComplete && tutorialStep === 2 && firefliesProtected > 0) {
    tutorialStep = 3; // Move to resource management tutorial
    tutorialMissedShield = false; // Reset missed shield flag
  }
};

// No shield protection - simplified penalty system
const handleNoPenalty = (capturedFireflies) => {
  // Lose most fireflies - escalating penalty based on difficulty
  const baseLossRate = 0.75; // Start with 75% loss
  const difficultyMultiplier = 1 + (getDifficulty() * 0.05); // Up to 1.25x at high scores
  const lossRate = Math.min(0.95, baseLossRate * difficultyMultiplier); // Cap at 95%
  
  const firefliesLost = Math.ceil(capturedFireflies.length * lossRate);
  const firefliesSaved = capturedFireflies.length - firefliesLost;
  
  score -= firefliesLost;
  deliveryStreak = 0; // Break streak when losing fireflies
  totalLost += firefliesLost;
  
  // Show what happened with single, clear message
  clearShieldFeedback();
  
  if (firefliesLost > 0) {
    addScoreText('NO SHIELD!', w / 2, h / 2 - 80, '#ff9999', 300);
  } else {
    addScoreText('NO LOSS', w / 2, h / 2 - 60, "#99ff99", 180);
  }
  
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
  
  // Progressive difficulty for 5-minute game - more aggressive progression
  let minTime = 540, maxTime = 900; // 9-15 seconds base (shorter for 5min game)
  
  if (gameMinutes > 1) { // Start difficulty increase earlier
    const midGameFactor = Math.min(1, (gameMinutes - 1) / 2); // Faster progression
    minTime = F(540 - (240 * midGameFactor)); // Down to 5 seconds
    maxTime = F(900 - (360 * midGameFactor)); // Down to 9 seconds
  }
  
  if (gameMinutes > 3) { // Late game starts at 3 minutes (60% through 5min game)
    const lateGameFactor = Math.min(1, (gameMinutes - 3) / 2); // Intense final phase
    minTime = F(300 - (120 * lateGameFactor)); // Down to 3 seconds
    maxTime = F(540 - (240 * lateGameFactor)); // Down to 5 seconds
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

// Draw the delivery zone near Nyx Felis
const drawDeliveryZone = (now) => {
  const centerX = w / 2;
  const centerY = h * 0.2; // Match Nyx's nose position
  const radius = 50; // Delivery zone radius for text positioning
  const requiredFireflies = getReqFireflies();
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
    const isTimingMessage = text.text.includes('TIMING') || text.text.includes('PERFECT') || text.text.includes('SUCCESS') || text.text.includes('NO SHIELD') || text.text.includes('MISSED');
    
    let fontSize;
    if (isShortNumeric) {
      // Dynamic font size for numbers: starts large (24px) and shrinks to normal (16px)
      const startSize = 24;
      const endSize = 16;
      fontSize = Math.floor(startSize - (startSize - endSize) * progress);
    } else if (isTimingMessage) {
      // Much larger, more prominent text for timing feedback
      fontSize = 36; // Very large and prominent
    } else {
      // Keep consistent size for other text messages
      fontSize = 16;
    }
    
    const fontFamily = isTimingMessage ? FONTS.body : FONTS.mono;
    
    setFill(text.color + Math.floor(alpha * 255).toString(16).padStart(2, '0'));
    x.font = `${fontSize}px ${fontFamily}`;
    x.textAlign = "center";
    
    // Much slower movement for timing messages, moderate for others
    const moveSpeed = isTimingMessage ? 0.1 : 0.3;
    x.fillText(text.text, text.x, text.y - text.life * moveSpeed);
    
    text.life++;
  });
  
  // Remove expired texts
  scoreTexts = scoreTexts.filter(text => text.life < text.maxLife);
};

// ===== FIREFLIES SYSTEM =====

// Spawn a new firefly at random location
const spawnFirefly = () => {
  if (otherFireflies.length >= CFG.maxFireflies) return;
  
  // Firefly type system for strategic depth
  let type, color, points, rarity;
  const roll = Math.random();
  
  if (roll < 0.05) { // 5% chance - Rare Royal fireflies
    type = 'royal';
    color = '#9966ff'; // Purple
    points = 5;
    rarity = 'rare';
  } else if (roll < 0.20) { // 15% chance - Valuable Golden fireflies  
    type = 'golden';
    color = '#ffdd00'; // Gold
    points = 3;
    rarity = 'uncommon';
  } else if (roll < 0.40) { // 20% chance - Bonus Silver fireflies
    type = 'silver'; 
    color = '#ccccff'; // Silver-blue
    points = 2;
    rarity = 'common';
  } else { // 60% chance - Basic fireflies
    type = 'basic';
    color = '#88ff88'; // Green
    points = 1;
    rarity = 'basic';
  }
  
  otherFireflies.push({
    x: r() * w,
    y: h * 0.5 + r() * h * 0.48, // More vertical space for fireflies (50% to 98% of screen)
    captured: false,
    captureOffset: { x: 0, y: 0 },
    floatTimer: r() * TAU,
    flashTimer: r() * TAU,
    roamTarget: null,
    fadeIn: 0, // For smooth spawning
    glowIntensity: 0.5 + r() * 0.5,
    size: type === 'royal' ? 3 + r() * 2 : 2 + r() * 2, // Royal fireflies are bigger
    type: type,
    color: color,
    points: points,
    rarity: rarity
  });
};

// Update firefly behavior and movement
const updateFireflies = (playerX, playerY) => {
  const speedMultiplier = getSpeedMult();
  const now = Date.now();
  
  // Check if player has been idle too long
  if (now - lastPlayerMoveTime > CFG.idleTimeout) {
    if (!playerIsIdle) {
      playerIsIdle = true;
    }
    
    // Disperse fireflies while idle - much higher rate
    if (Math.random() < 0.02) { // 2% chance per frame = ~1 firefly per second at 60fps
      const capturedFireflies = otherFireflies.filter(f => f.captured);
      if (capturedFireflies.length > 0) {
        const randomFirefly = capturedFireflies[Math.floor(Math.random() * capturedFireflies.length)];
        randomFirefly.captured = false;
        randomFirefly.captureOffset = null;
        
        // Give it velocity to fly away quickly
        const disperseAngle = Math.random() * TAU;
        const disperseSpeed = 5 + Math.random() * 3; // Faster dispersal
        randomFirefly.vx = Math.cos(disperseAngle) * disperseSpeed;
        randomFirefly.vy = Math.sin(disperseAngle) * disperseSpeed;
        
        // Add particle effect
        createDispersalEffect(randomFirefly);
      }
    }
  }
  
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
    
    // Handle newly spawned effect countdown
    if (firefly.newlySpawned > 0) {
      firefly.newlySpawned--;
    }
  });
};

// Update behavior for captured fireflies
const updateCapturedFirefly = (firefly, playerX, playerY) => {
  // Ensure captureOffset exists (fix for null reference crash)
  if (!firefly.captureOffset) {
    firefly.captureOffset = { x: 0, y: 0 };
  }
  
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
  
  // Handle dispersal velocity (from idle dispersal or other effects)
  if (firefly.vx !== undefined && firefly.vy !== undefined) {
    firefly.x += firefly.vx;
    firefly.y += firefly.vy;
    
    // Apply friction to slow down over time
    firefly.vx *= 0.92;
    firefly.vy *= 0.92;
    
    // Remove velocity when it gets very small
    if (Math.abs(firefly.vx) < 0.1 && Math.abs(firefly.vy) < 0.1) {
      firefly.vx = undefined;
      firefly.vy = undefined;
    }
    
    // Skip normal roaming while dispersing
    if (firefly.vx !== undefined) return;
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
      y: h * 0.5 + r() * h * 0.48, // More vertical space for fireflies
    };
  }
  
  // Move toward roam target
  const dx = firefly.roamTarget.x - firefly.x;
  const dy = firefly.roamTarget.y - firefly.y;
  const distance = hyp(dx, dy);
  
  if (distance > 5) {
    // Rare fireflies move faster (risk/reward balance)
    const typeSpeedMultiplier = {
      'royal': 2.0,    // Royal fireflies are very fast
      'golden': 1.5,   // Golden fireflies are faster  
      'silver': 1.2,   // Silver fireflies are slightly faster
      'basic': 1.0     // Basic fireflies normal speed
    };
    const typeMultiplier = typeSpeedMultiplier[firefly.type] || 1.0;
    const speed = (0.3 + r() * 0.2) * speedMultiplier * typeMultiplier;
    firefly.x += (dx / distance) * speed;
    firefly.y += (dy / distance) * speed;
  }
  
  // Add gentle floating wobble
  firefly.x += sin(firefly.floatTimer) * 0.2 * speedMultiplier;
  firefly.y += cos(firefly.floatTimer * 1.3) * 0.15 * speedMultiplier;
  
  // Keep fireflies in bounds
  firefly.x = clamp(firefly.x, 20, w - 20);
  firefly.y = clamp(firefly.y, h * 0.5, h - 20); // Allow floating higher for more space
};

// Capture a firefly
const captureFirefly = (firefly, playerX, playerY) => {
  firefly.captured = true;
  // Ensure captureOffset exists (fix for null reference crash)
  if (!firefly.captureOffset) {
    firefly.captureOffset = { x: 0, y: 0 };
  }
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
    
    // Dynamic firefly colors based on type
    let bodyColor, glowColor, rgbValues;
    
    if (firefly.captured) {
      // Captured fireflies turn magical blue regardless of type
      rgbValues = '120, 180, 255';
      bodyColor = `rgba(${rgbValues}, ${visibility * alpha})`;
      glowColor = `rgba(150, 200, 255, ${visibility * alpha * 0.8})`;
    } else {
      // Use firefly's natural color when free
      const hex = firefly.color || '#88ff88';
      // Convert hex to RGB for alpha blending
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16); 
      const b = parseInt(hex.slice(5, 7), 16);
      rgbValues = `${r}, ${g}, ${b}`;
      
      bodyColor = `rgba(${rgbValues}, ${visibility * alpha})`;
      glowColor = `rgba(${Math.min(255, r + 30)}, ${Math.min(255, g + 30)}, ${Math.min(255, b + 30)}, ${visibility * alpha * 0.8})`;
    }
    
    // Gentle floating movement
    const floatX = firefly.x + sin(firefly.floatTimer) * 0.8;
    const floatY = firefly.y + cos(firefly.floatTimer * 1.1) * 0.6;
    
    // Enhanced multi-layer glow for more magical effect
    const baseGlowRadius = firefly.size * 3;
    let maxGlowRadius = firefly.size * 8; // Increased for more magic
    
    // Extra glow for newly spawned fireflies  
    if (firefly.newlySpawned > 0) {
      const newSpawnBoost = firefly.newlySpawned / 60; // 0 to 1 over 60 frames
      maxGlowRadius += firefly.size * 4 * newSpawnBoost; // Extra glow that fades
    }
    
    const currentGlowRadius = baseGlowRadius + (maxGlowRadius - baseGlowRadius) * visibility;
    
    // Outer magical glow - larger and more ethereal
    const outerGradient = x.createRadialGradient(
      floatX, floatY, 0,
      floatX, floatY, currentGlowRadius
    );
    outerGradient.addColorStop(0, glowColor);
    outerGradient.addColorStop(0.2, `rgba(${rgbValues}, ${visibility * alpha * 0.4})`);
    outerGradient.addColorStop(0.5, `rgba(${rgbValues}, ${visibility * alpha * 0.15})`);
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
  const centerY = h * 0.2; // Match Nyx's nose position
  const distance = hyp(playerX - centerX, playerY - centerY);
  
  if (distance < CFG.deliveryRadius) {
    const capturedFireflies = otherFireflies.filter(f => f.captured);
    const requiredFireflies = getReqFireflies();
    
    if (capturedFireflies.length >= requiredFireflies) {
      deliverFireflies(capturedFireflies);
      return true;
    }
  }
  
  return false;
};

// Deliver captured fireflies to Nyx Felis
const deliverFireflies = (capturedFireflies) => {
  // Track delivery time for curiosity system
  lastDeliveryTime = Date.now();
  
  // Streak bonus system
  deliveryStreak++;
  bestStreak = Math.max(bestStreak, deliveryStreak);
  
  // Enhanced scoring system with firefly types
  const basePoints = capturedFireflies.reduce((sum, firefly) => sum + (firefly.points || 1), 0);
  const streakMultiplier = Math.min(3, 1 + (deliveryStreak - 1) * 0.5);
  const pointsAwarded = Math.floor(basePoints * streakMultiplier);
  
  score += pointsAwarded;
  
  // Show point breakdown for valuable fireflies
  const rareCounts = capturedFireflies.reduce((counts, firefly) => {
    counts[firefly.type || 'basic'] = (counts[firefly.type || 'basic'] || 0) + 1;
    return counts;
  }, {});
  
  // Display special firefly bonuses
  // Remove floating text for rare firefly bonuses - reduce visual clutter
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
  
  playTone(600, 0.3, 0.12); // Delivery success sound
  
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
      // Just end the feedback without showing count
      summonFeedback.active = false;
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
      stopShieldShimmer(); // Stop the shimmer
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

// Draw the player firefly (Lampyris)
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
    // Beautiful magical blue firefly - special Lampyris species
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
  
  // Shield indicator - glowing protective cloud
  if (shieldActive) {
    const time = now * 0.003;
    const pulse = sin(time * 2) * 0.2 + 0.8;
    
    // Multiple layers of glowing cloud particles
    for (let layer = 0; layer < 3; layer++) {
      const layerRadius = 20 + layer * 8;
      const layerAlpha = (0.4 - layer * 0.1) * pulse;
      const particleCount = 12 - layer * 2;
      
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * TAU + time * (1 + layer * 0.3);
        const radius = layerRadius + sin(time * 3 + i + layer) * 4;
        const particleX = playerX + cos(angle) * radius;
        const particleY = playerY + sin(angle) * radius;
        const size = 4 + layer * 2 + sin(time * 4 + i) * 1;
        
        // Whitish-purple glowing particles
        x.shadowColor = layer === 0 ? '#ffffff' : '#dd99ff';
        x.shadowBlur = 8 + layer * 4;
        const color = layer === 0 ? `rgba(255, 255, 255, ${layerAlpha})` : 
                     layer === 1 ? `rgba(220, 180, 255, ${layerAlpha})` :
                                   `rgba(180, 120, 255, ${layerAlpha})`;
        setFill(color);
        x.beginPath();
        x.arc(particleX, particleY, size, 0, TAU);
        x.fill();
        x.shadowBlur = 0;
      }
    }
    
    // Bright central glow
    const gradient = x.createRadialGradient(playerX, playerY, 0, playerX, playerY, 25);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${pulse * 0.6})`);
    gradient.addColorStop(0.5, `rgba(220, 180, 255, ${pulse * 0.3})`);
    gradient.addColorStop(1, "transparent");
    setFill(gradient);
    x.beginPath();
    x.arc(playerX, playerY, 25, 0, TAU);
    x.fill();
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
    let alpha = 1 - progress;
    let size = particle.size * (1 - progress * 0.3); // Less size reduction for longer shimmer
    
    // Add twinkling effect if particle has twinkle property
    if (particle.twinkle !== undefined) {
      particle.twinkle += 0.08; // Gentle twinkling speed
      const twinkleIntensity = (sin(particle.twinkle) * 0.4 + 0.6); // 0.2 to 1.0 range
      alpha *= twinkleIntensity;
      size *= (0.8 + twinkleIntensity * 0.2); // Subtle size variation
    }
    
    if (particle.glow) {
      // Brighter magical glow with larger radius for more impact
      const glowSize = size * 4; // Larger glow for more visibility
      const gradient = x.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, glowSize
      );
      gradient.addColorStop(0, particle.color + Math.floor(alpha * 220).toString(16).padStart(2, '0')); // Brighter glow
      gradient.addColorStop(0.5, particle.color + Math.floor(alpha * 120).toString(16).padStart(2, '0'));
      gradient.addColorStop(0.8, particle.color + Math.floor(alpha * 40).toString(16).padStart(2, '0'));
      gradient.addColorStop(1, "transparent");
      
      setFill(gradient);
      x.beginPath();
      x.arc(particle.x, particle.y, glowSize, 0, TAU);
      x.fill();
    }
    
    // Brighter sparkle core
    setFill(particle.color + Math.floor(alpha * 255).toString(16).padStart(2, '0'));
    x.beginPath();
    x.arc(particle.x, particle.y, size * 0.8, 0, TAU); // Larger, more visible core
    x.fill();
  });
  
  // Draw click sparkles
  clickSparkles.forEach(sparkle => {
    const progress = sparkle.life / sparkle.maxLife;
    const alpha = 1 - progress;
    const size = sparkle.size * (1 - progress * 0.3);
    
    // Colorful sparkles that match the magical theme
    const sparkleColors = ['#aaccff', '#ccaaff', '#88aaff', '#aa88ff'];
    const colorIndex = Math.floor(sparkle.life / 5) % sparkleColors.length; // Cycle colors
    const color = sparkleColors[colorIndex];
    
    setFill(color + Math.floor(alpha * 255).toString(16).padStart(2, '0'));
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
  // Immediate click feedback sparkles - more visible
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * TAU + r() * 0.4;
    clickSparkles.push({
      x: x + (r() - 0.5) * 12, // Wider spread
      y: y + (r() - 0.5) * 12,
      vx: cos(angle) * (1 + r() * 1.5), // Faster for more impact
      vy: sin(angle) * (1 + r() * 1.5) - 0.4,
      size: 0.8 + r() * 1.0, // Bigger sparkles
      life: 0,
      maxLife: 35 + r() * 20, // Last longer to be more visible
    });
  }
};

// Failed summon effect (gray sputter when out of mana)
const createFailedSummonEffect = (x, y) => {
  // Get player position for gentle effect
  const { x: playerX, y: playerY } = getPlayerPosition();
  
  // Gentle dimming sparkles around player (out of energy)
  for (let i = 0; i < 5; i++) {
    const angle = r() * TAU;
    const speed = 0.1 + r() * 0.3; // Very slow
    particles.push({
      x: playerX + cos(angle) * (2 + r() * 6), // Close to player
      y: playerY + sin(angle) * (2 + r() * 6),
      vx: cos(angle) * speed,
      vy: sin(angle) * speed + 0.1, // Gentle downward drift (energy fading)
      size: 0.2 + r() * 0.3, // Very small
      life: 0,
      maxLife: 40 + r() * 20,
      color: "#556677", // Dim blue-gray (exhausted energy)
      glow: false,
      twinkle: r() * TAU,
    });
  }
};

// Summoning effect for new fireflies
const createSummonEffect = (x, y) => {
  // Get player position for magical burst effect
  const { x: playerX, y: playerY } = getPlayerPosition();
  
  // Main burst of magical sparkles around the player - bigger area, more particles
  for (let i = 0; i < 25; i++) {
    const angle = r() * TAU;
    const distance = 12 + r() * 35; // Wider spread for more impact
    const speed = 0.8 + r() * 2.2; // Faster for more dynamic feel
    particles.push({
      x: playerX + cos(angle) * (5 + r() * 15), // Wider starting area
      y: playerY + sin(angle) * (5 + r() * 15),
      vx: cos(angle) * speed,
      vy: sin(angle) * speed - 0.3, // Stronger upward drift
      size: 0.6 + r() * 0.9, // Bigger, more visible sparkles
      life: 0,
      maxLife: 70 + r() * 50, // Good duration for shimmer
      color: i < 8 ? "#88aaff" : (i < 16 ? "#aa88ff" : "#6688ff"), // Blue and purple mix
      glow: true,
      twinkle: r() * TAU, // Twinkling magic
    });
  }
  
  // Bright center burst at spawn location 
  for (let i = 0; i < 12; i++) {
    const angle = r() * TAU;
    const speed = 0.5 + r() * 1.2;
    particles.push({
      x: x + (r() - 0.5) * 8, // Slightly wider spawn spread
      y: y + (r() - 0.5) * 8,
      vx: cos(angle) * speed,
      vy: sin(angle) * speed - 0.2,
      size: 0.4 + r() * 0.6, // Visible but not huge
      life: 0,
      maxLife: 80 + r() * 40,
      color: i < 4 ? "#bbccff" : (i < 8 ? "#ccbbff" : "#aabbff"), // Bright blue/purple variants
      glow: true,
      twinkle: r() * TAU,
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
  lastPlayerMoveTime = Date.now(); // Track for idle dispersal
  playerIsIdle = false;
  charging = true; // Auto-charge when moving
};

// Mouse down handler
const handleMouseDown = (e) => {
  // Initialize audio on first user gesture
  startAudioOnUserGesture();
  
  // Don't process input when screen is too small
  if (isScreenTooSmall) return;
  
  // Reset idle timer on any interaction
  lastPlayerMoveTime = Date.now();
  playerIsIdle = false;
  
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
    // Only start charging if we can't summon (avoid showing during summoning clicks)
    if (!canSummon() && manaEnergy > 0 && !shieldActive && shieldCooldown === 0 && !summonOverheated) {
      shieldCharging = true;
    }
    
    setTimeout(() => {
      if (mousePressed && (Date.now() - mouseDownTime) >= HOLD_THRESHOLD) {
        // Still holding after delay - it's a hold action
        if (manaEnergy > 0 && !shieldActive && shieldCooldown === 0 && !summonOverheated) {
          activateShield(true); // true = hold action, play hum
        }
      }
      shieldCharging = false; // Stop charging when threshold is reached
    }, HOLD_THRESHOLD);
  }
  
  // Create delicate click feedback (no sound yet - wait for mouse up)
  createClickEffect(mx, my);
};

// Mouse up handler  
const handleMouseUp = (e) => {
  // Don't process input when screen is too small
  if (isScreenTooSmall) return;
  
  if (!gameStarted || gameOver) return;
  
  const holdDuration = Date.now() - mouseDownTime;
  mousePressed = false;
  shieldCharging = false; // Always stop charging on mouse up
  
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
          stopShieldShimmer();
          shieldCooldown = 0; // No cooldown for taps
        }
      }, 100);
    } else {
      // Can't summon or shield - show failure feedback
      createFailedSummonEffect(mx, my);
      playTone(150, 0.15, 0.04); // Dull error sound
    }
  }
  
  hasPlayedChime = false; // Reset for next activation
};

// Keyboard handler
const handleKeyDown = (e) => {
  // Initialize audio on first user gesture
  startAudioOnUserGesture();
  
  // Reset idle timer on any interaction
  lastPlayerMoveTime = Date.now();
  playerIsIdle = false;
  
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
      stopShieldShimmer(); // Also stop shield shimmer when audio disabled
    }
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

  
  // Shield with spacebar
  if (e.code === "Space") {
    e.preventDefault();
    if (!gameStarted) {
      gameStarted = true;
      return;
    }
    
    // Only activate shield once when space is first pressed
    if (!spacePressed && canShield()) {
      // Only start charging if we can't summon (avoid showing during summoning)
      if (!canSummon() && manaEnergy > 0 && !shieldActive && shieldCooldown === 0 && !summonOverheated) {
        shieldCharging = true;
      }
      
      spaceActivationTime = Date.now();
      shieldActivationTime = spaceActivationTime; // Track this specific activation
      hasPlayedChime = false; // Reset chime flag
      
      // Delay shield activation to determine if it's a tap or hold
      setTimeout(() => {
        if (spacePressed && shieldActivationTime === spaceActivationTime) {
          // Still holding after delay - it's a hold action
          activateShield(true); // true = hold action, play hum
        }
        shieldCharging = false; // Stop charging when threshold is reached
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
    shieldCharging = false; // Always stop charging on key up
    
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
            stopShieldShimmer();
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
const canSummon = () => manaEnergy >= 10;
const canShield = () => manaEnergy > 0 && shieldCooldown === 0 && !summonOverheated;

const summonFirefly = () => {
  if (!canSummon()) {
    return;
  }
  
  // Consume mana
  manaEnergy = Math.max(0, manaEnergy - 10);
  
  // Only overheat when mana hits 0
  if (manaEnergy === 0 && !summonOverheated) {
    summonOverheated = true;
    overheatStunned = true;
    overheatCooldown = 180; // 3 seconds of cooldown (60fps * 3)
    addScoreText("OUT OF MANA!", mx, my - 30, "#ff4444", 300);
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
      }
    });
  }
  
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
    y: clamp(spawnY, h * 0.5, h - 50), // Higher spawn area for more room
    captured: false,
    captureOffset: { x: 0, y: 0 },
    floatTimer: r() * TAU,
    flashTimer: r() * TAU,
    roamTarget: null,
    fadeIn: 0,
    glowIntensity: 1.5 + r() * 0.5, // Start with stronger glow
    size: 3 + r() * 2, // Slightly bigger
    newlySpawned: 60, // Frames to show as "new" with extra effects
  });
  
  createSummonEffect(spawnX, spawnY);
  playTone(400, 0.15, 0.06); // Back to original tone
  quickFlashPower = 40; // Gentle flash
  screenShake = Math.min(screenShake + 1, 3); // Very subtle shake
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
  stopShieldShimmer(); // Stop any shield sounds
  shieldCooldown = 0;
  lastShieldTime = 0;
  
  // Reset and restart music
  if (audioEnabled && pageVisible) {
    fadeBgMusic(0.22, 1); // Restore normal music volume
  }
  
  // Reset tutorial - but preserve completion status from localStorage
  const wasTutorialCompleted = localStorage.getItem('tutorialComplete') === 'true';
  tutorialComplete = wasTutorialCompleted; // Don't force tutorial replay if already completed
  tutorialStep = wasTutorialCompleted ? 999 : 0; // Skip tutorial steps if already completed
  tutorialStep1Timer = 0; // Reset step 1 timer
  tutorialStep3Timer = 0; // Reset step 3 timer
  tutorialStep4Timer = 0; // Reset step 4 timer
  tutorialMissedShield = false; // Reset missed shield flag
  firstDeliveryMade = false;
  showTutorialElements = !wasTutorialCompleted; // Only show tutorial elements for new players
  
  // Reset timing
  startTime = Date.now();
  runStartTime = Date.now();
  lastDeliveryTime = Date.now(); // Reset delivery timer to prevent immediate game over
  totalHelpPauseTime = 0; // Reset help menu pause time
  helpOpenTime = 0;
  lastSpawnTime = Date.now(); // Reset spawn timer
  
  // Spawn initial fireflies - generous starting counts for engaging gameplay
  let spawnCount;
  if (tutorialComplete) {
    spawnCount = 35; // Much more fireflies for experienced players
  } else if (tutorialStep === 0) {
    spawnCount = 12; // More fireflies for initial tutorial experience
  } else {
    spawnCount = 20; // More fireflies during tutorial steps
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
      x.font = `20px ${FONTS.body}`;
      x.fillText("Collect fireflies and lead them to Nyx Felis in the Sky", w / 2, h - 180);
      
      // Highlight delivery pressure timer
      setFill(`rgba(100, 255, 100, ${pulse})`); // Green for input
      x.fillText("Move your mouse", w / 2, h - 155);
      
      setFill(`rgba(255, 255, 100, ${pulse})`); // Yellow for tip
      x.font = `16px ${FONTS.body}`;
      x.fillText("Watch the green bar at bottom - it shows time until curiosity decays!", w / 2, h - 130);
      
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
      x.font = `20px ${FONTS.body}`;
      x.fillText("Your bioluminescence attracts fireflies.", w / 2, h - 180);
      
      setFill(`rgba(100, 255, 100, ${pulse})`); // Green for input
      x.fillText("Click to summon more fireflies", w / 2, h - 155);
      
      setFill(`rgba(255, 255, 100, ${pulse})`); // Yellow for tip
      x.font = `16px ${FONTS.body}`;
      x.fillText("Notice: Different colored fireflies give different points!", w / 2, h - 130);
      break;
      
    case 1.5:
      // Mana depletion explanation - when mana hits 0
      setFill(`rgba(255, 255, 255, ${pulse})`);
      x.font = `18px ${FONTS.body}`;
      x.fillText("OUT OF MANA! Your magical energy is depleted.", w / 2, h - 180);
      x.fillText("Wait for your power to recharge before summoning more.", w / 2, h - 155);
      
      setFill(`rgba(255, 255, 100, ${pulse})`); // Yellow for tip
      x.fillText("Tip: Turn in fireflies regularly to restore mana faster!", w / 2, h - 130);
      break;
      
    case 2:
      // Shield mechanics - after summoning and learning about mana
      setFill(`rgba(100, 255, 100, ${pulse})`); // Green for input
      x.font = `20px ${FONTS.body}`;
      x.fillText("Hold SPACE or MOUSE when its eyes flash!", w / 2, h - 180);
      
      setFill(`rgba(255, 255, 255, ${pulse})`);
      x.font = `18px ${FONTS.body}`;
      x.fillText("Watch Nyx's eyes carefully.", w / 2, h - 155);
      
      if (tutorialMissedShield) {
        setFill(`rgba(255, 100, 100, ${pulse})`); // Red for emphasis
        x.font = `16px ${FONTS.body}`;
        x.fillText("Shield protects your fireflies from Nyx's hunger", w / 2, h - 130);
      }
      break;
      
    case 3:
      // Resource management warning
      setFill(`rgba(255, 255, 255, ${pulse})`);
      x.font = `20px ${FONTS.body}`;
      x.fillText("Overuse your powers and they'll abandon you", w / 2, h - 140);
      x.fillText("Manage resources carefully. The night is long and unforgiving", w / 2, h - 75);
      break;
      
    case 4:
      // Mana restoration step
      setFill(`rgba(100, 255, 255, ${pulse})`);
      x.font = `20px ${FONTS.body}`;
      x.fillText("Energy restored! You're ready for the challenge.", w / 2, h - 140);
      x.fillText("Remember: Turn in fireflies to restore your power", w / 2, h - 75);
      break;
      
    case 5:
      // Final warning before full gameplay
      setFill(`rgba(255, 255, 255, ${pulse})`);
      x.font = `20px ${FONTS.body}`;
      x.fillText("Now... survive until dawn. If you can", w / 2, h - 140);
      
      setFill(`rgba(255, 100, 100, ${pulse})`); // Red for warning
      x.font = `16px ${FONTS.body}`;
      x.fillText("WARNING: Watch the pressure timer! Deliver before it turns red!", w / 2, h - 75);
      x.fillText("Missing deadlines or losing fireflies breaks your streak!", w / 2, h - 55);
      
      setFill(`rgba(100, 255, 100, ${pulse})`); // Green for input
      x.font = `14px ${FONTS.body}`;
      x.fillText("Press 'ESC' if you need reminding of the rules", w / 2, h - 30);
      break;
      
    case 6:
      // Tutorial completion message
      setFill(`rgba(100, 255, 100, ${pulse})`);
      x.font = `22px ${FONTS.body}`;
      x.fillText("Tutorial Complete! Survive the night...", w / 2, h - 140);
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
  setTitleFont(32);
  x.shadowColor = "#9a9be9";
  x.shadowBlur = 15;
  x.fillText("Nyx Felis and Lampyris", centerX, centerY - 120);
  x.shadowBlur = 0;
  
  // Main message
  setFill("#ffffff");
  x.font = `24px ${FONTS.body}`;
  
  if (isMobileDevice()) {
    x.fillText("This mystical experience requires", centerX, centerY - 60);
    x.fillText("a desktop or laptop computer", centerX, centerY - 30);
  } else {
    x.fillText("Please resize your browser window", centerX, centerY - 60);
    x.fillText("to enjoy the full experience", centerX, centerY - 30);
  }
  
  // Requirements
  setFill("#cccccc");
  x.font = `18px ${FONTS.body}`;
  if (!isMobileDevice()) {
    x.fillText(`Minimum: ${MIN_WIDTH} × ${MIN_HEIGHT} pixels`, centerX, centerY + 20);
    
    // Current size info
    setFill("#999999");
    x.font = `16px ${FONTS.body}`;
    x.fillText(`Current: ${w} × ${h} pixels`, centerX, centerY + 50);
  }
  
  // Instructions
  setFill("#69e4de");
  x.font = `20px ${FONTS.body}`;
  x.shadowColor = "#69e4de";
  x.shadowBlur = 8;
  
  if (isMobileDevice()) {
    x.fillText("Please use a desktop or laptop computer", centerX, centerY + 100);
    x.fillText("for the optimal gameplay experience", centerX, centerY + 130);
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
  
  // Darker semi-transparent overlay
  setFill(BLACK(0.9));
  x.fillRect(0, 0, w, h);
  
  x.save();
  
  // Title - larger, different color, elegant serif
  x.textAlign = "center";
  setFill("#d4af37"); // Gold color to distinguish from body text
  x.font = `42px ${FONTS.title}`;
  x.shadowColor = "#d4af37";
  x.shadowBlur = 8;
  x.fillText("Nyx Felis and Lampyris", w / 2, h * 0.08);
  x.shadowBlur = 0;
  
  // Content area setup with tighter spacing
  const contentStartY = h * 0.08 + 50; // Less space after title
  const lineHeight = 28; // Increased line height for better readability
  
  const rules = [
    "CONTROLS:",
    "- Move mouse to guide Lampyris and collect fireflies",
    "- Click rapidly to summon fireflies (costs bioluminescence/mana) - spam click for more!",
    "- Press and hold to activate protective shield (costs bioluminescence/mana)",
    `- ESC for help menu • M - Audio: ${audioEnabled ? 'ON' : 'OFF'}`,
    "",
    "OBJECTIVE:",
    "- Collect fireflies and deliver them to Nyx Felis in the Sky",
    "- Different fireflies give different points: Basic(1), Silver(2), Gold(3), Royal(5)",
    "- Watch delivery pressure timer (bottom) - Green→Yellow→Red shows time until decay", 
    "- Deliver before timer reaches red (15 second deadline) or curiosity drops!",
    "- Survive until dawn (3 minutes) and live to see another night",
    "- Build delivery streaks for score multipliers (up to 300%!) - but streaks break on failure!",
    "",
    "DANGER:",
    "- When Nyx's eyes begin to shift and change colors, be prepared",
    "- PERFECT timing (white flash) protects ALL fireflies in view",
    "- Good timing (yellow/green) saves most captured fireflies",
    "- Even without shield, some fireflies may escape to safety",
    "- If Nyx's curiosity reaches -50, she loses interest and you lose!",
    "",
    "STRATEGY:",
    "- Manage bioluminescence (mana) wisely - summoning and shields cost energy",
    "- Only overheats when bioluminescence (mana) reaches zero - click rapidly!", 
    "- Master perfect shield timing for maximum protection",
    "- Risk vs reward: collect more fireflies vs deliver safely before deadline",
    "- Keep moving! Idle too long and fireflies disperse",
    "- Rare fireflies (Gold/Royal) move faster but give more points",
    "- Protect your delivery streak - losing fireflies or missing deadlines breaks it!",
    "- Watch both the pressure timer AND Nyx's eyes - timing is everything!"
  ];
  
  // Create clipping region for scrollable content
  x.save();
  const contentTop = contentStartY;
  const contentHeight = h - contentTop - 120; // More space for close instruction
  x.beginPath();
  x.rect(0, contentTop - 20, w, contentHeight + 20);
  x.clip();
  
  rules.forEach((rule, i) => {
    const y = contentTop + i * lineHeight - helpScrollOffset;
    
    // Only render lines that are visible
    if (y > contentTop - 40 && y < contentTop + contentHeight + 40) {
      x.textAlign = "center";
      
      if (rule === "CONTROLS:" || rule === "OBJECTIVE:" || rule === "DANGER:" || rule === "STRATEGY:") {
        // Section headers - dusty pastel orange, minimal glow
        setFill("#ce6d54");
        x.shadowColor = "#ce6d54";
        x.shadowBlur = 1; // Very minimal glow
        x.font = `bold 22px ${FONTS.body}`;
        x.fillText(rule, w / 2, y);
      } else if (rule.startsWith("- ")) {
        // Bullet points - clean white, no glow
        setFill("#ffffff");
        x.shadowBlur = 0;
        x.font = `16px ${FONTS.body}`;
        x.fillText(rule, w / 2, y);
      } else if (rule !== "") {
        // Description text - same size as bullets, soft gray
        setFill("#cccccc");
        x.shadowBlur = 0;
        x.font = `16px ${FONTS.body}`;
        x.fillText(rule, w / 2, y);
      }
      x.shadowBlur = 0;
    }
  });
  
  x.restore(); // Restore clipping
  
  // Scroll calculation with new line height
  const totalContentHeight = rules.length * lineHeight;
  const maxScroll = Math.max(0, totalContentHeight - contentHeight + 60);
  
  // Update max scroll based on actual content
  if (maxScroll !== 400) {
    // Store the proper max scroll for wheel handler
    window.helpMaxScroll = maxScroll;
  }
  
  // Show scroll indicators if content is scrollable
  if (maxScroll > 0) {
    x.textAlign = "center";
    x.font = `14px ${FONTS.body}`;
    
    if (helpScrollOffset > 0) {
      // Background for scroll up text
      const upText = "↑ Scroll up (Arrow keys/Mouse wheel)";
      const upMetrics = x.measureText(upText);
      const upY = contentTop - 10;
      
      // Draw semi-transparent background
      setFill("rgba(16, 16, 32, 0.8)");
      x.fillRect(w / 2 - upMetrics.width / 2 - 10, upY - 18, upMetrics.width + 20, 24);
      
      // Draw text with enhanced shadow
      setFill("#7fc2a4");
      x.shadowColor = "rgba(0, 0, 0, 0.8)";
      x.shadowBlur = 3;
      x.shadowOffsetY = 1;
      x.fillText(upText, w / 2, upY);
    }
    if (helpScrollOffset < maxScroll) {
      // Background for scroll down text
      const downText = "↓ Scroll down (Arrow keys/Mouse wheel)";
      const downMetrics = x.measureText(downText);
      const downY = contentTop + contentHeight + 20;
      
      // Draw semi-transparent background
      setFill("rgba(16, 16, 32, 0.8)");
      x.fillRect(w / 2 - downMetrics.width / 2 - 10, downY - 18, downMetrics.width + 20, 24);
      
      // Draw text with enhanced shadow
      setFill("#7fc2a4");
      x.shadowColor = "rgba(0, 0, 0, 0.8)";
      x.shadowBlur = 3;
      x.shadowOffsetY = 1;
      x.fillText(downText, w / 2, downY);
    }
    
    // Reset shadow effects
    x.shadowBlur = 0;
    x.shadowOffsetY = 0;
  }
  
  // Close instruction - cleaner styling
  x.textAlign = "center";
  setFill("#9a9695");
  x.shadowColor = "#9a9695";
  x.shadowBlur = 1;
  x.font = `18px ${FONTS.body}`;
  x.fillText("Press ESC or click to close", w / 2, h - 50);
  x.shadowBlur = 0;
  
  x.restore();
};

// Draw unified game over/victory screen
const drawGameOverScreen = () => {
  if (!gameOver && !gameWon) return;
  
  // Calculate survival time
  let gameTime, gameMinutes, gameSeconds, timeString;
  if (gameWon) {
    gameTime = NIGHT_DURATION;
    gameMinutes = Math.floor(gameTime / 60000);
    gameSeconds = Math.floor((gameTime % 60000) / 1000);
    timeString = `${gameMinutes}:${gameSeconds.toString().padStart(2, '0')}`;
  } else {
    gameTime = gameOverTime ? (gameOverTime - (startTime || gameOverTime)) : 0;
    gameMinutes = Math.floor(gameTime / 60000);
    gameSeconds = Math.floor((gameTime % 60000) / 1000);
    timeString = `${gameMinutes}:${gameSeconds.toString().padStart(2, '0')}`;
  }
  
  // Simplified final score calculation
  const finalScore = gameWon ? score + 1000 + (bestStreak * 50) : score;
  
  // Dark overlay
  setFill(BLACK(0.9));
  x.fillRect(0, 0, w, h);
  
  x.save();
  x.textAlign = "center";
  
  let currentY = h / 2 - 120;
  
  // Title
  if (gameWon) {
    setFill("#22aa22");
    x.font = `52px ${FONTS.title}`;
    x.shadowColor = "#22aa22";
    x.shadowBlur = 12;
    x.fillText("DAWN BREAKS!", w / 2, currentY);
  } else {
    setFill("#aa2222");
    x.font = `52px ${FONTS.title}`;
    x.shadowColor = "#aa2222";
    x.shadowBlur = 12;
    x.fillText("THE LIGHT FADES", w / 2, currentY);
  }
  x.shadowBlur = 0;
  currentY += 70;
  
  // Subtitle
  setFill("#bbbbbb");
  x.font = `20px ${FONTS.body}`;
  if (gameWon) {
    x.fillText("You guided fireflies through the eternal night", w / 2, currentY);
  } else {
    x.fillText("The darkness has claimed the light", w / 2, currentY);
  }
  currentY += 60;
  
  // Core stats - same for both win/loss
  setFill("#ffffff");
  x.font = `24px ${FONTS.body}`;
  
  x.fillText(`Fireflies Delivered: ${totalCollected}`, w / 2, currentY);
  currentY += 40;
  
  if (gameWon || totalLost > 0) {
    setFill("#ffaa66");
    x.fillText(`Fireflies Lost: ${totalLost}`, w / 2, currentY);
    currentY += 40;
  }
  
  setFill("#66aaff");
  x.fillText(`Time Survived: ${timeString}`, w / 2, currentY);
  currentY += 60;
  
  // Final score - use consistent "curiosity" terminology
  if (gameWon) {
    setFill("#44dd44");
    x.font = `32px ${FONTS.title}`;
    x.shadowColor = "#44dd44";
    x.shadowBlur = 8;
    x.fillText(`Final Curiosity: ${finalScore}`, w / 2, currentY);
    x.shadowBlur = 0;
    currentY += 30;
    setFill("#88dd88");
    x.font = `16px ${FONTS.body}`;
    x.fillText("Nyx remains fascinated by your light!", w / 2, currentY);
  } else {
    setFill("#dd4444");
    x.font = `32px ${FONTS.title}`;
    x.shadowColor = "#dd4444";
    x.shadowBlur = 8;
    x.fillText(`Curiosity Lost: ${Math.abs(score)}`, w / 2, currentY);
    x.shadowBlur = 0;
    currentY += 30;
    setFill("#dd8888");
    x.font = `16px ${FONTS.body}`;
    x.fillText("Nyx has grown bored with the darkness", w / 2, currentY);
  }
  
  currentY += 80;
  
  // Restart instruction
  setFill("#888888");
  x.font = `18px ${FONTS.body}`;
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
    x.font = `22px ${FONTS.body}`;
    
    // Draw time at fixed position (right-aligned)
    x.textAlign = "right";
    x.fillText(timeText, w - 20, 30);
    
    // Draw label at fixed position (right-aligned, offset by fixed amount)
    x.fillText("Time: ", w - 80, 30); // Fixed offset of 80px from right edge
  }
  
  // === LEFT SIDE: Mana and Shield (aligned with time) ===
  x.textAlign = "left";
  let leftY = 30; // Start aligned with time display on right
  
  // Mana display (always show) - use fixed cyan for readability
  setFill("#00dddd"); // Cyan color for good contrast against dark sky
  x.font = `18px ${FONTS.body}`;
  x.fillText(`Mana: ${Math.floor(manaEnergy)}`, 20, leftY);
  leftY += 25; // Tighter spacing
  
  // Shield status
  if (shieldActive) {
    setFill("#99ccff");
    x.font = `18px ${FONTS.body}`;
    x.fillText("SHIELD ACTIVE", 20, leftY);
  } else if (shieldCharging) {
    // Pulsing yellow to show charging state
    const chargePulse = sin(Date.now() * 0.01) * 0.3 + 0.7;
    setFill(`rgba(255, 255, 0, ${chargePulse})`);
    x.font = `18px ${FONTS.body}`;
    x.fillText("SHIELD CHARGING...", 20, leftY);
  } else if (shieldCooldown > 0) {
    setFill("#cccccc");
    x.font = `18px ${FONTS.body}`;
    x.fillText(`Shield: ${Math.ceil(shieldCooldown / 60)}s`, 20, leftY);
  } else {
    setFill("#99ff99");
    x.font = `18px ${FONTS.body}`;
    x.fillText("Shield: Ready", 20, leftY);
  }
  leftY += 25; // Tighter spacing
  
  // Streak display (when active) - now below shield
  if (deliveryStreak >= 2) {
    const streakColor = deliveryStreak >= 5 ? "#ffcc99" : "#99ff99";
    setFill(streakColor);
    x.font = `16px ${FONTS.body}`;
    x.fillText(`${deliveryStreak}x streak (+${Math.floor((Math.min(3, 1 + (deliveryStreak - 1) * 0.5) - 1) * 100)}% bonus)`, 20, leftY);
    leftY += 25;
  }
  
  // === CENTER: Summoning Feedback ===
  if (summonFeedback.active) {
    const alpha = 1 - (summonFeedback.life / summonFeedback.maxLife);
    setFill(`rgba(255, 255, 255, ${alpha})`);
    x.textAlign = "center";
    x.font = `20px ${FONTS.body}`;
    x.fillText(summonFeedback.text, w / 2, h / 2 - 150);
  }
  
  // === PLAYER CURSOR: Overheat/Heat Warning ===
  x.textAlign = "center";
  const recentAttempt = Date.now() - lastOverheatAttempt < 2000; // Show for 2 seconds after attempt
  
  if (summonOverheated || recentAttempt) {
    setFill("#ff9999");
    x.font = `18px ${FONTS.body}`;
    // Position under player cursor for better visibility
    x.fillText("OVERHEATED", mx, my + 30);
  }
  
  // Tutorial step 1 timer - give players time to experience overheating
  if (!tutorialComplete && tutorialStep === 1) {
    tutorialStep1Timer++; // Count frames at step 1
    if (tutorialStep1Timer > 600) { // 10 seconds (60 fps * 10)
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
  
  // === BOTTOM CENTER: Delivery Pressure Timer (Like Rhythm Games) ===
  const barWidth = Math.min(w * 0.7, 600);
  const barHeight = 20;
  const barX = (w - barWidth) / 2;
  const barY = h - 70;
  
  // Calculate time pressure - how close to curiosity decay (15 seconds max)
  const timeSinceDelivery = lastDeliveryTime ? (Date.now() - lastDeliveryTime) : (Date.now() - (startTime || Date.now()));
  const timeUntilDecay = Math.max(0, 15000 - timeSinceDelivery); // 15 seconds to deliver
  const pressurePercent = timeUntilDecay / 15000; // 1.0 = safe, 0.0 = critical
  const fillWidth = barWidth * pressurePercent;
  
  // Color based on delivery pressure (traffic light system)
  let barColor, glowColor, shadowColor, particleColor;
  if (pressurePercent > 0.6) {
    // Safe zone - green/emerald
    barColor = "#22cc44"; glowColor = "#44dd66"; shadowColor = "#11aa33"; particleColor = "#66ff88";
  } else if (pressurePercent > 0.3) {
    // Warning zone - yellow/gold
    barColor = "#cccc22"; glowColor = "#dddd44"; shadowColor = "#aaaa11"; particleColor = "#ffff66";
  } else {
    // Critical zone - red/orange
    barColor = "#cc4422"; glowColor = "#dd6644"; shadowColor = "#aa2211"; particleColor = "#ff8866";
  }
  
  x.save();
  
  // Background swirling particles (behind bar)
  for (let i = 0; i < 12; i++) {
    const time = Date.now() * 0.002 + i * 0.5;
    const swirlX = barX + (barWidth * 0.5) + Math.cos(time) * (barWidth * 0.3) * (1 + i * 0.1);
    const swirlY = barY + (barHeight * 0.5) + Math.sin(time * 0.7 + i) * (barHeight * 1.5);
    const alpha = (sin(time * 2 + i) * 0.3 + 0.4) * 0.15;
    const size = 1 + sin(time * 3 + i) * 0.5;
    
    setFill(`rgba(${particleColor.slice(1,3)}, ${particleColor.slice(3,5)}, ${particleColor.slice(5,7)}, ${alpha})`);
    x.fillRect(swirlX - size/2, swirlY - size/2, size, size);
  }
  
  // Ethereal background glow with rounded corners
  x.shadowColor = shadowColor;
  x.shadowBlur = 25;
  setFill("rgba(0, 0, 0, 0.2)");
  // Simulate rounded rectangle with overlapping circles
  x.fillRect(barX + 10, barY, barWidth - 20, barHeight);
  x.beginPath();
  x.arc(barX + 10, barY + barHeight/2, barHeight/2, 0, TAU);
  x.arc(barX + barWidth - 10, barY + barHeight/2, barHeight/2, 0, TAU);
  x.fill();
  
  // Main bar with rounded ends
  x.shadowBlur = 15;
  x.shadowColor = glowColor;
  setFill(barColor);
  
  if (fillWidth > 10) {
    // Main rectangle
    x.fillRect(barX + 10, barY + 2, Math.max(0, fillWidth - 20), barHeight - 4);
    // Left rounded end
    x.beginPath();
    x.arc(barX + 10, barY + barHeight/2, (barHeight - 4)/2, 0, TAU);
    x.fill();
    // Right rounded end (only if bar is long enough)
    if (fillWidth > 20) {
      x.beginPath();
      x.arc(barX + fillWidth - 10, barY + barHeight/2, (barHeight - 4)/2, 0, TAU);
      x.fill();
    }
  }
  
  // Inner flowing gradient
  if (fillWidth > 15) {
    const flowOffset = sin(Date.now() * 0.003) * 0.3;
    const gradient = x.createLinearGradient(barX, barY, barX + fillWidth, barY);
    gradient.addColorStop(0, `${glowColor}66`);
    gradient.addColorStop(0.3 + flowOffset, `${glowColor}99`);
    gradient.addColorStop(0.7 + flowOffset, `${glowColor}44`);
    gradient.addColorStop(1, `${glowColor}77`);
    x.fillStyle = gradient;
    
    x.fillRect(barX + 10, barY + 4, Math.max(0, fillWidth - 20), barHeight - 8);
    if (fillWidth > 20) {
      x.beginPath();
      x.arc(barX + 10, barY + barHeight/2, (barHeight - 8)/2, 0, TAU);
      x.arc(barX + fillWidth - 10, barY + barHeight/2, (barHeight - 8)/2, 0, TAU);
      x.fill();
    }
  }
  
  // Floating particles in front
  for (let i = 0; i < 8; i++) {
    const time = Date.now() * 0.003 + i * 0.7;
    const floatX = barX + 20 + (Math.sin(time) * (barWidth - 40));
    const floatY = barY - 15 + Math.cos(time * 1.3 + i) * 25;
    const alpha = (sin(time * 2.5 + i) * 0.4 + 0.6) * 0.25;
    const size = 1.5 + sin(time * 4 + i) * 0.8;
    
    x.shadowBlur = 8;
    x.shadowColor = particleColor;
    setFill(`rgba(${particleColor.slice(1,3)}, ${particleColor.slice(3,5)}, ${particleColor.slice(5,7)}, ${alpha})`);
    x.fillRect(floatX - size/2, floatY - size/2, size, size);
  }
  
  x.restore();
  
  // Timer countdown inside the bar
  x.save();
  x.shadowColor = "rgba(0, 0, 0, 0.8)";
  x.shadowBlur = 4;
  x.textAlign = "center";
  setFill("#ffffff");
  x.font = `14px ${FONTS.body}`;
  const secondsLeft = Math.ceil(timeUntilDecay / 1000);
  x.fillText(`${secondsLeft}s`, barX + barWidth/2, barY + barHeight/2 + 5);
  x.restore();
  
  // Label with more buffer and dimmer text
  x.save();
  x.shadowColor = "rgba(0, 0, 0, 0.5)";
  x.shadowBlur = 3;
  x.textAlign = "center";
  const labelColor = pressurePercent > 0.6 ? "rgba(100, 255, 150, 0.85)" :
                    pressurePercent > 0.3 ? "rgba(255, 255, 100, 0.85)" :
                    "rgba(255, 150, 100, 0.85)";
  setFill(labelColor);
  x.font = `18px ${FONTS.title}`;
  const labelText = pressurePercent > 0.6 ? "Deliver Soon" :
                   pressurePercent > 0.3 ? "Hurry!" : "CRITICAL!";
  x.fillText(labelText, barX + barWidth/2, barY - 15);
  x.restore();

  // === BOTTOM RIGHT: Controls hint ===
  x.textAlign = "right";
  setFill("#666666");
  x.font = `14px ${FONTS.body}`;
  x.fillText(`Press 'ESC' for help • 'M' - Audio: ${audioEnabled ? 'ON' : 'OFF'}`, w - 20, h - 20);
  
  x.restore();
};

// Draw victory screen when player survives the night
// Main game loop - orchestrates all systems
function gameLoop() {
  const now = Date.now();
  
  const { x: playerX, y: playerY } = getPlayerPosition();
  
  // Game loop runs at 60fps but only updates game logic when active
  
  // Only update game systems when game is active (not over or won) AND screen is adequate AND help menu is closed AND tab is visible
  if (!gameOver && !gameWon && !isScreenTooSmall && !showHelp && !autoPaused) {
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
    
    // Nyx's Curiosity Decay - the core risk mechanic
    if (!gameOver && !gameWon && startTime) {
      const timeSinceLastDelivery = Date.now() - (lastDeliveryTime || startTime);
      
      // IMMEDIATE GAME OVER when delivery deadline is missed (15+ seconds without delivery)
      if (timeSinceLastDelivery >= 15000) {
        gameOver = true;
        gameOverTime = Date.now();
        addScoreText('Nyx lost interest - delivery too late!', w / 2, h / 2, '#ff4444', 300);
        playGameOverMelody();
        fadeBgMusic(0.03, 3);
        deliveryStreak = 0; // Break streak on game over
      }
      
      // Game over when Nyx loses all interest (score <= -50)
      if (score <= -50) {
        gameOver = true;
        gameOverTime = Date.now();
        addScoreText('Nyx has lost all curiosity!', w / 2, h / 2, '#ff4444', 300);
        playGameOverMelody();
        fadeBgMusic(0.03, 3);
      }
    }
    
    // Progressive difficulty: spawn fireflies over time
    if (!gameOver && gameStarted && startTime) {
      const gameTime = now - startTime;
      const minutesPlayed = gameTime / 60000;
      
      // Base spawn rate: much faster - every 3-4 seconds, down to 1.5 seconds
      const baseSpawnInterval = Math.max(1500, 4000 - (minutesPlayed * 500));
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
      if (otherFireflies.length <= 5 && !tutorialComplete) {
        // During tutorial, always maintain at least 8 fireflies
        for (let i = 0; i < 4; i++) {
          spawnFirefly();
        }
      } else if (otherFireflies.length <= 8 && tutorialComplete && manaEnergy < 50) {
        // After tutorial, surge when low on both fireflies and mana
        for (let i = 0; i < 5; i++) {
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
  
  // Apply screen shake if active
  let shakeApplied = false;
  if (screenShake > 0) {
    const shakeX = (r() - 0.5) * screenShake;
    const shakeY = (r() - 0.5) * screenShake;
    x.save();
    x.translate(shakeX, shakeY);
    screenShake = Math.max(0, screenShake - 0.3); // Decay shake
    shakeApplied = true;
  }

  // Render everything in proper order
  drawStars(now);
  drawForest();
  drawCatEyes(now);
  drawDeliveryZone(now);
  drawFireflies(now);
  drawPlayerFirefly(playerX, playerY, now);
  drawPlayerManaRing(playerX, playerY, now);
  
  // Shield charging visual effect - crackling lightning
  if (shieldCharging) {
    const chargeTime = Date.now() - (mouseDownTime || spaceActivationTime);
    const chargeProgress = Math.min(chargeTime / HOLD_THRESHOLD, 1);
    
    x.save();
    // Multiple crackling lightning bolts around player
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * TAU + chargeTime * 0.01;
      const radius = 20 + sin(chargeTime * 0.02 + i) * 5;
      const startX = playerX + cos(angle) * radius;
      const startY = playerY + sin(angle) * radius;
      const endX = playerX + cos(angle) * (radius + 15);
      const endY = playerY + sin(angle) * (radius + 15);
      
      // Crackling lightning effect
      setStroke(`rgba(200, 220, 255, ${0.7 + sin(chargeTime * 0.03 + i) * 0.3})`);
      setLineWidth(2);
      x.beginPath();
      x.moveTo(startX, startY);
      // Jagged lightning path
      const segments = 3;
      for (let j = 1; j <= segments; j++) {
        const t = j / segments;
        const midX = startX + (endX - startX) * t + (sin(chargeTime * 0.05 + i + j) * 8);
        const midY = startY + (endY - startY) * t + (cos(chargeTime * 0.04 + i + j) * 8);
        x.lineTo(midX, midY);
      }
      x.stroke();
    }
    x.restore();
  }
  
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
  
  // Shield success flash effects
  if (shieldPerfectFlash > 0) {
    const flashIntensity = (shieldPerfectFlash / 60) * 0.3; // White flash for perfect
    setFill(`rgba(255, 255, 255, ${flashIntensity})`);
    x.fillRect(0, 0, w, h);
    shieldPerfectFlash--;
  } else if (shieldSuccessFlash > 0) {
    const flashIntensity = (shieldSuccessFlash / 30) * 0.2; // Blue flash for success  
    setFill(`rgba(100, 200, 255, ${flashIntensity})`);
    x.fillRect(0, 0, w, h);
    shieldSuccessFlash--;
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
  
  // Show auto-pause overlay when tab is inactive
  if (autoPaused) {
    setFill("rgba(0, 0, 0, 0.8)");
    x.fillRect(0, 0, w, h);
    
    x.save();
    x.textAlign = "center";
    setFill("#69e4de");
    x.font = `32px ${FONTS.title}`;
    x.shadowColor = "#69e4de";
    x.shadowBlur = 8;
    x.fillText("Game Paused", w / 2, h / 2 - 20);
    x.shadowBlur = 0;
    
    setFill("#ffffff");
    x.font = `18px ${FONTS.body}`;
    x.fillText("Switch back to this tab to resume", w / 2, h / 2 + 20);
    x.restore();
  }

  // Show screen size warning LAST - covers everything
  drawScreenSizeWarning();
  
  // Restore screen shake transform if it was applied
  if (shakeApplied) {
    x.restore();
  }
  
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
      }
    } else if (!isScreenTooSmall) {
      // Screen is large enough and size changed - update systems
      initStars();
      initCatEyes();
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
  
  // Page visibility handling for performance + audio + game pausing
  document.addEventListener('visibilitychange', () => {
    pageVisible = !document.hidden;
    tabVisible = pageVisible;
    
    // Auto-pause/resume when tab becomes inactive/active
    if (pageVisible) {
      // Tab became visible again
      if (audioEnabled && audioStarted) startBgMusic();
      if (autoPaused && gameStarted && !gameOver && !gameWon) {
        autoPaused = false;
        // Resume game timing by adjusting start time to account for pause
        if (startTime) {
          const pauseDuration = Date.now() - (window.pauseStartTime || 0);
          startTime += pauseDuration;
          lastDeliveryTime += pauseDuration;
          lastSpawnTime += pauseDuration;
        }
      }
    } else {
      // Tab became hidden
      pauseBgMusic();
      stopShieldShimmer();
      if (gameStarted && !gameOver && !gameWon && !showHelp) {
        autoPaused = true;
        window.pauseStartTime = Date.now();
      }
    }
  });
  
  // Spawn initial fireflies
  const initialFireflies = tutorialComplete ? 20 : 8;
  for (let i = 0; i < initialFireflies; i++) {
    spawnFirefly();
  }
  
  // Background music will start on first user interaction (browser requirement)
  
  // Start game loop
  gameLoop();
};

initGame();
