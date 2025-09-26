
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
  flash1: 60,           // First warning flash timing (evenly spaced)
  flash2: 120,          // Second flash timing (evenly spaced)
  flash3: 180,          // Third flash timing (evenly spaced)
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
const setFontBySize = (size, type = 'body') => {
  const font = `${size}px ${FONTS[type]}`;
  setFont(font);
};
const setTitleFont = (size) => setFontBySize(size, 'title');

// ===== UTILITY FUNCTIONS =====

// Math utilities
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const hyp = (dx, dy) => Math.hypot(dx, dy);
const d2 = (ax, ay, bx, by) => { ax -= bx; ay -= by; return ax * ax + ay * ay; };

// Canvas shortcuts with caching for performance
let currentFillStyle = '';
let currentStrokeStyle = '';
let currentLineWidth = 0;
let currentFont = '';

const setFill = (color) => {
  if (color !== currentFillStyle) {
    x.fillStyle = color;
    currentFillStyle = color;
  }
};
const setStroke = (color) => {
  if (color !== currentStrokeStyle) {
    x.strokeStyle = color;
    currentStrokeStyle = color;
  }
};
const setLineWidth = (width) => {
  if (width !== currentLineWidth) {
    x.lineWidth = width;
    currentLineWidth = width;
  }
};
const setFont = (font) => {
  if (font !== currentFont) {
    x.font = font;
    currentFont = font;
  }
};
let currentShadowBlur = 0;
const setShadowBlur = (blur) => {
  if (blur !== currentShadowBlur) {
    x.shadowBlur = blur;
    currentShadowBlur = blur;
  }
};
const BLACK = (alpha = 1) => `rgba(0,0,0,${alpha})`;

