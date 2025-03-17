// Import dependencies
import * as THREE from 'three';

// Import our modules
import { KEYS, FLIGHT_PARAMS } from './constants.js';
import { Controls } from './controls.js';
import { Environment } from './environment.js';
import { Airplane } from './airplane.js';
import { MobileControls } from './mobileControls.js';

// Make THREE available globally for other modules
window.THREE = THREE;

// Global variables
let scene, camera, renderer, controls, mobileControls, airplane, environment;
let isMobileDevice; // Single determination of device type

// Performance monitoring
let lastFrameTime = 0;
let frameCount = 0;
let lastFpsUpdate = 0;
let currentFps = 0;

// Function to detect mobile devices - called only once at initialization
function detectMobileDevice() {
  // Check for Chrome's device emulation mode
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;

  // Check for mobile device in user agent
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isMobileUserAgent = mobileRegex.test(userAgent);

  // Check for touch capabilities (Chrome emulation adds touch capabilities)
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0);

  // Check for mobile-specific features
  const hasOrientationChange = typeof window.orientation !== 'undefined';

  // Check for small screen size (common in mobile devices and emulation)
  const hasSmallScreen = window.innerWidth < 800;

  // Determine if this is a mobile device with a weighted approach
  // User agent is the strongest signal, especially in Chrome emulation
  if (isMobileUserAgent) return true;

  // If screen is small AND has touch capabilities, likely mobile or emulation
  if (hasSmallScreen && hasTouchScreen) return true;

  // If has orientation change (very specific to mobile), likely mobile
  if (hasOrientationChange) return true;

  return false;
}

// Setup mobile-specific UI adjustments
function setupMobileUI(isMobile) {
  const controlsSection = document.querySelector('.controls-section');
  const infoBox = document.getElementById('info-box');
  const readouts = document.querySelectorAll('.readout');

  // Add FPS counter
  const fpsCounter = document.createElement('div');
  fpsCounter.id = 'fps-counter';
  fpsCounter.style.position = 'fixed';
  fpsCounter.style.top = '10px';
  fpsCounter.style.right = '10px';
  fpsCounter.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  fpsCounter.style.color = 'white';
  fpsCounter.style.padding = '5px 10px';
  fpsCounter.style.borderRadius = '5px';
  fpsCounter.style.fontSize = '12px';
  fpsCounter.style.zIndex = '1000';
  document.body.appendChild(fpsCounter);

  if (controlsSection) {
    controlsSection.style.display = isMobile ? 'none' : 'block';
  }

  if (infoBox) {
    if (isMobile) {
      infoBox.classList.add('mobile-info');
      // Add mobile-primary class to important readouts
      readouts.forEach((readout) => {
        const label = readout.querySelector('.label');
        if (label && (label.textContent.includes('Altitude') || label.textContent.includes('Speed') || label.textContent.includes('Heading'))) {
          readout.classList.add('mobile-primary');
        }
      });
    } else {
      infoBox.classList.remove('mobile-info');
      // Remove mobile-primary class from all readouts
      readouts.forEach((readout) => {
        readout.classList.remove('mobile-primary');
      });
    }
  }
}

// Initialize the application
async function init() {
  try {
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
    if (!infoBox) {
      // Info box not found
    } else {
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
      if (!readouts) {
        // Readouts not found
      } else {
        Object.assign(readouts.style, {
          fontSize: '14px',
          marginBottom: '10px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
          paddingBottom: '10px',
        });
      }

      // And the hint text
      const hint = document.querySelector('.hint');
      if (!hint) {
        // Hint not found
      } else {
        Object.assign(hint.style, {
          fontSize: '10px',
          color: '#aaa',
        });
      }

      // Make sure controls content starts hidden
      const controlsContent = document.querySelector('.controls-content');
      if (!controlsContent) {
        // Controls content not found
      } else {
        Object.assign(controlsContent.style, {
          display: 'none',
          marginTop: '10px',
        });
      }
    }

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

    // Detect device type ONCE at initialization
    isMobileDevice = detectMobileDevice();

    // Setup mobile UI
    setupMobileUI(isMobileDevice);

    // Initialize controls based on device type
    if (isMobileDevice) {
      try {
        mobileControls = new MobileControls(airplane);
      } catch (error) {
        // Fallback to keyboard controls if mobile controls fail
        controls = new Controls(airplane);
      }
    } else {
      controls = new Controls(airplane);
    }

    // Handle window resize - only for camera and renderer, not for device detection
    window.addEventListener('resize', onWindowResize, false);

    // Add touch event listeners to prevent default behaviors that might interfere with controls
    document.addEventListener(
      'touchmove',
      function (e) {
        if (e.target.id === 'thrust-handle' || e.target.closest('#right-joystick')) {
          e.preventDefault();
        }
      },
      { passive: false }
    );

    lastFrameTime = performance.now();
    lastFpsUpdate = performance.now();

    // Start animation loop
    animate();
  } catch (error) {
    // Silent fail
  }
}

// Handle window resize - simplified to only update camera and renderer
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
  const now = performance.now();
  const deltaTime = now - lastFrameTime;

  lastFrameTime = now;
  frameCount++;

  // Update FPS counter every second
  if (now - lastFpsUpdate > 1000) {
    currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
    const fpsCounter = document.getElementById('fps-counter');
    if (fpsCounter) {
      fpsCounter.textContent = `FPS: ${currentFps}`;
      fpsCounter.style.color = currentFps < 30 ? 'red' : 'white';
    }
    frameCount = 0;
    lastFpsUpdate = now;
  }

  requestAnimationFrame(animate);

  try {
    // Update airplane and controls
    airplane.update();

    if (controls) {
      controls.update();
    }

    if (mobileControls) {
      mobileControls.update();
    }

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

    // Update info box
    updateInfoBox();

    // Render scene
    renderer.render(scene, camera);
  } catch (error) {
    // Silent fail
  }
}

function handleCollision() {
  // Reset airplane position with correct orientation
  airplane.container.position.set(0, FLIGHT_PARAMS.INITIAL_ALTITUDE, 0);
  airplane.velocity.set(0, 0, 0);
  airplane.setThrust(0, false);
  airplane.targetThrust = 0; // Explicitly reset target thrust
  airplane.thrust = 0; // Explicitly reset current thrust
  airplane.rollAngle = 0;
  airplane.container.rotation.set(0, Math.PI, 0);

  // Reset thrust slider position if it exists
  if (mobileControls && mobileControls.thrustHandle) {
    mobileControls.thrustHandle.style.bottom = '0px';
    mobileControls.thrustHandle.style.transition = 'bottom 0.2s';
  }
}

init();

// Support for hot module replacement
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    // HMR update for main.js
  });
}
