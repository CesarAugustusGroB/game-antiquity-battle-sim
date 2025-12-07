import { UnitType } from './types';

export const CANVAS_WIDTH = window.innerWidth;
export const CANVAS_HEIGHT = window.innerHeight;

export const UNIT_CONFIG: Record<UnitType, any> = {
  // HP buffed slightly to allow lines to hold longer
  [UnitType.INFANTRY]: { hp: 130, damage: 15, speed: 0.9, range: 20, attackSpeed: 50, radius: 7, color: '#9ca3af' }, 
  [UnitType.ARCHER]: { hp: 50, damage: 20, speed: 1.1, range: 240, attackSpeed: 90, radius: 6, color: '#57534e' },
  [UnitType.CAVALRY]: { hp: 160, damage: 25, speed: 2.4, range: 25, attackSpeed: 45, radius: 9, color: '#f59e0b' },
  [UnitType.ELEPHANT]: { hp: 1000, damage: 70, speed: 0.7, range: 45, attackSpeed: 80, radius: 20, color: '#44403c' },
  [UnitType.HERO]: { hp: 800, damage: 50, speed: 1.6, range: 35, attackSpeed: 30, radius: 13, color: '#fbbf24' },
};

export const TEAM_COLORS = {
  MACEDONIA: { primary: '#dc2626', secondary: '#fca5a5' }, // Red
  EASTERN: { primary: '#7c3aed', secondary: '#c4b5fd' },   // Purple
};

export const MORALE_THRESHOLD = 20; 
export const MORALE_DECAY_ON_DEATH = 2.5; 
export const MORALE_RECOVERY = 0.03;

// Physics / AI Weights
export const FLOCK_SEPARATION = 5.0; // High separation to keep units distinct
export const FLOCK_ALIGNMENT = 1.0; // Increased to keep lines straight
export const FLOCK_COHESION = 0.0; // Handled by formation pos
export const FORMATION_WEIGHT = 5.0; // VERY HIGH: Units must stay in formation
export const ENGAGE_DISTANCE = 70; // Only break formation if enemy is VERY close
export const MAX_TURN_RATE = 0.08; // Slower turning for weightier feel