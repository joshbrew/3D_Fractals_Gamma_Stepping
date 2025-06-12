//Joshua Brewster - MIT License

import './index.css'
import html from './component.html'
import wrkr from './fractals.worker.js'

//component body
document.head.insertAdjacentHTML('afterbegin', `<title>3-D Fractal Point Cloud</title>`);
document.body.insertAdjacentHTML('afterbegin', html);

function paintRange(el) {
  const pct = 100 * (el.value - el.min) / (el.max - el.min);
  el.style.setProperty('--percent', pct + '%');
}
document.querySelectorAll('#ui input[type=range]').forEach(slider => {
  paintRange(slider);                    // initial paint
  slider.addEventListener('input', () => paintRange(slider));
});

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
/* ------- constants (unchanged) ------- */
let gridSize = 800, zMin = 0, zMax = 2, dz = .02, numLayers = Math.round((zMax - zMin) / dz) + 1, dx = 0, dy = 0;
let ptsPerLayer = gridSize * gridSize, zoom = 4, escapeR = 4, maxIter = 100;
let MAX_WORKERS = Math.min(navigator.hardwareConcurrency || 4, 8);
let scaleM = 1;
let totalPts = ptsPerLayer * numLayers;                  // initialise count s
/* ------- UI refs ------- */
const $ = id => document.getElementById(id);

/* raw elements ---------------------------------------------------------- */
const controlMode = $('controlMode');
const fractalType = $('fractalType');
const colorScheme = $('colorScheme');
const alphaMode = $('alphaMode');
const thresholdBasis = $('thresholdBasis');
const lowThresh = $('lowThresh');
const highThresh = $('highThresh');
const lowVal = $('lowVal');
const highVal = $('highVal');
const clipX = $('clipX');
const clipY = $('clipY');
const clipZ = $('clipZ');
const clipXVal = $('clipXVal');
const clipYVal = $('clipYVal');
const clipZVal = $('clipZVal');
const layerVis = $('layerVis');
const layerVal = $('layerVal');
const ptSize = $('ptSize');
const zScale = $('zScale'), zVal = $('zVal');
const ptVal = $('ptVal');
const loading = $('loading');
const pGrid = $('pGrid');
const pZmin = $('pZmin');
const pZmax = $('pZmax');
const pDz = $('pDz');
const pZoom = $('pZoom');
const pEsc = $('pEsc');
const pIter = $('pIter');
const pDx = $('pDx');
const pDy = $('pDy');
const scaleMode = $('scaleMode');
const resetAll = $('resetAll');
const applyParams = $('applyParams');


// const pJuliaMode = $('pJuliaMode'),
//   pJuliaRe = $('pJuliaRe'),
//   pJuliaIm = $('pJuliaIm');
/* ------------------------------------------------------------------ *
 *  save each control’s initial value so we can return to it on Reset *
 * ------------------------------------------------------------------ */
const defaults = {
  /* sliders -------------------------------------------------------- */
  low: +lowThresh.value,
  high: +highThresh.value,
  clipX: +clipX.value, clipY: +clipY.value, clipZ: +clipZ.value,
  layers: +layerVis.value,
  ptSize: +ptSize.value,
  zScale: +zScale.value,

  /* render-parameter <input type="number"> fields ------------------ */
  grid: +pGrid.value,
  zMin: +pZmin.value, zMax: +pZmax.value, dz: +pDz.value,
  zoom: +pZoom.value, escR: +pEsc.value, iter: +pIter.value,
  dx: +pDx.value, dy: +pDy.value, scaleMode:scaleMode.value,
  // juliaMode: pJuliaMode.checked,
  // juliaRe: +pJuliaRe.value,
  // juliaIm: +pJuliaIm.value
};


