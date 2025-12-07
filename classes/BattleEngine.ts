import { Team, UnitType, UnitState, FormationType, UnitStats } from '../types';
import { UNIT_CONFIG, TEAM_COLORS, MORALE_THRESHOLD, MORALE_DECAY_ON_DEATH, MORALE_RECOVERY, FLOCK_ALIGNMENT, FLOCK_SEPARATION, FORMATION_WEIGHT, ENGAGE_DISTANCE, MAX_TURN_RATE } from '../constants';

class Vector2 {
  constructor(public x: number, public y: number) {}
  
  static add(v1: Vector2, v2: Vector2) { return new Vector2(v1.x + v2.x, v1.y + v2.y); }
  static sub(v1: Vector2, v2: Vector2) { return new Vector2(v1.x - v2.x, v1.y - v2.y); }
  static mult(v: Vector2, n: number) { return new Vector2(v.x * n, v.y * n); }
  static div(v: Vector2, n: number) { return new Vector2(v.x / n, v.y / n); }
  static mag(v: Vector2) { return Math.sqrt(v.x * v.x + v.y * v.y); }
  static normalize(v: Vector2) {
    const m = Vector2.mag(v);
    return m === 0 ? new Vector2(0, 0) : Vector2.div(v, m);
  }
  static distSq(v1: Vector2, v2: Vector2) { return (v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2; }
  static clamp(v: Vector2, rect: {x: number, y: number, w: number, h: number}) {
      const x = Math.max(rect.x, Math.min(v.x, rect.x + rect.w));
      const y = Math.max(rect.y, Math.min(v.y, rect.y + rect.h));
      return new Vector2(x, y);
  }
}

class Particle {
  life: number = 1.0;
  constructor(public pos: Vector2, public vel: Vector2, public color: string, public size: number, public decay: number) {}
  
  update() {
    this.pos = Vector2.add(this.pos, this.vel);
    this.life -= this.decay;
  }
}

interface Corpse {
    pos: Vector2;
    angle: number;
    color: string;
    radius: number;
    alpha: number;
}

class Projectile {
  constructor(
    public pos: Vector2,
    public targetPos: Vector2,
    public damage: number,
    public ownerTeam: Team,
    public progress: number = 0
  ) {}

  get currentPos(): Vector2 {
    const dx = this.targetPos.x - this.pos.x;
    const dy = this.targetPos.y - this.pos.y;
    
    const x = this.pos.x + dx * this.progress;
    const y = this.pos.y + dy * this.progress;
    
    // Height arc
    const arcHeight = 120 * Math.sin(this.progress * Math.PI);
    return new Vector2(x, y - arcHeight);
  }
}

class Unit {
  id: string;
  pos: Vector2;
  vel: Vector2;
  angle: number = 0; // Direction unit is facing in radians
  stats: UnitStats;
  currentHp: number;
  morale: number = 100;
  state: UnitState = UnitState.IDLE;
  cooldown: number = 0;
  target: Unit | null = null;
  formationOffset: Vector2 | null = null; // Relative to Army Center
  formationPos: Vector2 | null = null; // Absolute World Position
  hasAttackedThisFrame: boolean = false;
  
  constructor(public team: Team, public type: UnitType, x: number, y: number) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.pos = new Vector2(x, y);
    this.vel = new Vector2(0, 0);
    this.stats = UNIT_CONFIG[type];
    this.currentHp = this.stats.hp;
    // Initial random angle slightly towards center
    this.angle = team === Team.MACEDONIA ? 0 : Math.PI;
  }

