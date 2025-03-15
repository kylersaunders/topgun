import { FLIGHT_PARAMS } from './constants.js';

export class MobileControls {
  constructor(airplane) {
    this.airplane = airplane;

    // Use window size to determine if mobile controls should be shown
    this.isMobile = window.innerWidth <= 1024;

    console.log('Mobile mode active:', this.isMobile, 'Window width:', window.innerWidth);

    if (!this.isMobile) return;

    console.log('Initializing mobile controls');

    // Initialize thrust slider
    this.thrustSlider = document.getElementById('thrust-slider');
    if (!this.thrustSlider) {
      console.error('Thrust slider element not found');
      return;
    }

    this.thrustHandle = this.thrustSlider.querySelector('.thrust-handle');
    if (!this.thrustHandle) {
      console.error('Thrust handle element not found');
      return;
    }

    // Force display block regardless of media query
    this.thrustSlider.style.display = 'block';
    console.log('Thrust slider initialized');

    // Create right joystick (pitch and yaw)
    try {
      if (typeof nipplejs === 'undefined') {
        console.error('nipplejs library not found');
        return;
      }

      const rightJoystickZone = document.getElementById('right-joystick');
      if (!rightJoystickZone) {
        console.error('Right joystick zone element not found');
        return;
      }

      // Force display block regardless of media query
      rightJoystickZone.style.display = 'block';

      this.rightJoystick = nipplejs.create({
        zone: rightJoystickZone,
        mode: 'static',
        position: { right: '80px', bottom: '80px' },
        color: 'white',
        size: 100,
      });

      console.log('Right joystick initialized');
    } catch (error) {
      console.error('Error initializing joystick:', error);
      return;
    }

    this.setupThrustSlider();
    this.setupJoystickListeners();

    // Add window resize listener to handle orientation changes
    window.addEventListener('resize', this.handleResize.bind(this));

    // Support for hot module replacement
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        this.cleanup();
      });
    }
  }

  cleanup() {
    console.log('Cleaning up mobile controls');
    // Remove event listeners
    window.removeEventListener('resize', this.handleResize.bind(this));

    // Destroy joystick
    if (this.rightJoystick) {
      this.rightJoystick.destroy();
    }

    // Remove any other event listeners
    if (this.thrustHandle) {
      this.thrustHandle.removeEventListener('touchstart', this._touchStartHandler);
      this.thrustHandle.removeEventListener('mousedown', this._mouseDownHandler);
    }

    document.removeEventListener('touchmove', this._touchMoveHandler);
    document.removeEventListener('touchend', this._touchEndHandler);
    document.removeEventListener('mousemove', this._mouseMoveHandler);
    document.removeEventListener('mouseup', this._mouseUpHandler);
  }

  handleResize() {
    // Update mobile status based on window size
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth <= 1024;

    console.log('Window resized. Mobile mode:', this.isMobile, 'Window width:', window.innerWidth);

    // If mobile status changed, reload the page to reinitialize controls
    if (wasMobile !== this.isMobile) {
      console.log('Mobile status changed, reinitializing controls');
      // Instead of reloading the page, we'll let the main.js handle this
      if (typeof window.reinitializeControls === 'function') {
        window.reinitializeControls();
      }
    }
  }

  setupThrustSlider() {
    let isDragging = false;
    let startY;
    let startThrust;
    const sliderRect = this.thrustSlider.getBoundingClientRect();
    const handleHeight = this.thrustHandle.offsetHeight;
    const maxTravel = sliderRect.height - handleHeight;

    const updateThrust = (clientY) => {
      const rect = this.thrustSlider.getBoundingClientRect();
      const relativeY = Math.max(0, Math.min(rect.bottom - handleHeight - rect.top, rect.bottom - clientY));
      const thrustPercent = relativeY / (rect.height - handleHeight);

      // Update handle position
      this.thrustHandle.style.bottom = `${relativeY}px`;

      // Update airplane thrust
      this.airplane.setThrust(thrustPercent * FLIGHT_PARAMS.MAX_THRUST, true);
    };

    // Touch events
    this._touchStartHandler = (e) => {
      isDragging = true;
      startY = e.touches[0].clientY;
      this.thrustHandle.style.transition = 'none';
    };

    this.thrustHandle.addEventListener('touchstart', this._touchStartHandler);

    this._touchMoveHandler = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      updateThrust(e.touches[0].clientY);
    };

    document.addEventListener('touchmove', this._touchMoveHandler, { passive: false });

    this._touchEndHandler = () => {
      isDragging = false;
      this.thrustHandle.style.transition = 'bottom 0.2s';
    };

    document.addEventListener('touchend', this._touchEndHandler);

    // Mouse events for testing
    this._mouseDownHandler = (e) => {
      isDragging = true;
      startY = e.clientY;
      this.thrustHandle.style.transition = 'none';
    };

    this.thrustHandle.addEventListener('mousedown', this._mouseDownHandler);

    this._mouseMoveHandler = (e) => {
      if (!isDragging) return;
      updateThrust(e.clientY);
    };

    document.addEventListener('mousemove', this._mouseMoveHandler);

    this._mouseUpHandler = () => {
      isDragging = false;
      this.thrustHandle.style.transition = 'bottom 0.2s';
    };

    document.addEventListener('mouseup', this._mouseUpHandler);
  }

  setupJoystickListeners() {
    // Right joystick controls (pitch and roll only)
    this.rightJoystick.on('move', (evt, data) => {
      // Vertical axis for pitch - now speed dependent
      const forwardSpeed = Math.abs(this.airplane.getForwardSpeed());
      if (forwardSpeed > FLIGHT_PARAMS.MIN_SPEED_FOR_PITCH) {
        const pitchForce = Math.max(-1, Math.min(1, -data.vector.y));
        if (Math.abs(pitchForce) > 0.1) {
          // Update the airplane's target pitch instead of directly rotating
          if (pitchForce < 0) {
            // Pitch up (negative force)
            if (this.airplane.targetPitch > -FLIGHT_PARAMS.MAX_PITCH_UP) {
              this.airplane.targetPitch -= 0.03;
            }
          } else {
            // Pitch down (positive force)
            if (this.airplane.container.position.y > 3 && this.airplane.targetPitch < FLIGHT_PARAMS.MAX_PITCH_DOWN) {
              this.airplane.targetPitch += 0.03;
            }
          }
        }
      }

      // Horizontal axis for roll only - simplified and more direct
      if (forwardSpeed > FLIGHT_PARAMS.MIN_SPEED_FOR_ROLL) {
        const horizontalForce = Math.max(-1, Math.min(1, data.vector.x));

        // Only apply roll if force is above threshold
        if (Math.abs(horizontalForce) > 0.1) {
          // Get current roll angle
          const rollMatrix = new THREE.Matrix4();
          rollMatrix.extractRotation(this.airplane.container.matrix);
          const rightVector = new THREE.Vector3(1, 0, 0);
          rightVector.applyMatrix4(rollMatrix);
          const currentRoll = Math.asin(rightVector.y);

          // Calculate roll amount with better control
          const rollAmount = 0.015 * horizontalForce * (forwardSpeed / FLIGHT_PARAMS.MAX_THRUST);

          // Apply roll with limits
          if ((horizontalForce > 0 && currentRoll < FLIGHT_PARAMS.MAX_ROLL_ANGLE) || (horizontalForce < 0 && currentRoll > -FLIGHT_PARAMS.MAX_ROLL_ANGLE)) {
            this.airplane.container.rotateZ(rollAmount);
          }
        }
      }
    });
  }

  update() {
    // Auto-center roll when no joystick input and moving
    if (this.rightJoystick && !this.rightJoystick.active) {
      const forwardSpeed = Math.abs(this.airplane.getForwardSpeed());
      if (forwardSpeed > FLIGHT_PARAMS.MIN_SPEED_FOR_ROLL) {
        this.airplane.rollAngle *= FLIGHT_PARAMS.ROLL_RECOVERY_FACTOR;
      }
    }
  }
}