/* ================================================================ *
*  RESET ↩︎  — restores every slider / number box to its default    *
*  (keeps fractalType, colorScheme, alphaMode & thresholdBasis)    *
* ================================================================ */
resetAll.addEventListener('click', () => {

  /* sliders ------------------------------------------------------- */
  setSlider(lowThresh, defaults.low);
  setSlider(highThresh, defaults.high);
  setSlider(clipX, defaults.clipX);
  setSlider(clipY, defaults.clipY);
  setSlider(clipZ, defaults.clipZ);
  setSlider(layerVis, defaults.layers);
  setSlider(ptSize, defaults.ptSize);
  setSlider(zScale, defaults.zScale);
  setVisibleLayers(defaults.layers);      // sync geometry draw-range

  /* numeric render parameters ------------------------------------ */
  pGrid.value = defaults.grid;
  pZmin.value = defaults.zMin; pZmax.value = defaults.zMax; pDz.value = defaults.dz;
  pZoom.value = defaults.zoom; pEsc.value = defaults.escR; pIter.value = defaults.iter;
  pDx.value = defaults.dx; pDy.value = defaults.dy;
  scaleMode.value = defaults.scaleMode;
  // pJuliaMode.checked = defaults.juliaMode;
  // pJuliaRe.value = defaults.juliaRe;
  // pJuliaIm.value = defaults.juliaIm;
  /* update uniforms, ranges, on-screen numbers ------------------- */
  upd();

  /* rebuild scene with pristine render params -------------------- */
  gridSize = defaults.grid;
  zMin = defaults.zMin;
  zMax = defaults.zMax;
  dz = defaults.dz;
  zoom = defaults.zoom;
  escapeR = defaults.escR;
  maxIter = defaults.iter;
  dx = defaults.dx;
  dy = defaults.dy;
  camera.position.set(0, -zoom * 1.5, zoom);

  rebuildScene();                // full recompute & redraw
});

/* keep the object exactly as you already had it ------------------------- */
const ui = {
  fractal: fractalType, scheme: colorScheme, alpha: alphaMode, basis: thresholdBasis,
  low: lowThresh, high: highThresh, lowVal, highVal,
  clipX, clipY, clipZ, clipXVal, clipYVal, clipZVal,
  layerVis, layerVal, ptSize, ptVal, loading, pDx, pDy, scaleMode,
  pGrid, pZmin, pZmax, pDz, pZoom, pEsc, pIter, apply: applyParams
};

/* ------- THREE setup (identical) ------- */
let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .1, 1000);
camera.position.set(0, -zoom * 1.5, zoom);
let renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(innerWidth, innerHeight);
renderer.getContext().disable(renderer.getContext().CULL_FACE);
document.body.appendChild(renderer.domElement);
let controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;

/* ------- geometry buffers ------- */
let posBuf = new Float32Array(totalPts * 3), ratBuf = new Float32Array(totalPts), lyrBuf = new Float32Array(totalPts);
let geom = new THREE.BufferGeometry();
geom.setAttribute('position', new THREE.BufferAttribute(posBuf, 3));
geom.setAttribute('ratio', new THREE.BufferAttribute(ratBuf, 1));
geom.setAttribute('layerIdx', new THREE.BufferAttribute(lyrBuf, 1));
geom.setDrawRange(0, 0);

/* ------- uniforms & shaders  – same as before  ------- */
const uniforms = {
  lowT: { value: +ui.low.value }, highT: { value: +ui.high.value },
  alphaMode: { value: +ui.alpha.value }, basis: { value: +ui.basis.value },
  scheme: { value: +ui.scheme.value },
  clipX: { value: +ui.clipX.value }, clipY: { value: +ui.clipY.value }, clipZ: { value: +ui.clipZ.value },
  worldCell: { value: zoom / (gridSize - 1) },
  pointScale: { value: +ui.ptSize.value },
  zGap: { value: +zScale.value },
  viewport: { value: new THREE.Vector2(innerWidth, innerHeight) }
};

