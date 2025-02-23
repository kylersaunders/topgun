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

    // Initial orientation adjustments
    this.container.position.set(0, 3, 100); // Start at end of runway
    this.container.rotation.set(0, Math.PI, 0); // Face down the runway

    // Enhanced flight parameters
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.acceleration = new THREE.Vector3(0, 0, 0);
    this.thrust = 0;
    this.hasThrust = false;
    this.maxThrust = FLIGHT_PARAMS.MAX_THRUST;
    this.drag = FLIGHT_PARAMS.DRAG;
    this.lift = FLIGHT_PARAMS.LIFT;
    this.weight = FLIGHT_PARAMS.WEIGHT;
    this.rollAngle = 0;
    this.maxRollAngle = FLIGHT_PARAMS.MAX_ROLL_ANGLE;
    this.rotationSpeed = FLIGHT_PARAMS.ROTATION_SPEED;

    // Collision parameters
    this.boundingSphere = new THREE.Sphere(this.container.position, 3);
  }

  update() {
    // Calculate forward speed
    const forwardVector = new THREE.Vector3(0, 0, 1);
    forwardVector.applyQuaternion(this.container.quaternion);
    const forwardSpeed = this.velocity.dot(forwardVector);

    // Calculate lift based on forward speed and angle of attack
    const verticalComponent = forwardVector.y;
    const angleOfAttack = Math.abs(verticalComponent);
    const liftForce = this.lift * Math.max(0, forwardSpeed) * (1 - angleOfAttack * 0.8);

    // Apply forces
    this.acceleration.set(0, 0, 0);

    // Check if we're actually moving
    const isMoving = this.velocity.length() > 0.01;

    // Only apply thrust if it's actively being controlled AND has a positive thrust value
    if (this.hasThrust && this.thrust > 0) {
      const thrustVector = new THREE.Vector3(0, 0, this.thrust);
      const worldThrust = thrustVector.clone();
      worldThrust.applyQuaternion(this.container.quaternion);
      worldThrust.multiplyScalar(2.0);
      this.acceleration.add(worldThrust);
    }

    // Apply turn based on roll angle only if we're moving
    if (isMoving) {
      const rollMatrix = new THREE.Matrix4();
      rollMatrix.extractRotation(this.container.matrix);
      const rightVector = new THREE.Vector3(1, 0, 0);
      rightVector.applyMatrix4(rollMatrix);
      const rollAngle = Math.asin(rightVector.y);

      if (Math.abs(rollAngle) > 0.01) {
        const turnRate = rollAngle * this.velocity.length() * FLIGHT_PARAMS.TURN_RATE;
        this.container.rotateY(-turnRate);
      }
    }

    // Enhanced gliding physics - only if we're moving and not on the ground
    if (isMoving && this.container.position.y > 3.1) {
      if (!this.hasThrust || this.thrust < 0.01) {
        const glideAngle = -Math.PI / 12;
        const glideVector = new THREE.Vector3(0, Math.sin(glideAngle), Math.cos(glideAngle));
        glideVector.applyQuaternion(this.container.quaternion);
        glideVector.multiplyScalar(this.weight * 1.5);
        this.acceleration.add(glideVector);
        this.acceleration.y -= this.weight * 0.4;
      } else {
        this.acceleration.y -= this.weight;
      }

      // Apply lift force in world space
      const worldLift = new THREE.Vector3(0, liftForce, 0);
      this.acceleration.add(worldLift);
    } else {
      // When stationary or on ground, just apply gravity
      this.acceleration.y -= this.weight;
    }

    // Directional drag - more drag for sideways motion
    if (isMoving) {
      const sidewaysVector = new THREE.Vector3(1, 0, 0);
      sidewaysVector.applyQuaternion(this.container.quaternion);
      const sidewaysSpeed = this.velocity.dot(sidewaysVector);

      const forwardDrag = forwardVector.clone().multiplyScalar(-this.drag * forwardSpeed);
      const sidewaysDrag = sidewaysVector.clone().multiplyScalar(-this.drag * sidewaysSpeed * 2);

      this.acceleration.add(forwardDrag);
      this.acceleration.add(sidewaysDrag);
    }

    // Very gentle velocity damping
    this.velocity.multiplyScalar(0.998);

    // Update velocity and position
    this.velocity.add(this.acceleration.multiplyScalar(0.1));
    this.container.position.add(this.velocity);

    // Prevent going underground and handle ground physics
    if (this.container.position.y < 3) {
      this.container.position.y = 3;
      this.velocity.y = Math.max(0, this.velocity.y);

      // Ground friction - slow down gradually when on ground
      if (!this.hasThrust) {
        // Apply ground friction (reduce speed more slowly)
        const groundFriction = 0.995;
        this.velocity.x *= groundFriction;
        this.velocity.z *= groundFriction;

        // Only stop completely when very slow
        if (Math.abs(this.velocity.x) < 0.001) this.velocity.x = 0;
        if (Math.abs(this.velocity.z) < 0.001) this.velocity.z = 0;
      }
    }

    // Update bounding sphere position
    this.boundingSphere.center.copy(this.container.position);
  }

  checkCollision(object) {
    if (object.boundingSphere) {
      return this.boundingSphere.intersectsSphere(object.boundingSphere);
    }
    return false;
  }

  // Add method to set thrust with control state
  setThrust(value, isActive) {
    this.thrust = value;
    this.hasThrust = isActive;
  }
}
