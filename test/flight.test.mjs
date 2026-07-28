// Headless checks on the flight model. Three.js maths runs fine in Node — no
// WebGL is touched — so the physics can be regression-tested without a browser.
//
// Run with: npm test

import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Airplane } from '../js/airplane.js';
import { FLIGHT_PARAMS } from '../js/constants.js';

globalThis.THREE = THREE;

const DEG = 180 / Math.PI;
const flatGround = () => 0;

// Minimal stand-in for a THREE.Scene; the airplane only ever calls add().
const fakeScene = () => ({ add() {}, remove() {} });

function makePlane({ altitude = 500, throttle = 1, speed = FLIGHT_PARAMS.MAX_SPEED } = {}) {
  const plane = new Airplane(fakeScene());
  plane.container.position.set(0, altitude, 0);
  plane.targetThrust = throttle;
  plane.thrust = throttle;
  plane.speed = speed;
  plane._readAxes();
  return plane;
}

function run(plane, seconds, dt, inputs = {}) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    plane.pitchInput = inputs.pitch ?? 0;
    plane.rollInput = inputs.roll ?? 0;
    plane.yawInput = inputs.yaw ?? 0;
    plane.update(dt, flatGround);
  }
}

// Temporarily neutralise a set of FLIGHT_PARAMS so one axis can be isolated.
function withParams(overrides, fn) {
  const saved = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = FLIGHT_PARAMS[key];
    FLIGHT_PARAMS[key] = overrides[key];
  }
  try {
    fn();
  } finally {
    Object.assign(FLIGHT_PARAMS, saved);
  }
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// ---------------------------------------------------------------------------
// The original bug: controls wrote container.rotation.x directly each frame
// while roll and yaw were applied as quaternion rotations. Re-composing the
// XYZ Euler with a fresh X silently rewrote the other two axes whenever the
// plane was banked.
//
// The invariant is that each control input is a *pure body-axis* rotation:
// pitching turns the plane about its own wing axis, so that axis must come out
// unchanged — no matter what attitude the plane is in. (Note the world-referenced
// roll and heading angles both legitimately change when you pitch while banked;
// that is exactly how an aircraft turns. The body axis is the honest invariant.)
// ---------------------------------------------------------------------------
test('pitch is a pure rotation about the wing axis, even when banked', () => {
  withParams({ ROLL_AUTOLEVEL: 0, PITCH_AUTOLEVEL: 0, TURN_RATE: 0 }, () => {
    const plane = makePlane();

    run(plane, 0.3, 1 / 120, { roll: 1 }); // bank right
    assert.ok(plane.rollAngle * DEG < -20, `precondition: expected a right bank, got ${(plane.rollAngle * DEG).toFixed(1)}deg`);

    const wingAxisBefore = plane._right.clone();
    run(plane, 1.0, 1 / 120, { pitch: 1 });

    const alignment = wingAxisBefore.dot(plane._right);
    assert.ok(alignment > 0.9999, `pitching moved the wing axis by ${(Math.acos(Math.min(1, alignment)) * DEG).toFixed(2)}deg`);
  });
});

test('roll is a pure rotation about the nose axis, even when pitched', () => {
  withParams({ ROLL_AUTOLEVEL: 0, PITCH_AUTOLEVEL: 0, TURN_RATE: 0 }, () => {
    const plane = makePlane();

    run(plane, 0.4, 1 / 120, { pitch: 1 }); // nose up
    assert.ok(plane.pitchAngle * DEG > 15, `precondition: expected nose up, got ${(plane.pitchAngle * DEG).toFixed(1)}deg`);

    const noseAxisBefore = plane._forward.clone();
    run(plane, 1.0, 1 / 120, { roll: 1 });

    const alignment = noseAxisBefore.dot(plane._forward);
    assert.ok(alignment > 0.9999, `rolling moved the nose axis by ${(Math.acos(Math.min(1, alignment)) * DEG).toFixed(2)}deg`);
  });
});

// ---------------------------------------------------------------------------
// Control sense. The old arrow-key mapping was inverted: right arrow banked left.
// ---------------------------------------------------------------------------
test('positive roll input banks right', () => {
  const plane = makePlane();
  run(plane, 0.4, 1 / 120, { roll: 1 });
  // Banking right drops the right wing, so the right wing vector points down.
  assert.ok(plane._right.y < -0.1, `right wing should drop when banking right, got y=${plane._right.y.toFixed(3)}`);
});