const mat = new THREE.ShaderMaterial({
  transparent: true, depthTest: true, depthWrite: true,
  blending: THREE.NormalBlending, uniforms,
  vertexShader:/* glsl */`
precision highp float;
attribute float ratio, layerIdx;
varying   float vR, vL;
varying   vec3  vW;
uniform float worldCell, pointScale, zGap;
uniform vec2  viewport;
void main () {
vR = ratio;  vL = layerIdx;

/* scale Z by the new uniform before anything else */

vec3 pos = vec3(position.xy, position.z * zGap - zGap);
vW = pos;

vec4 mv = modelViewMatrix * vec4(pos, 1.0);
float d = -mv.z;
gl_PointSize = max(1.0,
                 worldCell * pointScale *
                 projectionMatrix[1][1] * viewport.y / d);
gl_Position = projectionMatrix * mv;
}`,
  fragmentShader: /* glsl */`
precision highp float;

varying vec3  vW;
varying float vR, vL;

uniform float lowT, highT;
uniform int   alphaMode, basis, scheme;
uniform float clipX, clipY, clipZ, worldCell, zGap;

/* ---------- helpers ---------- */
vec3 hsl2rgb (vec3 hsl) {
float H = hsl.x, S = hsl.y, L = hsl.z;
float C = (1.0 - abs(2.0 * L - 1.0)) * S;
float X = C * (1.0 - abs(mod(H * 6.0, 2.0) - 1.0));
float m = L - 0.5 * C;
vec3  rgb =
    (H < 1.0/6.0) ? vec3(C, X, 0.0) :
    (H < 2.0/6.0) ? vec3(X, C, 0.0) :
    (H < 3.0/6.0) ? vec3(0.0, C, X) :
    (H < 4.0/6.0) ? vec3(0.0, X, C) :
    (H < 5.0/6.0) ? vec3(X, 0.0, C) :
                     vec3(C, 0.0, X);
return rgb + m;
}

/* disengages when slider ≈ 2.0 */
float clipGate (float coord, float cut) {
return (cut >= 1.999)
   ? 1.0
   : smoothstep(cut, cut - worldCell, coord);
}

/* ---------- main ---------- */
void main () {
float a = 1.0;
if (alphaMode == 1)      a = vR;
else if (alphaMode == 2) a = 1.0 - vR;

/* apply X/Y/Z clip gates */
a *= clipGate(vW.x, clipX)
 * clipGate(vW.y, clipY)
 * clipGate(vW.z / zGap + 1.0, clipZ);

float val = (basis == 1 ? vL : vR);
if (val < lowT || val > highT || a < 0.01) discard;

float r = vR, H, L;


  if(scheme==0){                       /* Violet-Cyan-White */
    H = (260.0 - 260.0*pow(r,0.9)) / 360.0;
    L = (10.0  + 65.0 *pow(r,1.2)) / 100.0;

  }else if(scheme==1){                 /* Fire */
    H = ( 0.0 + 60.0*r) / 360.0;
    L = 0.50 + 0.50*r;

  }else if(scheme==2){                 /* Ice */
    H = (200.0 - 100.0*r) / 360.0;
    L = 0.30 + 0.70*r;

  }else if(scheme==3){                 /* Sunset */
    H = ( 30.0 + 270.0*r) / 360.0;
    L = 0.30 + 0.40*r;

  }else if(scheme==4){                 /* Forest */
    H = (120.0 -  90.0*r) / 360.0;
    L = 0.20 + 0.50*r;

  }else if(scheme==5){                 /* Neon */
    H = (300.0 - 240.0*r) / 360.0;
    L = 0.55 + 0.20*sin(r*3.14159);

  }else if(scheme==6){                 /* Grayscale */
    gl_FragColor = vec4(vec3(r), a);
    return;

  /* --- retuned Inferno (dark purple → red → gold, no green cast) --- */
  }else if(scheme==7){
    H = (10.0 + 60.0*pow(r,1.2)) / 360.0;   // 10°→70°
    L = 0.15 + 0.75*pow(r,1.5);

  /* --- rainbow & pastel gimmicks --- */
  }else if(scheme==8){                      /* Rainbow 360° */
    H = r;
    L = 0.45 + 0.25*(1.0 - r);

  }else if(scheme==9){                      /* Rainbow 720° */
    H = mod(2.0*r, 1.0);
    L = 0.50;

  }else if(scheme==10){                     /* Pastel loop */
    H = mod(3.0*r + 0.1, 1.0);
    L = 0.65;

  }else if(scheme==11){                     /* Viridis-ish */
    H = 0.75 - 0.55*r;                      // 270°→72°
    L = 0.25 + 0.55*r*r;

  /* --- NEW darker / cooler palettes --- */
  }else if(scheme==12){                     /* Magma */
    H = (5.0 + 70.0*r) / 360.0;             // deep plum → yellow-orange
    L = 0.10 + 0.80*pow(r,1.4);

  }else if(scheme==13){                     /* Plasma */
    H = (260.0 - 260.0*r) / 360.0;          // purple → yellow
    L = 0.30 + 0.60*pow(r,0.8);

  }else if(scheme==14){                     /* Cividis */
    H = (230.0 - 160.0*r) / 360.0;          // blue-green → orange
    L = 0.25 + 0.60*r;

  }else if(scheme==15){                     /* Ocean */
    H = (200.0 + 40.0*r) / 360.0;           // teal → azure
    L = 0.20 + 0.50*r;

  }else if(scheme==16){                     /* Midnight Blue */
    H = 0.6;                               // ~250°
    L = 0.15 + 0.35*r;

  }else if(scheme==17){                     /* Cool-Warm diverging */
    H = r < 0.5
        ? mix(0.55, 0.75, r*2.0)            // cyan-blue branch
        : mix(0.02, 0.11, (r-0.5)*2.0);     // orange-red branch
    L = 0.25 + 0.55*abs(r-0.5);

  /* fallback: old Inferno-style if scheme out of range */
  }else{
    H = (40.0 + 310.0*pow(r,1.3)) / 360.0;
    L = 0.20 + 0.50*pow(r,0.8);
  }
  vec3 col = hsl2rgb(vec3(H, 1.0, L));
  gl_FragColor = vec4(col, a);
}`
});
let points = new THREE.Points(geom, mat);
points.frustumCulled = false;          // keep everything visible for now
scene.add(points);

