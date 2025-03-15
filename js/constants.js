export const KEYS = {
  THRUST_INCREASE: 'w',
  THRUST_DECREASE: 's',
  RUDDER_LEFT: 'a',
  RUDDER_RIGHT: 'd',
  ROLL_LEFT: 'ArrowLeft',
  ROLL_RIGHT: 'ArrowRight',
  TURN_LEFT: 'ArrowLeft',
  TURN_RIGHT: 'ArrowRight',
  PITCH_UP: 'ArrowUp',
  PITCH_DOWN: 'ArrowDown',
  TOGGLE_CONTROLS: 'h',
};

export const FLIGHT_PARAMS = {
  MAX_THRUST: 1,
  MAX_SPEED: 1.111, // This will result in 1111 km/h when multiplied by 1000
  THRUST_INCREMENT: 0.1, // 5% increments
  LIFT: 0.2,
  WEIGHT: 0.03, // Reduce weight slightly
  MAX_ROLL_ANGLE: Math.PI / 6, // 30 degrees (π/6 radians)
  MAX_PITCH_UP: Math.PI / 4, // 45 degrees up
  MAX_PITCH_DOWN: (0.93 * Math.PI) / 2, // 85 degrees down (~1.48 radians)
  PITCH_LAG: 0.05, // How quickly pitch responds to input
  ENGINE_LAG: 0.05, // New constant for engine response lag
  ROTATION_SPEED: 0.02,
  ROLL_EFFECTIVENESS: 0.7,
  ROLL_RECOVERY_FACTOR: 0.95,
  TURN_BANK_FACTOR: 2,
  INITIAL_ALTITUDE: 50,
  TURN_RATE: 0.003,
  RUDDER_EFFECTIVENESS: 0.3,
  MIN_SPEED_FOR_RUDDER: 0.05,
  PITCH_EFFECTIVENESS: 0.15,
  MIN_SPEED_FOR_PITCH: 0.05,
  MIN_SPEED_FOR_ROLL: 0.05,
  INITIAL_POSITION: {
    x: 0,
    y: 3, // Match airplane height
    z: -25, // Start at beginning of runway
  },
  INITIAL_ROTATION: 0, // Face positive Z (down the runway)
  TARGET_THRUST: 0, // New constant to track desired thrust level
};
