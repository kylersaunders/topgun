class Environment {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = [];
    this.createOcean(scene);
    this.createGround(scene);
    this.createRunway(scene);
    this.createSky(scene);
    this.createClouds(scene);
    this.createAirport(scene);
    this.createBuildings(scene);
  }

  createOcean(scene) {
    const oceanGeometry = new THREE.PlaneGeometry(2000, 2000);
    const oceanMaterial = new THREE.MeshPhongMaterial({
      color: 0x001933, // Dark blue
      side: THREE.DoubleSide,
    });
    const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
    ocean.rotation.x = Math.PI / 2;
    ocean.position.y = -1; // Slightly below ground level
    scene.add(ocean);
  }

  createRunway(scene) {
    // Main runway
    const runwayLength = 200;
    const runwayWidth = 50;
    const runwayGeometry = new THREE.PlaneGeometry(runwayWidth, runwayLength);
    const runwayMaterial = new THREE.MeshPhongMaterial({
      color: 0x333333, // Dark gray
      side: THREE.DoubleSide,
    });
    const runway = new THREE.Mesh(runwayGeometry, runwayMaterial);
    runway.rotation.x = Math.PI / 2;
    runway.position.y = 0.1; // Slightly above ground to prevent z-fighting
    scene.add(runway);

    // Runway center lines
    const createRunwayLine = (position) => {
      const lineGeometry = new THREE.PlaneGeometry(1, 20);
      const lineMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
      });
      const line = new THREE.Mesh(lineGeometry, lineMaterial);
      line.rotation.x = Math.PI / 2;
      line.position.set(0, 0.2, position);
      scene.add(line);
    };

    // Create multiple lines along the runway
    for (let i = -80; i <= 80; i += 40) {
      createRunwayLine(i);
    }
  }

  createAirport(scene) {
    // Main terminal building
    const terminalGeometry = new THREE.BoxGeometry(50, 15, 20);
    const terminalMaterial = new THREE.MeshPhongMaterial({
      color: 0xcccccc,
    });
    const terminal = new THREE.Mesh(terminalGeometry, terminalMaterial);
    terminal.position.set(50, 7.5, 0); // Positioned to the side of the runway
    scene.add(terminal);

    // Control tower
    const towerBaseGeometry = new THREE.CylinderGeometry(3, 3, 25, 8);
    const towerTopGeometry = new THREE.CylinderGeometry(6, 6, 8, 8);
    const towerMaterial = new THREE.MeshPhongMaterial({
      color: 0xdddddd,
    });

    const towerBase = new THREE.Mesh(towerBaseGeometry, towerMaterial);
    const towerTop = new THREE.Mesh(towerTopGeometry, towerMaterial);

    towerBase.position.set(60, 12.5, 20);
    towerTop.position.set(60, 29, 20);

    scene.add(towerBase);
    scene.add(towerTop);

    // Add these to obstacles
    const terminalBoundingSphere = new THREE.Sphere(terminal.position.clone(), 25);
    terminal.boundingSphere = terminalBoundingSphere;
    this.obstacles.push(terminal);

    const towerBoundingSphere = new THREE.Sphere(
      towerBase.position.clone(),
      Math.max(towerBase.geometry.parameters.height, towerBase.geometry.parameters.radius) * 1.5
    );
    towerBase.boundingSphere = towerBoundingSphere;
    this.obstacles.push(towerBase);
  }

  createGround(scene) {
    const groundGeometry = new THREE.CircleGeometry(300, 64); // Circular island
    const groundMaterial = new THREE.MeshPhongMaterial({
      color: 0x2d5a27, // Slightly brighter green
      side: THREE.DoubleSide,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = Math.PI / 2;
    scene.add(ground);
  }

  createSky(scene) {
    scene.background = new THREE.Color(0x87ceeb);
  }

  createClouds(scene) {
    const createCloud = (x, y, z, scale) => {
      const cloudGroup = new THREE.Group();
      const cloudMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
      });

      // Create multiple spheres for each cloud
      const sphereCounts = Math.floor(Math.random() * 3) + 3;
      for (let i = 0; i < sphereCounts; i++) {
        const sphereSize = (Math.random() * 10 + 15) * scale;
        const sphereGeometry = new THREE.SphereGeometry(sphereSize, 16, 16);
        const cloudPiece = new THREE.Mesh(sphereGeometry, cloudMaterial);

        // Random position within cloud group
        cloudPiece.position.set(Math.random() * 20 - 10, Math.random() * 5, Math.random() * 20 - 10);

        cloudGroup.add(cloudPiece);
      }

      cloudGroup.position.set(x, y, z);
      scene.add(cloudGroup);
    };

    // Create multiple clouds at different positions and heights
    const cloudPositions = [
      { x: 200, y: 100, z: 200, scale: 1 },
      { x: -150, y: 150, z: -100, scale: 1.2 },
      { x: -250, y: 80, z: 300, scale: 0.8 },
      { x: 300, y: 120, z: -200, scale: 1.1 },
      { x: 0, y: 200, z: -300, scale: 1.3 },
      { x: -200, y: 90, z: 0, scale: 0.9 },
      { x: 100, y: 180, z: 100, scale: 1 },
    ];

    cloudPositions.forEach((cloud) => {
      createCloud(cloud.x, cloud.y, cloud.z, cloud.scale);
    });
  }

  createBuildings(scene) {
    // Create fewer buildings, concentrated in the center
    for (let i = 0; i < 20; i++) {
      const width = Math.random() * 10 + 10;
      const height = Math.random() * 30 + 20;
      const buildingGeometry = new THREE.BoxGeometry(width, height, width);
      const buildingMaterial = new THREE.MeshPhongMaterial({
        color: 0x808080,
      });
      const building = new THREE.Mesh(buildingGeometry, buildingMaterial);

      // Keep buildings away from runway area
      let x, z;
      let attempts = 0;
      const maxAttempts = 100;
      do {
        x = Math.random() * 200 - 100;
        z = Math.random() * 200 - 100;
        attempts++;
        if (attempts > maxAttempts) {
          // If we can't find a valid position, skip this building
          continue;
        }
      } while (Math.abs(x) < 40 && Math.abs(z) < 120); // Keep clear of runway area

      building.position.set(x, height / 2, z);

      // Add collision detection
      building.boundingSphere = new THREE.Sphere(building.position.clone(), Math.sqrt(50 + height * height) / 2);

      this.obstacles.push(building);
      scene.add(building);
    }
  }

  checkCollisions(airplane) {
    for (const obstacle of this.obstacles) {
      if (airplane.checkCollision(obstacle)) {
        return obstacle;
      }
    }
    return null;
  }
}
