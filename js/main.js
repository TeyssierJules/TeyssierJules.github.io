// Portfolio v2 — la chambre suit le scroll, en continu.
// Une seule ligne de temps GSAP couvre toute la page : chaque pixel de scroll fait avancer la pose
// de la chambre (côté, zoom, rotation, nuit). Pas de palier, pas de saut, et ça revient à l'identique
// en remontant. Lenis lisse le défilement.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger.js';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);
const FILM = new URLSearchParams(location.search).has('film');
// Réglage « réduire les animations » du système : ignoré pour l'instant, comme sur l'ancien site
// (choix de Jules ; son propre Windows l'active, ce qui coupait toute l'animation).
// Passer à true pour le respecter : plus de défilement amorti ni de construction de la pièce.
const RESPECT_REDUCED_MOTION = false;
const reduceMotion = RESPECT_REDUCED_MOTION && matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = () => innerWidth <= 900;

const canvas = document.getElementById('room');
const hint = document.querySelector('.stage__hint');
const lampBtn = document.querySelector('.lamp');
// textes de l'interface selon la langue de la page
const EN = document.documentElement.lang === 'en';
const T = EN
  ? { lampOn: 'Turn on the desk lamp', lampOff: 'Turn off the desk lamp', light: 'switch the light on or off', sep: ': ',
      labels: { bureau: 'The desk', ecran: 'The screen', lampe: 'The lamp', etagere: 'The shelf', aquarium: 'The aquarium', tortue: 'The turtle', poster: 'The frame', sac: 'The backpack', chaussures: 'The shoes', halteres: 'The dumbbells' } }
  : { lampOn: 'Allumer la lampe de bureau', lampOff: 'Éteindre la lampe de bureau', light: 'allumer ou éteindre la lumière', sep: ' : ', labels: {} };
// chaque section est repérée par data-key (identique en français et en anglais), à défaut par son id
const keyOf = (el) => el.dataset.key || el.id;
const byKey = (k) => document.querySelector(`.page[data-key="${k}"]`) || document.getElementById(k);
const topBar = document.querySelector('.top');
const sections = [...document.querySelectorAll('.page')];
const navLinks = [...document.querySelectorAll('.top__nav a')];

// ---------- défilement ----------
const lenis = FILM || reduceMotion ? null : new Lenis({ lerp: 0.24 })   // même réglage que room.bokoko33.me : le défilement colle à la molette;
if (lenis) {
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
// Aller à une section depuis le menu ou un objet :
// section voisine -> défilement doux ; section lointaine -> la chambre s'efface, on saute, elle réapparaît
// à sa nouvelle place (sinon on la voit traverser toutes les poses en accéléré).
const stageEl = document.querySelector('.stage');
let mainST = null;
const topOffset = () => 0;
function goTo(el) {
  if (!lenis) return el.scrollIntoView();
  const from = sections.findIndex((s) => s.getBoundingClientRect().bottom > innerHeight * 0.5);
  const to = sections.indexOf(el);
  if (Math.abs(to - from) <= 1) {
    lenis.scrollTo(el, { offset: topOffset(), duration: 1.3, easing: (t) => 1 - Math.pow(1 - t, 3) });
    return;
  }
  gsap.to(stageEl, { opacity: 0, duration: 0.22, ease: 'power1.in', onComplete: () => {
    lenis.scrollTo(el, { offset: topOffset(), immediate: true, force: true });
    ScrollTrigger.update();
    mainST?.getTween()?.progress(1);       // la pose arrive tout de suite, sans rattrapage visible
    requestAnimationFrame(() => gsap.to(stageEl, { opacity: 1, duration: 0.45, ease: 'power1.out' }));
  } });
}
document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const el = document.querySelector(a.getAttribute('href'));
  if (el) { e.preventDefault(); goTo(el); }
}));

