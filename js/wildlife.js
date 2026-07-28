import * as THREE from 'three';
import { WILDLIFE_PARAMS as W } from './constants.js';

const CAR_COLORS = [0xd94f3d, 0x2f6fb0, 0xe8c33a, 0xf2f2f2, 0x2b2b2b, 0x3f9d5a];

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

// Picks a point in a ring around the player, so things appear off in the
// distance rather than popping into existence under the nose.
function pointAround(center, minRange, maxRange, target) {
  const angle = Math.random() * Math.PI * 2;
  const range = randomRange(minRange, maxRange);
  return target.set(center.x + Math.cos(angle) * range, 0, center.z + Math.sin(angle) * range);
}

// A flock of birds sharing one leader. Wings flap by rotating two thin planes
// around the body, which is cheap enough to run dozens of at once.
class Flock {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    this.heading = 0;
    this.speed = W.BIRD_SPEED;
    this.altitude = 40;
    this.active = false;
    this.respawnIn = Math.random() * 2; // stagger the first appearance
    this.birds = [];

    const bodyGeometry = new THREE.ConeGeometry(0.35, 1.8, 5);
    bodyGeometry.rotateX(Math.PI / 2);
    const wingGeometry = new THREE.PlaneGeometry(2.4, 0.7);
    const material = new THREE.MeshPhongMaterial({ color: 0x2e2b28, side: THREE.DoubleSide, flatShading: true });

    for (let i = 0; i < W.BIRDS_PER_FLOCK; i++) {
      const bird = new THREE.Group();
      bird.add(new THREE.Mesh(bodyGeometry, material));

      const leftWing = new THREE.Mesh(wingGeometry, material);
      leftWing.position.x = -1.2;
      const rightWing = new THREE.Mesh(wingGeometry, material);
      rightWing.position.x = 1.2;
      bird.add(leftWing);
      bird.add(rightWing);

      this.group.add(bird);
      this.birds.push({
        object: bird,
        leftWing,
        rightWing,
        // Loose V formation offsets, plus a per-bird phase so they don't flap in lockstep.
        offset: new THREE.Vector3((i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * 4, (Math.random() - 0.5) * 3, -Math.ceil(i / 2) * 3.5),
        phase: Math.random() * Math.PI * 2,
        flapRate: randomRange(6, 9),
      });
    }

    this._scratch = new THREE.Vector3();
  }

  spawn(playerPosition, groundHeightAt) {
    pointAround(playerPosition, W.SPAWN_MIN_RANGE, W.SPAWN_MAX_RANGE, this.group.position);
    this.altitude = randomRange(W.BIRD_MIN_ALTITUDE, W.BIRD_MAX_ALTITUDE);
    this.group.position.y = groundHeightAt(this.group.position.x, this.group.position.z) + this.altitude;
    this.heading = Math.random() * Math.PI * 2;
    this.speed = randomRange(W.BIRD_SPEED * 0.7, W.BIRD_SPEED * 1.4);
    this.group.visible = true;
    this.active = true;
  }

  despawn(respawnDelay = 0) {
    this.active = false;
    this.group.visible = false;
    this.respawnIn = respawnDelay;
  }

  update(dt, elapsed, groundHeightAt) {
    if (!this.active) return;

    // Gentle wander so flocks curve instead of flying dead straight.
    this.heading += Math.sin(elapsed * 0.3 + this.group.position.x * 0.01) * 0.25 * dt;

    this.group.position.x += Math.sin(this.heading) * this.speed * dt;
    this.group.position.z += Math.cos(this.heading) * this.speed * dt;
    this.group.rotation.y = this.heading;

    // Ride the terrain rather than flying into a hillside.
    const targetY = groundHeightAt(this.group.position.x, this.group.position.z) + this.altitude;
    this.group.position.y += (targetY - this.group.position.y) * Math.min(1, dt * 1.5);

    for (const bird of this.birds) {
      bird.object.position.copy(bird.offset);
      bird.object.position.y += Math.sin(elapsed * 1.5 + bird.phase) * 0.8;

      const flap = Math.sin(elapsed * bird.flapRate + bird.phase) * 0.9;
      bird.leftWing.rotation.z = -flap;
      bird.rightWing.rotation.z = flap;
    }
  }
}

