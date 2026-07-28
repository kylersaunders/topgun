import * as THREE from 'three';

import { FLIGHT_PARAMS } from './constants.js';
import { Controls } from './controls.js';
import { Environment } from './environment.js';
import { Airplane } from './airplane.js';
import { MobileControls } from './mobileControls.js';
import { ChaseCamera } from './camera.js';
import { Weapons } from './weapons.js';
import { EnemyManager } from './enemies.js';
import { Wildlife } from './wildlife.js';
import { BogeyMarkers } from './hud.js';

// environment.js reaches for THREE off the window.
window.THREE = THREE;

let scene, camera, renderer, chaseCamera;
let controls, mobileControls, airplane, environment;
let weapons, enemies, wildlife, bogeyMarkers;
let isMobileDevice;
let groundHeightAt;

// Every live target the lasers can hit, rebuilt in place each frame.
const targets = [];

// Timing
let lastFrameTime = 0;
let frameCount = 0;
let lastFpsUpdate = 0;
let currentFps = 0;

// Longest frame the physics will simulate at once. Alt-tab away and come back
// and this stops the plane teleporting halfway across the map.
const MAX_DELTA = 0.05;

function detectMobileDevice() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  if (mobileRegex.test(userAgent)) return true;

  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0);
  if (window.innerWidth < 800 && hasTouchScreen) return true;
  if (typeof window.orientation !== 'undefined') return true;

  return false;
}

function setupMobileUI(isMobile) {
  const controlsSection = document.querySelector('.controls-section');
  const infoBox = document.getElementById('info-box');
  const readouts = document.querySelectorAll('.readouts div');

  const fpsCounter = document.createElement('div');
  fpsCounter.id = 'fps-counter';
  document.body.appendChild(fpsCounter);

  if (controlsSection) {
    controlsSection.style.display = isMobile ? 'none' : 'block';
  }

  if (infoBox) {
    if (isMobile) {
      infoBox.classList.add('mobile-info');
      readouts.forEach((readout) => {
        if (['altitude-display', 'speed-display', 'thrust-display', 'roll-display'].includes(readout.id)) {
          readout.classList.add('mobile-primary');
        }
      });
    } else {
      infoBox.classList.remove('mobile-info');
      readouts.forEach((readout) => readout.classList.remove('mobile-primary'));
    }
  }
}

async function init() {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x9dc4ee, 3000, 26000);

  camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 100000);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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
  document.body.insertBefore(canvas, document.body.firstChild);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.85);
  directionalLight.position.set(200, 500, 300);
  scene.add(directionalLight);

  environment = new Environment(scene);
  groundHeightAt = (x, z) => environment.heightAt(x, z);

  airplane = new Airplane(scene);
  environment.initializeCities();

  chaseCamera = new ChaseCamera(camera, airplane);
  weapons = new Weapons(scene);
  enemies = new EnemyManager(scene);
  wildlife = new Wildlife(scene, environment);
  bogeyMarkers = new BogeyMarkers(enemies.enemies.length);

  isMobileDevice = detectMobileDevice();
  setupMobileUI(isMobileDevice);

  if (isMobileDevice) {
    try {
      mobileControls = new MobileControls(airplane);
    } catch (error) {
      controls = new Controls(airplane);
    }
  } else {
    controls = new Controls(airplane);
  }

  window.addEventListener('resize', onWindowResize, false);

  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.target.id === 'thrust-handle' || e.target.closest('#right-joystick')) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  lastFrameTime = performance.now();
  lastFpsUpdate = lastFrameTime;

  animate();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateInfoBox() {
  const altitude = Math.round(airplane.container.position.y);
  const x = Math.round(airplane.container.position.x);
  const z = Math.round(airplane.container.position.z);
  const speed = Math.round(airplane.speed * FLIGHT_PARAMS.KMH_PER_UNIT);
  const thrust = Math.round(airplane.thrust * 100);
  const heading = Math.round((((airplane.heading * 180) / Math.PI + 360) % 360));
  const lift = Math.round(airplane.support * 100);
  const pitch = Math.round((airplane.pitchAngle * 180) / Math.PI);
  const roll = Math.round((airplane.rollAngle * 180) / Math.PI);

  setText('altitude-display', `Altitude: ${altitude}m`);
  setText('position-display', `Position: (${x},${z})`);
  setText('speed-display', `Speed: ${speed}km/h`);
  setText('lift-display', `Lift: ${lift}%`);
  setText('thrust-display', `Thrust: ${thrust}%`);
  setText('heading-display', `Heading: ${heading}°`);
  setText('pitch-display', `Pitch: ${pitch}°`);
  setText('roll-display', `Roll: ${roll}°`);
  setText('rudder-display', `Rudder: ${Math.round(airplane.rudderAngle)}°`);
  setText('kills-display', `Kills: ${enemies.kills}`);

  // Range to the nearest bogey, so they can actually be hunted down.
  const nearest = nearestBogeyDistance();
  setText('bogeys-display', nearest === null ? `Bogeys: ${enemies.aliveCount}` : `Bogeys: ${enemies.aliveCount} @ ${nearest}m`);

  // Stall warning keys off airspeed, not attitude — you can be pointed steeply
  // uphill and still be flying perfectly well at 900km/h.
  const stallWarning = document.getElementById('stall-warning');
  if (stallWarning) {
    const stalling = !airplane.onGround && airplane.speed < FLIGHT_PARAMS.STALL_SPEED * 1.15;
    stallWarning.classList.toggle('visible', stalling);
  }
}

