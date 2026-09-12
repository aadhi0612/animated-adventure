import { SITE } from "./config.js";
import { NEWS } from "./news-data.js";
import { initHeroBackground } from "./hero-bg.js";
import * as tokenizer from "./labs/tokenizer.js";
import * as vectors from "./labs/vectors.js";
import * as neuron from "./labs/neuron.js";
import * as attention from "./labs/attention.js";
import * as generation from "./labs/generation.js";

const LABS = [tokenizer, vectors, neuron, attention, generation];
const PROGRESS_KEY = "ai-lab-progress-v1";

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch { return {}; }
}
function saveProgress(p) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* private mode: ignore */ }
}
let progress = loadProgress();

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
function progressPercent(id) { return progress[id] ? 100 : 0; }
function renderLabGrid() {
  labGrid.innerHTML = LABS.map(
    (mod, i) => `
    <button class="lab-card reveal in" data-lab="${mod.meta.id}">
      <span class="lab-card-index">ROOM ${String(i + 1).padStart(2, "0")}</span>
      <h3>${mod.meta.icon} ${mod.meta.title}</h3>
      <p>${mod.meta.tagline}</p>
      <div class="lab-card-meta"><span>Mission</span><span class="lab-card-cta">Enter →</span></div>
      <div class="lab-card-progress"><span style="width:${progressPercent(mod.meta.id)}%"></span></div>
    </button>`
  ).join("");
  labGrid.querySelectorAll(".lab-card").forEach((btn) => {
    btn.addEventListener("click", () => openLab(btn.dataset.lab));
  });
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

  const api = mod.init({
    canvasWrap: labCanvasWrap,
    controlsEl: labControls,
    statusEl: labStatus,
    setStatus: (msg) => { labStatus.textContent = msg; },
    setMissionComplete: (done) => {
      const changed = progress[id] !== done;
      progress[id] = done;
      if (changed) saveProgress(progress);
      const box = labControls.querySelector(".mission-box");
      if (box) box.classList.toggle("done", done);
      const card = labGrid.querySelector(`[data-lab="${id}"] .lab-card-progress span`);
      if (card) card.style.width = done ? "100%" : "0%";
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
