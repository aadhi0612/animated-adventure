import * as THREE from "three";
import { createStage, makeTextSprite } from "./stage.js";

export const meta = {
  id: "tokenizer",
  icon: "🔤",
  title: "Token Forge",
  tagline: "Watch a real byte-pair-encoding tokenizer merge characters into subwords — then compress a sentence yourself.",
  mission: "Use merges to compress the sentence to at least 3 characters per token, using as few merges as you can.",
};

function hashHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

// A real (simplified) BPE trainer: iteratively merges the most frequent
// adjacent symbol pair across the corpus, exactly like the original BPE
// tokenization algorithm — just run on one short sentence instead of a
// full training corpus.
export function trainBPE(text, numMerges) {
  const words = text.trim().length ? text.trim().split(/\s+/) : [];
  let wordSymbols = words.map((w) => [...w.split(""), "</w>"]);
  const merges = [];

  for (let m = 0; m < numMerges; m++) {
    const pairCounts = new Map();
    for (const symbols of wordSymbols) {
      for (let i = 0; i < symbols.length - 1; i++) {
        const pair = symbols[i] + "" + symbols[i + 1];
        pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
      }
    }
    let bestPair = null;
    let bestCount = 1; // require at least 2 occurrences to be worth merging
    for (const [pair, count] of pairCounts) {
      if (count > bestCount) {
        bestCount = count;
        bestPair = pair;
      }
    }
    if (!bestPair) break;
    const [a, b] = bestPair.split("");
    merges.push([a, b, bestCount]);
    wordSymbols = wordSymbols.map((symbols) => {
      const merged = [];
      let i = 0;
      while (i < symbols.length) {
        if (i < symbols.length - 1 && symbols[i] === a && symbols[i + 1] === b) {
          merged.push(a + b);
          i += 2;
        } else {
          merged.push(symbols[i]);
          i += 1;
        }
      }
      return merged;
    });
  }

  const tokens = [];
  for (const symbols of wordSymbols) {
    for (const s of symbols) {
      const clean = s.replace("</w>", "");
      if (clean.length) tokens.push(clean);
    }
  }
  return { tokens, merges, appliedMerges: merges.length };
}

export function init({ canvasWrap, controlsEl, setStatus, setMissionComplete }) {
  const stage = createStage(canvasWrap, { cameraPos: [0, 5, 13], fov: 42 });
  const tokenGroup = new THREE.Group();
  stage.scene.add(tokenGroup);

  const floorGeo = new THREE.PlaneGeometry(40, 40);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0b0e18, metalness: 0.2, roughness: 0.9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.2;
  stage.scene.add(floor);

  let state = { text: "the cat sat on the mat with another cat", merges: 0 };
  const vocabOrder = new Map();

  function rebuild() {
    tokenGroup.clear();
    const { tokens, appliedMerges } = trainBPE(state.text, state.merges);

    vocabOrder.clear();
    for (const t of tokens) if (!vocabOrder.has(t)) vocabOrder.set(t, vocabOrder.size);

    const boxW = 0.9;
    const gap = 0.22;
    const totalWidth = tokens.length * (boxW + gap) - gap;
    let x = -totalWidth / 2;

    tokens.forEach((tok) => {
      const w = Math.max(boxW, boxW * 0.55 + tok.length * 0.16);
      const hue = hashHue(tok);
      const color = new THREE.Color(`hsl(${hue}, 68%, 58%)`);
      const geo = new THREE.BoxGeometry(w, 0.75, 0.75);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.25, emissive: color, emissiveIntensity: 0.12 });
      const box = new THREE.Mesh(geo, mat);
      box.position.set(x + w / 2, 0, 0);
      tokenGroup.add(box);

      const label = makeTextSprite(tok === " " ? "␣" : tok, { color: "#0a0d16", size: 46, scale: 0.7 });
      label.position.set(x + w / 2, 0, 0.42);
      tokenGroup.add(label);

      const idLabel = makeTextSprite(String(vocabOrder.get(tok)), { color: "#7ee3ff", size: 32, scale: 0.42 });
      idLabel.position.set(x + w / 2, 0.75, 0);
      tokenGroup.add(idLabel);

      x += w + gap;
    });

    const charCount = state.text.length;
    const avgChars = tokens.length ? (charCount / tokens.length) : 0;
    const target = 3;
    const complete = tokens.length > 0 && avgChars >= target;
    setMissionComplete(complete);

    controlsEl.querySelector("#tf-readouts").innerHTML = `
      <div class="readout"><span>Characters</span><b>${charCount}</b></div>
      <div class="readout"><span>Tokens</span><b>${tokens.length}</b></div>
      <div class="readout"><span>Avg chars / token</span><b>${avgChars.toFixed(2)}</b></div>
      <div class="readout"><span>Merges applied</span><b>${appliedMerges} / ${state.merges}</b></div>
      <div class="readout"><span>Vocabulary size (this run)</span><b>${vocabOrder.size}</b></div>
    `;

    setStatus(
      complete
        ? `Mission complete — ${avgChars.toFixed(2)} chars/token using ${appliedMerges} merge${appliedMerges === 1 ? "" : "s"}.`
        : `${tokens.length} tokens from ${charCount} characters. Raise merges to compress further.`
    );
  }

  controlsEl.innerHTML = `
    <div class="mission-box" id="tf-mission">${meta.mission}</div>
    <div class="ctrl-group">
      <h4>Sentence</h4>
      <input type="text" id="tf-text" value="${state.text}" maxlength="80" />
    </div>
    <div class="ctrl-group">
      <h4>Merges</h4>
      <div class="ctrl-row"><label>BPE merge steps</label><output id="tf-merges-out">0</output></div>
      <input type="range" id="tf-merges" min="0" max="40" step="1" value="0" />
    </div>
    <div class="ctrl-group" id="tf-readouts"></div>
    <div class="ctrl-note">Every merge combines the single most frequent adjacent symbol pair across the sentence — the same core rule real BPE tokenizers use, just run live in your browser.</div>
  `;

  const textInput = controlsEl.querySelector("#tf-text");
  const mergesInput = controlsEl.querySelector("#tf-merges");
  const mergesOut = controlsEl.querySelector("#tf-merges-out");

  textInput.addEventListener("input", () => {
    state.text = textInput.value || " ";
    rebuild();
  });
  mergesInput.addEventListener("input", () => {
    state.merges = Number(mergesInput.value);
    mergesOut.textContent = state.merges;
    rebuild();
  });

  rebuild();

  stage.onFrame.push(() => {
    tokenGroup.rotation.y = Math.sin(performance.now() * 0.00012) * 0.06;
  });
  stage.start();

  return {
    dispose() {
      stage.dispose();
    },
  };
}
