import * as THREE from "three";
import { createStage, makeTextSprite, seededRandom, makeDraggable } from "./stage.js";

export const meta = {
  id: "attention",
  icon: "🎭",
  title: "Attention Theater",
  tagline: "Six tokens, real Q/K/V projections, real scaled dot-product attention. Pull the mask curtain down over the grid with your hand and watch future tokens go dark.",
  mission: "Pull the curtain down (or enable the mask) so no token can attend to a token that comes after it.",
};

const TOKENS = ["The", "cat", "sat", "on", "the", "mat"];
const DIM = 4;
const CURTAIN_OPEN_Y = 4.5;
const CURTAIN_CLOSED_Y = 0.55;
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function randMatrix(rand, rows, cols) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => (rand() - 0.5) * 2));
}
function matVec(vec, mat) {
  const out = new Array(mat[0].length).fill(0);
  for (let i = 0; i < vec.length; i++) for (let j = 0; j < mat[0].length; j++) out[j] += vec[i] * mat[i][j];
  return out;
}
function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
function softmax(row) {
  const max = Math.max(...row.filter((v) => v > -Infinity));
  const exps = row.map((v) => (v === -Infinity ? 0 : Math.exp(v - max)));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
}

function computeAttention({ scale, causal }) {
  const rand = seededRandom(11);
  const E = TOKENS.map(() => Array.from({ length: DIM }, () => (rand() - 0.5) * 2));
  const Wq = randMatrix(rand, DIM, DIM);
  const Wk = randMatrix(rand, DIM, DIM);
  const Wv = randMatrix(rand, DIM, DIM);
  const Q = E.map((e) => matVec(e, Wq));
  const K = E.map((e) => matVec(e, Wk));
  const V = E.map((e) => matVec(e, Wv));

  const scores = Q.map((qi, i) =>
    K.map((kj, j) => {
      if (causal && j > i) return -Infinity;
      const raw = dot(qi, kj);
      return scale ? raw / Math.sqrt(DIM) : raw;
    })
  );
  const weights = scores.map(softmax);
  return { weights, scores };
}

function entropy(row) {
  return -row.reduce((s, p) => (p > 0 ? s + p * Math.log2(p) : s), 0);
}

