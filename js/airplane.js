import * as THREE from 'three';
import { FLIGHT_PARAMS } from './constants.js';
import { buildJet } from './jetMesh.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);

// Frame-rate independent smoothing: the fraction to lerp this frame so that the
// value decays with time constant 1/rate regardless of frame duration.
export function smoothing(rate, dt) {
  return 1 - Math.exp(-rate * dt);
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class Airplane {
  constructor(scene) {
    this.container = new THREE.Object3D();
    scene.add(this.container);

    const { group, exhaust } = buildJet();
    this.mesh = group;
    this.exhaust = exhaust;
    this.container.add(this.mesh);

    this.container.position.set(FLIGHT_PARAMS.INITIAL_POSITION.x, FLIGHT_PARAMS.INITIAL_POSITION.y, FLIGHT_PARAMS.INITIAL_POSITION.z);
    this.container.rotation.y = FLIGHT_PARAMS.INITIAL_ROTATION;

    // Control intent, all in [-1, 1]. Controls only ever write these — nothing
    // outside this class touches the plane's orientation, which is what keeps
    // the quaternion from being clobbered.
    this.pitchInput = 0;
    this.rollInput = 0;
    this.yawInput = 0;

    this.velocity = new THREE.Vector3();
    this.speed = 0; // airspeed along the nose, units/sec
    this.sink = 0; // world-down velocity from unsupported weight
    this.thrust = 0; // actual throttle, lags the target
    this.targetThrust = 0;
    this.isThrusting = false;
    this.rudderAngle = 0;
    this.onGround = true;
    this.support = 0; // 0..1, how much of the plane's weight the wings carry
    this.crashes = 0;

    this.boundingSphere = new THREE.Sphere(this.container.position.clone(), 3);

    // Scratch vectors, reused every frame so the hot loop allocates nothing.
    this._forward = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._horizLift = new THREE.Vector3();
    this._horizRight = new THREE.Vector3();
    this._omega = new THREE.Vector3(); // combined body angular velocity
  }

  // How much bank authority the stick still has in the commanded direction,
  // easing to zero at the limit. Positive input banks right, which drives
  // rollAngle negative.
  _rollAuthority(input) {
    const roll = this.rollAngle;
    const remaining = input > 0 ? FLIGHT_PARAMS.MAX_BANK_ANGLE + roll : FLIGHT_PARAMS.MAX_BANK_ANGLE - roll;
    return clamp(remaining / FLIGHT_PARAMS.BANK_SOFT_ZONE, 0, 1);
  }

  // Reads the plane's body axes out of its quaternion. Called after every
  // rotation so the turn/lift maths always uses the current attitude.
  _readAxes() {
    const q = this.container.quaternion;
    this._forward.set(0, 0, 1).applyQuaternion(q);
    this._up.set(0, 1, 0).applyQuaternion(q);
    this._right.set(1, 0, 0).applyQuaternion(q);
  }

  // True roll in [-PI, PI]: 0 is upright, +/-PI is inverted. Using atan2 of the
  // right wing's height against the canopy's means auto-level always rolls out
  // the short way, and it stays correct past 90 degrees where asin flattens out.
  get rollAngle() {
    return Math.atan2(this._right.y, this._up.y);
  }

  // Wingtip height only — this is what decides whether a landing scrapes a wing.
  get bankAngle() {
    return Math.asin(clamp(this._right.y, -1, 1));
  }

  get pitchAngle() {
    return Math.asin(clamp(this._forward.y, -1, 1));
  }

  get heading() {
    return Math.atan2(this._forward.x, this._forward.z);
  }

  update(dt, groundHeightAt) {
    this._readAxes();

    // --- Engine lag -------------------------------------------------------
    this.thrust += (this.targetThrust - this.thrust) * smoothing(FLIGHT_PARAMS.ENGINE_RESPONSE, dt);

    // --- Airspeed ---------------------------------------------------------
    // Chase the commanded speed, then trade altitude for speed: nose down
    // builds airspeed, nose up bleeds it.
    const commanded = this.thrust * FLIGHT_PARAMS.MAX_SPEED;
    this.speed += (commanded - this.speed) * smoothing(FLIGHT_PARAMS.ENGINE_RESPONSE, dt);
    this.speed -= this._forward.y * FLIGHT_PARAMS.DIVE_ACCEL * dt;
    this.speed = clamp(this.speed, 0, FLIGHT_PARAMS.MAX_SPEED * 1.3);

    // Control surfaces need air over them. Below stall speed you have no
    // authority; it ramps in smoothly from there.
    const authority = clamp(this.speed / FLIGHT_PARAMS.STALL_SPEED, 0, 1);

    // --- Attitude ---------------------------------------------------------
    // Attitude is driven purely through the quaternion — nothing writes
    // container.rotation directly, so pitch, roll and heading stay independent
    // no matter how far the plane is banked.
    //
    // The three body rates are combined into a single angular-velocity vector
    // and applied as ONE rotation about that axis. Applying them as three
    // separate rotateX/Y/Z calls would be order-dependent (rotations don't
    // commute), and the resulting error scales with the timestep — which makes
    // the whole flight path frame-rate dependent.
    if (authority > 0.001) {
      // Pitch: stick, or ease the nose back to the horizon when hands-off.
      const pitchRate = this.pitchInput
        ? -this.pitchInput * FLIGHT_PARAMS.PITCH_RATE
        : clamp(this.pitchAngle * FLIGHT_PARAMS.PITCH_AUTOLEVEL, -FLIGHT_PARAMS.PITCH_RATE, FLIGHT_PARAMS.PITCH_RATE);

      // Roll commands a bank angle, not an endless roll rate: authority fades
      // out at the bank limit, so holding the key gives a steady turn rather
      // than a barrel roll. Hands-off, the wings roll level — clamped so
      // recovery from inverted never out-rolls the pilot's own stick.
      const rollRate = this.rollInput
        ? -this.rollInput * FLIGHT_PARAMS.ROLL_RATE * this._rollAuthority(this.rollInput)
        : clamp(-this.rollAngle * FLIGHT_PARAMS.ROLL_AUTOLEVEL, -FLIGHT_PARAMS.ROLL_RATE, FLIGHT_PARAMS.ROLL_RATE);

      const yawRate = this.yawInput * FLIGHT_PARAMS.YAW_RATE;

      this._omega.set(pitchRate, yawRate, rollRate).multiplyScalar(authority);
      const rate = this._omega.length();
      if (rate > 1e-6) {
        this._omega.divideScalar(rate);
        this.container.rotateOnAxis(this._omega, rate * dt); // body-frame axis
        this._readAxes();
      }

      // --- Bank turns the heading ---------------------------------------
      // The horizontal component of the lift vector is what actually pulls a
      // plane around a turn. Project body-up onto the horizontal plane and
      // yaw about WORLD up (not body up) so the turn stays level.
      this._horizLift.set(this._up.x, 0, this._up.z);
      this._horizRight.set(this._right.x, 0, this._right.z);
      if (this._horizRight.lengthSq() > 1e-6) {
        this._horizRight.normalize();
        const turn = this._horizLift.dot(this._horizRight); // >0 = lift points right
        this.container.rotateOnWorldAxis(WORLD_UP, turn * FLIGHT_PARAMS.TURN_RATE * authority * dt);
        this._readAxes();
      }
    }

    // --- Lift versus gravity ---------------------------------------------
    // Wings only hold you up if they're moving fast enough AND pointing up.
    // Slow down, or roll inverted, and you start falling. Pulling back adds
    // angle of attack, which is how a hard bank keeps its altitude.
    const angleOfAttack = 1 + Math.max(0, this.pitchInput) * FLIGHT_PARAMS.AOA_LIFT_BONUS;
    this.support = clamp(authority * Math.max(0, this._up.y) * angleOfAttack, 0, 1);
    this.sink += FLIGHT_PARAMS.GRAVITY * (1 - this.support) * dt;
    this.sink -= this.sink * FLIGHT_PARAMS.SINK_RECOVERY * this.support * dt;
    this.sink = clamp(this.sink, 0, FLIGHT_PARAMS.MAX_SINK);

    // --- Integrate --------------------------------------------------------
    this.velocity.copy(this._forward).multiplyScalar(this.speed);
    this.velocity.y -= this.sink;
    this.container.position.addScaledVector(this.velocity, dt);

    // --- Ground -----------------------------------------------------------
    const terrainY = groundHeightAt ? groundHeightAt(this.container.position.x, this.container.position.z) : 0;
    const floor = terrainY + FLIGHT_PARAMS.GROUND_CLEARANCE;

    if (this.container.position.y <= floor) {
      const hitHard = this.sink > FLIGHT_PARAMS.CRASH_SINK_RATE || Math.abs(this.bankAngle) > FLIGHT_PARAMS.CRASH_BANK_ANGLE;
      if (hitHard && this.speed > 5) {
        this.crash();
        return;
      }
      this.container.position.y = floor;
      this.sink = 0;
      this.onGround = true;
      // Rolling on the tarmac: settle onto the gear.
      const level = smoothing(6, dt);
      this.container.quaternion.slerp(this._levelQuaternion(), level);
      this._readAxes();
    } else {
      this.onGround = false;
    }

    this.boundingSphere.center.copy(this.container.position);
  }

  // The plane's current heading, but wings-level and nose on the horizon.
  _levelQuaternion() {
    if (!this._levelQuat) this._levelQuat = new THREE.Quaternion();
    if (!this._levelEuler) this._levelEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._levelEuler.set(0, this.heading, 0);
    return this._levelQuat.setFromEuler(this._levelEuler);
  }

  crash() {
    this.crashes++;
    this.resetPosition();
  }

  resetPosition() {
    this.container.position.set(FLIGHT_PARAMS.INITIAL_POSITION.x, FLIGHT_PARAMS.INITIAL_POSITION.y, FLIGHT_PARAMS.INITIAL_POSITION.z);
    this.container.quaternion.identity();
    this.container.rotation.set(0, FLIGHT_PARAMS.INITIAL_ROTATION, 0);

    this.velocity.set(0, 0, 0);
    this.speed = 0;
    this.sink = 0;
    this.thrust = 0;
    this.targetThrust = 0;
    this.isThrusting = false;
    this.pitchInput = 0;
    this.rollInput = 0;
    this.yawInput = 0;
    this.rudderAngle = 0;
    this.onGround = true;
    this._readAxes();
  }

  checkCollision(object) {
    if (object.boundingSphere) {
      return this.boundingSphere.intersectsSphere(object.boundingSphere);
    }
    return false;
  }

  setThrust(value, isActive) {
    this.targetThrust = clamp(value, 0, FLIGHT_PARAMS.MAX_THRUST);
    this.isThrusting = isActive;
  }

  getForwardSpeed() {
    return this.speed;
  }

  setRudder(angle) {
    this.rudderAngle = angle;
  }

  // World-space position of a wing gun muzzle. side: -1 left, +1 right.
  getMuzzlePosition(side, target) {
    target.set(side * 3.6, -0.1, 1.4);
    return this.container.localToWorld(target);
  }
}
