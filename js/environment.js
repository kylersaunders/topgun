class Environment {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = [];
    this.tileSize = 2000; // Size of each terrain tile
    this.visibleTiles = new Map(); // Keep track of loaded tiles
    this.currentTile = { x: 0, z: 0 }; // Track current tile position
    this.distantLandmarks = new Map(); // For storing persistent distant objects

    // Separate ranges for detailed and distant tiles
    this.detailedRange = 1; // 3x3 grid of detailed tiles
    this.visualRange = 4; // 9x9 grid of visual-only tiles

    // Create initial environment
    this.createSky(scene);
    this.createOcean(scene);
    this.createMainAirport();
    this.createClouds(scene);
    this.updateTiles({ x: 0, z: 0 });
    this.createDistantLandmarks();
  }

  getTileKey(x, z) {
    return `${x},${z}`;
  }

  updateTiles(position) {
    const tileX = Math.floor(position.x / this.tileSize);
    const tileZ = Math.floor(position.z / this.tileSize);

    if (tileX === this.currentTile.x && tileZ === this.currentTile.z) return;
    this.currentTile = { x: tileX, z: tileZ };

    const newTiles = new Set();

    // Generate both detailed and visual-only tiles
    for (let x = tileX - this.visualRange; x <= tileX + this.visualRange; x++) {
      for (let z = tileZ - this.visualRange; z <= tileZ + this.visualRange; z++) {
        const key = this.getTileKey(x, z);
        newTiles.add(key);

        if (!this.visibleTiles.has(key)) {
          // Determine if this should be a detailed tile
          const isDetailedTile = Math.abs(x - tileX) <= this.detailedRange && Math.abs(z - tileZ) <= this.detailedRange;

          const tile = this.createTerrainTile(x, z, isDetailedTile);
          this.visibleTiles.set(key, tile);
        }
      }
    }

    // Remove out-of-range tiles
    for (const [key, tile] of this.visibleTiles) {
      if (!newTiles.has(key)) {
        tile.meshes.forEach((mesh) => this.scene.remove(mesh));
        tile.obstacles.forEach((obstacle) => {
          const index = this.obstacles.indexOf(obstacle);
          if (index > -1) this.obstacles.splice(index, 1);
        });
        this.visibleTiles.delete(key);
      }
    }
  }

  createTerrainTile(tileX, tileZ, isDetailed) {
    // Skip creating ground tile if we're at the origin (where airport is)
    if (tileX === 0 && tileZ === 0) {
      return { meshes: [], obstacles: [] };
    }

    const meshes = [];
    const obstacles = [];
    const offsetX = tileX * this.tileSize;
    const offsetZ = tileZ * this.tileSize;

    // Create ground
    const groundGeometry = new THREE.PlaneGeometry(this.tileSize, this.tileSize);
    const groundMaterial = new THREE.MeshPhongMaterial({
      color: 0x2d5a27,
      side: THREE.DoubleSide,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = Math.PI / 2;
    ground.position.set(offsetX + this.tileSize / 2, 0, offsetZ + this.tileSize / 2);
    this.scene.add(ground);
    meshes.push(ground);

    // Only add detailed features to close tiles
    if (isDetailed && Math.random() < 0.7) {
      const buildingCount = Math.floor(Math.random() * 5) + 1;
      for (let i = 0; i < buildingCount; i++) {
        const building = this.createBuilding(offsetX + Math.random() * this.tileSize, offsetZ + Math.random() * this.tileSize);
        if (building.mesh) {
          meshes.push(building.mesh);
          obstacles.push(building);
        }
      }
    }

    return { meshes, obstacles };
  }

  createBuilding(x, z) {
    const width = Math.random() * 10 + 10;
    const height = Math.random() * 30 + 20;
    const buildingGeometry = new THREE.BoxGeometry(width, height, width);
    const buildingMaterial = new THREE.MeshPhongMaterial({
      color: 0x808080,
    });
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);

    building.position.set(x, height / 2, z);
    building.boundingSphere = new THREE.Sphere(building.position.clone(), Math.sqrt(50 + height * height) / 2);

    this.scene.add(building);
    this.obstacles.push(building);

    return { mesh: building, boundingSphere: building.boundingSphere };
  }

  createOcean(scene) {
    // Make ocean follow camera instead of being infinite
    const oceanGeometry = new THREE.PlaneGeometry(this.tileSize * 3, this.tileSize * 3);
    const oceanMaterial = new THREE.MeshPhongMaterial({
      color: 0x001933,
      side: THREE.DoubleSide,
    });
    this.ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
    this.ocean.rotation.x = Math.PI / 2;
    this.ocean.position.y = -1;
    scene.add(this.ocean);
  }

  createSky(scene) {
    // Create gradient sky using a large sphere
    const skyGeometry = new THREE.SphereGeometry(50000, 32, 32);
    const vertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      varying vec3 vWorldPosition;
      void main() {
        float y = normalize(vWorldPosition).y;
        vec3 skyTop = vec3(0.3, 0.6, 1.0);    // Light blue
        vec3 skyBottom = vec3(0.6, 0.8, 1.0);  // Lighter blue
        vec3 finalColor = mix(skyBottom, skyTop, max(0.0, y));
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const skyMaterial = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      side: THREE.BackSide,
    });

    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(sky);
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
      return cloudGroup;
    };

    // Create clouds at different heights and positions
    this.clouds = [];
    for (let i = 0; i < 100; i++) {
      const x = (Math.random() - 0.5) * 10000;
      const y = 300 + Math.random() * 200;
      const z = (Math.random() - 0.5) * 10000;
      const scale = 0.5 + Math.random() * 1.5;
      const cloud = createCloud(x, y, z, scale);
      this.clouds.push(cloud);
    }
  }

  createDistantLandmarks() {
    // Create large city clusters that will be visible from far away
    for (let i = 0; i < 20; i++) {
      const distance = 10000 + Math.random() * 20000; // 10-30km away
      const angle = Math.random() * Math.PI * 2;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;

      this.createCityCluster(x, z);
    }
  }

  createCityCluster(x, z) {
    const group = new THREE.Group();
    const buildingCount = 10 + Math.random() * 20;
    const clusterRadius = 500;

    // Create tall buildings for the cluster
    for (let i = 0; i < buildingCount; i++) {
      const height = 100 + Math.random() * 400; // Much taller buildings
      const width = 50 + Math.random() * 100;

      const buildingGeometry = new THREE.BoxGeometry(width, height, width);
      const buildingMaterial = new THREE.MeshPhongMaterial({
        color: 0x808080,
        fog: true, // Enable fog for distance fading
      });

      const building = new THREE.Mesh(buildingGeometry, buildingMaterial);

      // Position within cluster
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * clusterRadius;
      building.position.set(x + Math.cos(angle) * radius, height / 2, z + Math.sin(angle) * radius);

      group.add(building);
    }

    this.scene.add(group);
    const key = `${Math.floor(x / 1000)},${Math.floor(z / 1000)}`;
    this.distantLandmarks.set(key, group);
  }

  createMainAirport() {
    // Main runway
    const runwayLength = 200;
    const runwayWidth = 50;
    const runwayGeometry = new THREE.PlaneGeometry(runwayWidth, runwayLength);
    const runwayMaterial = new THREE.MeshPhongMaterial({
      color: 0x333333,
      side: THREE.DoubleSide,
    });
    const runway = new THREE.Mesh(runwayGeometry, runwayMaterial);
    runway.rotation.x = Math.PI / 2;
    runway.position.y = 0.1; // Slightly above ground
    this.scene.add(runway);

    // Runway center lines
    for (let i = -80; i <= 80; i += 40) {
      const lineGeometry = new THREE.PlaneGeometry(1, 20);
      const lineMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
      });
      const line = new THREE.Mesh(lineGeometry, lineMaterial);
      line.rotation.x = Math.PI / 2;
      line.position.set(0, 0.2, i);
      this.scene.add(line);
    }

    // Main terminal building
    const terminalGeometry = new THREE.BoxGeometry(50, 15, 20);
    const terminalMaterial = new THREE.MeshPhongMaterial({
      color: 0xcccccc,
    });
    const terminal = new THREE.Mesh(terminalGeometry, terminalMaterial);
    terminal.position.set(50, 7.5, 0);
    this.scene.add(terminal);
    terminal.boundingSphere = new THREE.Sphere(terminal.position.clone(), 25);
    this.obstacles.push(terminal);

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

    this.scene.add(towerBase);
    this.scene.add(towerTop);

    towerBase.boundingSphere = new THREE.Sphere(
      towerBase.position.clone(),
      Math.max(towerBase.geometry.parameters.height, towerBase.geometry.parameters.radius) * 1.5
    );
    this.obstacles.push(towerBase);

    // Create initial ground around airport
    const airportGroundGeometry = new THREE.CircleGeometry(300, 64);
    const groundMaterial = new THREE.MeshPhongMaterial({
      color: 0x2d5a27,
      side: THREE.DoubleSide,
    });
    const airportGround = new THREE.Mesh(airportGroundGeometry, groundMaterial);
    airportGround.rotation.x = Math.PI / 2;
    airportGround.position.y = 0;
    this.scene.add(airportGround);
  }

  update(airplane) {
    // Update visible tiles based on airplane position
    this.updateTiles(airplane.container.position);

    // Update ocean position to follow airplane
    this.ocean.position.x = airplane.container.position.x;
    this.ocean.position.z = airplane.container.position.z;

    // Slowly rotate clouds
    if (this.clouds) {
      this.clouds.forEach((cloud) => {
        cloud.rotation.y += 0.0001;
      });
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
