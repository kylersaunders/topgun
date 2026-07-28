import { FLIGHT_PARAMS } from './constants.js';
import nipplejs from 'nipplejs';

const DEAD_ZONE = 0.12;

export class MobileControls {
  constructor(airplane) {
    this.airplane = airplane;
    this.isDragging = false;
    this.firing = false;

    // Latest joystick reading. Applied every frame in update() rather than
    // mutating the plane inside the event handler, so control response doesn't
    // depend on how fast the touch events happen to arrive.
    this.stickX = 0;
    this.stickY = 0;

    this.thrustSlider = document.getElementById('thrust-slider');
    this.thrustHandle = document.getElementById('thrust-handle');
    this.joystickZone = document.getElementById('right-joystick');
    this.fireButton = document.getElementById('fire-button');

    this.setupThrustSlider();
    this.setupJoystick();
    this.setupFireButton();
  }

  setupJoystick() {
    if (!this.joystickZone) return;

    this.joystickZone.style.display = 'block';

    try {
      this.joystick = nipplejs.create({
        zone: this.joystickZone,
        mode: 'static',
        position: { right: '80px', bottom: '80px' },
        color: 'white',
        size: 120,
      });

      this.joystick.on('move', (evt, data) => {
        this.stickX = data.vector.x;
        this.stickY = data.vector.y;
      });

      this.joystick.on('end', () => {
        this.stickX = 0;
        this.stickY = 0;
      });
    } catch (error) {
      this.joystick = null;
    }
  }

  setupFireButton() {
    if (!this.fireButton) return;

    const press = (e) => {
      e.preventDefault();
      this.firing = true;
      this.fireButton.classList.add('active');
    };
    const release = (e) => {
      e.preventDefault();
      this.firing = false;
      this.fireButton.classList.remove('active');
    };

    this.fireButton.addEventListener('touchstart', press, { passive: false });
    this.fireButton.addEventListener('touchend', release, { passive: false });
    this.fireButton.addEventListener('touchcancel', release, { passive: false });
    this.fireButton.addEventListener('mousedown', press);
    this.fireButton.addEventListener('mouseup', release);
    this.fireButton.addEventListener('mouseleave', release);
  }

  setupThrustSlider() {
    if (!this.thrustSlider || !this.thrustHandle) return;

    this.thrustSlider.style.display = 'block';

    const updateThrust = (clientY) => {
      const rect = this.thrustSlider.getBoundingClientRect();
      const maxY = rect.height - this.thrustHandle.offsetHeight;
      const relativeY = Math.max(0, Math.min(maxY, rect.bottom - clientY));

      this.thrustHandle.style.bottom = `${relativeY}px`;
      this.airplane.setThrust((relativeY / maxY) * FLIGHT_PARAMS.MAX_THRUST, true);
    };

    this.thrustHandle.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this.isDragging = true;
        this.thrustHandle.style.transition = 'none';
        updateThrust(e.touches[0].clientY);
      },
      { passive: false }
    );

    document.addEventListener(
      'touchmove',
      (e) => {
        if (!this.isDragging) return;
        e.preventDefault();
        updateThrust(e.touches[0].clientY);
      },
      { passive: false }
    );

    document.addEventListener(
      'touchend',
      (e) => {
        if (!this.isDragging) return;
        e.preventDefault();
        this.isDragging = false;
        this.thrustHandle.style.transition = 'bottom 0.2s';
      },
      { passive: false }
    );

    // Mouse equivalents so the touch UI is testable on a desktop browser.
    this.thrustHandle.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.thrustHandle.style.transition = 'none';
      updateThrust(e.clientY);
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isDragging) updateThrust(e.clientY);
    });

    document.addEventListener('mouseup', () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.thrustHandle.style.transition = 'bottom 0.2s';
    });
  }

  cleanup() {
    if (this.joystick) {
      try {
        this.joystick.destroy();
      } catch (e) {
        /* nipplejs can throw if the zone is already gone */
      }
    }
  }

  update() {
    const plane = this.airplane;

    const applyDeadZone = (value) => (Math.abs(value) < DEAD_ZONE ? 0 : value);

    // Same convention as the keyboard: push the stick forward to dive, pull
    // back to climb. Right banks right.
    plane.rollInput = applyDeadZone(this.stickX);
    plane.pitchInput = applyDeadZone(-this.stickY);
    plane.yawInput = 0;

    plane.setRudder(0);
  }
}