// ---------- plans de la chambre, un par section ----------
// Le texte est toujours à gauche, la chambre toujours à droite : elle ne traverse jamais le texte.
// focus : ce qu'on vise ('piece' = toute la pièce, sinon un objet) ; ce point est placé à offX à l'écran
//         (0 = milieu, 0.5 = bord droit). Pour les gros plans, on vise des objets du côté gauche de la pièce :
//         le reste de la pièce sort par le bord droit de l'écran, pas sous le texte.
// zoom  : 1 = toute la pièce ; au-delà, gros plan.
// rot   : rotation de la pièce (radians, ±0,4 max : au-delà on voit l'arrière des murs).
// elev  : hauteur du regard en degrés (35 = isométrique ; plus haut = plongée ; plus bas = à hauteur d'objet).
// drift : où le plan arrive pendant la lecture d'une longue section.
const POSES = {
  'accueil':        { focus: 'piece',    offX: 0.22, zoom: 1.0,  rot: 0,     elev: 35 },
  'a-propos':       { focus: 'sac',      offX: 0.15, zoom: 1.45, rot: -0.12, elev: 32 },
  'formation':      { focus: 'piece',    offX: 0.24, zoom: 1.0,  rot: 0.28,  elev: 46 },
  'competences':    { focus: 'bureau',   offX: 0.2,  zoom: 1.25, rot: -0.1,  elev: 30 },
  'projets':        { focus: 'ecran',    offX: 0.19, zoom: 1.4,  rot: 0.15,  elev: 25, drift: { zoom: 1.15, rot: 0.3, elev: 34, offX: 0.22 } },
  'certifications': { focus: 'piece',    offX: 0.23, zoom: 0.92, rot: -0.25, elev: 62 },
  'interets':       { focus: 'aquarium', offX: 0.24, zoom: 1.15, rot: 0.32,  elev: 28 },
  'cv':             { focus: 'piece',    offX: 0.23, zoom: 1.0,  rot: -0.1,  elev: 38 },
  'contact':        { focus: 'piece',    offX: 0.22, zoom: 1.0,  rot: 0.15,  elev: 35, night: 1 },
};
const DRIFT = 0.12;
// téléphone : échelle des plans, gros plans sur les objets, et hauteur du centre de la fenêtre
const MOB_ZOOM = 0.6, MOB_ROT = 1.6, MOB_OFFY = 0.2;   // téléphone : vue d'ensemble, rotations amplifiées (pas de gros plan), pièce remontée à l'accueil

const FOCI = { piece: new THREE.Vector3(0, 1.0, 0) };     // complété au chargement (centre de chaque objet)

const P = { fx: 0, fy: 1, fz: 0, offX: POSES.accueil.offX, zoom: 1, rot: 0, elev: 35, night: 0, build: reduceMotion ? 1 : 0 };
window.__P = P;   // debug

// ---------- rendu ----------
// Sans WebGL (vieux navigateur, carte graphique bloquée), le site reste utilisable :
// image fixe de la chambre à la place de la 3D (classe sans-3d), tout le reste fonctionne. ?sans3d pour tester.
let renderer = null;
try {
  if (new URLSearchParams(location.search).has('sans3d')) throw new Error('test sans 3D');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  document.documentElement.classList.add('sans-3d');
}
// ?rendu=0 : ancien rendu, pour comparer
const NEW_LOOK = new URLSearchParams(location.search).get('rendu') !== '0';
if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = NEW_LOOK ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;    // ombres recalculées seulement quand un objet bouge dans la pièce
  renderer.setClearColor(0, 0);
}

const scene = new THREE.Scene();
if (NEW_LOOK && renderer) {
  // lumière d'ambiance douce qui vient de partout (comme une pièce éclairée), au lieu d'un simple dégradé ciel/sol :
  // les volumes se lisent mieux et les matériaux brillants (écran, vitres, chrome) ont de vrais reflets
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;
}
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 80);
const DIR = new THREE.Vector3(), RIGHT = new THREE.Vector3(), UPV = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0), focusW = new THREE.Vector3(), target = new THREE.Vector3();
const HALF = 2.95;                         // demi-hauteur visible à zoom 1 (unités de la pièce)
// coins de la pièce (repère de la pièce) : sert à garder la chambre hors de la colonne de texte
const ROOM_CORNERS = [];
for (const x of [-1.66, 1.62]) for (const y of [-0.2, 2.62]) for (const z of [-1.62, 1.66]) ROOM_CORNERS.push(new THREE.Vector3(x, y, z));
const tmpV = new THREE.Vector3();
let textEdge = 0.45;                       // bord droit de la colonne de texte (fraction de l'écran), mesuré au chargement

