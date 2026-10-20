import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { interpolate, type Scenario, type MatchEvent } from '../core/model';
import { inspectSpace } from '../core/spatial';

type Props = {
  scene: Scenario;
  time: number;
  event: MatchEvent;
  layer: string;
  focus: string | null;
  onFocus: (id: string | null) => void;
  comparison: boolean;
  onFallback: () => void;
};
type View = 'broadcast' | 'tactical' | 'follow' | 'free';
const xyz = (x: number, y: number, height = 0) => new THREE.Vector3(x - 52.5, height, y - 34);

function pitchTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1326;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#174e3c';
  c.fillRect(0, 0, 2048, 1326);
  for (let i = 0; i < 14; i++) {
    c.fillStyle = i % 2 ? '#1b5642' : '#174c3a';
    c.fillRect((i * 2048) / 14, 0, 2048 / 14, 1326);
  }
  let seed = 17;
  for (let i = 0; i < 45000; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed % 2048;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const y = seed % 1326;
    c.fillStyle = i % 2 ? '#ffffff09' : '#0000000c';
    c.fillRect(x, y, 1, 3);
  }
  c.scale(2048 / 105, 1326 / 68);
  c.strokeStyle = '#b5d7bf';
  c.lineWidth = 0.14;
  c.strokeRect(0.1, 0.1, 104.8, 67.8);
  c.beginPath();
  c.moveTo(52.5, 0);
  c.lineTo(52.5, 68);
  c.stroke();
  const circle = (x: number, y: number, r: number) => {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
  };
  circle(52.5, 34, 9.15);
  circle(52.5, 34, 0.2);
  c.strokeRect(0, 13.84, 16.5, 40.32);
  c.strokeRect(88.5, 13.84, 16.5, 40.32);
  c.strokeRect(0, 24.84, 5.5, 18.32);
  c.strokeRect(99.5, 24.84, 5.5, 18.32);
  circle(11, 34, 0.2);
  circle(94, 34, 0.2);
  c.beginPath();
  c.arc(11, 34, 9.15, -0.927, 0.927);
  c.stroke();
  c.beginPath();
  c.arc(94, 34, 9.15, Math.PI - 0.927, Math.PI + 0.927);
  c.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
function label(text: string, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 96;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#08151dec';
  c.roundRect(0, 0, 384, 96, 12);
  c.fill();
  c.strokeStyle = color;
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(12, 94);
  c.lineTo(372, 94);
  c.stroke();
  c.font = '600 32px sans-serif';
  c.fillStyle = '#eff9ff';
  c.textAlign = 'center';
  c.fillText(text, 192, 58);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false }));
  sprite.scale.set(10, 2.5, 1);
  sprite.renderOrder = 10;
  return sprite;
}
function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) {
      for (const material of Array.isArray(m.material) ? m.material : [m.material]) {
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) value.dispose();
        material.dispose();
      }
    }
  });
}

