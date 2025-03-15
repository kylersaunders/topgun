import { FLIGHT_PARAMS } from './constants.js';

export class MobileControls {
  constructor(airplane) {
    try {
      this.airplane = airplane;
      this.lastJoystickUpdateTime = 0;
      this.lastThrustUpdateTime = 0;
      this.joystickUpdateCount = 0;
      this.thrustUpdateCount = 0;

      // Initialize thrust slider
      this.thrustSlider = document.getElementById('thrust-slider');
      if (!this.thrustSlider) {
        console.error('[MOBILE] Thrust slider element not found');
        return;
      }

      this.thrustHandle = this.thrustSlider.querySelector('.thrust-handle');
      if (!this.thrustHandle) {
        console.error('[MOBILE] Thrust handle element not found');
        return;
      }

      // Force display block regardless of media query
      this.thrustSlider.style.display = 'block';

      // Create right joystick (pitch and yaw)
      if (typeof nipplejs === 'undefined') {
        console.error('[MOBILE] nipplejs library not found');
        return;
      }

      const rightJoystickZone = document.getElementById('right-joystick');
      if (!rightJoystickZone) {
        console.error('[MOBILE] Right joystick zone element not found');
        return;
      }

      // Force display block regardless of media query
      rightJoystickZone.style.display = 'block';

      const startTime = performance.now();

      try {
        this.rightJoystick = nipplejs.create({
          zone: rightJoystickZone,
          mode: 'static',
          position: { right: '80px', bottom: '80px' },
          color: 'white',
          size: 100,
        });
      } catch (error) {
        console.error('[MOBILE] Error in nipplejs.create():', error);
        throw error;
      }

      const createTime = performance.now() - startTime;

      this.setupThrustSlider();

      this.setupJoystickListeners();

      // Support for hot module replacement
      if (import.meta.hot) {
        import.meta.hot.dispose(() => {
          this.cleanup();
        });
      }

      // Log periodic stats about event frequency
      this.statsInterval = setInterval(() => {
        this.joystickUpdateCount = 0;
        this.thrustUpdateCount = 0;
      }, 1000);
    } catch (error) {
      console.error('[MOBILE] Fatal error in MobileControls constructor:', error);
      throw error; // Re-throw to allow the caller to handle it
    }
  }

  cleanup() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    // Destroy joystick
    if (this.rightJoystick) {
      try {
        this.rightJoystick.destroy();
      } catch (e) {
        console.error('Error destroying joystick:', e);
      }
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

  setupThrustSlider() {
    let isDragging = false;
    let startY;

    const updateThrust = (clientY) => {
      const updateStartTime = performance.now();
      this.thrustUpdateCount++;

      const rect = this.thrustSlider.getBoundingClientRect();
      const handleHeight = this.thrustHandle.offsetHeight;
      const relativeY = Math.max(0, Math.min(rect.bottom - handleHeight - rect.top, rect.bottom - clientY));
      const thrustPercent = relativeY / (rect.height - handleHeight);

      // Update handle position
      this.thrustHandle.style.bottom = `${relativeY}px`;

      // Update airplane thrust
      this.airplane.setThrust(thrustPercent * FLIGHT_PARAMS.MAX_THRUST, true);

      const updateTime = performance.now() - updateStartTime;
      if (updateTime > 5) {
        console.warn(`Slow thrust update: ${updateTime.toFixed(2)}ms`);
      }
      this.lastThrustUpdateTime = performance.now();
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
      if (isDragging) {
        isDragging = false;
        this.thrustHandle.style.transition = 'bottom 0.2s';
      }
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
      if (isDragging) {
        isDragging = false;
        this.thrustHandle.style.transition = 'bottom 0.2s';
      }
    };

    document.addEventListener('mouseup', this._mouseUpHandler);
  }

  setupJoystickListeners() {
    try {
      // Right joystick controls (pitch and roll only)

      if (!this.rightJoystick) {
        console.error('[MOBILE] Cannot attach listeners - rightJoystick is null or undefined');
        return;
      }

      if (typeof this.rightJoystick.on !== 'function') {
        console.error('[MOBILE] rightJoystick.on is not a function:', this.rightJoystick);
        return;
      }

      this.rightJoystick.on('move', (evt, data) => {
        const moveStartTime = performance.now();
        this.joystickUpdateCount++;

        try {
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
        } catch (error) {
          console.error('[MOBILE] Error in joystick move handler:', error);
        }

        const moveTime = performance.now() - moveStartTime;
        if (moveTime > 5) {
          console.warn(`[MOBILE] Slow joystick move processing: ${moveTime.toFixed(2)}ms`);
        }
        this.lastJoystickUpdateTime = performance.now();
      });

      this.rightJoystick.on('end', () => {});
    } catch (error) {
      console.error('[MOBILE] Fatal error in setupJoystickListeners:', error);
    }
  }

  update() {
    const updateStartTime = performance.now();

    // Auto-center roll when no joystick input and moving
    if (this.rightJoystick && !this.rightJoystick.active) {
      const forwardSpeed = Math.abs(this.airplane.getForwardSpeed());
      if (forwardSpeed > FLIGHT_PARAMS.MIN_SPEED_FOR_ROLL) {
        this.airplane.rollAngle *= FLIGHT_PARAMS.ROLL_RECOVERY_FACTOR;
      }
    }

    const updateTime = performance.now() - updateStartTime;
    if (updateTime > 5) {
      console.warn(`Slow mobile controls update: ${updateTime.toFixed(2)}ms`);
    }
  }
}