  update(enemies: Unit[], allies: Unit[], dt: number, enemyArmyCenter: Vector2, bounds: {x: number, y: number, w: number, h: number}) {
    if (this.state === UnitState.DEAD) return;
    this.hasAttackedThisFrame = false;

    // Morale
    if (this.morale < 100) this.morale += MORALE_RECOVERY;
    if (this.morale < MORALE_THRESHOLD) this.state = UnitState.FLEEING;
    else if (this.state === UnitState.FLEEING) this.state = UnitState.IDLE; 

    // --- Targeting & Discipline Logic ---
    
    // DISCPLINE CHECK: Are we out of position?
    // If true, we act "Leashed" and prioritize returning to formation over fighting.
    const distToFormSq = this.formationPos ? Vector2.distSq(this.pos, this.formationPos) : 0;
    // Tolerance is squared distance. 80px tolerance.
    const outOfPosition = distToFormSq > 80 * 80; 
    
    // Scan range depends on discipline. If we are broken from line, we focus on moving back.
    const scanRange = outOfPosition ? 60 : (this.type === UnitType.ARCHER ? 800 : ENGAGE_DISTANCE);
    const scanRangeSq = scanRange * scanRange;

    let closestEnemy: Unit | null = null;
    let closestDistSq = Infinity;

    // Optimization: Only scan if we are roughly near the enemy center OR if we are already fighting
    // This prevents units at spawn from scanning the whole map
    if (this.state === UnitState.FIGHTING || Vector2.distSq(this.pos, enemyArmyCenter) < 1200*1200) {
        for (const e of enemies) {
            if (e.state === UnitState.DEAD) continue;
            const dSq = Vector2.distSq(this.pos, e.pos);
            if (dSq < scanRangeSq && dSq < closestDistSq) {
                closestDistSq = dSq;
                closestEnemy = e;
            }
        }
    }
    
    this.target = closestEnemy;

    let force = new Vector2(0, 0);
    let desiredAngle = this.angle;

    // --- State Machine ---

    if (this.state === UnitState.FLEEING) {
        const center = new Vector2(bounds.x + bounds.w/2, bounds.y + bounds.h/2);
        const away = Vector2.sub(this.pos, center);
        force = Vector2.add(force, Vector2.mult(Vector2.normalize(away), 3));
        desiredAngle = Math.atan2(force.y, force.x);

    } else if (this.target) {
        // --- COMBAT MODE ---
        const rangeSq = this.stats.range * this.stats.range;
        const dSq = closestDistSq;

        const toTarget = Vector2.sub(this.target.pos, this.pos);
        desiredAngle = Math.atan2(toTarget.y, toTarget.x);

        if (dSq <= rangeSq) {
            // Fighting Stance
            this.vel = Vector2.mult(this.vel, 0.2); // Brake hard
            if (this.cooldown <= 0) {
                this.state = UnitState.FIGHTING;
                this.cooldown = this.stats.attackSpeed;
                this.hasAttackedThisFrame = true; 
            }
        } else {
            // Charging short distance
            this.state = UnitState.MOVING;
            const dir = Vector2.normalize(toTarget);
            // Charge force
            force = Vector2.add(force, Vector2.mult(dir, 1.5));
        }

    } else {
        // --- MARCHING / FORMATION MODE ---
        if (this.formationPos) {
            const toForm = Vector2.sub(this.formationPos, this.pos);
            const distToForm = Vector2.mag(toForm);

            // If we are far from slot, move there.
            if (distToForm > 5) {
                this.state = UnitState.MOVING;
                // If extremely far, sprint. If nearby, march.
                const speedMult = distToForm > 150 ? 2.5 : 1.0; 
                force = Vector2.add(force, Vector2.mult(Vector2.normalize(toForm), FORMATION_WEIGHT * speedMult));
                desiredAngle = Math.atan2(toForm.y, toForm.x);
            } else {
                // In position.
                this.state = UnitState.IDLE;
                this.vel = Vector2.mult(this.vel, 0.8); // Dampen velocity
                // Face enemy army
                const toEnemyArmy = Vector2.sub(enemyArmyCenter, this.pos);
                desiredAngle = Math.atan2(toEnemyArmy.y, toEnemyArmy.x);
            }
        }
    }

    // --- Flocking (Separation Only) ---
    if (this.state !== UnitState.FIGHTING) {
        let separation = new Vector2(0, 0);
        let count = 0;
        
        for (const ally of allies) {
            if (ally === this || ally.state === UnitState.DEAD) continue;
            
            // Optimization: Simple box check
            if (Math.abs(ally.pos.x - this.pos.x) > 20 || Math.abs(ally.pos.y - this.pos.y) > 20) continue;

            const distSq = Vector2.distSq(this.pos, ally.pos);
            const rSum = this.stats.radius + ally.stats.radius + 2; 
            
            if (distSq < rSum * rSum) {
                const dist = Math.sqrt(distSq);
                const diff = Vector2.normalize(Vector2.sub(this.pos, ally.pos));
                separation = Vector2.add(separation, Vector2.div(diff, dist)); 
                count++;
            }
        }
        
        if (count > 0) {
            force = Vector2.add(force, Vector2.mult(separation, FLOCK_SEPARATION));
        }
    }

    // --- Soft Arena Boundary Forces ---
    const margin = 20; 
    const wallForce = 5.0;
    if (this.pos.x < bounds.x + margin) force.x += wallForce;
    if (this.pos.x > bounds.x + bounds.w - margin) force.x -= wallForce;
    if (this.pos.y < bounds.y + margin) force.y += wallForce;
    if (this.pos.y > bounds.y + bounds.h - margin) force.y -= wallForce;

    // Apply Physics
    this.vel = Vector2.add(this.vel, Vector2.mult(force, 0.1)); 
    
    // Cap Speed
    const maxSpeed = this.state === UnitState.FLEEING ? this.stats.speed * 2 : this.stats.speed;
    if (Vector2.mag(this.vel) > maxSpeed) {
      this.vel = Vector2.mult(Vector2.normalize(this.vel), maxSpeed);
    }
    
    // Smooth Angle Rotation (Inertia)
    let diff = desiredAngle - this.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    
    const turnRate = this.type === UnitType.CAVALRY ? MAX_TURN_RATE * 2 : MAX_TURN_RATE;
    if (Math.abs(diff) < turnRate) {
        this.angle = desiredAngle;
    } else {
        this.angle += Math.sign(diff) * turnRate;
    }

    this.pos = Vector2.add(this.pos, this.vel);
    if (this.cooldown > 0) this.cooldown--;
  }
}

