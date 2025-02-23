let scene, camera, renderer, airplane, controls, mobileControls, environment;

function init() {
  // Create scene
  scene = new THREE.Scene();

  // Create camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 10, 20);

  // Create renderer
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

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

  // Update camera position to follow airplane - fixing camera follow
  const cameraOffset = new THREE.Vector3(0, 5, -20); // Negative Z to position behind, reduced Y height
  cameraOffset.applyQuaternion(airplane.container.quaternion);

  camera.position.copy(airplane.container.position).add(cameraOffset); // Changed sub to add since we made Z negative
  camera.lookAt(airplane.container.position);

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
