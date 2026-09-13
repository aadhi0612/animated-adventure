import { SITE } from "./config.js";
import { NEWS } from "./news-data.js";
import { initHeroBackground } from "./hero-bg.js";
import * as tokenizer from "./labs/tokenizer.js";
import * as vectors from "./labs/vectors.js";
import * as neuron from "./labs/neuron.js";
import * as attention from "./labs/attention.js";
import * as generation from "./labs/generation.js";

const LABS = [tokenizer, vectors, neuron, attention, generation];
const PROGRESS_KEY = "ai-lab-progress-v2";

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch { return {}; }
}
function saveProgress(p) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* private mode: ignore */ }
}
let progress = loadProgress();
function entryFor(id) { return progress[id] || { complete: false, score: 0, best: 0 }; }
// Room 0 is always open; each further room unlocks once the one before it
// has been cleared at least once (mastery is sticky — clearing never re-locks).
function isUnlocked(i) { return i === 0 || entryFor(LABS[i - 1].meta.id).complete; }

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

/* ---------------- Header / nav ---------------- */
const navToggle = document.getElementById("navToggle");
const siteNav = document.querySelector(".site-nav");
navToggle.addEventListener("click", () => {
  const open = siteNav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});
siteNav.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    siteNav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  })
);

/* ---------------- Reveal on scroll ---------------- */
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

/* ---------------- Hero background ---------------- */
initHeroBackground(document.getElementById("heroCanvas"));

/* ---------------- About section ---------------- */
document.getElementById("aboutBio").textContent = SITE.bio;
document.getElementById("skillTags").innerHTML = SITE.skills.map((s) => `<li>${s}</li>`).join("");
document.getElementById("footerName").textContent = SITE.name;
document.getElementById("year").textContent = new Date().getFullYear();
document.getElementById("contactLinks").innerHTML = `
  <a class="btn btn-primary" href="mailto:${SITE.email}">Email me</a>
  <a class="btn btn-ghost" href="${SITE.links.site}" target="_blank" rel="noopener noreferrer">Portfolio</a>
  <a class="btn btn-ghost" href="${SITE.links.github}" target="_blank" rel="noopener noreferrer">GitHub</a>
  <a class="btn btn-ghost" href="${SITE.links.linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn</a>
`;

/* ---------------- News grid ---------------- */
const newsGrid = document.getElementById("newsGrid");
newsGrid.innerHTML = NEWS.map(
  (item) => `
  <article class="news-card">
    <div class="news-meta"><span>${item.org}</span><span>${item.date}</span></div>
    <h3>${item.title}</h3>
    <p>${item.summary}</p>
    <span class="news-tag">${item.tag}</span>
    <div class="news-footer">
      <a href="${item.url}" target="_blank" rel="noopener noreferrer">Primary source →</a>
      <span class="evidence-badge">${item.evidence}</span>
    </div>
  </article>`
).join("");

/* ---------------- Lab grid ---------------- */
const labGrid = document.getElementById("labGrid");
const progressStrip = document.getElementById("labProgressStrip");

function renderProgressStrip() {
  const cleared = LABS.filter((m) => entryFor(m.meta.id).complete).length;
  const totalScore = LABS.reduce((s, m) => s + entryFor(m.meta.id).best, 0);
  const maxScore = LABS.length * 100;
  progressStrip.innerHTML = `
    <span><b>${cleared}</b> / ${LABS.length} rooms cleared</span>
    <div class="lab-progress-bar-outer"><span style="width:${(cleared / LABS.length) * 100}%"></span></div>
    <span><b>${totalScore}</b> / ${maxScore} points</span>
  `;
}

