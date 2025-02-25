class MobileControls {
  constructor(airplane) {
    this.airplane = airplane;
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (!this.isMobile) return;

    // Initialize thrust slider
    this.thrustSlider = document.getElementById('thrust-slider');
    this.thrustHandle = this.thrustSlider.querySelector('.thrust-handle');
    this.thrustSlider.style.display = 'block';

    // Create right joystick (pitch and yaw)
    this.rightJoystick = nipplejs.create({
      zone: document.getElementById('right-joystick'),
      mode: 'static',
      position: { right: '80px', bottom: '80px' },
      color: 'white',
      size: 100,
    });

    this.setupThrustSlider();
    this.setupJoystickListeners();
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
    this.thrustHandle.addEventListener('touchstart', (e) => {
      isDragging = true;
      startY = e.touches[0].clientY;
      this.thrustHandle.style.transition = 'none';
    });

    document.addEventListener(
      'touchmove',
      (e) => {
        if (!isDragging) return;
        e.preventDefault();
        updateThrust(e.touches[0].clientY);
      },
      { passive: false }
    );

    document.addEventListener('touchend', () => {
      isDragging = false;
      this.thrustHandle.style.transition = 'bottom 0.2s';
    });

    // Mouse events for testing
    this.thrustHandle.addEventListener('mousedown', (e) => {
      isDragging = true;
      startY = e.clientY;
      this.thrustHandle.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      updateThrust(e.clientY);
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      this.thrustHandle.style.transition = 'bottom 0.2s';
    });
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
