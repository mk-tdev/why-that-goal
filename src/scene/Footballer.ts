import * as THREE from 'three';

/** Articulated, metre-scaled footballer with separate hips, knees, elbows and kit details. */
export function footballer(number: number, home: boolean) {
  const rig = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({
    color: number === 1 ? '#cba0ff' : home ? '#eeb65e' : '#91dce1',
    roughness: 0.8,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: home ? '#192a3e' : '#e7eee9',
    roughness: 0.9,
  });
  const skin = new THREE.MeshStandardMaterial({
    color: ['#b97b59', '#72472f', '#d8a17b', '#986449'][number % 4],
    roughness: 0.95,
  });
  const sock = new THREE.MeshStandardMaterial({
    color: home ? '#e7b668' : '#407c88',
    roughness: 0.9,
  });
  const trim = new THREE.MeshStandardMaterial({ color: '#e8e9df', roughness: 0.85 });
  const sole = new THREE.MeshStandardMaterial({ color: '#14202b', roughness: 0.8 });
  const boot = new THREE.MeshStandardMaterial({
    color: number % 2 ? '#e7e8df' : '#ef7957',
    roughness: 0.55,
  });
  function mesh(
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z = 0,
  ) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  const torso = mesh(rig, new THREE.CylinderGeometry(0.23, 0.19, 0.54, 12), shirt, 0, 1.23);
  torso.scale.z = 0.65;
  mesh(rig, new THREE.SphereGeometry(0.19, 12, 8), dark, 0, 0.94).scale.set(1.25, 0.65, 0.75);
  mesh(rig, new THREE.CylinderGeometry(0.075, 0.09, 0.12, 10), skin, 0, 1.55);
  const head = mesh(rig, new THREE.SphereGeometry(0.135, 16, 12), skin, 0, 1.72);
  head.scale.set(0.9, 1.15, 0.95);
  for (const side of [-1, 1])
    mesh(rig, new THREE.SphereGeometry(0.026, 8, 6), skin, side * 0.12, 1.72);
  mesh(
    rig,
    new THREE.SphereGeometry(0.139, 12, 8, 0, Math.PI * 2, 0, 1.5),
    new THREE.MeshStandardMaterial({ color: '#24211f' }),
    0,
    1.75,
  );
  mesh(rig, new THREE.SphereGeometry(0.035, 8, 6), skin, 0, 1.72, 0.12);
  // Collar and club crest give the kit a readable front/back at close range.
  const collar = mesh(rig, new THREE.TorusGeometry(0.095, 0.018, 6, 20), dark, 0, 1.51);
  collar.rotation.x = Math.PI / 2;
  mesh(rig, new THREE.PlaneGeometry(0.055, 0.075), dark, -0.11, 1.35, 0.153);
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const c = canvas.getContext('2d')!;
  c.fillStyle = home ? '#182d42' : '#254f60';
  c.textAlign = 'center';
  c.font = 'bold 90px sans-serif';
  c.fillText(String(number), 64, 99);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const badge = mesh(
    rig,
    new THREE.PlaneGeometry(0.25, 0.25),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
    0,
    1.28,
    -0.157,
  );
  badge.rotation.y = Math.PI;
  const legs: THREE.Group[] = [],
    knees: THREE.Group[] = [],
    arms: THREE.Group[] = [],
    elbows: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.115, 0.94, 0);
    rig.add(leg);
    legs.push(leg);
    mesh(leg, new THREE.CapsuleGeometry(0.095, 0.19, 5, 10), dark, 0, -0.12);
    mesh(leg, new THREE.CapsuleGeometry(0.073, 0.18, 5, 10), skin, 0, -0.29);
    const knee = new THREE.Group();
    knee.position.y = -0.4;
    leg.add(knee);
    knees.push(knee);
    mesh(knee, new THREE.CapsuleGeometry(0.063, 0.24, 5, 10), sock, 0, -0.17);
    mesh(knee, new THREE.CapsuleGeometry(0.065, 0.13, 4, 10), boot, 0, -0.4, 0.055).rotation.x =
      Math.PI / 2;
    mesh(knee, new THREE.CylinderGeometry(0.065, 0.065, 0.025, 12), trim, 0, -0.07);
    mesh(knee, new THREE.BoxGeometry(0.125, 0.018, 0.24), sole, 0, -0.45, 0.055);
    const arm = new THREE.Group();
    arm.position.set(side * 0.24, 1.43, 0);
    rig.add(arm);
    arms.push(arm);
    arm.rotation.z = side * 0.13;
    mesh(arm, new THREE.CapsuleGeometry(0.077, 0.1, 4, 10), shirt, 0, -0.075);
    mesh(arm, new THREE.CapsuleGeometry(0.052, 0.15, 4, 10), skin, 0, -0.21);
    const elbow = new THREE.Group();
    elbow.position.y = -0.29;
    arm.add(elbow);
    elbows.push(elbow);
    mesh(elbow, new THREE.CapsuleGeometry(0.047, 0.18, 4, 10), skin, 0, -0.12);
    mesh(
      elbow,
      new THREE.SphereGeometry(number === 1 ? 0.073 : 0.052, 10, 8),
      number === 1 ? trim : skin,
      0,
      -0.25,
    );
  }
  return { rig, legs, knees, arms, elbows };
}