/* ------- UI → uniforms ------- */
function upd() {
  uniforms.lowT.value = +ui.low.value; ui.lowVal.textContent = (+ui.low.value).toFixed(2);
  uniforms.highT.value = +ui.high.value; ui.highVal.textContent = (+ui.high.value).toFixed(2);
  uniforms.alphaMode.value = +ui.alpha.value;
  uniforms.basis.value = +ui.basis.value;
  uniforms.scheme.value = +ui.scheme.value;

  uniforms.clipX.value = +ui.clipX.value; ui.clipXVal.textContent = (+ui.clipX.value).toFixed(2);
  uniforms.clipY.value = +ui.clipY.value; ui.clipYVal.textContent = (+ui.clipY.value).toFixed(2);
  uniforms.clipZ.value = +ui.clipZ.value; ui.clipZVal.textContent = (+ui.clipZ.value).toFixed(2);
  uniforms.zGap.value = +zScale.value; zVal.textContent = (+zScale.value).toFixed(2);
  uniforms.pointScale.value = +ui.ptSize.value; ui.ptVal.textContent = (+ui.ptSize.value).toFixed(2);
}
[ui.low, ui.high, ui.alpha, ui.basis, ui.scheme,
ui.clipX, ui.clipY, ui.clipZ,
ui.ptSize, zScale].forEach(e => e.addEventListener('input', upd));
upd();

ui.layerVis.addEventListener('input', () => setVisibleLayers(+ui.layerVis.value));
/* keep slider in-step with geometry draw-range */
function setVisibleLayers(n) {
  const count = Math.max(1, n | 0);          // 1 … numLayers

  geom.setDrawRange(0, count * ptsPerLayer); // show that many layers
  ui.layerVal.textContent = count;           // numeric label
  ui.layerVis.value = count;                 // ← sync the slider itself
  paintRange(ui.layerVis);                   //   and repaint the fill track
}

/* ───── render-parameter “Apply” button ───── */
ui.apply.addEventListener('click', () => {
  gridSize = +ui.pGrid.value | 0;
  zMin = +ui.pZmin.value;
  zMax = +ui.pZmax.value;
  dz = +ui.pDz.value;
  zoom = +ui.pZoom.value;
  escapeR = +ui.pEsc.value;
  maxIter = +ui.pIter.value;
  dx = +ui.pDx.value;
  dy = +ui.pDy.value;
  camera.position.set(0, -zoom * 1.5, zoom);
  scaleM = +ui.scaleMode.value;
  rebuildScene();
});

/* WASD state ---------------------------------------------------------- */
const move = { f: 0, b: 0, l: 0, r: 0 };   // forward/back/left/right flags
const WALK_SPEED = 4;                  // units - per - second (tweak!)
const fpsControls = new PointerLockControls(camera, renderer.domElement);
let inFPS = false;          // current mode flag