// Game state helpers
const getDifficulty = () => F(score / 50);
const getSpeedMult = () => 1 + (score / 200);


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
const playTone = (freq, duration = 0.2, volume = 0.1, waveType = 'sine') => {

  if (!audioEnabled || !initAudio()) return;
  
  // Safety checks to prevent audio crashes
  if (!isFinite(freq) || freq <= 0) return;
  if (!isFinite(duration) || duration <= 0) return;
  if (!isFinite(volume) || volume <= 0) return;
  
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.frequency.value = freq;
  osc.type = waveType || 'sine';
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
// Right-click drop functionality - no state tracking needed
let mouseMoving = false, lastMovementTime = 0;
let mouseInBounds = true;

// Player state
let charging = false;
let glowPower = 0, flashTimer = 0, quickFlashPower = 0;

// Unified flash system for eye shifts
let warningFlashState = {
  isActive: false,
  currentFlash: 0, // 0, 1, 2 for the three flashes
  flashFrame: 0    // Frame counter within current flash
};

// Unified flash management - call this every frame
const updateWarningFlashes = () => {
  const timeUntilChange = nextColorChangeTime - catEyeChangeTimer;
  
  // Reset flash state if not in warning period
  if (timeUntilChange < 0 || timeUntilChange > CFG.warnFrames) {
    warningFlashState.isActive = false;
    warningFlashState.currentFlash = 0;
    warningFlashState.flashFrame = 0;
    return;
  }
  
  warningFlashState.isActive = true;
  
  const flashPhase = CFG.warnFrames - timeUntilChange;
  
  // Determine which flash we're in (0, 1, 2) and the frame within that flash
  if (flashPhase >= CFG.flash1 && flashPhase < CFG.flash1 + 20) {
    warningFlashState.currentFlash = 1;
    warningFlashState.flashFrame = flashPhase - CFG.flash1;
  } else if (flashPhase >= CFG.flash2 && flashPhase < CFG.flash2 + 20) {
    warningFlashState.currentFlash = 2;
    warningFlashState.flashFrame = flashPhase - CFG.flash2;
  } else if (flashPhase >= CFG.flash3 && flashPhase < CFG.flash3 + 20) {
    warningFlashState.currentFlash = 3;
    warningFlashState.flashFrame = flashPhase - CFG.flash3;
  } else {
    warningFlashState.currentFlash = 0;
    warningFlashState.flashFrame = 0;
  }
};

// Check if we should show flash effects right now
const isCurrentlyFlashing = () => {
  return warningFlashState.isActive && warningFlashState.currentFlash > 0;
};
let manaEnergy = 100;
let summonHeat = 0, summonOverheated = false, overheatStunned = false;
let screenShake = 0; // Screen shake intensity
let starTwinkleTimer = 0; // Timer for star twinkle effect during deliveries
let tabVisible = true; // Track if tab is visible/active
let autoPaused = false; // Track if game is auto-paused due to tab switch
let lastOverheatAttempt = 0; // Track when player tried to use abilities while overheated

// Shield system
let shieldActive = false, shieldCooldown = 0, lastShieldTime = 0;
let shieldCharging = false; // Track when shield is charging up
let shieldSuccessFlash = 0, shieldPerfectFlash = 0; // Success feedback timers

// Repel system (right-click/X key)
let xPressed = false; // Track X key state to prevent double-drops

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
let shieldStreak = 0, bestStreak = 0; // Shield-based streak tracking
let startTime = null;

// Frame rate limiting (60 FPS cap)
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS; // 16.67ms per frame
let lastFrameTime = 0;
let shieldStats = { perfect: 0, great: 0, good: 0, missed: 0 };
let tierStats = { green: 0, purple: 0, gold: 0, rainbow: 0, created: { purple: 0, gold: 0, rainbow: 0 }, lost: { purple: 0, gold: 0, rainbow: 0 } };
let audioEnabled = true, pageVisible = true;
let lastSpawnTime = 0; // For progressive difficulty spawning

// Infinite mode system
let infiniteMode = false; // Infinite mode toggle

// Idle tracking for firefly dispersal
let lastPlayerMoveTime = Date.now();
let playerIsIdle = false;

// Leaderboard system
let showLeaderboard = false;
let isNewHighScore = false;
let showNameInput = false;
let playerName = "";
let pendingScore = null;
let nameWarning = "";
let duplicateCheckTimeout = null; // Debounce duplicate checking
let scoreAlreadySubmitted = false; // Track if score has been submitted for this game
let recentPlayerName = null; // Track the most recently submitted player name
let playerHighlightAnimation = null; // Track animation state for recent player highlight



// Simple debug logging system (set to false for production)
const DEBUG_LEADERBOARD = false;
const debugLog = (message, ...args) => {
  if (DEBUG_LEADERBOARD) {
    console.log(message, ...args);
  }
};

// Start player highlight animation if there's a recent player
const startPlayerHighlightAnimation = () => {
  if (recentPlayerName) {
    playerHighlightAnimation = {
      startTime: Date.now(),
      duration: 4500, // 4.5 seconds for 2 slow breaths
      flashes: 2
    };
  }
};

// Helper function to track name input state changes
const setNameInputState = (value, reason) => {
  showNameInput = value;
};

// Consolidated victory handler to avoid duplicate logic
const handleVictory = (reason = "victory") => {
  if (gameWon || gameOver) return; // Prevent multiple triggers
  
  gameWon = true;
  gameOverTime = Date.now();
  
  // Calculate final score
  const finalScore = score + 1000 + (bestStreak * 50);
  
  // Check leaderboard qualification and set up name input immediately
  scoreQualifiesForLeaderboard(finalScore).then(qualifies => {
    // Immediately set up name input if qualified (and not in infinite mode)
    if (qualifies && !infiniteMode && !scoreAlreadySubmitted && finalScore > 0) {
      pendingScore = {
        score: finalScore,
        gameWon: true
      };
      setNameInputState(true, `${reason} score qualifies for leaderboard`);
      playerName = "";
      nameWarning = "";
    }
  }).catch(error => {
    console.error("Error checking leaderboard qualification:", error);
  });
};

// Consolidated score submission handler to reduce duplication
const submitScore = (submittedName, reason) => {
  if (!pendingScore || scoreAlreadySubmitted) {
    return;
  }
  
  addScoreToLeaderboard(pendingScore.score, submittedName)
    .then(result => {
      isNewHighScore = result;
      leaderboardCacheTime = 0; // Refresh leaderboard cache
    })
    .catch(e => {
      console.error("Score save failed:", e);
    });
  
  // Track the submitted player name for highlighting
  recentPlayerName = submittedName;
  
  // Reset state
  setNameInputState(false, reason);
  pendingScore = null;
  playerName = ""; // Reset the global playerName variable
  nameWarning = "";
  scoreAlreadySubmitted = true;
};

// Firebase config - loaded from Vercel environment variables
const FIREBASE_CONFIG = typeof process !== 'undefined' && process.env ? {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
} : null; // Falls back to localStorage when env vars not available

let firebaseEnabled = false;
if (FIREBASE_CONFIG && typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    window.db = firebase.firestore();
    firebaseEnabled = true;
  } catch (error) {
    firebaseEnabled = false;
  }
}

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
let tutorialDeliveryCount = 0; // Track how many deliveries made in tutorial
let tutorialStep1Timer = 0; // Track time spent on step 1 (summoning phase)
let tutorialStep3Timer = 0; // Track time spent on step 3
let tutorialStep4Timer = 0; // Track time spent on step 4
let tutorialMissedShield = false; // Track if player missed a shield during tutorial
let showHelp = false;
let helpScrollOffset = 0; // For scrolling help content
let showTutorialElements = false;
let helpOpenTime = 0;
let totalHelpPauseTime = 0;
let leaderboardOpenTime = 0;
let totalLeaderboardPauseTime = 0;

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
  
  // Regular stars (more for richer background)
  for (let i = 0; i < 150; i++) {
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
  
  // Add tiny dust particles (more for richer atmosphere)
  for (let i = 0; i < 300; i++) {
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
    let alpha, color = "255, 255, 255"; // Default white
    
    if (star.twinkleSpeed === 0) {
      // Static stars - no animation
      alpha = star.alpha;
    } else {
      // Animated stars - gentle twinkling or slow fading
      const twinkle = sin(now * star.twinkleSpeed + star.twinkleOffset) * 0.4 + 0.6;
      alpha = star.alpha * twinkle;
    }
    
    // Add magical twinkle effect during firefly deliveries
    if (starTwinkleTimer > 0) {
      const twinkleProgress = starTwinkleTimer / 120;
      const fastTwinkle = sin(now * 0.02 + star.twinkleOffset) * 0.5 + 0.5;
      
      // Rainbow cycle effect during delivery
      const rainbowTime = now * 0.005 + star.x * 0.01 + star.y * 0.01; // Different phase per star
      const hue = (rainbowTime % (Math.PI * 2)) / (Math.PI * 2) * 360; // 0-360 degrees
      
      // Convert HSL to RGB for rainbow effect
      const hslToRgb = (h, s, l) => {
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        let r, g, b;
        
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        
        return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
      };
      
      const [r, g, b] = hslToRgb(hue, 1, 0.6); // Full saturation, medium lightness
      color = `${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}`;
      alpha = Math.min(1, alpha * 1.8); // Brighter during rainbow effect
    }
    
    setFill(`rgba(${color}, ${alpha})`);
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
  setFill("#080808");
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

// Simple silhouette helper
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
  
  // Apply flashing effect if active (using unified flash system)
  if (isCurrentlyFlashing()) {
    // Flash to white/red for danger warnings
    return {
      hex: "#ffffff",
      r: 255,
      g: 255,
      b: 255,
      rgba: (alpha = 1) => `rgba(255, 255, 255, ${alpha})`
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
  


  
  // NEW: Check all evolved fireflies for shield protection and revert unprotected ones
  handleEvolutionReversion();
  
  // Handle captured fireflies (existing logic)
  if (capturedFireflies.length > 0) {
    if (shieldActive) {
      handleShieldProtection(capturedFireflies, now);
    } else {
      handleNoPenalty(capturedFireflies);
    }
  }
  
  // Handle free fireflies - now they're also protected by shields!
  const freeFireflies = otherFireflies.filter(f => !f.captured);
  if (freeFireflies.length > 0 && !shieldActive) {
    // No shield active - remove only some free fireflies (not all!)
    const firefliesEaten = Math.ceil(freeFireflies.length * 0.5); // Only eat 50% of free fireflies
    const firefliesSaved = freeFireflies.length - firefliesEaten;
    
    // Make eaten fireflies flee like scared insects to screen edges
    for (let i = 0; i < firefliesEaten && freeFireflies.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * freeFireflies.length);
      const firefly = freeFireflies.splice(randomIndex, 1)[0];
      
      // Apply escape animation to free fireflies too
      firefly.dyingAnimation = true;
      firefly.deathTimer = 0;
      firefly.deathMaxTime = 180; // 3 seconds to escape off screen
      
      // Scared fireflies flee upward toward the sky (same as captured fireflies)
      let escapeAngle = -Math.PI/2; // Primarily upward
      
      // Add some randomness to escape direction (scared, erratic flight)
      escapeAngle += (r() - 0.5) * 1.0; // Allow some spread but mostly upward
      
      // Fast panic flight speed - much faster than normal firefly movement
      const panicSpeed = 4 + r() * 3; // 4-7 pixels per frame
      firefly.vx = Math.cos(escapeAngle) * panicSpeed;
      firefly.vy = Math.sin(escapeAngle) * panicSpeed;
      
      // Add particle trail effect for fleeing fireflies
      createDeathEffect(firefly);
    }
    
    totalLost += firefliesEaten;
    
    // Remove floating text for eaten fireflies - too much visual clutter
  }
  
  changeToNewColor();
};

// Handle evolution reversion for fireflies not protected by shield
const handleEvolutionReversion = () => {
  if (!shieldActive) {
    // No shield at all - revert ALL evolved fireflies
    otherFireflies.forEach(firefly => {
      if (firefly.tier !== 'green') {
        revertFirefly(firefly);
      }
    });
  } else {
    // Shield is active - check if evolved fireflies are within shield range
    const { x: playerX, y: playerY } = getPlayerPosition();
    const shieldRadius = getShieldRadius();
    
    otherFireflies.forEach(firefly => {
      if (firefly.tier !== 'green') {
        const distance = Math.sqrt((firefly.x - playerX) ** 2 + (firefly.y - playerY) ** 2);
        
        // If evolved firefly is outside shield protection, revert it
        if (distance > shieldRadius) {
          revertFirefly(firefly);
        }
      }
    });
  }
};

// Revert a firefly back to green tier
const revertFirefly = (firefly) => {
  const oldTier = firefly.tier;
  
  // Reset to green tier
  firefly.tier = 'green';
  firefly.color = '#88ff88';
  firefly.points = 5;
  firefly.protectionCount = 0;
  firefly.size = Math.max(firefly.size, 2 + r() * 1); // Reset size
  firefly.glowIntensity = 1.0; // Reset glow
  
  // Update stats
  if (oldTier === 'purple') {
    tierStats.lost.purple++;
  } else if (oldTier === 'gold') {
    tierStats.lost.gold++;
  } else if (oldTier === 'rainbow') {
    tierStats.lost.rainbow++;
  }
  
  // Create reversion effect (red particles to show loss)
  for (let i = 0; i < 8; i++) {
    const angle = r() * Math.PI * 2;
    const speed = 1 + r() * 2;
    particles.push({
      x: firefly.x + (r() - 0.5) * 8,
      y: firefly.y + (r() - 0.5) * 8,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.5,
      size: 0.3 + r() * 0.4,
      life: 0,
      maxLife: 40 + r() * 20,
      color: '#ff6666', // Red to indicate loss
      glow: true,
      twinkle: r() * Math.PI * 2,
    });
  }
};

// Enhanced shield protection system based on timing and positioning
const handleShieldProtection = (capturedFireflies, now) => {
  // Fix timing calculation - we're called AT the moment of change, so calculate based on warning period
  // Instead of using current timer vs next change, use how far we were into the warning period
  const warningPeriodPosition = catEyeChangeTimer - (nextColorChangeTime - CFG.warnFrames);
  const flashPhase = Math.max(0, Math.min(CFG.warnFrames, warningPeriodPosition));
  
  let timingQuality;
  


  
  // Get player position and shield radius
  const { x: playerX, y: playerY } = getPlayerPosition();
  const shieldRadius = getShieldRadius();
  
  // Determine shield timing quality - more forgiving ranges
  if (flashPhase >= CFG.flash2 + 15 && flashPhase <= CFG.flash2 + 40) {
    timingQuality = "PERFECT"; // Wider perfect window after 2nd flash

  } else if (flashPhase >= CFG.flash2 - 10 && flashPhase <= CFG.flash3 + 15) {
    timingQuality = "GREAT"; // Around 2nd flash through early 3rd flash
  } else if (flashPhase >= CFG.flash1 - 10 && flashPhase <= CFG.warnFrames + 10) {
    timingQuality = "GOOD"; // Most of warning period - very forgiving
  } else {
    timingQuality = "MISSED"; // Only if way too early
  }
  
  // Separate all fireflies into within/outside shield
  const allFireflies = otherFireflies.slice(); // Copy to avoid modification issues
  const firefliesInShield = [];
  const firefliesOutsideShield = [];
  
  allFireflies.forEach(firefly => {
    const distance = Math.sqrt((firefly.x - playerX) ** 2 + (firefly.y - playerY) ** 2);
    if (distance <= shieldRadius) {
      firefliesInShield.push(firefly);
    } else {
      firefliesOutsideShield.push(firefly);
    }
  });
  
  let upgradeCount = 0;
  let rainbowCreated = 0;
  let firefliesLost = 0;
  let outsideSurvivalRate = 0;
  let insideEvolutionRate = 0;
  
  // Apply timing-based effects
  if (timingQuality === "PERFECT") {
    // 100% - all outside survive, all inside evolve
    outsideSurvivalRate = 1.0;
    insideEvolutionRate = 1.0;
    
    shieldPerfectFlash = 60;
    playTone(800, 0.3, 0.05);
    shieldStats.perfect++;
    shieldStreak++;
    bestStreak = Math.max(bestStreak, shieldStreak);
    
  } else if (timingQuality === "GREAT") {
    // 75% outside saved, 75% inside evolve
    outsideSurvivalRate = 0.75;
    insideEvolutionRate = 0.75;
    
    shieldSuccessFlash = 30;
    playTone(600, 0.2, 0.08);
    shieldStats.great++;
    shieldStreak++;
    bestStreak = Math.max(bestStreak, shieldStreak);
    
  } else if (timingQuality === "GOOD") {
    // 50% outside saved, 50% inside evolve
    outsideSurvivalRate = 0.5;
    insideEvolutionRate = 0.5;
    
    shieldSuccessFlash = 15;
    playTone(500, 0.15, 0.1);
    shieldStats.good++;
    shieldStreak++;
    bestStreak = Math.max(bestStreak, shieldStreak);
    
  } else { // MISSED
    // 0% outside saved, 0% inside evolve (but inside are still protected from death)
    outsideSurvivalRate = 0.0;
    insideEvolutionRate = 0.0;
    
    playTone(300, 0.3, 0.12);
    shieldStats.missed++;
    shieldStreak = 0;
  }
  
  // Handle fireflies outside shield
  const outsideToLose = Math.ceil(firefliesOutsideShield.length * (1 - outsideSurvivalRate));
  
  // Tutorial protection: Don't lose evolved fireflies during steps 3-4
  const tutorialProtection = !tutorialComplete && (tutorialStep === 3 || tutorialStep === 4);
  
  for (let i = 0; i < outsideToLose; i++) {
    if (firefliesOutsideShield[i]) {
      const firefly = firefliesOutsideShield[i];
      
      // Check if this is an evolved firefly during tutorial protection
      if (tutorialProtection && (firefly.color === '#9966ff' || firefly.color === '#ffdd00' || firefly.color === 'rainbow')) {
        // Don't lose evolved fireflies during tutorial - show warning instead
        addScoreText('EVOLVED FIREFLY PROTECTED!', firefly.x, firefly.y, "#ffff00", 120);
        continue; // Skip losing this firefly
      }
      
      firefliesLost++;
      // Remove the firefly
      const fireflyIndex = otherFireflies.indexOf(firefliesOutsideShield[i]);
      if (fireflyIndex >= 0) {
        // Make them flee
        firefly.dyingAnimation = true;
        firefly.deathTimer = 0;
        firefly.deathMaxTime = 180;
        
        let escapeAngle = -Math.PI/2 + (r() - 0.5) * 1.0;
        const panicSpeed = 4 + r() * 3;
        firefly.vx = Math.cos(escapeAngle) * panicSpeed;
        firefly.vy = Math.sin(escapeAngle) * panicSpeed;
        
        createDeathEffect(firefly);
      }
    }
  }
  
  // Handle fireflies inside shield - they're safe but may evolve
  const insideToEvolve = Math.floor(firefliesInShield.length * insideEvolutionRate);
  for (let i = 0; i < insideToEvolve; i++) {
    if (firefliesInShield[i]) {
      const upgradeResult = upgradeFirefly(firefliesInShield[i]);
      if (upgradeResult.upgraded) {
        upgradeCount++;
        if (upgradeResult.to === 'rainbow') {
          rainbowCreated++;
        }
      }
    }
  }
  
  // Apply score penalty for lost fireflies
  if (firefliesLost > 0) {
    score -= firefliesLost;
    totalLost += firefliesLost;
  }
  
  // Shield consumed after use
  shieldActive = false;
  stopShieldShimmer();
  shieldCooldown = CFG.shieldCooldown + getDifficulty() * 4;
  
  // Clear old feedback first
  clearShieldFeedback();
  
  // Create shield message
  let shieldMessage = '';
  if (timingQuality === "PERFECT") {
    shieldMessage = 'PERFECT SHIELD!';
  } else if (timingQuality === "GREAT") {
    shieldMessage = 'GREAT SHIELD!';
  } else if (timingQuality === "GOOD") {
    shieldMessage = 'GOOD SHIELD!';
  } else if (timingQuality === "MISSED") {
    shieldMessage = 'MISSED SHIELD!';
  }
  
  // Add evolution info
  if (upgradeCount > 0) {
    if (rainbowCreated > 0) {
      shieldMessage += ` +${rainbowCreated} RAINBOW!`;
    } else {
      shieldMessage += ` +${upgradeCount} EVOLVED!`;
    }
  }
  
  const messageColors = {
    "PERFECT": '#ffffff',
    "GREAT": '#66ccff', 
    "GOOD": '#99ff99',
    "MISSED": '#ff9999'
  };
  
  addScoreText(shieldMessage, w / 2, h / 2 - 80, messageColors[timingQuality], 300);
  
  // Tutorial-specific messaging for drop lesson
  if (!tutorialComplete && (tutorialStep === 3 || tutorialStep === 4) && timingQuality === "MISSED") {
    const evolvedOutside = firefliesOutsideShield.filter(f => f.color !== '#88ff88').length;
    if (evolvedOutside > 0) {
      setTimeout(() => {
        addScoreText('TIP: Drop evolved fireflies to keep them safe!', w / 2, h / 2, "#ffff00", 240);
      }, 1000);
    }
  }
  
  // Tutorial progression
  if (!tutorialComplete && tutorialStep === 2 && (upgradeCount > 0 || outsideSurvivalRate > 0)) {
    tutorialStep = 3;
    tutorialMissedShield = false;
  }
};

// No shield protection - simplified penalty system
const handleNoPenalty = (capturedFireflies) => {


  
  // Tutorial protection: Don't lose evolved fireflies during steps 3-4
  const tutorialProtection = !tutorialComplete && (tutorialStep === 3 || tutorialStep === 4);
  
  // Lose most fireflies - escalating penalty based on difficulty
  const baseLossRate = 0.75; // Start with 75% loss
  const difficultyMultiplier = 1 + (getDifficulty() * 0.05); // Up to 1.25x at high scores
  const lossRate = Math.min(0.95, baseLossRate * difficultyMultiplier); // Cap at 95%
  
  let firefliesLost = 0;
  let protectedCount = 0;
  
  // If tutorial protection, only lose green fireflies
  if (tutorialProtection) {
    const greenFireflies = capturedFireflies.filter(f => f.color === '#88ff88');
    const evolvedFireflies = capturedFireflies.filter(f => f.color !== '#88ff88');
    firefliesLost = Math.ceil(greenFireflies.length * lossRate);
    protectedCount = evolvedFireflies.length;
    
    if (protectedCount > 0) {
      addScoreText(`${protectedCount} EVOLVED FIREFLIES PROTECTED!`, w / 2, h / 2 - 40, "#ffff00", 180);
    }
  } else {
    firefliesLost = Math.ceil(capturedFireflies.length * lossRate);
  }
  
  const firefliesSaved = capturedFireflies.length - firefliesLost;
  
  score -= firefliesLost;
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
  
  // Base timing - more frequent and less predictable
  let minTime = 240, maxTime = 480; // 4-8 seconds base (much more frequent)
  
  // Early game progression (first 2 minutes) - moderate frequency
  if (gameMinutes < 2) {
    minTime = 360; // 6 seconds minimum
    maxTime = 600; // 10 seconds maximum
  }
  // Mid game (2-3 minutes) - increase frequency
  else if (gameMinutes < 3) {
    minTime = 300; // 5 seconds minimum 
    maxTime = 480; // 8 seconds maximum
  }
  // Late game (3+ minutes) - very frequent and unpredictable
  else {
    minTime = 180; // 3 seconds minimum
    maxTime = 360; // 6 seconds maximum
  }
  
  // Player activity bonus - successful shields make eyes shift sooner (intensity increases)
  const recentShields = Math.min(3, shieldStreak || 0);
  const activityBonus = recentShields * 30; // Up to 90 frames (1.5 sec) reduction
  
  // Shield usage creates brief calm period
  const shieldCalmBonus = shieldActive ? 120 : 0; // 2 seconds extra if shield active
  
  // Add some chaos - random variance for unpredictability
  const chaosVariance = (r() - 0.5) * 120; // ±2 seconds random
  
  let finalTime = minTime + F(r() * (maxTime - minTime)) - activityBonus + shieldCalmBonus + chaosVariance;
  
  // Ensure minimum timing so players can react
  finalTime = Math.max(180, finalTime); // Never less than 3 seconds
  
  nextColorChangeTime = finalTime;
};

const releaseCapturedFireflies = (count) => {
  let released = 0;
  otherFireflies.forEach(f => {
    if (f.captured && released < count) {
      f.captured = false;
      f.captureOffset = null;
      
      // Make killed fireflies flee like scared insects to screen edges
      f.dyingAnimation = true;
      f.deathTimer = 0;
      f.deathMaxTime = 180; // 3 seconds to escape off screen
      
      // Scared fireflies flee upward toward the sky (makes thematic sense)
      let escapeAngle = -Math.PI/2; // Primarily upward
      
      // Add some randomness to escape direction (scared, erratic flight)
      escapeAngle += (r() - 0.5) * 1.0; // Allow some spread but mostly upward
      
      // Fast panic flight speed - much faster than normal firefly movement
      const panicSpeed = 4 + r() * 3; // 4-7 pixels per frame
      f.vx = Math.cos(escapeAngle) * panicSpeed;
      f.vy = Math.sin(escapeAngle) * panicSpeed;
      
      // Add particle trail effect for dying fireflies
      createDeathEffect(f);
      
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
  // Delivery zone is invisible but functional - no visual elements needed
};

// ===== LEADERBOARD SYSTEM =====

// Format date as M/D/YY
const formatDate = (date) => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear().toString().slice(-2);
  return `${month}/${day}/${year}`;
};

// Parse and format any date string to M/D/YY
const parseAndFormatDate = (dateStr) => {
  if (!dateStr) return "Today";
  
  try {
    if (dateStr.includes('/') && dateStr.length <= 10) {
      return dateStr; // Already in M/D/YY format
    }
    
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? "Today" : formatDate(date);
  } catch {
    return "Today";
  }
};

// Check if a score qualifies for the leaderboard
const scoreQualifiesForLeaderboard = async (score) => {
  if (score <= 0) return false;
  
  try {
    const leaderboard = await getLeaderboard();
    
    // If we have fewer than 5 entries, any positive score qualifies
    if (leaderboard.length < 5) {
      return true;
    }
    
    // Check if score beats the 5th place (lowest qualifying score)
    const lowestQualifyingScore = leaderboard[4].score;
    return score > lowestQualifyingScore;
  } catch (error) {
    // If we can't check leaderboard, allow the entry
    return true;
  }
};

// Get leaderboard (supports both localStorage and Firebase)
const getLeaderboard = async () => {
  if (firebaseEnabled && window.db) {
    try {
      // Firebase implementation (when available)
      const snapshot = await window.db.collection('leaderboard')
        .orderBy('score', 'desc')
        .limit(10)
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (e) {
      // Firebase fallback handled below
    }
  }
  
  // LocalStorage fallback
  try {
    return JSON.parse(localStorage.getItem('firefly_leaderboard') || '[]');
  } catch {
    return [];
  }
};

// Save leaderboard to localStorage (Firebase saves individual entries)
const saveLeaderboard = async (leaderboard) => {
  try {
    localStorage.setItem('firefly_leaderboard', JSON.stringify(leaderboard));
  } catch (e) {
    // LocalStorage save failed
  }
};

const addScoreToLeaderboard = async (finalScore, playerName) => {
  if (finalScore <= 0) {
    return false;
  }
  
  const leaderboard = await getLeaderboard();
  
  const newEntry = {
    name: playerName || "Anonymous",
    score: finalScore,
    streak: bestStreak,
    perfectShields: shieldStats.perfect,
    date: formatDate(new Date())
  };
  
  leaderboard.push(newEntry);
  leaderboard.sort((a, b) => b.score - a.score);
  
  const topScores = leaderboard.slice(0, 5);
  await saveLeaderboard(topScores);
  
  // Save to Firebase if enabled
  if (firebaseEnabled && window.db) {
    try {
      await window.db.collection('leaderboard').add(newEntry);
    } catch (e) {
      // Firebase save failed, localStorage already updated
    }
  }
  
  const isTop3 = topScores.findIndex(entry => 
    entry.score === finalScore && 
    entry.name === newEntry.name
  ) < 3;
  
  return isTop3;
};

// Debounced duplicate checker to avoid race conditions
const debouncedCheckNameDuplicates = () => {
  if (duplicateCheckTimeout) {
    clearTimeout(duplicateCheckTimeout);
  }
  
  duplicateCheckTimeout = setTimeout(async () => {
    if (!playerName.trim()) {
      nameWarning = "";
      return;
    }
    
    try {
      const leaderboard = await getLeaderboard();
      const trimmedName = playerName.trim().toLowerCase();
      const isDuplicate = leaderboard.some(entry => 
        entry.name.toLowerCase() === trimmedName
      );
      
      nameWarning = isDuplicate ? "This name is already taken - try something else!" : "";
    } catch (e) {
      console.error("Error checking duplicates:", e);
      // If we can't check, don't show warning
      nameWarning = "";
    }
  }, 300); // 300ms debounce
};

// Legacy function for compatibility
const checkNameDuplicates = debouncedCheckNameDuplicates;

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
    const isTimingMessage = text.text.includes('TIMING') || text.text.includes('PERFECT') || text.text.includes('SUCCESS') || text.text.includes('SHIELD') || text.text.includes('MISSED');
    
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

// Firefly tier system constants
const FIREFLY_TIERS = {
  green: { name: 'Green', color: '#88ff88', points: 5, speed: 1.0 },     // Natural firefly green
  purple: { name: 'Purple', color: '#9966ff', points: 15, speed: 1.2 }, // Purple - survived 1 protection
  gold: { name: 'Gold', color: '#ffdd00', points: 25, speed: 1.5 },     // Gold - survived 2 protections  
  rainbow: { name: 'Rainbow', color: 'rainbow', points: 40, speed: 2.0 } // Rainbow - survived 3+ protections
};

// Helper function to convert firefly colors to valid particle colors
const getParticleColor = (firefly, fallbackColor = "#ffdd99") => {
  if (!firefly.color) return fallbackColor;
  
  if (firefly.color === 'rainbow') {
    // Generate a random rainbow color for particles
    const hue = Math.random() * 360;
    return `hsl(${hue}, 80%, 60%)`;
  }
  
  return firefly.color;
};

// Upgrade a firefly to the next tier after successful shield protection
const upgradeFirefly = (firefly) => {
  // Prevent evolution beyond rainbow tier
  if (firefly.tier === 'rainbow') {
    return { upgraded: false, alreadyMaxTier: true };
  }
  
  firefly.protectionCount++;
  
  // Determine new tier based on protection count
  let newTier;
  if (firefly.protectionCount >= 3) {
    newTier = 'rainbow';
  } else if (firefly.protectionCount === 2) {
    newTier = 'gold';
  } else if (firefly.protectionCount === 1) {
    newTier = 'purple';
  } else {
    newTier = 'green'; // Should not happen, but fallback
  }
  
  // Ensure we have a valid tier
  if (!FIREFLY_TIERS[newTier]) {
    console.warn(`Invalid tier: ${newTier}, falling back to rainbow`);
    newTier = 'rainbow';
  }
  
  // Only upgrade if we're moving to a higher tier
  if (newTier !== firefly.tier) {
    const oldTier = firefly.tier;
    firefly.tier = newTier;
    const tierData = FIREFLY_TIERS[newTier];
    firefly.color = tierData.color;
    firefly.points = tierData.points;
    
    // Track tier creation statistics (don't track green->purple as it's expected)
    if (newTier === 'purple') {
      tierStats.created.purple++;
    } else if (newTier === 'gold') {
      tierStats.created.gold++;
    } else if (newTier === 'rainbow') {
      tierStats.created.rainbow++;
    }
    
    // Rainbow fireflies are slightly larger and more dramatic
    if (newTier === 'rainbow') {
      firefly.size = Math.max(firefly.size, 3 + r() * 2);
      firefly.glowIntensity = 2.0 + r() * 0.5; // Extra bright
    }
    
    // Return true to indicate an upgrade happened (for visual feedback)
    return { upgraded: true, from: oldTier, to: newTier };
  }
  
  return { upgraded: false };
};

// Spawn a firefly directly in the gameplay area (for background spawning)
const spawnFireflyInArea = () => {
  if (otherFireflies.length >= CFG.maxFireflies) return;
  
  // All fireflies start as green fireflies
  const tier = 'green';
  const color = '#88ff88'; // Natural firefly green
  const points = 5;
  const protectionCount = 0;
  
  // Spawn in gameplay area
  const spawnX = 50 + r() * (w - 100);
  const spawnY = h * 0.6 + r() * h * 0.35;
  
  otherFireflies.push({
    x: spawnX,
    y: spawnY,
    captured: false,
    captureOffset: { x: 0, y: 0 },
    floatTimer: r() * TAU,
    flashTimer: r() * TAU,
    roamTarget: null,
    fadeIn: 1,
    glowIntensity: 1.0 + r() * 0.5,
    size: 2 + r() * 2,
    tier: tier,
    color: color,
    points: points,
    protectionCount: protectionCount,
    spawnFlash: 0, // No flash for background spawns
    vx: undefined,
    vy: undefined
  });
};

// Spawn new fireflies with simple twinkling effect
const spawnFirefly = (isPlayerSummoned = false) => {
  if (otherFireflies.length >= CFG.maxFireflies) return;
  
  // All fireflies start as green fireflies
  const tier = 'green';
  const color = '#88ff88'; // Natural firefly green
  const points = 5;
  const protectionCount = 0;
  
  // Spawn directly in gameplay area
  const playAreaMargin = 80;
  const topMargin = h * 0.25; // Avoid cat area
  const bottomMargin = 120; // Avoid timer/UI area
  
  const spawnX = playAreaMargin + r() * (w - playAreaMargin * 2);
  const spawnY = topMargin + r() * (h - topMargin - bottomMargin);
  
  otherFireflies.push({
    x: spawnX,
    y: spawnY,
    captured: false,
    captureOffset: { x: 0, y: 0 },
    floatTimer: r() * TAU,
    flashTimer: r() * TAU,
    roamTarget: null,
    fadeIn: 1, // Fully visible immediately
    glowIntensity: 1.0 + r() * 0.5,
    size: 2 + r() * 2,
    tier: tier,
    color: color,
    points: points,
    protectionCount: protectionCount,
    // Only player-summoned fireflies get spawn flash
    spawnFlash: isPlayerSummoned ? 10 : 0, // Flash for 10 frames only if player summoned
    vx: undefined,
    vy: undefined
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
        
        // Give it velocity to fly away upward (same as shield fear response)
        let disperseAngle = -Math.PI/2; // Primarily upward
        disperseAngle += (Math.random() - 0.5) * 1.0; // Allow some spread but mostly upward
        const disperseSpeed = 5 + Math.random() * 3; // Faster dispersal
        randomFirefly.vx = Math.cos(disperseAngle) * disperseSpeed;
        randomFirefly.vy = Math.sin(disperseAngle) * disperseSpeed;
        
        // Add particle effect
        createDispersalEffect(randomFirefly);
      }
    }
  }
  
  otherFireflies.forEach(firefly => {
    // Handle dying animation (floating upward off screen)
    if (firefly.dyingAnimation) {
      firefly.deathTimer++;
      firefly.x += firefly.vx;
      firefly.y += firefly.vy;
      
      // Create subtle dust trail - like fairy dust left behind
      if (firefly.deathTimer % 6 === 0) { // Every 6 frames - less frequent
        const fadeIntensity = 1 - (firefly.deathTimer / firefly.deathMaxTime);
        
        // Create 1-2 dust particles for subtle trail
        for (let i = 0; i < 1 + Math.floor(r() * 2); i++) {
          particles.push({
            x: firefly.x + (r() - 0.5) * 4, // Closer to firefly path
            y: firefly.y + (r() - 0.5) * 4,
            vx: -firefly.vx * 0.2 + (r() - 0.5) * 0.8, // Gentle trail behind
            vy: -firefly.vy * 0.2 + (r() - 0.5) * 0.8,
            size: 0.2 + r() * 0.4, // Small dust-like particles
            life: 0,
            maxLife: 30 + r() * 20, // Medium duration
            color: getParticleColor(firefly, "#ffdd99"), // Soft warm color
            glow: true,
            twinkle: r() * TAU,
          });
        }
      }
      
      // Maintain panic speed - scared fireflies don't slow down until they're safe!
      firefly.vx *= 0.995; // Very minimal slowdown
      firefly.vy *= 0.995;
      
      // Mark for removal when escaped off any screen edge or timer expires
      const offScreen = firefly.x < -50 || firefly.x > w + 50 || 
                       firefly.y < -50 || firefly.y > h + 50;
      if (firefly.deathTimer >= firefly.deathMaxTime || offScreen) {
        firefly.readyForRemoval = true;
      }
      return; // Skip normal updates for dying fireflies
    }
    
    // Handle simple spawn flash countdown
    if (firefly.spawnFlash > 0) {
      firefly.spawnFlash--;
    }
    
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
    
    // Handle immunity countdown
    if (firefly.immunity > 0) {
      firefly.immunity--;
    }
  });
  
  // Remove fireflies that have completed death animation
  otherFireflies = otherFireflies.filter(f => !f.readyForRemoval);
};

// Update behavior for captured fireflies
const updateCapturedFirefly = (firefly, playerX, playerY) => {
  // Safety check: Ensure firefly has a valid tier
  if (!firefly.tier || !FIREFLY_TIERS[firefly.tier]) {
    console.warn(`Captured firefly has invalid tier: ${firefly.tier}, resetting to green`);
    firefly.tier = 'green';
    firefly.color = '#88ff88';
    firefly.points = 5;
    firefly.protectionCount = Math.min(firefly.protectionCount || 0, 0);
  }
  
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
  // Safety check: Ensure firefly has a valid tier
  if (!firefly.tier || !FIREFLY_TIERS[firefly.tier]) {
    console.warn(`Firefly has invalid tier: ${firefly.tier}, resetting to green`);
    firefly.tier = 'green';
    firefly.color = '#88ff88';
    firefly.points = 5;
    firefly.protectionCount = Math.min(firefly.protectionCount || 0, 0);
  }
  
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
  
  // Check for player capture when charging - but not when overheated or immune
  if (charging && !summonOverheated && !firefly.immunity) {
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
    // Higher tier fireflies move faster (risk/reward balance)
    const tierSpeedMultiplier = FIREFLY_TIERS[firefly.tier]?.speed || 1.0;
    const speed = (0.3 + r() * 0.2) * speedMultiplier * tierSpeedMultiplier;
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
    let alpha = firefly.fadeIn;
    
    // Handle dying animation alpha (fade out as they float away)
    if (firefly.dyingAnimation) {
      const deathProgress = firefly.deathTimer / firefly.deathMaxTime;
      alpha = Math.max(0, 1 - deathProgress * 1.5); // Fade out faster for dramatic effect
    }
    // Handle spawning animation alpha (fade in as they enter)
    else if (firefly.spawningAnimation) {
      const spawnProgress = firefly.spawnTimer / firefly.spawnMaxTime;
      alpha = Math.min(1, spawnProgress * 2); // Fade in quickly for visibility
    }
    
    if (alpha <= 0) return;
    
    // Natural firefly flashing behavior - they should actually fade out completely sometimes
    const flashCycle = sin(firefly.flashTimer) * 0.5 + 0.5; // 0 to 1 smooth transition
    const baseIntensity = firefly.captured ? 0.8 : 0.6; // Captured fireflies glow more
    
    // Real firefly behavior - they fade out completely then back in
    let visibility;
    
    // Override visibility for spawn flash - make it very bright and visible
    if (firefly.spawnFlash) {
      visibility = 1.0; // Maximum brightness during spawn flash
    } else if (firefly.tier !== 'green') {
      // Evolved fireflies stay solid - no breathing animation
      visibility = baseIntensity + 0.4; // Stay at maximum brightness consistently
    } else {
      // Base tier fireflies have natural breathing animation
      if (flashCycle < 0.1) {
        visibility = 0; // Completely dark for brief moments
      } else if (flashCycle < 0.3) {
        visibility = (flashCycle - 0.1) / 0.2 * baseIntensity; // Fade in
      } else if (flashCycle > 0.8) {
        visibility = (1 - flashCycle) / 0.2 * baseIntensity; // Fade out
      } else {
        visibility = baseIntensity + (flashCycle - 0.3) * 0.4; // Stay bright in middle
      }
    }
    
    if (visibility <= 0) return; // Skip drawing when invisible
    
    // Dynamic firefly colors based on tier (both captured and free fireflies show tier colors)
    let bodyColor, glowColor, rgbValues;
    let colorToUse;
    
    // Override color for spawn flash effect - alternate between white and green
    if (firefly.spawnFlash > 0) {
      // Alternate between white and green every few frames during flash
      const flashPhase = Math.floor((10 - firefly.spawnFlash) / 2) % 2; // 0 or 1
      if (flashPhase === 0) {
        rgbValues = "255, 255, 255"; // Flash white
      } else {
        rgbValues = "136, 255, 136"; // Flash green (natural firefly color)
      }
    } else if (firefly.tier === 'rainbow' || firefly.color === 'rainbow') {
      // Rainbow effect for rainbow fireflies - cycle through colors
      const rainbowSpeed = now * 0.003 + firefly.floatTimer; // Unique per firefly
      const hue = (sin(rainbowSpeed) * 0.5 + 0.5) * 360; // 0-360 degrees
      
      // Convert HSL to RGB for rainbow effect
      const hslToRgb = (h, s, l) => {
        h /= 360;
        const a = s * Math.min(l, 1 - l);
        const f = n => {
          const k = (n + h * 12) % 12;
          return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        };
        return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
      };
      
      const [r, g, b] = hslToRgb(hue, 0.8, 0.6); // High saturation, medium lightness
      rgbValues = `${r}, ${g}, ${b}`;
    } else {
      // Use the tier's static color
      colorToUse = firefly.color || FIREFLY_TIERS[firefly.tier]?.color || '#88ff88';
      
      // Convert hex to RGB for alpha blending
      const r = parseInt(colorToUse.slice(1, 3), 16);
      const g = parseInt(colorToUse.slice(3, 5), 16); 
      const b = parseInt(colorToUse.slice(5, 7), 16);
      rgbValues = `${r}, ${g}, ${b}`;
    }
    
    // Captured fireflies get a slight blue tint but keep their tier color
    if (firefly.captured) {
      // Mix tier color with slight blue tint for captured effect
      const tierRgb = rgbValues.split(', ').map(Number);
      const blueR = Math.round(tierRgb[0] * 0.7 + 120 * 0.3);
      const blueG = Math.round(tierRgb[1] * 0.7 + 180 * 0.3);
      const blueB = Math.round(tierRgb[2] * 0.7 + 255 * 0.3);
      rgbValues = `${blueR}, ${blueG}, ${blueB}`;
    }
    
    bodyColor = `rgba(${rgbValues}, ${visibility * alpha})`;
    glowColor = `rgba(${rgbValues}, ${visibility * alpha * 0.8})`;
    
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
    
    // Glow boost for spawn flash
    if (firefly.spawnFlash > 0) {
      const flashBoost = firefly.spawnFlash / 10; // 0 to 1 over 10 frames
      maxGlowRadius += firefly.size * 4 * flashBoost; // Extra glow during flash
    }
    
    // Fading glow for dying fireflies
    if (firefly.dyingAnimation) {
      const deathFade = 1 - (firefly.deathTimer / firefly.deathMaxTime);
      maxGlowRadius *= (0.5 + deathFade * 0.5); // Diminishing glow as they die
    }
    
    const currentGlowRadius = Math.max(1, baseGlowRadius + (maxGlowRadius - baseGlowRadius) * visibility);
    
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
    const coreRadius = Math.max(1, firefly.size * 2);
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
    
    if (capturedFireflies.length > 0) {
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
  
  // Trigger star twinkle effect for magical delivery feedback
  starTwinkleTimer = 120; // 2 seconds at 60fps
  
  // Enhanced scoring system with firefly tiers
  const basePoints = capturedFireflies.reduce((sum, firefly) => sum + (firefly.points || 5), 0);
  // Shield streak bonus (based on shield performance, not deliveries)
  const streakMultiplier = Math.min(3, Math.max(1, 1 + (shieldStreak - 1) * 0.5));
  const pointsAwarded = Math.floor(basePoints * streakMultiplier);
  
  score += pointsAwarded;
  
  // Count fireflies by tier for feedback
  const tierCounts = capturedFireflies.reduce((counts, firefly) => {
    const tier = firefly.tier || 'green';
    counts[tier] = (counts[tier] || 0) + 1;
    return counts;
  }, {});
  
  // Show special feedback for high-tier deliveries
  if (tierCounts.rainbow > 0) {
    addScoreText(`+${tierCounts.rainbow} RAINBOW! (+${tierCounts.rainbow * 40}pts)`, w / 2, h / 2 - 120, '#ff00ff', 240);
  } else if (tierCounts.gold > 0) {
    addScoreText(`+${tierCounts.gold} GOLD! (+${tierCounts.gold * 25}pts)`, w / 2, h / 2 - 120, '#ffdd00', 180);
  } else if (tierCounts.purple > 0) {
    addScoreText(`+${tierCounts.purple} PURPLE! (+${tierCounts.purple * 15}pts)`, w / 2, h / 2 - 120, '#9966ff', 120);
  }
  
  totalCollected += capturedFireflies.length;
  
  // Track tier delivery statistics
  capturedFireflies.forEach(firefly => {
    const tier = firefly.tier || 'green';
    tierStats[tier]++;
  });
  
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
  if (shieldStreak >= 5) {
    feedbackColor = "#ffaa00"; // Hot orange for big streaks
  } else if (shieldStreak >= 3) {
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
  if (!tutorialComplete && tutorialStep === 0) {
    tutorialDeliveryCount++;
    if (tutorialDeliveryCount === 1) {
      firstDeliveryMade = true;
      showTutorialElements = false; // Hide tutorial elements after first delivery
      // Stay on step 0 for second delivery
    } else if (tutorialDeliveryCount >= 2) {
      tutorialStep = 1; // Move to summoning tutorial after second delivery
      tutorialStep1Timer = 0; // Reset step 1 timer
      // Spawn more fireflies for next phase
      for (let i = 0; i < 8; i++) {
        spawnFirefly();
      }
    }
  }
  
  // Advance from overheat tutorial step when player delivers fireflies and restores mana
  if (!tutorialComplete && tutorialStep === 1.5 && manaEnergy > 10) {
    tutorialStep = 2; // Move to shield tutorial after they learn to restore energy
    catEyeChangeTimer = 0; // Reset timer so player gets full cycle to learn
    catEyeChangeTime = 2000; // Set to 2 seconds for tutorial demonstration
  }
  
  // Advance from drop tutorial step when player delivers fireflies after dropping
  if (!tutorialComplete && tutorialStep === 3) {
    tutorialStep = 4; // Move to next tutorial step after they deliver (showing they've read the drop instruction)
    tutorialStep4Timer = 0; // Reset step 4 timer
  }
};

// ===== PLAYER SYSTEM =====

// Get current player position (follows mouse)
const getPlayerPosition = () => {
  return { x: mx, y: my };
};

// Get current shield radius (matches visual shield size)
const getShieldRadius = () => {
  // Calculate naturalGlow the same way as in player rendering
  const glowCycle = sin(performance.now() * 0.002) * 0.5 + 0.5;
  const baseIntensity = mouseMoving ? 0.9 : 0.6;
  const naturalGlow = baseIntensity + glowCycle * 0.5;
  
  const baseGlowRadius = 18;
  const maxGlowRadius = charging ? 40 : 28;
  const currentGlowRadius = baseGlowRadius + (maxGlowRadius - baseGlowRadius) * naturalGlow;
  return currentGlowRadius + 8; // Same calculation as visual shield
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
      if (!infiniteMode) {
        // Drain bioluminescence while shield is active - reduced drain rate
        manaEnergy = Math.max(0, manaEnergy - 0.1); // Reduced from 0.15 to 0.1
        
        // Add heat for sustained shield use (slower than summoning)
        summonHeat += 0.4; // Reduced from 0.5 for more forgiving gameplay
      }
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

const drawPlayerCharacter = (playerX, playerY, now) => {
  x.save();
  
  const pulse = sin(now * 0.008) * 0.3 + 0.7; // Natural firefly pulsing
  const manaPercent = manaEnergy / 100;
  
  // Firefly glow brightness based on mana level
  const glowIntensity = Math.max(0.3, manaPercent) * pulse;
  const glowRadius = 8 + glowIntensity * 6; // 8-14px radius based on mana
  
  // Blue firefly colors - vibrant when full mana, dull gray when empty, RED during warning flashes
  let coreColor, glowColor, outerGlow;
  if (isCurrentlyFlashing()) {
    // Red warning flash colors
    coreColor = `rgba(255, 180, 180, ${glowIntensity})`;
    glowColor = `rgba(255, 120, 120, ${glowIntensity * 0.8})`;
    outerGlow = `rgba(220, 80, 80, ${glowIntensity * 0.4})`;
  } else if (manaPercent > 0.5) {
    // High mana - vibrant blue
    coreColor = `rgba(180, 220, 255, ${glowIntensity})`;
    glowColor = `rgba(120, 180, 255, ${glowIntensity * 0.8})`;
    outerGlow = `rgba(80, 140, 220, ${glowIntensity * 0.4})`;
  } else if (manaPercent > 0.2) {
    // Medium mana - dimmer blue
    coreColor = `rgba(140, 180, 220, ${glowIntensity})`;
    glowColor = `rgba(100, 140, 200, ${glowIntensity * 0.8})`;
    outerGlow = `rgba(70, 110, 180, ${glowIntensity * 0.4})`;
  } else {
    coreColor = `rgba(160, 160, 180, ${glowIntensity})`;
    glowColor = `rgba(120, 120, 140, ${glowIntensity * 0.8})`;
    outerGlow = `rgba(80, 80, 100, ${glowIntensity * 0.4})`;
  }
  
  // Outer glow (largest) - blue shadow to match firefly, red during warning
  x.shadowColor = isCurrentlyFlashing() ? "#dc5050" : (manaPercent > 0.2 ? "#5090dc" : "#606080");
  x.shadowBlur = 12;
  setFill(outerGlow);
  x.beginPath();
  x.arc(playerX, playerY, glowRadius, 0, TAU);
  x.fill();
  
  // Middle glow
  x.shadowBlur = 8;
  setFill(glowColor);
  x.beginPath();
  x.arc(playerX, playerY, glowRadius * 0.6, 0, TAU);
  x.fill();
  
  // Bright core
  x.shadowBlur = 4;
  setFill(coreColor);
  x.beginPath();
  x.arc(playerX, playerY, glowRadius * 0.3, 0, TAU);
  x.fill();
  
  x.shadowBlur = 0;
  
  // Simple shield bubble when active - color changes based on mana level
  if (shieldActive) {
    const shieldPulse = sin(now * 0.01) * 0.2 + 0.8;
    const shieldRadius = glowRadius + 8; // Just outside the firefly glow
    
    // Shield color based on mana level
    let shieldStrokeColor, shieldFillColor, shieldShadowColor;
    if (manaPercent > 0.2) {
      // High mana - blue/cyan
      shieldStrokeColor = `rgba(102, 204, 255, ${shieldPulse * 0.6})`;
      shieldFillColor = `rgba(150, 220, 255, ${shieldPulse * 0.1})`;
      shieldShadowColor = "#66ccff";
    } else if (manaPercent > 0.05) {
      // Medium mana (5-20%) - orange warning
      shieldStrokeColor = `rgba(255, 153, 102, ${shieldPulse * 0.6})`;
      shieldFillColor = `rgba(255, 200, 150, ${shieldPulse * 0.1})`;
      shieldShadowColor = "#ff9966";
    } else {
      // Critical mana (<5%) - red danger
      shieldStrokeColor = `rgba(255, 102, 102, ${shieldPulse * 0.6})`;
      shieldFillColor = `rgba(255, 150, 150, ${shieldPulse * 0.1})`;
      shieldShadowColor = "#ff6666";
    }
    
    x.shadowColor = shieldShadowColor;
    x.shadowBlur = 6;
    setStroke(shieldStrokeColor);
    setLineWidth(2);
    x.beginPath();
    x.arc(playerX, playerY, shieldRadius, 0, TAU);
    x.stroke();
    x.shadowBlur = 0;
    
    setFill(shieldFillColor);
    x.beginPath();
    x.arc(playerX, playerY, shieldRadius, 0, TAU);
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
      // Handle rainbow and hex colors properly
      let baseColor = particle.color;
      if (baseColor === 'rainbow') {
        // Use a dynamic color for rainbow particles
        const hue = (particle.life * 5) % 360; // Cycle through hues
        baseColor = `hsl(${hue}, 80%, 60%)`;
      }
      
      // Create gradient with proper color handling
      if (baseColor.startsWith('#')) {
        // Hex color - append alpha
        gradient.addColorStop(0, baseColor + Math.floor(alpha * 220).toString(16).padStart(2, '0')); 
        gradient.addColorStop(0.5, baseColor + Math.floor(alpha * 120).toString(16).padStart(2, '0'));
        gradient.addColorStop(0.8, baseColor + Math.floor(alpha * 40).toString(16).padStart(2, '0'));
      } else {
        // Non-hex color (hsl, rgb, etc.) - use rgba
        gradient.addColorStop(0, baseColor.replace(')', `, ${alpha * 0.86})`).replace('hsl', 'hsla'));
        gradient.addColorStop(0.5, baseColor.replace(')', `, ${alpha * 0.47})`).replace('hsl', 'hsla'));
        gradient.addColorStop(0.8, baseColor.replace(')', `, ${alpha * 0.16})`).replace('hsl', 'hsla'));
      }
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

// Create escape effect for fireflies fleeing from Nyx
const createDeathEffect = (firefly) => {
  // Initial dust puff - subtle panic effect
  for (let i = 0; i < 5; i++) {
    const spreadAngle = r() * TAU; // All directions for dust puff
    const speed = 0.5 + r() * 1.2;
    particles.push({
      x: firefly.x + (r() - 0.5) * 2,
      y: firefly.y + (r() - 0.5) * 2,
      vx: Math.cos(spreadAngle) * speed,
      vy: Math.sin(spreadAngle) * speed,
      size: 0.3 + r() * 0.4, // Small dust particles
      life: 0,
      maxLife: 35 + r() * 25, // Moderate duration
      color: getParticleColor(firefly, "#ffdd99"), // Soft warm dust color
      glow: true,
      twinkle: r() * TAU,
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

// Firefly drop effect (orange/pink/white burst)
const createDropEffect = (x, y) => {
  // Get player position for magical burst effect
  const { x: playerX, y: playerY } = getPlayerPosition();
  
  // Main burst of orange sparkles around the player
  for (let i = 0; i < 20; i++) {
    const angle = r() * TAU;
    const distance = 8 + r() * 25; // Moderate spread
    const speed = 0.6 + r() * 1.8; // Good visibility
    particles.push({
      x: playerX + cos(angle) * (3 + r() * 12), 
      y: playerY + sin(angle) * (3 + r() * 12),
      vx: cos(angle) * speed,
      vy: sin(angle) * speed - 0.2, // Slight upward drift
      size: 0.5 + r() * 0.8, 
      life: 0,
      maxLife: 50 + r() * 30, 
      color: i < 6 ? "#ff6b35" : (i < 12 ? "#ff8c42" : "#ffab76"), // Orange gradient
      glow: true,
      twinkle: r() * TAU,
    });
  }
  
  // Pink/white accent sparkles
  for (let i = 0; i < 8; i++) {
    const angle = r() * TAU;
    const speed = 0.4 + r() * 1.0;
    particles.push({
      x: playerX + (r() - 0.5) * 10,
      y: playerY + (r() - 0.5) * 10,
      vx: cos(angle) * speed,
      vy: sin(angle) * speed - 0.1,
      size: 0.3 + r() * 0.5,
      life: 0,
      maxLife: 60 + r() * 20,
      color: i < 4 ? "#ffccaa" : "#ffffff", // Pink-white accents
      glow: true,
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
  
  // Handle right-click for firefly drop/repel
  if (e.button === 2) {
    handleRightMouseDown(e);
    return;
  }
  
  if (showHelp) {
    // Check if clicking on mode toggle button in help menu
    if (window.helpModeToggle) {
      const btn = window.helpModeToggle;
      if (mx >= btn.x - btn.width/2 && mx <= btn.x + btn.width/2 &&
          my >= btn.y - btn.height/2 && my <= btn.y + btn.height/2) {
        
        // Toggle infinite mode
        infiniteMode = !infiniteMode;
        
        // Show confirmation message
        const modeText = infiniteMode ? "Infinite Mode Enabled" : "Normal Mode Enabled";
        addScoreText(modeText, w / 2, h / 2 - 100, infiniteMode ? '#ffaa00' : '#69e4de', 400);
        addScoreText("Game Restarted", w / 2, h / 2 - 70, '#ffffff', 400);
        
        // Restart the game to reset everything
        restartGame();
        
        // Close help menu after mode toggle so game can start running
        showHelp = false;
        return;
      }
    }
    
    // Don't close help menu on clicks - only ESC closes it
    return;
  }
  
  // Handle name input button clicks
  if (showNameInput && window.nameInputButtons) {
    const buttons = window.nameInputButtons;
    
    // Submit button
    if (mx >= buttons.submit.x - buttons.submit.width/2 && 
        mx <= buttons.submit.x + buttons.submit.width/2 &&
        my >= buttons.submit.y - buttons.submit.height/2 && 
        my <= buttons.submit.y + buttons.submit.height/2) {
      
      // Submit score with name (but check for duplicates first)
      if (pendingScore && !nameWarning) {
        submitScore(playerName || "Anonymous", "Submit button clicked");
      }
      return;
    }
    
    // Skip button  
    if (mx >= buttons.skip.x - buttons.skip.width/2 && 
        mx <= buttons.skip.x + buttons.skip.width/2 &&
        my >= buttons.skip.y - buttons.skip.height/2 && 
        my <= buttons.skip.y + buttons.skip.height/2) {
      
      // Submit as Anonymous
      if (pendingScore) {
        submitScore("Anonymous", "Skip button clicked");
      }
      return;
    }
    
    // Don't process other clicks when showing name input
    return;
  }
  
  // Handle game over button clicks (but not when leaderboard is open)
  if ((gameOver || gameWon) && !showLeaderboard && window.gameOverButtons) {
    const buttons = window.gameOverButtons;
    
    // Leaderboard button
    if (mx >= buttons.leaderboard.x - buttons.leaderboard.width/2 && 
        mx <= buttons.leaderboard.x + buttons.leaderboard.width/2 &&
        my >= buttons.leaderboard.y - buttons.leaderboard.height/2 && 
        my <= buttons.leaderboard.y + buttons.leaderboard.height/2) {
      
      if (!showLeaderboard) {
        // Load data when opening leaderboard (same as 'L' key)
        loadLeaderboardData().then(() => {
          showLeaderboard = true;
          leaderboardOpenTime = Date.now();
          startPlayerHighlightAnimation();
        });
      } else {
        totalLeaderboardPauseTime += Date.now() - leaderboardOpenTime;
        showLeaderboard = false;
        leaderboardOpenTime = 0;
      }
      return;
    }
    
    // Play Again button
    if (mx >= buttons.playAgain.x - buttons.playAgain.width/2 && 
        mx <= buttons.playAgain.x + buttons.playAgain.width/2 &&
        my >= buttons.playAgain.y - buttons.playAgain.height/2 && 
        my <= buttons.playAgain.y + buttons.playAgain.height/2) {
      
      restartGame();
      return;
    }
    
    // Handle accordion toggle
    if (window.gameOverAccordion) {
      const accordion = window.gameOverAccordion;
      if (mx >= accordion.x - accordion.width/2 && 
          mx <= accordion.x + accordion.width/2 &&
          my >= accordion.y - accordion.height/2 && 
          my <= accordion.y + accordion.height/2) {
        
        showDetailedStats = !showDetailedStats;
        return;
      }
    }
    
    // Don't restart game if clicking in game over screen area
    return;
  }
  
  if ((gameOver || gameWon) && !showNameInput) {
    restartGame();
    // Don't return - let the click continue to be processed for the new game
  }
  
  // Don't process clicks when showing name input
  if (showNameInput) return;
  
  // Handle leaderboard closure - clicking anywhere closes it (easy to reopen with L)
  if (showLeaderboard) {
    totalLeaderboardPauseTime += Date.now() - leaderboardOpenTime;
    showLeaderboard = false;
    leaderboardOpenTime = 0;
    return;
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
  
  // Right-click doesn't need mouse up handling (drop happens on mouse down)
  if (e.button === 2) {
    return;
  }
  
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
      playTone(200, 0.2, 0.2, 'triangle'); // More audible error sound
    }
  }
  
  hasPlayedChime = false; // Reset for next activation
};

// Right-click mouse down handler
const handleRightMouseDown = (e) => {
  e.preventDefault(); // Prevent context menu
  
  if (!gameStarted || gameOver) return;
  
  // Simple tap - drop fireflies immediately
  dropFireflies();
};

// Keyboard handler
const handleKeyDown = (e) => {
  // Handle name input first
  if (showNameInput) {
    e.preventDefault();
    
    if (e.code === "Enter") {
      // Submit score with name (but check for duplicates first)
      if (pendingScore && !nameWarning) {
        submitScore(playerName || "Anonymous", "Enter key pressed");
      }
      return;
    }
    
    if (e.code === "Escape") {
      // Submit as Anonymous (same as Skip button)
      if (pendingScore) {
        submitScore("Anonymous", "Escape key pressed");
      }
      return;
    }
    
    if (e.code === "Backspace") {
      playerName = playerName.slice(0, -1);
      checkNameDuplicates();
      return;
    }
    
    // Add character to name (limit to 20 characters)
    if (e.key.length === 1 && playerName.length < 20) {
      const char = e.key;
      // Allow letters, numbers, spaces, and basic punctuation
      if (/^[a-zA-Z0-9 \-_!.]$/.test(char)) {
        playerName += char;
        checkNameDuplicates();
      }
    }
    return;
  }
  
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
    
    // Improved scroll controls when help is open
    if (e.code === "ArrowUp" || e.code === "KeyW") {
      const scrollSpeed = e.shiftKey ? 75 : 35; // Faster with shift
      helpScrollOffset = Math.max(0, helpScrollOffset - scrollSpeed);
      return;
    }
    if (e.code === "ArrowDown" || e.code === "KeyS") {
      const scrollSpeed = e.shiftKey ? 75 : 35; // Faster with shift
      const maxScroll = window.helpMaxScroll || 400;
      helpScrollOffset = Math.min(maxScroll, helpScrollOffset + scrollSpeed);
      return;
    }
    
    // ESC key closes help menu
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



  
  // Toggle leaderboard
  if (e.code === "KeyL") {
    e.preventDefault();
    if (!showLeaderboard) {
      // Load data when opening leaderboard
      loadLeaderboardData().then(() => {
        showLeaderboard = true;
        leaderboardOpenTime = Date.now(); // Track when leaderboard opened
        startPlayerHighlightAnimation();
      });
    } else {
      totalLeaderboardPauseTime += Date.now() - leaderboardOpenTime; // Track pause time
      showLeaderboard = false;
    }
    return;
  }
  
  // Toggle help
  if (e.code === "Escape") {
    e.preventDefault();
    
    // Close leaderboard if it's open
    if (showLeaderboard) {
      totalLeaderboardPauseTime += Date.now() - leaderboardOpenTime; // Track pause time
      showLeaderboard = false;
      return;
    }
    
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

  // X key for firefly drop
  if (e.code === "KeyX") {
    e.preventDefault();
    if (!gameStarted) return;
    
    // Only drop once when X is first pressed
    if (!xPressed) {
      dropFireflies();
    }
    xPressed = true;
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

  if (e.code === "KeyX") {
    xPressed = false;
  }
};

// Handle mouse wheel for help menu scrolling
const handleWheel = (e) => {
  // Only handle wheel events when help menu is open
  if (!showHelp) return;
  
  e.preventDefault();
  
  // Improved scroll with variable speed based on content
  const baseScrollSpeed = 25;
  const scrollMultiplier = e.shiftKey ? 2.5 : 1; // Hold shift for faster scroll
  const scrollAmount = (e.deltaY > 0 ? baseScrollSpeed : -baseScrollSpeed) * scrollMultiplier;
  
  const maxScroll = window.helpMaxScroll || 400;
  helpScrollOffset = Math.max(0, Math.min(maxScroll, helpScrollOffset + scrollAmount));
};

// Utility functions for input handling
const canSummon = () => infiniteMode || manaEnergy >= 5;
const canShield = () => infiniteMode || (manaEnergy >= 1 && shieldCooldown === 0 && !summonOverheated);

const summonFirefly = () => {
  if (!canSummon()) {
    return;
  }
  
  // Check if at max firefly limit
  if (otherFireflies.length >= 120) {
    addScoreText("MAX FIREFLIES!", mx, my - 30, "#ffaa00", 180);
    playTone(300, 0.1, 0.1); // Short warning beep
    return;
  }
  
  // Fixed mana cost: 5 mana per firefly (20 fireflies from full 100 mana)
  if (!infiniteMode) {
    if (manaEnergy < 5) {
      // Not enough mana to summon
      addScoreText("NOT ENOUGH MANA!", mx, my - 30, "#ff4444", 180);
      playTone(200, 0.2, 0.2, 'triangle');
      return;
    }
    manaEnergy = Math.max(0, manaEnergy - 5);
  }
  
  // Only overheat when mana hits 0 (not in infinite mode)
  if (!infiniteMode && manaEnergy === 0 && !summonOverheated) {
    summonOverheated = true;
    overheatStunned = true;
    overheatCooldown = 180; // 3 seconds of cooldown (60fps * 3)
    addScoreText("OUT OF MANA!", mx, my - 30, "#ff4444", 300);
    playTone(200, 0.5, 0.1); // Overheat warning sound
    
    // Tutorial - advance to overheat explanation when it actually happens
    if (!tutorialComplete && tutorialStep === 1) {
      tutorialStep = 1.5; // Move to overheat explanation step
    }
    
    // Disperse captured fireflies aggressively - scared fireflies flee upward
    otherFireflies.forEach(firefly => {
      if (firefly.captured) {
        firefly.captured = false;
        // Scared fireflies flee upward toward the sky (same as shield fear response)
        let disperseAngle = -Math.PI/2; // Primarily upward
        disperseAngle += (r() - 0.5) * 1.0; // Allow some spread but mostly upward
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
  
  // Spawn exactly 1 firefly per summon (5 mana each, 20 total from full mana)
  spawnFirefly(true); // Player summoned firefly with twinkle effect
  
  createSummonEffect(mx, my); // Visual feedback at mouse position
  playTone(400, 0.15, 0.06); // Back to original tone
  quickFlashPower = 40; // Gentle flash
  screenShake = Math.min(screenShake + 1, 3); // Very subtle shake
};

const dropFireflies = () => {
  // Find all captured fireflies and scatter them with immunity
  let droppedCount = 0;
  
  otherFireflies.forEach(firefly => {
    if (firefly.captured) {
      firefly.captured = false;
      droppedCount++;
      
      // Grant temporary immunity to prevent immediate recapture
      firefly.immunity = 120; // 2 seconds at 60fps
      
      // Scatter outward from player position
      const angle = r() * Math.PI * 2; // Random direction
      const force = 3 + r() * 4; // Gentle to moderate force
      firefly.vx = Math.cos(angle) * force;
      firefly.vy = Math.sin(angle) * force;
      
      // Slight upward bias to feel more natural
      firefly.vy -= 1;
    }
  });
  
  if (droppedCount > 0) {
    playTone(300, 0.12, 0.05); // Gentle drop sound
    
    // Create orange burst effect
    createDropEffect(w / 2, h / 2);
    
    // Small screen shake for feedback
    screenShake = Math.min(screenShake + 2, 5);
    
    // Tutorial step 3 - let player read drop instruction, don't advance yet
  }
};

const activateShield = (isHoldAction = false) => {
  if (!infiniteMode && manaEnergy < 1) {
    // Play low-mana shield failure sound - use exact same sound as summoning failure

    playTone(200, 0.2, 0.2, 'triangle');
    return;
  }
  
  if (!infiniteMode && summonOverheated) {
    lastOverheatAttempt = Date.now();
    // Play overheated shield failure sound

    playTone(200, 0.15, 0.2, 'triangle');
    return;
  }
  
  // Consume mana when shield is activated (only in normal mode)
  if (!infiniteMode) {
    manaEnergy = Math.max(0, manaEnergy - 1);
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
  isNewHighScore = false; // Reset high score flag
  setNameInputState(false, "Game restart");
  playerName = ""; // Reset player name
  pendingScore = null; // Reset pending score
  nameWarning = ""; // Reset name warning
  scoreAlreadySubmitted = false; // Reset score submission flag
  
  // Clear any pending timeouts to prevent memory leaks
  if (duplicateCheckTimeout) {
    clearTimeout(duplicateCheckTimeout);
    duplicateCheckTimeout = null;
  }
  showDetailedStats = false; // Reset accordion state
  score = 0;
  totalCollected = 0;
  totalLost = 0;
  shieldStreak = 0;
  bestStreak = 0;
  shieldStats = { perfect: 0, great: 0, good: 0, missed: 0 };
  tierStats = { green: 0, purple: 0, gold: 0, rainbow: 0, created: { purple: 0, gold: 0, rainbow: 0 }, lost: { purple: 0, gold: 0, rainbow: 0 } };
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
  tutorialDeliveryCount = 0; // Reset delivery counter
  tutorialStep1Timer = 0; // Reset step 1 timer
  tutorialStep3Timer = 0; // Reset step 3 timer
  tutorialStep4Timer = 0; // Reset step 4 timer
  tutorialMissedShield = false; // Reset missed shield flag
  firstDeliveryMade = false;
  showTutorialElements = !wasTutorialCompleted; // Only show tutorial elements for new players
  
  // Reset timing
  startTime = tutorialComplete ? Date.now() : null; // Only start timer after tutorial
  lastDeliveryTime = Date.now(); // Reset delivery timer to prevent immediate game over
  totalHelpPauseTime = 0; // Reset help menu pause time
  helpOpenTime = 0;
  totalLeaderboardPauseTime = 0; // Reset leaderboard pause time
  leaderboardOpenTime = 0;
  lastSpawnTime = Date.now(); // Reset spawn timer
  
  // Spawn initial fireflies for tutorial/gameplay
  if (!tutorialComplete) {
    // Tutorial needs fireflies to demonstrate collection
    for (let i = 0; i < 20; i++) {
      spawnFirefly();
    }
  } else {
    // Regular game starts with plenty of fireflies
    for (let i = 0; i < 18; i++) {
      spawnFirefly();
    }
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
  
  // Ensure consistent font state - fix canvas pollution issue
  setFontBySize(16, 'body'); // Default tutorial font
  
  switch (tutorialStep) {
    case 0:
      // First step: Basic firefly collection - clean and simple
      setFill(`rgba(255, 255, 255, ${pulse})`);
      setFontBySize(18, 'body');
      x.fillText("Collect fireflies and deliver them to Nyx Felis", w / 2, h - 160);
      x.fillText("before the curiosity meter runs out", w / 2, h - 140);
      
      setFill(`rgba(100, 255, 100, ${pulse})`); // Green for input
      setFontBySize(16, 'body');
      x.fillText("Move your mouse to attract fireflies", w / 2, h - 115);
      
      // Show delivery zone ring around cat's mouth area
      const catX = w / 2;
      const catY = h * 0.2;
      const ringPulse = sin(tutorialTimer * 2) * 0.3 + 0.7;
      setStroke(`rgba(255, 215, 0, ${ringPulse * 0.8})`); // Gold highlight
      setLineWidth(3);
      x.setLineDash([8, 8]);
      x.beginPath();
      x.arc(catX, catY + 50, 80, 0, TAU); // Around cat's mouth/nose area
      x.stroke();
      x.setLineDash([]);
      break;
      
    case 1:
      // Summoning instruction
      setFill(`rgba(255, 255, 255, ${pulse})`);
      setFontBySize(18, 'body');
      x.fillText("Great! You can also summon more fireflies", w / 2, h - 165);
      x.fillText("But be careful - summoning costs mana", w / 2, h - 145);
      
      setFill(`rgba(100, 255, 100, ${pulse})`); // Green for action
      setFontBySize(16, 'body');
      x.fillText("TAP or CLICK to summon fireflies", w / 2, h - 120);
      break;
      
    case 1.5:
      // Mana management explanation
      setFill(`rgba(255, 255, 255, ${pulse})`);
      setFontBySize(18, 'body');
      x.fillText("Watch your mana! Summoning costs 5 mana each", w / 2, h - 165);
      x.fillText("Deliver fireflies to Nyx to restore 5 mana each", w / 2, h - 145);
      
      setFill(`rgba(100, 255, 100, ${pulse})`); // Green for action
      setFontBySize(16, 'body');
      x.fillText("Shields cost 1 mana - manage wisely!", w / 2, h - 120);
      break;
      
    case 2:
      // Shield mechanics - watch the eyes
      setFill(`rgba(255, 215, 0, ${pulse})`); // Gold for importance
      setFontBySize(20, 'body');
      x.fillText("Watch Nyx's eyes for flashes!", w / 2, h - 160);
      
      setFill(`rgba(100, 255, 100, ${pulse})`); // Green for input
      setFontBySize(18, 'body');
      x.fillText("Hold SPACE or MOUSE during eye flashes", w / 2, h - 135);
      
      if (tutorialMissedShield) {
        setFill(`rgba(255, 100, 100, ${pulse})`); // Red for emphasis
        setFontBySize(16, 'body');
        x.fillText("Try again - watch for the eye flashes!", w / 2, h - 110);
      }
      break;
      
    case 3:
      // Evolution success - explain evolved fireflies and dropping
      setFill(`rgba(255, 255, 255, ${pulse})`);
      setFontBySize(18, 'body');
      x.fillText("Great! Your fireflies evolved and are worth more", w / 2, h - 180);
      x.fillText("Use RIGHT-CLICK or X to drop them here:", w / 2, h - 160);
      
      setFill(`rgba(100, 255, 100, ${pulse})`); // Green for action
      setFontBySize(16, 'body');
      x.fillText("Dropping gives you time to keep Nyx satisfied!", w / 2, h - 135);
      
      // Highlight drop zone in bottom left
      const dropZoneX = w * 0.15;
      const dropZoneY = h * 0.85;
      const ringPulse3 = sin(tutorialTimer * 2) * 0.3 + 0.7;
      setStroke(`rgba(255, 165, 0, ${ringPulse3 * 0.8})`); // Orange highlight
      setLineWidth(3);
      x.setLineDash([6, 6]);
      x.beginPath();
      x.arc(dropZoneX, dropZoneY, 60, 0, TAU);
      x.stroke();
      x.setLineDash([]);
      
      setFill(`rgba(255, 165, 0, ${pulse})`);
      x.font = `14px ${FONTS.body}`;
      x.fillText("Drop Zone", dropZoneX, dropZoneY + 80);
      break;
      
    case 4:
      // Drop mechanics and evolution strategy
      setFill(`rgba(255, 255, 255, ${pulse})`);
      x.font = `18px ${FONTS.body}`;
      x.fillText("Use RIGHT-CLICK or X to drop fireflies", w / 2, h - 165);
      x.fillText("Drop evolved fireflies and collect them later to evolve further", w / 2, h - 145);
      
      setFill(`rgba(100, 255, 100, ${pulse})`); // Green for action
      x.font = `16px ${FONTS.body}`;
      x.fillText("Try dropping evolved fireflies for more points!", w / 2, h - 120);
      break;
      
    case 5:
      // Curiosity meter explanation
      setFill(`rgba(150, 100, 255, ${pulse})`); // Purple for curiosity
      x.font = `20px ${FONTS.body}`;
      x.fillText("The Curiosity Meter", w / 2, h - 180);
      
      setFill(`rgba(255, 255, 255, ${pulse})`);
      x.font = `16px ${FONTS.body}`;
      x.fillText("Watch the purple bar at the top", w / 2, h - 155);
      x.fillText("It drops when you don't collect fireflies", w / 2, h - 135);
      
      setFill(`rgba(255, 100, 100, ${pulse})`); // Red for warning
      x.font = `15px ${FONTS.body}`;
      x.fillText("If curiosity hits zero, you lose your streak!", w / 2, h - 110);
      break;
      
    case 6:
      // Tutorial completion
      setFill(`rgba(100, 255, 100, ${pulse})`); // Green for completion
      x.font = `22px ${FONTS.body}`;
      x.fillText("Tutorial Complete, Good luck!", w / 2, h - 140);
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
  

  
  // Content area setup with proper spacing and layout constants
  const SECTION_MARGIN = 32;        // Space between major sections
  const HEADER_MARGIN = 20;         // Space after section headers  
  const LINE_HEIGHT = 30;           // Comfortable line height for readability
  const BULLET_INDENT = 0;          // Center-aligned, no indent needed
  
  const contentStartY = h * 0.08 + 80; // Start below title
  const lineHeight = LINE_HEIGHT;
  
  // Structured content with proper spacing and organization
  const sections = [
    {
      type: 'header',
      text: 'CONTROLS'
    },
    {
      type: 'content',
      lines: [
        '• Move mouse to guide Lampyris and collect fireflies',
        '• Click rapidly to summon fireflies (costs bioluminescence/mana)', 
        '• Hold mouse to activate protective shield (costs bioluminescence/mana)',
        '• Right-click or X key to drop fireflies (strategic for evolved fireflies)',
        `• ESC for help  •  M to toggle audio: ${audioEnabled ? 'ON' : 'OFF'}`
      ]
    },

    {
      type: 'section-break'
    },
    {
      type: 'header', 
      text: 'OBJECTIVE'
    },
    {
      type: 'content',
      lines: [
        '• Collect fireflies and deliver them to Nyx Felis in the Sky',
        '• Firefly Evolution System:',
        '  - Green (5 points) → Purple (15 points)',
        '  - Gold (25 points) → Rainbow (40 points)',
        '• Shield fireflies during color changes to evolve them to higher tiers',
        '• Watch delivery pressure timer - Green→Yellow→Red shows deadline urgency',
        '• Deliver before timer reaches red (15s deadline) or curiosity drops',
        '• Survive until dawn (3 minutes) while building delivery streaks for score multipliers (up to 300%)'
      ]
    },
    {
      type: 'section-break'
    },
    {
      type: 'header',
      text: 'SHIELD SYSTEM'
    },
    {
      type: 'content', 
      lines: [
        '• When Nyx\'s eyes begin to shift colors, be ready to shield',
        '• PERFECT timing (white flash) protects AND evolves ALL fireflies',
        '• Good timing (yellow/green) saves most captured fireflies',
        '• Poor timing: some fireflies may escape (but won\'t evolve)',
        '• Higher tier fireflies move faster - risk vs reward!',
        '• Master timing to prevent curiosity from reaching -50 (game over)'
      ]
    },
    {
      type: 'section-break'
    },
    {
      type: 'header',
      text: 'STRATEGY TIPS'
    },
    {
      type: 'content',
      lines: [
        '• Manage bioluminescence (mana) wisely - summoning and shields cost energy',
        '• Game overheats when mana reaches zero - click rapidly to recover',
        '• Risk vs reward: collect more fireflies vs deliver safely before deadline',
        '• Master perfect shield timing for protection and firefly evolution',
        '• Keep moving! Idle too long and fireflies will disperse',
        '• Protect your delivery streak - losing fireflies breaks streaks',
        '• Watch both pressure timer AND Nyx\'s eyes - timing is everything!',
        '• Build rainbow collections - rainbow fireflies worth 8x green ones'
      ]
    },
    {
      type: 'section-break'
    },
    {
      type: 'header',
      text: 'GAME MODE'
    },
    {
      type: 'mode-indicator'
    },
    {
      type: 'section-break'
    },
    {
      type: 'toggle-switch'
    },
    {
      type: 'section-break'
    },
    {
      type: 'content',
      lines: [
        '• Click to switch modes (the game will restart)',
        '• Normal Mode: Standard gameplay with mana management and time pressure',
        '• Infinite Mode: Unlimited mana, no time pressure, endless gameplay',
        '• Infinite Mode: Perfect for casual play, learning mechanics, and firefly evolution mastery',
        '• Toggle safely resets game to prevent mid-game confusion'
      ]
    }
  ];
  
  // Convert sections to flat rules array for rendering
  const rules = [];
  sections.forEach(section => {
    if (section.type === 'header') {
      rules.push(section.text);
    } else if (section.type === 'content') {
      section.lines.forEach(line => rules.push(line));
    } else if (section.type === 'section-break') {
      rules.push(''); // Add spacing
    } else if (section.type === 'mode-indicator') {
      rules.push('__MODE_INDICATOR__'); // Special marker
    } else if (section.type === 'toggle-switch') {
      rules.push('__TOGGLE_SWITCH__'); // Special marker
    }
  });
  
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
      
      // Section headers - clean typography without background
      if (rule === "CONTROLS" || rule === "INFINITE MODE" || rule === "OBJECTIVE" || 
          rule === "SHIELD SYSTEM" || rule === "STRATEGY TIPS" || rule === "GAME MODE") {
        
        // Header text with clean styling
        setFill("#e8b89a");
        x.shadowColor = "rgba(232, 184, 154, 0.3)";
        x.shadowBlur = 3;
        x.font = `bold 20px ${FONTS.body}`;
        x.fillText(rule, w / 2, y);
        x.shadowBlur = 0;
        
      } else if (rule === "__MODE_INDICATOR__") {
        // Current mode indicator
        setFill(infiniteMode ? "#ffaa00" : "#69e4de");
        x.font = `16px ${FONTS.body}`;
        x.shadowColor = "rgba(0,0,0,0.8)";
        x.shadowBlur = 4;
        const currentModeText = infiniteMode ? "INFINITE MODE ACTIVE" : "NORMAL MODE ACTIVE";
        x.fillText(currentModeText, w / 2, y);
        x.shadowBlur = 0;
        
      } else if (rule === "__TOGGLE_SWITCH__") {
        // Toggle switch design with proper spacing
        const switchWidth = 200;
        const switchHeight = 40;
        const switchX = w / 2;
        const switchY = y; // Use normal line position for even spacing
        
        // Check if mouse is hovering over switch
        const isSwitchHovering = mx >= switchX - switchWidth/2 && 
                                 mx <= switchX + switchWidth/2 &&
                                 my >= switchY - switchHeight/2 && 
                                 my <= switchY + switchHeight/2;
        
        // Draw switch track (background) - darker for better contrast
        const trackColor = "#1a1a1a";
        setFill(trackColor);
        x.fillRect(switchX - switchWidth/2, switchY - switchHeight/2, switchWidth, switchHeight);
        
        // Switch track border - brighter for visibility
        setStroke("#555555");
        setLineWidth(2);
        x.strokeRect(switchX - switchWidth/2, switchY - switchHeight/2, switchWidth, switchHeight);
        
        // Draw switch button (slides left/right)
        const buttonWidth = switchWidth / 2 - 6;
        const buttonHeight = switchHeight - 6;
        const buttonX = infiniteMode ? 
          switchX + switchWidth/4 : // Right side for infinite mode
          switchX - switchWidth/4;  // Left side for normal mode
        
        // Better contrast button colors
        const buttonColor = infiniteMode ? "#cc7700" : "#2a6b63";
        const hoverButtonColor = isSwitchHovering ? 
          (infiniteMode ? "#ff9900" : "#3a8b7a") : buttonColor;
        
        x.shadowColor = buttonColor;
        x.shadowBlur = isSwitchHovering ? 12 : 8;
        setFill(hoverButtonColor);
        x.fillRect(buttonX - buttonWidth/2, switchY - buttonHeight/2, buttonWidth, buttonHeight);
        x.shadowBlur = 0;
        
        // Switch labels with bold text, letter spacing, and improved contrast
        x.font = `bold 13px ${FONTS.body}`;
        
        // Normal label - white text when active (teal background), black when inactive
        setFill(infiniteMode ? "#cccccc" : "#ffffff");
        x.fillText("NORMAL", switchX - switchWidth/4, switchY + 4);
        
        // Infinite label - white text when active (orange background), black when inactive
        setFill(infiniteMode ? "#ffffff" : "#cccccc");
        x.fillText("INFINITE", switchX + switchWidth/4, switchY + 4);
        
        // Store switch bounds for click detection
        window.helpModeToggle = {
          x: switchX,
          y: switchY,
          width: switchWidth,
          height: switchHeight
        };
        
      } else if (rule.startsWith("• ")) {
        // Content bullets - improved readability  
        setFill("#f0f0f0");
        x.shadowColor = "rgba(0, 0, 0, 0.4)";
        x.shadowBlur = 1;
        x.font = `16px ${FONTS.body}`;
        x.fillText(rule, w / 2, y);
        x.shadowBlur = 0;
        
      } else if (rule.startsWith("  - ")) {
        // Sub-bullets with same styling as regular bullets
        setFill("#f0f0f0");
        x.shadowColor = "rgba(0, 0, 0, 0.4)";
        x.shadowBlur = 1;
        x.font = `16px ${FONTS.body}`;
        x.fillText(rule, w / 2, y);
        x.shadowBlur = 0;
        
      } else if (rule !== "") {
        // Description text - balanced contrast
        setFill("#d0d0d0");
        x.shadowColor = "rgba(0, 0, 0, 0.3)";
        x.shadowBlur = 1;
        x.font = `16px ${FONTS.body}`;
        x.fillText(rule, w / 2, y);
        x.shadowBlur = 0;
      }
      // Empty strings create spacing - no rendering needed
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
  
  // Improved scroll indicators with better visibility and positioning
  if (maxScroll > 0) {
    x.textAlign = "center";
    x.font = `14px ${FONTS.body}`;
    
    // Scroll progress indicator
    const scrollBarWidth = 4;
    const scrollBarHeight = contentHeight - 40;
    const scrollBarX = w - 30;
    const scrollBarY = contentTop + 20;
    
    // Background track
    setFill("rgba(255, 255, 255, 0.1)");
    x.fillRect(scrollBarX, scrollBarY, scrollBarWidth, scrollBarHeight);
    
    // Scroll thumb
    const thumbHeight = Math.max(20, (contentHeight / (maxScroll + contentHeight)) * scrollBarHeight);
    const thumbY = scrollBarY + (helpScrollOffset / maxScroll) * (scrollBarHeight - thumbHeight);
    
    setFill("rgba(255, 255, 255, 0.4)");
    x.fillRect(scrollBarX, thumbY, scrollBarWidth, thumbHeight);
    
    // Scroll up indicator
    if (helpScrollOffset > 0) {
      const upText = "↑ More above";
      const upMetrics = x.measureText(upText);
      const upY = contentTop - 5;
      
      // Gradient background
      const gradient = x.createLinearGradient(0, upY - 20, 0, upY + 5);
      gradient.addColorStop(0, "rgba(16, 16, 32, 0.9)");
      gradient.addColorStop(1, "rgba(16, 16, 32, 0.3)");
      
      setFill(gradient);
      x.fillRect(w / 2 - upMetrics.width / 2 - 15, upY - 20, upMetrics.width + 30, 25);
      
      // Border
      setStroke("rgba(127, 194, 164, 0.3)");
      setLineWidth(1);
      x.strokeRect(w / 2 - upMetrics.width / 2 - 15, upY - 20, upMetrics.width + 30, 25);
      
      // Text
      setFill("#7fc2a4");
      x.shadowColor = "rgba(0, 0, 0, 0.8)";
      x.shadowBlur = 2;
      x.fillText(upText, w / 2, upY - 5);
    }
    
    // Scroll down indicator  
    if (helpScrollOffset < maxScroll) {
      const downText = "↓ More below";
      const downMetrics = x.measureText(downText);
      const downY = contentTop + contentHeight + 15;
      
      // Gradient background
      const gradient = x.createLinearGradient(0, downY - 5, 0, downY + 20);
      gradient.addColorStop(0, "rgba(16, 16, 32, 0.3)");
      gradient.addColorStop(1, "rgba(16, 16, 32, 0.9)");
      
      setFill(gradient);
      x.fillRect(w / 2 - downMetrics.width / 2 - 15, downY - 5, downMetrics.width + 30, 25);
      
      // Border
      setStroke("rgba(127, 194, 164, 0.3)");
      setLineWidth(1);
      x.strokeRect(w / 2 - downMetrics.width / 2 - 15, downY - 5, downMetrics.width + 30, 25);
      
      // Text
      setFill("#7fc2a4");
      x.shadowColor = "rgba(0, 0, 0, 0.8)";
      x.shadowBlur = 2;
      x.fillText(downText, w / 2, downY + 10);
    }
    
    // Reset effects
    x.shadowBlur = 0;
    x.shadowOffsetY = 0;
  }
  


  // Close instruction with better styling and spacing
  x.textAlign = "center";
  
  // Background bar for better readability
  const closeText = "Press ESC to close";
  x.font = `18px ${FONTS.body}`;
  const closeMetrics = x.measureText(closeText);
  const closeY = h - 40;
  
  // Subtle background
  const gradient = x.createLinearGradient(w/2 - 150, closeY - 15, w/2 + 150, closeY + 15);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.2)");
  gradient.addColorStop(0.5, "rgba(0, 0, 0, 0.6)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.2)");
  
  setFill(gradient);
  x.fillRect(w/2 - closeMetrics.width/2 - 20, closeY - 18, closeMetrics.width + 40, 30);
  
  // Border
  setStroke("rgba(154, 150, 149, 0.3)");
  setLineWidth(1);
  x.strokeRect(w/2 - closeMetrics.width/2 - 20, closeY - 18, closeMetrics.width + 40, 30);
  
  // Text with improved contrast
  setFill("#e0ddd9");
  x.shadowColor = "rgba(0, 0, 0, 0.8)";
  x.shadowBlur = 2;
  x.fillText(closeText, w / 2, closeY);
  x.shadowBlur = 0;
  
  x.restore();
};

// Accordion state for detailed stats
let showDetailedStats = false;

// Draw unified game over/victory screen with consistent styling
const drawGameOverScreen = () => {
  if (!gameOver && !gameWon) return;
  if (showNameInput) return; // Don't show game over screen if name input is active
  if (showLeaderboard) return; // Don't show game over screen if leaderboard is active
  
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
  
  const finalScore = gameWon ? score + 1000 + (bestStreak * 50) : score;
  
  // Note: Name input logic now handled immediately when game ends, not during render
  
  // Dark overlay
  setFill(BLACK(0.9));
  x.fillRect(0, 0, w, h);
  
  x.save();
  x.textAlign = "center";
  
  const isWin = gameWon;
  
  // Define screen configuration map
  const config = isWin ? {
    title: "Nyx is pleased.",
    titleColor: "#22aa22",
    subtitle: "Great job, you survived the night!",
    subtitleColor: "#88dd88"
  } : {
    title: "Nyx has grown bored.", 
    titleColor: "#aa2222",
    subtitle: "Better luck next time...",
    subtitleColor: "#dd8888"
  };
  
  let currentY = h * 0.12;
  
  // Title
  setFill(config.titleColor);
  x.font = `48px ${FONTS.title}`;
  x.shadowColor = config.titleColor;
  x.shadowBlur = 12;
  x.fillText(config.title, w / 2, currentY);
  x.shadowBlur = 0;
  currentY += 50;
  
  // Subtitle (moved under title)
  setFill(config.subtitleColor);
  x.font = `18px ${FONTS.body}`;
  x.fillText(config.subtitle, w / 2, currentY);
  currentY += 60;
  
  // Core stats
  const coreStats = [
    { label: "Fireflies Delivered", value: totalCollected, color: "#ffffff" },
    { label: "Fireflies Lost", value: totalLost, color: "#ffaa66" },
    { label: "Time Survived", value: timeString, color: "#66aaff" }
  ];
  
  x.font = `22px ${FONTS.body}`;
  coreStats.forEach(stat => {
    setFill(stat.color);
    x.fillText(`${stat.label}: ${stat.value}`, w / 2, currentY);
    currentY += 35;
  });
  
  currentY += 20;
  
  // Final score
  setFill(config.titleColor);
  x.font = `28px ${FONTS.title}`;
  x.shadowColor = config.titleColor;
  x.shadowBlur = 8;
  x.fillText(`Final Score: ${isWin ? finalScore : score}`, w / 2, currentY);
  x.shadowBlur = 0;
  currentY += 40;
  
  // Note: Leaderboard qualification now handled immediately when game ends
  
  currentY += 25;
  
  // Accordion toggle for detailed stats
  const accordionY = currentY;
  const accordionText = showDetailedStats ? "▼ Hide Detailed Stats" : "▶ Show Detailed Stats";
  setFill("#aaaaaa");
  x.font = `16px ${FONTS.body}`;
  x.fillText(accordionText, w / 2, currentY);
  
  // Store accordion click area
  window.gameOverAccordion = {
    x: w / 2,
    y: accordionY,
    width: 200,
    height: 20
  };
  
  currentY += 35;
  
  // Show detailed stats if accordion is open
  if (showDetailedStats) {
    // Shield stats
    setFill("#cccccc");
    x.font = `18px ${FONTS.body}`;
    x.fillText("Successful Shields:", w / 2, currentY);
    currentY += 25;
    
    const shieldStats_display = [
      { label: "Perfect", value: shieldStats.perfect, color: "#00ff00" },
      { label: "Great", value: shieldStats.great, color: "#ffff00" },
      { label: "Good", value: shieldStats.good, color: "#ff8800" },
      { label: "Missed", value: shieldStats.missed, color: "#ff4444" }
    ];
    
    x.font = `16px ${FONTS.body}`;
    shieldStats_display.forEach(shield => {
      setFill(shield.color);
      x.fillText(`${shield.label}: ${shield.value}`, w / 2, currentY);
      currentY += 22;
    });
    
    currentY += 15;
    
    // Evolution stats
    setFill("#cccccc");
    x.font = `18px ${FONTS.body}`;
    x.fillText("Fireflies Evolved:", w / 2, currentY);
    currentY += 25;
    
    const evolutionStats = [
      { label: "Purple", value: tierStats.created.purple, color: "#9966ff" },
      { label: "Gold", value: tierStats.created.gold, color: "#ffaa00" },
      { label: "Rainbow", value: tierStats.created.rainbow, color: "#ff0080" }
    ];
    
    x.font = `16px ${FONTS.body}`;
    evolutionStats.forEach(tier => {
      setFill(tier.color);
      x.fillText(`${tier.label}: ${tier.value}`, w / 2, currentY);
      currentY += 22;
    });
    
    currentY += 20;
  }
  
  // Add extra spacing above buttons
  currentY += 30;
  
  // Action buttons
  const buttonWidth = 150;
  const buttonHeight = 40;
  const buttonSpacing = 180;
  const button1X = w / 2 - buttonSpacing / 2;
  const button2X = w / 2 + buttonSpacing / 2;
  const buttonY = currentY;
  
  // Check hover states
  const isLeaderboardHovered = mx >= button1X - buttonWidth/2 && mx <= button1X + buttonWidth/2 &&
                               my >= buttonY - buttonHeight/2 && my <= buttonY + buttonHeight/2;
  const isPlayAgainHovered = mx >= button2X - buttonWidth/2 && mx <= button2X + buttonWidth/2 &&
                             my >= buttonY - buttonHeight/2 && my <= buttonY + buttonHeight/2;
  
  // View Leaderboard button
  setFill(isLeaderboardHovered ? "#444444" : "#333333");
  setStroke(isLeaderboardHovered ? "#888888" : "#666666");
  setLineWidth(2);
  x.fillRect(button1X - buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight);
  x.strokeRect(button1X - buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight);
  
  setFill(isLeaderboardHovered ? "#dddddd" : "#ffffff");
  x.font = `16px ${FONTS.body}`;
  x.fillText("View Leaderboard", button1X, buttonY + 5);
  
  // Play Again button
  setFill(isPlayAgainHovered ? "#444444" : "#333333");
  setStroke(isPlayAgainHovered ? "#888888" : "#666666");
  setLineWidth(2);
  x.fillRect(button2X - buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight);
  x.strokeRect(button2X - buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight);
  
  setFill(isPlayAgainHovered ? "#dddddd" : "#ffffff");
  x.fillText("Play Again", button2X, buttonY + 5);
  
  // Store button click areas
  window.gameOverButtons = {
    leaderboard: {
      x: button1X,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight
    },
    playAgain: {
      x: button2X,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight
    }
  };
  
  x.restore();
};

// Leaderboard cache to avoid excessive async calls
let leaderboardCache = [];
let leaderboardCacheTime = 0;
const CACHE_DURATION = 5000;

const loadLeaderboardData = async () => {
  const now = Date.now();
  
  if (now - leaderboardCacheTime < CACHE_DURATION && leaderboardCache.length > 0) {
    return leaderboardCache;
  }
  
  try {
    leaderboardCache = await getLeaderboard();
    leaderboardCacheTime = now;
    return leaderboardCache;
  } catch (e) {
    return [];
  }
};

const drawLeaderboard = () => {
  if (!showLeaderboard) return;
  
  drawStars(Date.now());
  
  const gradient = x.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "rgba(10, 10, 26, 0.75)");
  gradient.addColorStop(1, "rgba(10, 10, 26, 0.85)");
  setFill(gradient);
  x.fillRect(0, 0, w, h);
  
  // Sparkly particle effects
  const now = Date.now();
  for (let i = 0; i < 15; i++) {
    const sparkleX = (w * 0.1 + i * w * 0.05 + sin(now * 0.003 + i) * 20) % w;
    const sparkleY = h * 0.3 + sin(now * 0.002 + i * 2) * h * 0.4;
    const sparkleAlpha = (sin(now * 0.004 + i * 3) * 0.3 + 0.5) * 0.4;
    
    setFill(`rgba(136, 68, 255, ${sparkleAlpha})`);
    x.beginPath();
    x.arc(sparkleX, sparkleY, 1, 0, TAU);
    x.fill();
  }
  
  x.save();
  
  // Title
  x.textAlign = "center";
  setFill("#8844ff");
  x.font = `48px ${FONTS.title}`;
  x.shadowColor = "#8844ff";
  x.shadowBlur = 20;
  x.fillText("Hall of Perfection", w / 2, h * 0.12);
  x.shadowBlur = 0;
  
  const leaderboard = leaderboardCache;
  
  if (leaderboard.length === 0) {
    const emptyY = h * 0.5;
    setFill("#666666");
    x.font = `24px ${FONTS.body}`;
    x.fillText("✨ No champions yet ✨", w / 2, emptyY);
    x.font = `18px ${FONTS.body}`;
    setFill("#888888");
    x.fillText("Complete 3 minutes to join the elite", w / 2, emptyY + 35);
  } else {
    const startY = h * 0.18;
    const cardHeight = 85;
    const cardSpacing = 8;
    const maxCards = Math.floor((h * 0.65) / (cardHeight + cardSpacing));
    
    leaderboard.slice(0, maxCards).forEach((entry, index) => {
      const rank = index + 1;
      const cardY = startY + index * (cardHeight + cardSpacing);
      const cardX = w * 0.08;
      const cardWidth = w * 0.84;
      const centerY = cardY + cardHeight / 2 + 4;
      
      const isHovered = mx >= cardX && mx <= cardX + cardWidth && 
                       my >= cardY && my <= cardY + cardHeight;
      
      // Card background with rank-based styling
      if (rank === 1) {
        x.shadowColor = "#8844ff";
        x.shadowBlur = 15;
        setFill(isHovered ? "rgba(25, 25, 50, 0.95)" : "rgba(20, 20, 45, 0.9)");
        x.fillRect(cardX, cardY, cardWidth, cardHeight);
        x.shadowBlur = 0;
      } else {
        const bgAlpha = rank <= 3 ? "rgba(15, 15, 35, 0.8)" : "rgba(10, 10, 25, 0.85)";
        const hoverAlpha = rank <= 3 ? "rgba(20, 20, 40, 0.85)" : "rgba(15, 15, 30, 0.9)";
        setFill(isHovered ? hoverAlpha : bgAlpha);
        x.fillRect(cardX, cardY, cardWidth, cardHeight);
      }
      
      // Glowing aura animation for recent player
      const shouldAnimate = recentPlayerName && (entry.name === recentPlayerName || (entry.name === "Anonymous" && recentPlayerName === "Anonymous"));
      if (shouldAnimate && playerHighlightAnimation) {
        const elapsed = Date.now() - playerHighlightAnimation.startTime;
        const progress = Math.min(elapsed / playerHighlightAnimation.duration, 1);
        
        if (progress < 1) {
          // Organic breathing pattern with 2 varied breaths
          const timeInSeconds = elapsed / 1000;
          let breathIntensity = 0;
          
          // Define organic breath timing (inhale fast, exhale slow, pause)
          if (timeInSeconds < 0.9) {
            // First breath: inhale
            breathIntensity = Math.sin((timeInSeconds / 0.9) * Math.PI / 2);
          } else if (timeInSeconds < 2.5) {
            // First breath: slow exhale + pause
            const exhaleProgress = (timeInSeconds - 0.9) / 1.6;
            breathIntensity = Math.cos(exhaleProgress * Math.PI / 2);
          } else if (timeInSeconds < 3.3) {
            // Second breath: inhale
            const inhaleProgress = (timeInSeconds - 2.5) / 0.8;
            breathIntensity = Math.sin(inhaleProgress * Math.PI / 2);
          } else {
            // Second breath: final exhale
            const exhaleProgress = (timeInSeconds - 3.3) / 1.2;
            breathIntensity = Math.cos(exhaleProgress * Math.PI / 2);
          }
          
          const fadeOut = 1 - (progress * 0.3); // Gentle fade over time
          const baseGlow = 0.08; // Always present subtle glow
          const breathGlow = breathIntensity * 0.12; // Additional breathing intensity
          const glowAlpha = (baseGlow + breathGlow) * fadeOut;
          
          if (glowAlpha > 0.02) {
            // Create misty aura effect with optimized rendering
            const baseAuraSize = 8;
            const breathAuraSize = breathIntensity * 12;
            const auraSize = baseAuraSize + breathAuraSize;
            
            // Use single glow layer to reduce shadow blur calls by 66%
            x.shadowColor = "#4da6ff";
            setShadowBlur(auraSize);
            x.fillStyle = `rgba(77, 166, 255, ${glowAlpha * 0.4})`;
            x.fillRect(cardX - 2, cardY - 2, cardWidth + 4, cardHeight + 4);
            
            // Add subtle inner highlight without shadow blur for performance  
            x.fillStyle = `rgba(135, 206, 255, ${glowAlpha * 0.2})`;
            x.fillRect(cardX, cardY, cardWidth, cardHeight);
            
            setShadowBlur(0);
          }
        } else {
          // Animation finished, clear it
          playerHighlightAnimation = null;
        }
      }
      
      // Rank indicator with letter spacing
      const rankX = cardX + 25;
      const spacing = rank <= 3 ? 6 : 8;
      
      x.textAlign = "center";
      x.font = `bold 18px ${FONTS.body}`;
      setFill(rank === 1 ? "#99ff99" : "#aaaaaa");
      
      x.fillText("#", rankX - spacing, centerY);
      x.fillText(`${rank}`, rankX + spacing, centerY);
      
      // Player name with recent player highlighting
      const nameX = cardX + 70;
      const isRecentPlayer = recentPlayerName && (entry.name === recentPlayerName || (entry.name === "Anonymous" && recentPlayerName === "Anonymous"));
      
      if (isRecentPlayer) {
        setFill("#4da6ff"); // Blue color for recent player
      } else {
        setFill(rank === 1 ? "#99ff99" : (rank <= 3 ? "#ffffff" : "#dddddd"));
      }
      
      x.font = `bold 20px ${FONTS.body}`;
      x.textAlign = "left";
      
      const displayName = entry.name || "Anonymous";
      const truncatedName = displayName.length > 22 ? displayName.substring(0, 22) + "..." : displayName;
      x.fillText(truncatedName, nameX, centerY);
      
      // Draw stats with helper function
      const statsStartX = nameX + 200;
      const statsSpacing = (cardWidth - (statsStartX - cardX) - 80) / 3;
      
      const drawStat = (value, label, color, xPos, fontSize = 14) => {
        x.textAlign = "center";
        setFill(color);
        x.font = `bold ${fontSize}px ${FONTS.body}`;
        x.fillText(value, xPos, centerY - 8);
        setFill("#aaaaaa");
        x.font = `10px ${FONTS.body}`;
        x.fillText(label, xPos, centerY + 8);
      };
      
      drawStat(`${entry.score}`, "SCORE", "#ffdd00", statsStartX, 16);
      drawStat(`${entry.perfectShields || 0}`, "PERFECT SHIELDS", "#99ff99", statsStartX + statsSpacing);
      drawStat(`${entry.streak || 0}x`, "SHIELD STREAKS", "#66ccff", statsStartX + statsSpacing * 2);
      drawStat(parseAndFormatDate(entry.date), "DATE", "#cccccc", statsStartX + statsSpacing * 3, 12);
    });
  }
  
  // Instructions
  setFill("#666666");
  x.font = `18px ${FONTS.body}`;
  x.textAlign = "center";
  x.fillText("Click anywhere, 'L', or ESC to close", w / 2, h * 0.92);
  
  x.restore();
};

// Draw name input screen for leaderboard entry
const drawNameInput = () => {
  if (!showNameInput) return;
  
  // Dark overlay
  setFill(BLACK(0.95));
  x.fillRect(0, 0, w, h);
  
  x.save();
  x.textAlign = "center";
  
  let currentY = h * 0.25;
  
  // NEW HIGH SCORE announcement
  setFill("#ffd700");
  x.font = `24px ${FONTS.title}`;
  x.shadowColor = "#ffd700";
  x.shadowBlur = 8;
  x.fillText("🏆 NEW HIGH SCORE! 🏆", w / 2, currentY);
  x.shadowBlur = 0;
  currentY += 50;
  
  // Title
  setFill("#d4af37");
  x.font = `32px ${FONTS.title}`;
  x.shadowColor = "#d4af37";
  x.shadowBlur = 6;
  x.fillText("Enter Your Name", w / 2, currentY);
  x.shadowBlur = 0;
  currentY += 60;
  
  // Score display
  setFill("#ffffff");
  x.font = `20px ${FONTS.body}`;
  x.fillText(`Score: ${pendingScore?.score || 0}`, w / 2, currentY);
  currentY += 60;
  
  // Name input box
  const inputWidth = 300;
  const inputHeight = 40;
  const inputX = (w - inputWidth) / 2;
  const inputY = currentY - inputHeight + 10;
  
  // Input box background
  setFill("#333333");
  setStroke("#666666");
  setLineWidth(2);
  x.fillRect(inputX, inputY, inputWidth, inputHeight);
  x.strokeRect(inputX, inputY, inputWidth, inputHeight);
  
  // Player name text
  setFill("#ffffff");
  x.font = `18px ${FONTS.body}`;
  x.textAlign = "left";
  const textX = inputX + 15;
  const textY = inputY + inputHeight / 2 + 6;
  x.fillText(playerName || "", textX, textY);
  
  // Cursor
  if (Math.floor(Date.now() / 500) % 2) {
    const cursorX = textX + x.measureText(playerName).width;
    setStroke("#ffffff");
    setLineWidth(1);
    x.beginPath();
    x.moveTo(cursorX, inputY + 8);
    x.lineTo(cursorX, inputY + inputHeight - 8);
    x.stroke();
  }
  
  currentY += 100; // Increased spacing above buttons
  
  // Action buttons
  const buttonWidth = 120;
  const buttonHeight = 35;
  const buttonSpacing = 160;
  const skipX = w / 2 - buttonSpacing / 2; // Skip button on left
  const submitX = w / 2 + buttonSpacing / 2; // Submit button on right
  const buttonY = currentY;
  
  x.textAlign = "center";
  
  // Check hover states
  const isSkipHovered = mx >= skipX - buttonWidth/2 && mx <= skipX + buttonWidth/2 &&
                        my >= buttonY - buttonHeight/2 && my <= buttonY + buttonHeight/2;
  const isSubmitHovered = mx >= submitX - buttonWidth/2 && mx <= submitX + buttonWidth/2 &&
                          my >= buttonY - buttonHeight/2 && my <= buttonY + buttonHeight/2;
  
  // Skip button (left side)
  setFill(isSkipHovered ? "#777777" : "#666666");
  setStroke(isSkipHovered ? "#aaaaaa" : "#888888");
  setLineWidth(2);
  x.fillRect(skipX - buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight);
  x.strokeRect(skipX - buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight);
  
  setFill(isSkipHovered ? "#dddddd" : "#ffffff");
  x.font = `16px ${FONTS.body}`;
  x.fillText("Skip", skipX, buttonY + 5);
  
  // Submit button (right side) - sage green
  setFill(isSubmitHovered ? "#7ba05b" : "#6b8e4e");
  setStroke(isSubmitHovered ? "#9bc275" : "#8faf72");
  setLineWidth(2);
  x.fillRect(submitX - buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight);
  x.strokeRect(submitX - buttonWidth/2, buttonY - buttonHeight/2, buttonWidth, buttonHeight);
  
  setFill(isSubmitHovered ? "#f0f0f0" : "#ffffff");
  x.font = `16px ${FONTS.body}`;
  x.fillText("Submit", submitX, buttonY + 5);
  
  // Store button click areas
  window.nameInputButtons = {
    submit: {
      x: submitX,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight
    },
    skip: {
      x: skipX,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight
    }
  };
  
  currentY += 60;
  
  // Warning for duplicate names
  if (nameWarning) {
    setFill("#ff6666");
    x.font = `15px ${FONTS.body}`;
    x.fillText(nameWarning, w / 2, currentY);
    currentY += 25;
  }
  
  // Instructions
  setFill("#aaaaaa");
  x.font = `14px ${FONTS.body}`;
  x.fillText("Type your name and click Submit, or press ENTER", w / 2, currentY);
  currentY += 20;
  x.fillText("Click Skip to submit as 'Anonymous'", w / 2, currentY);
  
  x.restore();
};

// Draw performance monitoring overlay


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
    x.textAlign = "right";
    
    // Calculate elapsed time, excluding time spent in help menu and leaderboard
    let elapsed = Date.now() - startTime - totalHelpPauseTime - totalLeaderboardPauseTime;
    if (showHelp) {
      elapsed -= (Date.now() - helpOpenTime);
    }
    if (showLeaderboard) {
      elapsed -= (Date.now() - leaderboardOpenTime);
    }
    
    // Ensure elapsed is never negative (safety check)
    elapsed = Math.max(0, elapsed);
    
    // Simple timer logic - dynamic switch based on mode
    if (infiniteMode) {
      // Infinite mode: Count up from 0
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      setFill("#88ddff");
      setFontBySize(20, 'body');
      x.fillText(timeText, w - 20, 30);
    } else {
      // Normal mode: Count down from 3:00
      const remaining = Math.max(0, NIGHT_DURATION - elapsed);
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      // Color based on time remaining
      const timeColor = remaining < 60000 ? "#ff8844" : remaining < 180000 ? "#ffaa00" : "#88ddff";
      setFill(timeColor);
      setFontBySize(20, 'body');
      x.fillText(timeText, w - 20, 30);
    }
  }
  
  // === LEFT SIDE: Mana and Shield (aligned with time) ===
  x.textAlign = "left";
  let leftY = 30; // Start aligned with time display on right
  
  if (infiniteMode) {
    // Infinite mode display
    setFill("#00dddd");
    setFontBySize(18, 'body');
    x.fillText("Mana: ∞", 20, leftY);
    leftY += 25;
    
    setFill("#99ff99");
    x.fillText("Shield: ∞", 20, leftY);
    leftY += 25;
  } else {
    // Normal mode display
    // Mana display (always show) - use fixed cyan for readability
    setFill("#00dddd"); // Cyan color for good contrast against dark sky
    setFontBySize(18, 'body');
    x.fillText(`Mana: ${Math.floor(manaEnergy)}`, 20, leftY);
    leftY += 25; // Tighter spacing
    
    // Shield status - cache font since all use same size
    if (shieldActive) {
      setFill("#99ccff");
      x.fillText("SHIELD ACTIVE", 20, leftY);
    } else if (shieldCharging) {
      // Pulsing yellow to show charging state
      const chargePulse = sin(Date.now() * 0.01) * 0.3 + 0.7;
      setFill(`rgba(255, 255, 0, ${chargePulse})`);
      x.fillText("SHIELD CHARGING...", 20, leftY);
    } else if (shieldCooldown > 0) {
      setFill("#cccccc");
      x.fillText(`Shield: ${Math.ceil(shieldCooldown / 60)}s`, 20, leftY);
    } else if (summonOverheated || manaEnergy < 5) {
      setFill("#ff6666");
      x.fillText(manaEnergy <= 0 ? "OUT OF MANA" : "LOW MANA", 20, leftY);
    } else {
      let shieldColor = "#99ff99";
      let shieldText = "Shield: Ready";
      
      if (manaEnergy <= 20) {
        shieldColor = "#ff9966";
        shieldText = "Shield: LOW POWER";
      } else if (manaEnergy <= 5) {
        shieldColor = "#ff6666";
        shieldText = "Shield: CRITICAL";
      }
      
      setFill(shieldColor);
      x.fillText(shieldText, 20, leftY);
    }
    leftY += 25; // Tighter spacing
  }
  
  // Streak display (when active) - now below shield
  if (shieldStreak >= 2) {
    const streakColor = shieldStreak >= 5 ? "#ffcc99" : "#99ff99";
    setFill(streakColor);
    setFontBySize(16, 'body');
    x.fillText(`${shieldStreak}x streak (+${Math.floor((Math.min(3, 1 + (shieldStreak - 1) * 0.5) - 1) * 100)}% bonus)`, 20, leftY);
    leftY += 25;
  }
  

  
  // === CENTER: Summoning Feedback ===
  if (summonFeedback.active) {
    const alpha = 1 - (summonFeedback.life / summonFeedback.maxLife);
    setFill(`rgba(255, 255, 255, ${alpha})`);
    x.textAlign = "center";
    setFontBySize(20, 'body');
    x.fillText(summonFeedback.text, w / 2, h / 2 - 150);
  }
  
  // === PLAYER CURSOR: Overheat/Heat Warning ===
  x.textAlign = "center";
  const recentAttempt = Date.now() - lastOverheatAttempt < 2000; // Show for 2 seconds after attempt
  
  if (summonOverheated || recentAttempt) {
    setFill("#ff9999");
    setFontBySize(18, 'body');
    // Position under player cursor for better visibility
    x.fillText("OVERHEATED", mx, my + 30);
  }
  
  // Tutorial step 1 - advance to mana warning after they've summoned and delivered once
  if (!tutorialComplete && tutorialStep === 1) {
    tutorialStep1Timer++; // Count frames at step 1
    
    // Check if they've summoned fireflies (mana usage) AND made a delivery during this step
    const hasActuallySummoned = manaEnergy < 100;
    const hasDeliveredDuringStep1 = tutorialDeliveryCount > 2; // They started with 2 deliveries, so >2 means delivery during step 1
    
    if ((hasActuallySummoned && hasDeliveredDuringStep1) || tutorialStep1Timer > 360) {
      // They've experienced summoning and delivering, or 6 seconds have passed - show mana warning
      tutorialStep = 1.5;
    }
  }
  
  // Tutorial progression - advance from drop tutorial (step 3) when they make another delivery
  if (!tutorialComplete && tutorialStep === 3) {
    tutorialStep3Timer++; // Count frames at step 3
    if (tutorialStep3Timer > 900) { // 15 seconds max to prevent getting stuck
      tutorialStep = 4; // Move to evolution strategy tutorial
      tutorialStep4Timer = 0; // Reset step 4 timer
    }
  }
  
  // Advance from evolution strategy (step 4) to final warning (step 5)
  if (!tutorialComplete && tutorialStep === 4) {
    tutorialStep4Timer++; // Count frames at step 4
    if (tutorialStep4Timer > 420 || // 7 seconds to understand evolution chains
        score >= 20 || 
        totalCollected >= 8) { // More collections needed for evolution understanding
      tutorialStep = 5; // Move to final preparation step
      tutorialStep4Timer = 0;
      // Give them some mana for the final challenge
      manaEnergy = Math.min(100, manaEnergy + 30);
      addScoreText('Ready!', w / 2, h / 2 - 50, '#00ffff', 300);
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
      startTime = Date.now(); // Start the 3-minute game timer now
      lastDeliveryTime = Date.now(); // Reset delivery timer for real game
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
  // Only show pressure timer in normal mode
  if (!infiniteMode) {
    const barWidth = Math.min(w * 0.7, 600);
    const barHeight = 20;
    const barX = (w - barWidth) / 2;
    const barY = h - 70;
    
    // Calculate time pressure - how close to curiosity decay (tutorial-aware timing)
    const timeSinceDelivery = lastDeliveryTime ? (Date.now() - lastDeliveryTime) : (Date.now() - (startTime || Date.now()));
    const curiosityDeadline = tutorialComplete ? 15000 : 60000; // 60s tutorial, 15s normal
    const timeUntilDecay = Math.max(0, curiosityDeadline - timeSinceDelivery);
    const pressurePercent = timeUntilDecay / curiosityDeadline; // 1.0 = safe, 0.0 = critical
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
  
  x.restore();
  
  // Timer countdown inside the bar
  x.save();
  x.shadowColor = "rgba(0, 0, 0, 0.8)";
  x.shadowBlur = 4;
  x.textAlign = "center";
  setFill("#ffffff");
  setFontBySize(14, 'body'); // Use proper font helper
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
  setTitleFont(18); // Use proper font helper
  const labelText = pressurePercent > 0.6 ? "Deliver Soon" :
                   pressurePercent > 0.3 ? "Hurry!" : "CRITICAL!";
  x.fillText(labelText, barX + barWidth/2, barY - 15);
  x.restore();
  } // End infinite mode check

  // === BOTTOM RIGHT: Controls hint ===
  x.textAlign = "right";
  setFill("#666666");
  x.font = `14px ${FONTS.body}`;
  const modeIndicator = infiniteMode ? " • Infinite Mode" : "";
  x.fillText(`'ESC' help • 'L' leaderboard • 'M' audio: ${audioEnabled ? 'ON' : 'OFF'}${modeIndicator}`, w - 20, h - 20);
  
  x.restore();
};

// Draw victory screen when player survives the night
// Main game loop - orchestrates all systems
function gameLoop(currentTime) {
  // Get current time if not provided by requestAnimationFrame
  if (currentTime === undefined) {
    currentTime = performance.now();
  }
  
  // Limit to 60 FPS using setTimeout for precise timing
  const deltaTime = currentTime - lastFrameTime;
  
  if (deltaTime < FRAME_TIME) {
    const remainingTime = FRAME_TIME - deltaTime;
    setTimeout(() => requestAnimationFrame(gameLoop), remainingTime);
    return;
  }
  
  const frameStartTime = currentTime;
  const now = Date.now();
  lastFrameTime = currentTime;
  
  const { x: playerX, y: playerY } = getPlayerPosition();
  
  // Only update game systems when game is active (not over or won) AND screen is adequate AND help menu is closed AND leaderboard is closed AND tab is visible
  if (!gameOver && !gameWon && !isScreenTooSmall && !showHelp && !showLeaderboard && !autoPaused) {
    // Update all game systems
    updateWarningFlashes(); // Update unified flash system
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
      handleVictory("survived the night");
      
      addScoreText('YOU SURVIVED THE NIGHT!', w / 2, h / 2, '#ffdd00', 600);
      playDawnBreaksVictory(); // Dawn breaking victory melody
      fadeBgMusic(0.25, 2); // Boost music volume for celebration
    }
    
    // Nyx's Curiosity Decay - the core risk mechanic (only in normal mode)
    if (!infiniteMode && !gameOver && !gameWon && startTime) {
      const timeSinceLastDelivery = Date.now() - (lastDeliveryTime || startTime);
      
      // During tutorial, use much longer curiosity timer (60 seconds vs 15)
      const curiosityDeadline = tutorialComplete ? 15000 : 60000;
      
      // IMMEDIATE GAME OVER when delivery deadline is missed 
      if (timeSinceLastDelivery >= curiosityDeadline) {
        gameOver = true;
        gameOverTime = Date.now();
        addScoreText('Nyx lost interest - delivery too late!', w / 2, h / 2, '#ff4444', 300);
        playGameOverMelody();
        fadeBgMusic(0.03, 3);
        shieldStreak = 0; // Break streak on game over
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
      const spawnInterval = baseSpawnInterval / (1 + shieldStreak * 0.1); // Streaks make it harder
      
      // Set firefly cap based on mode
      const maxFireflies = infiniteMode ? 18 : CFG.maxFireflies; // Cap at 18 for infinite mode
      
      if (now - lastSpawnTime > spawnInterval && otherFireflies.length < maxFireflies) {
        spawnFirefly();
        lastSpawnTime = now;
        
        // Chance for bonus firefly at higher difficulties (only in normal mode)
        if (!infiniteMode && minutesPlayed > 2 && r() < minutesPlayed * 0.05) {
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
  
  // Update star twinkle timer
  if (starTwinkleTimer > 0) {
    starTwinkleTimer = Math.max(0, starTwinkleTimer - 1);
  }

  // Render with optimizations - skip background when overlays are active
  const renderOptimized = showHelp || gameOver || gameWon || showLeaderboard || showNameInput;
  
  if (!renderOptimized) {
    drawStars(now);
    drawForest();
  }
  
  drawCatEyes(now);
  drawDeliveryZone(now);
  drawFireflies(now);
  
  if (!renderOptimized) {
    drawPlayerFirefly(playerX, playerY, now);
    drawPlayerCharacter(playerX, playerY, now);
    drawParticles();
    drawScoreTexts();
  }
  
  // Unified screen flash effect during cat eye warnings with audio cues
  if (gameStarted && !gameOver && colorChangesEnabled && isCurrentlyFlashing()) {
    if (otherFireflies.some(f => f.captured)) {
      const flashIntensity = 0.15;
      setFill(`rgba(200, 80, 80, ${flashIntensity})`);
      x.fillRect(0, 0, w, h);
      
      // Mario Kart style countdown audio cues (3-2-1) synchronized with flashes
      if (warningFlashState.flashFrame === 1) { // Play sound on first frame of each flash
        if (warningFlashState.currentFlash === 1) {
          playTone(440, 0.1, 0.03); // A4 - first warning (3)
        } else if (warningFlashState.currentFlash === 2) {
          playTone(554, 0.1, 0.03); // C#5 - second warning (2) 
        } else if (warningFlashState.currentFlash === 3) {
          playTone(659, 0.1, 0.03); // E5 - final warning (1)
        }
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
  drawLeaderboard();
  drawNameInput();
  
  // Draw cursor firefly on top of overlays when they're active
  const overlaysActive = showHelp || gameOver || gameWon || showLeaderboard || showNameInput;
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
  
  // Performance monitoring overlay
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
  c.addEventListener('contextmenu', (e) => e.preventDefault()); // Prevent right-click context menu
  
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
  
  // Spawn initial fireflies directly in gameplay area - no entrance animation
  const initialFireflies = tutorialComplete ? 25 : 12;
  for (let i = 0; i < initialFireflies; i++) {
    spawnFireflyInArea();
  }
  
  // Background music will start on first user interaction (browser requirement)
  
  // Start game loop
  gameLoop();
};

initGame();
