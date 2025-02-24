let scene, camera, renderer, airplane, controls, mobileControls, environment;

function init() {
  // Create scene
  scene = new THREE.Scene();

  // Create camera with much larger far clipping plane
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    100000 // Increased from 1000 to see our large terrain
  );
  camera.position.set(0, 10, 20);

  // Create renderer
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Apply critical styles to canvas
  const canvas = renderer.domElement;
  Object.assign(canvas.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    margin: '0',
    padding: '0',
    zIndex: '1',
  });

  // Apply critical styles to body
  Object.assign(document.body.style, {
    margin: '0',
    padding: '0',
    overflow: 'hidden',
  });

  // Ensure info-box is above canvas and visible
  const infoBox = document.getElementById('info-box');
  Object.assign(infoBox.style, {
    position: 'fixed',
    top: '20px',
    left: '20px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    padding: '15px',
    borderRadius: '5px',
    fontFamily: 'monospace',
    minWidth: '150px',
    zIndex: '2',
  });

  // Also ensure the readouts are visible
  const readouts = document.querySelector('.readouts');
  Object.assign(readouts.style, {
    fontSize: '14px',
    marginBottom: '10px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
    paddingBottom: '10px',
  });

  // And the hint text
  const hint = document.querySelector('.hint');
  Object.assign(hint.style, {
    fontSize: '10px',
    color: '#aaa',
  });

  // Make sure controls content starts hidden
  const controlsContent = document.querySelector('.controls-content');
  Object.assign(controlsContent.style, {
    display: 'none',
    marginTop: '10px',
  });

  document.body.insertBefore(canvas, document.body.firstChild);

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(200, 500, 300);
  scene.add(directionalLight);

  // Create environment (store the instance)
  environment = new Environment(scene);

  // Create airplane
  airplane = new Airplane(scene);

  // Initialize cities after airplane exists
  environment.initializeCities();

  // Setup controls
  controls = new Controls(airplane);
  mobileControls = new MobileControls(airplane);

  // Handle window resize
  window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateInfoBox() {
  // Get the info elements
  const altitudeDisplay = document.getElementById('altitude-display');
  const positionDisplay = document.getElementById('position-display');
  const speedDisplay = document.getElementById('speed-display');
  const liftDisplay = document.getElementById('lift-display');
  const thrustDisplay = document.getElementById('thrust-display');
  const headingDisplay = document.getElementById('heading-display');
  const pitchDisplay = document.getElementById('pitch-display');
  const rollDisplay = document.getElementById('roll-display');
  const rudderDisplay = document.getElementById('rudder-display');

  // Calculate values
  const altitude = Math.round(airplane.container.position.y);
  const position = {
    x: Math.round(airplane.container.position.x),
    z: Math.round(airplane.container.position.z),
  };
  const speed = Math.min(Math.round(airplane.getForwardSpeed() * 1000), 1111);
  const thrust = Math.round(airplane.thrust * 100);
  const heading = Math.round(((airplane.container.rotation.y % (Math.PI * 2)) * (180 / Math.PI) + 360) % 360);
  const lift = Math.round(airplane.totalLift * 100);

  // Calculate pitch in degrees (-90 to 90), inverted to make up positive
  const pitchDegrees = Math.round(-airplane.container.rotation.x * (180 / Math.PI));

  // Calculate roll using the same method from the turn calculation
  const rollMatrix = new THREE.Matrix4();
  rollMatrix.extractRotation(airplane.container.matrix);
  const rightVector = new THREE.Vector3(1, 0, 0);
  rightVector.applyMatrix4(rollMatrix);
  const rollDegrees = Math.round(Math.asin(rightVector.y) * (180 / Math.PI));

  // Get rudder angle directly from airplane
  const rudderDegrees = Math.round(airplane.rudderAngle);

  // Update displays
  altitudeDisplay.textContent = `Altitude: ${altitude}m`;
  positionDisplay.textContent = `Position: (${position.x},${position.z})`;
  speedDisplay.textContent = `Speed: ${speed}km/h`;
  liftDisplay.textContent = `Lift: ${lift}%`;
  thrustDisplay.textContent = `Thrust: ${thrust}%`;
  headingDisplay.textContent = `Heading: ${heading}°`;
  pitchDisplay.textContent = `Pitch: ${pitchDegrees}°`;
  rollDisplay.textContent = `Roll: ${rollDegrees}°`;
  rudderDisplay.textContent = `Rudder: ${rudderDegrees}°`;
}

function animate() {
  requestAnimationFrame(animate);

  // Update airplane and controls
  airplane.update();
  controls.update();
  if (mobileControls) mobileControls.update();

  // Update environment
  environment.update(airplane);

  // Check for collisions
  const collision = environment.checkCollisions(airplane);
  if (collision) {
    handleCollision();
  }

  // Update camera position to follow airplane with improved height control
  const cameraOffset = new THREE.Vector3(0, 3, -12); // Closer to plane, slightly lower
  cameraOffset.applyQuaternion(airplane.container.quaternion);

  // Calculate target camera position
  const targetCameraPos = new THREE.Vector3().copy(airplane.container.position).add(cameraOffset);

  // Ensure minimum camera height
  const minCameraHeight = 4;
  targetCameraPos.y = Math.max(targetCameraPos.y, minCameraHeight);

  // Smoothly adjust camera height when plane is low
  if (airplane.container.position.y < 10) {
    const heightAdjustment = (10 - airplane.container.position.y) * 0.5;
    targetCameraPos.y += heightAdjustment;
  }

  // Smoothly interpolate camera position with less lag
  camera.position.lerp(targetCameraPos, 0.15); // Increased lerp factor for less lag

  // Create a lagging look target
  const targetLookPoint = airplane.container.position.clone();
  const lookAheadOffset = new THREE.Vector3(0, 0, 5); // Look ahead point closer to plane
  lookAheadOffset.applyQuaternion(airplane.container.quaternion);
  targetLookPoint.add(lookAheadOffset);

  // Smoothly interpolate where the camera is looking with less lag
  const currentLookPoint = new THREE.Vector3();
  currentLookPoint.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()));
  currentLookPoint.lerp(targetLookPoint, 0.15); // Increased lerp factor for less lag

  camera.lookAt(currentLookPoint);

  updateInfoBox();

  renderer.render(scene, camera);
}

function handleCollision() {
  // Reset airplane position with correct orientation
  airplane.container.position.set(0, FLIGHT_PARAMS.INITIAL_ALTITUDE, 0);
  airplane.velocity.set(0, 0, 0);
  airplane.setThrust(0, false);
  airplane.rollAngle = 0;
  airplane.container.rotation.set(0, Math.PI, 0);
}

init();
animate();