/* ─── keyboard shortcuts for five sliders ──────────────────────────── */
const binds = [
  /* Low α  – Q / E */
  {
    inc: 'KeyQ', dec: 'KeyE', el: lowThresh, step: +lowThresh.step || 0.01,
    after: () => { paintRange(lowThresh); upd(); }
  },

  /* High α – G / F */
  {
    inc: 'KeyG', dec: 'KeyF', el: highThresh, step: +highThresh.step || 0.01,
    after: () => { paintRange(highThresh); upd(); }
  },

  /* Visible layers – V / B   (unique keys now) */
  {
    inc: 'KeyV', dec: 'KeyB', el: layerVis, step: +layerVis.step || 1,
    after: () => { setVisibleLayers(+layerVis.value); paintRange(layerVis); }
  },

  /* Point size – X / Z */
  {
    inc: 'KeyX', dec: 'KeyZ', el: ptSize, step: +ptSize.step || 0.05,
    after: () => { paintRange(ptSize); upd(); }
  },

  /* Z-spacing – M / N  (unchanged) */
  {
    inc: 'KeyM', dec: 'KeyN', el: zScale, step: +zScale.step || 0.1,
    after: () => { paintRange(zScale); upd(); }
  }
];


/* ❶  Robust slider update — never lets High ≤ Low  -------------------- */
function nudgeSlider(sl, delta) {
  const step = +sl.step || 0.01,
    min = +sl.min,
    max = +sl.max;

  /* snap to the slider’s own grid */
  let val = +sl.value + delta;
  val = Math.round(val / step) * step;
  val = Math.min(max, Math.max(min, val));

  /* ------------------------------------------------------------------ */
  if (sl === lowThresh) {                    /* editing LOW α ---------- */
    /* if we collide with High α → nudge High upward */
    if (val > +highThresh.value - step) {
      highThresh.value = (val + step).toFixed(2);
      paintRange(highThresh);
    }
  } else if (sl === highThresh) {            /* editing HIGH α --------- */
    /* if we collide with Low α → nudge Low downward */
    if (val < +lowThresh.value + step) {
      lowThresh.value = (val - step).toFixed(2);
      paintRange(lowThresh);
    }
  }

  /* write the new value and refresh */
  sl.value = val.toFixed(step < 1 ? 2 : 0);
  paintRange(sl);
  upd();
}

/* ❷  Fixed-rate key repeat (no OS acceleration) ----------------------- */
const timers = new Map();           // keyCode → intervalID

function startRepeat(code, bind, dir) {
  if (timers.has(code)) return;     // already running
  // first tick immediately
  nudgeSlider(bind.el, dir * bind.step); bind.after();
  // then steady 16 Hz repeat
  timers.set(code, setInterval(() => {
    nudgeSlider(bind.el, dir * bind.step);
    bind.after();
  }, 62.5));
}
function stopRepeat(code) {
  clearInterval(timers.get(code));
  timers.delete(code);
}

/* ❸  Key handlers ----------------------------------------------------- */
addEventListener('keydown', e => {
  for (const b of binds) {
    if (e.code === b.inc) startRepeat(e.code, b, +1);
    if (e.code === b.dec) startRepeat(e.code, b, -1);
  }
  if (!e.repeat) {
    if (e.code === 'KeyW') move.f = 1;
    if (e.code === 'KeyS') move.b = 1;
    if (e.code === 'KeyA') move.l = 1;
    if (e.code === 'KeyD') move.r = 1;
    if (e.code === 'Escape' && inFPS) fpsControls.unlock();
  }
  if (!inFPS && (move.f || move.b || move.l || move.r)) {
    controls.enabled = false;
    fpsControls.lock();
  }
});

addEventListener('keyup', e => {
  stopRepeat(e.code);               // stop slider auto-repeat
  if (e.code === 'KeyW') move.f = 0;
  if (e.code === 'KeyS') move.b = 0;
  if (e.code === 'KeyA') move.l = 0;
  if (e.code === 'KeyD') move.r = 0;
});



fpsControls.addEventListener('lock', () => {
  inFPS = true;
  controls.enabled = false;        // freeze orbit while in FPS
});
fpsControls.addEventListener('unlock', () => {
  controls.enabled = true;
  inFPS = false;
});


/* ───── build / rebuild helpers ───── */

function buildGeometry() {
  recalcDerived();

  posBuf = new Float32Array(totalPts * 3);
  ratBuf = new Float32Array(totalPts);
  lyrBuf = new Float32Array(totalPts);

  geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(posBuf, 3));
  geom.setAttribute('ratio', new THREE.BufferAttribute(ratBuf, 1));
  geom.setAttribute('layerIdx', new THREE.BufferAttribute(lyrBuf, 1));
  geom.setDrawRange(0, 0);               // invisible until we animate

  points = new THREE.Points(geom, mat);
  points.frustumCulled = false;
}

