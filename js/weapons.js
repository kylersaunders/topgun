import * as THREE from 'three';
import { WEAPON_PARAMS } from './constants.js';

// Pooled laser bolts. Nothing is allocated after construction — bolts are
// recycled, so holding down space never churns the GC.
export class Weapons {
  constructor(scene, poolSize = 64) {
    this.scene = scene;
    this.cooldown = 0;
    this.nextMuzzle = 1; // alternate wingtips
    this.shotsFired = 0;

    const geometry = new THREE.CylinderGeometry(WEAPON_PARAMS.RADIUS, WEAPON_PARAMS.RADIUS, WEAPON_PARAMS.LENGTH, 6, 1, true);
    // Cylinders build along +Y; stand it along +Z so a bolt points where it flies.
    geometry.rotateX(Math.PI / 2);

    const material = new THREE.MeshBasicMaterial({
      color: 0x66ff99,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.bolts = [];
    for (let i = 0; i < poolSize; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.bolts.push({
        mesh,
        alive: false,
        life: 0,
        velocity: new THREE.Vector3(),
        previous: new THREE.Vector3(),
      });
    }

    // Scratch vectors for the hot loop.
    this._muzzle = new THREE.Vector3();
    this._aim = new THREE.Vector3();
    this._convergence = new THREE.Vector3();
    this._segment = new THREE.Vector3();
    this._toTarget = new THREE.Vector3();
    this._closest = new THREE.Vector3();
  }

  // Called every frame. `wantsToFire` is held-down state, not an edge.
  update(dt, airplane, wantsToFire) {
    this.cooldown -= dt;

    if (wantsToFire && this.cooldown <= 0) {
      this.fire(airplane);
      this.cooldown = WEAPON_PARAMS.COOLDOWN;
    }

    for (const bolt of this.bolts) {
      if (!bolt.alive) continue;

      bolt.previous.copy(bolt.mesh.position);
      bolt.mesh.position.addScaledVector(bolt.velocity, dt);
      bolt.life -= dt;

      if (bolt.life <= 0) {
        bolt.alive = false;
        bolt.mesh.visible = false;
      }
    }
  }

  fire(airplane) {
    const bolt = this.bolts.find((b) => !b.alive);
    if (!bolt) return; // pool exhausted; skip this shot rather than allocate

    airplane.getMuzzlePosition(this.nextMuzzle, this._muzzle);
    this.nextMuzzle *= -1;

    // Both guns converge on a point far down the boresight, so the crosshair
    // means what it says instead of the shots running parallel and off-center.
    this._convergence.set(0, 0, WEAPON_PARAMS.CONVERGENCE);
    airplane.container.localToWorld(this._convergence);
    this._aim.copy(this._convergence).sub(this._muzzle).normalize();

    bolt.mesh.position.copy(this._muzzle);
    bolt.previous.copy(this._muzzle);
    bolt.mesh.quaternion.copy(airplane.container.quaternion);
    bolt.mesh.visible = true;
    bolt.alive = true;
    bolt.life = WEAPON_PARAMS.LIFE;

    // Inherit the plane's own velocity so bolts never trail behind you at speed.
    bolt.velocity.copy(this._aim).multiplyScalar(WEAPON_PARAMS.SPEED).add(airplane.velocity);

    this.shotsFired++;
  }

  // Sweeps every live bolt against a list of {position, radius, onHit} targets.
  // Uses the swept segment from last frame rather than a point test, so fast
  // bolts can't tunnel straight through a small target between frames.
  collide(targets) {
    let hits = 0;

    for (const bolt of this.bolts) {
      if (!bolt.alive) continue;

      this._segment.copy(bolt.mesh.position).sub(bolt.previous);
      const segLengthSq = this._segment.lengthSq();

      for (const target of targets) {
        this._toTarget.copy(target.position).sub(bolt.previous);

        // Closest approach of the target centre to this frame's travel segment.
        let t = segLengthSq > 1e-6 ? this._toTarget.dot(this._segment) / segLengthSq : 0;
        t = Math.min(1, Math.max(0, t));
        this._closest.copy(bolt.previous).addScaledVector(this._segment, t);

        const radius = target.radius + WEAPON_PARAMS.LENGTH * 0.5;
        if (this._closest.distanceToSquared(target.position) <= radius * radius) {
          bolt.alive = false;
          bolt.mesh.visible = false;
          hits++;
          if (target.onHit) target.onHit(this._closest, WEAPON_PARAMS.DAMAGE);
          break; // one bolt, one target
        }
      }
    }

    return hits;
  }
}
