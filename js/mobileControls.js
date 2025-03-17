import { FLIGHT_PARAMS } from './constants.js';

export class MobileControls {
  constructor(airplane) {
    try {
      console.log('MobileControls constructor started');
      this.airplane = airplane;
      this.lastJoystickUpdateTime = 0;
      this.lastThrustUpdateTime = 0;
      this.joystickUpdateCount = 0;
      this.thrustUpdateCount = 0;
      this.isDragging = false;

      // Initialize thrust slider
      this.thrustSlider = document.getElementById('thrust-slider');
      if (!this.thrustSlider) {
        console.error('[MOBILE] Thrust slider element not found');
        return;
      }
      console.log('Found thrust slider element:', this.thrustSlider);

      this.thrustHandle = this.thrustSlider.querySelector('.thrust-handle');
      if (!this.thrustHandle) {
        console.error('[MOBILE] Thrust handle element not found');
        return;
      }
      console.log('Found thrust handle element:', this.thrustHandle);

      // Force display block regardless of media query
      this.thrustSlider.style.display = 'block';
      console.log('Set thrust slider display to block');

      // Create right joystick (pitch and yaw)
      if (typeof nipplejs === 'undefined') {
        console.error('[MOBILE] nipplejs library not found');
        return;
      }
      console.log('nipplejs is defined:', typeof nipplejs);

      const rightJoystickZone = document.getElementById('right-joystick');
      if (!rightJoystickZone) {
        console.error('[MOBILE] Right joystick zone element not found');
        return;
      }
      console.log('Found right joystick zone element:', rightJoystickZone);

      // Force display block regardless of media query
      rightJoystickZone.style.display = 'block';
      console.log('Set joystick zone display to block');

      // Add debug overlay for touch events
      this.createDebugOverlay();

      const startTime = performance.now();

      try {
        console.log('Creating nipplejs joystick...');
        this.rightJoystick = nipplejs.create({
          zone: rightJoystickZone,
          mode: 'static',
          position: { right: '80px', bottom: '80px' },
          color: 'white',
          size: 100,
        });
        console.log('Nipplejs joystick created successfully:', this.rightJoystick);
      } catch (error) {
        console.error('[MOBILE] Error in nipplejs.create():', error);
        throw error;
      }

      const createTime = performance.now() - startTime;
      console.log(`Joystick created in ${createTime.toFixed(2)}ms`);

      console.log('Setting up thrust slider...');
      this.setupThrustSlider();
      console.log('Thrust slider setup complete');

      console.log('Setting up joystick listeners...');
      this.setupJoystickListeners();
      console.log('Joystick listeners setup complete');

      // Support for hot module replacement
      if (import.meta.hot) {
        import.meta.hot.dispose(() => {
          this.cleanup();
        });
      }

      // Log periodic stats about event frequency
      this.statsInterval = setInterval(() => {
        console.log(
          `Mobile controls stats - Joystick updates: ${this.joystickUpdateCount}/sec, Thrust updates: ${this.thrustUpdateCount}/sec, isDragging: ${this.isDragging}`
        );
        this.joystickUpdateCount = 0;
        this.thrustUpdateCount = 0;
      }, 1000);

      console.log('MobileControls constructor completed');
    } catch (error) {
      console.error('[MOBILE] Fatal error in MobileControls constructor:', error);
      throw error; // Re-throw to allow the caller to handle it
    }
  }

  createDebugOverlay() {
    // Create a debug overlay to show touch events
    this.debugOverlay = document.createElement('div');
    this.debugOverlay.id = 'touch-debug';
    this.debugOverlay.style.position = 'fixed';
    this.debugOverlay.style.top = '60px';
    this.debugOverlay.style.right = '5px';
    this.debugOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.debugOverlay.style.color = 'white';
    this.debugOverlay.style.padding = '5px 10px';
    this.debugOverlay.style.borderRadius = '5px';
    this.debugOverlay.style.fontSize = '12px';
    this.debugOverlay.style.zIndex = '1000';
    this.debugOverlay.textContent = 'Touch debug: No events yet';
    document.body.appendChild(this.debugOverlay);

    // Add global touch event listeners for debugging
    document.addEventListener('touchstart', (e) => {
      this.debugOverlay.textContent = `Touch start: ${e.touches.length} touches`;
    });

    document.addEventListener('touchmove', (e) => {
      this.debugOverlay.textContent = `Touch move: ${e.touches.length} touches`;
    });

    document.addEventListener('touchend', (e) => {
      this.debugOverlay.textContent = `Touch end: ${e.touches.length} touches`;
    });
  }

  cleanup() {
    console.log('Cleaning up mobile controls');

    if (this.debugOverlay && this.debugOverlay.parentNode) {
      this.debugOverlay.parentNode.removeChild(this.debugOverlay);
    }

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    // Destroy joystick
    if (this.rightJoystick) {
      try {
        console.log('Destroying joystick...');
        this.rightJoystick.destroy();
        console.log('Joystick destroyed');
      } catch (e) {
        console.error('Error destroying joystick:', e);
      }
    }

    // Remove any other event listeners
    if (this.thrustHandle) {
      console.log('Removing thrust handle event listeners');
      this.thrustHandle.removeEventListener('touchstart', this._touchStartHandler);
      this.thrustHandle.removeEventListener('mousedown', this._mouseDownHandler);
    }

    console.log('Removing document event listeners');
    document.removeEventListener('touchmove', this._touchMoveHandler);
    document.removeEventListener('touchend', this._touchEndHandler);
    document.removeEventListener('mousemove', this._mouseMoveHandler);
    document.removeEventListener('mouseup', this._mouseUpHandler);
  }

