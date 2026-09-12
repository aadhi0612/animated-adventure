import * as THREE from "three";
import { createStage, makeTextSprite, seededRandom, makeDraggable } from "./stage.js";

export const meta = {
  id: "vectors",
  icon: "🧭",
  title: "Vector Observatory",
  tagline: "32 toy word embeddings, each one literally IS its 3D position — no hidden dimensions. Grab a word and drag it and its real cosine-similarity neighbors update live.",
  mission: "Drag a word out of its own cluster and into another until its nearest neighbor belongs to a different category — you're reshaping real cosine similarity by hand.",
};

const CATEGORIES = [
  { name: "animals", hue: 205, words: ["cat", "dog", "wolf", "lion", "tiger", "horse", "rabbit", "eagle"] },
  { name: "colors", hue: 340, words: ["red", "blue", "green", "yellow", "purple", "orange", "black", "white"] },
  { name: "emotions", hue: 265, words: ["joy", "anger", "fear", "sadness", "calm", "love", "pride", "shame"] },
  { name: "tech", hue: 165, words: ["computer", "algorithm", "network", "model", "data", "code", "robot", "chip"] },
];

const DIMS = 3;

// Build reproducible 3-D "toy" embeddings: each category gets a fixed random
// center, each word is that center plus small noise. Unlike a real embedding
// model (hundreds/thousands of dimensions, only ever viewable as a lossy
// projection), this toy vector's 3 dimensions ARE its full representation —
// so dragging a point in 3D changes 100% of what cosine similarity sees,
// not just a projected slice of it.
// Tetrahedron-corner sign patterns: each category center points in a
// genuinely distinct direction from the origin (pairwise angle ~109.5°),
// so "close in space" and "cosine-similar" agree with each other — dragging
// a point visually toward a cluster actually raises its cosine similarity
// to that cluster, instead of two categories accidentally sharing a direction.
const CATEGORY_DIRS = [
  [1, 1, -1],
  [1, -1, 1],
  [-1, 1, 1],
  [-1, -1, -1],
];

function buildEmbeddings(seed = 7) {
  const rand = seededRandom(seed);
  const words = [];
  CATEGORIES.forEach((cat, ci) => {
    const dir = CATEGORY_DIRS[ci];
    const center = dir.map((s) => s * 1.8 + (rand() - 0.5) * 0.4);
    cat.words.forEach((w) => {
      const vec = center.map((c) => c + (rand() - 0.5) * 0.6);
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

    const topNeighborDifferentCategory = top.length > 0 && top[0].n.data.category !== node.data.category;
    setMissionComplete(topNeighborDifferentCategory);
    setStatus(
      topNeighborDifferentCategory
        ? `Mission complete — you dragged "${node.data.word}" close enough that "${top[0].n.data.word}" (${top[0].n.data.category}) is now its nearest neighbor.`
        : `Nearest neighbor "${top[0]?.n.data.word}" is still in the same category (${node.data.category}) — drag further.`
    );
  }

  const drag = makeDraggable(
    stage,
    () => nodes.map((n) => n.mesh),
    {
      onStart(mesh) {
        const node = nodes.find((n) => n.mesh === mesh);
        if (node) selectNode(node);
      },
      onDrag(mesh, worldTarget) {
        const node = nodes.find((n) => n.mesh === mesh);
        if (!node) return;
        const local = group.worldToLocal(worldTarget.clone()).clampScalar(-4.5, 4.5);
        mesh.position.copy(local);
        node.label.position.copy(local).add(new THREE.Vector3(0, 0.26, 0));
        node.data.vec[0] = local.x / 1.1;
        node.data.vec[1] = local.y / 1.1;
        node.data.vec[2] = local.z / 1.1;
        selectNode(node);
      },
    }
  );

  controlsEl.querySelector("#vec-reset-cam").addEventListener("click", () => {
    stage.camera.position.set(7, 5, 9);
    stage.orbit.target.set(0, 0, 0);
  });

  setStatus("Grab any point and drag it — its neighbors recompute live from real cosine similarity.");
  let idleSpin = true;
  stage.renderer.domElement.addEventListener("pointerdown", () => { idleSpin = false; });
  stage.onFrame.push(() => {
    if (idleSpin) {
      group.rotation.y += 0.0009;
      beamGroup.rotation.y += 0.0009;
    }
  });
  stage.start();

  return {
    dispose() {
      drag.dispose();
      stage.dispose();
    },
  };
}
