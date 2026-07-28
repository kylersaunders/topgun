export const KEYS = {
  THRUST_INCREASE: 'w',
  THRUST_DECREASE: 's',
  RUDDER_LEFT: 'a',
  RUDDER_RIGHT: 'd',
  ROLL_LEFT: 'ArrowLeft',
  ROLL_RIGHT: 'ArrowRight',
  PITCH_UP: 'ArrowDown', // pull back to climb (stick convention)
  PITCH_DOWN: 'ArrowUp',
  FIRE: ' ',
  TOGGLE_CONTROLS: 'h',
};

// Every rate below is per SECOND, not per frame. The simulation is delta-time
// driven so the plane flies identically at 30, 60 or 144 fps.
export const FLIGHT_PARAMS = {
  // Throttle and airspeed (world units per second)
  MAX_THRUST: 1,
  THROTTLE_RATE: 0.55, // throttle travel per second on W/S
  ENGINE_RESPONSE: 1.6, // how fast airspeed chases commanded airspeed
  MAX_SPEED: 70, // reads as ~1111 km/h
  STALL_SPEED: 20, // below this the wings stop supporting the plane
  DIVE_ACCEL: 34, // airspeed gained per second pointing straight down
  KMH_PER_UNIT: 15.87, // 70 u/s -> 1111 km/h

  // Lift and gravity
  GRAVITY: 24, // units/s^2
  MAX_SINK: 45,
  SINK_RECOVERY: 2.2, // how fast supported wings arrest a sink

  // Control authority, radians per second at full deflection
  PITCH_RATE: 1.15,
  ROLL_RATE: 2.8,
  YAW_RATE: 0.6,
  TURN_RATE: 1.25, // how hard bank angle pulls the nose around
  ROLL_AUTOLEVEL: 1.5, // wings-level recovery when you let go
  PITCH_AUTOLEVEL: 0.9,
  // Holding the roll key banks to this angle and stays there, so you can hold a
  // sustained turn. Without the limit the plane just barrel-rolls and the
  // heading oscillates instead of sweeping round.
  MAX_BANK_ANGLE: (75 * Math.PI) / 180,
  // Roll authority fades out over the last few degrees before the limit. A hard
  // cutoff would overshoot by a different amount at 30fps than at 144fps, which
  // makes the whole flight path frame-rate dependent.
  BANK_SOFT_ZONE: (14 * Math.PI) / 180,
  // Pulling back tightens the turn: angle of attack adds lift, which is what
  // lets a hard bank hold its altitude.
  AOA_LIFT_BONUS: 0.8,

  // Ground
  GROUND_CLEARANCE: 2, // gear height above terrain
  CRASH_SINK_RATE: 22, // touching down faster than this wrecks you
  CRASH_BANK_ANGLE: Math.PI / 6, // ...as does landing on a wingtip

  INITIAL_ALTITUDE: 50,
  INITIAL_POSITION: {
    x: 0,
    y: 2,
    z: -25, // start at the beginning of the runway
  },
  INITIAL_ROTATION: 0, // face positive Z, down the runway
};

export const CAMERA_PARAMS = {
  OFFSET: { x: 0, y: 2.6, z: -14 }, // behind and above, in plane-local space
  POSITION_LAG: 9, // 1/s — higher is tighter
  ROTATION_LAG: 6, // 1/s — how fast the camera adopts the plane's roll
  BASE_FOV: 72,
  SPEED_FOV: 14, // extra degrees of FOV at full throttle
};
// The camera aims at WEAPON_PARAMS.CONVERGENCE, not at some separate look-ahead
// distance, so screen centre is exactly where the guns cross. Aiming anywhere
// else would put the crosshair a couple of degrees off the shots at range.

export const WEAPON_PARAMS = {
  SPEED: 620, // units per second
  LIFE: 2.2, // seconds before a bolt expires
  COOLDOWN: 0.11, // seconds between shots
  DAMAGE: 1,
  LENGTH: 9,
  RADIUS: 0.22,
  CONVERGENCE: 900, // wing guns aim at a point this far ahead
};

export const ENEMY_PARAMS = {
  MAX_ALIVE: 5,
  SPAWN_INTERVAL: 2.5, // seconds between spawn attempts
  SPAWN_MIN_RANGE: 260,
  SPAWN_MAX_RANGE: 750,
  DESPAWN_RANGE: 4000,
  HP: 5,
  SPEED: 46,
  TURN_RATE: 0.55, // radians per second
  HIT_RADIUS: 9,
  REPOSITION_RANGE: 320, // how close a waypoint gets to the player
};

export const WILDLIFE_PARAMS = {
  BIRD_FLOCKS: 6,
  BIRDS_PER_FLOCK: 7,
  BIRD_SPEED: 9,
  BIRD_MIN_ALTITUDE: 18,
  BIRD_MAX_ALTITUDE: 70,
  CAR_COUNT: 14,
  CAR_SPEED: 14,
  SPAWN_MIN_RANGE: 150,
  SPAWN_MAX_RANGE: 700,
  DESPAWN_RANGE: 1600,
};
