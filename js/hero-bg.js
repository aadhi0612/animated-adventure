import * as THREE from "three";

// Ambient "neural network" backdrop for the hero section.
// Deliberately lightweight: a fixed point cloud + distance-thresholded edges,
// gentle rotation and mouse parallax. No physics, no per-frame graph rebuild.
export function initHeroBackground(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 50);
  camera.position.set(0, 0, 9);

  const NODE_COUNT = window.innerWidth < 700 ? 70 : 130;
  const positions = new Float32Array(NODE_COUNT * 3);
  const spread = 7.5;
  for (let i = 0; i < NODE_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread * 2;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread * 1.2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }

  const pointsGeo = new THREE.BufferGeometry();
  pointsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pointsMat = new THREE.PointsMaterial({ color: 0x7ee3ff, size: 0.045, transparent: true, opacity: 0.85 });
  const points = new THREE.Points(pointsGeo, pointsMat);
  scene.add(points);

  // Build edges once between nearby nodes.
  const edgeVerts = [];
  const threshold = 2.1;
  for (let i = 0; i < NODE_COUNT; i++) {
    for (let j = i + 1; j < NODE_COUNT; j++) {
      const dx = positions[i * 3] - positions[j * 3];
      const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
      const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < threshold) {
        edgeVerts.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        edgeVerts.push(positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]);
      }
    }
  }
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(edgeVerts), 3));
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x4a5a8a, transparent: true, opacity: 0.28 });
  const lines = new THREE.LineSegments(edgeGeo, edgeMat);
  scene.add(lines);

  const group = new THREE.Group();
  group.add(points, lines);
  scene.add(group);

  let mouseX = 0, mouseY = 0;
  window.addEventListener("pointermove", (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  function resize() {
    const parent = canvas.parentElement;
    const w = parent.clientWidth, h = parent.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();

  let raf = null;
  const clock = new THREE.Clock();
  function animate() {
    raf = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    group.rotation.y = t * 0.045 + mouseX * 0.25;
    group.rotation.x = mouseY * 0.12;
    points.material.size = 0.045 + Math.sin(t * 0.6) * 0.006;
    renderer.render(scene, camera);
  }
  animate();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && raf) {
      cancelAnimationFrame(raf);
      raf = null;
    } else if (!document.hidden && raf === null) {
      animate();
    }
  });
}