const pivot = new THREE.Group(); scene.add(pivot);       // tout ce qui tourne avec la pièce
const hemi = new THREE.HemisphereLight('#fff8ec', '#c9a77c', 1.5); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3e0', 2.1);
sun.position.set(4, 7, 5); sun.target.position.set(0, 0, 0);
sun.castShadow = true; sun.shadow.mapSize.setScalar(innerWidth <= 900 ? 1024 : 1536);
Object.assign(sun.shadow.camera, { left: -3.2, right: 3.2, top: 3.2, bottom: -3.2, near: 1, far: 20 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
if (NEW_LOOK) { sun.shadow.radius = 2.5; sun.shadow.blurSamples = 12; }   // ombres aux bords doux
pivot.add(sun, sun.target);               // le soleil tourne avec la pièce : l'ombre reste valable sans la recalculer
const lampLight = new THREE.PointLight('#ffc27a', 0, 3.2, 1.6);
const aquaLight = new THREE.PointLight('#ffb866', 0, 1.6, 1.6);
const screenLight = new THREE.PointLight('#7fd3b4', 0, 2.2, 1.8);
pivot.add(lampLight, aquaLight, screenLight);

const DAY = { sky: new THREE.Color('#fff8ec'), ground: new THREE.Color('#c9a77c'), hemi: NEW_LOOK ? 1.05 : 1.5, sun: NEW_LOOK ? 2.4 : 2.1, sunColor: new THREE.Color('#fff3e0') };
const NIGHT = { sky: new THREE.Color('#3b4a8a'), ground: new THREE.Color('#151a30'), hemi: 0.45, sun: 0.35, sunColor: new THREE.Color('#8fa6ff') };
const EMISSIVE = { 'Ecran': [0.6, 3.0], 'Ampoule': [3.0, 8.0], 'Lampe bureau ampoule': [0, 10], 'Vitre teintee': [0.4, 2.5], 'Ciel': [0.6, 0.35] };
const emissiveMats = new Set();

// ---------- objets ----------
const GROUPS = [
  { key: 'bureau',    re: /^(Bureau_|Clavier|Souris|Tour_|Tapis$)/,  label: 'Le bureau',      to: 'competences' },
  { key: 'ecran',     re: /^Ecran_/,                                 label: "L'écran",        to: 'projets' },
  { key: 'lampe',     re: /^LampeB_/,                                label: 'La lampe',       action: 'nuit' },
  { key: 'etagere',   re: /^(Etagere|Livre|Cable_RJ45|Plante_|Medaille)/, label: "L'étagère",  to: 'formation' },
  { key: 'aquarium',  re: /^(Aqua_|Meuble_aqua|Lampe_)/,             label: "L'aquarium",     to: 'interets' },
  { key: 'tortue',    re: /^Tortue$/,                                label: 'La tortue',      to: 'interets' },
  { key: 'poster',    re: /^Poster_/,                                label: 'Le cadre',       to: 'certifications' },
  { key: 'sac',       re: /^Sac$/,                                   label: 'Le sac',         to: 'a-propos' },
  { key: 'chaussures',re: /^(Claquettes|AF1_paire)$/,                label: 'Les chaussures', to: 'a-propos' },
  { key: 'halteres',  re: /^Halteres$/,                              label: 'Les haltères',   to: 'interets' },
];
const SHELL = /^(Sol|Mur_fond|Mur_gauche)$/;
const groups = new Map();
const pickables = [];
let ready = false, hovered = null, lightsAt = {};

const draco = new DRACOLoader();
draco.setDecoderPath(new URL('../vendor/three/addons/libs/draco/', import.meta.url).href);   // décodeur hébergé sur le site
const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
// ombres de contact cuites dans Blender (occlusion ambiante), une image pour toute la pièce, 2e jeu d'UV
const aoTex = NEW_LOOK && renderer ? new THREE.TextureLoader().load(new URL('../models/chambre-ao.webp', import.meta.url).href) : null;
if (aoTex) { aoTex.channel = 1; aoTex.flipY = false; aoTex.colorSpace = THREE.NoColorSpace; }
const aoMats = new Map();   // une copie de matériau par matériau d'origine, avec l'occlusion
if (renderer) loader.load(new URL('../models/chambre.glb', import.meta.url).href, (gltf) => {
  const root = gltf.scene;
  pivot.add(root);
  root.updateMatrixWorld(true);
  const at = (n, dy = 0) => { const v = new THREE.Vector3(); root.getObjectByName(n)?.getWorldPosition(v); v.y += dy; return v; };
  lampLight.position.copy(at('LampeB_ampoule', -0.06));
  aquaLight.position.copy(at('Lampe_ampoule', -0.08));
  screenLight.position.copy(at('Ecran_dalle')).add(new THREE.Vector3(0.1, 0, 0.35));

  // répartir les objets en blocs, puis fusionner les maillages de même matériau : ~40 dessins au lieu de 205
  const buckets = new Map([...GROUPS.map((d) => [d.key, []]), ['deco', []], ['shell', []]]);
  for (const child of [...root.children]) {
    const def = GROUPS.find((d) => d.re.test(child.name));
    const key = SHELL.test(child.name) ? 'shell' : def ? def.key : 'deco';
    child.traverse((o) => { if (o.isMesh) buckets.get(key).push(o); });
  }
  pivot.remove(root);
  for (const [key, meshes] of buckets) {
    const node = new THREE.Group(); node.name = key; pivot.add(node);
    const byMat = new Map();
    for (const m of meshes) {
      const sig = m.material.uuid + '|' + Object.keys(m.geometry.attributes).sort().join(',');
      if (!byMat.has(sig)) byMat.set(sig, { mat: m.material, geos: [] });
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      for (const k of Object.keys(g.morphAttributes)) delete g.morphAttributes[k];
      byMat.get(sig).geos.push(g);
    }
    for (const { mat, geos } of byMat.values()) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) continue;
      let useMat = mat;
      if (aoTex && merged.attributes.uv1) {
        if (!aoMats.has(mat)) { const c = mat.clone(); c.aoMap = aoTex; c.aoMapIntensity = 1.0; aoMats.set(mat, c); }
        useMat = aoMats.get(mat);
      }
      const mesh = new THREE.Mesh(merged, useMat);
      mesh.castShadow = mesh.receiveShadow = true;
      if (mat.transparent) mesh.renderOrder = 2;
      if (EMISSIVE[mat.name]) emissiveMats.add(useMat);
      node.add(mesh);
      if (key !== 'deco' && key !== 'shell') { mesh.userData.group = key; pickables.push(mesh); }
    }
    groups.set(key, { node, def: GROUPS.find((d) => d.key === key), lift: 0, drop: 0, hop: 0 });
  }
  // points visés par les gros plans : centre des objets (repère de la pièce)
  const centerOf = (...keys) => { const b = new THREE.Box3(); keys.forEach((k) => b.expandByObject(groups.get(k).node)); return b.getCenter(new THREE.Vector3()); };
  FOCI.sac = centerOf('sac', 'chaussures');
  FOCI.bureau = centerOf('bureau', 'lampe');
  FOCI.ecran = centerOf('ecran');
  FOCI.etagere = centerOf('etagere');
  FOCI.aquarium = centerOf('aquarium', 'halteres');
  setupScreen();
  setupTurtle();
  ready = true;
  renderer.shadowMap.needsUpdate = true;
  buildTimeline();
  // ouverture : la pièce se meuble toute seule au chargement (une fois), si on arrive en haut de page
  if (FILM || reduceMotion || scrollY > innerHeight * 0.3) P.build = 1;
  else gsap.to(P, { build: 1, duration: 2.1, delay: 0.35, ease: 'none' });
  if (FILM) runFilm();
}, undefined, (e) => console.error('Chambre non chargée', e));

