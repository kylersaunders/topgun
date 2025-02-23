class MobileControls {
  constructor(airplane) {
    this.airplane = airplane;
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (!this.isMobile) return;

    // Create left joystick (thrust and roll)
    this.leftJoystick = nipplejs.create({
      zone: document.getElementById('left-joystick'),
      mode: 'static',
      position: { left: '80px', bottom: '80px' },
      color: 'white',
      size: 100,
    });

    // Create right joystick (pitch and yaw)
    this.rightJoystick = nipplejs.create({
      zone: document.getElementById('right-joystick'),
      mode: 'static',
      position: { right: '80px', bottom: '80px' },
      color: 'white',
      size: 100,
    });

    this.setupJoystickListeners();
  }

  setupJoystickListeners() {
    // Left joystick controls (thrust and roll)
    this.leftJoystick.on('move', (evt, data) => {
      // Vertical axis for thrust
      const verticalForce = Math.max(-1, Math.min(1, data.vector.y));
      const thrustValue = FLIGHT_PARAMS.MAX_THRUST * Math.max(0, verticalForce);
      this.airplane.setThrust(thrustValue, true);

      // Horizontal axis for roll
      const rollForce = Math.max(-1, Math.min(1, data.vector.x));
      if (Math.abs(rollForce) > 0.1) {
        this.airplane.container.rotateZ(rollForce * this.airplane.rotationSpeed);
      }
    });

    // Right joystick controls (pitch and yaw)
    this.rightJoystick.on('move', (evt, data) => {
      // Vertical axis for pitch
      const pitchForce = Math.max(-1, Math.min(1, -data.vector.y));
      if (Math.abs(pitchForce) > 0.1) {
        this.airplane.container.rotateX(pitchForce * this.airplane.rotationSpeed);
      }

      // Horizontal axis for yaw
      const yawForce = Math.max(-1, Math.min(1, data.vector.x));
      if (Math.abs(yawForce) > 0.1) {
        this.airplane.container.rotateY(-yawForce * this.airplane.rotationSpeed);
      }
    });

    // Reset controls when joysticks are released
    this.leftJoystick.on('end', () => {
      this.airplane.setThrust(0, false);
    });
  }

  update() {
    // Any continuous updates needed for mobile controls
  }
}