function renderLabGrid() {
  labGrid.innerHTML = LABS.map((mod, i) => {
    const entry = entryFor(mod.meta.id);
    const unlocked = isUnlocked(i);
    const cta = !unlocked ? "Locked" : entry.complete ? "Replay →" : "Enter →";
    return `
    <button class="lab-card reveal in${entry.complete ? " is-complete" : ""}${!unlocked ? " is-locked" : ""}"
            data-lab="${mod.meta.id}" ${!unlocked ? 'aria-disabled="true"' : ""}>
      ${!unlocked ? '<span class="lab-card-lock" aria-hidden="true">🔒</span>' : ""}
      <span class="lab-card-index">ROOM ${String(i + 1).padStart(2, "0")}</span>
      <h3>${mod.meta.icon} ${mod.meta.title}</h3>
      <p>${unlocked ? mod.meta.tagline : `Clear Room ${String(i).padStart(2, "0")} to unlock this room.`}</p>
      <div class="lab-card-meta">
        <span class="lab-card-score">${unlocked ? `Best: ${entry.best}` : ""}</span>
        <span class="lab-card-cta">${cta}</span>
      </div>
      <div class="lab-card-progress"><span style="width:${unlocked ? entry.best : 0}%"></span></div>
    </button>`;
  }).join("");

  labGrid.querySelectorAll(".lab-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.lab;
      const i = LABS.findIndex((m) => m.meta.id === id);
      if (!isUnlocked(i)) {
        btn.classList.remove("shake");
        void btn.offsetWidth;
        btn.classList.add("shake");
        showToast(`Locked — clear Room ${String(i).padStart(2, "0")} first.`);
        return;
      }
      openLab(id);
    });
  });

  renderProgressStrip();
}
renderLabGrid();

/* ---------------- Lab overlay ---------------- */
const overlay = document.getElementById("labOverlay");
const labIcon = document.getElementById("labIcon");
const labTitle = document.getElementById("labTitle");
const labMission = document.getElementById("labMission");
const labCanvasWrap = document.getElementById("labCanvasWrap");
const labControls = document.getElementById("labControls");
const labStatus = document.getElementById("labStatus");
const labClose = document.getElementById("labClose");

let activeLab = null;

function openLab(id) {
  const mod = LABS.find((m) => m.meta.id === id);
  if (!mod) return;

  labIcon.textContent = mod.meta.icon;
  labTitle.textContent = mod.meta.title;
  labMission.textContent = mod.meta.tagline;
  labCanvasWrap.innerHTML = "";
  labControls.innerHTML = "";
  labStatus.textContent = "";

  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  const labIndex = LABS.findIndex((m) => m.meta.id === id);

  const api = mod.init({
    canvasWrap: labCanvasWrap,
    controlsEl: labControls,
    statusEl: labStatus,
    setStatus: (msg) => { labStatus.textContent = msg; },
    setMissionComplete: (done, score = done ? 100 : 0) => {
      const entry = entryFor(id);
      const wasComplete = entry.complete;
      const prevBest = entry.best;
      const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
      entry.complete = wasComplete || done; // mastery is sticky, never re-locks
      entry.score = clampedScore;
      entry.best = Math.max(entry.best, clampedScore);
      progress[id] = entry;
      saveProgress(progress);

      const box = labControls.querySelector(".mission-box");
      if (box) box.classList.toggle("done", done);

      if (entry.best !== prevBest || entry.complete !== wasComplete) renderLabGrid();

      if (!wasComplete && entry.complete) {
        const next = LABS[labIndex + 1];
        showToast(
          next
            ? `Room ${String(labIndex + 1).padStart(2, "0")} cleared — Room ${String(labIndex + 2).padStart(2, "0")} "${next.meta.title}" unlocked!`
            : `Room ${String(labIndex + 1).padStart(2, "0")} cleared — all rooms complete!`
        );
      }
    },
  });

  activeLab = { id, api };
}

function closeLab() {
  if (!activeLab) return;
  activeLab.api?.dispose?.();
  activeLab = null;
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

labClose.addEventListener("click", closeLab);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && overlay.classList.contains("open")) closeLab();
});
