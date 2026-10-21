import { footballer } from './Footballer';
import type { GuideStep } from '../core/guide';
import { ballMotion, playerMotion, flightFor } from '../core/motion';
import { Select } from '../ui/Controls';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { distance, interpolate, type Scenario, type MatchEvent } from '../core/model';
import { inspectSpace } from '../core/spatial';

type Props = {
  guide?: GuideStep;
  guidePlaying: boolean;
  onInspect: (id: string | null) => void;
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
type Evidence = 'pass' | 'run' | 'space';
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
  c.fillText(text, 192, 58, 356);
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
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const evidenceRef = useRef(evidence);
  evidenceRef.current = evidence;
  useEffect(() => {
    if (props.guidePlaying) setEvidence(null);
  }, [props.guidePlaying]);
  const markerRefs = useRef<Partial<Record<Evidence, HTMLButtonElement | null>>>({});
  const inspectRef = useRef<((kind: Evidence) => void) | null>(null);
  useEffect(() => setEvidence(null), [props.scene.id, props.guide?.id]);
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
    camera.position.set(36, 48, 62);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;
    orbit.minDistance = 18;
    orbit.maxDistance = 330;
    orbit.maxPolarAngle = Math.PI / 2 - 0.07;
    orbit.target.set(20, 0, 0);
    orbit.enablePan = true;
    let transitioning = false;
    let director = false;
    const goalCamera = new THREE.Vector3(),
      goalTarget = new THREE.Vector3();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function switchView(v: View) {
      latest.current.onInspect(latest.current.focus);
      director = false;
      cameraMode.current = v;
      transitioning = true;
      if (v === 'broadcast') {
        goalCamera.set(36, 48, 62).multiplyScalar(Math.max(1, 1.1 / camera.aspect));
        goalTarget.set(20, 0, 0);
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
    inspectRef.current = (kind) => {
      const p = latest.current,
        id = p.event.recipient ?? p.event.player;
      const target =
        kind === 'run'
          ? interpolate(p.scene.tracks[id], p.time)
          : kind === 'space'
            ? p.event.to
            : { x: (p.event.from.x + p.event.to.x) / 2, y: (p.event.from.y + p.event.to.y) / 2 };
      director = false;
      cameraMode.current = 'free';
      setView('free');
      goalTarget.copy(xyz(target.x, target.y, 1));
      goalCamera.copy(
        xyz(
          target.x - (kind === 'run' ? 7 : 10),
          target.y + (kind === 'run' ? 14 : 22),
          kind === 'space' ? 34 : kind === 'run' ? 9 : 18,
        ),
      );
      transitioning = true;
      p.onInspect(kind === 'run' ? id : null);
    };
    const stopTransition = () => {
      latest.current.onInspect(latest.current.focus);
      director = false;
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
        rig: THREE.Group;
        legs: THREE.Group[];
        arms: THREE.Group[];
        knees: THREE.Group[];
        elbows: THREE.Group[];
        ring: THREE.Mesh;
        tag: THREE.Sprite;
      }
    >();
    const pickables: THREE.Object3D[] = [];
    for (const p of latest.current.scene.players) {
      const group = new THREE.Group();
      const home = p.team === 'home';
      const { rig, legs, knees, arms, elbows } = footballer(p.number, home);
      group.add(rig);
      group.userData.playerId = p.id;
      world.add(group);
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
      actors.set(p.id, { group, rig, legs, knees, arms, elbows, ring, tag });
    }
    const ball = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.18, 2),
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#aec7df',
        emissiveIntensity: 0.4,
        roughness: 0.35,
      }),
    );
    for (let i = 0; i < 3; i++) {
      const seam = new THREE.Mesh(
        new THREE.TorusGeometry(0.181, 0.012, 4, 24),
        new THREE.MeshStandardMaterial({ color: '#243442', roughness: 0.8 }),
      );
      seam.rotation.set(i === 0 ? Math.PI / 2 : 0, i === 1 ? Math.PI / 2 : 0, 0);
      ball.add(seam);
    }
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
    let previousGuide = '';
    function rebuildOverlays(p: Props) {
      disposeObject(overlays);
      overlays.clear();
      if (p.layer === 'clean' && !p.guide) return;
      const line = (points: THREE.Vector3[], color: string, r = 0.08) => {
        const curve = new THREE.CatmullRomCurve3(points);
        const mesh = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 48, r, 6, false),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.15) }),
        );
        overlays.add(mesh);
      };
      if (p.focus) {
        const points = Array.from({ length: 25 }, (_, i) => {
          const pt = interpolate(
            p.scene.tracks[p.focus!],
            Math.max(0, p.time - 2) + (Math.min(2, p.time) * i) / 24,
          );
          return xyz(pt.x, pt.y, 0.15);
        });
        if (p.time > 0.01) line(points, '#73e6de', 0.1);
      }
      if (evidenceRef.current === 'run') return;
      if (p.guide) {
        const g = p.guide,
          t = Math.max(g.start, Math.min(g.end, p.time));
        const tagAt = (
          text: string,
          point: { x: number; y: number },
          color: string,
          height = 4,
        ) => {
          const tag = label(text, color);
          tag.position.copy(xyz(point.x, point.y, height));
          overlays.add(tag);
        };
        const ringAt = (
          point: { x: number; y: number },
          radius: number,
          color: string,
          dashed = false,
        ) => {
          for (let i = 0; i < (dashed ? 24 : 1); i++) {
            const mesh = new THREE.Mesh(
              new THREE.RingGeometry(
                Math.max(0.01, radius - 0.08),
                Math.max(0.1, radius),
                dashed ? 4 : 80,
                1,
                dashed ? (i * Math.PI) / 12 : 0,
                dashed ? Math.PI / 16 : Math.PI * 2,
              ),
              new THREE.MeshBasicMaterial({
                color,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8,
                depthWrite: false,
              }),
            );
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.copy(xyz(point.x, point.y, 0.18));
            overlays.add(mesh);
          }
        };
        if (g.kind === 'run') {
          const a = interpolate(p.scene.tracks[g.player!], g.start),
            b = interpolate(p.scene.tracks[g.player!], t);
          const points = Array.from({ length: 25 }, (_, i) => {
            const pt = interpolate(p.scene.tracks[g.player!], g.start + ((t - g.start) * i) / 24);
            return xyz(pt.x, pt.y, 0.23);
          });
          if (t > g.start + 0.01) line(points, '#73e6de', 0.13);
          ringAt(a, 1.3, '#d3edf1', true);
          ringAt(b, 1.6, '#73e6de');
          tagAt(`${p.scene.players.find((q) => q.id === g.player)?.name} · OFF BALL`, b, '#73e6de');
          tagAt(g.metric, a, '#d3edf1', 6);
        } else if (g.kind === 'space') {
          const current = inspectSpace(p.scene, g.event, t).receiver;
          ringAt(g.anchor, g.before!, '#d3edf1', true);
          ringAt(g.anchor, current.receiverDistance, '#ffc579');
          line(
            [xyz(g.anchor.x, g.anchor.y, 0.2), xyz(current.point.x, current.point.y, 0.2)],
            '#ff718b',
          );
          tagAt(`${current.receiverDistance.toFixed(1)} m · NOW`, g.anchor, '#ffc579', 6);
          tagAt(
            `${g.before!.toFixed(1)} m · AT ${g.start.toFixed(1)}s`,
            { x: g.anchor.x, y: g.anchor.y + g.before! + 2 },
            '#d3edf1',
            2,
          );
        } else {
          const a = g.event.from,
            b = g.kind === 'finish' ? flightFor(g.event, p.scene.events)!.to : g.event.to;
          line([xyz(a.x, a.y, 0.2), xyz(b.x, b.y, 0.2)], '#ffc579', 0.12);
          ringAt(b, 1.5, '#ffc579');
          tagAt(g.metric.toUpperCase(), g.anchor, '#ffc579', 5);
        }
        return;
      }
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
        // HTML evidence pins provide the readable measurement for this view.
        disposeObject(tag);
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
        camera.position.set(36, 48, 62).multiplyScalar(Math.max(1, 1.1 / camera.aspect));
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
        latest.current.onInspect(latest.current.focus === id ? null : id);
        setEvidence('run');
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
        const motion = playerMotion(p.scene, player.id, p.time);
        actor.group.position.copy(xyz(motion.point.x, motion.point.y));
        actor.group.rotation.y = motion.heading;
        // Gait phase follows distance travelled, so paused or stationary players do not jog.
        const phase = (motion.travel * Math.PI * 2) / 2.4;
        const amplitude = Math.min(0.68, motion.speed * 0.12);
        const stride = Math.sin(phase) * amplitude;
        actor.legs[0].rotation.x = stride;
        actor.legs[1].rotation.x = -stride - motion.kick * 0.95;
        actor.knees[0].rotation.x = Math.max(0, -Math.sin(phase)) * amplitude * 1.5;
        actor.knees[1].rotation.x =
          Math.max(0, Math.sin(phase)) * amplitude * 1.5 * (1 - motion.kick);
        actor.elbows.forEach(
          (elbow) => (elbow.rotation.x = -0.35 - Math.min(0.7, motion.speed * 0.1)),
        );
        actor.arms[0].rotation.x = -stride * 0.7;
        actor.arms[1].rotation.x = stride * 0.7;
        actor.rig.position.y = Math.abs(Math.sin(phase)) * Math.min(0.035, motion.speed * 0.006);
        actor.rig.rotation.x = Math.min(0.12, motion.speed * 0.02);
        actor.rig.rotation.z =
          motion.dive * 1.15 + Math.sin(phase) * Math.min(0.035, motion.speed * 0.006);
        if (motion.dive) {
          actor.rig.position.y += motion.dive * 0.65;
          actor.arms[0].rotation.x = -1.3 * motion.dive;
          actor.arms[1].rotation.x = -1.3 * motion.dive;
        }
        const selected = p.focus === player.id;
        actor.tag.visible = selected && p.event.type !== 'pass';
        actor.ring.scale.setScalar(selected ? 1.3 : 0.65);
        (actor.ring.material as THREE.MeshBasicMaterial).opacity = selected ? 0.9 : 0.25;
      }
      const flight = ballMotion(p.scene, p.time),
        bp = flight.point;
      ball.position.copy(xyz(bp.x, bp.y, flight.height + 0.07));
      ball.rotation.set(flight.spin, 0, flight.spin * 0.3);
      ballHalo.position.copy(xyz(bp.x, bp.y, 0.08));
      const overlayKey = [
        p.scene.id,
        p.event.id,
        p.layer,
        p.guide?.id,
        p.focus,
        evidenceRef.current,
        Math.round(p.time * 10),
      ].join(':');
      if (overlayKey !== previousOverlay) {
        rebuildOverlays(p);
        previousOverlay = overlayKey;
      }
      if (p.guidePlaying) director = true;
      const guideKey = p.guide ? `${p.scene.id}:${p.guide.id}` : '';
      if (guideKey !== previousGuide) {
        previousGuide = guideKey;
        if (p.guide) {
          const g = p.guide,
            wide = Math.max(1, 1.2 / camera.aspect);
          director = true;
          cameraMode.current = 'free';
          setView('free');
          goalTarget.copy(xyz(g.anchor.x, g.anchor.y, 0));
          goalCamera.copy(
            xyz(
              g.anchor.x - (g.kind === 'space' ? 3 : 20) * wide,
              g.anchor.y + (g.kind === 'space' ? 12 : 32) * wide,
              (g.kind === 'space' ? 57 : 36) * wide,
            ),
          );
          transitioning = true;
        }
      }
      if (director && p.guide) {
        const g = p.guide,
          u = THREE.MathUtils.clamp((p.time - g.start) / (g.end - g.start), 0, 1);
        const subject =
          g.kind === 'run'
            ? interpolate(p.scene.tracks[g.player!], p.time)
            : g.kind === 'finish'
              ? bp
              : g.anchor;
        const wide = Math.max(1, 1.1 / camera.aspect);
        const high = g.kind === 'space';
        goalTarget.copy(xyz(subject.x, subject.y, high ? 0 : 1));
        goalCamera.copy(
          xyz(
            subject.x + (high ? -3 : -16 + u * 4) * wide,
            subject.y + (high ? 9 : 25 - u * 3) * wide,
            (high ? 48 : g.kind === 'finish' ? 15 : 23) * wide,
          ),
        );
        transitioning = true;
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
      // Screen-space labels stay anchored to world evidence, with a small collision pass.
      const anchors = {
        pass: { x: (p.event.from.x + p.event.to.x) / 2, y: (p.event.from.y + p.event.to.y) / 2 },
        run: interpolate(p.scene.tracks[p.focus ?? p.event.recipient ?? p.event.player], p.time),
        space: {
          x: p.event.to.x,
          y: p.event.to.y + inspectSpace(p.scene, p.event, p.time).receiver.receiverDistance,
        },
      };
      const placed: { x: number; y: number }[] = [];
      for (const kind of ['pass', 'run', 'space'] as Evidence[]) {
        const el = markerRefs.current[kind];
        if (!el) continue;
        const point = anchors[kind],
          v = xyz(point.x, point.y, kind === 'run' ? 2.4 : 0.5).project(camera);
        const anchorX = (v.x * 0.5 + 0.5) * host.clientWidth;
        const originalY = (-v.y * 0.5 + 0.5) * host.clientHeight;
        const x = THREE.MathUtils.clamp(anchorX, 85, host.clientWidth - 85);
        let y = THREE.MathUtils.clamp(originalY - 35, 80, host.clientHeight - 110);
        for (let attempt = 0; attempt < 4; attempt++) {
          const collision = placed.find(
            (other) => Math.abs(x - other.x) < 155 && Math.abs(y - other.y) < 46,
          );
          if (!collision) break;
          y = collision.y - 48;
        }
        placed.push({ x, y });
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        const dx = anchorX - x,
          dy = originalY - y;
        el.style.setProperty('--leader-length', `${Math.hypot(dx, dy)}px`);
        el.style.setProperty('--leader-angle', `${Math.atan2(-dx, dy)}rad`);
        el.style.visibility =
          v.z > 1 || v.z < -1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1 ? 'hidden' : 'visible';
      }
      composer.render();
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      orbit.dispose();
      controlsRef.current = null;
      inspectRef.current = null;
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
  const inspectedId = props.focus ?? props.event.recipient ?? props.event.player;
  const inspectedPlayer = props.scene.players.find((p) => p.id === inspectedId)!;
  const inspectedMotion = playerMotion(props.scene, inspectedId, props.time);
  const measurement = inspectSpace(props.scene, props.event, props.time);
  const earlier = Math.max(0, props.time - 2);
  const priorSpace = inspectSpace(props.scene, props.event, earlier).receiver.receiverDistance;
  const displacement = distance(
    interpolate(props.scene.tracks[inspectedId], earlier),
    inspectedMotion.point,
  );
  const ballState = ballMotion(props.scene, props.time);
  const phaseLabel =
    ballState.phase === 'pass'
      ? ballState.flight?.loft
        ? 'Lofted pass'
        : 'Ground pass'
      : ballState.phase === 'shot'
        ? 'Shot in flight'
        : ballState.phase === 'net'
          ? 'Net contact'
          : ballState.phase === 'parry'
            ? 'Save · rebound'
            : 'Possession · close control';
  return (
    <div className="stadium-shell">
      <div className="stadium-canvas" ref={mount} />
      <div className="stadium-vignette" />
      {props.event.type === 'pass' && props.layer !== 'clean' && (
        <div className="pitch-evidence" aria-label="Interactive pitch evidence">
          {(['pass', 'run', 'space'] as Evidence[]).map((kind) => (
            <button
              key={kind}
              ref={(el) => {
                markerRefs.current[kind] = el;
              }}
              className={`pitch-pin pin-${kind}`}
              aria-pressed={evidence === kind}
              onClick={() => {
                setEvidence(kind);
                inspectRef.current?.(kind);
              }}
            >
              <i />
              {kind === 'pass'
                ? `${measurement.length.toFixed(1)} m pass`
                : kind === 'run'
                  ? `${inspectedPlayer.number} · ${inspectedPlayer.name}`
                  : `${measurement.receiver.receiverDistance.toFixed(1)} m space`}
              <span>＋</span>
            </button>
          ))}
        </div>
      )}
      {evidence && (
        <aside className="pitch-inspector" aria-label="Pitch evidence inspector">
          <div className="inspector-kicker">
            {evidence === 'run' ? 'PLAYER INSPECTOR' : 'FRAME EVIDENCE'}
            <button aria-label="Close pitch inspector" onClick={() => setEvidence(null)}>
              ×
            </button>
          </div>
          <h3>
            {evidence === 'pass'
              ? 'The passing corridor'
              : evidence === 'run'
                ? `${inspectedPlayer.number} / ${inspectedPlayer.name}`
                : 'Room to receive'}
          </h3>
          <strong>
            {evidence === 'pass'
              ? `${measurement.length.toFixed(1)} m`
              : evidence === 'run'
                ? `${inspectedMotion.speed.toFixed(1)} m/s`
                : `${measurement.receiver.receiverDistance.toFixed(1)} m`}
          </strong>
          <p>
            {evidence === 'pass'
              ? `The nearest opponent to this pass segment is ${measurement.lane.player.name}, ${measurement.lane.laneDistance.toFixed(1)} m away at this frame.`
              : evidence === 'run'
                ? `${displacement.toFixed(1)} m displacement over the preceding ${(props.time - earlier).toFixed(1)} seconds. ${ballState.phase === 'pass' || ballState.phase === 'shot' ? 'Ball in flight.' : ballState.owner === inspectedId ? 'Currently in possession.' : 'Currently off the ball.'}`
                : `Nearest opponent: ${measurement.receiver.player.name}. The same receiving point had ${priorSpace.toFixed(1)} m of clearance two seconds earlier.`}
          </p>
          <div className="inspector-source">
            TRACKING FRAME {props.time.toFixed(2)}s<br />
            {props.event.id} · v{props.event.version}
          </div>
          <small>Synthetic measurement · explore by scrubbing</small>
        </aside>
      )}
      <div className="scene-player-select">
        <span>PLAYER FOCUS</span>
        <Select
          compact
          label="Follow player in 3D"
          value={props.focus ?? ''}
          onChange={(v) => {
            props.onInspect(v || null);
            setEvidence(v ? 'run' : null);
          }}
          options={[
            { value: '', label: 'All players', detail: 'Follow the ball' },
            ...props.scene.players.map((p) => ({
              value: p.id,
              label: p.name,
              badge: String(p.number).padStart(2, '0'),
              detail: p.team === 'home' ? 'Northstar FC' : 'Atlas Athletic',
            })),
          ]}
        />
      </div>
      <div className="scene-caption" hidden={!!props.guide || !!evidence}>
        <span>SPATIAL REPLAY</span>
        <strong>{props.comparison ? 'Two seconds earlier.' : 'See the whole play.'}</strong>
        <small>
          <span className="motion-phase">{phaseLabel}</span> · Synthetic reconstruction
        </small>
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
            <svg
              className="camera-icon"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              aria-hidden="true"
            >
              <path
                d={
                  v === 'broadcast'
                    ? 'M3 5h10v10H3zM13 8l4-2v8l-4-2'
                    : v === 'tactical'
                      ? 'M3 3h14v14H3zM10 3v14M3 10h14'
                      : 'M10 2v4m0 8v4M2 10h4m8 0h4M15 10a5 5 0 1 1-10 0 5 5 0 0 1 10 0'
                }
              />
            </svg>
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
