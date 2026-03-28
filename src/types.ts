export type ControlMode = 'FOLLOW' | 'JOYSTICK' | 'KEYBOARD';
export type GameMode = 'SMALL' | 'NORMAL' | 'LARGE';
export type Theme = 'NAVY' | 'BLACK' | 'WHITE' | 'PINK';

export interface Point {
  x: number;
  y: number;
}

export type PowerUpType = 'SPEED' | 'VISION' | 'MAGNET';

export interface PowerUp {
  type: PowerUpType;
  duration: number; // in frames or ms
  startTime?: number;
}

export interface Skin {
  id: string;
  name: string;
  color: string;
  pattern?: 'STRIPES' | 'DOTS' | 'GRADIENT' | 'CHECKERED';
  patternColor?: string;
  price: number;
  isSecret?: boolean;
}

export interface Duck {
  id: string;
  name: string;
  color: string;
  skinId?: string;
  head: Point;
  trail: Point[];
  history: Point[];
  angle: number;
  score: number;
  isDead: boolean;
  speed: number;
  isBoosting: boolean;
  inventory: {
    SPEED: number;
    VISION: number;
    MAGNET: number;
  };
  activePowerUps: {
    SPEED: number; // remaining frames
    VISION: number; // remaining frames
    MAGNET: number; // remaining frames
  };
}

export interface Food {
  id: string;
  x: number;
  y: number;
  value: number;
  color: string;
}

export interface SpecialDrop {
  id: string;
  x: number;
  y: number;
  type: 'STAR' | 'CROWN' | 'HEART' | 'BOX';
  color: string;
  pulse: number;
}

export interface GameState {
  players: Duck[];
  foods: Food[];
  worldSize: { width: number; height: number };
}
