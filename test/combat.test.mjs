// Headless checks on the lasers and the enemy hit-point model.
//
// Run with: npm test

import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Airplane } from '../js/airplane.js';
import { Weapons } from '../js/weapons.js';
import { EnemyManager } from '../js/enemies.js';
import { WEAPON_PARAMS, ENEMY_PARAMS } from '../js/constants.js';

globalThis.THREE = THREE;

const fakeScene = () => ({ add() {}, remove() {} });

function setup() {
  const scene = fakeScene();
  const plane = new Airplane(scene);
  plane.container.position.set(0, 500, 0);
  plane.speed = 0; // keep the shooter still so geometry stays predictable
  plane._readAxes();

  return { plane, weapons: new Weapons(scene), enemies: new EnemyManager(scene) };
}

// Place a single enemy at a fixed point ahead of the player and silence the rest.
function placeEnemy(enemies, position) {
  for (const enemy of enemies.enemies) enemy.alive = false;
  const enemy = enemies.enemies[0];
  enemy.spawn(position, position.clone().add(new THREE.Vector3(0, 0, 1)));
  enemy.container.position.copy(position);
  return enemy;
}

// Fire once, then run the bolts forward for `seconds`, resolving collisions.
function fireAndAdvance({ plane, weapons, enemies }, seconds, dt = 1 / 60) {
  weapons.update(dt, plane, true); // this frame's shot
  weapons.collide(enemies.getTargets());

  for (let t = 0; t < seconds; t += dt) {
    weapons.update(dt, plane, false);
    weapons.collide(enemies.getTargets());
  }
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('a laser hit takes a hit point off an enemy', () => {
  const world = setup();
  const enemy = placeEnemy(world.enemies, new THREE.Vector3(0, 500, 400));

  assert.equal(enemy.hp, ENEMY_PARAMS.HP);
  fireAndAdvance(world, 1.5);
  assert.equal(enemy.hp, ENEMY_PARAMS.HP - WEAPON_PARAMS.DAMAGE, 'enemy should have taken exactly one hit');
  assert.ok(enemy.alive, 'one hit should not destroy a full-health enemy');
});

test('an enemy vanishes and scores a kill when its hit points run out', () => {
  const world = setup();
  const enemy = placeEnemy(world.enemies, new THREE.Vector3(0, 500, 400));

  for (let shot = 0; shot < ENEMY_PARAMS.HP; shot++) {
    // Re-place each time: nothing moves it here, but this keeps the test honest
    // about the enemy being the thing that's being shot.
    enemy.container.position.set(0, 500, 400);
    world.weapons.cooldown = 0;
    fireAndAdvance(world, 1.5);
  }

  assert.ok(enemy.hp <= 0, `expected hp to reach 0, got ${enemy.hp}`);
  assert.equal(enemy.alive, false, 'a destroyed enemy must vanish');
  assert.equal(world.enemies.kills, 1, 'destroying an enemy should score exactly one kill');
});

test('a destroyed enemy stops being a target', () => {
  const world = setup();
  const enemy = placeEnemy(world.enemies, new THREE.Vector3(0, 500, 400));

  enemy.hp = 1;
  fireAndAdvance(world, 1.5);

  assert.equal(enemy.alive, false);
  assert.equal(world.enemies.getTargets().length, 0, 'dead enemies must not remain in the target list');
});

test('an explosion is triggered on a kill', () => {
  const world = setup();
  const enemy = placeEnemy(world.enemies, new THREE.Vector3(0, 500, 400));
  enemy.hp = 1;

  assert.equal(
    world.enemies.explosions.some((e) => e.active),
    false
  );
  fireAndAdvance(world, 1.5);
  assert.ok(
    world.enemies.explosions.some((e) => e.active),
    'a kill should set off an explosion'
  );
});

// ---------------------------------------------------------------------------
// Bolts move ~10 units per frame at 60fps and enemies are 9 units across, so a
// naive point-in-sphere test can step straight past a target between frames.
// The swept-segment test exists to stop that.
// ---------------------------------------------------------------------------
test('a fast bolt cannot tunnel through an enemy in one frame', () => {
  const world = setup();
  const enemy = placeEnemy(world.enemies, new THREE.Vector3(0, 500, 400));

  // A deliberately coarse timestep: one frame carries a bolt ~124 units,
  // far further than the enemy is wide.
  const step = 0.2;
  assert.ok(WEAPON_PARAMS.SPEED * step > ENEMY_PARAMS.HIT_RADIUS * 4, 'precondition: the step must overshoot the target');

  world.weapons.update(step, world.plane, true);
  world.weapons.collide(world.enemies.getTargets());
  for (let t = 0; t < 2; t += step) {
    world.weapons.update(step, world.plane, false);
    world.weapons.collide(world.enemies.getTargets());
  }

  assert.ok(enemy.hp < ENEMY_PARAMS.HP, 'the bolt tunnelled through the enemy without registering a hit');
});

test('bolts expire instead of leaking out of the pool', () => {
  const world = setup();
  const live = () => world.weapons.bolts.filter((b) => b.alive).length;

  for (let t = 0; t < 3; t += 1 / 60) {
    world.weapons.update(1 / 60, world.plane, true); // hold the trigger down
  }
  assert.ok(live() > 0, 'holding the trigger should put bolts in the air');

  for (let t = 0; t < WEAPON_PARAMS.LIFE + 0.5; t += 1 / 60) {
    world.weapons.update(1 / 60, world.plane, false);
  }
  assert.equal(live(), 0, 'every bolt should expire once its lifetime elapses');
});

test('the rate of fire is capped by the cooldown', () => {
  const world = setup();
  const seconds = 1.0;

  for (let t = 0; t < seconds; t += 1 / 240) {
    world.weapons.update(1 / 240, world.plane, true);
  }

  const expected = seconds / WEAPON_PARAMS.COOLDOWN;
  assert.ok(
    Math.abs(world.weapons.shotsFired - expected) <= 2,
    `expected about ${expected.toFixed(0)} shots in ${seconds}s, fired ${world.weapons.shotsFired}`
  );
});

test('enemies spawn automatically and stay capped', () => {
  const scene = fakeScene();
  const enemies = new EnemyManager(scene);
  const player = new THREE.Vector3(0, 500, 0);

  for (let t = 0; t < 60; t += 1 / 60) {
    enemies.update(1 / 60, player);
  }

  assert.equal(enemies.aliveCount, ENEMY_PARAMS.MAX_ALIVE, `expected the sky to fill to ${ENEMY_PARAMS.MAX_ALIVE} bogeys, got ${enemies.aliveCount}`);
});

test('enemies that stray too far are recycled', () => {
  const scene = fakeScene();
  const enemies = new EnemyManager(scene);
  const player = new THREE.Vector3(0, 500, 0);

  enemies.spawnTimer = 0; // don't wait out the initial spawn delay
  enemies.update(1 / 60, player);
  const enemy = enemies.enemies.find((e) => e.alive);
  assert.ok(enemy, 'precondition: an enemy should have spawned');

  enemy.container.position.set(ENEMY_PARAMS.DESPAWN_RANGE * 2, 500, 0);
  enemies.update(1 / 60, player);

  assert.equal(enemy.alive, false, 'a far-off enemy should be recycled');
});

// ---------------------------------------------------------------------------

let failures = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures++;
    console.log(`  FAIL ${name}`);
    console.log(`       ${error.message}`);
  }
}

console.log(`\n${tests.length - failures}/${tests.length} passed`);
process.exit(failures ? 1 : 0);