// ---------- la tortue ----------
let turtle = null;
function setupTurtle() {
  const node = groups.get('tortue')?.node; if (!node) return;
  const c = new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3());
  turtle = new THREE.Group(); turtle.position.copy(c); turtle.userData.home = c.clone();
  for (const m of [...node.children]) { m.position.sub(c); m.castShadow = false; turtle.add(m); }
  node.add(turtle);
}

// ---------- l'écran du PC : affiche la section ou le projet en cours ----------
let screen = null;
const projectItems = [...document.querySelectorAll('.project')];
function setupScreen() {
  const node = groups.get('ecran')?.node; if (!node) return;
  const dalle = node.children.find((m) => m.material?.name === 'Ecran'); if (!dalle) return;
  const box = new THREE.Box3().setFromObject(dalle);
  const size = box.getSize(new THREE.Vector3());
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = Math.round(640 * size.y / size.x);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 0.96, size.y * 0.94), mat);
  plane.position.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, box.max.z + 0.002);
  plane.userData.group = 'ecran'; pickables.push(plane);
  node.add(plane);
  screen = { cv, ctx: cv.getContext('2d'), tex, mat, last: 0, key: '' };
  drawScreen();
}
function screenContent() {
  const active = sections.find((sct) => { const r = sct.getBoundingClientRect(); return r.top < innerHeight * 0.55 && r.bottom > innerHeight * 0.45; }) || sections[0];
  if (keyOf(active) === 'projets') {
    let best = null, bd = Infinity;
    for (const li of projectItems) { const r = li.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - innerHeight / 2); if (d < bd) { bd = d; best = li; } }
    if (best) return { title: best.querySelector('h4').textContent, sub: best.querySelector('.project__tech')?.textContent || '', path: EN ? '~/projects' : '~/projets' };
  }
  const t = active.querySelector('.title, .hero__name')?.textContent.replace(/\s+/g, ' ').trim() || '';
  return { title: t, sub: '', path: '~/' + (active.id || '') };
}
function wrap(ctx, text, maxW) {
  const words = text.split(' '); const lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines;
}
function drawScreen() {
  const { cv, ctx, tex } = screen; const W = cv.width, H = cv.height;
  const c = screenContent(); const blink = Math.floor(performance.now() / 530) % 2 === 0;
  screen.last = performance.now();
  const key = c.title + c.sub + blink + Math.round(night.user * 10) + Math.round(P.night * 10);
  if (key === screen.key) return; screen.key = key;
  ctx.fillStyle = '#0f1f19'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#7fd3b4'; ctx.font = '600 22px ui-monospace, Consolas, monospace';
  ctx.fillText(`jules@chambre:${c.path}$`, 28, 46);
  ctx.fillStyle = '#e8f6ef'; ctx.font = '700 46px "Familjen Grotesk", sans-serif';
  const lines = wrap(ctx, c.title, W - 56).slice(0, 3);
  lines.forEach((l, i) => ctx.fillText(l, 28, 112 + i * 52));
  let y = 112 + lines.length * 52;
  if (c.sub) { ctx.fillStyle = '#9fc9b6'; ctx.font = '500 22px ui-monospace, Consolas, monospace'; wrap(ctx, c.sub, W - 56).slice(0, 2).forEach((l, i) => ctx.fillText(l, 28, y + 4 + i * 30)); }
  if (blink) { ctx.fillStyle = '#7fd3b4'; ctx.fillRect(28, H - 46, 18, 26); }
  // le jour l'écran est un peu moins lumineux
  const lum = 0.72 + 0.28 * Math.max(night.user, P.night);
  screen.mat.color.setScalar(lum);
  tex.needsUpdate = true;
}

