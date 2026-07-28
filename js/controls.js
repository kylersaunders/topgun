import { KEYS, FLIGHT_PARAMS } from './constants.js';

export class Controls {
  constructor(airplane) {
    this.airplane = airplane;
    this.keys = {};
    this.firing = false;
    this.infoBox = document.getElementById('info-box');
    this.hint = document.querySelector('.hint');
    this.controlsContent = document.querySelector('.controls-content');
    this.controlsVisible = false;

    this._keyDownHandler = (e) => this.onKeyDown(e);
    this._keyUpHandler = (e) => this.onKeyUp(e);
    this._blurHandler = () => {
      // Alt-tabbing away must not leave a key stuck down.
      this.keys = {};
      this.firing = false;
    };

    document.addEventListener('keydown', this._keyDownHandler);
    document.addEventListener('keyup', this._keyUpHandler);
    window.addEventListener('blur', this._blurHandler);

    if (import.meta.hot) {
      import.meta.hot.dispose(() => this.cleanup());
    }
  }

  cleanup() {
    document.removeEventListener('keydown', this._keyDownHandler);
    document.removeEventListener('keyup', this._keyUpHandler);
    window.removeEventListener('blur', this._blurHandler);
  }

  onKeyDown(event) {
    this.keys[event.key] = true;

    // Space and the arrows scroll the page by default.
    if (event.key === KEYS.FIRE || event.key.startsWith('Arrow')) {
      event.preventDefault();
    }

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

  update(dt) {
    const plane = this.airplane;

    // Throttle ramps at a fixed rate per second rather than per frame.
    if (this.keys[KEYS.THRUST_INCREASE]) {
      plane.setThrust(plane.targetThrust + FLIGHT_PARAMS.THROTTLE_RATE * dt, true);
    } else if (this.keys[KEYS.THRUST_DECREASE]) {
      plane.setThrust(plane.targetThrust - FLIGHT_PARAMS.THROTTLE_RATE * dt, true);
    } else {
      plane.isThrusting = false;
    }

    // Stick and rudder: write intent only. The airplane owns its orientation.
    plane.rollInput = (this.keys[KEYS.ROLL_RIGHT] ? 1 : 0) - (this.keys[KEYS.ROLL_LEFT] ? 1 : 0);
    plane.pitchInput = (this.keys[KEYS.PITCH_UP] ? 1 : 0) - (this.keys[KEYS.PITCH_DOWN] ? 1 : 0);
    plane.yawInput = (this.keys[KEYS.RUDDER_RIGHT] ? 1 : 0) - (this.keys[KEYS.RUDDER_LEFT] ? 1 : 0);

    plane.setRudder(plane.yawInput * 30);

    this.firing = !!this.keys[KEYS.FIRE];
  }
}