export class BattleEngine {
  units: Unit[] = [];
  particles: Particle[] = [];
  projectiles: Projectile[] = [];
  corpses: Corpse[] = [];
  bloodPools: { pos: Vector2, size: number, alpha: number }[] = [];
  
  ctx: CanvasRenderingContext2D | null = null;
  width: number = 0;
  height: number = 0;
  
  // The central battleground panel
  arenaRect: { x: number, y: number, w: number, h: number } = { x:0, y:0, w:0, h:0 };

  // Army State
  macArmyPos: Vector2 = new Vector2(0,0);
  eastArmyPos: Vector2 = new Vector2(0,0);
  battlePhase: 'APPROACH' | 'ENGAGE' = 'APPROACH';

  init(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    
    // Define Arena: 70% width, 80% height, centered
    const w = width * 0.7;
    const h = height * 0.8;
    this.arenaRect = {
        x: (width - w) / 2,
        y: (height - h) / 2,
        w: w,
        h: h
    };
  }

  // Calculate STABLE offsets relative to army center (0,0)
  calculateFormationOffsets(team: Team, type: FormationType) {
    // We include DEAD units in this calculation to ensure the formation slots remain stable
    // even if units die. This prevents living units from jittering around to fill gaps.
    const units = this.units.filter(u => u.team === team);
    if (units.length === 0) return;

    const dirX = team === Team.MACEDONIA ? 1 : -1;
    const infantry = units.filter(u => u.type === UnitType.INFANTRY || u.type === UnitType.HERO || u.type === UnitType.ELEPHANT);
    const archers = units.filter(u => u.type === UnitType.ARCHER);
    const cavalry = units.filter(u => u.type === UnitType.CAVALRY);

    // CRITICAL: Sort deterministically by ID so units always take the same slot
    const sortUnits = (arr: Unit[]) => arr.sort((a,b) => parseInt(a.id, 36) - parseInt(b.id, 36));
    sortUnits(infantry);
    sortUnits(archers);
    sortUnits(cavalry);

    const arrangeGroup = (group: Unit[], xOffset: number, yOffset: number, ySpread: number, spacing: number) => {
        if (group.length === 0) return;
        const cols = Math.max(1, Math.floor(Math.sqrt(group.length) * ySpread));
        group.forEach((u, i) => {
            const unitsPerCol = cols;
            const col = Math.floor(i / unitsPerCol);
            const row = i % unitsPerCol;
            const yPos = (row - unitsPerCol / 2) * spacing;
            const xPos = -col * spacing * dirX; 
            
            // Set OFFSET relative to army center
            u.formationOffset = new Vector2(xOffset * dirX + xPos, yOffset + yPos);
        });
    };

    if (type === FormationType.PHALANX) {
        arrangeGroup(infantry, 50, 0, 1.2, 15);
        arrangeGroup(archers, -50, 0, 1.2, 15);
        const mid = Math.floor(cavalry.length / 2);
        arrangeGroup(cavalry.slice(0, mid), 0, -200, 1.0, 20);
        arrangeGroup(cavalry.slice(mid), 0, 200, 1.0, 20);
    } 
    else if (type === FormationType.LINE) {
        arrangeGroup(infantry, 50, 0, 5.0, 15); 
        arrangeGroup(archers, -30, 0, 5.0, 15);
        arrangeGroup(cavalry, 0, 250, 1.0, 20); 
    }
    else if (type === FormationType.WEDGE) {
        arrangeGroup(infantry, 80, 0, 0.8, 15);
        arrangeGroup(archers, -20, 0, 1.0, 15);
        arrangeGroup(cavalry, 100, 0, 0.5, 20);
    }
    else if (type === FormationType.FLANKING) {
        arrangeGroup(infantry, 50, 0, 1.5, 15);
        arrangeGroup(archers, -30, 0, 1.5, 15);
        const mid = Math.floor(cavalry.length / 2);
        arrangeGroup(cavalry.slice(0, mid), 50, -300, 0.5, 20);
        arrangeGroup(cavalry.slice(mid), 50, 300, 0.5, 20);
    }
    else {
        arrangeGroup(infantry, 0, 0, 2.0, 30);
        arrangeGroup(archers, -50, 0, 2.0, 30);
        arrangeGroup(cavalry, 50, 100, 2.0, 30);
    }
  }