// ---------- ligne de temps calée sur le scroll ----------
let tl;
function buildTimeline() {
  if (tl) { tl.scrollTrigger.kill(); tl.kill(); }
  const vh = innerHeight;
  const tops = sections.map((s) => s.offsetTop);
  const heights = sections.map((s) => s.offsetHeight);
  const total = document.documentElement.scrollHeight - vh;
  const poseOf = (i) => {
    const p = POSES[keyOf(sections[i])] || POSES.accueil;
    const m = mobile();
    const f = (m ? null : FOCI[p.focus]) || FOCI.piece;   // téléphone : toujours la pièce entière
    // téléphone : la pièce est cadrée dans la « fenêtre » en haut de chaque section (au-dessus du rideau de texte)
    return {
      fx: f.x, fy: f.y, fz: f.z, rot: p.rot, elev: p.elev, night: p.night || 0,
      offX: m ? 0 : p.offX,
      zoom: m ? MOB_ZOOM * (p.focus === 'piece' ? 1 : 1.12) : p.zoom,
      ...(m && { rot: p.rot * MOB_ROT, elev: 35 + (p.elev - 35) * 0.6 }),
    };
  };
  Object.assign(P, poseOf(0));

  tl = gsap.timeline({ defaults: { ease: 'none' }, paused: true });
  let t = 0;
  if (mobile()) {
    // téléphone : toujours la pièce entière, sans gros plan. D'une section à l'autre, elle tourne et change
    // d'angle doucement ; le mouvement est étalé sur toute la longueur de la section (lent et continu).
    P.offY = MOB_OFFY;
    tl.to(P, { offY: 0, duration: Math.max(tops[1] || vh, 1), ease: 'sine.inOut' }, 0);   // après l'accueil : la pièce se centre
    for (let i = 0; i + 1 < sections.length; i++) {
      const n = poseOf(i + 1);
      tl.to(P, { rot: n.rot, elev: n.elev, zoom: n.zoom, duration: Math.max(tops[i + 1] - tops[i], 1), ease: 'sine.inOut' }, tops[i]);
      if (n.night) tl.to(P, { night: 1, duration: Math.max(Math.min(vh, tops[i + 1] - tops[i]), 1), ease: 'sine.inOut' }, tops[i + 1] - Math.min(vh, tops[i + 1] - tops[i]));
    }
    const last = tops[sections.length - 1];
    if (total > last) tl.to(P, { rot: poseOf(sections.length - 1).rot + DRIFT, duration: total - last }, last);
  } else
  for (let i = 0; i < sections.length; i++) {
    const p = poseOf(i);
    const inside = Math.max(heights[i] - vh, 0);
    // pendant la lecture d'une section : le plan continue d'évoluer doucement
    if (inside > 1) {
      const d = POSES[keyOf(sections[i])]?.drift || {};
      tl.to(P, { rot: d.rot ?? p.rot + DRIFT, zoom: mobile() ? p.zoom : (d.zoom ?? p.zoom), elev: d.elev ?? p.elev, offX: mobile() ? 0 : (d.offX ?? p.offX), duration: inside, ease: 'sine.inOut' }, t);
      t += inside;
    }
    if (i + 1 < sections.length) {
      // passage vers la section suivante, pendant que celle-ci monte dans l'écran
      const n = poseOf(i + 1);
      const span = Math.min(vh, tops[i + 1] - t);
      tl.to(P, { ...n, duration: span, ease: 'sine.inOut' }, t);
      t += span;
    }
  }
  mainST = ScrollTrigger.create({
    trigger: document.documentElement, start: 0, end: () => document.documentElement.scrollHeight - innerHeight,
    animation: tl, scrub: FILM || reduceMotion ? true : 0.4,   // la chambre suit avec un léger amorti, à part du texte
  });
  // zones de transition (entre la fin de lecture d'une section et le début de la suivante)
  transitions = [];
  for (let i = 0; i + 1 < sections.length; i++) {
    transitions.push({ from: tops[i] + Math.max(heights[i] - vh, 0), to: tops[i + 1] });
  }
}

