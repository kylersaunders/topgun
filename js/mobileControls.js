import { FLIGHT_PARAMS } from './constants.js';
import nipplejs from 'nipplejs';

export class MobileControls {
  constructor(airplane) {
    this.airplane = airplane;
    this.isDragging = false;
    this.lastJoystickUpdateTime = 0;
    this.lastThrustUpdateTime = 0;
    this.joystickUpdateCount = 0;
    this.thrustUpdateCount = 0;

    // Initialize thrust slider
    this.thrustSlider = document.getElementById('thrust-slider');
    this.thrustHandle = document.getElementById('thrust-handle');

    // Initialize joystick zone
    this.joystickZone = document.getElementById('right-joystick');

    // Add debug overlay (hidden by default)
    this.setupDebugOverlay();

    // Setup thrust slider
    this.setupThrustSlider();

    // Setup joystick using nipplejs
    this.setupJoystick();

    // Setup stats interval
    this.statsInterval = setInterval(() => {
      this.joystickUpdateCount = 0;
      this.thrustUpdateCount = 0;
    }, 1000);
  }

  setupJoystick() {
    if (!this.joystickZone) {
      return;
    }

    // Make sure the joystick zone is visible
    this.joystickZone.style.display = 'block';

    try {
      // Create the joystick
      this.joystick = nipplejs.create({
        zone: this.joystickZone,
        mode: 'static',
        position: { right: '80px', bottom: '80px' },
        color: 'white',
        size: 120,
      });

      // Set up joystick event listeners
      this.joystick.on('move', (evt, data) => {
        this.joystickUpdateCount++;

        if (this.debugOverlay) {
          this.debugOverlay.textContent = `Joystick: x=${data.vector.x.toFixed(2)}, y=${data.vector.y.toFixed(2)}`;
        }

        // Vertical axis for pitch (y-axis)
        const forwardSpeed = Math.abs(this.airplane.getForwardSpeed());
        if (forwardSpeed > FLIGHT_PARAMS.MIN_SPEED_FOR_PITCH) {
          const pitchForce = -data.vector.y; // Invert Y axis
          if (Math.abs(pitchForce) > 0.1) {
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

        // Horizontal axis for roll (x-axis)
        if (forwardSpeed > FLIGHT_PARAMS.MIN_SPEED_FOR_ROLL) {
          const horizontalForce = data.vector.x;
          if (Math.abs(horizontalForce) > 0.1) {
            // Get current roll angle
            const rollMatrix = new THREE.Matrix4();
            rollMatrix.extractRotation(this.airplane.container.matrix);
            const rightVector = new THREE.Vector3(1, 0, 0);
            rightVector.applyMatrix4(rollMatrix);
            const currentRoll = Math.asin(rightVector.y);

            // Calculate roll amount
            const rollAmount = 0.015 * horizontalForce * (forwardSpeed / FLIGHT_PARAMS.MAX_THRUST);

            // Apply roll with limits
            if ((horizontalForce > 0 && currentRoll < FLIGHT_PARAMS.MAX_ROLL_ANGLE) || (horizontalForce < 0 && currentRoll > -FLIGHT_PARAMS.MAX_ROLL_ANGLE)) {
              this.airplane.container.rotateZ(rollAmount);
            }
          }
        }

        this.lastJoystickUpdateTime = performance.now();
      });

      this.joystick.on('start', () => {
        if (this.debugOverlay) {
          this.debugOverlay.textContent = 'Joystick activated';
        }
      });

      this.joystick.on('end', () => {
        if (this.debugOverlay) {
          this.debugOverlay.textContent = 'Joystick released';
        }
      });
    } catch (error) {
      // Silently fail
    }
  }

  setupThrustSlider() {
    if (!this.thrustSlider || !this.thrustHandle) {
      return;
    }

    // Make sure the thrust slider is visible
    this.thrustSlider.style.display = 'block';

    // Style the thrust handle
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
    this.thrustHandle.style.zIndex = '101';

    const updateThrust = (clientY) => {
      this.thrustUpdateCount++;

      const rect = this.thrustSlider.getBoundingClientRect();
      const handleHeight = this.thrustHandle.offsetHeight;
      const maxY = rect.height - handleHeight;

      // Calculate position relative to bottom of slider
      const relativeY = Math.max(0, Math.min(maxY, rect.bottom - clientY));

      // Update handle position
      this.thrustHandle.style.bottom = `${relativeY}px`;

      // Calculate thrust percentage
      const thrustPercent = relativeY / maxY;

      // Update airplane thrust
      this.airplane.setThrust(thrustPercent * FLIGHT_PARAMS.MAX_THRUST, true);

      if (this.debugOverlay) {
        this.debugOverlay.textContent = `Thrust: ${Math.round(thrustPercent * 100)}%`;
      }
    };

    // Touch events for thrust slider
    this.thrustHandle.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        this.isDragging = true;
        updateThrust(e.touches[0].clientY);
        this.thrustHandle.style.transition = 'none';
        if (this.debugOverlay) {
          this.debugOverlay.textContent = 'Thrust activated';
        }
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
        if (this.isDragging) {
          e.preventDefault();
          this.isDragging = false;
          this.thrustHandle.style.transition = 'bottom 0.2s';
          if (this.debugOverlay) {
            this.debugOverlay.textContent = 'Thrust released';
          }
        }
      },
      { passive: false }
    );

    // Mouse events for desktop testing
    this.thrustHandle.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      updateThrust(e.clientY);
      this.thrustHandle.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      updateThrust(e.clientY);
    });

    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.thrustHandle.style.transition = 'bottom 0.2s';
      }
    });
  }

  setupDebugOverlay() {
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
    this.debugOverlay.style.display = 'none'; // Hide by default
    this.debugOverlay.textContent = 'Touch debug: No events yet';
    document.body.appendChild(this.debugOverlay);
  }

  cleanup() {
    if (this.debugOverlay && this.debugOverlay.parentNode) {
      this.debugOverlay.parentNode.removeChild(this.debugOverlay);
    }

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    // Destroy joystick
    if (this.joystick) {
      try {
        this.joystick.destroy();
      } catch (e) {
        // Silently fail
      }
    }

    // Remove event listeners
    if (this.thrustHandle) {
      this.thrustHandle.removeEventListener('touchstart', this.handleThrustStart);
      this.thrustHandle.removeEventListener('mousedown', this.handleThrustMouseStart);
    }

    document.removeEventListener('touchmove', this.handleThrustMove);
    document.removeEventListener('touchend', this.handleThrustEnd);
    document.removeEventListener('mousemove', this.handleThrustMouseMove);
    document.removeEventListener('mouseup', this.handleThrustMouseEnd);
  }

  update() {
    // Auto-center roll when no joystick input
    if (this.joystick && !this.joystick.active) {
      const forwardSpeed = Math.abs(this.airplane.getForwardSpeed());
      if (forwardSpeed > FLIGHT_PARAMS.MIN_SPEED_FOR_ROLL) {
        this.airplane.rollAngle *= FLIGHT_PARAMS.ROLL_RECOVERY_FACTOR;
      }
    }
  }
}