function nearestBogeyDistance() {
  let best = Infinity;
  for (const enemy of enemies.enemies) {
    if (!enemy.alive) continue;
    best = Math.min(best, enemy.container.position.distanceTo(airplane.container.position));
  }
  return best === Infinity ? null : Math.round(best);
}

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastFrameTime) / 1000, MAX_DELTA);
  lastFrameTime = now;
  frameCount++;

  if (now - lastFpsUpdate > 1000) {
    currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
    const fpsCounter = document.getElementById('fps-counter');
    if (fpsCounter) {
      fpsCounter.textContent = `FPS: ${currentFps}`;
      fpsCounter.style.color = currentFps < 30 ? '#ff6b6b' : '#ffffff';
    }
    frameCount = 0;
    lastFpsUpdate = now;
  }

  if (dt <= 0) return;

  // --- Input ------------------------------------------------------------
  let wantsToFire = false;
  if (controls) {
    controls.update(dt);
    wantsToFire = controls.firing;
  }
  if (mobileControls) {
    mobileControls.update(dt);
    wantsToFire = mobileControls.firing;
  }

  // --- Simulation -------------------------------------------------------
  const crashesBefore = airplane.crashes;
  airplane.update(dt, groundHeightAt);
  if (airplane.crashes !== crashesBefore) {
    onCrash();
  }

  environment.update(airplane);
  enemies.update(dt, airplane.container.position);
  wildlife.update(dt, airplane.container.position);
  weapons.update(dt, airplane, wantsToFire);

  targets.length = 0;
  for (const target of enemies.getTargets()) targets.push(target);
  wildlife.collectTargets(targets);
  weapons.collide(targets);

  // Hitting a building still resets you.
  if (environment.checkCollisions(airplane)) {
    airplane.crash();
    onCrash();
  }

  // --- Present ----------------------------------------------------------
  chaseCamera.update(dt, groundHeightAt);
  camera.updateMatrixWorld(); // markers project against this frame's camera
  bogeyMarkers.update(camera, enemies.enemies, airplane.container.position);
  updateInfoBox();
  renderer.render(scene, camera);
}

function onCrash() {
  chaseCamera.reset();

  if (mobileControls && mobileControls.thrustHandle) {
    mobileControls.thrustHandle.style.bottom = '0px';
    mobileControls.thrustHandle.style.transition = 'bottom 0.2s';
  }

  const flash = document.getElementById('crash-flash');
  if (flash) {
    flash.classList.remove('flash');
    void flash.offsetWidth; // restart the CSS animation
    flash.classList.add('flash');
  }
}

init();

if (import.meta.hot) {
  import.meta.hot.accept();
}