// ---------- aimant : on ne reste jamais arrêté au milieu d'une transition ----------
// Quand la molette s'arrête dans une zone de transition, la page finit le mouvement
// vers la section la plus proche. Pendant la lecture d'une section, rien ne bouge tout seul.
let transitions = [], idle, snapping = false;
if (lenis) {
  lenis.on('scroll', () => {
    clearTimeout(idle);
    if (snapping || mobile()) return;   // pas d'aimant sur téléphone : les sections y sont plus courtes que l'écran
    idle = setTimeout(() => {
      const y = lenis.scroll;
      const z = transitions.find((r) => y > r.from + 2 && y < r.to - 2);
      if (!z) return;
      const f = (y - z.from) / (z.to - z.from);
      snapping = true;
      lenis.scrollTo(f > 0.45 ? z.to : z.from, {
        duration: 0.9, easing: (t) => 1 - Math.pow(1 - t, 3),
        onComplete: () => { snapping = false; },
      });
      setTimeout(() => { snapping = false; }, 1200);
    }, 140);
  });
}

// aplats de couleur : s'étirent depuis le bas pendant que la section arrive
document.querySelectorAll('.wash').forEach((w) => {
  gsap.fromTo(w, { scaleX: 0.55, borderTopLeftRadius: '50vw', borderTopRightRadius: '50vw' }, {
    scaleX: 1, borderTopLeftRadius: '0vw', borderTopRightRadius: '0vw', ease: 'none',
    scrollTrigger: { trigger: w.parentElement, start: 'top bottom', end: () => (mobile() ? 'top 35%' : 'top 40%'), scrub: FILM ? true : 0.25 },
  });
});
// barre du haut : prend la couleur de la section affichée (un changement de classe par section)
sections.forEach((s) => ScrollTrigger.create({
  trigger: s, start: () => (mobile() ? 'top 55%' : 'top 8%'), end: () => (mobile() ? 'bottom 55%' : 'bottom 8%'),
  onToggle: (st) => {
    if (!st.isActive) return;
    topBar.dataset.color = s.dataset.color || '';
    stageEl.dataset.color = s.dataset.color || '';
    navLinks.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + s.id)));
  },
}));

// ---------- fiches détail des projets ----------
document.querySelectorAll('[data-modal]').forEach((b) => b.addEventListener('click', (e) => {
  e.preventDefault(); e.stopPropagation();
  const d = document.getElementById(b.dataset.modal); if (!d) return;
  d.showModal(); lenis?.stop();
}));
document.querySelectorAll('dialog.modal').forEach((d) => {
  d.addEventListener('close', () => lenis?.start());
  d.querySelector('.modal__close')?.addEventListener('click', () => d.close());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });   // clic sur le fond
});

// ---------- mode nuit manuel ----------
const night = { user: 0 };
try { if (localStorage.getItem('nuit') === '1') queueMicrotask(() => setNight(true, true)); } catch {}
lampBtn.addEventListener('click', () => setNight(lampBtn.getAttribute('aria-pressed') !== 'true'));
function setNight(on, instant = false) {
  lampBtn.setAttribute('aria-pressed', String(on));
  lampBtn.title = on ? T.lampOff : T.lampOn;
  const root = document.documentElement;
  if (!instant) { root.classList.add('theme-anim'); setTimeout(() => root.classList.remove('theme-anim'), 900); }
  root.classList.toggle('nuit', on);
  try { localStorage.setItem('nuit', on ? '1' : '0'); } catch {}
  gsap.to(night, { user: on ? 1 : 0, duration: reduceMotion || instant ? 0 : 0.8, ease: 'power2.inOut' });
}

