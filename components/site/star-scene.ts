import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  Texture,
  WebGLRenderer,
  type Object3D,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export type StarScene = {
  dispose: () => void;
  setPaused: (paused: boolean) => void;
};

function disposeModel(root: Object3D) {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof Texture) value.dispose();
      }
      material.dispose();
    }
  });
}

/** Loaded only in the browser. The exported GLB is the actual Blender mesh. */
export function mountStarScene(
  host: HTMLDivElement,
  onReady: () => void,
  onError: () => void,
): StarScene {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 640 ? 1.25 : 1.75));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(36, 1, 0.1, 30);
  camera.position.set(0, 0.08, 8.0);
  camera.lookAt(0, 0.08, 0);
  const sculpture = new Group();
  sculpture.rotation.set(-0.12, 0.38, -0.12);
  scene.add(sculpture);

  // Local studio reflections: no external HDR download or third-party assets.
  const studio = new Scene();
  studio.background = new Color(0x171917);
  const addSoftbox = (position: [number, number, number], width: number, height: number, color: number, intensity: number) => {
    const panel = new Mesh(
      new PlaneGeometry(width, height),
      new MeshBasicMaterial({ color: new Color(color).multiplyScalar(intensity) }),
    );
    panel.position.set(...position);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  };
  addSoftbox([-3, 4, 4], 3, 6, 0xffffff, 7);
  addSoftbox([4, 1, 1], 2, 5, 0xaff70f, 5);
  addSoftbox([1, -4, 3], 4, 1, 0xffffff, 5);
  addSoftbox([0, 5, -1], 3, 3, 0xffffff, 6);
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, 0.06);
  scene.environment = environment.texture;
  disposeModel(studio);
  pmrem.dispose();

  const rim = new DirectionalLight(0xaff70f, 3);
  rim.position.set(4, 1, -2);
  scene.add(rim);
  const key = new DirectionalLight(0xffffff, 2);
  key.position.set(-3, 4, 5);
  scene.add(key);

  const abort = new AbortController();
  let disposed = false;
  let loaded = false;
  let paused = false;
  let visible = false;
  let lastTime = 0;
  let elapsed = 0;
  let pointerX = 0;
  let pointerY = 0;

  function render(time: number) {
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time;
    elapsed += delta;
    sculpture.position.y = Math.sin(elapsed * 0.65) * 0.10;
    sculpture.rotation.x = MathUtils.damp(sculpture.rotation.x, -0.12 + pointerY * 0.12, 3, delta);
    sculpture.rotation.y = MathUtils.damp(sculpture.rotation.y, 0.38 + Math.sin(elapsed * 0.22) * 0.40 + pointerX * 0.24, 3, delta);
    sculpture.rotation.z = -0.12 + Math.sin(elapsed * 0.3) * 0.065;
    renderer.render(scene, camera);
  }

  function syncAnimation() {
    if (disposed) return;
    lastTime = 0;
    renderer.setAnimationLoop(loaded && visible && !document.hidden && !paused ? render : null);
  }

  function resize() {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    if (loaded) renderer.render(scene, camera);
  }

  function movePointer(event: PointerEvent) {
    if (event.pointerType !== "mouse" || paused) return;
    const bounds = host.getBoundingClientRect();
    pointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    pointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
  }

  function resetPointer() {
    pointerX = 0;
    pointerY = 0;
  }

  function contextLost(event: Event) {
    event.preventDefault();
    dispose();
    onError();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncAnimation();
  });
  visibilityObserver.observe(host);
  host.addEventListener("pointermove", movePointer);
  host.addEventListener("pointerleave", resetPointer);
  document.addEventListener("visibilitychange", syncAnimation);
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  resize();

  function dispose() {
    if (disposed) return;
    disposed = true;
    abort.abort();
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    host.removeEventListener("pointermove", movePointer);
    host.removeEventListener("pointerleave", resetPointer);
    document.removeEventListener("visibilitychange", syncAnimation);
    renderer.domElement.removeEventListener("webglcontextlost", contextLost);
    disposeModel(sculpture);
    environment.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  void (async () => {
    try {
      const response = await fetch("/models/ifriqiya-star.glb", { signal: abort.signal });
      if (!response.ok) throw new Error(`Star model: HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      if (disposed) return;
      const gltf = await new GLTFLoader().parseAsync(buffer, "/models/");
      if (disposed) {
        disposeModel(gltf.scene);
        return;
      }
      sculpture.add(gltf.scene);
      renderer.render(scene, camera);
      loaded = true;
      onReady();
      syncAnimation();
    } catch {
      if (!disposed) {
        dispose();
        onError();
      }
    }
  })();

  return {
    dispose,
    setPaused(value) {
      paused = value;
      syncAnimation();
    },
  };
}