export default function Stadium(props: Props) {
  const mount = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  const [view, setView] = useState<View>('broadcast'),
    [error, setError] = useState(false);
  const cameraMode = useRef<View>('broadcast');
  const controlsRef = useRef<{ switchView: (v: View) => void } | null>(null);
  useEffect(() => {
    const host = mount.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setError(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      'aria-label',
      '3D stadium. Drag to orbit, scroll to zoom. Select a player to inspect.',
    );
    renderer.domElement.setAttribute('role', 'img');
    const world = new THREE.Scene();
    world.background = new THREE.Color('#070e17');
    world.fog = new THREE.FogExp2('#070e17', 0.0015);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 500);
    camera.position.set(75, 87, 105);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;
    orbit.minDistance = 18;
    orbit.maxDistance = 330;
    orbit.maxPolarAngle = Math.PI / 2 - 0.07;
    orbit.target.set(8, 0, 0);
    orbit.enablePan = true;
    let transitioning = false;
    const goalCamera = new THREE.Vector3(),
      goalTarget = new THREE.Vector3();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function switchView(v: View) {
      cameraMode.current = v;
      transitioning = true;
      if (v === 'broadcast') {
        goalCamera.set(75, 87, 105).multiplyScalar(Math.max(1, 1.1 / camera.aspect));
        goalTarget.set(8, 0, 0);
      }
      if (v === 'tactical') {
        goalCamera.set(0, 138, 0.1).multiplyScalar(Math.max(1, 1.1 / camera.aspect));
        goalTarget.set(0, 0, 0);
      }
      if (reduced && v !== 'follow') {
        camera.position.copy(goalCamera);
        orbit.target.copy(goalTarget);
        transitioning = false;
      }
    }
    controlsRef.current = { switchView };
    const stopTransition = () => {
      transitioning = false;
      cameraMode.current = 'free';
      setView('free');
    };
    orbit.addEventListener('start', stopTransition);
    world.add(new THREE.HemisphereLight('#b4daff', '#19392a', 2.3));
    const key = new THREE.DirectionalLight('#ebf6ff', 3.5);
    key.position.set(-35, 70, 25);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, {
      left: -75,
      right: 75,
      top: 55,
      bottom: -55,
      near: 1,
      far: 180,
    });
    key.shadow.bias = -0.001;
    world.add(key);
    const fill = new THREE.DirectionalLight('#74bfff', 1.4);
    fill.position.set(50, 30, -50);
    world.add(fill);
    const pitch = new THREE.Mesh(
      new THREE.PlaneGeometry(105, 68),
      new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 1 }),
    );
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    world.add(pitch);
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(120, 2, 83),
      new THREE.MeshStandardMaterial({ color: '#122830', roughness: 0.75 }),
    );
    platform.position.y = -1.1;
    world.add(platform);
    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(1000, 1000),
      new THREE.MeshStandardMaterial({ color: '#080e17', roughness: 0.7 }),
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -2.2;
    world.add(outer);
    const seating = new THREE.Group();
    world.add(seating);
    const standMat = new THREE.MeshStandardMaterial({ color: '#14232e', roughness: 0.95 });
    for (let row = 0; row < 8; row++) {
      for (const side of [-1, 1]) {
        const long = new THREE.Mesh(new THREE.BoxGeometry(132, 1.2, 2.1), standMat);
        long.position.set(0, row * 1.25, side * (44 + row * 2.4));
        seating.add(long);
        const end = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.2, 84), standMat);
        end.position.set(side * (63 + row * 2.4), row * 1.25, 0);
        seating.add(end);
      }
    }
    const seatGeo = new THREE.BoxGeometry(0.65, 0.7, 0.7),
      seatMat = new THREE.MeshStandardMaterial({ color: '#3a6574', roughness: 0.8 });
    const seats = new THREE.InstancedMesh(seatGeo, seatMat, 2400);
    const dummy = new THREE.Object3D();
    let si = 0;
    for (let row = 0; row < 8; row++)
      for (const side of [-1, 1])
        for (let i = 0; i < 75; i++) {
          dummy.position.set(-62 + i * 1.65, row * 1.25 + 0.85, side * (44 + row * 2.4));
          dummy.updateMatrix();
          seats.setMatrixAt(si, dummy.matrix);
          seats.setColorAt(
            si++,
            new THREE.Color().setHSL(
              0.53 + ((i * 7 + row) % 9) * 0.009,
              0.25,
              0.13 + ((i * 13 + row * 7) % 5) * 0.025,
            ),
          );
        }
    for (let row = 0; row < 8; row++)
      for (const side of [-1, 1])
        for (let i = 0; i < 75; i++) {
          dummy.position.set(side * (63 + row * 2.4), row * 1.25 + 0.85, -40 + i * 1.08);
          dummy.updateMatrix();
          seats.setMatrixAt(si, dummy.matrix);
          seats.setColorAt(si++, new THREE.Color('#264752'));
        }
    seating.add(seats);
    const neon = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#57e2df').multiplyScalar(2),
    });
    for (const side of [-1, 1]) {
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(116, 0.3, 0.18), neon);
      ribbon.position.set(0, 0.6, side * 40.5);
      world.add(ribbon);
      const ends = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 80), neon);
      ends.position.set(side * 58, 0.6, 0);
      world.add(ends);
    }
    for (const x of [-64, 64])
      for (const z of [-46, 46]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 31, 8), standMat);
        pole.position.set(x, 14, z);
        world.add(pole);
        const lamp = new THREE.Mesh(
          new THREE.BoxGeometry(7, 1.2, 2),
          new THREE.MeshBasicMaterial({ color: new THREE.Color('#c3eaff').multiplyScalar(4) }),
        );
        lamp.position.set(x, 30, z);
        world.add(lamp);
      }
    // Both goals are constructed from posts and a transparent net lattice.
    for (const side of [-1, 1]) {
      const goal = new THREE.Group();
      goal.position.x = side * 52.5;
      world.add(goal);
      const netPoints: THREE.Vector3[] = [];
      for (let z = -3.66; z <= 3.67; z += 0.4)
        netPoints.push(new THREE.Vector3(side * 2.2, 0, z), new THREE.Vector3(side * 2.2, 2.44, z));
      for (let y = 0; y <= 2.45; y += 0.4)
        netPoints.push(
          new THREE.Vector3(side * 2.2, y, -3.66),
          new THREE.Vector3(side * 2.2, y, 3.66),
        );
      goal.add(
        new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints(netPoints),
          new THREE.LineBasicMaterial({ color: '#b1c9d0', transparent: true, opacity: 0.3 }),
        ),
      );
      const postMat = new THREE.MeshStandardMaterial({ color: '#effaff' });
      for (const z of [-3.66, 3.66]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.44, 8), postMat);
        post.position.set(0, 1.22, z);
        goal.add(post);
      }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 7.32, 8), postMat);
      bar.rotation.x = Math.PI / 2;
      bar.position.y = 2.44;
      goal.add(bar);
    }
    const actors = new Map<
      string,
      {
        group: THREE.Group;
        legs: THREE.Group[];
        arms: THREE.Group[];
        ring: THREE.Mesh;
        tag: THREE.Sprite;
      }
    >();
    const pickables: THREE.Object3D[] = [];
    for (const p of latest.current.scene.players) {
      const group = new THREE.Group();
      group.userData.playerId = p.id;
      world.add(group);
      const home = p.team === 'home';
      const kit = new THREE.MeshStandardMaterial({
        color: home ? '#ffb659' : '#69e1e5',
        roughness: 0.6,
      });
      const skin = new THREE.MeshStandardMaterial({
        color: ['#b97b59', '#7e4f36', '#d8a17b'][p.number % 3],
        roughness: 0.9,
      });
      const shorts = new THREE.MeshStandardMaterial({ color: home ? '#22364b' : '#e9f0e8' });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.37, 0.55, 4, 8), kit);
      body.position.y = 1.48;
      body.castShadow = true;
      group.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
      head.position.y = 2.25;
      head.castShadow = true;
      group.add(head);
      const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.245, 8, 6, 0, Math.PI * 2, 0, 1.5),
        new THREE.MeshStandardMaterial({ color: '#202329' }),
      );
      hair.position.y = 2.28;
      group.add(hair);
      const legs: THREE.Group[] = [],
        arms: THREE.Group[] = [];
      for (const side of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(side * 0.2, 1.1, 0);
        const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.55, 3, 6), shorts);
        mesh.position.y = -0.38;
        mesh.castShadow = true;
        leg.add(mesh);
        const boot = new THREE.Mesh(
          new THREE.BoxGeometry(0.25, 0.18, 0.43),
          new THREE.MeshStandardMaterial({ color: '#f6e8c5' }),
        );
        boot.position.set(0, -0.85, 0.1);
        leg.add(boot);
        group.add(leg);
        legs.push(leg);
        const arm = new THREE.Group();
        arm.position.set(side * 0.43, 1.8, 0);
        const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.45, 3, 6), kit);
        sleeve.position.y = -0.23;
        arm.add(sleeve);
        group.add(arm);
        arms.push(arm);
      }
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.05, 1.18, 40),
        new THREE.MeshBasicMaterial({
          color: home ? '#ffc579' : '#74e8ee',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.75,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.06;
      group.add(ring);
      const tag = label(`${p.number}  ${p.name}`, home ? '#ffb659' : '#69e1e5');
      tag.position.y = 4.3;
      group.add(tag);
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(1.3, 1.3, 4, 8),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.position.y = 1.5;
      hit.userData.playerId = p.id;
      group.add(hit);
      pickables.push(hit);
      actors.set(p.id, { group, legs, arms, ring, tag });
    }
    const ball = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.35, 1),
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#aec7df',
        emissiveIntensity: 0.4,
        roughness: 0.35,
      }),
    );
    ball.castShadow = true;
    world.add(ball);
    const ballHalo = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.82, 32),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      }),
    );
    ballHalo.rotation.x = -Math.PI / 2;
    world.add(ballHalo);
    const overlays = new THREE.Group();
    world.add(overlays);
    let previousOverlay = '';
    function rebuildOverlays(p: Props) {
      disposeObject(overlays);
      overlays.clear();
      if (p.layer === 'clean') return;
      const line = (points: THREE.Vector3[], color: string, r = 0.08) => {
        const curve = new THREE.CatmullRomCurve3(points);
        const mesh = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 48, r, 6, false),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.7) }),
        );
        overlays.add(mesh);
      };
      if (p.event.type === 'pass') {
        const m = inspectSpace(p.scene, p.event, p.time),
          a = xyz(p.event.from.x, p.event.from.y, 0.16),
          b = xyz(p.event.to.x, p.event.to.y, 0.16);
        line([a, b], '#ffc579', 0.1);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(
            Math.max(0, m.receiver.receiverDistance - 0.12),
            m.receiver.receiverDistance,
            80,
          ),
          new THREE.MeshBasicMaterial({
            color: '#ffc579',
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(b);
        overlays.add(ring);
        const disk = new THREE.Mesh(
          new THREE.CircleGeometry(m.receiver.receiverDistance, 64),
          new THREE.MeshBasicMaterial({
            color: '#ffb45b',
            transparent: true,
            opacity: 0.07,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        disk.rotation.x = -Math.PI / 2;
        disk.position.copy(b);
        disk.position.y = 0.07;
        overlays.add(disk);
        line(
          [
            xyz(m.lane.point.x, m.lane.point.y, 0.2),
            xyz(m.lane.projection.x, m.lane.projection.y, 0.2),
          ],
          '#ff718b',
          0.07,
        );
        const tag = label(`${m.lane.laneDistance.toFixed(1)} m · CLEARANCE`, '#ff718b');
        tag.position.copy(xyz(m.lane.projection.x, m.lane.projection.y, 7));
        tag.scale.set(12, 3, 1);
        overlays.add(tag);
      }
      if (p.layer === 'trails')
        for (const player of p.scene.players.filter((q) => q.team === 'home')) {
          const points = [];
          for (let i = 0; i <= 12; i++) {
            const pt = interpolate(p.scene.tracks[player.id], Math.max(0, p.time - 3 + i / 4));
            points.push(xyz(pt.x, pt.y, 0.12));
          }
          line(points, '#73e6de', 0.07);
        }
    }
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(world, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.55, 1.15);
    composer.addPass(bloom);
    const output = new OutputPass();
    composer.addPass(output);
    let initialSize = true;
    const resize = () => {
      const w = host.clientWidth,
        h = host.clientHeight;
      renderer.setSize(w, h);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (initialSize) {
        camera.position.set(75, 87, 105).multiplyScalar(Math.max(1, 1.1 / camera.aspect));
        initialSize = false;
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const raycaster = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let downX = 0,
      downY = 0;
    const down = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickables)[0];
      if (hit) {
        const id = hit.object.userData.playerId;
        latest.current.onFocus(latest.current.focus === id ? null : id);
      }
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointerup', up);
    const lost = (e: Event) => {
      e.preventDefault();
      setError(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    let frame = 0,
      lastRender = 0;
    const tick = (stamp: number) => {
      frame = requestAnimationFrame(tick);
      if (document.hidden || stamp - lastRender < 30) return;
      lastRender = stamp;
      const p = latest.current;
      for (const player of p.scene.players) {
        const actor = actors.get(player.id)!;
        const pt = interpolate(p.scene.tracks[player.id], p.time),
          next = interpolate(p.scene.tracks[player.id], Math.min(p.scene.duration, p.time + 0.1)),
          prev = interpolate(p.scene.tracks[player.id], Math.max(0, p.time - 0.1));
        actor.group.position.copy(xyz(pt.x, pt.y));
        const dx = next.x - prev.x,
          dz = next.y - prev.y;
        actor.group.rotation.y = Math.atan2(dx, dz);
        const stride =
          Math.sin(p.time * 8 + player.number) * Math.min(0.65, Math.hypot(dx, dz) * 2);
        actor.legs[0].rotation.x = stride;
        actor.legs[1].rotation.x = -stride;
        actor.arms[0].rotation.x = -stride * 0.7;
        actor.arms[1].rotation.x = stride * 0.7;
        const selected = p.focus === player.id;
        actor.tag.visible =
          selected || player.id === p.event.player || player.id === p.event.recipient;
        actor.ring.scale.setScalar(selected ? 1.8 : 1);
      }
      const bp = interpolate(p.scene.ball, p.time);
      ball.position.copy(xyz(bp.x, bp.y, 0.4));
      ball.rotation.z = p.time * 3;
      ballHalo.position.copy(xyz(bp.x, bp.y, 0.08));
      const overlayKey = [p.scene.id, p.event.id, p.layer, Math.round(p.time * 10)].join(':');
      if (overlayKey !== previousOverlay) {
        rebuildOverlays(p);
        previousOverlay = overlayKey;
      }
      if (cameraMode.current === 'follow') {
        const subject = p.focus ? interpolate(p.scene.tracks[p.focus], p.time) : bp;
        goalCamera.copy(xyz(subject.x - 18, subject.y + 29, 23));
        goalTarget.copy(xyz(subject.x, subject.y, 1));
        transitioning = true;
      }
      if (transitioning) {
        camera.position.lerp(goalCamera, reduced ? 1 : 0.055);
        orbit.target.lerp(goalTarget, reduced ? 1 : 0.055);
        if (cameraMode.current !== 'follow' && camera.position.distanceTo(goalCamera) < 0.05)
          transitioning = false;
      }
      orbit.update();
      for (const actor of actors.values()) {
        const d = camera.position.distanceTo(actor.group.position);
        const scale = Math.min(1, Math.max(0.22, d / 100));
        actor.tag.scale.set(10 * scale, 2.5 * scale, 1);
      }
      overlays.children.forEach((child) => {
        if (child instanceof THREE.Sprite) {
          const scale = Math.min(
            1,
            Math.max(0.22, camera.position.distanceTo(child.position) / 100),
          );
          child.scale.set(12 * scale, 3 * scale, 1);
        }
      });
      composer.render();
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      orbit.dispose();
      controlsRef.current = null;
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      disposeObject(world);
      bloom.dispose();
      output.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div className="stadium-shell">
      <div className="stadium-canvas" ref={mount} />
      <div className="stadium-vignette" />
      <label className="scene-player-select">
        <span>PLAYER FOCUS</span>
        <select
          aria-label="Follow player in 3D"
          value={props.focus ?? ''}
          onChange={(e) => props.onFocus(e.target.value || null)}
        >
          <option value="">All players</option>
          {props.scene.players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.number} · {p.name} ({p.team === 'home' ? 'NSF' : 'ATL'})
            </option>
          ))}
        </select>
      </label>
      <div className="scene-caption">
        <span>SPATIAL REPLAY</span>
        <strong>{props.comparison ? 'Two seconds earlier.' : 'See the whole play.'}</strong>
        <small>Original synthetic reconstruction</small>
      </div>
      <div className="camera-deck">
        <span>CAMERA</span>
        {(['broadcast', 'tactical', 'follow'] as View[]).map((v) => (
          <button
            key={v}
            aria-pressed={view === v}
            className={view === v ? 'active' : ''}
            onClick={() => {
              setView(v);
              controlsRef.current?.switchView(v);
            }}
          >
            {v === 'broadcast' ? 'Broadcast' : v === 'tactical' ? 'Overhead' : 'Follow play'}
          </button>
        ))}
        <button onClick={props.onFallback}>2D ↗</button>
      </div>
      <div className="orbit-hint">
        DRAG TO ORBIT <span>·</span> SCROLL TO EXPLORE
      </div>
      {error && (
        <div className="webgl-error">
          <strong>3D rendering is unavailable</strong>
          <p>Your browser could not keep a WebGL context.</p>
          <button onClick={props.onFallback}>Open the 2D replay</button>
        </div>
      )}
    </div>
  );
}
