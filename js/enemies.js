import * as THREE from 'three';
import { ENEMY_PARAMS } from './constants.js';
import { buildJet } from './jetMesh.js';
import { smoothing } from './airplane.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const WHITE = new THREE.Color(0xffffff);

// A single hostile jet. Flies waypoints around the player, banks into its
// turns, flashes when hit, and blows apart when its hit points run out.
class Enemy {
  constructor(scene) {
    this.scene = scene;

    // The container holds the flight orientation only. The visual bank lives on
    // the child jet so it can never accumulate into the AI's own steering.
    this.container = new THREE.Object3D();
    const { group, materials } = buildJet({
      body: 0xb04a3a,
      wing: 0x8d3a2c,
      accent: 0x2b1a16,
      glow: 0xffaa44,
    });
    this.jet = group;
    this.container.add(this.jet);

    this.materials = materials;
    this.baseColors = materials.map((m) => m.color.clone());

    this.waypoint = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.maxHp = ENEMY_PARAMS.HP;
    this.hp = this.maxHp;
    this.alive = false;
    this.hitFlash = 0;
    this.bank = 0;
    this.repathIn = 0;

    this._forward = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._targetQuat = new THREE.Quaternion();
    this._lookMatrix = new THREE.Matrix4();
    this._up = new THREE.Vector3(0, 1, 0);
  }

  spawn(position, facing) {
    this.container.position.copy(position);
    this.container.quaternion.identity();
    this.container.lookAt(facing); // Object3D.lookAt points +Z at the target
    this.jet.rotation.z = 0;
    this.hp = this.maxHp;
    this.alive = true;
    this.hitFlash = 0;
    this.bank = 0;
    this.repathIn = 0;
    this.materials.forEach((m, i) => m.color.copy(this.baseColors[i]));
    this.scene.add(this.container);
  }

  despawn() {
    this.alive = false;
    this.scene.remove(this.container);
  }

  pickWaypoint(playerPosition) {
    // Aim for a point loosely around the player so dogfights stay in view
    // instead of the enemy wandering off over the horizon.
    const angle = Math.random() * Math.PI * 2;
    const radius = ENEMY_PARAMS.REPOSITION_RANGE * (0.5 + Math.random());
    this.waypoint.set(
      playerPosition.x + Math.cos(angle) * radius,
      clamp(playerPosition.y + (Math.random() - 0.4) * 160, 60, 900),
      playerPosition.z + Math.sin(angle) * radius
    );
    this.repathIn = 3 + Math.random() * 4;
  }

  update(dt, playerPosition) {
    if (!this.alive) return;

    this.repathIn -= dt;
    if (this.repathIn <= 0 || this.container.position.distanceTo(this.waypoint) < 90) {
      this.pickWaypoint(playerPosition);
    }

    this._desired.copy(this.waypoint).sub(this.container.position);
    if (this._desired.lengthSq() > 1e-6) {
      this._desired.normalize();

      // Matrix4.lookAt(eye, target, up) puts +Z along (eye - target), so passing
      // the waypoint as the eye gives an orientation whose nose is on the waypoint.
      this._lookMatrix.lookAt(this.waypoint, this.container.position, this._up);
      this._targetQuat.setFromRotationMatrix(this._lookMatrix);

      // Turn at a capped rate so enemies arc around rather than snapping to face.
      const angleTo = this.container.quaternion.angleTo(this._targetQuat);
      this.container.quaternion.rotateTowards(this._targetQuat, Math.min(ENEMY_PARAMS.TURN_RATE * dt, angleTo));

      // Cosmetic bank: lean into whichever way the nose still has to swing.
      this._forward.set(0, 0, 1).applyQuaternion(this.container.quaternion);
      const cross = this._desired.x * this._forward.z - this._desired.z * this._forward.x;
      const targetBank = clamp(cross * 2.5, -1, 1);
      this.bank += (targetBank - this.bank) * smoothing(2.5, dt);
      this.jet.rotation.z = this.bank;
    }

    this._forward.set(0, 0, 1).applyQuaternion(this.container.quaternion);
    this.velocity.copy(this._forward).multiplyScalar(ENEMY_PARAMS.SPEED);
    this.container.position.addScaledVector(this.velocity, dt);

    // Hit flash decays back to the paint job.
    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
      this.materials.forEach((m, i) => m.color.copy(this.baseColors[i]).lerp(WHITE, this.hitFlash));
    }
  }

  damage(amount) {
    this.hp -= amount;
    this.hitFlash = 1;
    return this.hp <= 0;
  }
}