  spawnUnits(count: number, mFormat: FormationType, eFormat: FormationType) {
    this.units = [];
    this.projectiles = [];
    this.particles = [];
    this.corpses = [];
    this.bloodPools = [];
    this.battlePhase = 'APPROACH';
    
    if (this.arenaRect.w === 0) {
        const w = this.width * 0.7;
        const h = this.height * 0.8;
        this.arenaRect = { x: (this.width - w)/2, y: (this.height - h)/2, w, h };
    }

    const arena = this.arenaRect;
    
    // 1. Determine Start Positions (Far Edges of Arena)
    // We start further back so the approach phase is visible
    this.macArmyPos = new Vector2(arena.x + arena.w * 0.10, arena.y + arena.h * 0.5);
    this.eastArmyPos = new Vector2(arena.x + arena.w * 0.90, arena.y + arena.h * 0.5);

    // 2. Spawn Units
    const spawnBlock = (team: Team, type: UnitType, count: number) => {
        const center = team === Team.MACEDONIA ? this.macArmyPos : this.eastArmyPos;
        for(let i=0; i<count; i++) {
            // Random scatter start
            const rX = center.x + (Math.random() - 0.5) * 200;
            const rY = center.y + (Math.random() - 0.5) * 200;
            this.units.push(new Unit(team, type, rX, rY));
        }
    };

    // Army Compositions
    const heroCount = 1;
    const cavRatio = 0.15;
    const archerRatio = 0.25;
    const infRatio = 0.6; // approx
    
    // Mac
    this.units.push(new Unit(Team.MACEDONIA, UnitType.HERO, this.macArmyPos.x, this.macArmyPos.y));
    spawnBlock(Team.MACEDONIA, UnitType.CAVALRY, Math.floor(count * cavRatio));
    spawnBlock(Team.MACEDONIA, UnitType.ARCHER, Math.floor(count * archerRatio));
    spawnBlock(Team.MACEDONIA, UnitType.INFANTRY, Math.floor(count * infRatio));

    // East
    this.units.push(new Unit(Team.EASTERN, UnitType.HERO, this.eastArmyPos.x, this.eastArmyPos.y));
    if (eFormat === FormationType.WEDGE) {
        spawnBlock(Team.EASTERN, UnitType.ELEPHANT, 3);
        spawnBlock(Team.EASTERN, UnitType.INFANTRY, Math.floor(count * 0.6));
        spawnBlock(Team.EASTERN, UnitType.ARCHER, Math.floor(count * 0.3));
    } else {
        spawnBlock(Team.EASTERN, UnitType.CAVALRY, Math.floor(count * cavRatio));
        spawnBlock(Team.EASTERN, UnitType.ARCHER, Math.floor(count * archerRatio));
        spawnBlock(Team.EASTERN, UnitType.INFANTRY, Math.floor(count * infRatio));
    }

    // 3. Calculate Offsets Once
    this.calculateFormationOffsets(Team.MACEDONIA, mFormat);
    this.calculateFormationOffsets(Team.EASTERN, eFormat);
  }

