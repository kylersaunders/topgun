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

    // Initial orientation adjustments
    this.mesh.rotation.x = 0; // Keep level with ground
    this.mesh.rotation.y = 0; // No Y rotation needed
    this.container.add(this.mesh);
    this.container.position.set(0, 3, 100); // Start at end of runway (runway is 200 units long, so start at +100)
    this.container.rotation.y = Math.PI; // Face down the runway (180 degrees)
    this.container.rotation.x = -Math.PI / 2; // -90 degrees XZ plane

    // Enhanced flight parameters
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.acceleration = new THREE.Vector3(0, 0, 0);
    this.thrust = 0;
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
    // Calculate lift based on speed and angle of attack
    const forwardVector = new THREE.Vector3(0, 0, 1);
    forwardVector.applyQuaternion(this.container.quaternion);
    const verticalComponent = forwardVector.y;
    const liftForce = this.lift * this.velocity.length() * (1 - Math.abs(verticalComponent));

    // Apply forces
    this.acceleration.set(0, 0, 0);

    // Thrust
    // Forward thrust in local space
    const thrustVector = new THREE.Vector3(0, 0, this.thrust);
    thrustVector.applyQuaternion(this.container.quaternion);
    this.acceleration.add(thrustVector);

    // Gravity
    this.acceleration.y -= this.weight;

    // Lift
    this.acceleration.y += liftForce;

    // Drag
    const dragForce = this.velocity.clone().multiplyScalar(-this.drag * this.velocity.length());
    this.acceleration.add(dragForce);

    // Update velocity and position
    this.velocity.add(this.acceleration);
    this.container.position.add(this.velocity);

    // Prevent going underground
    if (this.container.position.y < 3) {
      this.container.position.y = 3;
      this.velocity.y = Math.max(0, this.velocity.y);
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
}
