import React, { useEffect, useRef, useState } from 'react';
import { Duck, Food, Point, ControlMode, SpecialDrop, GameMode, Skin, Theme } from '../types';
import { SKINS, COLORS } from '../constants';

interface GameCanvasProps {
  playerName: string;
  controlMode: ControlMode;
  gameMode: GameMode;
  isBoosting?: boolean;
  invertControls?: boolean;
  currentSkinId?: string;
  onGameOver: (score: number) => void;
  onUpdateLeaderboard: (leaders: { name: string, score: number }[]) => void;
  onScoreUpdate: (score: number) => void;
  onPowerUpsUpdate?: (inventory: { SPEED: number, VISION: number, MAGNET: number }, active: { SPEED: number, VISION: number, MAGNET: number }) => void;
  activatePowerUp?: 'SPEED' | 'VISION' | 'MAGNET' | null;
  theme?: Theme;
  onSpecialDropSpawned?: () => void;
  devMode?: boolean;
}

const DUCK_RADIUS = 22;
const DUCKLING_RADIUS = 18;
const DUCKLING_SPACING = 20;

const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

const playSound = (type: 'eat' | 'boost' | 'die' | 'pop') => {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  switch (type) {
    case 'eat':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case 'boost':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case 'die':
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    case 'pop':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
      break;
  }
};

const dropFood = (duck: Duck, foods: Food[]) => {
  // Drop food along the trail
  duck.trail.forEach((p, i) => {
    if (i % 2 === 0) { // Drop food every other trail point to avoid too much clutter
      foods.push({
        id: `food-drop-${Math.random()}`,
        x: p.x + (Math.random() - 0.5) * 20,
        y: p.y + (Math.random() - 0.5) * 20,
        value: 2,
        color: duck.color,
      });
    }
  });
  // Also drop some at the head
  for (let i = 0; i < 3; i++) {
    foods.push({
      id: `food-drop-head-${Math.random()}`,
      x: duck.head.x + (Math.random() - 0.5) * 40,
      y: duck.head.y + (Math.random() - 0.5) * 40,
      value: 3,
      color: duck.color,
    });
  }
};

const COLORS_LIST = COLORS;

