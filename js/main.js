let scene, camera, renderer, airplane, controls, environment;

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

  // Check for collisions
  const collision = environment.checkCollisions(airplane);
  if (collision) {
    handleCollision();
  }

  // Update camera position to follow airplane
  camera.position.x = airplane.container.position.x - 20 * Math.sin(airplane.container.rotation.y);
  camera.position.z = airplane.container.position.z - 20 * Math.cos(airplane.container.rotation.y);
  camera.position.y = airplane.container.position.y + 10;
  camera.lookAt(airplane.container.position);

  renderer.render(scene, camera);
}

function handleCollision() {
  // Reset airplane position
  airplane.container.position.set(0, FLIGHT_PARAMS.INITIAL_ALTITUDE, 0);
  airplane.velocity.set(0, 0, 0);
  airplane.thrust = 0;
  airplane.rollAngle = 0;
  airplane.container.rotation.set(-Math.PI / 2, -Math.PI / 2, 0);
  airplane.mesh.rotation.set(Math.PI / 2, -Math.PI / 2, 0);
}

init();
animate();
