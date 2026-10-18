import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export interface Viewport {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly canvas: HTMLCanvasElement;
  requestRender(): void;
  // Runs right before each frame is drawn - for positioning HTML labels over the scene.
  onRender(fn: (() => void) | null): void;
  flyTo(position: THREE.Vector3, target: THREE.Vector3, ms?: number): void;
  pick(clientX: number, clientY: number, objects: THREE.Object3D[]): THREE.Intersection | null;
  dispose(): void;
}

interface Options {
  fov?: number;
  minDistance?: number;
  maxDistance?: number;
  enablePan?: boolean;
}

const isShown = (object: THREE.Object3D | null): boolean => {
  for (let o = object; o; o = o.parent) if (!o.visible) return false;
  return true;
};

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Renders only when something changed (a drag, a zoom, a camera fly-to, or a caller's
// requestRender) instead of a constant loop, so an idle chart costs nothing.
export function createViewport(container: HTMLElement, options: Options = {}): Viewport {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.touchAction = "none";
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  scene.environment = environment;
  scene.environmentIntensity = 0.45;

  const camera = new THREE.PerspectiveCamera(options.fov ?? 35, 1, 0.5, 2000);
  scene.add(camera);
  // Key light rides with the camera so whatever the doctor turns towards is well lit.
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(0.35, 0.6, 1);
  camera.add(key);
  scene.add(new THREE.HemisphereLight(0xfff8ef, 0x5a4a3c, 0.6));
  const fill = new THREE.DirectionalLight(0xdbe8ff, 0.45);
  fill.position.set(-80, -40, -60);
  scene.add(fill);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 0.9;
  controls.enablePan = options.enablePan ?? true;
  controls.screenSpacePanning = true;
  controls.minDistance = options.minDistance ?? 10;
  controls.maxDistance = options.maxDistance ?? 400;

  let frame = 0;
  let hook: (() => void) | null = null;
  let tween: { from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3]; start: number; ms: number } | null = null;

  const draw = () => {
    frame = 0;
    let animating = false;
    if (tween) {
      const t = Math.min(1, (performance.now() - tween.start) / tween.ms);
      const e = easeInOut(t);
      camera.position.lerpVectors(tween.from[0], tween.to[0], e);
      controls.target.lerpVectors(tween.from[1], tween.to[1], e);
      if (t >= 1) tween = null;
      else animating = true;
    }
    const moved = controls.update();
    hook?.();
    renderer.render(scene, camera);
    if (animating || moved) requestRender();
  };

  function requestRender() {
    if (!frame) frame = requestAnimationFrame(draw);
  }

  controls.addEventListener("change", requestRender);
  // A drag takes over from any fly-to still in progress.
  controls.addEventListener("start", () => {
    tween = null;
  });

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestRender();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  return {
    scene,
    camera,
    controls,
    canvas,
    requestRender,
    onRender(fn) {
      hook = fn;
    },
    flyTo(position, target, ms = 550) {
      tween = { from: [camera.position.clone(), controls.target.clone()], to: [position.clone(), target.clone()], start: performance.now(), ms };
      requestRender();
    },
    pick(clientX, clientY, objects) {
      const rect = canvas.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.intersectObjects(objects, false).find((hit) => isShown(hit.object)) ?? null;
    },
    dispose() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      observer.disconnect();
      controls.dispose();
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
