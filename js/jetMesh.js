import * as THREE from 'three';

// Builds a jet in the convention the whole sim uses:
//   +Z is the nose, +Y is the canopy, +X is the right wing.
// Both the player and the enemies use this so they behave identically.
export function buildJet({ body = 0x9aa3ad, wing = 0x7d858f, accent = 0x2b3038, glow = 0x66ccff } = {}) {
  const group = new THREE.Group();

  const bodyMaterial = new THREE.MeshPhongMaterial({ color: body, shininess: 60 });
  // Mirrored wings/stabilizers are made with scale.x = -1, which reverses the
  // triangle winding — render both sides so the left half isn't lit inside-out.
  const wingMaterial = new THREE.MeshPhongMaterial({ color: wing, shininess: 30, side: THREE.DoubleSide });
  const accentMaterial = new THREE.MeshPhongMaterial({ color: accent, shininess: 90 });

  const fuselageLength = 6;
  const fuselageRadius = 0.42;

  // Fuselage — cylinders are built along +Y, so tip it onto +Z.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(fuselageRadius * 0.8, fuselageRadius, fuselageLength, 14), bodyMaterial);
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);

  // Nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(fuselageRadius * 0.8, 2.2, 14), bodyMaterial);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = fuselageLength / 2 + 1.1;
  group.add(nose);

  // Canopy
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), accentMaterial);
  canopy.scale.set(1, 0.7, 2.1);
  canopy.position.set(0, fuselageRadius * 0.7, 1.1);
  group.add(canopy);

  // Main wings — swept back by shearing a thin box into a trapezoid.
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 1.2);
  wingShape.lineTo(4.3, -1.5);
  wingShape.lineTo(4.3, -2.3);
  wingShape.lineTo(0, -1.6);
  wingShape.lineTo(0, 1.2);
  const wingGeometry = new THREE.ExtrudeGeometry(wingShape, { depth: 0.14, bevelEnabled: false });
  // Extrusion runs along +Z; rotate so thickness becomes vertical and the
  // shape's local X/Y map to the world span/chord axes.
  wingGeometry.rotateX(Math.PI / 2);
  wingGeometry.translate(0, 0.07, 0);

  const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
  group.add(rightWing);

  const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
  leftWing.scale.x = -1;
  group.add(leftWing);

  // Horizontal stabilizers
  const stabShape = new THREE.Shape();
  stabShape.moveTo(0, -2.2);
  stabShape.lineTo(1.8, -3.0);
  stabShape.lineTo(1.8, -3.4);
  stabShape.lineTo(0, -3.1);
  stabShape.lineTo(0, -2.2);
  const stabGeometry = new THREE.ExtrudeGeometry(stabShape, { depth: 0.12, bevelEnabled: false });
  stabGeometry.rotateX(Math.PI / 2);

  const rightStab = new THREE.Mesh(stabGeometry, wingMaterial);
  group.add(rightStab);

  const leftStab = new THREE.Mesh(stabGeometry, wingMaterial);
  leftStab.scale.x = -1;
  group.add(leftStab);

  // Vertical tail fin. Drawn in the (fore-aft, height) plane, then rotated so
  // the shape's X lands on world Z and the extrusion becomes span-wise thickness.
  const finShape = new THREE.Shape();
  finShape.moveTo(-1.6, 0);
  finShape.lineTo(-3.0, 1.7);
  finShape.lineTo(-3.4, 1.7);
  finShape.lineTo(-3.1, 0);
  finShape.lineTo(-1.6, 0);
  const finGeometry = new THREE.ExtrudeGeometry(finShape, { depth: 0.12, bevelEnabled: false });
  finGeometry.rotateY(-Math.PI / 2);
  finGeometry.translate(0.06, 0, 0);
  const fin = new THREE.Mesh(finGeometry, wingMaterial);
  fin.position.y = 0.3;
  group.add(fin);

  // Exhaust glow at the tail
  const exhaust = new THREE.Mesh(
    new THREE.CylinderGeometry(fuselageRadius * 0.75, fuselageRadius * 0.55, 0.5, 12),
    new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.85 })
  );
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.z = -fuselageLength / 2 - 0.2;
  group.add(exhaust);

  return { group, exhaust, materials: [bodyMaterial, wingMaterial, accentMaterial] };
}
