import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Shared boilerplate for every lab's 3D canvas: scene, camera, renderer,
// orbit controls, resize handling and a start/stop render loop.
export function createStage(container, { cameraPos = [0, 3, 8], fov = 45, controls = true, background = 0x070912 } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  scene.fog = new THREE.Fog(background, 12, 34);

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  camera.position.set(...cameraPos);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(5, 8, 6);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0x8888ff, 0.55));
  const rim = new THREE.PointLight(0x7ee3ff, 0.8, 30);
  rim.position.set(-6, 4, -4);
  scene.add(rim);

  let orbit = null;
  if (controls) {
    orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;
    orbit.minDistance = 2;
    orbit.maxDistance = 26;
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let rafId = null;
  let running = false;
  const onFrame = [];

  function loop() {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    if (orbit) orbit.update();
    for (const fn of onFrame) fn();
    renderer.render(scene, camera);
  }

  return {
    scene,
    camera,
    renderer,
    orbit,
    onFrame,
    start() {
      if (running) return;
      running = true;
      loop();
    },
    stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    },
    dispose() {
      this.stop();
      ro.disconnect();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            if (m.map) m.map.dispose();
            m.dispose();
          }
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    },
  };
}

// Renders text onto a canvas and returns a THREE.Sprite for 3D labels.
export function makeTextSprite(text, { color = "#e8f2ff", size = 42, bg = null, scale = 1 } = {}) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const padding = 16;
  ctx.font = `600 ${size}px 'Space Grotesk', sans-serif`;
  const width = Math.ceil(ctx.measureText(text).width) + padding * 2;
  const height = size + padding * 2;
  canvas.width = width;
  canvas.height = height;
  ctx.font = `600 ${size}px 'Space Grotesk', sans-serif`;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, padding, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set((width / height) * scale, scale, 1);
  sprite.renderOrder = 10;
  return sprite;
}

// Small deterministic PRNG (mulberry32) so every lab experiment is reproducible.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function colorForIndex(i, n) {
  const hue = (i / Math.max(n, 1)) * 300;
  return new THREE.Color(`hsl(${hue}, 70%, 62%)`);
}