  setupThrustSlider() {
    console.log('Setting up thrust slider event handlers');

    // Make sure the thrust handle is visible and styled properly
    this.thrustHandle.style.position = 'absolute';
    this.thrustHandle.style.bottom = '0px';
    this.thrustHandle.style.left = '10px';
    this.thrustHandle.style.width = '60px';
    this.thrustHandle.style.height = '60px';
    this.thrustHandle.style.backgroundColor = 'white';
    this.thrustHandle.style.borderRadius = '30px';
    this.thrustHandle.style.cursor = 'pointer';
    this.thrustHandle.style.touchAction = 'none';
    this.thrustHandle.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';

    const updateThrust = (clientY) => {
      this.thrustUpdateCount++;

      if (this.debugOverlay) {
        this.debugOverlay.textContent = `Thrust update: ${clientY}px`;
      }

      const rect = this.thrustSlider.getBoundingClientRect();
      const handleHeight = this.thrustHandle.offsetHeight;
      const relativeY = Math.max(0, Math.min(rect.height - handleHeight, rect.bottom - clientY));
      const thrustPercent = relativeY / (rect.height - handleHeight);

      // Update handle position
      this.thrustHandle.style.bottom = `${relativeY}px`;

      // Update airplane thrust
      this.airplane.setThrust(thrustPercent * FLIGHT_PARAMS.MAX_THRUST, true);
    };

    // Touch events
    this._touchStartHandler = (e) => {
      console.log('Thrust touch start', e);
      e.preventDefault(); // Prevent default to ensure we get all events
      this.isDragging = true;

      if (this.debugOverlay) {
        this.debugOverlay.textContent = `Thrust start: ${e.touches[0].clientY}px`;
      }

      this.thrustHandle.style.transition = 'none';
    };

    this.thrustHandle.addEventListener('touchstart', this._touchStartHandler, { passive: false });

    this._touchMoveHandler = (e) => {
      if (!this.isDragging) return;
      e.preventDefault(); // Prevent default to ensure we get all events

      if (e.touches && e.touches.length > 0) {
        updateThrust(e.touches[0].clientY);
      }
    };

    document.addEventListener('touchmove', this._touchMoveHandler, { passive: false });

    this._touchEndHandler = (e) => {
      if (this.isDragging) {
        console.log('Thrust touch end', e);
        this.isDragging = false;
        this.thrustHandle.style.transition = 'bottom 0.2s';

        if (this.debugOverlay) {
          this.debugOverlay.textContent = 'Thrust end';
        }
      }
    };

    document.addEventListener('touchend', this._touchEndHandler, { passive: false });

    // Mouse events for testing on desktop
    this._mouseDownHandler = (e) => {
      console.log('Thrust mouse down', e);
      this.isDragging = true;
      this.thrustHandle.style.transition = 'none';
    };

    this.thrustHandle.addEventListener('mousedown', this._mouseDownHandler);

    this._mouseMoveHandler = (e) => {
      if (!this.isDragging) return;
      updateThrust(e.clientY);
    };

    document.addEventListener('mousemove', this._mouseMoveHandler);

    this._mouseUpHandler = () => {
      if (this.isDragging) {
        console.log('Thrust mouse up');
        this.isDragging = false;
        this.thrustHandle.style.transition = 'bottom 0.2s';
      }
    };

    document.addEventListener('mouseup', this._mouseUpHandler);

    console.log('Thrust slider event handlers set up');
  }

  setupJoystickListeners() {
    try {
      console.log('Setting up joystick listeners');

      // Right joystick controls (pitch and roll only)
      if (!this.rightJoystick) {
        console.error('[MOBILE] Cannot attach listeners - rightJoystick is null or undefined');
        return;
      }

      if (typeof this.rightJoystick.on !== 'function') {
        console.error('[MOBILE] rightJoystick.on is not a function:', this.rightJoystick);
        return;
      }

      console.log('Attaching move event to joystick');
      this.rightJoystick.on('move', (evt, data) => {
        this.joystickUpdateCount++;

        if (this.debugOverlay) {
          this.debugOverlay.textContent = `Joystick: x=${data.vector.x.toFixed(2)}, y=${data.vector.y.toFixed(2)}`;
        }

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

        this.lastJoystickUpdateTime = performance.now();
      });
      console.log('Move event attached to joystick');

      console.log('Attaching end event to joystick');
      this.rightJoystick.on('end', () => {
        console.log('Joystick released');
        if (this.debugOverlay) {
          this.debugOverlay.textContent = 'Joystick released';
        }
      });
      console.log('End event attached to joystick');

      console.log('Attaching start event to joystick');
      this.rightJoystick.on('start', () => {
        console.log('Joystick activated');
        if (this.debugOverlay) {
          this.debugOverlay.textContent = 'Joystick activated';
        }
      });
      console.log('Start event attached to joystick');

      console.log('Joystick listeners setup complete');
    } catch (error) {
      console.error('[MOBILE] Fatal error in setupJoystickListeners:', error);
    }
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
