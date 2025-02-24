class Airplane {
  constructor(scene) {
    // Create airplane container
    this.container = new THREE.Object3D();
    scene.add(this.container);

    // Create fuselage (main body)
    const fuselageLength = 5;
    const fuselageRadius = 0.4;

    // Cylinder for main body
    const bodyGeometry = new THREE.CylinderGeometry(
      fuselageRadius, // radiusTop
      fuselageRadius, // radiusBottom
      fuselageLength, // height
      16, // radialSegments
      1 // heightSegments
    );
    const material = new THREE.MeshPhongMaterial({ color: 0x999999 });
    const bodyMesh = new THREE.Mesh(bodyGeometry, material);

    // Nose cone (half sphere)
    const noseGeometry = new THREE.SphereGeometry(fuselageRadius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const noseMesh = new THREE.Mesh(noseGeometry, material);
    noseMesh.position.y = fuselageLength / 2;

    // Flat back
    const backGeometry = new THREE.CircleGeometry(fuselageRadius, 16);
    const backMesh = new THREE.Mesh(backGeometry, material);
    backMesh.position.x = -fuselageLength / 2;

    // Create main wings
    const wingGeometry = new THREE.BoxGeometry(10, 0.1, 1);
    const wingMaterial = new THREE.MeshPhongMaterial({ color: 0x888888 });
    const wingMesh = new THREE.Mesh(wingGeometry, wingMaterial);
    wingMesh.rotation.x = Math.PI / 2;
    wingMesh.position.y = 0;
    wingMesh.position.x = 0;

    // Create tail
    const tailFinHeight = 0.5;
    const tailFinGeometry = new THREE.BoxGeometry(1, tailFinHeight, 0.1);
    const tailFinMesh = new THREE.Mesh(tailFinGeometry, material);
    tailFinMesh.position.set(0, -fuselageLength / 2, -1);

    // Create horizontal stabilizer
    const stabilizerGeometry = new THREE.BoxGeometry(1, 0.1, 2);
    const stabilizerMesh = new THREE.Mesh(stabilizerGeometry, material);
    stabilizerMesh.rotation.z = Math.PI / 2; // Match wing orientation
    stabilizerMesh.position.set(0, -fuselageLength / 2, -1);

    // Combine all parts
    this.mesh = new THREE.Group();
    this.mesh.add(bodyMesh);
    this.mesh.add(noseMesh);
    this.mesh.add(backMesh);
    this.mesh.add(wingMesh);
    this.mesh.add(tailFinMesh);
    this.mesh.add(stabilizerMesh);

    // Add mesh to container
    this.container.add(this.mesh);

    // Rotate mesh to correct orientation
    this.mesh.rotation.x = Math.PI / 2; // Rotate model to align with flight direction

    // Set initial position and rotation
    this.container.position.set(
      FLIGHT_PARAMS.INITIAL_POSITION.x,
      3, // Start slightly higher than ground check
      FLIGHT_PARAMS.INITIAL_POSITION.z
    );
    this.container.rotation.y = FLIGHT_PARAMS.INITIAL_ROTATION;

    // Modified flight parameters
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.acceleration = new THREE.Vector3(0, 0, 0);
    this.thrust = 0;
    this.targetThrust = 0;
    this.isThrusting = false;
    this.maxThrust = FLIGHT_PARAMS.MAX_THRUST;
    this.lift = FLIGHT_PARAMS.LIFT;
    this.weight = FLIGHT_PARAMS.WEIGHT;
    this.rollAngle = 0;
    this.rudderAngle = 0;
    this.maxRollAngle = FLIGHT_PARAMS.MAX_ROLL_ANGLE;
    this.rotationSpeed = FLIGHT_PARAMS.ROTATION_SPEED;
    this.targetPitch = 0; // Add target pitch property
    this.currentPitch = 0; // Add current pitch property

    // Collision parameters
    this.boundingSphere = new THREE.Sphere(this.container.position, 3);

    this.totalLift = 0; // Add property to store total lift
  }

  update() {
    // Smoothly interpolate current thrust towards target thrust for both increase and decrease
    if (this.thrust !== this.targetThrust) {
      const thrustDiff = this.targetThrust - this.thrust;
      this.thrust += thrustDiff * FLIGHT_PARAMS.ENGINE_LAG;
    }

    // Calculate forward speed and direction once
    const forwardVector = new THREE.Vector3(0, 0, 1);
    forwardVector.applyQuaternion(this.container.quaternion);
    const forwardSpeed = this.velocity.dot(forwardVector);

    // Set velocity based on thrust
    const thrustVector = forwardVector.clone();
    thrustVector.multiplyScalar(this.thrust);

    // Project current velocity onto plane's sideways direction to maintain sideways movement
    const rightVector = new THREE.Vector3(1, 0, 0);
    rightVector.applyQuaternion(this.container.quaternion);
    const sideVelocity = rightVector.multiplyScalar(this.velocity.dot(rightVector));

    // Set forward velocity from thrust and maintain side velocity
    this.velocity.copy(thrustVector).add(sideVelocity);

    // Cap maximum speed
    const currentSpeed = this.velocity.length();
    if (currentSpeed > FLIGHT_PARAMS.MAX_SPEED) {
      this.velocity.multiplyScalar(FLIGHT_PARAMS.MAX_SPEED / currentSpeed);
    }

    // Calculate lift based on forward speed and pitch angle
    const pitchAngle = this.container.rotation.x;

    // Calculate angle of attack (-1 to 1, where 0 is level flight)
    const angleOfAttack = Math.sin(pitchAngle);

    // Calculate lift direction perpendicular to wings
    const liftDirection = new THREE.Vector3(0, 1, 0);
    liftDirection.applyQuaternion(this.container.quaternion);

    // Calculate lift force with both base lift and pitch-based lift
    const baseLiftCoefficient = 0.7; // Base lift from wings
    const pitchLiftCoefficient = 1.0; // Additional lift from pitch

    // Calculate total lift but scale it based on how vertical the wings are
    const upVector = new THREE.Vector3(0, 1, 0);
    const wingNormal = liftDirection.clone();
    const verticalComponent = Math.abs(wingNormal.dot(upVector));

    // Calculate total lift with increased compensation for roll
    const rollCompensation = 1 / (verticalComponent * verticalComponent); // Square it for stronger compensation
    const totalLift = (baseLiftCoefficient + angleOfAttack * pitchLiftCoefficient) * FLIGHT_PARAMS.LIFT * forwardSpeed * rollCompensation;
    this.totalLift = totalLift; // Store for display

    // Apply lift in the wing's direction, scaled by vertical component
    const liftForce = liftDirection.multiplyScalar(totalLift * verticalComponent);

    // Only apply gravity and lift when not on ground
    if (this.container.position.y > 2) {
      // Apply lift
      this.velocity.add(liftForce);

      // Apply gravity in world space
      this.velocity.add(new THREE.Vector3(0, -FLIGHT_PARAMS.WEIGHT, 0));
    } else {
      // On ground - stop vertical movement
      this.container.position.y = 2;
      this.velocity.y = Math.max(0, this.velocity.y);
    }

    // Update position
    this.container.position.add(this.velocity);

    // Ground collision check - only when moving
    if (
      (FLIGHT_PARAMS.INITIAL_POSITION.x !== this.container.position.x || FLIGHT_PARAMS.INITIAL_POSITION.z !== this.container.position.z) &&
      this.container.position.y < 2
    ) {
      console.log('Ground collision, resetting');
      this.resetPosition();
    }

    // Apply turn based on roll angle only if we're moving
    if (currentSpeed > FLIGHT_PARAMS.MIN_SPEED_FOR_ROLL) {
      const rollMatrix = new THREE.Matrix4();
      rollMatrix.extractRotation(this.container.matrix);
      const rightVector = new THREE.Vector3(1, 0, 0);
      rightVector.applyMatrix4(rollMatrix);
      const rollAngle = Math.asin(rightVector.y);

      if (Math.abs(rollAngle) > 0.01) {
        const turnRate = rollAngle * currentSpeed * FLIGHT_PARAMS.TURN_RATE;
        this.container.rotateY(-turnRate);
      }
    }

    // Update bounding sphere position
    this.boundingSphere.center.copy(this.container.position);
  }

  resetPosition() {
    // Reset to initial position and orientation
    this.container.position.set(
      FLIGHT_PARAMS.INITIAL_POSITION.x,
      3, // Match constructor height
      FLIGHT_PARAMS.INITIAL_POSITION.z
    );
    this.container.rotation.set(0, FLIGHT_PARAMS.INITIAL_ROTATION, 0);

    // Reset physics
    this.velocity.set(0, 0, 0);
    this.thrust = 0;
    this.isThrusting = false;
    this.rollAngle = 0;
    // Reset pitch values
    this.targetPitch = 0;
    this.currentPitch = 0;
  }

  checkCollision(object) {
    if (object.boundingSphere) {
      return this.boundingSphere.intersectsSphere(object.boundingSphere);
    }
    return false;
  }

  // Modified method to set thrust with target
  setThrust(value, isActive) {
    this.targetThrust = value;
    this.isThrusting = isActive;
  }

  getForwardSpeed() {
    const forwardVector = new THREE.Vector3(0, 0, 1);
    forwardVector.applyQuaternion(this.container.quaternion);
    return this.velocity.dot(forwardVector);
  }

  setRudder(angle) {
    this.rudderAngle = angle;
  }
}
