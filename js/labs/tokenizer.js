import * as THREE from "three";
import { createStage, makeTextSprite, makeDraggable } from "./stage.js";

export const meta = {
  id: "tokenizer",
  icon: "🔤",
  title: "Token Forge",
  tagline: "Watch a real byte-pair-encoding tokenizer merge characters into subwords — then grab two token blocks and merge them yourself, by hand.",
  mission: "Compress the sentence to at least 3 characters per token — using the slider, hand-merges, or both.",
};

function hashHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

// A real (simplified) BPE trainer: iteratively merges the most frequent
// adjacent symbol pair across the corpus, exactly like the original BPE
// tokenization algorithm — just run on one short sentence instead of a
// full training corpus. Also returns which word each output token came
// from, so manual merges below can refuse to cross a word boundary.
export function trainBPE(text, numMerges) {
  const words = text.trim().length ? text.trim().split(/\s+/) : [];
  let wordSymbols = words.map((w) => [...w.split(""), "</w>"]);
  const merges = [];

  for (let m = 0; m < numMerges; m++) {
    const pairCounts = new Map();
    for (const symbols of wordSymbols) {
      for (let i = 0; i < symbols.length - 1; i++) {
        const pair = symbols[i] + "" + symbols[i + 1];
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
    const [a, b] = bestPair.split("");
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
  const tokenWord = [];
  wordSymbols.forEach((symbols, wi) => {
    for (const s of symbols) {
      const clean = s.replace("</w>", "");
      if (clean.length) {
        tokens.push(clean);
        tokenWord.push(wi);
      }
    }
  });
  return { tokens, tokenWord, merges, appliedMerges: merges.length };
}

// Applies one manual "merge these two adjacent tokens" rule everywhere it
// matches within the same word — the same global-rule semantics as BPE,
// just triggered by the learner's hand instead of a frequency count.
function applyManualMerge(tokens, tokenWord, a, b) {
  const outTokens = [];
  const outWord = [];
  let applied = false;
  let i = 0;
  while (i < tokens.length) {
    if (i < tokens.length - 1 && tokens[i] === a && tokens[i + 1] === b && tokenWord[i] === tokenWord[i + 1]) {
      outTokens.push(a + b);
      outWord.push(tokenWord[i]);
      applied = true;
      i += 2;
    } else {
      outTokens.push(tokens[i]);
      outWord.push(tokenWord[i]);
      i += 1;
    }
  }
  return { tokens: outTokens, tokenWord: outWord, applied };
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

  const state = { text: "the cat sat on the mat with another cat", merges: 0, manualMerges: [] };
  const vocabOrder = new Map();
  let currentBoxes = [];
  const MERGE_THRESHOLD = 0.55;
  const BASE_EMISSIVE = 0.12;
  const HOVER_EMISSIVE = 0.7;

  function rebuild() {
    tokenGroup.clear();
    const base = trainBPE(state.text, state.merges);
    let tokens = base.tokens;
    let tokenWord = base.tokenWord;
    let manualApplied = 0;
    for (const [a, b] of state.manualMerges) {
      const res = applyManualMerge(tokens, tokenWord, a, b);
      tokens = res.tokens;
      tokenWord = res.tokenWord;
      if (res.applied) manualApplied++;
    }

    vocabOrder.clear();
    for (const t of tokens) if (!vocabOrder.has(t)) vocabOrder.set(t, vocabOrder.size);

    const boxW = 0.9;
    const gap = 0.22;
    const totalWidth = tokens.length * (boxW + gap) - gap;
    let x = -totalWidth / 2;
    currentBoxes = [];

    tokens.forEach((tok, idx) => {
      const w = Math.max(boxW, boxW * 0.55 + tok.length * 0.16);
      const centerX = x + w / 2;
      const hue = hashHue(tok);
      const color = new THREE.Color(`hsl(${hue}, 68%, 58%)`);
      const geo = new THREE.BoxGeometry(w, 0.75, 0.75);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.25, emissive: color, emissiveIntensity: BASE_EMISSIVE });
      const box = new THREE.Mesh(geo, mat);
      box.position.set(centerX, 0, 0);
      tokenGroup.add(box);

      const label = makeTextSprite(tok === " " ? "␣" : tok, { color: "#0a0d16", size: 46, scale: 0.7 });
      label.position.set(centerX, 0, 0.42);
      tokenGroup.add(label);

      const idLabel = makeTextSprite(String(vocabOrder.get(tok)), { color: "#7ee3ff", size: 32, scale: 0.42 });
      idLabel.position.set(centerX, 0.75, 0);
      tokenGroup.add(idLabel);

      currentBoxes.push({ mesh: box, label, idLabel, index: idx, token: tok, word: tokenWord[idx], centerX, w });
      x += w + gap;
    });

    // wire up left/right neighbor info now that all centers are known
    currentBoxes.forEach((b, i) => {
      b.left = i > 0 ? currentBoxes[i - 1] : null;
      b.right = i < currentBoxes.length - 1 ? currentBoxes[i + 1] : null;
    });

    const charCount = state.text.length;
    const avgChars = tokens.length ? charCount / tokens.length : 0;
    const target = 3;
    const complete = tokens.length > 0 && avgChars >= target;
    setMissionComplete(complete);

    controlsEl.querySelector("#tf-readouts").innerHTML = `
      <div class="readout"><span>Characters</span><b>${charCount}</b></div>
      <div class="readout"><span>Tokens</span><b>${tokens.length}</b></div>
      <div class="readout"><span>Avg chars / token</span><b>${avgChars.toFixed(2)}</b></div>
      <div class="readout"><span>Auto merges applied</span><b>${base.appliedMerges} / ${state.merges}</b></div>
      <div class="readout"><span>Hand merges made</span><b>${manualApplied} / ${state.manualMerges.length}</b></div>
      <div class="readout"><span>Vocabulary size (this run)</span><b>${vocabOrder.size}</b></div>
    `;

    setStatus(
      complete
        ? `Mission complete — ${avgChars.toFixed(2)} chars/token (${base.appliedMerges} auto + ${manualApplied} hand merge${manualApplied === 1 ? "" : "s"}).`
        : `${tokens.length} tokens from ${charCount} characters. Drag two adjacent blocks together, or raise merges, to compress further.`
    );
  }

  controlsEl.innerHTML = `
    <div class="mission-box" id="tf-mission">${meta.mission}</div>
    <div class="ctrl-group">
      <h4>Sentence</h4>
      <input type="text" id="tf-text" value="${state.text}" maxlength="80" />
    </div>
    <div class="ctrl-group">
      <h4>Auto merges (BPE)</h4>
      <div class="ctrl-row"><label>BPE merge steps</label><output id="tf-merges-out">0</output></div>
      <input type="range" id="tf-merges" min="0" max="40" step="1" value="0" />
    </div>
    <div class="ctrl-group">
      <h4>Hand merges</h4>
      <div class="ctrl-note">Drag any block onto its left or right neighbor to merge that exact pair everywhere it occurs — same rule as the algorithm, triggered by you.</div>
      <div class="ctrl-btn-row"><button class="ctrl-btn" id="tf-undo">Undo last hand merge</button></div>
    </div>
    <div class="ctrl-group" id="tf-readouts"></div>
    <div class="ctrl-note">Every merge combines one adjacent symbol pair into a new subword — the same core rule real BPE tokenizers use, just run live in your browser.</div>
  `;

  const textInput = controlsEl.querySelector("#tf-text");
  const mergesInput = controlsEl.querySelector("#tf-merges");
  const mergesOut = controlsEl.querySelector("#tf-merges-out");

  textInput.addEventListener("input", () => {
    state.text = textInput.value || " ";
    state.manualMerges = [];
    rebuild();
  });
  mergesInput.addEventListener("input", () => {
    state.merges = Number(mergesInput.value);
    mergesOut.textContent = state.merges;
    rebuild();
  });
  controlsEl.querySelector("#tf-undo").addEventListener("click", () => {
    state.manualMerges.pop();
    rebuild();
  });

  function resetEmissive() {
    currentBoxes.forEach((b) => { b.mesh.material.emissiveIntensity = BASE_EMISSIVE; });
  }

  const drag = makeDraggable(
    stage,
    () => currentBoxes.map((b) => b.mesh),
    {
      onDrag(mesh, worldTarget) {
        const box = currentBoxes.find((b) => b.mesh === mesh);
        if (!box) return;
        const local = tokenGroup.worldToLocal(worldTarget.clone());
        mesh.position.x = local.x;
        box.label.position.x = local.x;
        box.idLabel.position.x = local.x;

        resetEmissive();
        if (box.left && Math.abs(local.x - box.left.centerX) < MERGE_THRESHOLD) box.left.mesh.material.emissiveIntensity = HOVER_EMISSIVE;
        if (box.right && Math.abs(local.x - box.right.centerX) < MERGE_THRESHOLD) box.right.mesh.material.emissiveIntensity = HOVER_EMISSIVE;
      },
      onEnd(mesh) {
        const box = currentBoxes.find((b) => b.mesh === mesh);
        if (!box) return;
        const x = mesh.position.x;
        const distLeft = box.left ? Math.abs(x - box.left.centerX) : Infinity;
        const distRight = box.right ? Math.abs(x - box.right.centerX) : Infinity;

        if (box.left && distLeft < MERGE_THRESHOLD && distLeft <= distRight && box.left.word === box.word) {
          state.manualMerges.push([box.left.token, box.token]);
          setStatus(`Merged "${box.left.token}" + "${box.token}" → "${box.left.token}${box.token}" everywhere it occurs.`);
        } else if (box.right && distRight < MERGE_THRESHOLD && box.right.word === box.word) {
          state.manualMerges.push([box.token, box.right.token]);
          setStatus(`Merged "${box.token}" + "${box.right.token}" → "${box.token}${box.right.token}" everywhere it occurs.`);
        }
        rebuild();
      },
    }
  );

  rebuild();

  stage.onFrame.push(() => {
    tokenGroup.rotation.y = Math.sin(performance.now() * 0.00012) * 0.06;
  });
  stage.start();

  return {
    dispose() {
      drag.dispose();
      stage.dispose();
    },
  };
}