test('positive pitch input raises the nose', () => {
  const plane = makePlane();
  run(plane, 0.4, 1 / 120, { pitch: 1 });
  assert.ok(plane.pitchAngle > 0.1, `expected nose up, got ${(plane.pitchAngle * DEG).toFixed(1)}deg`);
});

// ---------------------------------------------------------------------------
// Turn coordination: a held bank must pull the nose around the correct way.
// Auto-level is disabled so the bank holds steady while the turn is measured —
// otherwise the wings level out and the turn stops.
// ---------------------------------------------------------------------------
function headingDelta(from, to) {
  return ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

test('a held right bank turns the heading right', () => {
  withParams({ ROLL_AUTOLEVEL: 0 }, () => {
    const plane = makePlane();
    run(plane, 0.3, 1 / 120, { roll: 1 }); // roll to roughly 45 degrees, then hold

    const bank = plane.rollAngle * DEG;
    assert.ok(bank < -20 && bank > -80, `precondition: expected a moderate right bank, got ${bank.toFixed(1)}deg`);

    const before = plane.heading;
    run(plane, 1.0, 1 / 120);
    assert.ok(headingDelta(before, plane.heading) > 0.05, `right bank should increase heading, got ${(headingDelta(before, plane.heading) * DEG).toFixed(1)}deg`);
  });
});

test('a held left bank turns the heading left', () => {
  withParams({ ROLL_AUTOLEVEL: 0 }, () => {
    const plane = makePlane();
    run(plane, 0.3, 1 / 120, { roll: -1 });

    const bank = plane.rollAngle * DEG;
    assert.ok(bank > 20 && bank < 80, `precondition: expected a moderate left bank, got ${bank.toFixed(1)}deg`);

    const before = plane.heading;
    run(plane, 1.0, 1 / 120);
    assert.ok(headingDelta(before, plane.heading) < -0.05, `left bank should decrease heading, got ${(headingDelta(before, plane.heading) * DEG).toFixed(1)}deg`);
  });
});

test('rudder yaws the nose the way it is pushed', () => {
  const plane = makePlane();
  const before = plane.heading;
  run(plane, 0.5, 1 / 120, { yaw: 1 });
  assert.ok(headingDelta(before, plane.heading) > 0, 'right rudder should swing the nose right');
});

// ---------------------------------------------------------------------------
// Auto-level: releasing the stick brings the wings level, including from
// inverted, where the old asin-based angle flattened out and stalled.
// ---------------------------------------------------------------------------
test('wings return to level when the stick is released', () => {
  const plane = makePlane();
  run(plane, 0.5, 1 / 120, { roll: 1 });
  assert.ok(Math.abs(plane.rollAngle * DEG) > 20, 'precondition: plane should be banked');

  run(plane, 6, 1 / 120);
  assert.ok(Math.abs(plane.rollAngle * DEG) < 5, `wings did not level out, roll=${(plane.rollAngle * DEG).toFixed(1)}deg`);
});

test('auto-level recovers from inverted', () => {
  // The stick can't roll past the bank limit, but a loop can still leave you
  // upside down, so recovery from inverted has to work. Set the attitude directly.
  const plane = makePlane();
  plane.container.rotateZ(Math.PI * 0.92);
  plane._readAxes();
  assert.ok(plane._up.y < -0.5, 'precondition: plane should be inverted');

  run(plane, 8, 1 / 120);
  assert.ok(plane._up.y > 0.9, `did not recover to upright, up.y=${plane._up.y.toFixed(3)}`);
});

// ---------------------------------------------------------------------------
// Roll commands a bank angle rather than an endless roll rate. Holding the key
// used to barrel-roll the plane, which made the heading oscillate instead of
// sweeping round — turning was unusable.
// ---------------------------------------------------------------------------
test('holding roll settles at the bank limit instead of barrel-rolling', () => {
  const plane = makePlane();
  run(plane, 4, 1 / 120, { roll: 1 });

  const bank = Math.abs(plane.rollAngle);
  const limit = FLIGHT_PARAMS.MAX_BANK_ANGLE;
  assert.ok(bank <= limit + 0.05, `bank ran past the limit: ${(bank * DEG).toFixed(1)}deg > ${(limit * DEG).toFixed(1)}deg`);
  assert.ok(bank > limit - 0.15, `bank should hold at the limit, got ${(bank * DEG).toFixed(1)}deg`);
});

test('a sustained bank sweeps the heading steadily in one direction', () => {
  const plane = makePlane();
  run(plane, 1, 1 / 120, { roll: 1 }); // establish the bank

  // Sample the heading over a long held turn; every step must go the same way.
  let previous = plane.heading;
  let total = 0;
  for (let i = 0; i < 12; i++) {
    run(plane, 0.25, 1 / 120, { roll: 1, pitch: 0.5 });
    const step = ((plane.heading - previous + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    assert.ok(step > 0, `heading reversed mid-turn at sample ${i} (${(step * DEG).toFixed(1)}deg)`);
    total += step;
    previous = plane.heading;
  }

  assert.ok(total > Math.PI, `a 3s held turn should sweep at least a half circle, swept ${(total * DEG).toFixed(0)}deg`);
});

// ---------------------------------------------------------------------------
// Frame-rate independence. The old model added velocity straight to position
// and used fixed per-frame lerps, so a 144Hz display flew 2.4x faster.
// ---------------------------------------------------------------------------
test('flight path is the same at 30fps and 144fps', () => {
  const inputs = { pitch: 0.5, roll: 0.7 };

  const slow = makePlane({ speed: 0, throttle: 1 });
  run(slow, 6, 1 / 30, inputs);

  const fast = makePlane({ speed: 0, throttle: 1 });
  run(fast, 6, 1 / 144, inputs);

  const drift = slow.container.position.distanceTo(fast.container.position);
  const travelled = slow.container.position.distanceTo(new THREE.Vector3(0, 500, 0));

  assert.ok(travelled > 200, `precondition: plane should have flown somewhere, went ${travelled.toFixed(0)}m`);
  assert.ok(drift / travelled < 0.05, `paths diverged by ${((drift / travelled) * 100).toFixed(1)}% of distance travelled`);
});

// ---------------------------------------------------------------------------
// Lift, stall and ground handling.
// ---------------------------------------------------------------------------
test('a plane at speed and level holds its altitude', () => {
  const plane = makePlane({ altitude: 500 });
  const before = plane.container.position.y;
  run(plane, 5, 1 / 120);
  const drop = before - plane.container.position.y;
  assert.ok(drop < 20, `level flight at full throttle lost ${drop.toFixed(1)}m`);
});

test('an unpowered plane sinks', () => {
  const plane = makePlane({ altitude: 500, throttle: 0, speed: 0 });
  const before = plane.container.position.y;
  run(plane, 3, 1 / 120);
  assert.ok(plane.container.position.y < before - 30, 'a plane with no airspeed should fall');
});

test('the plane rests on the ground rather than sinking through it', () => {
  const plane = makePlane({ altitude: 5, throttle: 0, speed: 0 });
  run(plane, 4, 1 / 120);
  assert.ok(
    Math.abs(plane.container.position.y - FLIGHT_PARAMS.GROUND_CLEARANCE) < 0.01,
    `expected to settle at ${FLIGHT_PARAMS.GROUND_CLEARANCE}m, got ${plane.container.position.y.toFixed(2)}m`
  );
});

test('control authority disappears below stall speed', () => {
  const plane = makePlane({ altitude: 500, throttle: 0, speed: 0 });
  const before = plane.rollAngle;
  run(plane, 0.3, 1 / 120, { roll: 1 });
  assert.equal(plane.rollAngle, before, 'a plane with no airspeed should not respond to the stick');
});

// ---------------------------------------------------------------------------
// The plane must never produce a non-finite transform, which would blank the
// whole scene. The old 1/(v*v) roll compensation went to Infinity at 90 degrees.
// ---------------------------------------------------------------------------
test('extreme manoeuvring never produces NaN', () => {
  const plane = makePlane();
  for (let i = 0; i < 4000; i++) {
    plane.pitchInput = Math.sin(i * 0.11);
    plane.rollInput = Math.cos(i * 0.07);
    plane.yawInput = Math.sin(i * 0.03);
    plane.update(1 / 60, flatGround);

    const p = plane.container.position;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z) || !Number.isFinite(plane.speed)) {
      assert.fail(`non-finite state at step ${i}: pos=${p.toArray()} speed=${plane.speed}`);
    }
  }
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