  // Wrapper for external calls from UI
  updateFormation(team: Team, type: FormationType) {
      this.calculateFormationOffsets(team, type);
  }

  update() {
    const dt = 1; 
    const arena = this.arenaRect;

    const activeMac = this.units.filter(u => u.team === Team.MACEDONIA && u.state !== UnitState.DEAD);
    const activeEast = this.units.filter(u => u.team === Team.EASTERN && u.state !== UnitState.DEAD);

    // --- PHASE 1: APPROACH & PHASE 2: COLLAPSE ---
    
    const arenaCenterY = arena.y + arena.h / 2;
    
    // Phase 1 Targets (Ready Line): Close but distinct (40% / 60% of arena)
    const approachMacX = arena.x + arena.w * 0.40;
    const approachEastX = arena.x + arena.w * 0.60;

    // Phase 2 Targets (Engage/Collapse): Deep Overlap (60% / 40% of arena)
    const engageMacX = arena.x + arena.w * 0.60;
    const engageEastX = arena.x + arena.w * 0.40;

    // Check distance between current army centers
    const armyDist = Vector2.distSq(this.macArmyPos, this.eastArmyPos);
    
    // Logic to switch from Approach to Engage
    // If we are marching and armies are close enough to the "Ready Line", we switch to Engage.
    if (this.battlePhase === 'APPROACH') {
        const distToReady = Math.abs(this.macArmyPos.x - approachMacX) + Math.abs(this.eastArmyPos.x - approachEastX);
        // If relatively close to ready line
        if (distToReady < 100) {
            this.battlePhase = 'ENGAGE';
        }
    }

    const currentMacTargetX = this.battlePhase === 'APPROACH' ? approachMacX : engageMacX;
    const currentEastTargetX = this.battlePhase === 'APPROACH' ? approachEastX : engageEastX;

    const macTarget = new Vector2(currentMacTargetX, arenaCenterY);
    const eastTarget = new Vector2(currentEastTargetX, arenaCenterY);

    // Speed: Fast during approach, slower during engagement grind
    const marchSpeed = this.battlePhase === 'APPROACH' ? 1.0 : 0.3;

    // Move Army Centers
    const moveArmy = (current: Vector2, target: Vector2) => {
        const toTarget = Vector2.sub(target, current);
        if (Vector2.mag(toTarget) > 1) {
            return Vector2.add(current, Vector2.mult(Vector2.normalize(toTarget), marchSpeed));
        }
        return current;
    };

    this.macArmyPos = moveArmy(this.macArmyPos, macTarget);
    this.eastArmyPos = moveArmy(this.eastArmyPos, eastTarget);

    // Update Unit Formation Targets based on new Army Center
    this.units.forEach(u => {
        if (u.formationOffset) {
            const armyCenter = u.team === Team.MACEDONIA ? this.macArmyPos : this.eastArmyPos;
            // Absolute target = ArmyCenter + Offset
            const target = Vector2.add(armyCenter, u.formationOffset);
            u.formationPos = Vector2.clamp(target, arena);
        }
    });

    // --- Standard Unit Update ---
    this.units.forEach(u => {
      if (u.state === UnitState.DEAD) return;

      const enemies = u.team === Team.MACEDONIA ? activeEast : activeMac;
      const allies = u.team === Team.MACEDONIA ? activeMac : activeEast;
      const enemyCenter = u.team === Team.MACEDONIA ? this.eastArmyPos : this.macArmyPos;
      
      u.update(enemies, allies, dt, enemyCenter, arena);

      // Hard Arena Clamp
      if (u.pos.x < arena.x) { u.pos.x = arena.x; u.vel.x *= -0.5; }
      if (u.pos.x > arena.x + arena.w) { u.pos.x = arena.x + arena.w; u.vel.x *= -0.5; }
      if (u.pos.y < arena.y) { u.pos.y = arena.y; u.vel.y *= -0.5; }
      if (u.pos.y > arena.y + arena.h) { u.pos.y = arena.y + arena.h; u.vel.y *= -0.5; }

      // Combat
      if (u.hasAttackedThisFrame) {
        let target = u.target;
        if (target && target.state !== UnitState.DEAD) {
             const dSq = Vector2.distSq(u.pos, target.pos);
             const rangeSq = (u.stats.range + 10) ** 2; // Tolerance
             
             if (dSq <= rangeSq) {
                 if (u.type === UnitType.ARCHER) {
                     this.projectiles.push(new Projectile(u.pos, target.pos, u.stats.damage, u.team));
                 } else {
                     this.applyDamage(target, u.stats.damage);
                     this.spawnParticles(Vector2.add(target.pos, Vector2.div(Vector2.sub(u.pos, target.pos), 2)), '#ffffff', 2);
                 }
             }
        }
      }
    });

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        p.progress += 0.05; 
        if (p.progress >= 1) {
            const enemies = p.ownerTeam === Team.MACEDONIA ? activeEast : activeMac;
            let hit = false;
            for(const e of enemies) {
                if (Vector2.distSq(p.currentPos, e.pos) < (e.stats.radius + 15) ** 2) {
                    this.applyDamage(e, p.damage);
                    hit = true;
                    break; 
                }
            }
            if (!hit) this.spawnParticles(p.currentPos, '#78716c', 2); 
            this.projectiles.splice(i, 1);
        }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.update();
        if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  applyDamage(target: Unit, amount: number) {
      target.currentHp -= amount;
      target.morale -= 2; 

      if (target.currentHp <= 0) {
          target.state = UnitState.DEAD;
          
          this.corpses.push({
              pos: { ...target.pos },
              angle: target.angle + (Math.random() - 0.5), 
              color: TEAM_COLORS[target.team].primary,
              radius: target.stats.radius,
              alpha: 0.8
          });

          this.bloodPools.push({
              pos: { ...target.pos },
              size: target.stats.radius * 2.5,
              alpha: 0.6
          });

          this.spawnParticles(target.pos, '#7f1d1d', 8);

          this.units.forEach(u => {
              if (u.team === target.team && u.state !== UnitState.DEAD && Vector2.distSq(u.pos, target.pos) < 60**2) {
                  u.morale -= MORALE_DECAY_ON_DEATH;
              }
          });
      } else {
        if (Math.random() > 0.7) this.spawnParticles(target.pos, '#991b1b', 1);
      }
  }

  spawnParticles(pos: Vector2, color: string, count: number) {
      for(let i=0; i<count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 2;
          const vel = new Vector2(Math.cos(angle)*speed, Math.sin(angle)*speed);
          this.particles.push(new Particle(pos, vel, color, Math.random()*2 + 1, 0.05));
      }
  }

  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const arena = this.arenaRect;
    
    // 0. Clear and Dim Background
    ctx.fillStyle = '#0c0a09'; 
    ctx.fillRect(0, 0, this.width, this.height);
    
    // 1. Draw Arena "Battleground" Panel
    ctx.fillStyle = '#1c1917'; 
    ctx.fillRect(arena.x, arena.y, arena.w, arena.h);
    
    // Arena Border
    ctx.strokeStyle = '#44403c'; 
    ctx.lineWidth = 3;
    ctx.strokeRect(arena.x, arena.y, arena.w, arena.h);

    // Grid in Arena
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<arena.w; i+=100) {
        ctx.moveTo(arena.x + i, arena.y);
        ctx.lineTo(arena.x + i, arena.y + arena.h);
    }
    for(let i=0; i<arena.h; i+=100) {
        ctx.moveTo(arena.x, arena.y + i);
        ctx.lineTo(arena.x + arena.w, arena.y + i);
    }
    ctx.stroke();