// A car driving in a straight line along the ground.
class Car {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 4.6), new THREE.MeshPhongMaterial({ color, shininess: 70 }));
    body.position.y = 0.8;
    this.group.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 2.2), new THREE.MeshPhongMaterial({ color: 0x1c2530, shininess: 90 }));
    cabin.position.set(0, 1.7, -0.3);
    this.group.add(cabin);

    const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 8);
    wheelGeometry.rotateZ(Math.PI / 2);
    const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x151515 });
    this.wheels = [];
    for (const [x, z] of [
      [-1.15, 1.5],
      [1.15, 1.5],
      [-1.15, -1.5],
      [1.15, -1.5],
    ]) {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.position.set(x, 0.5, z);
      this.group.add(wheel);
      this.wheels.push(wheel);
    }

    this.heading = 0;
    this.speed = W.CAR_SPEED;
    this.active = false;
    this.respawnIn = Math.random() * 2;
  }

  spawn(playerPosition, groundHeightAt, isLand) {
    // Try a few spots — the map is a third ocean, and cars shouldn't swim.
    for (let attempt = 0; attempt < 8; attempt++) {
      pointAround(playerPosition, W.SPAWN_MIN_RANGE, W.SPAWN_MAX_RANGE, this.group.position);
      if (isLand(this.group.position.x, this.group.position.z)) {
        this.group.position.y = groundHeightAt(this.group.position.x, this.group.position.z);
        this.heading = Math.random() * Math.PI * 2;
        this.speed = randomRange(W.CAR_SPEED * 0.6, W.CAR_SPEED * 1.5);
        this.group.rotation.y = this.heading;
        this.group.visible = true;
        this.active = true;
        return;
      }
    }
  }

  despawn(respawnDelay = 0) {
    this.active = false;
    this.group.visible = false;
    this.respawnIn = respawnDelay;
  }

  update(dt, groundHeightAt, isLand) {
    if (!this.active) return;

    const nextX = this.group.position.x + Math.sin(this.heading) * this.speed * dt;
    const nextZ = this.group.position.z + Math.cos(this.heading) * this.speed * dt;

    // Turn away from the water instead of driving into it.
    if (!isLand(nextX, nextZ)) {
      this.heading += Math.PI * 0.75;
      this.group.rotation.y = this.heading;
      return;
    }

    this.group.position.x = nextX;
    this.group.position.z = nextZ;
    this.group.position.y = groundHeightAt(nextX, nextZ);

    const spin = (this.speed * dt) / 0.5;
    for (const wheel of this.wheels) wheel.rotation.x += spin;
  }
}

// Keeps a small population of birds and cars alive near the player, recycling
// anything that falls behind. The world is 20km across, so everything is
// spawned relative to where you actually are.
export class Wildlife {
  constructor(scene, environment) {
    this.environment = environment;
    this.elapsed = 0;

    this.groundHeightAt = (x, z) => environment.heightAt(x, z);
    this.isLand = (x, z) => environment.isLand(x, z);

    this.flocks = [];
    for (let i = 0; i < W.BIRD_FLOCKS; i++) this.flocks.push(new Flock(scene));

    this.cars = [];
    for (let i = 0; i < W.CAR_COUNT; i++) this.cars.push(new Car(scene));
  }

  update(dt, playerPosition) {
    this.elapsed += dt;

    for (const flock of this.flocks) {
      if (!flock.active) {
        flock.respawnIn -= dt;
        if (flock.respawnIn <= 0) flock.spawn(playerPosition, this.groundHeightAt);
        continue;
      }
      flock.update(dt, this.elapsed, this.groundHeightAt);
      if (flock.group.position.distanceTo(playerPosition) > W.DESPAWN_RANGE) {
        flock.despawn();
      }
    }

    for (const car of this.cars) {
      if (!car.active) {
        car.respawnIn -= dt;
        if (car.respawnIn <= 0) car.spawn(playerPosition, this.groundHeightAt, this.isLand);
        continue;
      }
      car.update(dt, this.groundHeightAt, this.isLand);
      if (car.group.position.distanceTo(playerPosition) > W.DESPAWN_RANGE) {
        car.despawn();
      }
    }
  }

  // Birds and cars are soft targets — one hit and they scatter. Target records
  // are built once per entity and reused, so this allocates nothing per frame.
  collectTargets(out) {
    for (const entity of this.flocks) {
      if (!entity.active) continue;
      if (!entity._target) {
        entity._target = { position: entity.group.position, radius: 14, onHit: () => entity.despawn(3) };
      }
      out.push(entity._target);
    }
    for (const entity of this.cars) {
      if (!entity.active) continue;
      if (!entity._target) {
        entity._target = { position: entity.group.position, radius: 4, onHit: () => entity.despawn(3) };
      }
      out.push(entity._target);
    }
    return out;
  }
}
