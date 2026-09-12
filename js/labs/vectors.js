import * as THREE from "three";
import { createStage, makeTextSprite, seededRandom } from "./stage.js";

export const meta = {
  id: "vectors",
  icon: "🧭",
  title: "Vector Observatory",
  tagline: "32 toy word embeddings in 8 dimensions, projected into 3D. Click a word to see its real nearest neighbors by cosine similarity.",
  mission: "Click a word and confirm its nearest neighbor (by cosine similarity) belongs to the same category.",
};

const CATEGORIES = [
  { name: "animals", hue: 205, words: ["cat", "dog", "wolf", "lion", "tiger", "horse", "rabbit", "eagle"] },
  { name: "colors", hue: 340, words: ["red", "blue", "green", "yellow", "purple", "orange", "black", "white"] },
  { name: "emotions", hue: 265, words: ["joy", "anger", "fear", "sadness", "calm", "love", "pride", "shame"] },
  { name: "tech", hue: 165, words: ["computer", "algorithm", "network", "model", "data", "code", "robot", "chip"] },
];

const DIMS = 8;

// Build reproducible 8-D "toy" embeddings: each category gets a fixed random
// center, each word is that center plus small noise. This is an honest toy —
// real embeddings are learned from data, not authored — but cosine similarity
// on the result behaves the same way and is computed for real, live.
function buildEmbeddings(seed = 7) {
  const rand = seededRandom(seed);
  const words = [];
  CATEGORIES.forEach((cat, ci) => {
    const center = Array.from({ length: DIMS }, (_, d) => {
      const axisBoost = d < 3 ? (ci - 1.5) * 1.6 : 0; // separate categories along first 3 dims for a legible 3D projection
      return axisBoost + (rand() - 0.5) * 1.4;
    });
    cat.words.forEach((w) => {
      const vec = center.map((c) => c + (rand() - 0.5) * 0.9);
      words.push({ word: w, category: cat.name, hue: cat.hue, vec });
    });
  });
  return words;
}

function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
function norm(a) { return Math.sqrt(dot(a, a)); }
function cosine(a, b) { return dot(a, b) / (norm(a) * norm(b) || 1); }

export function init({ canvasWrap, controlsEl, setStatus, setMissionComplete }) {
  const stage = createStage(canvasWrap, { cameraPos: [7, 5, 9], fov: 46 });
  const words = buildEmbeddings();

  const group = new THREE.Group();
  stage.scene.add(group);

  const nodes = words.map((w) => {
    const color = new THREE.Color(`hsl(${w.hue}, 70%, 60%)`);
    const geo = new THREE.SphereGeometry(0.16, 20, 20);
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.4 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(w.vec[0] * 1.1, w.vec[1] * 1.1, w.vec[2] * 1.1);
    mesh.userData.word = w;
    group.add(mesh);

    const label = makeTextSprite(w.word, { color: "#e8edf4", size: 30, scale: 0.5 });
    label.position.copy(mesh.position).add(new THREE.Vector3(0, 0.26, 0));
    group.add(label);

    return { mesh, label, data: w };
  });

  const beamGroup = new THREE.Group();
  stage.scene.add(beamGroup);

  const legend = CATEGORIES.map(
    (c) => `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:12px;"><span style="width:10px;height:10px;border-radius:50%;background:hsl(${c.hue},70%,60%);display:inline-block;"></span>${c.name}</span>`
  ).join("");

  controlsEl.innerHTML = `
    <div class="mission-box" id="vec-mission">${meta.mission}</div>
    <div class="ctrl-group">
      <h4>Categories</h4>
      <div style="font-size:0.82rem;color:var(--text-dim);line-height:2;">${legend}</div>
    </div>
    <div class="ctrl-group">
      <h4>Selection</h4>
      <div class="ctrl-note" id="vec-hint">Click any point in the 3D space to inspect it.</div>
    </div>
    <div class="ctrl-group" id="vec-results"></div>
    <div class="ctrl-btn-row">
      <button class="ctrl-btn" id="vec-reset-cam">Reset camera</button>
    </div>
  `;

  const resultsEl = controlsEl.querySelector("#vec-results");
  const hintEl = controlsEl.querySelector("#vec-hint");

  let selected = null;
  function selectNode(node) {
    if (selected) selected.mesh.scale.setScalar(1);
    selected = node;
    node.mesh.scale.setScalar(1.9);

    const sims = nodes
      .filter((n) => n !== node)
      .map((n) => ({ n, sim: cosine(node.data.vec, n.data.vec) }))
      .sort((a, b) => b.sim - a.sim);

    beamGroup.clear();
    const top = sims.slice(0, 3);
    top.forEach(({ n, sim }) => {
      const geo = new THREE.BufferGeometry().setFromPoints([node.mesh.position, n.mesh.position]);
      const mat = new THREE.LineBasicMaterial({ color: 0x7ee3ff, transparent: true, opacity: Math.max(0.15, sim) });
      beamGroup.add(new THREE.Line(geo, mat));
    });

    hintEl.textContent = `Selected: "${node.data.word}" (${node.data.category})`;
    resultsEl.innerHTML =
      `<h4>Nearest neighbors</h4>` +
      sims
        .slice(0, 5)
        .map(({ n, sim }) => `<div class="readout"><span>${n.data.word} <em style="opacity:.6">(${n.data.category})</em></span><b>${sim.toFixed(3)}</b></div>`)
        .join("");

    const topNeighborSameCategory = top.length > 0 && top[0].n.data.category === node.data.category;
    setMissionComplete(topNeighborSameCategory);
    setStatus(
      topNeighborSameCategory
        ? `Mission complete — "${top[0].n.data.word}" shares category "${node.data.category}" with cosine similarity ${top[0].sim.toFixed(3)}.`
        : `Nearest neighbor "${top[0]?.n.data.word}" is in a different category — try another word.`
    );
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function onClick(e) {
    const rect = stage.renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, stage.camera);
    const hits = raycaster.intersectObjects(nodes.map((n) => n.mesh));
    if (hits.length) selectNode(nodes.find((n) => n.mesh === hits[0].object));
  }
  stage.renderer.domElement.addEventListener("pointerdown", onClick);

  controlsEl.querySelector("#vec-reset-cam").addEventListener("click", () => {
    stage.camera.position.set(7, 5, 9);
    stage.orbit.target.set(0, 0, 0);
  });

  setStatus("Click any point to inspect its real cosine-similarity neighbors.");
  stage.onFrame.push(() => {
    group.rotation.y += 0.0009;
    beamGroup.rotation.y += 0.0009;
  });
  stage.start();

  return {
    dispose() {
      stage.renderer.domElement.removeEventListener("pointerdown", onClick);
      stage.dispose();
    },
  };
}