export const GameCanvas: React.FC<GameCanvasProps> = ({ 
  playerName, 
  controlMode,
  gameMode,
  isBoosting = false,
  invertControls = false,
  currentSkinId,
  onGameOver,
  onUpdateLeaderboard, 
  onScoreUpdate,
  onPowerUpsUpdate,
  activatePowerUp,
  theme = 'NAVY',
  onSpecialDropSpawned,
  devMode = false
}) => {
  const WORLD_SIZE = gameMode === 'LARGE' ? 6000 : gameMode === 'SMALL' ? 1500 : 3000;
  const BOT_COUNT = gameMode === 'LARGE' ? 80 : gameMode === 'SMALL' ? 5 : 25;
  const FOOD_COUNT = gameMode === 'LARGE' ? 1800 : gameMode === 'SMALL' ? 120 : 500;
  const WORLD_CENTER = WORLD_SIZE / 2;
  const SPAWN_SAFETY_DIST = gameMode === 'SMALL' ? 300 : 600;

  // Optimization: Spatial Grid for Food
  const GRID_SIZE = 200;
  const gridCols = Math.ceil(WORLD_SIZE / GRID_SIZE);
  const foodGrid = useRef<Map<string, Food[]>>(new Map());
  const duckGrid = useRef<Map<string, Duck[]>>(new Map());

  const getGridKey = (x: number, y: number) => {
    const col = Math.floor(x / GRID_SIZE);
    const row = Math.floor(y / GRID_SIZE);
    return `${col},${row}`;
  };

  const updateFoodGrid = (foods: Food[]) => {
    const newGrid = new Map<string, Food[]>();
    foods.forEach(food => {
      const key = getGridKey(food.x, food.y);
      if (!newGrid.has(key)) newGrid.set(key, []);
      newGrid.get(key)!.push(food);
    });
    foodGrid.current = newGrid;
  };

  const updateDuckGrid = (ducks: Duck[]) => {
    const newGrid = new Map<string, Duck[]>();
    ducks.forEach(duck => {
      const key = getGridKey(duck.head.x, duck.head.y);
      if (!newGrid.has(key)) newGrid.set(key, []);
      newGrid.get(key)!.push(duck);
    });
    duckGrid.current = newGrid;
  };

  // Optimization: Offscreen Canvas Cache for Skins
  const skinCache = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const getSkinCanvas = (duck: Duck, radius: number) => {
    const skin = SKINS.find(s => s.id === duck.skinId) || SKINS[0];
    const cacheKey = `${duck.skinId}-${duck.color}-${radius}`;
    
    if (skinCache.current.has(cacheKey)) {
      return skinCache.current.get(cacheKey)!;
    }

    const offCanvas = document.createElement('canvas');
    const size = (radius + 5) * 2;
    offCanvas.width = size;
    offCanvas.height = size;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return offCanvas;

    offCtx.translate(size / 2, size / 2);
    
    // Draw Body
    offCtx.fillStyle = duck.color;
    offCtx.beginPath();
    offCtx.arc(0, 0, radius, 0, Math.PI * 2);
    offCtx.fill();

    // Pattern
    if (skin.pattern) {
      offCtx.save();
      offCtx.globalCompositeOperation = 'source-atop';
      offCtx.fillStyle = skin.patternColor || 'rgba(255,255,255,0.3)';
      
      if (skin.pattern === 'STRIPES') {
        const step = 12;
        for (let i = -radius * 3; i < radius * 3; i += step) {
          offCtx.fillRect(i, -radius * 2, 4, radius * 4);
        }
      } else if (skin.pattern === 'DOTS') {
        const step = 10;
        for (let ix = -radius * 2; ix < radius * 2; ix += step) {
          for (let iy = -radius * 2; iy < radius * 2; iy += step) {
            offCtx.beginPath();
            offCtx.arc(ix + (iy % 20 === 0 ? 5 : 0), iy, 2, 0, Math.PI * 2);
            offCtx.fill();
          }
        }
      } else if (skin.pattern === 'CHECKERED') {
        const sizeSq = 8;
        for (let ix = -radius * 2; ix < radius * 2; ix += sizeSq) {
          for (let iy = -radius * 2; iy < radius * 2; iy += sizeSq) {
            if ((Math.floor(ix/sizeSq) + Math.floor(iy/sizeSq)) % 2 === 0) {
              offCtx.fillRect(ix, iy, sizeSq, sizeSq);
            }
          }
        }
      }
      offCtx.restore();
    }

    skinCache.current.set(cacheKey, offCanvas);
    return offCanvas;
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const selectedSkin = SKINS.find(s => s.id === currentSkinId) || SKINS[0];

  // Game state in refs for 60fps performance
  const playerRef = useRef<Duck>({
    id: 'player',
    name: playerName || 'MamaDuck',
    color: selectedSkin.color,
    skinId: selectedSkin.id,
    head: { x: WORLD_CENTER, y: WORLD_CENTER },
    trail: [],
    history: [{ x: WORLD_CENTER, y: WORLD_CENTER }],
    angle: 0,
    score: 0,
    isDead: false,
    speed: 5.0,
    isBoosting: false,
    inventory: { SPEED: 0, VISION: 0, MAGNET: 0 },
    activePowerUps: { SPEED: 0, VISION: 0, MAGNET: 0 },
  });

  const botsRef = useRef<Duck[]>([]);
  const foodsRef = useRef<Food[]>([]);
  const specialDropsRef = useRef<SpecialDrop[]>([]);
  const particles = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
  }[]>([]);

  const mousePos = useRef<Point>({ x: 0, y: 0 });
  const joystickBase = useRef<Point | null>(null);
  const joystickCurrent = useRef<Point | null>(null);
  const joystickActive = useRef(false);
  const joystickAngle = useRef<number | null>(null);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const requestRef = useRef<number>(null);
  const lastTimeRef = useRef<number>(0);
  const lastLeaderboardUpdate = useRef<number>(0);
  const lastDropScore = useRef<number>(0);

  // Sync player skin if it changes
  useEffect(() => {
    const skin = SKINS.find(s => s.id === currentSkinId) || SKINS[0];
    playerRef.current.skinId = skin.id;
    playerRef.current.color = skin.color;
  }, [currentSkinId]);

  // Initialize bots and food
  useEffect(() => {
    botsRef.current = Array.from({ length: BOT_COUNT }).map((_, i) => {
      let spawnX, spawnY;
      // Ensure initial bots aren't right on top of player
      do {
        spawnX = Math.random() * WORLD_SIZE;
        spawnY = Math.random() * WORLD_SIZE;
      } while (Math.hypot(spawnX - WORLD_CENTER, spawnY - WORLD_CENTER) < SPAWN_SAFETY_DIST);

      const randomSkin = SKINS[Math.floor(Math.random() * (SKINS.length - 1))]; // Avoid secret skin for bots by default

      return {
        id: `bot-${i}`,
        name: `Duckling_${Math.floor(Math.random() * 1000)}`,
        color: randomSkin.color,
        skinId: randomSkin.id,
        head: { x: spawnX, y: spawnY },
        trail: [],
        history: [{ x: spawnX, y: spawnY }],
        angle: Math.random() * Math.PI * 2,
        score: 0,
        isDead: false,
        speed: 4.5,
        isBoosting: false,
        inventory: { SPEED: 0, VISION: 0, MAGNET: 0 },
        activePowerUps: { SPEED: 0, VISION: 0, MAGNET: 0 },
      };
    });

    foodsRef.current = Array.from({ length: FOOD_COUNT }).map((_, i) => ({
      id: `food-${i}`,
      x: Math.random() * WORLD_SIZE,
      y: Math.random() * WORLD_SIZE,
      value: 1,
      color: COLORS_LIST[Math.floor(Math.random() * COLORS_LIST.length)],
    }));
    updateFoodGrid(foodsRef.current);

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
      if (controlMode === 'KEYBOARD' && e.key === ' ') {
        playerRef.current.isBoosting = true;
      }

      // Power-up activation
      if (e.key === '1') {
        if ((playerRef.current.inventory.SPEED > 0 || devMode) && playerRef.current.activePowerUps.SPEED <= 0) {
          if (!devMode) playerRef.current.inventory.SPEED--;
          playerRef.current.activePowerUps.SPEED = 300; // 5 seconds at 60fps
          playSound('boost');
        }
      }
      if (e.key === '2') {
        if ((playerRef.current.inventory.VISION > 0 || devMode) && playerRef.current.activePowerUps.VISION <= 0) {
          if (!devMode) playerRef.current.inventory.VISION--;
          playerRef.current.activePowerUps.VISION = 300; // 5 seconds at 60fps
          playSound('pop');
        }
      }
      if (e.key === '3') {
        if ((playerRef.current.inventory.MAGNET > 0 || devMode) && playerRef.current.activePowerUps.MAGNET <= 0) {
          if (!devMode) playerRef.current.inventory.MAGNET--;
          playerRef.current.activePowerUps.MAGNET = 300; // 5 seconds at 60fps
          playSound('pop');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
      if (controlMode === 'KEYBOARD' && e.key === ' ') {
        playerRef.current.isBoosting = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [controlMode]);

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    mousePos.current = { x, y };

    if (controlMode === 'JOYSTICK' && joystickActive.current && joystickBase.current) {
      joystickCurrent.current = { x, y };
      const dx = x - joystickBase.current.x;
      const dy = y - joystickBase.current.y;
      joystickAngle.current = Math.atan2(dy, dx);
    }
  };

  const updateDuck = (duck: Duck, targetAngle: number, isPlayer: boolean, otherDucks: Duck[], foods: Food[], smoothing = 0.1) => {
    if (duck.isDead) return duck;

    // Smooth angle transition
    let angleDiff = targetAngle - duck.angle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    duck.angle += angleDiff * smoothing;

    const currentSpeed = duck.speed;
    
    // Move head
    const nextHead = {
      x: duck.head.x + Math.cos(duck.angle) * currentSpeed,
      y: duck.head.y + Math.sin(duck.angle) * currentSpeed,
    };

    // Boundary check
    let isDead = duck.isDead;
    if (nextHead.x <= 0 || nextHead.x >= WORLD_SIZE || nextHead.y <= 0 || nextHead.y >= WORLD_SIZE) {
      isDead = true;
    }

    // Update history
    const newHistory = [nextHead, ...duck.history];
    const targetTrailCount = Math.floor(duck.score / 2);
    
    // Pick points from history for the trail
    const newTrail: Point[] = [];
    let lastPoint = nextHead;
    for (let i = 0; i < newHistory.length; i++) {
      const p = newHistory[i];
      const dist = Math.hypot(p.x - lastPoint.x, p.y - lastPoint.y);
      if (dist >= DUCKLING_SPACING) {
        newTrail.push(p);
        lastPoint = p;
        if (newTrail.length >= targetTrailCount) break;
      }
    }

    // Keep history long enough to support the trail
    const maxHistoryLength = (targetTrailCount + 2) * 20; 
    const trimmedHistory = newHistory.slice(0, maxHistoryLength);

    return {
      ...duck,
      head: nextHead,
      trail: newTrail,
      history: trimmedHistory,
      isDead,
    };
  };

  const gameLoop = (time: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = time;
    lastTimeRef.current = time;

    const canvas = canvasRef.current;
    if (!canvas) {
      requestRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const player = playerRef.current;
    const bots = botsRef.current;
    const foods = foodsRef.current;

    // Update active power-ups and speed for player
    if (player.activePowerUps.SPEED > 0) player.activePowerUps.SPEED--;
    if (player.activePowerUps.VISION > 0) player.activePowerUps.VISION--;
    if (player.activePowerUps.MAGNET > 0) player.activePowerUps.MAGNET--;

    // Magnet Effect: Attract nearby food and particles
    if (player.activePowerUps.MAGNET > 0) {
      const magnetRange = 300;
      const magnetStrength = 0.15;

      // Attract Food
      foods.forEach(food => {
        const dx = player.head.x - food.x;
        const dy = player.head.y - food.y;
        const dist = Math.hypot(dx, dy);
        if (dist < magnetRange) {
          food.x += (dx / dist) * (magnetRange - dist) * magnetStrength;
          food.y += (dy / dist) * (magnetRange - dist) * magnetStrength;
        }
      });

      // Attract Particles
      particles.current.forEach(p => {
        const dx = player.head.x - p.x;
        const dy = player.head.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < magnetRange) {
          p.vx += (dx / dist) * 0.5;
          p.vy += (dy / dist) * 0.5;
        }
      });
    }

    let playerMoveSpeed = 5.0;
    if (player.isBoosting) playerMoveSpeed *= 1.7;
    if (player.activePowerUps.SPEED > 0) playerMoveSpeed *= 1.4;
    player.speed = playerMoveSpeed;

    // Sync boost from prop if in joystick mode
    if (controlMode === 'JOYSTICK') {
      if (isBoosting && !player.isBoosting) playSound('boost');
      player.isBoosting = isBoosting;
    }

    // 1. Update Player Angle
    let targetAngle = player.angle;
    if (controlMode === 'FOLLOW') {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const dx = mousePos.current.x - centerX;
      const dy = mousePos.current.y - centerY;
      if (Math.hypot(dx, dy) > 10) {
        targetAngle = Math.atan2(dy, dx);
      }
    } else if (controlMode === 'JOYSTICK' && joystickAngle.current !== null) {
      targetAngle = joystickAngle.current;
    } else if (controlMode === 'KEYBOARD') {
      let dx = 0;
      let dy = 0;
      
      let up = keysPressed.current['w'] || keysPressed.current['arrowup'];
      let down = keysPressed.current['s'] || keysPressed.current['arrowdown'];
      let left = keysPressed.current['a'] || keysPressed.current['arrowleft'];
      let right = keysPressed.current['d'] || keysPressed.current['arrowright'];

      if (invertControls) {
        const temp = left;
        left = right;
        right = temp;
      }

      if (up) dy -= 1;
      if (down) dy += 1;
      if (left) dx -= 1;
      if (right) dx += 1;

      if (dx !== 0 || dy !== 0) {
        targetAngle = Math.atan2(dy, dx);
      }
    }
    
    const updatedPlayer = updateDuck(player, targetAngle, true, bots, foods, controlMode === 'KEYBOARD' ? 0.4 : 0.25);
    playerRef.current = updatedPlayer;

    // Update Duck Grid for bots to use
    updateDuckGrid([updatedPlayer, ...bots]);

    if (updatedPlayer.isDead && !player.isDead) {
      // Death particles
      playSound('die');
      dropFood(updatedPlayer, foodsRef.current);
      for (let p = 0; p < 20; p++) {
        particles.current.push({
          x: updatedPlayer.head.x,
          y: updatedPlayer.head.y,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10,
          life: 1,
          color: updatedPlayer.color,
        });
      }
      onGameOver(updatedPlayer.score);
      return; // Stop loop for player
    }

    // 2. Update Bots
    const updatedBots = bots.map(bot => {
      // Update active power-ups for bots
      if (bot.activePowerUps.SPEED > 0) bot.activePowerUps.SPEED--;
      if (bot.activePowerUps.VISION > 0) bot.activePowerUps.VISION--;

      let botMoveSpeed = 3.2;
      if (bot.isBoosting) botMoveSpeed *= 1.3;
      if (bot.activePowerUps.SPEED > 0) botMoveSpeed *= 1.25;
      bot.speed = botMoveSpeed;

      let botTargetAngle = bot.angle;
      
      // 1. Find nearest food or special drop using Grid
      const col = Math.floor(bot.head.x / GRID_SIZE);
      const row = Math.floor(bot.head.y / GRID_SIZE);
      let targetObj: { x: number; y: number; dist: number; isSpecial?: boolean } | null = null;

      // Check for special drops first (higher priority)
      specialDropsRef.current.forEach(drop => {
        const dist = Math.hypot(drop.x - bot.head.x, drop.y - bot.head.y);
        const visionRange = bot.activePowerUps.VISION > 0 ? 1200 : 600;
        if (dist < visionRange && (!targetObj || dist < targetObj.dist)) {
          targetObj = { x: drop.x, y: drop.y, dist, isSpecial: true };
        }
      });

      // If no special drop, find nearest food
      if (!targetObj) {
        const searchRange = bot.activePowerUps.VISION > 0 ? 2 : 1;
        for (let i = -searchRange; i <= searchRange; i++) {
          for (let j = -searchRange; j <= searchRange; j++) {
            const key = `${col + i},${row + j}`;
            const cellFoods = foodGrid.current.get(key);
            if (cellFoods) {
              cellFoods.forEach(food => {
                const dist = Math.hypot(food.x - bot.head.x, food.y - bot.head.y);
                if (dist < 400 && (!targetObj || dist < targetObj.dist)) {
                  targetObj = { x: food.x, y: food.y, dist };
                }
              });
            }
          }
        }
      }

      if (targetObj) {
        botTargetAngle = Math.atan2(targetObj.y - bot.head.y, targetObj.x - bot.head.x);
        // Boost if special drop is close or bot is very small and near food
        bot.isBoosting = (targetObj.isSpecial && targetObj.dist < 200) || (targetObj.dist < 100 && bot.score < 30);
        
        // Use SPEED power-up if chasing a special drop (less aggressive)
        if (targetObj.isSpecial && targetObj.dist < 400 && bot.inventory.SPEED > 0 && bot.activePowerUps.SPEED <= 0 && Math.random() < 0.5) {
          bot.inventory.SPEED--;
          bot.activePowerUps.SPEED = 200;
        }
      } else {
        bot.isBoosting = false;
        // Wander with some noise
        if (Math.random() < 0.05) {
          botTargetAngle += (Math.random() - 0.5) * 1.5;
        }
        
        // Use VISION power-up if no food found
        if (bot.inventory.VISION > 0 && bot.activePowerUps.VISION <= 0 && Math.random() < 0.01) {
          bot.inventory.VISION--;
          bot.activePowerUps.VISION = 300;
        }
      }

      // 2. Avoid Boundaries
      const bMargin = 250;
      if (bot.head.x < bMargin) botTargetAngle = 0;
      else if (bot.head.x > WORLD_SIZE - bMargin) botTargetAngle = Math.PI;
      else if (bot.head.y < bMargin) botTargetAngle = Math.PI / 2;
      else if (bot.head.y > WORLD_SIZE - bMargin) botTargetAngle = -Math.PI / 2;

      // 3. Avoid other ducks (Heads and Trails) and Aggression
      const colDuck = Math.floor(bot.head.x / GRID_SIZE);
      const rowDuck = Math.floor(bot.head.y / GRID_SIZE);
      let avoidanceActive = false;
      
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const key = `${colDuck + i},${rowDuck + j}`;
          const cellDucks = duckGrid.current.get(key);
          if (cellDucks) {
            for (const other of cellDucks) {
              if (other.id === bot.id) continue;
              
              const dist = Math.hypot(other.head.x - bot.head.x, other.head.y - bot.head.y);
              
              // Aggression: Target vulnerable ducks (low score, not boosting, or much smaller)
              const isVulnerable = (other.score < 50 && !other.isBoosting) || (bot.score > other.score * 1.8);
              const isPlayer = other.id === 'player';
              
              if (isVulnerable && dist < 400 && !avoidanceActive) {
                const angleToOther = Math.atan2(other.head.y - bot.head.y, other.head.x - bot.head.x);
                
                // Prediction: Aim where they are going
                const predictionFactor = isPlayer ? 0.6 : 0.4;
                botTargetAngle = angleToOther + (other.angle - angleToOther) * predictionFactor;
                
                // Be more aggressive towards the player
                if (isPlayer || Math.random() < 0.8) {
                  bot.isBoosting = true;
                  if (bot.inventory.SPEED > 0 && bot.activePowerUps.SPEED <= 0 && (dist < 200 || isPlayer)) {
                    bot.inventory.SPEED--;
                    bot.activePowerUps.SPEED = 150;
                  }
                }
              }

              // Avoid Head (Priority)
              if (dist < 200) {
                const angleToOther = Math.atan2(other.head.y - bot.head.y, other.head.x - bot.head.x);
                botTargetAngle = angleToOther + Math.PI + (Math.random() - 0.5) * 0.5; 
                bot.isBoosting = true;
                avoidanceActive = true;
                
                if (bot.inventory.SPEED > 0 && bot.activePowerUps.SPEED <= 0 && Math.random() < 0.6) {
                  bot.inventory.SPEED--;
                  bot.activePowerUps.SPEED = 150;
                }
                break;
              }

              // Avoid Trail (Sampled)
              if (other.trail.length > 0) {
                // Check more points if it's the player's trail
                const step = other.id === 'player' ? 3 : 5;
                for (let k = 0; k < other.trail.length; k += step) { 
                  const p = other.trail[k];
                  const dTrail = Math.hypot(p.x - bot.head.x, p.y - bot.head.y);
                  const avoidanceRadius = other.id === 'player' ? 160 : 140;
                  if (dTrail < avoidanceRadius) {
                    const angleToTrail = Math.atan2(p.y - bot.head.y, p.x - bot.head.x);
                    botTargetAngle = angleToTrail + Math.PI + (Math.random() - 0.5) * 1.0;
                    bot.isBoosting = true;
                    avoidanceActive = true;
                    break;
                  }
                }
              }
              if (avoidanceActive) break;
            }
          }
          if (avoidanceActive) break;
        }
        if (avoidanceActive) break;
      }

      const updatedBot = updateDuck(bot, botTargetAngle, false, [updatedPlayer, ...bots], foods, 0.12);
      if (updatedBot.isDead && !bot.isDead) {
        dropFood(updatedBot, foods);
        playSound('pop');
      }
      return updatedBot;
    });

    // 3. Collision Detection (Food) using Grid
    const allDucks = [updatedPlayer, ...updatedBots];
    let foodChanged = false;
    
    allDucks.forEach(duck => {
      const col = Math.floor(duck.head.x / GRID_SIZE);
      const row = Math.floor(duck.head.y / GRID_SIZE);

      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const key = `${col + i},${row + j}`;
          const cellFoods = foodGrid.current.get(key);
          if (cellFoods) {
            for (let k = cellFoods.length - 1; k >= 0; k--) {
              const food = cellFoods[k];
              const dist = Math.hypot(duck.head.x - food.x, duck.head.y - food.y);
              if (dist < DUCK_RADIUS + 5) {
                duck.score += food.value;
                if (duck.id === 'player') {
                  onScoreUpdate(duck.score);
                  playSound('eat');
                }
                
                if (particles.current.length < 200) { // Particle limit
                  for (let p = 0; p < 5; p++) {
                    particles.current.push({
                      x: food.x,
                      y: food.y,
                      vx: (Math.random() - 0.5) * 4,
                      vy: (Math.random() - 0.5) * 4,
                      life: 1,
                      color: food.color,
                    });
                  }
                }

                // Remove from global list and grid
                const globalIdx = foods.findIndex(f => f.id === food.id);
                if (globalIdx !== -1) foods.splice(globalIdx, 1);
                cellFoods.splice(k, 1);
                
                // Respawn
                const newFood = {
                  id: `food-${Math.random()}`,
                  x: Math.random() * WORLD_SIZE,
                  y: Math.random() * WORLD_SIZE,
                  value: 1,
                  color: COLORS[Math.floor(Math.random() * COLORS.length)],
                };
                foods.push(newFood);
                foodChanged = true;
              }
            }
          }
        }
      }
    });

    if (foodChanged) updateFoodGrid(foods);

    // 4. Collision Detection (Ducks vs Trails) using Grid
    allDucks.forEach(duck => {
      if (duck.isDead) return;
      
      const col = Math.floor(duck.head.x / GRID_SIZE);
      const row = Math.floor(duck.head.y / GRID_SIZE);

      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const key = `${col + i},${row + j}`;
          const cellDucks = duckGrid.current.get(key);
          if (cellDucks) {
            cellDucks.forEach(other => {
              if (duck.id === other.id) return;
              
              // Trail collision
              if (other.trail.length > 0) {
                for (let k = 0; k < other.trail.length; k += 2) {
                  const p = other.trail[k];
                  const dist = Math.hypot(duck.head.x - p.x, duck.head.y - p.y);
                  if (dist < DUCK_RADIUS + DUCKLING_RADIUS - 5) {
                    duck.isDead = true;
                    dropFood(duck, foodsRef.current);
                    updateFoodGrid(foodsRef.current);
                    
                    if (particles.current.length < 200) {
                      for (let pCount = 0; pCount < 15; pCount++) {
                        particles.current.push({
                          x: duck.head.x,
                          y: duck.head.y,
                          vx: (Math.random() - 0.5) * 10,
                          vy: (Math.random() - 0.5) * 10,
                          life: 1,
                          color: duck.color,
                        });
                      }
                    }

                    if (duck.id === 'player') {
                      playSound('die');
                      onGameOver(duck.score);
                    } else {
                      playSound('pop');
                    }
                    return;
                  }
                }
              }

              // Head-to-head collision
              const headDist = Math.hypot(duck.head.x - other.head.x, duck.head.y - other.head.y);
              if (headDist < DUCK_RADIUS * 2 - 5) {
                duck.isDead = true;
                other.isDead = true;
                dropFood(duck, foodsRef.current);
                dropFood(other, foodsRef.current);
                updateFoodGrid(foodsRef.current);
                
                [duck, other].forEach(d => {
                  if (particles.current.length < 200) {
                    for (let pCount = 0; pCount < 15; pCount++) {
                      particles.current.push({
                        x: d.head.x,
                        y: d.head.y,
                        vx: (Math.random() - 0.5) * 10,
                        vy: (Math.random() - 0.5) * 10,
                        life: 1,
                        color: d.color,
                      });
                    }
                  }
                });

                if (duck.id === 'player' || other.id === 'player') {
                  playSound('die');
                  onGameOver(duck.id === 'player' ? duck.score : other.score);
                } else {
                  playSound('pop');
                }
              }
            });
          }
        }
      }
    });

    // Filter out dead bots and respawn
    const aliveBots = updatedBots.filter(b => !b.isDead);
    while (aliveBots.length < BOT_COUNT) {
      let spawnX, spawnY;
      const margin = 100;
      // Ensure bots don't spawn in player's view
      // View is roughly canvas.width x canvas.height centered on player
      do {
        spawnX = Math.random() * WORLD_SIZE;
        spawnY = Math.random() * WORLD_SIZE;
      } while (
        Math.abs(spawnX - updatedPlayer.head.x) < canvas.width / 2 + margin &&
        Math.abs(spawnY - updatedPlayer.head.y) < canvas.height / 2 + margin
      );

      const randomSkin = SKINS[Math.floor(Math.random() * (SKINS.length - 1))];
      aliveBots.push({
        id: `bot-${Math.random()}`,
        name: `Duckling_${Math.floor(Math.random() * 1000)}`,
        color: randomSkin.color,
        skinId: randomSkin.id,
        head: { x: spawnX, y: spawnY },
        trail: [],
        history: [{ x: spawnX, y: spawnY }],
        angle: Math.random() * Math.PI * 2,
        score: 0,
        isDead: false,
        speed: 4.5,
        isBoosting: false,
        inventory: { SPEED: 0, VISION: 0 },
        activePowerUps: { SPEED: 0, VISION: 0 },
      });
    }

    botsRef.current = aliveBots;

    // 5. Update Leaderboard (Throttled)
    if (time - lastLeaderboardUpdate.current > 500) {
      const leaders = [updatedPlayer, ...aliveBots]
        .filter(d => !d.isDead)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(d => ({ name: d.name, score: d.score }));
      
      onUpdateLeaderboard(leaders);
      lastLeaderboardUpdate.current = time;
    }

    // Update parent with power-up state
    if (onPowerUpsUpdate) {
      onPowerUpsUpdate(updatedPlayer.inventory, updatedPlayer.activePowerUps);
    }

    // 6. Spawn Special Drops (Every 100 points)
    if (updatedPlayer.score >= lastDropScore.current + 100) {
      // Margin of 500 units from edges
      const margin = 500;
      specialDropsRef.current.push({
        id: `drop-${Math.random()}`,
        x: margin + Math.random() * (WORLD_SIZE - margin * 2),
        y: margin + Math.random() * (WORLD_SIZE - margin * 2),
        type: 'BOX',
        color: '#facc15', // Yellow-400
        pulse: 0,
      });
      if (onSpecialDropSpawned) onSpecialDropSpawned();
      lastDropScore.current = Math.floor(updatedPlayer.score / 100) * 100;
    }

    // Update Special Drops (Pulse effect)
    specialDropsRef.current.forEach(drop => {
      drop.pulse = (drop.pulse + 0.05) % (Math.PI * 2);
    });

    // Check collision with special drops
    [updatedPlayer, ...aliveBots].forEach(duck => {
      if (duck.isDead) return;
      specialDropsRef.current = specialDropsRef.current.filter(drop => {
        const dx = duck.head.x - drop.x;
        const dy = duck.head.y - drop.y;
        const dist = Math.hypot(dx, dy);
        if (dist < DUCK_RADIUS + 10) {
          duck.score += 50; // Big boost
          playSound('eat');

          // Give random power-up
          const rand = Math.random();
          if (rand < 0.33) {
            duck.inventory.SPEED++;
          } else if (rand < 0.66) {
            duck.inventory.VISION++;
          } else {
            duck.inventory.MAGNET++;
          }

          // Add some particles
          for (let i = 0; i < 20; i++) {
            particles.current.push({
              x: drop.x,
              y: drop.y,
              vx: (Math.random() - 0.5) * 10,
              vy: (Math.random() - 0.5) * 10,
              life: 1,
              color: drop.color,
            });
          }
          return false;
        }
        return true;
      });
    });

    // Update particles
    particles.current = particles.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
      return p.life > 0;
    });

    // Limit total particles for performance
    if (particles.current.length > 250) {
      particles.current = particles.current.slice(-250);
    }

    // Emit boost particles
    [player, ...bots].forEach(duck => {
      if (duck.isBoosting && !duck.isDead) {
        for (let i = 0; i < 2; i++) {
          particles.current.push({
            x: duck.head.x - Math.cos(duck.angle) * DUCK_RADIUS + (Math.random() - 0.5) * 10,
            y: duck.head.y - Math.sin(duck.angle) * DUCK_RADIUS + (Math.random() - 0.5) * 10,
            vx: -Math.cos(duck.angle) * 2 + (Math.random() - 0.5) * 2,
            vy: -Math.sin(duck.angle) * 2 + (Math.random() - 0.5) * 2,
            life: 0.5 + Math.random() * 0.5,
            color: 'rgba(255, 255, 255, 0.6)',
          });
        }
      }
    });

    draw();
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const player = playerRef.current;
    const bots = botsRef.current;
    const foods = foodsRef.current;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Camera transform
    ctx.save();
    
    // Zoom effect for VISION power-up
    const baseZoom = 1;
    const visionZoom = 0.6;
    const currentZoom = player.activePowerUps.VISION > 0 ? visionZoom : baseZoom;
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(currentZoom, currentZoom);
    ctx.translate(-player.head.x, -player.head.y);

    // Optimization: Calculate Viewport for Culling
    const viewportWidth = canvas.width / currentZoom;
    const viewportHeight = canvas.height / currentZoom;
    const viewportX = player.head.x - viewportWidth / 2;
    const viewportY = player.head.y - viewportHeight / 2;
    const viewportMargin = 100;

    const isInViewport = (x: number, y: number, radius = 0) => {
      return x >= viewportX - radius - viewportMargin &&
             x <= viewportX + viewportWidth + radius + viewportMargin &&
             y >= viewportY - radius - viewportMargin &&
             y <= viewportY + viewportHeight + radius + viewportMargin;
    };

    // Draw Pond Grid (Optimized: Only visible lines)
    ctx.strokeStyle = (theme === 'WHITE' || theme === 'PINK') ? 'rgba(0, 0, 0, 0.1)' : '#a5f3fc';
    ctx.lineWidth = 1;
    const gridSize = 100;
    const startX = Math.max(0, Math.floor(viewportX / gridSize) * gridSize);
    const endX = Math.min(WORLD_SIZE, Math.ceil((viewportX + viewportWidth) / gridSize) * gridSize);
    const startY = Math.max(0, Math.floor(viewportY / gridSize) * gridSize);
    const endY = Math.min(WORLD_SIZE, Math.ceil((viewportY + viewportHeight) / gridSize) * gridSize);

    for (let x = startX; x <= endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, Math.max(0, startY));
      ctx.lineTo(x, Math.min(WORLD_SIZE, endY));
      ctx.stroke();
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(Math.max(0, startX), y);
      ctx.lineTo(Math.min(WORLD_SIZE, endX), y);
      ctx.stroke();
    }

    // Draw Boundaries
    ctx.strokeStyle = (theme === 'WHITE' || theme === 'PINK') ? '#333333' : '#0891b2';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);

    // Draw Food (Optimized: Culling)
    foods.forEach(food => {
      if (!isInViewport(food.x, food.y, 10)) return;
      ctx.fillStyle = food.color;
      ctx.beginPath();
      ctx.arc(food.x, food.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    const drawDuckBody = (x: number, y: number, radius: number, duck: Duck, isHead: boolean = false) => {
      const skinImg = getSkinCanvas(duck, radius);
      
      ctx.save();
      ctx.translate(x, y);

      if (isHead) {
        // Head is slightly larger/elliptical, draw manually or use cache if possible
        // For simplicity and performance, we'll use the cached body but scale it slightly
        ctx.save();
        ctx.scale(1.1, 1);
        ctx.drawImage(skinImg, -skinImg.width/2, -skinImg.height/2);
        ctx.restore();
      } else {
        ctx.drawImage(skinImg, -skinImg.width/2, -skinImg.height/2);
      }

      ctx.restore();
    };

    // Draw Special Drops (Optimized: Culling)
    specialDropsRef.current.forEach(drop => {
      if (!isInViewport(drop.x, drop.y, 50)) return;
      ctx.save();
      ctx.translate(drop.x, drop.y);
      const pulseScale = 1 + Math.sin(drop.pulse) * 0.15;
      ctx.scale(pulseScale, pulseScale);
      
      // Glow
      const gradient = ctx.createRadialGradient(0, 0, 10, 0, 0, 35);
      gradient.addColorStop(0, 'rgba(250, 204, 21, 0.5)');
      gradient.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, 35, 0, Math.PI * 2);
      ctx.fill();

      // Box Shape (Crate)
      const size = 45;
      ctx.fillStyle = '#854d0e'; // Brown-800 for crate base
      ctx.fillRect(-size/2, -size/2, size, size);
      
      // Crate details
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.strokeRect(-size/2, -size/2, size, size);
      
      // Cross on crate
      ctx.beginPath();
      ctx.moveTo(-size/2, -size/2);
      ctx.lineTo(size/2, size/2);
      ctx.moveTo(size/2, -size/2);
      ctx.lineTo(-size/2, size/2);
      ctx.stroke();

      // Question mark or icon on top
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 0);

      ctx.restore();
    });

    // Draw Particles
    particles.current.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw Ducks (Optimized: Culling)
    const allDucks = [player, ...bots];
    const leader = allDucks.reduce((prev, current) => (prev.score > current.score) ? prev : current);

    allDucks.forEach(duck => {
      if (duck.isDead) return;

      // Only draw if head or part of trail is visible
      const isHeadVisible = isInViewport(duck.head.x, duck.head.y, DUCK_RADIUS + 50);
      const isAnyTrailVisible = duck.trail.some(p => isInViewport(p.x, p.y, DUCKLING_RADIUS + 20));
      
      if (!isHeadVisible && !isAnyTrailVisible) return;

      // Draw Trail (Ducklings)
      const numDucks = Math.floor(duck.score / 10);
      const numSmallDucks = Math.floor((duck.score % 10) / 5);

      duck.trail.forEach((p, i) => {
        if (!isInViewport(p.x, p.y, DUCKLING_RADIUS)) return;
        
        let radius = DUCKLING_RADIUS;
        
        // Size decreases slightly along the trail
        if (i < numDucks) {
          radius = DUCKLING_RADIUS;
        } else if (i < numDucks + numSmallDucks) {
          radius = DUCKLING_RADIUS * 0.85;
        } else {
          radius = DUCKLING_RADIUS * 0.7;
        }

        // Calculate angle for duckling (facing the point ahead of it)
        const prevPoint = i === 0 ? duck.head : duck.trail[i - 1];
        const ducklingAngle = Math.atan2(prevPoint.y - p.y, prevPoint.x - p.x);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ducklingAngle);

        // Draw Body
        drawDuckBody(0, 0, radius, duck);
        
        // Eyes
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(radius * 0.2, -radius * 0.3, radius * 0.15, 0, Math.PI * 2);
        ctx.arc(radius * 0.2, radius * 0.3, radius * 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Beak
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(radius * 0.8, -radius * 0.2);
        ctx.lineTo(radius * 1.2, 0);
        ctx.lineTo(radius * 0.8, radius * 0.2);
        ctx.fill();

        ctx.restore();
      });

      // Draw Head (Mama Duck)
      ctx.save();
      ctx.translate(duck.head.x, duck.head.y);
      ctx.rotate(duck.angle);
      
      // Boost Glow
      if (duck.isBoosting) {
        ctx.save();
        const gradient = ctx.createRadialGradient(0, 0, DUCK_RADIUS, 0, 0, DUCK_RADIUS + 15);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, DUCK_RADIUS + 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Body
      drawDuckBody(0, 0, DUCK_RADIUS, duck, true);

      // Magnet Visual Effect
      if (duck.activePowerUps.MAGNET > 0) {
        ctx.save();
        const pulse = (Date.now() / 200) % (Math.PI * 2);
        const radius = DUCK_RADIUS + 10 + Math.sin(pulse) * 5;
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.6)';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner glow
        const gradient = ctx.createRadialGradient(0, 0, DUCK_RADIUS, 0, 0, radius);
        gradient.addColorStop(0, 'rgba(192, 132, 252, 0)');
        gradient.addColorStop(1, 'rgba(192, 132, 252, 0.2)');
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.restore();
      }

      // Beak
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(DUCK_RADIUS, -8);
      ctx.lineTo(DUCK_RADIUS + 15, 0);
      ctx.lineTo(DUCK_RADIUS, 8);
      ctx.fill();

      // Eyes (Top-down view needs two eyes)
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(8, -10, 4, 0, Math.PI * 2);
      ctx.arc(8, 10, 4, 0, Math.PI * 2);
      ctx.fill();

      // Eye highlights
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(10, -11, 1.5, 0, Math.PI * 2);
      ctx.arc(10, 9, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Name tag
      ctx.save();
      const name = duck.name;
      ctx.font = 'bold 13px sans-serif';
      const textWidth = ctx.measureText(name).width;
      const paddingH = 10;
      const paddingV = 4;
      const boxWidth = textWidth + paddingH * 2;
      const boxHeight = 20;
      const boxX = duck.head.x - boxWidth / 2;
      const boxY = duck.head.y - 35;

      // Draw background pill
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 10);
        ctx.fill();
      } else {
        // Fallback for older browsers
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      }

      // Draw text
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, duck.head.x, boxY + boxHeight / 2);
      ctx.restore();

      // Draw Crown for Leader
      if (duck.id === leader.id && duck.score > 0) {
        ctx.save();
        ctx.translate(duck.head.x, duck.head.y - 65);
        ctx.fillStyle = '#fbbf24'; // Yellow-400
        ctx.strokeStyle = '#92400e'; // Amber-800
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-10, 5);
        ctx.lineTo(-12, -5);
        ctx.lineTo(-5, 0);
        ctx.lineTo(0, -8);
        ctx.lineTo(5, 0);
        ctx.lineTo(12, -5);
        ctx.lineTo(10, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    });

    ctx.restore();

    // Fog Effect (Subtle Vignette)
    const maxDim = Math.max(canvas.width, canvas.height);
    const fogRadius = player.activePowerUps.VISION > 0 ? maxDim * 1.2 : maxDim * 0.6;
    const fogGradient = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 100,
      canvas.width / 2, canvas.height / 2, fogRadius
    );
    
    const fogColor = theme === 'WHITE' ? '255, 255, 255' : theme === 'BLACK' ? '0, 0, 0' : theme === 'PINK' ? '251, 207, 232' : '8, 51, 68';
    
    fogGradient.addColorStop(0, `rgba(${fogColor}, 0)`); 
    fogGradient.addColorStop(0.6, `rgba(${fogColor}, 0.2)`);
    fogGradient.addColorStop(1, `rgba(${fogColor}, 0.7)`);
    
    ctx.fillStyle = fogGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Off-screen Leader Indicator
    if (leader.id !== player.id && !leader.isDead) {
      const dx = leader.head.x - player.head.x;
      const dy = leader.head.y - player.head.y;
      const dist = Math.hypot(dx, dy);
      
      // Check if off-screen
      const margin = 40;
      const isOffScreen = 
        Math.abs(dx) > canvas.width / 2 - margin || 
        Math.abs(dy) > canvas.height / 2 - margin;

      if (isOffScreen) {
        const angle = Math.atan2(dy, dx);
        const edgeX = Math.max(margin, Math.min(canvas.width - margin, canvas.width / 2 + (dx / dist) * (canvas.width / 2 - margin)));
        const edgeY = Math.max(margin, Math.min(canvas.height - margin, canvas.height / 2 + (dy / dist) * (canvas.height / 2 - margin)));

        ctx.save();
        ctx.translate(edgeX, edgeY);
        ctx.rotate(angle);
        
        // Draw Arrow
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-5, -8);
        ctx.lineTo(-5, 8);
        ctx.closePath();
        ctx.fill();
        
        // Draw Mini Crown on Arrow
        ctx.scale(0.5, 0.5);
        ctx.translate(-20, 0);
        ctx.rotate(-angle);
        ctx.beginPath();
        ctx.moveTo(-10, 5); ctx.lineTo(-12, -5); ctx.lineTo(-5, 0); ctx.lineTo(0, -8); ctx.lineTo(5, 0); ctx.lineTo(12, -5); ctx.lineTo(10, 5);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
      }
    }

    // Draw Special Drop Indicators
    specialDropsRef.current.forEach(drop => {
      const dx = drop.x - player.head.x;
      const dy = drop.y - player.head.y;
      const dist = Math.hypot(dx, dy);
      
      const margin = 60;
      const isOffScreen = 
        Math.abs(dx) > canvas.width / 2 - margin || 
        Math.abs(dy) > canvas.height / 2 - margin;

      if (isOffScreen) {
        const angle = Math.atan2(dy, dx);
        const edgeX = Math.max(margin, Math.min(canvas.width - margin, canvas.width / 2 + (dx / dist) * (canvas.width / 2 - margin)));
        const edgeY = Math.max(margin, Math.min(canvas.height - margin, canvas.height / 2 + (dy / dist) * (canvas.height / 2 - margin)));

        ctx.save();
        ctx.translate(edgeX, edgeY);
        ctx.rotate(angle);
        
        // Arrow
        ctx.fillStyle = drop.color;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-5, -8);
        ctx.lineTo(-5, 8);
        ctx.closePath();
        ctx.fill();
        
        // Box on Arrow
        ctx.rotate(-angle);
        ctx.translate(-20, 0);
        ctx.fillStyle = drop.color;
        ctx.fillRect(-5, -5, 10, 10);
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.strokeRect(-5, -5, 10, 10);
        
        ctx.restore();
      }
    });

    // Draw Minimap (Optimized: Draw food less frequently or as a simplified pass)
    const minimapSize = 150;
    const minimapPadding = 20;
    ctx.save();
    ctx.translate(canvas.width - minimapSize - minimapPadding, canvas.height - minimapSize - minimapPadding);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, minimapSize, minimapSize);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(0, 0, minimapSize, minimapSize);

    const scale = minimapSize / WORLD_SIZE;
    
    // Food on minimap (Optimized: Only draw a fraction of food or skip if too many)
    ctx.globalAlpha = 0.4;
    const foodStep = gameMode === 'LARGE' ? 4 : 1;
    for (let i = 0; i < foods.length; i += foodStep) {
      const food = foods[i];
      ctx.fillStyle = food.color;
      ctx.fillRect(food.x * scale, food.y * scale, 1, 1);
    }
    ctx.globalAlpha = 1;

    // Special Drops on minimap
    specialDropsRef.current.forEach(drop => {
      ctx.fillStyle = drop.color;
      ctx.fillRect(drop.x * scale - 3, drop.y * scale - 3, 6, 6);
      // Pulsing ring
      ctx.strokeStyle = drop.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(drop.x * scale, drop.y * scale, 6 + Math.sin(drop.pulse) * 3, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Player on minimap
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.head.x * scale, player.head.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();

    // Bots on minimap
    bots.forEach(bot => {
      if (bot.isDead) return;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(bot.head.x * scale, bot.head.y * scale, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // Draw Joystick
    if (controlMode === 'JOYSTICK' && joystickActive.current && joystickBase.current) {
      const base = joystickBase.current;
      const current = joystickCurrent.current || base;
      
      // Base
      ctx.save();
      ctx.beginPath();
      ctx.arc(base.x, base.y, 50, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Knob
      const dx = current.x - base.x;
      const dy = current.y - base.y;
      const dist = Math.min(Math.hypot(dx, dy), 50);
      const angle = Math.atan2(dy, dx);
      
      const knobX = base.x + Math.cos(angle) * dist;
      const knobY = base.y + Math.sin(angle) * dist;

      ctx.beginPath();
      ctx.arc(knobX, knobY, 25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  };

  useEffect(() => {
    if (activatePowerUp) {
      if (activatePowerUp === 'SPEED') {
        if ((playerRef.current.inventory.SPEED > 0 || devMode) && playerRef.current.activePowerUps.SPEED <= 0) {
          if (!devMode) playerRef.current.inventory.SPEED--;
          playerRef.current.activePowerUps.SPEED = 300;
          playSound('boost');
        }
      } else if (activatePowerUp === 'VISION') {
        if ((playerRef.current.inventory.VISION > 0 || devMode) && playerRef.current.activePowerUps.VISION <= 0) {
          if (!devMode) playerRef.current.inventory.VISION--;
          playerRef.current.activePowerUps.VISION = 300;
          playSound('pop');
        }
      } else if (activatePowerUp === 'MAGNET') {
        if ((playerRef.current.inventory.MAGNET > 0 || devMode) && playerRef.current.activePowerUps.MAGNET <= 0) {
          if (!devMode) playerRef.current.inventory.MAGNET--;
          playerRef.current.activePowerUps.MAGNET = 300;
          playSound('pop');
        }
      }
    }
  }, [activatePowerUp, devMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    requestRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onTouchMove={handleMouseMove}
      onMouseDown={(e) => { 
        if (controlMode === 'JOYSTICK') {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            joystickActive.current = true;
            joystickBase.current = { x, y };
            joystickCurrent.current = { x, y };
          }
        } else {
          playerRef.current.isBoosting = true; 
          playSound('boost');
        }
      }}
      onMouseUp={() => { 
        playerRef.current.isBoosting = false; 
        joystickActive.current = false;
        joystickBase.current = null;
        joystickCurrent.current = null;
        joystickAngle.current = null;
      }}
      onTouchStart={(e) => { 
        e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = e.touches[0].clientX - rect.left;
          const y = e.touches[0].clientY - rect.top;
          
          if (controlMode === 'JOYSTICK') {
            joystickActive.current = true;
            joystickBase.current = { x, y };
            joystickCurrent.current = { x, y };
          } else {
            handleMouseMove(e); 
            playerRef.current.isBoosting = true; 
            playSound('boost');
          }
        }
      }}
      onTouchEnd={(e) => { 
        e.preventDefault();
        playerRef.current.isBoosting = false; 
        joystickActive.current = false;
        joystickBase.current = null;
        joystickCurrent.current = null;
        joystickAngle.current = null;
      }}
      className={`block w-full h-full ${theme === 'WHITE' ? 'bg-white' : theme === 'BLACK' ? 'bg-black' : theme === 'PINK' ? 'bg-[#fbcfe8]' : 'bg-[#083344]'} cursor-none`}
    />
  );
};
