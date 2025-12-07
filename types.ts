export enum Team {
  MACEDONIA = 'MACEDONIA',
  EASTERN = 'EASTERN'
}

export enum UnitType {
  INFANTRY = 'INFANTRY',
  ARCHER = 'ARCHER',
  CAVALRY = 'CAVALRY',
  ELEPHANT = 'ELEPHANT',
  HERO = 'HERO'
}

export enum UnitState {
  IDLE = 'IDLE',
  MOVING = 'MOVING',
  FIGHTING = 'FIGHTING',
  FLEEING = 'FLEEING',
  DEAD = 'DEAD'
}

export enum FormationType {
  LINE = 'LINE',
  PHALANX = 'PHALANX', // Dense box
  FLANKING = 'FLANKING', // Split
  SCATTERED = 'SCATTERED',
  WEDGE = 'WEDGE'
}

export interface UnitStats {
  hp: number;
  damage: number;
  speed: number;
  range: number;
  attackSpeed: number; // Frames between attacks
  radius: number;
  color: string;
}

export interface BattleStats {
  macedoniaCount: number;
  easternCount: number;
  macedoniaMorale: number; // Average
  easternMorale: number; // Average
  status: string;
}
