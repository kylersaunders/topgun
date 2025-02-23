class Controls {
  constructor(airplane) {
    this.airplane = airplane;
    this.keys = {};
    this.infoBox = document.getElementById('info-box');
    this.controlsVisible = false;

    // Only add keyboard listeners if not on mobile
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!this.isMobile) {
      document.addEventListener('keydown', (e) => this.onKeyDown(e));
      document.addEventListener('keyup', (e) => this.onKeyUp(e));
    }
  }

  onKeyDown(event) {
    this.keys[event.key] = true;

    // Toggle controls panel with 'H' key
    if (event.key.toLowerCase() === KEYS.TOGGLE_CONTROLS) {
      this.controlsVisible = !this.controlsVisible;
      this.infoBox.classList.toggle('expanded', this.controlsVisible);
      const hint = this.infoBox.querySelector('.hint');
      hint.textContent = this.controlsVisible ? 'Press H to hide controls' : 'Press H to show controls';
    }
  }

  onKeyUp(event) {
    this.keys[event.key] = false;
  }

  update() {
    // Thrust control
    if (this.keys[KEYS.THRUST_INCREASE]) {
      const newThrust = Math.min(this.airplane.thrust + FLIGHT_PARAMS.THRUST_INCREMENT, FLIGHT_PARAMS.MAX_THRUST);
      this.airplane.setThrust(newThrust, true);
    } else if (this.keys[KEYS.THRUST_DECREASE]) {
      const newThrust = Math.max(this.airplane.thrust - FLIGHT_PARAMS.THRUST_INCREMENT, 0);
      this.airplane.setThrust(newThrust, true);
    } else {
      this.airplane.setThrust(this.airplane.thrust, false);
    }

    // Roll control (Left/Right arrow keys)
    if (this.keys[KEYS.ROLL_LEFT]) {
      this.airplane.container.rotateZ(-this.airplane.rotationSpeed);
    }
    if (this.keys[KEYS.ROLL_RIGHT]) {
      this.airplane.container.rotateZ(this.airplane.rotationSpeed);
    }
    // Auto-center roll when no roll input
    if (!this.keys[KEYS.ROLL_LEFT] && !this.keys[KEYS.ROLL_RIGHT]) {
      this.airplane.rollAngle *= FLIGHT_PARAMS.ROLL_RECOVERY_FACTOR;
    }

    // Rudder control (A/D keys)
    if (this.keys[KEYS.RUDDER_LEFT]) {
      this.airplane.container.rotateY(this.airplane.rotationSpeed);
    }
    if (this.keys[KEYS.RUDDER_RIGHT]) {
      this.airplane.container.rotateY(-this.airplane.rotationSpeed);
    }

    // Pitch control (Up/Down arrow keys)
    if (this.keys[KEYS.PITCH_UP]) {
      this.airplane.container.rotateX(this.airplane.rotationSpeed);
    }
    if (this.keys[KEYS.PITCH_DOWN]) {
      this.airplane.container.rotateX(-this.airplane.rotationSpeed);
    }
  }
}
