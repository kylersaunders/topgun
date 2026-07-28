import * as THREE from 'three';

// Tracking boxes over each live bogey, with edge arrows for the ones behind or
// off to the side. Without these the enemies are a few red pixels against the
// terrain and effectively impossible to find.
export class BogeyMarkers {
  constructor(maxMarkers) {
    this.container = document.createElement('div');
    this.container.id = 'bogey-markers';
    document.body.appendChild(this.container);

    this.markers = [];
    for (let i = 0; i < maxMarkers; i++) {
      const element = document.createElement('div');
      element.className = 'bogey-marker';
      element.innerHTML = '<span class="box"></span><span class="range"></span>';
      element.style.display = 'none';
      this.container.appendChild(element);
      this.markers.push({ element, range: element.querySelector('.range') });
    }

    this._projected = new THREE.Vector3();
  }

  update(camera, enemies, playerPosition) {
    const halfWidth = window.innerWidth / 2;
    const halfHeight = window.innerHeight / 2;
    const margin = 34;

    let used = 0;

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      const marker = this.markers[used];
      if (!marker) break;
      used++;

      this._projected.copy(enemy.container.position).project(camera);

      // project() mirrors anything behind the camera through the origin, so
      // flip it back and force it to the edge rather than drawing it inverted.
      const behind = this._projected.z > 1;
      if (behind) {
        this._projected.x *= -1;
        this._projected.y *= -1;
      }

      let x = this._projected.x * halfWidth;
      let y = -this._projected.y * halfHeight;

      const offScreen = behind || Math.abs(x) > halfWidth - margin || Math.abs(y) > halfHeight - margin;
      if (offScreen) {
        // Clamp onto the screen edge along the same bearing.
        const scale = Math.max(Math.abs(x) / (halfWidth - margin), Math.abs(y) / (halfHeight - margin)) || 1;
        x /= scale;
        y /= scale;
      }

      const distance = Math.round(enemy.container.position.distanceTo(playerPosition));

      marker.element.style.display = 'block';
      marker.element.style.transform = `translate(${Math.round(x + halfWidth)}px, ${Math.round(y + halfHeight)}px)`;
      marker.element.classList.toggle('off-screen', offScreen);
      marker.range.textContent = `${distance}m`;
    }

    for (let i = used; i < this.markers.length; i++) {
      this.markers[i].element.style.display = 'none';
    }
  }
}