// Short-lived debris burst, pooled the same way the lasers are.
class Explosion {
  constructor(scene, pieces = 14) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    const geometry = new THREE.TetrahedronGeometry(1.6);
    this.pieces = [];
    for (let i = 0; i < pieces; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0xffdd55 : 0xff6633,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      this.group.add(mesh);
      this.pieces.push({ mesh, velocity: new THREE.Vector3(), spin: new THREE.Vector3() });
    }

    this.flash = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.group.add(this.flash);

    this.life = 0;
    this.maxLife = 1.3;
  }

  get active() {
    return this.life > 0;
  }

  burst(position) {
    this.group.position.copy(position);
    this.group.visible = true;
    this.life = this.maxLife;

    for (const piece of this.pieces) {
      piece.mesh.position.set(0, 0, 0);
      piece.mesh.scale.setScalar(0.6 + Math.random() * 0.8);
      piece.velocity
        .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .normalize()
        .multiplyScalar(20 + Math.random() * 45);
      piece.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(9);
    }
  }

  update(dt) {
    if (this.life <= 0) return;

    this.life -= dt;
    if (this.life <= 0) {
      this.group.visible = false;
      return;
    }

    const t = this.life / this.maxLife;

    for (const piece of this.pieces) {
      piece.mesh.position.addScaledVector(piece.velocity, dt);
      piece.velocity.y -= 30 * dt;
      piece.mesh.rotation.x += piece.spin.x * dt;
      piece.mesh.rotation.y += piece.spin.y * dt;
      piece.mesh.rotation.z += piece.spin.z * dt;
      piece.mesh.material.opacity = t;
    }

    this.flash.scale.setScalar(4 + (1 - t) * 40);
    this.flash.material.opacity = Math.max(0, t * t * 0.9);
  }
}

export class EnemyManager {
  constructor(scene) {
    this.scene = scene;
    this.enemies = [];
    this.explosions = [];
    this.spawnTimer = 1.5;
    this.kills = 0;

    for (let i = 0; i < ENEMY_PARAMS.MAX_ALIVE + 2; i++) {
      this.enemies.push(new Enemy(scene));
    }
    for (let i = 0; i < 4; i++) {
      this.explosions.push(new Explosion(scene));
    }

    // One persistent target record per enemy, refreshed in place each frame so
    // collision testing doesn't allocate.
    this.targets = [];
    this._spawnPos = new THREE.Vector3();
  }

  get aliveCount() {
    let n = 0;
    for (const enemy of this.enemies) if (enemy.alive) n++;
    return n;
  }

  update(dt, playerPosition) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = ENEMY_PARAMS.SPAWN_INTERVAL;
      if (this.aliveCount < ENEMY_PARAMS.MAX_ALIVE) {
        this.spawn(playerPosition);
      }
    }

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.update(dt, playerPosition);

      // Recycle anything that has strayed far enough to be irrelevant.
      if (enemy.container.position.distanceTo(playerPosition) > ENEMY_PARAMS.DESPAWN_RANGE) {
        enemy.despawn();
      }
    }

    for (const explosion of this.explosions) {
      explosion.update(dt);
    }
  }

  spawn(playerPosition) {
    const enemy = this.enemies.find((e) => !e.alive);
    if (!enemy) return;

    const angle = Math.random() * Math.PI * 2;
    const range = ENEMY_PARAMS.SPAWN_MIN_RANGE + Math.random() * (ENEMY_PARAMS.SPAWN_MAX_RANGE - ENEMY_PARAMS.SPAWN_MIN_RANGE);
    this._spawnPos.set(
      playerPosition.x + Math.cos(angle) * range,
      clamp(playerPosition.y + (Math.random() - 0.35) * 220, 80, 900),
      playerPosition.z + Math.sin(angle) * range
    );

    enemy.spawn(this._spawnPos, playerPosition);
    enemy.pickWaypoint(playerPosition);
  }

  // The {position, radius, onHit} shape Weapons.collide expects.
  getTargets() {
    this.targets.length = 0;

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;

      if (!enemy._target) {
        enemy._target = {
          position: enemy.container.position,
          radius: ENEMY_PARAMS.HIT_RADIUS,
          onHit: (point, damage) => {
            if (enemy.damage(damage)) {
              this.explode(enemy.container.position);
              enemy.despawn();
              this.kills++;
            }
          },
        };
      }

      this.targets.push(enemy._target);
    }

    return this.targets;
  }

  explode(position) {
    const explosion = this.explosions.find((e) => !e.active) || this.explosions[0];
    explosion.burst(position);
  }
}