// ---------- survol / clic ----------
const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2();
function pick(ev) {
  const r = canvas.getBoundingClientRect();
  ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects(pickables, false)[0];
  return hit ? hit.object.userData.group : null;
}
canvas.addEventListener('pointermove', (ev) => {
  if (!ready || P.build < 0.99) return;
  const k = pick(ev);
  if (k === hovered) return;
  hovered = k;
  canvas.style.cursor = k ? 'pointer' : '';
  const g = k && groups.get(k);
  hint.textContent = g ? `${T.labels[k] || g.def.label}${T.sep}${g.def.action ? T.light : titleOf(g.def.to)}` : '';
  hint.classList.toggle('is-on', !!g);
});
canvas.addEventListener('pointerleave', () => { hovered = null; hint.classList.remove('is-on'); canvas.style.cursor = ''; });
canvas.addEventListener('click', (ev) => {
  const k = pick(ev); if (!k) return;
  const g = groups.get(k);
  if (g.def.action === 'nuit') return setNight(lampBtn.getAttribute('aria-pressed') !== 'true');
  if (k === 'tortue') gsap.fromTo(g, { hop: 0 }, { hop: 1, duration: 0.6, ease: 'sine.inOut' });
  goTo(byKey(g.def.to));
});
const titleOf = (k) => byKey(k)?.querySelector('.title')?.textContent || k;

// ---------- une image ----------
const ORDER = ['shell', ...GROUPS.map((d) => d.key), 'deco'];
const backOut = (x) => { const c = 1.25; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
const lerp = (a, b, t) => a + (b - a) * t;
let lastDt = 0;

function resize() {
  const t = document.querySelector('.page:not(.page--hero) .title');
  if (t) textEdge = Math.min(0.5, t.getBoundingClientRect().right / innerWidth + 0.03);
  const w = stageEl.clientWidth || innerWidth, h = stageEl.clientHeight || innerHeight;
  renderer?.setSize(w, h, false);
  const a = w / h;
  Object.assign(camera, { left: -HALF * a, right: HALF * a, top: HALF, bottom: -HALF });
  camera.updateProjectionMatrix();
}
resize();
let rt;
addEventListener('resize', () => { resize(); clearTimeout(rt); rt = setTimeout(() => { ScrollTrigger.refresh(); if (ready) buildTimeline(); }, 150); });

function renderFrame(dt = 0.016) {
  if (!ready) return;
  // caméra : on vise le point du plan (pièce ou objet), placé à offX sur l'écran, sous l'angle elev
  const a = (stageEl.clientWidth || innerWidth) / (stageEl.clientHeight || innerHeight);
  const z = P.zoom;
  const el = THREE.MathUtils.degToRad(P.elev);
  DIR.set(Math.cos(el) * Math.SQRT1_2, Math.sin(el), Math.cos(el) * Math.SQRT1_2);
  RIGHT.crossVectors(Y, DIR).normalize();
  UPV.crossVectors(DIR, RIGHT).normalize();
  pivot.rotation.y = P.rot;
  pivot.updateMatrixWorld();
  focusW.set(P.fx, P.fy, P.fz).applyMatrix4(pivot.matrixWorld);
  target.copy(focusW)
    .addScaledVector(RIGHT, -P.offX * 2 * HALF * a / z)
    .addScaledVector(UPV, -(mobile() ? P.offY ?? 0 : 0) * 2 * HALF / z);   // téléphone : pièce remontée à l'accueil, centrée ensuite
  if (!mobile()) {
    // la chambre ne passe jamais sous le texte : si son bord gauche dépasse, on la décale vers la droite
    let left = Infinity;
    for (const c of ROOM_CORNERS) {
      tmpV.copy(c).applyMatrix4(pivot.matrixWorld).sub(target);
      left = Math.min(left, tmpV.dot(RIGHT));                 // distance horizontale au centre de l'écran
    }
    const halfW = HALF * a / z;                                // demi-largeur visible
    const minLeft = (textEdge - 0.5) * 2 * halfW;              // le bord du texte, dans le même repère
    if (left < minLeft) target.addScaledVector(RIGHT, left - minLeft);
  }
  camera.position.copy(target).addScaledVector(DIR, 30);
  camera.lookAt(target);
  if (camera.zoom !== z) { camera.zoom = z; camera.updateProjectionMatrix(); }

  // nuit (scroll vers le Contact ou lampe allumée)
  const n = Math.max(P.night, night.user);
  hemi.color.copy(DAY.sky).lerp(NIGHT.sky, n);
  hemi.groundColor.copy(DAY.ground).lerp(NIGHT.ground, n);
  hemi.intensity = lerp(DAY.hemi, NIGHT.hemi, n);
  if (NEW_LOOK) scene.environmentIntensity = lerp(0.22, 0.04, n);
  sun.intensity = lerp(DAY.sun, NIGHT.sun, n);
  sun.color.copy(DAY.sunColor).lerp(NIGHT.sunColor, n);
  lampLight.intensity = 5 * n; aquaLight.intensity = 2.2 * n; screenLight.intensity = 1.2 * n;
  for (const m of emissiveMats) { const [d, nn] = EMISSIVE[m.name]; m.emissiveIntensity = lerp(d, nn, n); }

  // construction de la pièce, survol, petit saut de la tortue
  let moved = false;
  ORDER.forEach((key, i) => {
    const g = groups.get(key); if (!g) return;
    const start = key === 'shell' ? 0 : 0.12 + (i - 1) * 0.062;
    const p = Math.min(Math.max((P.build - start) / 0.28, 0), 1);
    const drop = key === 'shell' ? 0 : 1 - backOut(p);
    const lift = lerp(g.lift, key === hovered ? 0.05 : 0, 1 - Math.exp(-dt * 12));
    const y = drop * 2.6 + lift + Math.sin(g.hop * Math.PI) * 0.12;
    if (Math.abs(y - g.node.position.y) > 1e-4) moved = true;
    g.lift = lift; g.node.position.y = y;
    g.node.visible = key === 'shell' || p > 0;
    if (key === 'shell') g.node.scale.setScalar(0.85 + 0.15 * Math.min(P.build / 0.12, 1));
  });
  if (turtle) {
    // la tortue se promène lentement au fond de l'aquarium (pas d'ombre : rien à recalculer)
    const tt = performance.now() / 1000;
    turtle.position.x = turtle.userData.home.x + Math.sin(tt * 0.35) * 0.1;
    turtle.position.z = turtle.userData.home.z + Math.sin(tt * 0.22) * 0.035;
    turtle.rotation.y = Math.cos(tt * 0.35) > 0 ? lerp(turtle.rotation.y, 0, 0.03) : lerp(turtle.rotation.y, Math.PI, 0.03);
  }
  if (screen && performance.now() - screen.last > 530) drawScreen();
  if (moved) renderer.shadowMap.needsUpdate = true;

  scene.updateMatrixWorld();
  sun.shadow.updateMatrices(sun);          // l'ombre suit la rotation sans être redessinée
  renderer.render(scene, camera);
}
// debug : bord gauche de la chambre à l'écran (0 = bord gauche, 1 = bord droit)
window.__render = (dt) => renderFrame(dt);
window.__groups = groups; window.__THREE = THREE;
window.__roomLeft = () => {
  const box = new THREE.Box3();
  for (const [k, g] of groups) if (k !== 'deco' || true) box.expandByObject(g.node);
  let min = 1;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const v = new THREE.Vector3(x, y, z).project(camera); min = Math.min(min, (v.x + 1) / 2);
  }
  return +min.toFixed(3);
};
gsap.ticker.add((time, deltaMs) => { lastDt = deltaMs / 1000; renderFrame(lastDt); });