    // 2. Blood Pools
    this.bloodPools.forEach(b => {
        ctx.save();
        ctx.globalAlpha = b.alpha;
        ctx.fillStyle = '#450a0a'; 
        ctx.beginPath();
        ctx.ellipse(b.pos.x, b.pos.y, b.size, b.size * 0.8, Math.random(), 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    });

    // 3. Corpses
    this.corpses.forEach(c => {
        ctx.save();
        ctx.translate(c.pos.x, c.pos.y);
        ctx.rotate(c.angle);
        ctx.fillStyle = '#1c1917'; 
        ctx.fillRect(-c.radius, -c.radius/2, c.radius*2, c.radius);
        ctx.fillStyle = c.color;
        ctx.globalAlpha = 0.5; 
        ctx.beginPath();
        ctx.ellipse(0, 0, c.radius, c.radius * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // 4. Living Units
    const livingUnits = this.units.filter(u => u.state !== UnitState.DEAD);
    livingUnits.sort((a, b) => a.pos.y - b.pos.y);

    livingUnits.forEach(u => {
      const colors = TEAM_COLORS[u.team];
      ctx.save();
      ctx.translate(u.pos.x, u.pos.y);
      
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(0, u.stats.radius/2, u.stats.radius, u.stats.radius*0.4, 0, 0, Math.PI*2);
      ctx.fill();

      ctx.rotate(u.angle);

      // Body
      ctx.fillStyle = u.state === UnitState.FLEEING ? '#f3f4f6' : colors.primary;
      if (u.type === UnitType.HERO) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#fbbf24';
      }

      ctx.beginPath();
      ctx.ellipse(0, 0, u.stats.radius, u.stats.radius * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Weapon
      ctx.strokeStyle = '#d6d3d1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(u.stats.radius * 0.5, 0);
      ctx.lineTo(u.stats.radius + 4, 0);
      ctx.stroke();

      // Shield
      ctx.fillStyle = colors.secondary;
      ctx.beginPath();
      ctx.arc(-2, 0, u.stats.radius * 0.4, 0, Math.PI*2);
      ctx.fill();

      ctx.restore(); 

      // HP Bar
      if (u.currentHp < u.stats.hp) {
          const pct = Math.max(0, u.currentHp / u.stats.hp);
          ctx.fillStyle = '#292524';
          ctx.fillRect(u.pos.x - 8, u.pos.y - u.stats.radius - 8, 16, 3);
          ctx.fillStyle = pct < 0.3 ? '#ef4444' : '#22c55e';
          ctx.fillRect(u.pos.x - 8, u.pos.y - u.stats.radius - 8, 16 * pct, 3);
      }
    });

    // 5. Projectiles
    ctx.fillStyle = '#f5f5f4';
    this.projectiles.forEach(p => {
        const pos = p.currentPos;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
        ctx.fill();
    });

    // 6. Particles
    this.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });

    // Vignette
    const gradient = ctx.createRadialGradient(this.width/2, this.height/2, this.height/3, this.width/2, this.height/2, this.height);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0,0, this.width, this.height);
  }

  getStats() {
      const activeUnits = this.units.filter(u => u.state !== UnitState.DEAD);
      const mac = activeUnits.filter(u => u.team === Team.MACEDONIA);
      const east = activeUnits.filter(u => u.team === Team.EASTERN);
      
      const avgMorale = (arr: Unit[]) => arr.length ? arr.reduce((acc, u) => acc + u.morale, 0) / arr.length : 0;

      return {
          macedoniaCount: mac.length,
          easternCount: east.length,
          macedoniaMorale: avgMorale(mac),
          easternMorale: avgMorale(east),
          status: mac.length === 0 ? "Eastern Victory" : east.length === 0 ? "Macedonian Victory" : "Fighting"
      };
  }
}