function rebuildScene() {
  scene.remove(points);
  mat.dispose();
  geom.dispose();

  buildGeometry();
  scene.add(points);

  uniforms.worldCell.value = zoom / (gridSize - 1);

  revealStarted = false;
  revealPts = 0;

  compute();                              // restart worker pipeline
}

/* ───── reveal / wipe-on state ───── */
let revealStarted = false;
let revealPts = 0; let revealRate = 0;                 // points-per-second; set later
function recalcDerived() {
  numLayers = Math.round((zMax - zMin) / dz) + 1;
  ptsPerLayer = gridSize * gridSize;
  totalPts = ptsPerLayer * numLayers;
  ui.layerVis.max = numLayers;
  ui.layerVis.min = 1;
  ui.layerVis.value = numLayers;
  ui.layerVal.textContent = numLayers;
}


function finalizeGeometry() {
  geom.attributes.position.needsUpdate = true;
  geom.attributes.ratio.needsUpdate = true;
  geom.attributes.layerIdx.needsUpdate = true;
  ui.layerVis.value = numLayers;
  ui.layerVal.textContent = numLayers;

  ui.loading.style.display = 'none';
  revealStarted = true;                  // start wipe-on next frame
  revealPts = 0;
  revealRate = ptsPerLayer * 30;          // ≈ 6 layers-worth per second
  geom.setDrawRange(0, 0);
}

/* ------- build pool & compute ------- */
let nextK = 0, done = 0, curFrac = +ui.fractal.value;

function launch() {
  if (nextK >= numLayers) return;

  const k = nextK++;
  const w = new Worker(wrkr);
  console.log('created worker');

  w.postMessage({
    gridSize, k, zMin, dz, zoom, escapeR, maxIter, dx, dy,
    fractalType: curFrac, scaleMode: scaleM
  });

  w.onmessage = ({ data: { k, pos, rat } }) => {
    const p = new Float32Array(pos);
    const r = new Float32Array(rat);

    const offPts = k * ptsPerLayer;
    posBuf.set(p, offPts * 3);
    ratBuf.set(r, offPts);
    lyrBuf.fill(k / (numLayers - 1), offPts, offPts + ptsPerLayer);

    done++;
    ui.loading.textContent = `Loading layers: ${done} / ${numLayers}`;

    w.terminate();
    launch();                             // next slice

    if (done === numLayers) finalizeGeometry();
  };
}

function compute() {
  posBuf.fill(0);
  ratBuf.fill(0);
  lyrBuf.fill(0);

  nextK = done = 0;
  curFrac = +ui.fractal.value;

  geom.setDrawRange(0, 0);
  ui.loading.style.display = 'block';
  ui.loading.textContent = `Loading layers: 0 / ${numLayers}`;

  for (let i = 0; i < MAX_WORKERS; i++) launch();
}
compute();
ui.fractal.addEventListener('change', compute);

/* ------- animation loop & resize ------- */
let last = performance.now();
(function anim() {
  requestAnimationFrame(anim);

  const now = performance.now();
  const dt = (now - last) / 1000;     // seconds
  last = now;

  if (revealStarted && revealPts < totalPts) {
    revealPts = Math.min(totalPts, revealPts + revealRate * dt);
    geom.setDrawRange(0, revealPts | 0);
  }

  /* --- positional WASD in whichever mode we're in --- */
  if (move.f || move.b || move.l || move.r) {
    const step = WALK_SPEED * dt;

    let fwd = new THREE.Vector3();
    if (inFPS) {
      //  pointer-lock: forward = camera’s current look direction
      fpsControls.getDirection(fwd);   // unit vector
    } else {
      //  orbit: forward toward the target point
      fwd.subVectors(controls.target, camera.position).normalize();
    }
    const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();

    const delta = new THREE.Vector3()
      .addScaledVector(fwd, step * (move.f - move.b))
      .addScaledVector(right, step * (move.r - move.l));

    camera.position.add(delta);
    if (!inFPS) controls.target.add(delta);   // keep dolly motion in orbit mode
  }

  if (!inFPS) controls.update();
  renderer.render(scene, camera);
}());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  uniforms.viewport.value.set(innerWidth, innerHeight);
});