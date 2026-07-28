import * as THREE from 'three';
import { CAMERA_PARAMS, WEAPON_PARAMS } from './constants.js';
import { smoothing } from './airplane.js';

// Chase camera.
//
// The old version aimed with camera.lookAt while leaving camera.up at world +Y,
// so the horizon sheared sideways in a bank instead of the world rolling around
// you. It also rebuilt its "lagging" look target from camera.getWorldDirection()
// — a unit vector — every frame, which carried no state and so smoothed nothing.
//
// This version keeps a genuinely persistent smoothed orientation, derives both
// the camera's position and its up-vector from it, and lags on a time constant
// so the feel is identical at any frame rate.
export class ChaseCamera {
  constructor(camera, airplane) {
    this.camera = camera;
    this.airplane = airplane;

    this.smoothedQuat = airplane.container.quaternion.clone();
    this.lookTarget = new THREE.Vector3();

    this._offset = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._forward = new THREE.Vector3();

    camera.position.copy(airplane.container.position);
    camera.fov = CAMERA_PARAMS.BASE_FOV;
    camera.updateProjectionMatrix();
  }

  update(dt, groundHeightAt) {
    const plane = this.airplane;

    // One persistent orientation that trails the plane. Everything else is
    // derived from it, so position, roll and aim can never disagree.
    this.smoothedQuat.slerp(plane.container.quaternion, smoothing(CAMERA_PARAMS.ROTATION_LAG, dt));

    // Sit behind and above the plane, in the smoothed frame.
    this._offset.set(CAMERA_PARAMS.OFFSET.x, CAMERA_PARAMS.OFFSET.y, CAMERA_PARAMS.OFFSET.z).applyQuaternion(this.smoothedQuat);
    this._desired.copy(plane.container.position).add(this._offset);

    // Don't let the chase position sink through a hill.
    if (groundHeightAt) {
      const floor = groundHeightAt(this._desired.x, this._desired.z) + 3;
      if (this._desired.y < floor) this._desired.y = floor;
    }

    this.camera.position.lerp(this._desired, smoothing(CAMERA_PARAMS.POSITION_LAG, dt));

    // Roll the camera with the plane. This is what makes a bank read as the
    // world rotating around you rather than the horizon sliding sideways.
    this._up.set(0, 1, 0).applyQuaternion(this.smoothedQuat);
    this.camera.up.copy(this._up);

    // Aim at the point where the wing guns converge. Screen centre is then
    // exactly where the shots cross, so the crosshair never lies — and because
    // that point is far away, the jet itself sits low in frame instead of
    // sitting on top of the gunsight.
    this._forward.set(0, 0, 1).applyQuaternion(plane.container.quaternion);
    this.lookTarget.copy(plane.container.position).addScaledVector(this._forward, WEAPON_PARAMS.CONVERGENCE);
    this.camera.lookAt(this.lookTarget);

    // Widen the lens with speed for a sense of acceleration.
    const speedRatio = Math.min(1, plane.speed / 70);
    const targetFov = CAMERA_PARAMS.BASE_FOV + CAMERA_PARAMS.SPEED_FOV * speedRatio * speedRatio;
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov += (targetFov - this.camera.fov) * smoothing(2.5, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  reset() {
    this.smoothedQuat.copy(this.airplane.container.quaternion);
  }
}
