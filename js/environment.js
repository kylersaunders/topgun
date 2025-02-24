class Environment {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = [];
    this.distantLandmarks = new Map();

    // Fixed map size
    this.mapSize = 20000;
    this.waterLevel = 0;

    // Create initial environment
    this.createSky(scene);
    this.createTerrain();
    this.createMainAirport();
    this.createClouds(scene);
  }

  createTerrain() {
    // Increase terrain resolution for better detail
    const geometry = new THREE.PlaneGeometry(this.mapSize, this.mapSize, 400, 400);
    geometry.rotateX(-Math.PI / 2);

    // Create straight coastline with beach transition
    const vertices = geometry.attributes.position.array;
    const beachStart = this.mapSize * 0.33;
    const beachWidth = 1000;

    // Define airport area
    const airportRadius = 1500; // Flat area around airport
    const airportTransition = 500; // Smooth transition to terrain

    // Smoother noise function
    const smoothNoise = (x, z) => {
      const scale = 0.0002;
      x *= scale;
      z *= scale;
      return Math.sin(x) * Math.cos(z * 0.5) * 50 + Math.sin(x * 2.1 + z * 1.4) * 25 + Math.sin(x * 4.1 + z * 2.4) * 12.5;
    };

    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const z = vertices[i + 2];

      // Calculate distance from center for airport flattening
      const distanceFromCenter = Math.sqrt(x * x + z * z);

      // Add terrain variation using smooth noise
      const noise = smoothNoise(x, z);

      // Determine terrain type and height based on X position
      let height;
      if (x > beachStart + beachWidth) {
        // Ocean with gentle waves
        height = -2 + noise * 0.02;
      } else if (x > beachStart) {
        // Beach - gradual slope with subtle variation
        const t = (beachStart + beachWidth - x) / beachWidth;
        height = -2 + 3 * t + noise * 0.05 * t;
      } else {
        // Land with rolling hills
        height = noise * 0.3;
      }

      // Flatten airport area with smooth transition
      if (distanceFromCenter < airportRadius) {
        // Completely flat in airport area
        vertices[i + 1] = 0;
      } else if (distanceFromCenter < airportRadius + airportTransition) {
        // Smooth transition to terrain
        const t = (distanceFromCenter - airportRadius) / airportTransition;
        const smoothT = t * t * (3 - 2 * t); // Smooth step function
        vertices[i + 1] = height * smoothT;
      } else {
        // Normal terrain height
        vertices[i + 1] = height;
      }
    }

    geometry.computeVertexNormals();

    // Create single terrain with shader material
    const vertexShader = `
      varying vec3 vWorldPosition;
      varying float vHeight;
      
      void main() {
        vHeight = position.y;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      varying vec3 vWorldPosition;
      varying float vHeight;
      
      void main() {
        vec3 ocean = vec3(0.0, 0.1, 0.2);
        vec3 beach = vec3(0.824, 0.706, 0.549);
        vec3 land = vec3(0.176, 0.353, 0.153);
        
        // Use world position X for terrain type
        float x = vWorldPosition.x;
        float beachStart = ${beachStart.toFixed(1)};
        float beachWidth = ${beachWidth.toFixed(1)};
        
        vec3 color;
        if (x > beachStart + beachWidth) {
          color = ocean;
        } else if (x > beachStart) {
          float t = (beachStart + beachWidth - x) / beachWidth;
          color = mix(ocean, beach, t);
        } else {
          color = land;
        }
        
        // Add some height-based variation
        if (vHeight > -1.0) {
          color = mix(color, vec3(color.rgb * 1.2), vHeight * 0.2);
        }
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const terrainMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      side: THREE.DoubleSide,
    });

    this.terrain = new THREE.Mesh(geometry, terrainMaterial);
    this.scene.add(this.terrain);
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
    // Main runway - much longer now
    const runwayLength = 2000;
    const runwayWidth = 50;
    const runwayGeometry = new THREE.PlaneGeometry(runwayWidth, runwayLength);
    const runwayMaterial = new THREE.MeshPhongMaterial({
      color: 0x333333,
      side: THREE.DoubleSide,
    });
    const runway = new THREE.Mesh(runwayGeometry, runwayMaterial);
    runway.rotation.x = Math.PI / 2;
    runway.position.y = 0.1;

    // Add wider asphalt area around runway
    const asphaltWidth = runwayWidth * 2;
    const asphaltGeometry = new THREE.PlaneGeometry(asphaltWidth, runwayLength);
    const asphaltMaterial = new THREE.MeshPhongMaterial({
      color: 0x1a1a1a,
      side: THREE.DoubleSide,
    });
    const asphalt = new THREE.Mesh(asphaltGeometry, asphaltMaterial);
    asphalt.rotation.x = Math.PI / 2;
    asphalt.position.y = 0.05;

    // Create line geometry and material once
    const lineGeometry = new THREE.PlaneGeometry(1, 20);
    const lineMaterial = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });

    // Position the airport at the center of the map
    const airportX = 0;
    const runwayStart = -25; // Match our starting position

    // Move runway and asphalt to extend forward into positive Z
    runway.position.x = airportX;
    runway.position.z = runwayStart; // Start at our position
    asphalt.position.x = airportX;
    asphalt.position.z = runwayStart;

    this.scene.add(asphalt);
    this.scene.add(runway);

    // Create and position runway lines extending forward
    const lineSpacing = 40;
    const lineCount = Math.floor(runwayLength / lineSpacing);
    for (let i = 0; i < lineCount; i++) {
      const line = new THREE.Mesh(lineGeometry, lineMaterial);
      line.rotation.x = Math.PI / 2;
      // Start lines at runwayStart and extend forward through the runway length
      const lineZ = runwayStart + runwayLength * (i / lineCount); // Distribute lines evenly across runway length
      line.position.set(airportX, 0.2, lineZ);
      this.scene.add(line);
    }

    // Create and position buildings
    const terminal = new THREE.Mesh(new THREE.BoxGeometry(50, 15, 20), new THREE.MeshPhongMaterial({ color: 0xcccccc }));
    terminal.position.set(airportX + 50, 7.5, runwayStart);
    this.scene.add(terminal);
    terminal.boundingSphere = new THREE.Sphere(terminal.position.clone(), 25);
    this.obstacles.push(terminal);

    const towerBaseGeometry = new THREE.CylinderGeometry(3, 3, 25, 8);
    const towerTopGeometry = new THREE.CylinderGeometry(6, 6, 8, 8);
    const towerMaterial = new THREE.MeshPhongMaterial({ color: 0xdddddd });

    const towerBase = new THREE.Mesh(towerBaseGeometry, towerMaterial);
    const towerTop = new THREE.Mesh(towerTopGeometry, towerMaterial);

    towerBase.position.set(airportX + 60, 12.5, runwayStart + 20);
    towerTop.position.set(airportX + 60, 29, runwayStart + 20);

    this.scene.add(towerBase);
    this.scene.add(towerTop);

    towerBase.boundingSphere = new THREE.Sphere(
      towerBase.position.clone(),
      Math.max(towerBase.geometry.parameters.height, towerBase.geometry.parameters.radius) * 1.5
    );
    this.obstacles.push(towerBase);
  }

  update(airplane) {
    // Update clouds
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

  // Move city cluster creation to after airplane is initialized
  initializeCities() {
    // Create large city clusters that will be visible from far away
    for (let i = 0; i < 20; i++) {
      const distance = 10000 + Math.random() * 20000; // 10-30km away
      const angle = Math.random() * Math.PI * 2;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;

      this.createCityCluster(x, z);
    }
  }
}