export function init({ canvasWrap, controlsEl, setStatus, setMissionComplete }) {
  const stage = createStage(canvasWrap, { cameraPos: [6, 6.5, 9], fov: 44 });
  const n = TOKENS.length;
  const spacing = 1.05;
  const offset = ((n - 1) * spacing) / 2;

  const barGroup = new THREE.Group();
  stage.scene.add(barGroup);

  TOKENS.forEach((tok, i) => {
    const rowLabel = makeTextSprite(tok, { color: "#7ee3ff", size: 30, scale: 0.42 });
    rowLabel.position.set(-offset - 1.1, 0, i * spacing - offset);
    stage.scene.add(rowLabel);
    const colLabel = makeTextSprite(tok, { color: "#ff9a6b", size: 30, scale: 0.42 });
    colLabel.position.set(i * spacing - offset, 0, -offset - 1.1);
    stage.scene.add(colLabel);
  });

  const bars = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      const geo = new THREE.BoxGeometry(0.72, 1, 0.72);
      const mat = new THREE.MeshStandardMaterial({ color: 0x223055, roughness: 0.4 });
      const box = new THREE.Mesh(geo, mat);
      box.position.set(j * spacing - offset, 0, i * spacing - offset);
      box.userData = { i, j };
      barGroup.add(box);
      row.push(box);
    }
    bars.push(row);
  }

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(n * spacing + 2, n * spacing + 2), new THREE.MeshStandardMaterial({ color: 0x0b0e18 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.51;
  stage.scene.add(floor);

  const state = { scale: true, causal: false, queryRow: 2 };

  const curtain = new THREE.Mesh(
    new THREE.PlaneGeometry(n * spacing + 4.5, n * spacing + 4.5),
    new THREE.MeshStandardMaterial({ color: 0x7a2036, transparent: true, opacity: 0.38, side: THREE.DoubleSide, roughness: 0.6, emissive: 0x3a0f1a, emissiveIntensity: 0.4 })
  );
  curtain.rotation.x = -Math.PI / 2;
  curtain.position.set(0, state.causal ? CURTAIN_CLOSED_Y : CURTAIN_OPEN_Y, 0);
  stage.scene.add(curtain);

  const curtainLabel = makeTextSprite("drag to mask", { color: "#ffb4c6", size: 26, scale: 0.4 });
  curtainLabel.position.set(0, CURTAIN_OPEN_Y + 0.5, 0);
  stage.scene.add(curtainLabel);
  const dark = new THREE.Color("#1c2340");
  const bright = new THREE.Color("#7ee3ff");

  function rebuild() {
    const { weights } = computeAttention(state);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const w = weights[i][j];
        const h = Math.max(0.02, w * 3.2);
        const box = bars[i][j];
        box.scale.y = h;
        box.position.y = h / 2 - 0.5;
        const c = dark.clone().lerp(bright, Math.min(1, w * 2.4));
        box.material.color.copy(c);
        box.material.emissive = c;
        box.material.emissiveIntensity = 0.25;
        box.material.opacity = 1;
      }
    }

    const row = weights[state.queryRow];
    const ent = entropy(row);
    const futureLeak = TOKENS.map((_, j) => j).some((j) => j > state.queryRow && row[j] > 1e-6);

    controlsEl.querySelector("#at-readouts").innerHTML = `
      <div class="readout"><span>Query token</span><b>"${TOKENS[state.queryRow]}"</b></div>
      <div class="readout"><span>Row entropy</span><b>${ent.toFixed(3)} bits</b></div>
      <div class="readout"><span>Weights sum to</span><b>${row.reduce((a, b) => a + b, 0).toFixed(3)}</b></div>
      <div class="readout"><span>Attends to future tokens?</span><b>${futureLeak ? "yes" : "no"}</b></div>
    `;

    setMissionComplete(state.causal);
    setStatus(
      state.causal
        ? "Mission complete — causal mask on: every row's future columns are exactly zero."
        : "Causal mask is off — a token can currently attend to tokens that come after it in the sentence."
    );
  }

  controlsEl.innerHTML = `
    <div class="mission-box" id="at-mission">${meta.mission}</div>
    <div class="ctrl-group">
      <h4>Attention controls</h4>
      <div class="ctrl-row"><label>Scale by √d</label></div>
      <div class="ctrl-btn-row">
        <button class="ctrl-btn active" id="at-scale-on">On</button>
        <button class="ctrl-btn" id="at-scale-off">Off</button>
      </div>
      <div class="ctrl-row" style="margin-top:14px;"><label>Causal mask</label></div>
      <div class="ctrl-btn-row">
        <button class="ctrl-btn" id="at-mask-on">Enable</button>
        <button class="ctrl-btn active" id="at-mask-off">Disable</button>
      </div>
    </div>
    <div class="ctrl-group">
      <h4>Inspect query row</h4>
      <div class="ctrl-row"><label>Query token</label><output id="at-row-out"></output></div>
      <input type="range" id="at-row" min="0" max="${n - 1}" step="1" value="2" />
    </div>
    <div class="ctrl-group" id="at-readouts"></div>
    <div class="ctrl-note">Rows (cyan labels) are queries; columns (orange labels) are keys. Bar height and brightness both encode the real softmax attention weight for that pair.</div>
    <div class="ctrl-note">The dark red curtain above the grid is draggable — pull it down to enable the causal mask, push it up to disable it.</div>
  `;

  function setToggle(onId, offId, val) {
    controlsEl.querySelector(`#${onId}`).classList.toggle("active", val);
    controlsEl.querySelector(`#${offId}`).classList.toggle("active", !val);
  }

  controlsEl.querySelector("#at-scale-on").addEventListener("click", () => { state.scale = true; setToggle("at-scale-on", "at-scale-off", true); rebuild(); });
  controlsEl.querySelector("#at-scale-off").addEventListener("click", () => { state.scale = false; setToggle("at-scale-on", "at-scale-off", false); rebuild(); });
  controlsEl.querySelector("#at-mask-on").addEventListener("click", () => { state.causal = true; curtain.position.y = CURTAIN_CLOSED_Y; setToggle("at-mask-on", "at-mask-off", true); rebuild(); });
  controlsEl.querySelector("#at-mask-off").addEventListener("click", () => { state.causal = false; curtain.position.y = CURTAIN_OPEN_Y; setToggle("at-mask-on", "at-mask-off", false); rebuild(); });

  const rowSlider = controlsEl.querySelector("#at-row");
  const rowOut = controlsEl.querySelector("#at-row-out");
  rowSlider.addEventListener("input", () => {
    state.queryRow = Number(rowSlider.value);
    rowOut.textContent = TOKENS[state.queryRow];
    rebuild();
  });
  rowOut.textContent = TOKENS[state.queryRow];

  const drag = makeDraggable(stage, () => [curtain], {
    onDrag(mesh, worldTarget) {
      mesh.position.y = clamp(worldTarget.y, CURTAIN_CLOSED_Y, CURTAIN_OPEN_Y);
    },
    onEnd(mesh) {
      const mid = (CURTAIN_OPEN_Y + CURTAIN_CLOSED_Y) / 2;
      const closed = mesh.position.y < mid;
      mesh.position.y = closed ? CURTAIN_CLOSED_Y : CURTAIN_OPEN_Y;
      state.causal = closed;
      setToggle("at-mask-on", "at-mask-off", closed);
      rebuild();
    },
  });

  rebuild();
  stage.start();

  return {
    dispose() {
      drag.dispose();
      stage.dispose();
    },
  };
}
