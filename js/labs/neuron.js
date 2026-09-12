import * as THREE from "three";
import { createStage, seededRandom } from "./stage.js";

export const meta = {
  id: "neuron",
  icon: "🧠",
  title: "Neural Workshop",
  tagline: "A single trainable neuron. Drag its weights or run real gradient descent and watch the decision surface — and the loss — respond.",
  mission: "Get binary cross-entropy loss below 0.15, by hand or by training.",
};

function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }

function buildDataset(seed = 3) {
  const rand = seededRandom(seed);
  const pts = [];
  const jitter = () => (rand() - 0.5) * 1.1;
  for (let i = 0; i < 12; i++) pts.push({ x: -1.1 + jitter(), z: -0.9 + jitter(), label: 0 });
  for (let i = 0; i < 12; i++) pts.push({ x: 1.1 + jitter(), z: 0.9 + jitter(), label: 1 });
  return pts;
}

function buildSurfaceGeometry(w1, w2, b, res = 34, range = 2.4) {
  const positions = new Float32Array(res * res * 3);
  const colors = new Float32Array(res * res * 3);
  const blue = new THREE.Color("#4a7dff");
  const orange = new THREE.Color("#ff9a4a");
  let p = 0;
  for (let j = 0; j < res; j++) {
    const z = -range + (2 * range * j) / (res - 1);
    for (let i = 0; i < res; i++) {
      const x = -range + (2 * range * i) / (res - 1);
      const h = sigmoid(w1 * x + w2 * z + b);
      positions[p * 3] = x;
      positions[p * 3 + 1] = h * 1.6 - 0.8;
      positions[p * 3 + 2] = z;
      const c = blue.clone().lerp(orange, h);
      colors[p * 3] = c.r; colors[p * 3 + 1] = c.g; colors[p * 3 + 2] = c.b;
      p++;
    }
  }
  const indices = [];
  for (let j = 0; j < res - 1; j++) {
    for (let i = 0; i < res - 1; i++) {
      const a = j * res + i, bb = a + 1, c = a + res, d = c + 1;
      indices.push(a, c, bb, bb, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function init({ canvasWrap, controlsEl, setStatus, setMissionComplete }) {
  const stage = createStage(canvasWrap, { cameraPos: [4.5, 4, 6.5], fov: 46 });
  const data = buildDataset();

  let w = { w1: 0.1, w2: 0.1, b: 0 };

  const surfaceMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
  let surface = new THREE.Mesh(buildSurfaceGeometry(w.w1, w.w2, w.b), surfaceMat);
  stage.scene.add(surface);

  const grid = new THREE.GridHelper(4.8, 12, 0x2a3350, 0x1b2136);
  grid.position.y = -0.81;
  stage.scene.add(grid);

  const pointsGroup = new THREE.Group();
  stage.scene.add(pointsGroup);
  const markers = data.map((pt) => {
    const color = pt.label === 1 ? 0xff9a4a : 0x4a7dff;
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 14), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 }));
    const targetY = pt.label * 1.6 - 0.8;
    sphere.position.set(pt.x, targetY, pt.z);
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(pt.x, targetY, pt.z), new THREE.Vector3(pt.x, targetY, pt.z)]);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xff5566 }));
    pointsGroup.add(sphere, line);
    return { pt, sphere, line, targetY };
  });

  function computeLossAndAccuracy() {
    let loss = 0, correct = 0;
    for (const { x, z, label } of data) {
      const p = sigmoid(w.w1 * x + w.w2 * z + w.b);
      const eps = 1e-7;
      loss += -(label * Math.log(p + eps) + (1 - label) * Math.log(1 - p + eps));
      if ((p >= 0.5 ? 1 : 0) === label) correct++;
    }
    return { loss: loss / data.length, acc: correct / data.length };
  }

  function trainStep(steps = 30, lr = 0.6) {
    for (let s = 0; s < steps; s++) {
      let dw1 = 0, dw2 = 0, db = 0;
      for (const { x, z, label } of data) {
        const p = sigmoid(w.w1 * x + w.w2 * z + w.b);
        const err = p - label;
        dw1 += err * x; dw2 += err * z; db += err;
      }
      const n = data.length;
      w.w1 -= lr * (dw1 / n);
      w.w2 -= lr * (dw2 / n);
      w.b -= lr * (db / n);
    }
  }

  function rebuild() {
    surface.geometry.dispose();
    surface.geometry = buildSurfaceGeometry(w.w1, w.w2, w.b);

    markers.forEach(({ pt, sphere, line }) => {
      const p = sigmoid(w.w1 * pt.x + w.w2 * pt.z + w.b);
      const surfaceY = p * 1.6 - 0.8;
      const positions = line.geometry.attributes.position;
      positions.setXYZ(0, pt.x, sphere.position.y, pt.z);
      positions.setXYZ(1, pt.x, surfaceY, pt.z);
      positions.needsUpdate = true;
    });

    const { loss, acc } = computeLossAndAccuracy();
    const complete = loss < 0.15;
    setMissionComplete(complete);

    ["w1", "w2", "b"].forEach((k) => {
      controlsEl.querySelector(`#nw-${k}`).value = w[k];
      controlsEl.querySelector(`#nw-${k}-out`).textContent = w[k].toFixed(2);
    });
    controlsEl.querySelector("#nw-readouts").innerHTML = `
      <div class="readout"><span>Loss (binary cross-entropy)</span><b>${loss.toFixed(4)}</b></div>
      <div class="readout"><span>Accuracy</span><b>${(acc * 100).toFixed(0)}%</b></div>
    `;
    setStatus(complete ? `Mission complete — loss ${loss.toFixed(4)}.` : `Loss ${loss.toFixed(4)} · accuracy ${(acc * 100).toFixed(0)}%. Keep tuning.`);
  }

  controlsEl.innerHTML = `
    <div class="mission-box" id="nw-mission">${meta.mission}</div>
    <div class="ctrl-group">
      <h4>Parameters (y = sigmoid(w1·x + w2·z + b))</h4>
      <div class="ctrl-row"><label>w1</label><output id="nw-w1-out"></output></div>
      <input type="range" id="nw-w1" min="-4" max="4" step="0.05" />
      <div class="ctrl-row"><label>w2</label><output id="nw-w2-out"></output></div>
      <input type="range" id="nw-w2" min="-4" max="4" step="0.05" />
      <div class="ctrl-row"><label>bias b</label><output id="nw-b-out"></output></div>
      <input type="range" id="nw-b" min="-4" max="4" step="0.05" />
    </div>
    <div class="ctrl-btn-row">
      <button class="ctrl-btn" id="nw-train">Train step (30× GD)</button>
      <button class="ctrl-btn" id="nw-reset">Reset weights</button>
    </div>
    <div class="ctrl-group" id="nw-readouts" style="margin-top:16px;"></div>
    <div class="ctrl-note">Blue points are class 0, orange are class 1. Red connector lines show each point's error — they shrink as the neuron improves.</div>
  `;

  ["w1", "w2", "b"].forEach((k) => {
    controlsEl.querySelector(`#nw-${k}`).addEventListener("input", (e) => {
      w[k] = Number(e.target.value);
      rebuild();
    });
  });
  controlsEl.querySelector("#nw-train").addEventListener("click", () => {
    trainStep();
    rebuild();
  });
  controlsEl.querySelector("#nw-reset").addEventListener("click", () => {
    w = { w1: 0.1, w2: 0.1, b: 0 };
    rebuild();
  });

  rebuild();
  stage.start();

  return {
    dispose() {
      stage.dispose();
    },
  };
}
