import * as THREE from "three";
import { createStage, makeTextSprite, seededRandom, makeDraggable } from "./stage.js";

export const meta = {
  id: "generation",
  icon: "🎲",
  title: "Generation Lab",
  tagline: "Real softmax over real logits. Grab the temperature dial and slide it by hand, or move top-k and top-p, and watch the distribution — and its entropy — respond live.",
  mission: "Tune the controls until entropy lands between 1.5 and 3.0 bits with at least 3 surviving candidates.",
};

const TEMP_MIN = 0.1;
const TEMP_MAX = 2.0;
const RAIL_BASE_Y = -0.5;
const RAIL_TOP_Y = 3.0;
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function tempToY(t) { return RAIL_BASE_Y + ((t - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * (RAIL_TOP_Y - RAIL_BASE_Y); }
function yToTemp(y) { return TEMP_MIN + (clamp(y, RAIL_BASE_Y, RAIL_TOP_Y) - RAIL_BASE_Y) / (RAIL_TOP_Y - RAIL_BASE_Y) * (TEMP_MAX - TEMP_MIN); }

const PROMPTS = {
  weather: {
    label: "“The weather today is ___”",
    tokens: ["sunny", "nice", "cloudy", "rainy", "warm", "hot", "mild", "humid", "cold", "unpredictable", "terrible", "freezing"],
    logits: [3.1, 2.6, 2.4, 1.8, 1.5, 1.2, 1.0, 0.6, 0.4, 0.1, -0.2, -0.8],
  },
  lang: {
    label: "“My favorite programming language is ___”",
    tokens: ["python", "javascript", "typescript", "rust", "go", "java", "c++", "swift", "ruby", "kotlin", "haskell", "cobol"],
    logits: [3.4, 2.9, 2.7, 2.5, 2.0, 1.2, 1.0, 0.8, 0.6, 0.4, -0.3, -1.5],
  },
};

function softmaxWithTemp(logits, T) {
  const z = logits.map((l) => l / Math.max(T, 0.05));
  const max = Math.max(...z);
  const exps = z.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
}
function applyTopK(probs, k) {
  const idx = probs.map((_, i) => i).sort((a, b) => probs[b] - probs[a]);
  const keep = new Set(idx.slice(0, k));
  const filtered = probs.map((p, i) => (keep.has(i) ? p : 0));
  const sum = filtered.reduce((a, b) => a + b, 0) || 1;
  return filtered.map((p) => p / sum);
}
function applyTopP(probs, p) {
  if (p >= 0.999) return probs;
  const idx = probs.map((_, i) => i).sort((a, b) => probs[b] - probs[a]);
  const keep = new Set();
  let cum = 0;
  for (const i of idx) {
    keep.add(i);
    cum += probs[i];
    if (cum >= p) break;
  }
  const filtered = probs.map((v, i) => (keep.has(i) ? v : 0));
  const sum = filtered.reduce((a, b) => a + b, 0) || 1;
  return filtered.map((v) => v / sum);
}
function entropy(row) {
  return -row.reduce((s, p) => (p > 0 ? s + p * Math.log2(p) : s), 0);
}

export function init({ canvasWrap, controlsEl, setStatus, setMissionComplete }) {
  const stage = createStage(canvasWrap, { cameraPos: [-1.5, 4.5, 12], fov: 48 });
  const state = { promptKey: "weather", temperature: 1.0, topK: 12, topP: 1.0 };
  let seedCounter = 42;

  const barGroup = new THREE.Group();
  stage.scene.add(barGroup);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 8), new THREE.MeshStandardMaterial({ color: 0x0b0e18 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.55;
  stage.scene.add(floor);

  let railX = -6;
  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, RAIL_TOP_Y - RAIL_BASE_Y, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a3350, roughness: 0.6 })
  );
  rail.position.set(railX, (RAIL_BASE_Y + RAIL_TOP_Y) / 2, 0);
  stage.scene.add(rail);

  const handle = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 20, 20),
    new THREE.MeshStandardMaterial({ color: 0x7ee3ff, emissive: 0x7ee3ff, emissiveIntensity: 0.5, roughness: 0.3 })
  );
  stage.scene.add(handle);

  const tempLabel = makeTextSprite("temperature", { color: "#c9d4e6", size: 24, scale: 0.34 });
  tempLabel.position.set(railX, RAIL_TOP_Y + 0.4, 0);
  stage.scene.add(tempLabel);

  const cold = new THREE.Color("#4a7dff");
  const hot = new THREE.Color("#ff5566");
  function updateThermVisual() {
    rail.position.x = railX;
    handle.position.x = railX;
    handle.position.y = tempToY(state.temperature);
    tempLabel.position.x = railX;
    const frac = (state.temperature - TEMP_MIN) / (TEMP_MAX - TEMP_MIN);
    handle.material.color.copy(cold.clone().lerp(hot, frac));
    handle.material.emissive.copy(handle.material.color);
  }

  let bars = [];
  function buildBars() {
    barGroup.clear();
    bars = [];
    const tokens = PROMPTS[state.promptKey].tokens;
    const n = tokens.length;
    const spacing = 0.95;
    const offset = ((n - 1) * spacing) / 2;
    railX = -offset - 1.1;
    tokens.forEach((tok, i) => {
      const geo = new THREE.BoxGeometry(0.55, 1, 0.55);
      const mat = new THREE.MeshStandardMaterial({ color: 0x223055, roughness: 0.4 });
      const box = new THREE.Mesh(geo, mat);
      box.position.set(i * spacing - offset, 0, 0);
      barGroup.add(box);
      const label = makeTextSprite(tok, { color: "#c9d4e6", size: 26, scale: 0.36 });
      label.position.set(i * spacing - offset, -0.75, 0.7);
      barGroup.add(label);
      bars.push(box);
    });
  }

  const dark = new THREE.Color("#1c2340");
  const bright = new THREE.Color("#b98bff");
  const dead = new THREE.Color("#161a28");

  function currentDistribution() {
    const { tokens, logits } = PROMPTS[state.promptKey];
    const base = softmaxWithTemp(logits, state.temperature);
    const afterK = applyTopK(base, state.topK);
    const final = applyTopP(afterK, state.topP);
    return { tokens, final };
  }

  function rebuild() {
    updateThermVisual();
    const { tokens, final } = currentDistribution();
    final.forEach((p, i) => {
      const box = bars[i];
      const h = Math.max(0.02, p * 5.5);
      box.scale.y = h;
      box.position.y = h / 2 - 0.5;
      const color = p > 0 ? dark.clone().lerp(bright, Math.min(1, p * 3)) : dead;
      box.material.color.copy(color);
      box.material.emissive = color;
      box.material.emissiveIntensity = p > 0 ? 0.3 : 0;
    });

    const ent = entropy(final);
    const surviving = final.filter((p) => p > 1e-9).length;
    const complete = ent >= 1.5 && ent <= 3.0 && surviving >= 3;
    setMissionComplete(complete);

    const top3 = final.map((p, i) => ({ p, tok: tokens[i] })).sort((a, b) => b.p - a.p).slice(0, 3);
    controlsEl.querySelector("#gen-readouts").innerHTML = `
      <div class="readout"><span>Entropy</span><b>${ent.toFixed(3)} bits</b></div>
      <div class="readout"><span>Surviving candidates</span><b>${surviving} / ${tokens.length}</b></div>
      ${top3.map((t) => `<div class="readout"><span>${t.tok}</span><b>${(t.p * 100).toFixed(1)}%</b></div>`).join("")}
    `;
    setStatus(complete ? `Mission complete — entropy ${ent.toFixed(2)} bits, ${surviving} candidates alive.` : `Entropy ${ent.toFixed(2)} bits · ${surviving} candidates alive.`);
  }

  function sample() {
    const { tokens, final } = currentDistribution();
    const rand = seededRandom(seedCounter++);
    const r = rand();
    let cum = 0, chosen = tokens.length - 1;
    for (let i = 0; i < final.length; i++) {
      cum += final[i];
      if (r <= cum) { chosen = i; break; }
    }
    const box = bars[chosen];
    const original = box.material.emissiveIntensity;
    box.material.emissive.set(0xffffff);
    box.material.emissiveIntensity = 1;
    setTimeout(() => { box.material.emissiveIntensity = original; rebuild(); }, 550);
    setStatus(`Sampled token: "${tokens[chosen]}" (seed ${seedCounter - 1}).`);
  }

  controlsEl.innerHTML = `
    <div class="mission-box" id="gen-mission">${meta.mission}</div>
    <div class="ctrl-group">
      <h4>Prompt context</h4>
      <div class="ctrl-btn-row">
        <button class="ctrl-btn active" id="gen-prompt-weather">Weather</button>
        <button class="ctrl-btn" id="gen-prompt-lang">Language</button>
      </div>
    </div>
    <div class="ctrl-group">
      <h4>Sampling controls</h4>
      <div class="ctrl-row"><label>Temperature</label><output id="gen-temp-out"></output></div>
      <input type="range" id="gen-temp" min="0.1" max="2.0" step="0.05" value="1.0" />
      <div class="ctrl-row" style="margin-top:12px;"><label>Top-k</label><output id="gen-topk-out"></output></div>
      <input type="range" id="gen-topk" min="1" max="12" step="1" value="12" />
      <div class="ctrl-row" style="margin-top:12px;"><label>Top-p (nucleus)</label><output id="gen-topp-out"></output></div>
      <input type="range" id="gen-topp" min="0.1" max="1.0" step="0.01" value="1.0" />
    </div>
    <div class="ctrl-btn-row">
      <button class="ctrl-btn" id="gen-sample">Sample next token</button>
    </div>
    <div class="ctrl-group" id="gen-readouts" style="margin-top:16px;"></div>
    <div class="ctrl-note">P(token) = softmax(logits / T), then top-k keeps the k highest-probability tokens, then top-p keeps the smallest set whose cumulative probability reaches p.</div>
    <div class="ctrl-note">Grab the glowing dial to the left of the bars and slide it up or down — that's the same temperature value as the slider, just by hand.</div>
  `;

  const tempSlider = controlsEl.querySelector("#gen-temp");
  const tempOut = controlsEl.querySelector("#gen-temp-out");
  const topkSlider = controlsEl.querySelector("#gen-topk");
  const topkOut = controlsEl.querySelector("#gen-topk-out");
  const toppSlider = controlsEl.querySelector("#gen-topp");
  const toppOut = controlsEl.querySelector("#gen-topp-out");

  function syncOutputs() {
    tempOut.textContent = state.temperature.toFixed(2);
    topkOut.textContent = state.topK;
    toppOut.textContent = state.topP.toFixed(2);
  }

  tempSlider.addEventListener("input", () => { state.temperature = Number(tempSlider.value); syncOutputs(); rebuild(); });
  topkSlider.addEventListener("input", () => { state.topK = Number(topkSlider.value); syncOutputs(); rebuild(); });
  toppSlider.addEventListener("input", () => { state.topP = Number(toppSlider.value); syncOutputs(); rebuild(); });
  controlsEl.querySelector("#gen-sample").addEventListener("click", sample);

  function selectPrompt(key) {
    state.promptKey = key;
    controlsEl.querySelector("#gen-prompt-weather").classList.toggle("active", key === "weather");
    controlsEl.querySelector("#gen-prompt-lang").classList.toggle("active", key === "lang");
    state.topK = Math.min(state.topK, PROMPTS[key].tokens.length);
    buildBars();
    rebuild();
  }
  controlsEl.querySelector("#gen-prompt-weather").addEventListener("click", () => selectPrompt("weather"));
  controlsEl.querySelector("#gen-prompt-lang").addEventListener("click", () => selectPrompt("lang"));

  const drag = makeDraggable(stage, () => [handle], {
    onDrag(mesh, worldTarget) {
      const y = clamp(worldTarget.y, RAIL_BASE_Y, RAIL_TOP_Y);
      state.temperature = yToTemp(y);
      tempSlider.value = state.temperature;
      syncOutputs();
      rebuild();
    },
  });

  syncOutputs();
  buildBars();
  rebuild();
  stage.start();

  return {
    dispose() {
      drag.dispose();
      stage.dispose();
    },
  };
}