// ---------- film de contrôle : ?film ----------
// Rend la page tous les ~2 % de scroll et assemble une planche, pour voir le mouvement image par image.
async function runFilm() {
  const N = 48, cols = 8, w = Math.floor(innerWidth / 8) - 2, h = Math.round(w * innerHeight / innerWidth);
  const sheet = document.createElement('canvas');
  sheet.width = cols * w; sheet.height = Math.ceil(N / cols) * h;
  const ctx = sheet.getContext('2d');
  const max = document.documentElement.scrollHeight - innerHeight;
  for (let i = 0; i < N; i++) {
    const y = Math.round((i / (N - 1)) * max);
    window.scrollTo(0, y); ScrollTrigger.update();
    await new Promise((r) => setTimeout(r, 30));
    renderFrame(1);
    const mid = document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('.page');
    const bg = mid ? getComputedStyle(mid).getPropertyValue('--bg').trim() : '#f4ecd6';
    const x0 = (i % cols) * w, y0 = Math.floor(i / cols) * h;
    ctx.fillStyle = bg || '#f4ecd6'; ctx.fillRect(x0, y0, w, h);
    ctx.drawImage(renderer.domElement, x0, y0, w, h);
    const colW = (document.querySelector('.page > .title')?.getBoundingClientRect().right || innerWidth * 0.42) / innerWidth * w;
    ctx.fillStyle = '#c0392b22'; ctx.fillRect(x0, y0, colW, h);
    ctx.fillStyle = '#000a'; ctx.font = '12px sans-serif';
    ctx.fillText(`${Math.round((y / max) * 100)} % ${mid ? mid.id : ''}`, x0 + 6, y0 + 14);
    ctx.strokeStyle = '#0003'; ctx.strokeRect(x0, y0, w, h);
  }
  const box = document.createElement('div'); box.className = 'film'; box.appendChild(sheet);
  document.body.appendChild(box);
  window.__film = true;
}
