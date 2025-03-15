import { KEYS, FLIGHT_PARAMS } from './constants.js';

export class Controls {
  constructor(airplane) {
    this.airplane = airplane;
    this.keys = {};
    this.infoBox = document.getElementById('info-box');
    this.hint = document.querySelector('.hint');
    this.controlsContent = document.querySelector('.controls-content');
    this.controlsVisible = false;

    // Only add keyboard listeners if not in mobile mode (based on window size)
    this.isMobile = window.innerWidth <= 1024;
    if (!this.isMobile) {
      this._keyDownHandler = (e) => this.onKeyDown(e);
      this._keyUpHandler = (e) => this.onKeyUp(e);

      document.addEventListener('keydown', this._keyDownHandler);
      document.addEventListener('keyup', this._keyUpHandler);
    }

    // Support for hot module replacement
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        this.cleanup();
      });
    }
  }

  cleanup() {
    console.log('Cleaning up keyboard controls');
    if (this._keyDownHandler) {
      document.removeEventListener('keydown', this._keyDownHandler);
    }
    if (this._keyUpHandler) {
      document.removeEventListener('keyup', this._keyUpHandler);
    }
  }

  onKeyDown(event) {
    this.keys[event.key] = true;

    // Toggle controls panel with 'H' key
    if (event.key.toLowerCase() === KEYS.TOGGLE_CONTROLS) {
      this.controlsVisible = !this.controlsVisible;
      this.infoBox.classList.toggle('expanded', this.controlsVisible);
      this.hint.textContent = this.controlsVisible ? 'Press H to hide controls' : 'Press H to show controls';
      this.controlsContent.style.display = this.controlsVisible ? 'block' : 'none';
    }
  }

  onKeyUp(event) {
    this.keys[event.key] = false;
  }

  update() {
    // Add debug logging
    if (this.keys[KEYS.THRUST_INCREASE]) {
      console.log('Applying thrust');
      const newThrust = Math.min(this.airplane.thrust + FLIGHT_PARAMS.THRUST_INCREMENT, FLIGHT_PARAMS.MAX_THRUST);
      this.airplane.setThrust(newThrust, true);
    } else if (this.keys[KEYS.THRUST_DECREASE]) {
      const newThrust = Math.max(this.airplane.thrust - FLIGHT_PARAMS.THRUST_INCREMENT, 0);
      this.airplane.setThrust(newThrust, true);
    } else {
      this.airplane.setThrust(this.airplane.thrust, false);
    }

    // Roll control (Left/Right arrow keys) - now speed dependent
    const forwardSpeed = Math.abs(this.airplane.getForwardSpeed());
    if (forwardSpeed > FLIGHT_PARAMS.MIN_SPEED_FOR_ROLL) {
      const rollEffect = this.airplane.rotationSpeed * FLIGHT_PARAMS.ROLL_EFFECTIVENESS * (forwardSpeed / FLIGHT_PARAMS.MAX_THRUST);

      // Get current roll angle
      const rollMatrix = new THREE.Matrix4();
      rollMatrix.extractRotation(this.airplane.container.matrix);
      const rightVector = new THREE.Vector3(1, 0, 0);
      rightVector.applyMatrix4(rollMatrix);
      const currentRoll = Math.asin(rightVector.y);

      if (this.keys[KEYS.ROLL_LEFT]) {
        // Limit roll left to -MAX_ROLL_ANGLE
        if (currentRoll > -FLIGHT_PARAMS.MAX_ROLL_ANGLE) {
          this.airplane.container.rotateZ(-rollEffect);
        }
      }
      if (this.keys[KEYS.ROLL_RIGHT]) {
        // Limit roll right to MAX_ROLL_ANGLE
        if (currentRoll < FLIGHT_PARAMS.MAX_ROLL_ANGLE) {
          this.airplane.container.rotateZ(rollEffect);
        }
      }
    }

    // Auto-center roll when no roll input and moving
    if (!this.keys[KEYS.ROLL_LEFT] && !this.keys[KEYS.ROLL_RIGHT] && forwardSpeed > FLIGHT_PARAMS.MIN_SPEED_FOR_ROLL) {
      this.airplane.rollAngle *= FLIGHT_PARAMS.ROLL_RECOVERY_FACTOR;
    }

    // Rudder control (A/D keys) - now speed dependent
    const forwardSpeedRudder = this.airplane.getForwardSpeed();
    if (forwardSpeedRudder > FLIGHT_PARAMS.MIN_SPEED_FOR_RUDDER) {
      const rudderEffect = this.airplane.rotationSpeed * FLIGHT_PARAMS.RUDDER_EFFECTIVENESS * (forwardSpeedRudder / FLIGHT_PARAMS.MAX_THRUST);

      if (this.keys[KEYS.RUDDER_LEFT]) {
        this.airplane.setRudder(-30);
        this.airplane.container.rotateY(rudderEffect);
      } else if (this.keys[KEYS.RUDDER_RIGHT]) {
        this.airplane.setRudder(30);
        this.airplane.container.rotateY(-rudderEffect);
      } else {
        this.airplane.setRudder(0);
      }
    }

    // Pitch control (Up/Down arrow keys) - with lag
    const pitchRate = 0.03; // Rate of pitch change
    const forwardSpeedPitch = Math.abs(this.airplane.getForwardSpeed());

    // Only allow pitch control when moving
    if (forwardSpeedPitch > FLIGHT_PARAMS.MIN_SPEED_FOR_PITCH) {
      // Update target pitch based on input
      if (this.keys[KEYS.PITCH_DOWN]) {
        // Down arrow pitches up
        if (this.airplane.targetPitch > -FLIGHT_PARAMS.MAX_PITCH_UP) {
          this.airplane.targetPitch -= pitchRate;
        }
      }
      if (this.keys[KEYS.PITCH_UP]) {
        // Up arrow pitches down
        // Only allow pitch down if we have some altitude
        if (this.airplane.container.position.y > 3) {
          if (this.airplane.targetPitch < FLIGHT_PARAMS.MAX_PITCH_DOWN) {
            this.airplane.targetPitch += pitchRate;
          }
        }
      }
    }

    // Smoothly interpolate current pitch towards target
    const pitchDiff = this.airplane.targetPitch - this.airplane.currentPitch;
    this.airplane.currentPitch += pitchDiff * FLIGHT_PARAMS.PITCH_LAG;

    // Apply the interpolated pitch
    this.airplane.container.rotation.x = this.airplane.currentPitch;
  }
}
