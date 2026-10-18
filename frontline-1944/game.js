// ============================================================
//  FRONTLINE 1944 (3D) — built with Three.js
//  The game logic happens on a flat map (x and z, like the 2D
//  version). Three.js then draws it in 3D with a camera behind
//  each soldier.
//  Sections: 1 settings · 2 map · 3 3D world · 4 soldiers
//            5 game rules · 6 drawing · 7 controls
// ============================================================

const BUILD = 40;             // shown on screen, so you can tell the browser loaded the newest version
document.querySelector(".tag").textContent += " · build " + BUILD;

// ---------- 1) SETTINGS: change these to tweak the game ----------
const PLAYER_SPEED = 0.15;    // map units per frame (60 frames = 1 second)
const SPRINT_SPEED = 0.23;    // holding sprint while moving forward
const AGILITY = 0.28;         // how quickly soldiers speed up and stop (1 = instant)
const JUMP_POWER = 0.1;       // how fast you leave the ground (higher = jump higher)
const GRAVITY = 0.0085;       // how fast you come back down
const CROUCH_SPEED = 0.5;     // crouched walking speed, compared with normal walking
const ENEMY_SPEED = 0.08;
const ENEMY_TURN = 0.12;      // how fast enemies swing round to face you
const BULLET_SPEED = 1.1;
const TURN_SPEED = 0.045;     // how fast the keys turn you
const MOUSE_SENSITIVITY = 0.0025;
const MAX_HP = 180;          // how much health a soldier has
const REGEN_DELAY = 150;      // frames without being hit before health starts coming back (60 = 1 second)
const REGEN_RATE = 0.15;      // health regained per frame while recovering (0.15 = 9 per second)
const GRENADE_FUSE = 150;     // frames from throwing a grenade to the bang (60 = 1 second)
const GRENADE_RADIUS = 6;     // how far a grenade blast reaches
const GRENADE_DAMAGE = 160;   // damage right next to the blast (less further away)
const SMOKE_FUSE = 90;        // frames from throwing a smoke grenade until it starts pouring smoke
const SMOKE_TIME = 1200;      // how long it keeps pouring (60 = 1 second)
const SMOKE_RADIUS = 5;       // how big the cloud gets
const BANDAGE_HEAL = 60;      // health one bandage gives back
const BANDAGE_TIME = 70;      // frames it takes to put a bandage on
const SOUND_VOLUME = 0.9;      // overall loudness (press M in the game to mute)
const ALLIES = 10;            // computer-controlled soldiers on your side (topped up each wave)
const ALLY_HP = 100;
const EXTRA_ENEMIES = 60;     // extra enemy soldiers added to every wave
const SPAWN_GAP = 15;         // frames between enemies arriving (60 = 1 second)
const ALLY_TANKS = 2;         // Shermans on your side (replaced each wave if knocked out)
const ENEMY_TANKS = 2;        // Panzer IVs in the first wave (more come later)
const TANK_HP = 600;          // rifle bullets barely scratch a tank: use grenades
const TANK_SPEED = .045;      // map units per frame
const TANK_RELOAD = 300;      // frames between main gun shots
const SHELL_POWER = 1.3;      // a tank shell's blast compared with a grenade
const TANK_ARMOUR_BLAST = 1.8;   // how much blasts hurt tanks
const MAG_SIZE = 8;
const RELOAD_TIME = 70;
const MINX = -80, MAXX = 80, MINZ = -52, MAXZ = 52;   // edges of the battlefield (inside the barbed wire)
const WORLD_X = 150, WORLD_Z = 110;   // half the size of the whole landscape, including the woods outside the wire

// ---------- 2) THE MAP: sandbags and ruined walls (x, z = corner; w, d = size) ----------
const walls = [
  { x: -30, z: -18, w: 12, d: 2.6, type: "bags" },
  { x: 18,  z: -18, w: 12, d: 2.6, type: "bags" },
  { x: -6,  z: -5,  w: 2.6, d: 10, type: "bags" },
  { x: 3.4, z: -5,  w: 2.6, d: 10, type: "bags" },
  { x: -30, z: 15.4, w: 12, d: 2.6, type: "bags" },
  { x: 18,  z: 15.4, w: 12, d: 2.6, type: "bags" },
  { x: -39, z: -3,  w: 2.6, d: 6,  type: "bags" },
  { x: 36.4, z: -3, w: 2.6, d: 6,  type: "bags" },
  { x: -18, z: -26, w: 10, d: 1.2, type: "ruin" },
  { x: 8,   z: 24.8, w: 10, d: 1.2, type: "ruin" },
  // further out, in the wider field
  { x: -64, z: -40, w: 12, d: 2.6, type: "bags" },
  { x: 52,  z: -40, w: 12, d: 2.6, type: "bags" },
  { x: -64, z: 37.4, w: 12, d: 2.6, type: "bags" },
  { x: 52,  z: 37.4, w: 12, d: 2.6, type: "bags" },
  { x: -70, z: -6,  w: 2.6, d: 12, type: "bags" },
  { x: 67.4, z: -6, w: 2.6, d: 12, type: "bags" },
  { x: -5,  z: -42, w: 10, d: 2.6, type: "bags" },
  { x: -5,  z: 39.4, w: 10, d: 2.6, type: "bags" },
  { x: 44,  z: 14,  w: 2.6, d: 10, type: "bags" },
  { x: -46, z: 18,  w: 9, d: 1.2, type: "ruin" },
  { x: -42, z: -46, w: 10, d: 1.2, type: "ruin" },
  { x: 36,  z: 44,  w: 10, d: 1.2, type: "ruin" },
  { x: 60,  z: 20,  w: 1.2, d: 9, type: "ruin" },
  { x: 30,  z: -34, w: 8, d: 1.2, type: "ruin" },
];
for (const w of walls) w.top = w.type === "bags" ? 1.3 : 2.6;   // how tall each wall is (bullets fly over low ones from up high)

// ---------- the bombed-out house: two storeys, the top one mostly blown away into an open flat roof ----------
const HOUSE = { x0: 19, x1: 33, z0: 0, z1: 10, floor: 3.2, t: .3, inner: 26 };   // outside corners, upstairs floor height, wall thickness, inside wall
const STAIRS = { x0: 19.9, x1: 24.9, z0: 8.1, z1: 9.7 };           // wide stairs in the west room: ground at the east end (with room to stand), upstairs at the west end
const STAIRWELL = { x0: 19.8, x1: 25.2, z0: 8, z1: 9.7 };          // the opening in the upstairs floor above the stairs
const HOLE = { x0: 29.5, x1: 33, z0: 0, z1: 4 };                   // corner where the upstairs floor has collapsed
const inRect = (x, z, r, m = 0) => x >= r.x0 - m && x <= r.x1 + m && z >= r.z0 - m && z <= r.z1 + m;
const houseBlocks = [], houseOpenings = [];   // blocks of wall (for drawing and collisions); doors and windows (for their frames)
(function planHouse() {
  const { x0, x1, z0, z1, floor, t, inner } = HOUSE;
  const sides = {                    // what each wall is made of, along its length: [from, to, kind]
    s: { fixed: z0 + t / 2, alongX: true, pieces: [[x0, 21.5, "solid"], [21.5, 23, "door"], [23, 24, "solid"], [24, 25.3, "window"], [25.3, 27.5, "solid"], [27.5, 28.8, "window"], [28.8, x1, "solid"]] },
    n: { fixed: z1 - t / 2, alongX: true, pieces: [[x0, 27.2, "solid"], [27.2, 28.5, "window"], [28.5, 30.5, "solid"], [30.5, 31.8, "window"], [31.8, x1, "solid"]] },
    w: { fixed: x0 + t / 2, alongX: false, pieces: [[z0 + t, 3.8, "solid"], [3.8, 5.2, "window"], [5.2, z1 - t, "solid"]] },
    e: { fixed: x1 - t / 2, alongX: false, pieces: [[z0 + t, 4.2, "solid"], [4.2, 6.6, "blast"], [6.6, z1 - t, "solid"]] },
    p: { fixed: inner, alongX: false, pieces: [[z0 + t, 3.4, "solid"], [3.4, 4.8, "door"], [4.8, z1 - t, "solid"]], inside: true },   // wall between the two rooms
  };
  let n = 0;
  const block = (side, a, b, y0, y1, kind) => {
    const s = sides[side], c = (a + b) / 2, len = b - a;
    houseBlocks.push({ x: s.alongX ? c : s.fixed, z: s.alongX ? s.fixed : c, w: s.alongX ? len : t, d: s.alongX ? t : len, y0, y1, kind, n: n++ });
  };
  const collide = (side, a, b, base, top) => {
    const s = sides[side];
    walls.push({ x: s.alongX ? a : s.fixed - t / 2, z: s.alongX ? s.fixed - t / 2 : a, w: s.alongX ? b - a : t, d: s.alongX ? t : b - a, type: "house", base, top });
  };
  for (const side in sides) {
    const s = sides[side];
    // downstairs: whole walls, with doors, windows and a blast hole
    for (const [a, b, kind] of s.pieces) {
      for (let c = a; c < b - .01; c += .5) {
        const cb = Math.min(b, c + .5);
        if (kind === "solid") block(side, c, cb, 0, floor, "wall");
        else if (kind === "window") { block(side, c, cb, 0, 1, "wall"); block(side, c, cb, 2.3, floor, "wall"); }
        else if (kind === "door") block(side, c, cb, 2.3, floor, "wall");
        else block(side, c, cb, 1.8 + hash2(c * 7.1, 3.3) * .9, floor, "blasted");      // ragged top of the blast hole
      }
      if (kind === "solid") collide(side, a, b, 0, floor);
      if (kind === "window") collide(side, a, b, 0, 1);       // the sill stops you walking through, but you can shoot over it
      if (kind === "window" || kind === "door") houseOpenings.push({ kind, x: s.alongX ? (a + b) / 2 : s.fixed, z: s.alongX ? s.fixed : (a + b) / 2, width: b - a, alongX: s.alongX });
    }
    if (s.inside) continue;
    // upstairs: only broken stubs of wall are left, standing on the open floor
    const from = s.alongX ? x0 : z0 + t, to = s.alongX ? x1 : z1 - t;
    for (let c = from, i = 0; c < to - .01; c += .5, i++) {
      const cb = Math.min(to, c + .5), mid = (c + cb) / 2;
      if (s.alongX ? inRect(mid, s.fixed, HOLE, .3) : inRect(s.fixed, mid, HOLE, .3)) continue;   // gone with the collapsed corner
      const v = noise2(i * .32 + side.charCodeAt(0) * 7, 1.7);                                  // heights rise and fall along the wall
      let h = v < .36 ? 0 : (v - .36) * 4.6 + hash2(i * 3.7, side.charCodeAt(0)) * .25;
      if (i < 3 && (side === "n" || side === "w")) h = 2.2 + v * .5;                            // a tall corner still standing
      if (h < .12) continue;
      block(side, c, cb, floor, floor + h, "upper");
      collide(side, c, cb, floor, floor + h);
    }
  }
})();
// how high the floor is under a soldier: the ground, the stairs, or the upstairs floor
function stairsY(x, z) {
  if (z < STAIRS.z0 - .35 || z > STAIRS.z1 || x < STAIRS.x0 - .3 || x > STAIRS.x1 + .4) return -1;
  return HOUSE.floor * clamp01((STAIRS.x1 - x) / (STAIRS.x1 - STAIRS.x0));
}
function supportY(x, z, y) {         // the highest floor below someone at height y that they can step onto
  const reach = y + .55, ground = groundY(x, z);
  let best = ground <= reach ? ground : -99;
  const s = stairsY(x, z);
  if (s >= 0 && s > best && s <= reach) best = s;       // (s is -1 when not on the stairs)
  if (inRect(x, z, HOUSE) && !inRect(x, z, STAIRWELL) && !inRect(x, z, HOLE) && HOUSE.floor <= reach) best = Math.max(best, HOUSE.floor);
  return best > -99 ? best : ground;
}
// ---------- trenches: zig-zag lines dug into the ground, lined with planks and topped with sandbags ----------
const TRENCH = { depth: 1, half: .85, parapet: .45, ramp: 3 };   // depth, half the width, sandbag height, length of the slope at an open end
const trenchLines = [
  { pts: [[-23, -13], [-20, -9], [-23.5, -5], [-20, -1], [-23.5, 3], [-20, 7], [-23, 11.5]], rampStart: true, rampEnd: true },   // the fire trench
  { pts: [[-20.2, -1], [-16.5, -.5], [-13.5, -1.8]], rampStart: false, rampEnd: true },                                        // a side trench towards the start
];
for (const t of trenchLines) {
  t.len = 0;
  t.segs = t.pts.slice(1).map((b, i) => {
    const a = t.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), s = { a, b, L, s0: t.len };
    t.len += L;
    return s;
  });
}
function lineInfo(t, x, z) {         // how far a spot is from one trench's middle line, and how deep that trench is there
  let best = { d: 1e9, depth: 0 };
  for (const s of t.segs) {
    const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1];
    const k = Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / (s.L * s.L)));
    const d = Math.hypot(x - s.a[0] - dx * k, z - s.a[1] - dz * k);
    if (d < best.d) {
      const along = s.s0 + k * s.L;
      let depth = TRENCH.depth;
      if (t.rampStart) depth *= Math.min(1, along / TRENCH.ramp);
      if (t.rampEnd) depth *= Math.min(1, (t.len - along) / TRENCH.ramp);
      best = { d, depth };
    }
  }
  return best;
}
function trenchAt(x, z) {            // the nearest trench to a spot
  let best = { d: 1e9, depth: 0 };
  for (const t of trenchLines) { const i = lineInfo(t, x, z); if (i.d < best.d) best = i; }
  return best;
}
function parapetTop(x, z) {          // the sandbags along a trench's edges stop bullets that fly lower than them
  const t = trenchAt(x, z);
  return t.d > TRENCH.half && t.d < TRENCH.half + 1.15 && t.depth > .4 ? groundY(x, z) + TRENCH.parapet : -99;   // a little wider than the bags, so fast bullets cannot skip past
}

// ---------- helpers for the flat map ----------
const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function circleHitsRect(cx, cz, r, w) {
  const nx = Math.max(w.x, Math.min(cx, w.x + w.w));
  const nz = Math.max(w.z, Math.min(cz, w.z + w.d));
  return (cx - nx) ** 2 + (cz - nz) ** 2 < r * r;
}
const insideWall = (x, z) => walls.some(w => x > w.x && x < w.x + w.w && z > w.z && z < w.z + w.d);
function blocked(x, z, r, y = 0) {  // y = how high the soldier's feet are: walls only block at their own height
  if (x < MINX + r || x > MAXX - r || z < MINZ + r || z > MAXZ - r) return true;
  return walls.some(w => y < w.top - .25 && y > (w.base || 0) - .6 && circleHitsRect(x, z, r, w))
    || tanks.some(t => y < t.y + 2.4 && insideTank(t, x, z, r));
}
const tooSteep = (o, x, z) => groundY(x, z) > (o.y ?? 0) + .6;   // a trench wall or other drop too high to step up
function move(o, dx, dz) {           // slide along walls instead of sticking
  const y = o.y || 0, rx = Math.sign(dx) * o.r * .7, rz = Math.sign(dz) * o.r * .7;
  // a wall stops you dead; a trench side just holds you back, so a jump can still carry you up and over it
  if (blocked(o.x + dx, o.z, o.r, y)) o.vx = 0; else if (!tooSteep(o, o.x + dx + rx, o.z)) o.x += dx;
  if (blocked(o.x, o.z + dz, o.r, y)) o.vz = 0; else if (!tooSteep(o, o.x, o.z + dz + rz)) o.z += dz;
}
// does a wall stop a shot here? lift = the height of whoever is higher up, the shooter or the target:
// from up high you fire over low walls, and anyone can fire over a windowsill
// does something stop a shot flying through (x, z) at height h? walls, windowsills and sandbags only stop it if it is lower than their top
const wallStopsShot = (x, z, h, skip, skip2) => walls.some(w => x > w.x && x < w.x + w.w && z > w.z && z < w.z + w.d && w.top > h && (w.base || 0) < h)
  || h < parapetTop(x, z) || !!tankAt(x, z, h, skip, skip2);
function steer(o, tx, tz, agility) { // ease towards the wanted speed, so soldiers have a bit of weight
  o.vx += (tx - o.vx) * agility;
  o.vz += (tz - o.vz) * agility;
  move(o, o.vx, o.vz);
}
// can a bullet get from a to b? ha, hb: the heights it leaves from and arrives at (rifle, and the target's body)
function clearShot(a, b, ha = (a.y || 0) + 1.5, hb = (b.y || 0) + (b.crouched ? .85 : 1.25)) {
  const steps = Math.ceil(dist(a, b) / 0.3);          // small steps, so thin tree trunks are not skipped
  for (let i = 1; i < steps; i++) {
    const k = i / steps, x = a.x + (b.x - a.x) * k, z = a.z + (b.z - a.z) * k, h = ha + (hb - ha) * k;
    if (wallStopsShot(x, z, h, a.tank ? a : null, b.tank ? b : null) || h < groundY(x, z)) return false;
  }
  return true;
}
// "yaw" is the direction a soldier faces. These turn it into arrows on the map.
const forward = yaw => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
const rightOf = yaw => ({ x: -Math.cos(yaw), z: Math.sin(yaw) });

// ---------- 3) THE 3D WORLD ----------
const canvas = document.getElementById("game");
const stage = document.getElementById("stage");
// Colours in this file are written the way they look on screen. The renderer works with real light
// levels and then tone-maps the result like a film camera, which gives much more natural lighting.
const setHexOld = THREE.Color.prototype.setHex, setStyleOld = THREE.Color.prototype.setStyle;
THREE.Color.prototype.setHex = function (hex) { setHexOld.call(this, hex); return this.convertSRGBToLinear(); };
THREE.Color.prototype.setStyle = function (style) { setStyleOld.call(this, style); return this.convertSRGBToLinear(); };

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .95;

const scene = new THREE.Scene();
const SKY_TOP = 0x7d93ab, SKY_HAZE = 0xc4c6b8;        // a hazy summer sky: blue-grey above, pale haze at the horizon
scene.background = new THREE.Color(SKY_HAZE);
scene.fog = new THREE.Fog(SKY_HAZE, 50, 190);

// the sky: a big dome that follows the camera, blending from haze at the horizon to blue overhead, brighter near the sun
const sky = new THREE.Mesh(new THREE.SphereGeometry(250, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(SKY_TOP) }, haze: { value: new THREE.Color(SKY_HAZE) },
    sunDir: { value: new THREE.Vector3(30, 50, 20).normalize() }, sunCol: { value: new THREE.Color(0xfff2d6) } },
  vertexShader: "varying vec3 vDir;\nvoid main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: [
    "uniform vec3 top, haze, sunCol, sunDir; varying vec3 vDir;",
    "void main() {",
    "  float h = max(vDir.y, 0.0);",
    "  vec3 col = mix(haze, top, pow(h, 0.55));",
    "  float s = max(dot(vDir, sunDir), 0.0);",
    "  col += sunCol * (pow(s, 6.0) * 0.25 + pow(s, 400.0) * 1.5);",
    "  gl_FragColor = vec4(col, 1.0);",
    "  #include <tonemapping_fragment>",
    "  #include <encodings_fragment>",
    "}"].join("\n"),
}));
sky.renderOrder = -1; sky.frustumCulled = false;
scene.add(sky);

scene.add(new THREE.HemisphereLight(0xc9d4df, 0x5e553d, 1.15));   // light from the sky above and the earth below
const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -100, right: 100, top: 75, bottom: -75, near: 1, far: 240 });
scene.add(sun);

// ---- smooth random "noise", used to make the ground and plants look natural ----
const clamp01 = v => Math.max(0, Math.min(1, v));
function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise2(x, z) {              // gentle random hills, values 0..1
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => noise2(x, z) * .5 + noise2(x * 2.1 + 5, z * 2.1) * .3 + noise2(x * 4.3, z * 4.3 + 9) * .2;
// distance to the nearest wall: worked out once on a 1 m grid, then looked up (much faster on a big map)
let gapGrid = null;
function wallGap(x, z) {
  if (!gapGrid) {
    const nx = WORLD_X * 2 + 1, nz = WORLD_Z * 2 + 1, g = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) g[j * nx + i] = wallGapExact(i - WORLD_X, j - WORLD_Z);
    gapGrid = { g, nx, nz };
  }
  const fx = x + WORLD_X, fz = z + WORLD_Z, i = Math.floor(fx), j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= gapGrid.nx - 1 || j >= gapGrid.nz - 1) return wallGapExact(x, z);
  const u = fx - i, v = fz - j, g = gapGrid.g, n = gapGrid.nx, k = j * n + i;
  return (g[k] * (1 - u) + g[k + 1] * u) * (1 - v) + (g[k + n] * (1 - u) + g[k + n + 1] * u) * v;
}
function wallGapExact(x, z) {        // distance to the nearest sandbag or ruin wall
  let best = 99;
  for (const w of walls) {
    const dx = Math.max(w.x - x, 0, x - (w.x + w.w)), dz = Math.max(w.z - z, 0, z - (w.z + w.d));
    best = Math.min(best, Math.hypot(dx, dz));
  }
  return best;
}
const dryness = (x, z) => clamp01((fbm(x * .05 + 9, z * .05) - .38) * 2.4);           // patches of dry, yellow grass
const track = (x, z) => clamp01(1 - Math.abs(z - 9 * Math.sin(x * .05) - 3) / 1.7);   // a muddy cart track across the field

// shell craters, kept away from the walls and the spots where soldiers start
const craters = [];
for (let tries = 0; craters.length < 55 && tries < 1500; tries++) {
  const c = { x: rand(-MAXX - 30, MAXX + 30), z: rand(-MAXZ - 25, MAXZ + 25), r: rand(1.3, 3.6) };
  if (wallGap(c.x, c.z) < c.r + 1.5 || Math.hypot(Math.abs(c.x) - 10, c.z) < c.r + 2.5 || trenchAt(c.x, c.z).d < c.r + 2.5) continue;
  if (craters.some(o => Math.hypot(o.x - c.x, o.z - c.z) < o.r + c.r + .5)) continue;
  craters.push(c);
}
// craters sorted into 10 m squares, so each spot only checks the few nearby
let craterCells = null;
function cratersNear(x, z) {
  if (!craterCells) {
    craterCells = new Map();
    for (const c of craters) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const key = (Math.floor(c.x / 10) + a) + "," + (Math.floor(c.z / 10) + b);
      if (!craterCells.has(key)) craterCells.set(key, []);
      craterCells.get(key).push(c);
    }
  }
  return craterCells.get(Math.floor(x / 10) + "," + Math.floor(z / 10)) || [];
}
// how high the ground is at a spot: gentle rolls (flat by the walls) plus crater dips with raised rims
function groundY(x, z, visual = false) {
  const edge = clamp01((WORLD_X - Math.abs(x)) / 12) * clamp01((WORLD_Z - Math.abs(z)) / 12);
  const nearHouse = Math.hypot(Math.max(HOUSE.x0 - .5 - x, 0, x - HOUSE.x1 - .5), Math.max(HOUSE.z0 - .5 - z, 0, z - HOUSE.z1 - .5));
  let y = (fbm(x * .07, z * .07) - .5) * .55 * Math.min(1, wallGap(x, z) / 3) * edge * clamp01(nearHouse / 1.5);   // level where the house stands
  for (const c of cratersNear(x, z)) {
    const d = Math.hypot(x - c.x, z - c.z) / c.r;
    if (d < 1.7) y += c.r * .14 * (-Math.max(0, 1 - d * d) + .35 * Math.exp(-(((d - 1) * 3.5) ** 2)));
  }
  const tr = trenchAt(x, z);
  if (visual) { if (tr.d < TRENCH.half + .6) y -= tr.depth * clamp01((TRENCH.half + .6 - tr.d) / .35); }   // hidden under the sandbags
  else if (tr.d < TRENCH.half) y -= tr.depth;
  return y;
}

// Ground: a bumpy field coloured spot by spot (grass, dry grass, worn earth, mud, scorch marks),
// with a small repeating texture on top for close-up detail
(function makeGround() {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#c4c4c0"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 16000; i++) {                   // specks of soil and little stones
    const v = 135 + Math.random() * 120 | 0, s = 1 + Math.random() * 2.5;
    g.fillStyle = `rgb(${v},${v},${v * .94 | 0})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, s, s);
  }
  for (let i = 0; i < 6000; i++) {                    // tiny grass strokes
    const x = Math.random() * 512, y = Math.random() * 512, v = 150 + Math.random() * 105 | 0;
    g.strokeStyle = `rgb(${v * .92 | 0},${v},${v * .75 | 0})`;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-3, 3), y - rand(3, 9)); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(WORLD_X * .6, WORLD_Z * .6);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const geo = new THREE.PlaneGeometry(WORLD_X * 2, WORLD_Z * 2, 640, 470); geo.rotateX(-Math.PI / 2);   // fine enough to show the trenches
  const pos = geo.attributes.position, cols = [];
  const grass = new THREE.Color(0x5a7432), dry = new THREE.Color(0x8c874e), dirt = new THREE.Color(0x76624a);
  const mud = new THREE.Color(0x54432d), scorch = new THREE.Color(0x2f281d), col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, groundY(x, z, true));
    col.copy(grass).lerp(dry, dryness(x, z) * .6);
    const inField = Math.abs(x) < MAXX + 2 && Math.abs(z) < MAXZ + 2;
    let wear = Math.max(inField ? (1 - wallGap(x, z) / 2.8) * .85 : 0, Math.abs(x) < WORLD_X - 10 ? track(x, z) * .9 : 0);
    wear += (noise2(x * .6, z * .6) - .5) * .45;      // ragged edges
    col.lerp(dirt, clamp01(wear));
    const tz = trenchAt(x, z);                         // dug earth round the trenches, mud in them
    if (tz.depth > .05 && tz.d < TRENCH.half + 1.9) col.lerp(tz.d < TRENCH.half + .2 ? mud : dirt, clamp01((TRENCH.half + 1.9 - tz.d) / .8) * .85 * clamp01(tz.depth * 3));
    for (const cr of cratersNear(x, z)) {             // churned mud with a scorched middle
      const d = Math.hypot(x - cr.x, z - cr.z) / cr.r;
      if (d < 1.5) { col.lerp(mud, clamp01(1.35 - d) * .9); if (d < .6) col.lerp(scorch, (.6 - d) * 1.3); }
    }
    col.multiplyScalar((.85 + noise2(x * 1.7, z * 1.7) * .3) * 1.12);   // brightness ripple; makes up for the darker texture
    cols.push(col.r, col.g, col.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, vertexColors: true }));
  ground.receiveShadow = true;
  scene.add(ground);
  // far-off ground beyond the edge of the field, with a hole in the middle so it never covers the trenches
  const far = new THREE.Shape([[-600, -600], [600, -600], [600, 600], [-600, 600]].map(([x, y]) => new THREE.Vector2(x, y)));
  far.holes.push(new THREE.Path([[-WORLD_X + 1, -WORLD_Z + 1], [-WORLD_X + 1, WORLD_Z - 1], [WORLD_X - 1, WORLD_Z - 1], [WORLD_X - 1, -WORLD_Z + 1]].map(([x, y]) => new THREE.Vector2(x, y))));
  const outer = new THREE.Mesh(new THREE.ShapeGeometry(far), new THREE.MeshLambertMaterial({ color: 0x5e6838 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.03;
  scene.add(outer);
})();

// Sandbag walls are stacks of little boxes; ruins are broken brick walls
const bagMat = new THREE.MeshLambertMaterial({ color: 0xb9a676 });
const bagMat2 = new THREE.MeshLambertMaterial({ color: 0xa8956a });
const brickMat = new THREE.MeshLambertMaterial({ color: 0x8c6a56 });
for (const w of walls) {
  if (w.type === "house") continue;                   // the house is drawn separately
  const long = w.w > w.d, len = long ? w.w : w.d, thick = long ? w.d : w.w;
  if (w.type === "bags") {
    for (let row = 0; row < 3; row++) {
      const n = Math.floor(len / 1.1), size = len / n;
      for (let i = 0; i < n; i++) {
        const bag = new THREE.Mesh(new THREE.BoxGeometry(long ? size * .95 : thick * .9, .42, long ? thick * .9 : size * .95),
          (i + row) % 2 ? bagMat : bagMat2);
        const along = (i + .5 + (row % 2 ? .25 : 0)) * size;
        bag.position.set(long ? w.x + Math.min(along, len - size / 2) : w.x + w.w / 2, .22 + row * .42,
                         long ? w.z + w.d / 2 : w.z + Math.min(along, len - size / 2));
        bag.castShadow = bag.receiveShadow = true;
        scene.add(bag);
      }
    }
  } else {
    for (let i = 0; i < len; i += 1) {                // jagged broken top
      const h = 1.6 + Math.random() * 2.2;
      const b = new THREE.Mesh(new THREE.BoxGeometry(long ? 1 : thick, h, long ? thick : 1), brickMat);
      b.position.set(long ? w.x + i + .5 : w.x + w.w / 2, h / 2, long ? w.z + w.d / 2 : w.z + i + .5);
      b.castShadow = b.receiveShadow = true;
      scene.add(b);
    }
  }
}

// Barbed-wire fence around the edge
const postMat = new THREE.MeshLambertMaterial({ color: 0x4b3a26 });
const wirePts = [[], []];
const edge = [];
for (let x = MINX; x <= MAXX; x += 4) edge.push([x, MINZ]);
for (let z = MINZ; z <= MAXZ; z += 4) edge.push([MAXX, z]);
for (let x = MAXX; x >= MINX; x -= 4) edge.push([x, MAXZ]);
for (let z = MAXZ; z >= MINZ; z -= 4) edge.push([MINX, z]);
for (const [x, z] of edge) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 1.3, 6), postMat);
  const y = groundY(x, z);
  p.position.set(x, y + .65, z); p.rotation.set(rand(-.06, .06), 0, rand(-.06, .06)); p.castShadow = true; scene.add(p);
  wirePts[0].push(new THREE.Vector3(x, y + .45, z)); wirePts[1].push(new THREE.Vector3(x, y + 1.05, z));
}
for (const pts of wirePts) scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x2f2f2a })));

// ---------- plants and rocks ----------
// Many small shapes are glued into one big mesh per kind (trees, bushes, rocks),
// so the graphics card draws hundreds of them in one go.
function lumpy(geo, amount) {        // dent a round shape so it looks like foliage or stone
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (hash2(Math.round(x * 50) + Math.round(y * 31) * 7, Math.round(z * 50)) - .5) * amount;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  return geo;
}
function mergedMesh(parts) {
  const mesh = new THREE.Mesh(mergeParts(parts), new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 0, specular: 0 }));
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
// parts: { geo, at: [x,y,z], rot: [x,y,z], scale: [x,y,z], color }. smooth = keep the rounded shading of each part
function mergeParts(parts, dapple = .24, smooth = false) {
  const pos = [], cols = [], nors = [], fabs = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  for (const pt of parts) {
    const g = pt.geo.index ? pt.geo.toNonIndexed() : pt.geo.clone();
    q.setFromEuler(new THREE.Euler(...(pt.rot || [0, 0, 0])));
    g.applyMatrix4(m.compose(new THREE.Vector3(...pt.at), q, new THREE.Vector3(...(pt.scale || [1, 1, 1]))));
    const p = g.attributes.position.array, n = g.attributes.normal.array, own = g.attributes.color;   // own = colours painted on the shape
    const ownFab = g.attributes.fabric;
    for (let i = 0; i < p.length; i += 3) {
      pos.push(p[i], p[i + 1], p[i + 2]);
      nors.push(n[i], n[i + 1], n[i + 2]);
      fabs.push(ownFab ? ownFab.array[i / 3] : pt.fabric || 0);
      (own ? c.fromArray(own.array, i) : c.set(pt.color)).multiplyScalar(1 - dapple / 2 + hash2(p[i] * 3.1, p[i + 2] * 2.7 + p[i + 1]) * dapple);   // dappled colour
      cols.push(c.r, c.g, c.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  geo.setAttribute("fabric", new THREE.Float32BufferAttribute(fabs, 1));   // which cloth pattern to draw (soldiers only)
  if (smooth) geo.setAttribute("normal", new THREE.Float32BufferAttribute(nors, 3));
  else geo.computeVertexNormals();
  return geo;
}
const pick = list => list[Math.floor(Math.random() * list.length)];
const FIELD_TREES = 28;      // trees standing inside the battlefield
const windTime = { value: 0 };     // drives grass and leaves swaying in the wind
const outsideFence = (x, z, gap) => Math.abs(x) > MAXX + gap || Math.abs(z) > MAXZ + gap;

// ---------- PLANTS: branching trees with bark and leaves, pines with needles, leafy bushes ----------
// Painted textures for bark, leaf clusters and pine needles (drawn once on hidden canvases).
function paintTexture(w, h, draw, repeat) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const barkTex = paintTexture(128, 256, (g, w, h) => {
  g.fillStyle = "#6e6253"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {                      // ridges and cracks running up the trunk
    const x = Math.random() * w, y = Math.random() * h, len = 20 + Math.random() * 70, v = Math.random();
    g.strokeStyle = v < .5 ? `rgba(40,32,24,${.3 + Math.random() * .4})` : `rgba(150,138,118,${.15 + Math.random() * .25})`;
    g.lineWidth = 1 + Math.random() * 3;
    g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + rand(-4, 4), y + len * .3, x + rand(-4, 4), y + len * .6, x + rand(-3, 3), y + len); g.stroke();
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(90,110,60,${Math.random() * .25})`; g.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 14, 4 + Math.random() * 10); }   // moss
}, true);
const leafTex = paintTexture(256, 256, (g, w, h) => {
  const greens = ["#3f5a22", "#4c6a28", "#587a2e", "#36501d", "#62853a", "#2f461a"];
  for (let i = 0; i < 150; i++) {                      // a cluster of overlapping leaves, thicker in the middle
    const a = Math.random() * 6.3, d = Math.pow(Math.random(), .7) * 108;
    const x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d, s = 9 + Math.random() * 9, rot = Math.random() * 6.3;
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = greens[Math.floor(Math.random() * greens.length)];
    g.beginPath(); g.ellipse(0, 0, s, s * .48, 0, 0, 6.3); g.fill();
    g.strokeStyle = "rgba(20,30,10,.35)"; g.lineWidth = 1; g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.stroke();   // the middle vein
    g.restore();
  }
});
const needleTex = paintTexture(256, 128, (g, w, h) => {
  g.strokeStyle = "#3a2c1e"; g.lineWidth = 3; g.beginPath(); g.moveTo(4, 64); g.lineTo(250, 64); g.stroke();   // the twig
  for (let i = 0; i < 520; i++) {                      // needles sprouting along both sides, shorter towards the tip
    const x = 6 + Math.random() * 240, side = Math.random() < .5 ? -1 : 1, len = (58 - x * .16) * (.6 + Math.random() * .5);
    g.strokeStyle = ["#24381e", "#2c4424", "#33502a", "#1e301a"][i % 4]; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(x, 64); g.lineTo(x + len * .45, 64 + side * len); g.stroke();
  }
});
const barkMat = new THREE.MeshStandardMaterial({ map: barkTex, vertexColors: true, roughness: .95 });
function foliageMaterial(map) {      // leaf cards: see-through between the leaves, swaying a little in the wind
  const m = new THREE.MeshStandardMaterial({ map, vertexColors: true, alphaTest: .5, side: THREE.DoubleSide, roughness: .85 });
  m.onBeforeCompile = shader => {
    shader.uniforms.windTime = windTime;
    shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\n  normal = normalize( vNormal );");
    shader.vertexShader = "uniform float windTime;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      float sway = max(position.y - 1.0, 0.0) * 0.012;
      transformed.x += sin(windTime * 1.3 + position.x * 0.35 + position.z * 0.2) * sway;
      transformed.z += cos(windTime * 1.1 + position.z * 0.3) * sway * 0.7;`);
  };
  return m;
}
const leafMat = foliageMaterial(leafTex), needleMat = foliageMaterial(needleTex);

// Collects shapes with texture coordinates and their own colours, then glues them into one mesh
function plantBuilder() {
  const pos = [], nor = [], uv = [], col = [], m = new THREE.Matrix4(), nm = new THREE.Matrix3(), c = new THREE.Color();
  return {
    // a tapered round branch from a to b, with bark wrapped round it
    branch(a, b, r0, r1, color, sides = 7) {
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
      const geo = new THREE.CylinderGeometry(r1, r0, len, sides, 1, true).toNonIndexed();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
      m.compose(A.clone().add(B).multiplyScalar(.5), q, new THREE.Vector3(1, 1, 1)); nm.getNormalMatrix(m);
      geo.applyMatrix4(m);
      const p = geo.attributes.position.array, n = geo.attributes.normal.array, t = geo.attributes.uv.array;
      for (let i = 0, j = 0; i < p.length; i += 3, j += 2) {
        pos.push(p[i], p[i + 1], p[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]);
        uv.push(t[j] * Math.max(1, r0 * 12), t[j + 1] * len * 1.5);
        c.set(color).multiplyScalar(.85 + hash2(p[i] * 2, p[i + 2] * 3) * .3); col.push(c.r, c.g, c.b);
      }
    },
    // a flat card of leaves or needles. centre: where it is; size: [width, height]; normal: how it catches the light
    card(center, size, rot, color, normal, uvRect = [0, 0, 1, 1]) {
      const [w, h] = size, q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, "YXZ"));
      const corners = [[-w / 2, -h / 2, 0, 0], [w / 2, -h / 2, 1, 0], [w / 2, h / 2, 1, 1], [-w / 2, -h / 2, 0, 0], [w / 2, h / 2, 1, 1], [-w / 2, h / 2, 0, 1]];
      for (const [x, y, u, v] of corners) {
        const pt = new THREE.Vector3(x, y, 0).applyQuaternion(q).add(center);
        pos.push(pt.x, pt.y, pt.z); nor.push(normal.x, normal.y, normal.z);
        uv.push(uvRect[0] + u * uvRect[2], uvRect[1] + v * uvRect[3]);
        col.push(color.r, color.g, color.b);
      }
    },
    mesh(material, shadows = true) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = shadows; mesh.receiveShadow = true;
      if (material.alphaTest) mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: material.map, alphaTest: material.alphaTest });
      scene.add(mesh);
      return mesh;
    },
  };
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// a ball of leaf cards; each card is lit as if it were part of one rounded crown, which looks soft and natural
function leafCluster(L, center, radius, crownCenter, count, tint, cardSize = 1.1) {
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const d = V(rand(-1, 1), rand(-.7, 1), rand(-1, 1)).normalize().multiplyScalar(radius * Math.cbrt(Math.random()));
    const at = center.clone().add(d), out = at.clone().sub(crownCenter);
    const inside = clamp01(out.length() / (radius * 2));       // leaves deep inside the crown are in shade
    const normal = out.normalize().multiplyScalar(.75).add(V(0, .45, 0)).normalize();
    c.copy(tint).multiplyScalar(.55 + inside * .55 + rand(-.08, .08));
    const s = cardSize * rand(.75, 1.25);
    L.card(at, [s, s], [rand(-.6, .6), rand(0, 6.3), rand(0, 6.3)], c, normal);
  }
}

(function makeTrees() {
  const B = plantBuilder(), L = plantBuilder(), N = plantBuilder();
  const barks = [0xd6ccbc, 0xe2d6c2, 0xc8bfb0], deadBark = [0xe8e2d8, 0xd4ccc0];   // tints: the bark texture carries the colour
  const leafTints = [0xdfe8c8, 0xeaf0cc, 0xd2e0bc, 0xf2eccc].map(h => new THREE.Color(h));
  // grows one tree at (x, z). kind 0..1 picks broadleaf (< .45), pine (< .75) or shattered.
  // Returns the trunk's radius and height, so trees in the battlefield can block soldiers and bullets.
  function growTree(x, z, kind) {
    const y = groundY(x, z) - .1;
    let trunk;
    if (kind < .45) {                                 // broadleaf tree: trunk, limbs, twigs and a crown of leaves
      const h = rand(2.8, 4.5), r = rand(.2, .32), bark = pick(barks), tint = pick(leafTints);
      const lean = V(rand(-.15, .15), 1, rand(-.15, .15)).normalize();
      const top = V(x, y, z).addScaledVector(lean, h);
      B.branch([x, y - .2, z], top.toArray(), r * 1.25, r * .7, bark, 9);
      trunk = { r: r * 1.15, h };
      const crownCenter = top.clone().add(V(0, 1.6, 0)), clusters = [];
      const limbs = 3 + Math.floor(Math.random() * 3);
      for (let b = 0; b < limbs; b++) {
        const a = b / limbs * 6.3 + rand(-.4, .4), up = rand(.5, 1.1), len = rand(1.5, 2.6);
        const start = V(x, y, z).addScaledVector(lean, h * rand(.6, 1));
        const dir = V(Math.cos(a), up, Math.sin(a)).normalize(), end = start.clone().addScaledVector(dir, len);
        B.branch(start.toArray(), end.toArray(), r * .55, r * .2, bark);
        for (let t = 0; t < 2; t++) {                 // twigs off each limb
          const ta = a + rand(-1, 1), tdir = V(Math.cos(ta), up + rand(-.2, .5), Math.sin(ta)).normalize();
          const ts = start.clone().lerp(end, rand(.5, .9)), te = ts.clone().addScaledVector(tdir, rand(.7, 1.3));
          B.branch(ts.toArray(), te.toArray(), r * .2, .02, bark, 5);
          clusters.push(te);
        }
        clusters.push(end);
      }
      for (const c of clusters) leafCluster(L, c, rand(.8, 1.2), crownCenter, 13, tint);
      leafCluster(L, crownCenter, 1.2, crownCenter, 14, tint);   // fill the middle of the crown
    } else if (kind < .75) {                          // pine: straight trunk, whorls of drooping branches covered in needles
      const h = rand(6, 9.5), bark = pick(barks);
      const pr = rand(.18, .26);
      B.branch([x, y - .2, z], [x, y + h, z], pr, .04, bark, 8);
      trunk = { r: pr, h };
      for (let wy = 1.6; wy < h - .3; wy += rand(.45, .6)) {
        const k = 1 - (wy - 1.6) / (h - 1.6), n = 5 + Math.floor(Math.random() * 3), off = rand(0, 6.3);
        for (let b = 0; b < n; b++) {
          const a = off + b / n * 6.3 + rand(-.25, .25), len = (.4 + k * 1.9) * rand(.8, 1.1);
          const droop = -.25 - k * .25, dir = V(Math.cos(a), droop, Math.sin(a)).normalize();
          const start = V(x, y + wy, z), end = start.clone().addScaledVector(dir, len);
          B.branch(start.toArray(), end.toArray(), .045 * (.5 + k), .01, bark, 4);
          const c = new THREE.Color(0xe4ecdc).multiplyScalar(.6 + (1 - k) * .3 + rand(-.05, .08));
          const normal = V(Math.cos(a), .6, Math.sin(a)).normalize();
          for (let s = 0; s < 2; s++)                 // two crossed sprays of needles along each branch
            N.card(start.clone().lerp(end, .5), [len * 1.05, .55 + k * .35], [s ? 1.3 : .25, -a, droop], c, normal);
        }
      }
    } else {                                          // tree shattered by shellfire: bare trunk, splintered top, dead limbs
      const h = rand(2.5, 6), r = rand(.2, .32), bark = pick(deadBark);
      B.branch([x, y - .2, z], [x + rand(-.3, .3), y + h, z + rand(-.3, .3)], r, r * .7, bark, 8);
      trunk = { r, h };
      for (let s = 0; s < 5; s++) {                   // splinters sticking up from the break
        const a = rand(0, 6.3), d = r * .5;
        B.branch([x + Math.cos(a) * d, y + h - .1, z + Math.sin(a) * d], [x + Math.cos(a) * d * 1.4, y + h + rand(.3, 1), z + Math.sin(a) * d * 1.4], r * .3, .01, 0xfff0d8, 4);   // pale splintered wood
      }
      for (let b = 0; b < 3; b++) {
        const a = rand(0, 6.3), start = V(x, y + h * rand(.4, .85), z), end = start.clone().add(V(Math.cos(a) * rand(.8, 1.6), rand(-.1, .8), Math.sin(a) * rand(.8, 1.6)));
        B.branch(start.toArray(), end.toArray(), r * .3, .02, bark, 5);
      }
    }
    return trunk;
  }

  // the woods outside the wire
  for (let i = 0; i < 240; i++) {
    let x, z;
    do { x = rand(-WORLD_X + 8, WORLD_X - 8); z = rand(-WORLD_Z + 8, WORLD_Z - 8); } while (!outsideFence(x, z, 4));
    growTree(x, z, Math.random());
  }

  // trees standing in the battlefield itself: mostly shattered by shellfire, some still alive.
  // Their trunks are solid, so you can take cover behind them.
  const fieldTrees = [];
  for (let tries = 0; fieldTrees.length < FIELD_TREES && tries < 4000; tries++) {
    const x = rand(MINX + 4, MAXX - 4), z = rand(MINZ + 4, MAXZ - 4);
    if (wallGap(x, z) < 4 || inRect(x, z, HOUSE, 4) || trenchAt(x, z).d < 4.5 || track(x, z) > .05) continue;
    if (Math.hypot(Math.abs(x) - 10, z) < 9) continue;                                 // keep the start positions open
    if (craters.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 1.5)) continue;
    if (fieldTrees.some(t => Math.hypot(x - t.x, z - t.z) < 7)) continue;
    fieldTrees.push({ x, z });
  }
  for (const t of fieldTrees) {
    const roll = Math.random(), kind = roll < .5 ? rand(.76, 1) : roll < .85 ? rand(0, .44) : rand(.46, .74);
    const { r, h } = growTree(t.x, t.z, kind);
    const half = r * .9;
    walls.push({ x: t.x - half, z: t.z - half, w: half * 2, d: half * 2, type: "tree", top: groundY(t.x, t.z) + h });
  }
  B.mesh(barkMat); L.mesh(leafMat); N.mesh(needleMat);
})();

// Bushes along the fence and out in the fields: a few twigs inside a dense clump of leaves
(function makeBushes() {
  const B = plantBuilder(), L = plantBuilder();
  const tints = [0xd8e4c0, 0xe4ecc6, 0xccdcb6, 0xe8e6c2].map(h => new THREE.Color(h));
  for (let i = 0; i < 170; i++) {
    let x, z;
    do { x = rand(-WORLD_X + 5, WORLD_X - 5); z = rand(-WORLD_Z + 5, WORLD_Z - 5); } while (!outsideFence(x, z, 1.2));
    const y = groundY(x, z), size = rand(.5, 1.1), tint = pick(tints), center = V(x, y + size * .6, z);
    for (let t = 0; t < 4; t++) {
      const a = rand(0, 6.3);
      B.branch([x, y, z], [x + Math.cos(a) * size * .7, y + size * rand(.6, 1.1), z + Math.sin(a) * size * .7], .03, .01, 0xc8bca8, 4);
    }
    for (let b = 0; b < 3; b++)
      leafCluster(L, center.clone().add(V(rand(-.5, .5) * size, rand(-.2, .2) * size, rand(-.5, .5) * size)), size * .65, center, 9, tint, .75 * (.6 + size * .5));
  }
  B.mesh(barkMat, false); L.mesh(leafMat);
})();

// Rocks and rubble: around the ruins, on crater rims, and scattered about
(function makeRocks() {
  const parts = [], stone = [0x77705f, 0x6a6455, 0x837a68, 0x8c6a56];
  const spots = [];
  for (const w of walls) if (w.type === "ruin") for (let i = 0; i < 14; i++) spots.push([w.x + rand(-1, w.w + 1), w.z + rand(-1.5, w.d + 1.5), .14]);
  for (const c of craters) for (let i = 0; i < 5; i++) { const a = rand(0, 6.3), d = c.r * rand(.9, 1.3); spots.push([c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, .12]); }
  for (let i = 0; i < 130; i++) spots.push([rand(-WORLD_X + 10, WORLD_X - 10), rand(-WORLD_Z + 10, WORLD_Z - 10), .22]);
  for (const [x, z, s0] of spots) {
    if (insideWall(x, z) || inRect(x, z, HOUSE, .3) || trenchAt(x, z).d < TRENCH.half + 1.4) continue;
    const s = s0 * rand(.6, 1.6);
    parts.push({ geo: lumpy(new THREE.DodecahedronGeometry(1, 0), .5), at: [x, groundY(x, z) + s * .25, z],
      scale: [s * rand(1, 1.6), s * rand(.6, 1), s * rand(1, 1.4)], rot: [rand(0, 3), rand(0, 6), rand(0, 3)], color: pick(stone) });
  }
  mergedMesh(parts);
})();

// The bombed-out house: plaster walls with patches of bare brick, scorched round the damage,
// a staircase, floorboards upstairs, a collapsed corner with hanging slabs and charred beams, and heaps of rubble
// The trenches: plank walls held by posts, duckboards along the floor, sandbags piled along both edges
(function makeTrenches() {
  const P = [], { half } = TRENCH;
  const add = (w, h, d, at, yaw, color, tilt = 0) => P.push({ geo: new THREE.BoxGeometry(w, h, d), at, rot: [tilt, yaw, 0], color });
  const planks = [0x6e5c45, 0x5f4f3b, 0x67563f], bags = [0xb9a676, 0xa8956a, 0x9c8a60];
  for (const t of trenchLines) {
    t.segs.forEach((s, si) => {
      const dx = (s.b[0] - s.a[0]) / s.L, dz = (s.b[1] - s.a[1]) / s.L, nx = -dz, nz = dx, yaw = Math.atan2(dx, dz);
      const startExt = si > 0 ? .9 : 0, endExt = si < t.segs.length - 1 ? .9 : 0;   // walls run on past the bends so the corners close up
      const depthAt = u => {
        const along = s.s0 + Math.max(0, Math.min(s.L, u));
        let d = TRENCH.depth;
        if (t.rampStart) d *= Math.min(1, along / TRENCH.ramp);
        if (t.rampEnd) d *= Math.min(1, (t.len - along) / TRENCH.ramp);
        return d;
      };
      const inOther = (x, z) => trenchLines.some(o => o !== t && lineInfo(o, x, z).d < half - .05);   // where two trenches join, leave the wall open
      // plank walls in panels between posts, on both sides
      for (let u = -startExt; u < s.L + endExt - .05; u += 1.2) {
        const len = Math.min(1.2, s.L + endExt - u), mid = u + len / 2, dep = depthAt(mid);
        if (dep < .12) continue;
        for (const side of [-1, 1]) {
          const x = s.a[0] + dx * mid + nx * side * (half + .03), z = s.a[1] + dz * mid + nz * side * (half + .03);
          if (inOther(x, z)) continue;
          const top = groundY(x + nx * side * .3, z + nz * side * .3);      // the ground just outside the trench
          add(.06, dep + .1, len + .02, [x, top - dep / 2 + .05, z], yaw, planks[(Math.round(u) + side + 3) % 3]);
          const px = s.a[0] + dx * u + nx * side * (half - .02), pz = s.a[1] + dz * u + nz * side * (half - .02);
          if (!inOther(px, pz)) add(.1, dep + .25, .1, [px, top - dep / 2 + .12, pz], yaw, 0x3f3225);   // post
        }
      }
      // duckboards: slats across two rails, so nobody stands in the mud
      for (let u = .15; u < s.L; u += .3) {
        const x = s.a[0] + dx * u, z = s.a[1] + dz * u;
        if (depthAt(u) < .15) continue;
        const fy = groundY(x, z);
        add(.95, .035, .12, [x, fy + .04, z], yaw, (Math.round(u * 3.3) % 2) ? 0x5a4a37 : 0x524433);
        for (const side of [-.32, .32]) add(.07, .05, .31, [x + nx * side, fy + .005, z + nz * side], yaw, 0x3f3225);   // rails underneath
      }
      // sandbags piled two high along both edges
      for (let u = -startExt * .5; u < s.L + endExt * .5; u += .55) {
        if (depthAt(u) < .35) continue;
        for (const side of [-1, 1]) for (const row of [0, 1]) {
          const along = u + row * .27, out = half + .42 - row * .05;
          const x = s.a[0] + dx * along + nx * side * out, z = s.a[1] + dz * along + nz * side * out;
          if (trenchAt(x, z).d < half + .2) continue;                       // not where it would fall into a trench
          add(.42, .22, .54, [x, groundY(x, z) + .11 + row * .21, z], yaw + rand(-.12, .12), bags[(Math.round(u * 1.8) + row + side + 3) % 3]);
        }
      }
    });
  }
  mergedMesh(P);
})();

let houseMesh;
(function makeHouse() {
  const { x0, x1, z0, z1, floor, t } = HOUSE;
  const P = [], col = new THREE.Color(), soot = new THREE.Color(0x2b2520);
  const box = (w, h, d, at, color, rot) => P.push({ geo: new THREE.BoxGeometry(w, h, d), at, color, rot });
  const hx = (HOLE.x0 + HOLE.x1) / 2, hz = (HOLE.z0 + HOLE.z1) / 2;
  const blast = [x1, 2.4, 5.4], hole = [hx, floor, hz], bump = (v, w) => Math.exp(-((v / w) ** 2));
  const burnt = (x, y, z) => Math.max(bump(Math.hypot(x - blast[0], y - blast[1], z - blast[2]), 2.1), bump(Math.hypot(x - hole[0], y - hole[1], z - hole[2]), 2.6));
  const plaster = [0xbab1a0, 0xb0a794, 0xc3b9a7], brick = [0x8b5a44, 0x7b4b39, 0x985f47];

  // walls: plaster, with bare brick showing in places and at every broken edge, blackened near the damage
  for (const b of houseBlocks) {
    const bare = noise2((b.x + b.z) * .7, b.y0 * .4 + 3) > .66 || b.kind === "blasted";   // bare brick shows in patches
    const scorch = burnt(b.x, (b.y0 + b.y1) / 2, b.z) * .8;
    const paint = c => col.set(c).lerp(soot, scorch).getHex();
    const thin = b.w < b.d ? "w" : "d", inset = bare ? .03 : 0;   // bare brick sits a little behind the plaster
    const w = b.w - (thin === "w" ? inset : 0), d = b.d - (thin === "d" ? inset : 0), h = b.y1 - b.y0;
    if (b.kind === "upper" && h > .3) {              // broken top shows the bricks
      box(w, h - .2, d, [b.x, b.y0 + (h - .2) / 2, b.z], paint(bare ? brick[b.n % 3] : plaster[b.n % 3]));
      box(b.w * .96, .2 + hash2(b.n, 2) * .12, b.d * .96, [b.x, b.y1 - .08, b.z], paint(brick[(b.n + 1) % 3]), [0, 0, (hash2(b.n, 4) - .5) * .2]);
    } else box(w, h, d, [b.x, (b.y0 + b.y1) / 2, b.z], paint(bare ? brick[b.n % 3] : plaster[b.n % 3]));
  }
  // window frames with broken bars, and door frames
  const wood = 0x4a3726, charred = 0x221c17;
  for (const o of houseOpenings) {
    const along = (dx, dz) => o.alongX ? [o.x + dx, 0, o.z + dz] : [o.x + dz, 0, o.z + dx];
    const sized = (w, h, d) => o.alongX ? [w, h, d] : [d, h, w];
    const half = o.width / 2;
    if (o.kind === "window") {
      const [sx, , sz] = along(0, 0); box(...sized(o.width, .06, .36), [sx, 1.02, sz], wood);              // sill
      for (const s of [-half + .04, half - .04]) { const [px, , pz] = along(s, 0); box(...sized(.07, 1.3, .32), [px, 1.65, pz], wood); }
      const [cx, , cz] = along(.1, 0); box(...sized(.07, .9, .3), [cx, 1.6, cz], charred, o.alongX ? [0, 0, .5] : [.5, 0, 0]);   // a broken bar
    } else for (const s of [-half + .05, half - .05]) { const [px, , pz] = along(s, 0); box(...sized(.1, 2.3, .34), [px, 1.15, pz], wood); }
  }
  box(1.4, .06, 2.1, [22.3, .06, z0 - 1.2], 0x5a4330, [.08, .25, 0]);                              // front door blown off, lying outside

  // downstairs floor: dusty flagstones
  for (let x = x0 + t; x < x1 - t - .01; x += .9) for (let z = z0 + t; z < z1 - t - .01; z += .9) {
    const w = Math.min(.88, x1 - t - x), d = Math.min(.88, z1 - t - z);
    box(w, .06, d, [x + w / 2, -.02, z + d / 2], col.set(0x6e665a).multiplyScalar(.85 + hash2(x * 3, z * 5) * .25).getHex());
  }
  // wide stairs up to the first floor
  const steps = Math.round((STAIRS.x1 - STAIRS.x0) / .5), run = (STAIRS.x1 - STAIRS.x0) / steps;
  for (let i = 0; i < steps; i++) {
    const top = (i + 1) * floor / steps;
    box(run, top, STAIRS.z1 - STAIRS.z0, [STAIRS.x1 - (i + .5) * run, top / 2, (STAIRS.z0 + STAIRS.z1) / 2], i % 2 ? 0x6c5c49 : 0x655542);
    box(run, .04, STAIRS.z1 - STAIRS.z0 + .04, [STAIRS.x1 - (i + .5) * run, top + .02, (STAIRS.z0 + STAIRS.z1) / 2], 0x7a6852);   // worn tread
  }
  // upstairs floor: slab with floorboards on top, open above the stairs and missing where the corner fell in
  for (let x = x0; x < x1 - .01; x += .5) for (let z = z0; z < z1 - .01; z += .5) {
    const cx = x + .25, cz = z + .25;
    if (inRect(cx, cz, STAIRWELL) || inRect(cx, cz, HOLE)) continue;
    box(.5, .24, .5, [cx, floor - .15, cz], 0x8a8379);                                         // concrete underneath
    const scorch = burnt(cx, floor, cz) * .9;
    box(.5, .04, .5, [cx, floor - .02, cz], col.set(hash2(cx * 7, cz * 3) < .5 ? 0x7a6550 : 0x6f5a46).lerp(soot, scorch).getHex());
  }
  // the collapsed corner: slabs hanging into the hole, charred beams, and the pile they fell onto
  box(1.3, .22, 1, [HOLE.x0 + .6, floor - .55, HOLE.z1 - .3], 0x8a8379, [-.7, .2, .15]);
  box(1, .22, 1.3, [HOLE.x0 + .2, floor - .65, hz - .4], 0x7d766c, [.15, 0, .8]);
  box(.14, .14, 2.8, [hx - .4, floor - .45, hz + .4], charred, [.45, .5, 0]);
  box(.14, .14, 2.2, [hx + .6, floor - .2, HOLE.z1 - .5], charred, [-.3, -.4, .2]);
  box(.12, .12, 1.8, [HOLE.x0 + .3, floor + .1, HOLE.z0 + .7], charred, [0, .9, .25]);
  const rubble = (cx, cz, r, h, n, base = 0) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.3, d = Math.sqrt(Math.random()) * r, s = rand(.08, .3);
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, y = base + h * (1 - (d / r) ** 2) * rand(.5, 1);
      const c = Math.random() < .55 ? brick[i % 3] : Math.random() < .6 ? plaster[i % 3] : 0x8a8379;
      P.push({ geo: lumpy(new THREE.DodecahedronGeometry(1, 0), .5), at: [x, y, z], scale: [s * rand(1, 1.6), s * rand(.5, .9), s * rand(1, 1.4)], rot: [rand(0, 3), rand(0, 6), rand(0, 3)], color: col.set(c).lerp(soot, rand(0, .35)).getHex() });
    }
  };
  rubble(hx, hz, 1.6, 1, 90);                        // under the collapsed corner
  rubble(x1 + 1, 5.4, 1.9, .8, 70);                  // blown out through the side wall
  rubble(x1 - 1, 5.4, 1.3, .5, 35);
  rubble(x1 + .6, 1.5, 1, .4, 22);
  rubble(x0 - .6, 7.5, 1, .35, 20);
  rubble(24, 4, 1.8, .05, 25, floor);                // bits of broken wall lying upstairs
  rubble(29, 7, 1.6, .05, 25, floor);
  rubble(22.5, 3.5, 1.4, .05, 15);                   // and downstairs
  houseMesh = mergedMesh(P);
})();
// Grass: thousands of little tufts drawn in one go, swaying gently in the wind
(function makeGrass() {
  const verts = [], shade = [];
  // one tuft = 8 thin blades, each curving outwards and tapering to a point (three segments per blade)
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + rand(-.4, .4), h = rand(.22, .5), lean = rand(.1, .3), w = rand(.012, .02);
    const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx, base = rand(0, .05);
    const pts = [0, .4, .75, 1].map(t => {                   // a point along the blade: it bends further out towards the tip
      const out = base + lean * t * t, width = w * (1 - t * .85);
      return { x: dx * out, y: h * t, z: dz * out, w: t === 1 ? 0 : width };
    });
    for (let k = 0; k < 3; k++) {
      const p0 = pts[k], p1 = pts[k + 1], s0 = .5 + k * .22, s1 = .5 + (k + 1) * .22;   // darker at the root
      verts.push(p0.x - px * p0.w, p0.y, p0.z - pz * p0.w, p0.x + px * p0.w, p0.y, p0.z + pz * p0.w, p1.x + px * p1.w, p1.y, p1.z + pz * p1.w);
      verts.push(p0.x - px * p0.w, p0.y, p0.z - pz * p0.w, p1.x + px * p1.w, p1.y, p1.z + pz * p1.w, p1.x - px * p1.w, p1.y, p1.z - pz * p1.w);
      shade.push(s0, s0 * 1.05, s0 * .85, s0, s0 * 1.05, s0 * .85, s1, s1 * 1.05, s1 * .85, s0, s0 * 1.05, s0 * .85, s1, s1 * 1.05, s1 * .85, s1, s1 * 1.05, s1 * .85);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(shade, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(verts.map((_, i) => i % 3 === 1 ? 1 : 0), 3));   // lit like the ground
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = shader => {                   // bend the blade tips with the wind
    shader.uniforms.windTime = windTime;
    shader.fragmentShader = shader.fragmentShader.replace(/\(\s*gl_FrontFacing\s*\)\s*\?\s*(\w+)Front\s*:\s*\w+Back/g, "$1Front");   // light both sides of a blade alike
    shader.vertexShader = "uniform float windTime;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      vec4 root = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float bend = position.y * position.y;
      transformed.x += sin(windTime * 1.6 + root.x * .3 + root.z * .2) * .5 * bend;
      transformed.z += cos(windTime * 1.2 + root.z * .25) * .2 * bend;`);
  };
  const COUNT = 45000;
  const grass = new THREE.InstancedMesh(geo, mat, COUNT);
  const green = new THREE.Color(0x587a30), yellow = new THREE.Color(0x968c50), col = new THREE.Color();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  let n = 0;
  for (let tries = 0; n < COUNT && tries < COUNT * 6; tries++) {
    const x = rand(-WORLD_X + 2, WORLD_X - 2), z = rand(-WORLD_Z + 2, WORLD_Z - 2);
    if (fbm(x * .09, z * .09) < rand(.25, .7)) continue;        // grows in patches
    if (wallGap(x, z) < .5 || track(x, z) > rand(.3, 1)) continue;
    if (craters.some(c => Math.hypot(x - c.x, z - c.z) < c.r * .8) || inRect(x, z, HOUSE, .2) || trenchAt(x, z).d < TRENCH.half + 1.4) continue;
    const s = rand(.7, 1.5);
    q.setFromAxisAngle(up, rand(0, 6.3));
    grass.setMatrixAt(n, m.compose(new THREE.Vector3(x, groundY(x, z), z), q, new THREE.Vector3(s, s * rand(.7, 1.3), s)));
    grass.setColorAt(n, col.copy(green).lerp(yellow, clamp01(dryness(x, z) + rand(-.2, .2))).multiplyScalar(rand(.8, 1.1)));
    n++;
  }
  grass.count = n;
  grass.frustumCulled = false;                        // the tufts are spread over the whole map
  grass.receiveShadow = true;
  scene.add(grass);

  // tall wild grass: long stems with a seed head, in loose clumps
  {
    const v = [], c = [];
    for (let i = 0; i < 5; i++) {
      const a = rand(0, 6.3), h = rand(.6, .95), lean = rand(.05, .2), dx = Math.cos(a), dz = Math.sin(a), w = .006;
      const tip = [dx * lean, h, dz * lean];
      v.push(-w * dz, 0, w * dx, w * dz, 0, -w * dx, tip[0], tip[1], tip[2]);               // stem
      c.push(.45, .5, .35, .45, .5, .35, .85, .8, .55);
      const hy = h * .82, hx = dx * lean * .8, hz = dz * lean * .8;                         // seed head: a thin pale spike
      v.push(hx - .018 * dz, hy, hz + .018 * dx, hx + .018 * dz, hy, hz - .018 * dx, tip[0], tip[1] + .06, tip[2]);
      c.push(1.1, 1.0, .75, 1.1, 1.0, .75, 1.2, 1.1, .85);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(v.map((_, i) => i % 3 === 1 ? 1 : 0), 3));
    const TALL = 9000, tall = new THREE.InstancedMesh(geo, mat, TALL);
    const straw = new THREE.Color(0xb5a46a), sage = new THREE.Color(0x8c9a5c);
    let t = 0;
    for (let tries = 0; t < TALL && tries < TALL * 8; tries++) {
      const x = rand(-WORLD_X + 2, WORLD_X - 2), z = rand(-WORLD_Z + 2, WORLD_Z - 2);
      if (fbm(x * .05 + 3, z * .05) < .55 || wallGap(x, z) < .8 || track(x, z) > .2 || inRect(x, z, HOUSE, .5) || trenchAt(x, z).d < TRENCH.half + 1.5) continue;
      q.setFromAxisAngle(up, rand(0, 6.3));
      tall.setMatrixAt(t, m.compose(new THREE.Vector3(x, groundY(x, z), z), q, new THREE.Vector3(1, rand(.7, 1.3), 1)));
      tall.setColorAt(t, col.copy(sage).lerp(straw, clamp01(dryness(x, z) + rand(-.1, .4))));
      t++;
    }
    tall.count = t; tall.frustumCulled = false; tall.receiveShadow = true;
    scene.add(tall);
  }

  // wildflowers: mostly red poppies, some yellow and white
  const FLOWERS = 2000;
  const flowers = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.055, 0), new THREE.MeshLambertMaterial(), FLOWERS);
  const petals = [0xb3261e, 0xb3261e, 0xc23a22, 0xd9c043, 0xe8e4d8];
  let f = 0;
  for (let tries = 0; f < FLOWERS && tries < FLOWERS * 10; tries++) {
    const x = rand(-WORLD_X + 2, WORLD_X - 2), z = rand(-WORLD_Z + 2, WORLD_Z - 2);
    if (fbm(x * .09, z * .09) < .5 || wallGap(x, z) < 1 || track(x, z) > .2 || inRect(x, z, HOUSE, 1) || trenchAt(x, z).d < TRENCH.half + 1.8) continue;
    if (craters.some(c => Math.hypot(x - c.x, z - c.z) < c.r * 1.3)) continue;
    flowers.setMatrixAt(f, m.compose(new THREE.Vector3(x, groundY(x, z) + rand(.25, .45), z), q, new THREE.Vector3(1, .6, 1)));
    flowers.setColorAt(f, col.set(pick(petals)));
    f++;
  }
  flowers.count = f;
  flowers.frustumCulled = false;
  scene.add(flowers);
})();

// ---------- RIFLES: bolt-action rifles built from many small parts, glued into one mesh ----------
// Laid out along +z: the butt is at z = 0 and the muzzle at z = 1.2; y = 0 is the line of the barrel.
function sideProfile(points, width) {    // a flat side-view outline given some thickness (used for wooden stocks)
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelThickness: .005, bevelSize: .005, bevelSegments: 1 });
  return geo.rotateY(-Math.PI / 2).translate(width / 2, 0, 0);
}
function rifleGeometry(kind) {           // "british" Lee-Enfield, "american" M1 Garand, "german" Kar98k
  const german = kind === "german", us = kind === "american";
  const wood = german ? 0x6a3c20 : us ? 0x82522d : 0x7d5631, guard = german ? 0x5e341d : us ? 0x744828 : 0x6c4a2a;
  const steel = 0x2a2b2d, worn = 0x45464a, strap = german ? 0x3b3428 : us ? 0x8b7e57 : 0x8a7f55;
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const tube = (r, len, seg = 10) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);   // lies along the barrel
  const P = [];
  // wooden butt and wrist, shaped like a real stock from the side
  P.push({ geo: sideProfile([[0, .025], [.26, .008], [.33, 0], [.39, -.012], [.39, -.05], [.33, -.056], [.27, -.072], [0, -.16]], .048), at: [0, 0, 0], color: wood });
  P.push({ geo: box(.054, .19, .012), at: [0, -.068, .004], rot: [-.03, 0, 0], color: german || us ? steel : worn });   // butt plate
  // steel receiver with the bolt
  P.push({ geo: box(.042, .052, .15), at: [0, -.006, .465], color: worn });
  P.push({ geo: tube(.016, .2), at: [0, .02, .45], color: steel });
  if (us) {                                         // the Garand is semi-automatic: an operating rod handle instead of a bolt handle
    P.push({ geo: box(.02, .022, .05), at: [.03, .004, .53], color: steel });
    P.push({ geo: box(.03, .016, .016), at: [.045, .004, .55], color: steel });
  } else {
    P.push({ geo: new THREE.CylinderGeometry(.007, .007, .075, 6).rotateZ(german ? -2 : -1.45), at: [.036, german ? .004 : .02, .385], color: steel });
    P.push({ geo: new THREE.SphereGeometry(.014, 8, 6), at: [.07, german ? -.012 : .025, .385], color: steel });   // bolt knob
  }
  // magazine, trigger guard and trigger
  if (german || us) P.push({ geo: box(.04, .02, .1), at: [0, -.062, .47], color: steel });   // flush floor plate
  else P.push({ geo: box(.036, .075, .085), at: [0, -.085, .475], color: steel });       // box magazine underneath
  P.push({ geo: new THREE.TorusGeometry(.028, .005, 4, 10, Math.PI), at: [0, -.052, .4], rot: [0, Math.PI / 2, Math.PI], color: steel });
  P.push({ geo: box(.006, .032, .008), at: [0, -.06, .395], rot: [-.3, 0, 0], color: steel });
  // fore-end under the barrel, handguard on top
  const foreEnd = german ? .93 : us ? .98 : 1.04;
  P.push({ geo: sideProfile([[.5, -.008], [foreEnd, -.006], [foreEnd, -.038], [.62, -.046], [.52, -.052]], .042), at: [0, 0, 0], color: wood });
  P.push({ geo: box(.034, .022, german ? .36 : us ? .43 : .52), at: [0, .019, german ? .74 : us ? .735 : .81], color: guard });
  // barrel, bands, nose cap or gas cylinder, sights
  P.push({ geo: tube(.013, .72), at: [0, .006, .84], color: steel });
  P.push({ geo: tube(.016, .03), at: [0, .006, 1.185], color: steel });                // muzzle
  for (const z of german ? [.72, .9] : us ? [.8] : [.75]) P.push({ geo: box(.05, .066, .024), at: [0, -.012, z], color: steel });   // barrel bands
  if (german) P.push({ geo: box(.028, .022, .06), at: [0, -.028, .96], color: steel });  // bayonet lug
  else if (us) P.push({ geo: tube(.021, .1), at: [0, .002, 1.13], color: steel });     // gas cylinder at the muzzle
  else P.push({ geo: box(.048, .072, .07), at: [0, -.008, 1.04], color: steel });       // nose cap
  P.push({ geo: box(.032, us ? .04 : .022, .032), at: [0, us ? .05 : .042, german ? .62 : us ? .39 : .43], color: steel });   // rear sight
  const front = german ? 1.16 : us ? 1.15 : 1.05;
  P.push({ geo: box(.006, .03, .012), at: [0, .034, front], color: steel });             // front sight blade
  if (german) P.push({ geo: new THREE.CylinderGeometry(.02, .02, .035, 10, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), at: [0, .034, front], color: steel });   // sight hood
  else for (const x of [-.018, .018]) P.push({ geo: box(.006, .036, .03), at: [x, .036, front], color: steel });   // sight guards
  // sling hanging under the rifle
  const sling = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -.14, .14), new THREE.Vector3(0, -.24, .45), new THREE.Vector3(0, -.06, .74)]);
  P.push({ geo: new THREE.TubeGeometry(sling, 14, .008, 4), at: [0, 0, 0], scale: [3, 1, 1], color: strap });
  return mergeParts(P, .12);
}
const rifleGeos = {};
const rifleMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 18, specular: 0x222222 });

// brass shell cases thrown out of the rifle after each shot
let casings = [];
const casingGeo = new THREE.CylinderGeometry(.011, .011, .065, 8);
const casingMat = new THREE.MeshPhongMaterial({ color: 0xc9a043, shininess: 80, specular: 0x887744 });
const casingVel = new THREE.Vector3();
function ejectCasing(s) {
  play("bolt", s.x, s.z, { vol: .7 });
  const mesh = new THREE.Mesh(casingGeo, casingMat);
  s.ejectPort.getWorldPosition(mesh.position);
  casingVel.set(rand(.03, .05), rand(.05, .08), rand(-.02, .01)).applyQuaternion(s.group.quaternion);   // out to the side and up
  mesh.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
  scene.add(mesh);
  casings.push({ mesh, vx: casingVel.x, vy: casingVel.y, vz: casingVel.z, spin: rand(.2, .5), life: 180 });
  if (casings.length > 60) scene.remove(casings.shift().mesh);
}
function updateCasings() {
  for (const c of casings) {
    const m = c.mesh;
    c.vy -= .006;                                        // gravity
    m.position.x += c.vx; m.position.y += c.vy; m.position.z += c.vz;
    m.rotation.x += c.spin; m.rotation.z += c.spin * .7;
    const floor = groundY(m.position.x, m.position.z) + .012;
    if (m.position.y < floor) {                          // bounce, then settle on its side
      if (c.vy < -.02) play("casing", m.position.x, m.position.z);
      m.position.y = floor; c.vy = -c.vy * .35; c.vx *= .5; c.vz *= .5; c.spin *= .5;
      if (Math.abs(c.vy) < .01) { c.vy = 0; c.spin = 0; m.rotation.x = Math.PI / 2; }
    }
    if (--c.life <= 0) scene.remove(m);
  }
  casings = casings.filter(c => c.life > 0);
}

// ---------- ITEMS: the hotbar (rifle, grenades, bandages, smoke grenades) ----------
const ITEMS = {
  rifle:      { name: "Rifle" },
  grenade:    { name: "Grenade", start: 3, perWave: 2, max: 5 },
  bandage:    { name: "Bandage", start: 2, perWave: 1, max: 4 },
  smoke:      { name: "Smoke grenade", start: 2, perWave: 1, max: 3 },
};
const newInventory = () => ["rifle", "grenade", "bandage", "smoke"].map(id => ({ id, count: ITEMS[id].start }));

// small models of the items, held in the right hand (each built once, then shared)
const itemMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 20, specular: 0x222222 });
const itemGeos = {
  grenade: mergeParts([                                   // Mills bomb: segmented iron body, lever and pin ring
    { geo: new THREE.SphereGeometry(1, 12, 10).scale(.032, .046, .032), at: [0, 0, 0], color: 0x3c4a2c },
    ...[-.022, 0, .022].map(y => ({ geo: new THREE.TorusGeometry(.031, .004, 4, 14), at: [0, y, 0], rot: [Math.PI / 2, 0, 0], color: 0x2e3822 })),
    { geo: new THREE.BoxGeometry(.01, .07, .014), at: [.03, .01, 0], rot: [0, 0, -.15], color: 0x55583f },
    { geo: new THREE.TorusGeometry(.012, .002, 4, 10), at: [-.02, .045, 0], color: 0xb39a52 },
  ], .05, true),
  bandage: mergeParts([                                   // a field dressing: rolled bandage and its paper wrapper
    { geo: new THREE.CylinderGeometry(.03, .03, .075, 14), at: [0, 0, 0], rot: [0, 0, Math.PI / 2], color: 0xe2dac6 },
    { geo: new THREE.CylinderGeometry(.031, .031, .03, 14), at: [-.02, 0, 0], rot: [0, 0, Math.PI / 2], color: 0x9c8a62 },
  ], .05, true),
  smoke: mergeParts([                                     // a smoke grenade: a painted tin can with a white band and a fuse lever on top
    { geo: new THREE.CylinderGeometry(.03, .03, .1, 14), at: [0, 0, 0], color: 0x5c6440 },
    { geo: new THREE.CylinderGeometry(.031, .031, .022, 14), at: [0, .02, 0], color: 0xe6e2d4 },
    { geo: new THREE.CylinderGeometry(.012, .016, .02, 10), at: [0, .06, 0], color: 0x3a3a34 },
    { geo: new THREE.BoxGeometry(.01, .07, .012), at: [.03, .025, 0], rot: [0, 0, -.12], color: 0x55583f },
    { geo: new THREE.TorusGeometry(.012, .002, 4, 10), at: [-.02, .07, 0], color: 0xb39a52 },
  ], .05, true),
};

// grenades in flight: they bounce, roll to a stop, then explode
let grenades = [];
const grenadeGeo = itemGeos.grenade;
function throwGrenade(p, kind = "grenade") {
  play("throw", p.x, p.z);
  const f = forward(p.yaw), mesh = new THREE.Mesh(kind === "smoke" ? itemGeos.smoke : grenadeGeo, itemMat);
  const g = { kind, mesh, x: p.x + f.x * .5, y: p.y + 1.7, z: p.z + f.z * .5, vx: f.x * .24 + p.vx * .5, vy: .16, vz: f.z * .24 + p.vz * .5,
    fuse: kind === "smoke" ? SMOKE_FUSE : GRENADE_FUSE, r: .08 };
  mesh.scale.setScalar(1.6); mesh.castShadow = true; mesh.position.set(g.x, g.y, g.z);
  scene.add(mesh); grenades.push(g);
  p.kick = 1;
}
function updateGrenades() {
  for (const g of grenades) {
    g.vy -= .012;                                         // gravity
    const nx = g.x + g.vx, nz = g.z + g.vz;
    if (blocked(nx, g.z, g.r, g.y) || groundY(nx, g.z) > g.y + .2) g.vx *= -.4; else g.x = nx;   // bounce off walls and trench sides
    if (blocked(g.x, nz, g.r, g.y) || groundY(g.x, nz) > g.y + .2) g.vz *= -.4; else g.z = nz;
    g.y += g.vy;
    const floor = supportY(g.x, g.z, g.y + .3) + .05;
    if (g.y < floor) { if (g.vy < -.04) play("clink", g.x, g.z); g.y = floor; g.vy = Math.abs(g.vy) > .03 ? -g.vy * .3 : 0; g.vx *= .55; g.vz *= .55; }   // bounce, then roll to a stop
    if (g.vy === 0) { g.vx *= .88; g.vz *= .88; }        // rolling through the grass slows it quickly
    g.mesh.position.set(g.x, g.y, g.z);
    g.mesh.rotation.x += Math.hypot(g.vx, g.vz) * 3; g.mesh.rotation.z += g.vx * 2;
    if (--g.fuse <= 0) { if (g.kind === "smoke") startSmoke(g); else explode(g); }
  }
  grenades = grenades.filter(g => g.fuse > 0);
}
const softTex = (() => {             // a soft round blob, for smoke
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(.5, "rgba(255,255,255,.55)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
let smokes = [];
function startSmoke(g) {             // the can lies on the ground hissing out smoke
  smokes.push({ x: g.x, y: g.y, z: g.z, t: 0, r: 0, mesh: g.mesh, drift: rand(0, 6.3) });
  play("hiss", g.x, g.z);
}
function updateSmokes() {
  for (const c of smokes) {
    c.t++;
    const pouring = c.t < SMOKE_TIME, fading = clamp01((SMOKE_TIME + 420 - c.t) / 420);
    c.r = SMOKE_RADIUS * Math.min(1, c.t / 200) * fading;     // the cloud swells, holds, then thins out
    const wx = Math.cos(c.drift) * .004, wz = Math.sin(c.drift) * .004;   // a gentle breeze
    if (pouring && c.t % 3 === 0) {
      const big = Math.min(1, c.t / 150);
      addPuff(c.x + rand(-.3, .3), c.y + .3, c.z + rand(-.3, .3), pick([0xdcdcd6, 0xcfcfc8, 0xe8e6e0]), rand(300, 420), .006,
        { vx: rand(-.02, .02) * (1 + big) + wx, vy: rand(.004, .012), vz: rand(-.02, .02) * (1 + big) + wz, alpha: .55, size: rand(.8, 1.6) * (.6 + big), soft: true });
    }
    if (pouring && c.t % 120 === 0) play("hiss", c.x, c.z, { vol: .6 });
  }
  for (const c of smokes) if (c.t > SMOKE_TIME + 420) scene.remove(c.mesh);
  smokes = smokes.filter(c => c.t <= SMOKE_TIME + 420);
}
function smokeBlocks(a, b) {         // does a smoke cloud lie between a and b?
  for (const c of smokes) {
    if (c.r < .5) continue;
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    const k = clamp01(((c.x - a.x) * dx + (c.z - a.z) * dz) / L2);
    if (Math.hypot(a.x + dx * k - c.x, a.z + dz * k - c.z) < c.r * .85) return true;
  }
  return false;
}
function explode(g) { scene.remove(g.mesh); blast(g.x, g.y, g.z, 1); }
function blast(x, y, z, power) {     // an explosion at (x, y, z); power 1 = a grenade
  const g = { x, y, z }, R = GRENADE_RADIUS * power;
  play("boom", x, z, { vol: 1.4 * power });
  const at = { x, z, y };
  // anyone close enough, and not behind a wall, gets hurt: less the further away they are
  for (const v of [...enemies, ...players.filter(p => p.alive), ...allies]) {
    const d = Math.hypot(v.x - g.x, v.z - g.z, ((v.y || 0) + .9) - g.y);
    if (d > R || !clearShot(at, v, g.y + .5, (v.y || 0) + 1)) continue;
    const hurt = GRENADE_DAMAGE * power * (1 - d / R) * (v.num ? .6 : 1);   // your own grenade hurts you less
    v.hp -= hurt; v.sinceHit = 0; v.lastHit = { blast: true, dx: v.x - g.x, dz: v.z - g.z };
    bloodPuff(v.x, (v.y || 0) + 1.1, v.z, v.x - g.x, v.z - g.z);
    if (v.num) v.hurtFlash = 1;
    if (!v.num) { v.uni.emissive.setHex(0x777777); v.flash = 6; }
  }
  for (const t of tanks) {            // tanks shrug off a distant blast, but one right beside them does real damage
    const d = Math.max(0, Math.hypot(t.x - x, t.z - z) - 1.5);
    if (!t.dead && d < R) t.hp -= GRENADE_DAMAGE * power * TANK_ARMOUR_BLAST * (1 - d / R);
  }
  for (const p of players) p.shake = Math.max(p.shake || 0, clamp01(1 - Math.hypot(p.x - g.x, p.z - g.z) / 35) * 1.3);
  // a big flash of light that lights up everything around
  const light = flashLights[nextLight++ % flashLights.length];
  light.position.set(g.x, g.y + 2, g.z); light.intensity = 14; light.distance = 32;
  // the fireball: a white-hot core inside rolling orange and red flame
  for (let i = 0; i < 26; i++) {
    const a = rand(0, 6.3), r = rand(0, 1.6);
    addPuff(g.x + Math.cos(a) * r, g.y + rand(.3, 2.6), g.z + Math.sin(a) * r, i < 6 ? 0xfff0b0 : i < 16 ? 0xff7a22 : 0xd23a14, rand(12, 22), .06,
      { vx: Math.cos(a) * rand(.02, .06), vy: rand(.03, .09), vz: Math.sin(a) * rand(.02, .06), alpha: .95, size: rand(1.8, 3.4), glow: true });
  }
  // a shockwave of dust racing out across the ground
  const ring = new THREE.Mesh(new THREE.RingGeometry(.8, 1.4, 40), new THREE.MeshBasicMaterial({ color: 0xd9ccaa, transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(g.x, g.y + .15, g.z); scene.add(ring);
  puffs.push({ mesh: ring, life: 18, max: 18, grow: .22, vx: 0, vy: 0, vz: 0, alpha: .7 });
  for (let i = 0; i < 24; i++) {                         // dust rolling outwards along the ground
    const a = i / 24 * 6.3 + rand(-.1, .1), s = rand(.18, .3);
    addPuff(g.x, g.y + .4, g.z, 0xb3a684, rand(30, 55), .04, { vx: Math.cos(a) * s, vy: rand(0, .02), vz: Math.sin(a) * s, alpha: .55, size: rand(.7, 1.2) });
  }
  // a tall column of dark smoke that rises and spreads
  for (let i = 0; i < 30; i++) addPuff(g.x + rand(-1.2, 1.2), g.y + rand(.5, 3), g.z + rand(-1.2, 1.2), i % 3 ? 0x34302b : 0x57514a, rand(160, 260), .012,
    { vx: rand(-.03, .03), vy: rand(.03, .08), vz: rand(-.03, .03), alpha: .6, size: rand(1.2, 2.4) });
  // earth and stones flung high into the air, falling back down
  for (let i = 0; i < 45; i++) {
    const a = rand(0, 6.3), s = rand(.08, .3);
    addPuff(g.x, g.y + .3, g.z, i % 3 ? 0x5a4632 : 0x7a6447, rand(40, 80), -.005, { vx: Math.cos(a) * s, vy: rand(.2, .45), vz: Math.sin(a) * s, alpha: 1, size: rand(.15, .4), gravity: true });
  }
  // a wide blackened crater mark left on the ground
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(3.2, 28), new THREE.MeshBasicMaterial({ color: 0x15110d, transparent: true, opacity: .55, depthWrite: false }));
  scorch.rotation.x = -Math.PI / 2; scorch.position.set(g.x, g.y - .02, g.z); scene.add(scorch);
  puffs.push({ mesh: scorch, life: 1800, max: 1800, grow: 0, vx: 0, vy: 0, vz: 0, alpha: .55 });
}

// which item a soldier is holding: the rifle in both hands, or slung on the back with the item in hand
function showItem(s) {
  if (!s.held || s.shownSlot === s.slot) return;
  s.shownSlot = s.slot;
  const id = s.inv[s.slot].id;
  s.rifle.scale.set(1, 1, 1);                          // (in case it was dropped when he fell)
  if (id === "rifle") { s.torso.add(s.rifle); s.rifle.position.set(.1, 1.37, .02); s.rifle.rotation.set(0, 0, 0); }
  else { s.sling.add(s.rifle); s.rifle.position.set(0, 0, -.6); s.rifle.rotation.set(0, 0, 0); }
  for (const k in s.held) s.held[k].visible = k === id;
}

// the hotbar on screen: one box per item, with its key, a little picture and how many are left
const ICONS = {
  rifle: '<svg viewBox="0 0 48 48"><path d="M3 27h7l3-3h17v-3h13v4h2v3H31l-2 2h-6l-2 4h-5l1-4h-4l-3 4H3z" fill="currentColor"/></svg>',
  grenade: '<svg viewBox="0 0 48 48"><ellipse cx="22" cy="28" rx="11" ry="14" fill="currentColor"/><path d="M14 22h16M13 28h18M14 34h16M18 15v26M26 15v26" stroke="#141510" stroke-width="1.6"/><path d="M27 13l9 18" stroke="currentColor" stroke-width="3"/><circle cx="17" cy="11" r="4" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  bandage: '<svg viewBox="0 0 48 48"><rect x="8" y="14" width="32" height="20" rx="4" fill="currentColor"/><path d="M24 18v12M18 24h12" stroke="#b33" stroke-width="4"/></svg>',
  smoke: '<svg viewBox="0 0 48 48"><circle cx="17" cy="14" r="7" fill="currentColor" opacity=".5"/><circle cx="27" cy="10" r="8" fill="currentColor" opacity=".45"/><circle cx="35" cy="17" r="6" fill="currentColor" opacity=".4"/><rect x="15" y="22" width="16" height="22" rx="2" fill="currentColor"/><rect x="15" y="27" width="16" height="4" fill="#141510"/><path d="M31 23l5 12" stroke="currentColor" stroke-width="3"/></svg>',
};
function buildHotbar(p) {
  const bar = document.getElementById("hotbar" + p.num);
  bar.innerHTML = p.inv.map((it, i) =>
    `<div class="slot"><span class="key">${p.num === 1 ? i + 1 : ""}</span>${ICONS[it.id]}<span class="count"></span><span class="label">${ITEMS[it.id].name}</span></div>`).join("");
}
function updateHotbar(p) {
  const slots = document.getElementById("hotbar" + p.num).children;
  p.inv.forEach((it, i) => {
    slots[i].classList.toggle("on", i === p.slot);
    slots[i].classList.toggle("empty", it.count === 0);
    slots[i].querySelector(".count").textContent = it.count === undefined ? "" : it.count;
  });
}

// ---------- SOUND: every sound is made by the browser's audio system, no sound files needed ----------
const sound = { ctx: null, master: null, muted: false, noise: null };
try { sound.muted = localStorage.getItem("frontline-muted") === "1"; } catch (e) {}
function startSound() {              // browsers only allow sound after a click or key press
  if (sound.ctx) {
    if (sound.ctx.state !== "running") sound.ctx.resume().then(() => { showSoundState(); if (!sound.muted) play("bolt", undefined, undefined, { vol: .6 }); });
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = sound.ctx = new AC();
  sound.master = ctx.createGain(); sound.master.gain.value = sound.muted ? 0 : SOUND_VOLUME;
  const squash = ctx.createDynamicsCompressor();       // keeps lots of gunfire from getting painfully loud
  sound.master.connect(squash); squash.connect(ctx.destination);
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;   // white noise, shaped into most sounds below
  sound.noise = buf;
  // a gentle wind in the background, rising and falling
  const wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true;
  const wf = ctx.createBiquadFilter(); wf.type = "lowpass"; wf.frequency.value = 380;
  const wg = ctx.createGain(); wg.gain.value = .05;
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .07; lg.gain.value = .03;
  lfo.connect(lg); lg.connect(wg.gain); lfo.start();
  wind.connect(wf); wf.connect(wg); wg.connect(sound.master); wind.start();
  ctx.onstatechange = showSoundState;
  if (ctx.state !== "running") ctx.resume();
  setTimeout(() => { if (!sound.muted) play("bolt", undefined, undefined, { vol: .6 }); showSoundState(); }, 60);   // a click so you know sound is on
}
// any click, tap or key press anywhere switches sound on (and wakes it if the browser paused it)
for (const ev of ["pointerdown", "keydown", "touchstart"]) window.addEventListener(ev, startSound, true);
document.addEventListener("visibilitychange", () => { if (!document.hidden && sound.ctx) startSound(); });
function showSoundState() {          // the little label in the corner of the game
  const el = document.getElementById("soundState");
  if (!el) return;
  const on = sound.ctx && sound.ctx.state === "running";
  el.textContent = sound.muted ? "SOUND OFF · press M" : on ? "SOUND ON · M to mute" : "CLICK FOR SOUND";
  el.classList.toggle("off", sound.muted || !on);
}
function toggleMute() {
  sound.muted = !sound.muted;
  try { localStorage.setItem("frontline-muted", sound.muted ? "1" : "0"); } catch (e) {}
  if (sound.master) sound.master.gain.setTargetAtTime(sound.muted ? 0 : SOUND_VOLUME, sound.ctx.currentTime, .05);
  if (!sound.muted) setTimeout(() => play("bolt", undefined, undefined, { vol: .6 }), 80);
  showSoundState();
}
// how loud a sound at (x, z) is for the listener, and how far left or right
function hearing(x, z) {
  const near = players.filter(p => p.alive).concat(players)[0];
  if (x === undefined || !near) return { vol: 1, pan: 0, far: 0 };
  let best = near;
  for (const p of players) if (Math.hypot(p.x - x, p.z - z) < Math.hypot(best.x - x, best.z - z)) best = p;
  const d = Math.hypot(best.x - x, best.z - z);
  let pan = 0;
  if (!twoPlayer && d > .5) {
    const r = rightOf(best.yaw);
    pan = Math.max(-1, Math.min(1, ((x - best.x) * r.x + (z - best.z) * r.z) / d)) * -.8;
  }
  return { vol: 1 / (1 + d / 9), pan, far: clamp01(d / 60) };
}
function out(vol, pan) {             // a volume knob and left/right placement, plugged into the speakers
  const ctx = sound.ctx, g = ctx.createGain(); g.gain.value = vol;
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(sound.master); }
  else g.connect(sound.master);
  return g;
}
// a burst of filtered noise that fades away: the basis of bangs, thuds, rustles and whooshes
function noiseHit(dest, { start = 0, len = .2, type = "lowpass", freq = 1000, endFreq, q = 1, vol = 1, attack = .002 }) {
  const ctx = sound.ctx, t = ctx.currentTime + start;
  const src = ctx.createBufferSource(); src.buffer = sound.noise;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, t + len);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.001, t + len);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t, Math.random() * 1.5); src.stop(t + len + .05);
}
function tone(dest, { start = 0, len = .1, freq = 440, endFreq, type = "sine", vol = .3 }) {
  const ctx = sound.ctx, t = ctx.currentTime + start, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + len);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + len);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + len + .02);
}
function play(name, x, z, extra = {}) {
  if (!sound.ctx || sound.muted) return;
  const h = hearing(x, z);
  if (h.vol < .02) return;
  const o = out(h.vol * (extra.vol ?? 1), h.pan), dull = 1 - h.far * .7;   // far-away sounds lose their sharp edge
  switch (name) {
    case "rifle": {                  // a sharp crack, a deep boom, then an echo off the countryside
      const enemy = extra.enemy;
      noiseHit(o, { len: .09, type: "highpass", freq: 1400 * dull, vol: 1.1 * dull });
      noiseHit(o, { len: .35, freq: (enemy ? 700 : 900) * dull, endFreq: 120, vol: 1.3 });
      tone(o, { len: .18, freq: enemy ? 110 : 130, endFreq: 45, vol: .5 });
      noiseHit(o, { start: .18 + h.far * .25, len: .9, freq: 420, endFreq: 150, vol: .22, attack: .04 });
      break;
    }
    case "bolt":                     // working the bolt: two metal clacks
      noiseHit(o, { len: .05, type: "bandpass", freq: 2600, q: 3, vol: .5 });
      noiseHit(o, { start: .16, len: .06, type: "bandpass", freq: 2000, q: 3, vol: .6 });
      break;
    case "casing":                   // brass bouncing on the ground
      tone(o, { len: .08, freq: 3200 + Math.random() * 800, type: "triangle", vol: .08 });
      tone(o, { start: .07, len: .06, freq: 2800 + Math.random() * 600, type: "triangle", vol: .05 });
      break;
    case "whiz":                     // a bullet passing close by
      noiseHit(o, { len: .22, type: "bandpass", freq: 3500, endFreq: 1200, q: 4, vol: .7, attack: .03 });
      break;
    case "hit":                      // a bullet striking someone
      noiseHit(o, { len: .12, freq: 500, endFreq: 120, vol: .9 });
      tone(o, { len: .1, freq: 90, endFreq: 50, vol: .4 });
      break;
    case "dirt":                     // a bullet striking the ground or a wall
      noiseHit(o, { len: .1, type: "bandpass", freq: 900, q: .8, vol: .35 });
      break;
    case "reload":                   // clip in, bolt home
      noiseHit(o, { len: .06, type: "bandpass", freq: 1800, q: 2, vol: .45 });
      noiseHit(o, { start: .45, len: .05, type: "bandpass", freq: 2400, q: 3, vol: .4 });
      noiseHit(o, { start: .55, len: .08, type: "bandpass", freq: 1500, q: 2, vol: .55 });
      break;
    case "throw":
      noiseHit(o, { len: .25, type: "bandpass", freq: 700, endFreq: 1800, q: 1.2, vol: .3, attack: .06 });
      break;
    case "clink":                    // a grenade bouncing
      tone(o, { len: .07, freq: 1400 + Math.random() * 300, type: "triangle", vol: .12 });
      break;
    case "boom": {                   // a big explosion: a sharp blast, a deep thump and a long rumble
      noiseHit(o, { len: .25, freq: 3000 * dull, endFreq: 400, vol: 1.6 });
      noiseHit(o, { len: 1.8, freq: 420, endFreq: 40, vol: 2, attack: .005 });
      tone(o, { len: .9, freq: 70, endFreq: 25, vol: .9 });
      noiseHit(o, { start: .2, len: 2.2, freq: 160, endFreq: 40, vol: .6, attack: .3 });
      break;
    }
    case "cannon": {                 // a tank's main gun: a huge crack and a deep boom
      noiseHit(o, { len: .15, type: "highpass", freq: 900 * dull, vol: 1.6 * dull });
      noiseHit(o, { len: 1.2, freq: 600 * dull, endFreq: 60, vol: 2 });
      tone(o, { len: .6, freq: 80, endFreq: 30, vol: .9 });
      noiseHit(o, { start: .25 + h.far * .3, len: 1.4, freq: 300, endFreq: 80, vol: .35, attack: .05 });
      break;
    }
    case "mg":                       // one round of a machine gun burst
      noiseHit(o, { len: .06, type: "highpass", freq: 1600 * dull, vol: .6 * dull });
      noiseHit(o, { len: .14, freq: 800 * dull, endFreq: 150, vol: .7 });
      break;
    case "clang":                    // a bullet bouncing off armour plate
      tone(o, { len: .25, freq: 1900 + Math.random() * 600, type: "triangle", vol: .18 });
      noiseHit(o, { len: .05, type: "highpass", freq: 3000, vol: .3 });
      break;
    case "hiss":                     // a smoke grenade pouring out smoke
      noiseHit(o, { len: 2.2, type: "highpass", freq: 3200, vol: .18, attack: .15 });
      noiseHit(o, { len: 2.2, type: "bandpass", freq: 1200, q: .6, vol: .08, attack: .2 });
      break;
    case "step":                     // a footstep in grass and dirt
      noiseHit(o, { len: .09, type: "bandpass", freq: 420 + Math.random() * 200, q: .9, vol: .45 * (extra.run ? 1.4 : 1) });
      break;
    case "land":
      noiseHit(o, { len: .16, freq: 300, endFreq: 90, vol: .55 });
      break;
    case "bandage":                  // tearing open the wrapper, then cloth
      for (let i = 0; i < 4; i++) noiseHit(o, { start: i * .09, len: .08, type: "highpass", freq: 2500, vol: .25 });
      noiseHit(o, { start: .4, len: .5, type: "bandpass", freq: 1500, q: .7, vol: .15, attack: .1 });
      break;
    case "whistle": {                // an officer's whistle at the start of each wave
      const ctx = sound.ctx, t = ctx.currentTime, osc = ctx.createOscillator(), trill = ctx.createOscillator(), tg = ctx.createGain(), g = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = 2300; trill.frequency.value = 28; tg.gain.value = 120;
      trill.connect(tg); tg.connect(osc.frequency);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.18, t + .03); g.gain.setValueAtTime(.18, t + .7); g.gain.exponentialRampToValueAtTime(.001, t + .9);
      osc.connect(g); g.connect(o); osc.start(t); trill.start(t); osc.stop(t + 1); trill.stop(t + 1);
      break;
    }
  }
}

// ---------- TANKS: M4 Sherman for your side, Panzer IV for the Germans ----------
// Each tank is built from boxes, cylinders and sloped plates, glued into a hull and a turret that turns.
const tankMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, metalness: .25 });
const tankGeos = {};
function slab(w, h, d, frontSlope = 0, backSlope = 0) {    // a box whose top front and/or back edge is cut back at an angle
  const g = new THREE.BoxGeometry(w, h, d, 1, 1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setZ(i, p.getZ(i) > 0 ? p.getZ(i) - frontSlope : p.getZ(i) + backSlope);
  g.computeVertexNormals();
  return g;
}
const wheelGeo = (r, w) => new THREE.CylinderGeometry(r, r, w, 16).rotateZ(Math.PI / 2);
function trackParts(P, side, len, wheels, wheelR, color, rubber, steel) {   // tracks, road wheels, sprocket and idler on one side
  const x = side * 1.12, n = wheels.length;
  P.push({ geo: new THREE.BoxGeometry(.5, .07, len - .55), at: [x, .07, 0], color });                 // bottom run
  P.push({ geo: new THREE.BoxGeometry(.5, .07, len - .4), at: [x, 1.0, -.05], color });               // top run
  for (const z of [len / 2 - .32, -len / 2 + .3]) {
    P.push({ geo: wheelGeo(.46, .5), at: [x, .52, z], color });                                        // track wrapped round sprocket and idler
    P.push({ geo: wheelGeo(.3, .54), at: [x, .52, z], color: steel });
  }
  for (let i = 0; i < n; i++) {
    P.push({ geo: wheelGeo(wheelR, .22), at: [x + side * .1, wheelR + .07, wheels[i]], color: rubber });   // road wheels
    P.push({ geo: wheelGeo(wheelR * .6, .26), at: [x + side * .1, wheelR + .07, wheels[i]], color: steel });
  }
  for (let i = 0; i < len / .18; i++) P.push({ geo: new THREE.BoxGeometry(.52, .04, .05), at: [x, .02, -len / 2 + .3 + i * .18], color: rubber });   // track links
}
function star(r) {                    // the white Allied star
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * .4 : r; s[i ? "lineTo" : "moveTo"](Math.cos(a) * rr, Math.sin(a) * rr); }
  return new THREE.ShapeGeometry(s);
}
function shermanGeometry() {
  const OD = 0x5a6236, dark = 0x3c4126, steel = 0x3a3a34, rubber = 0x1b1a18, white = 0xe8e6dc;
  const H = [], T = [], G = [];
  trackParts(H, -1, 5.6, [-1.75, -1.25, -.25, .25, 1.25, 1.75], .3, 0x2e2d29, rubber, steel);
  trackParts(H, 1, 5.6, [-1.75, -1.25, -.25, .25, 1.25, 1.75], .3, 0x2e2d29, rubber, steel);
  for (const sx of [-1, 1]) for (const z of [-1.5, 0, 1.5]) H.push({ geo: new THREE.BoxGeometry(.2, .4, .5), at: [sx * 1.17, .5, z], color: dark });   // suspension bogies
  H.push({ geo: slab(2.1, .5, 5.5), at: [0, .65, 0], color: OD });                                    // lower hull
  H.push({ geo: slab(2.6, .95, 5.0, 1.55, .25), at: [0, 1.38, -.1], color: OD });                      // upper hull with the sloped front
  H.push({ geo: new THREE.CylinderGeometry(.35, .5, 2.4, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), at: [0, .9, 2.55], color: OD });   // rounded nose
  for (const sx of [-.5, .5]) H.push({ geo: new THREE.BoxGeometry(.6, .12, .7), at: [sx, 1.86, .3], color: dark });   // driver hatches
  H.push({ geo: new THREE.CylinderGeometry(.06, .06, .45, 8).rotateX(Math.PI / 2 - .3), at: [.55, 1.45, 2.05], color: steel });   // bow machine gun
  H.push({ geo: new THREE.BoxGeometry(2.4, .1, 1.2), at: [0, 1.88, -2.0], color: dark });                // engine deck
  H.push({ geo: new THREE.BoxGeometry(.25, .25, .9), at: [-.85, 1.95, -2.1], color: steel });            // tools stowed on the back
  for (const sx of [-1, 1]) H.push({ geo: star(.38), at: [sx * 1.305, 1.38, -.6], rot: [0, sx * Math.PI / 2, 0], color: white });   // stars on the sides
  // turret: a rounded casting with a gun mantlet in front
  T.push({ geo: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.05, .75, 1.2), at: [0, 0, -.05], color: OD });
  T.push({ geo: new THREE.CylinderGeometry(1.05, 1.1, .25, 20).scale(1, 1, 1.14), at: [0, .1, -.05], color: OD });
  T.push({ geo: new THREE.BoxGeometry(.9, .55, .35), at: [0, .35, 1.25], color: OD });                 // mantlet
  T.push({ geo: new THREE.CylinderGeometry(.32, .36, .28, 16), at: [-.38, .8, -.35], color: dark });   // commander's hatch
  T.push({ geo: new THREE.CylinderGeometry(.03, .03, .9, 6).rotateX(Math.PI / 2), at: [-.38, 1.05, .05], color: steel });   // machine gun on the roof
  T.push({ geo: star(.3), at: [0, .45, -1.3], rot: [0, Math.PI, 0], color: white });
  G.push({ geo: new THREE.CylinderGeometry(.07, .085, 2.5, 12).rotateX(Math.PI / 2), at: [0, 0, 1.25], color: OD });   // 75 mm gun
  G.push({ geo: new THREE.CylinderGeometry(.1, .1, .25, 12).rotateX(Math.PI / 2), at: [0, 0, 2.45], color: dark });
  return { hull: mergeParts(H, .1, true), turret: mergeParts(T, .1, true), gun: mergeParts(G, .06, true), turretY: 1.95, gunAt: [0, .35, 1.4], gunLen: 2.6, half: [1.4, 2.95] };
}
function panzerGeometry() {
  const tan = 0xb39d63, dark = 0x55503d, steel = 0x3a3a34, rubber = 0x1b1a18;
  const H = [], T = [], G = [];
  const wheels = []; for (let i = 0; i < 8; i++) wheels.push(-1.95 + i * .55);
  trackParts(H, -1, 5.7, wheels, .24, 0x2e2d29, rubber, steel);
  trackParts(H, 1, 5.7, wheels, .24, 0x2e2d29, rubber, steel);
  H.push({ geo: slab(2.0, .55, 5.6), at: [0, .7, 0], color: tan, fabric: 9 });                         // lower hull
  H.push({ geo: slab(2.85, .7, 5.0, .2, 0), at: [0, 1.32, -.25], color: tan, fabric: 9 });              // boxy superstructure
  H.push({ geo: slab(2.0, .5, .7, .45, 0), at: [0, .95, 2.75], color: tan, fabric: 9 });               // front plate
  H.push({ geo: new THREE.BoxGeometry(.5, .2, .25), at: [-.55, 1.5, 2.0], color: dark });                // driver's visor
  H.push({ geo: new THREE.CylinderGeometry(.05, .05, .3, 8).rotateX(Math.PI / 2), at: [.55, 1.45, 2.12], color: steel });   // hull machine gun
  for (const sx of [-1, 1]) {
    H.push({ geo: new THREE.BoxGeometry(.04, .95, 4.6), at: [sx * 1.5, 1.05, -.2], rot: [0, 0, sx * -.08], color: tan, fabric: 9 });   // side armour skirts
    // the black cross with a white border
    H.push({ geo: new THREE.BoxGeometry(.02, .62, .2), at: [sx * 1.53, 1.1, -.4], color: 0xeeeeea }); H.push({ geo: new THREE.BoxGeometry(.02, .2, .62), at: [sx * 1.53, 1.1, -.4], color: 0xeeeeea });
    H.push({ geo: new THREE.BoxGeometry(.03, .5, .1), at: [sx * 1.535, 1.1, -.4], color: 0x111111 }); H.push({ geo: new THREE.BoxGeometry(.03, .1, .5), at: [sx * 1.535, 1.1, -.4], color: 0x111111 });
  }
  H.push({ geo: new THREE.BoxGeometry(2.6, .12, 1.4), at: [0, 1.72, -2.0], color: dark });               // engine deck
  H.push({ geo: new THREE.CylinderGeometry(.12, .12, .6, 10).rotateZ(Math.PI / 2), at: [.6, 1.3, -2.85], color: steel });   // exhaust muffler
  // turret: flat-sided with sloped faces, a cupola at the back and armour plates around it
  T.push({ geo: slab(1.9, .75, 2.4, .35, .2), at: [0, .38, -.15], color: tan, fabric: 9 });
  T.push({ geo: new THREE.CylinderGeometry(.34, .36, .3, 16), at: [0, .9, -.9], color: tan, fabric: 9 });   // commander's cupola
  for (const sx of [-1, 1]) T.push({ geo: new THREE.BoxGeometry(.04, .6, 2.6), at: [sx * 1.25, .35, -.35], color: tan, fabric: 9 });   // turret skirts
  T.push({ geo: new THREE.BoxGeometry(.75, .45, .3), at: [0, .35, 1.12], color: tan, fabric: 9 });      // mantlet
  T.push({ geo: new THREE.BoxGeometry(.02, .3, .3), at: [1.28, .4, -.4], color: 0x111111 });             // turret number plate
  G.push({ geo: new THREE.CylinderGeometry(.06, .08, 3.3, 12).rotateX(Math.PI / 2), at: [0, 0, 1.65], color: tan, fabric: 9 });   // long 75 mm gun
  G.push({ geo: new THREE.CylinderGeometry(.12, .12, .3, 12).rotateX(Math.PI / 2), at: [0, 0, 3.35], color: dark });              // muzzle brake
  const camo = geo => {              // dark yellow with green and brown patches
    const p = geo.attributes.position, c = geo.attributes.color, f = geo.attributes.fabric, col = new THREE.Color();
    const green = new THREE.Color(0x4c5631), brown = new THREE.Color(0x6a4a2e);
    for (let i = 0; i < p.count; i++) {
      if (f.array[i] !== 9) continue;
      const n = noise2(p.getX(i) * 1.3 + p.getY(i) * .7, p.getZ(i) * .9), m = noise2(p.getZ(i) * 1.1 + 4, p.getX(i) * 1.2 + p.getY(i));
      col.fromArray(c.array, i * 3);
      if (n > .62) col.lerp(green, .85); else if (m > .66) col.lerp(brown, .8);
      col.toArray(c.array, i * 3);
    }
    return geo;
  };
  return { hull: camo(mergeParts(H, .1, true)), turret: camo(mergeParts(T, .1, true)), gun: camo(mergeParts(G, .06, true)), turretY: 1.72, gunAt: [0, .38, 1.25], gunLen: 3.5, half: [1.5, 2.95] };
}

let tanks = [], shells = [];
function makeTank(side, x, z, yaw) {
  const kind = side === "ally" ? "sherman" : "panzer";
  const geo = tankGeos[kind] || (tankGeos[kind] = kind === "sherman" ? shermanGeometry() : panzerGeometry());
  const mat = tankMat.clone();
  const group = new THREE.Group(); group.rotation.order = "YXZ";
  const add = (g, parent) => { const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  add(geo.hull, group);
  const turret = new THREE.Group(); turret.position.y = geo.turretY; group.add(turret);
  add(geo.turret, turret);
  const gunPivot = new THREE.Group(); gunPivot.position.set(...geo.gunAt); turret.add(gunPivot);
  const gun = add(geo.gun, gunPivot);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, geo.gunLen); gunPivot.add(muzzle);
  const mgPort = new THREE.Object3D(); mgPort.position.set(.45, 0, 1.0); gunPivot.add(mgPort);   // machine gun beside the main gun
  scene.add(group);
  const t = { tank: true, side, kind, x, z, y: groundY(x, z), yaw, turret: 0, speed: 0, hp: TANK_HP, maxHp: TANK_HP, reload: rand(60, 200), mgCool: 0, burst: 0,
    stuck: 0, reverse: 0, dead: false, burn: 0, group, turretGroup: turret, gun, muzzle, mgPort, half: geo.half, mat, r: 2.6 };
  t.bar = makeHealthBar(group); t.bar.back.scale.set(2.4, .2, 1); t.bar.back.position.y = t.bar.fill.position.y = 3.6;
  placeTank(t);
  return t;
}
// is (x, z) inside a tank's outline (grown by r)?
function insideTank(t, x, z, r = 0) {
  const f = forward(t.yaw), rt = rightOf(t.yaw), dx = x - t.x, dz = z - t.z;
  return Math.abs(dx * f.x + dz * f.z) < t.half[1] + r && Math.abs(dx * rt.x + dz * rt.z) < t.half[0] + r;
}
const tankAt = (x, z, h, skip, skip2) => tanks.find(t => t !== skip && t !== skip2 && h < t.y + 2.6 && insideTank(t, x, z));
function placeTank(t) {              // sit the tank on the ground, tilted to follow the slope
  const f = forward(t.yaw), rt = rightOf(t.yaw);
  const at = (a, s) => groundY(t.x + f.x * a + rt.x * s, t.z + f.z * a + rt.z * s, true);
  const front = Math.max(at(2.4, 0), at(2.4, 1), at(2.4, -1)), back = Math.max(at(-2.4, 0), at(-2.4, 1), at(-2.4, -1));
  const left = Math.max(at(0, -1.1), at(1.5, -1.1), at(-1.5, -1.1)), right = Math.max(at(0, 1.1), at(1.5, 1.1), at(-1.5, 1.1));
  t.y = Math.max((front + back) / 2, (left + right) / 2) - .02;          // tracks bridge dips such as trenches
  t.group.position.set(t.x, t.y, t.z);
  t.group.rotation.set(-Math.atan2(front - back, 4.8), t.yaw, Math.atan2(left - right, 2.2) * -1);
  t.turretGroup.rotation.y = t.turret;
}
function tankFits(t, x, z, yaw) {    // can the tank be here without hitting a wall, a tree, the house or another tank?
  if (x < MINX + 3 || x > MAXX - 3 || z < MINZ + 3 || z > MAXZ - 3) return false;
  const f = forward(yaw), rt = rightOf(yaw);
  for (const a of [-2.9, -1.4, 0, 1.4, 2.9]) for (const s of [-1.35, 0, 1.35]) {
    if (blockedByWall(x + f.x * a + rt.x * s, z + f.z * a + rt.z * s)) return false;
  }
  return !tanks.some(o => o !== t && Math.hypot(o.x - x, o.z - z) < 5.6);
}
const blockedByWall = (x, z) => walls.some(w => w.top > .5 && circleHitsRect(x, z, .2, w));

function tankTargets(t) {            // the enemies of this tank: soldiers and tanks of the other side
  const foes = t.side === "ally" ? [...enemies] : [...players.filter(p => p.alive), ...allies];
  return foes.concat(tanks.filter(o => !o.dead && o.side !== t.side));
}
function updateTank(t) {
  if (t.dead) { burnWreck(t); return; }
  if (t.flash > 0 && --t.flash === 0) t.mat.emissive.setHex(0);
  let target = null, best = 1e9;
  for (const o of tankTargets(t)) {
    const d = dist(t, o) - (o.tank ? 30 : 0);              // enemy tanks matter most
    if (d < best) { best = d; target = o; }
  }
  const lead = players.find(p => p.alive) || players[0];
  let gx, gz, keep = 22;
  if (t.side === "ally" && (!target || dist(t, lead) > 45)) { gx = lead.x - 10; gz = lead.z + (t.slot || 0); keep = 4; }   // stay near you
  else if (target) { gx = target.x; gz = target.z; keep = target.tank ? 30 : 20; }
  else { gx = t.x; gz = t.z; }
  // driving: turn the hull towards where it wants to be, then go forwards (or back off if too close)
  const want = Math.atan2(gx - t.x, gz - t.z), dg = Math.hypot(gx - t.x, gz - t.z);
  let diff = Math.atan2(Math.sin(want - t.yaw), Math.cos(want - t.yaw));
  let go = dg > keep + 4 ? TANK_SPEED : dg < keep - 8 ? -TANK_SPEED * .6 : 0;
  if (t.reverse > 0) { t.reverse--; go = -TANK_SPEED * .7; diff = t.turnAway; }
  if (Math.abs(diff) > .5 && go > 0) go *= .3;                // slow down to turn
  t.speed += (go - t.speed) * .05;
  const ny = t.yaw + Math.max(-.012, Math.min(.012, diff)) * (Math.abs(t.speed) > .005 || Math.abs(diff) > .1 ? 1 : 0);
  const f = forward(ny), nx = t.x + f.x * t.speed, nz = t.z + f.z * t.speed;
  const soldierInWay = [...players, ...allies, ...enemies].some(s => s.alive !== false && Math.hypot(s.x - nx, s.z - nz) < 4 && insideTank({ ...t, x: nx, z: nz, yaw: ny }, s.x, s.z, .4) && !insideTank(t, s.x, s.z, .2));
  if (!soldierInWay && tankFits(t, nx, nz, ny)) { t.x = nx; t.z = nz; t.yaw = ny; t.stuck = 0; }
  else { t.speed = 0; if (++t.stuck > 40 && !soldierInWay) { t.reverse = 90; t.turnAway = Math.random() < .5 ? 1 : -1; t.stuck = 0; } }
  placeTank(t);
  if (Math.abs(t.speed) > .01 && Math.random() < .3) {          // exhaust smoke and dust from the tracks
    const b = forward(t.yaw);
    addPuff(t.x - b.x * 3, t.y + 1.4, t.z - b.z * 3, 0x4a4640, rand(40, 70), .03, { vy: .02, alpha: .3, size: .4 });
    addPuff(t.x - b.x * 2.5 + rand(-1.2, 1.2), t.y + .3, t.z - b.z * 2.5, 0xb3a684, rand(30, 50), .03, { vy: .01, alpha: .25, size: .5 });
  }
  if (!target) return;
  // the turret swings round to the target; fire the main gun when it is lined up
  const d = dist(t, target);
  const aim = Math.atan2(target.x - t.x, target.z - t.z) - t.yaw;
  const td = Math.atan2(Math.sin(aim - t.turret), Math.cos(aim - t.turret));
  t.turret += Math.max(-.02, Math.min(.02, td));
  const sees = d < 95 && tankSees(t, target);
  if (--t.reload <= 0 && sees && Math.abs(td) < .05) { fireShell(t, target); t.reload = TANK_RELOAD + rand(-40, 60); }
  // machine gun bursts at soldiers that are close enough
  if (!target.tank && sees && d < 45 && Math.abs(td) < .25) {
    if (t.burst <= 0 && --t.mgCool <= 0) { t.burst = 8; t.mgCool = rand(60, 120); }
    if (t.burst > 0 && t.burst-- % 2 === 0) tankBullet(t, target);
  }
}
function tankSees(t, target) {
  if (t.seeTarget !== target || --t.seeTimer <= 0) {
    t.seeTarget = target; t.seeTimer = 10;
    t.sees = clearShot(t, target, t.y + 2.3, (target.y || 0) + (target.tank ? 1.6 : target.crouched ? .85 : 1.25)) && !smokeBlocks(t, target);
  }
  return t.sees;
}
const tmpV = new THREE.Vector3();
function fireShell(t, target) {
  const from = t.muzzle.getWorldPosition(new THREE.Vector3()), yaw = t.yaw + t.turret + rand(-.012, .012), f = forward(yaw);
  const reach = Math.max(2, Math.hypot(target.x - from.x, target.z - from.z));
  const h1 = (target.y || 0) + (target.tank ? 1.4 : 1);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd080 }));
  mesh.position.copy(from); scene.add(mesh);
  shells.push({ x: from.x, z: from.z, y: from.y, h0: from.y, h1, reach, trav: 0, vx: f.x, vz: f.z, owner: t, mesh, life: 120 });
  t.gun.position.z = -.5;                                    // recoil
  muzzleFlash(from, yaw); muzzleFlash(from, yaw);
  for (let i = 0; i < 6; i++) addPuff(from.x + rand(-.5, .5), from.y + rand(-.2, .4), from.z + rand(-.5, .5), 0x8a8478, rand(50, 90), .03, { vy: .01, alpha: .45, size: rand(.6, 1) });
  play("cannon", from.x, from.z);
  for (const p of players) p.shake = Math.max(p.shake || 0, clamp01(1 - Math.hypot(p.x - from.x, p.z - from.z) / 25) * .5);
}
function tankBullet(t, target) {
  const from = t.mgPort.getWorldPosition(new THREE.Vector3()), yaw = t.yaw + t.turret + rand(-.05, .05), f = forward(yaw);
  const reach = Math.max(1, Math.hypot(target.x - from.x, target.z - from.z)), h1 = (target.y || 0) + (target.crouched ? .85 : 1.2);
  const team = t.side, mesh = new THREE.Mesh(bulletGeo, team === "ally" ? allyTracer : enemyTracer);
  mesh.rotation.order = "YXZ"; mesh.rotation.set(-Math.atan2(h1 - from.y, reach), yaw, 0); mesh.position.copy(from); scene.add(mesh);
  bullets.push({ x: from.x, z: from.z, y: from.y, h0: from.y, h1, reach, trav: 0, lift: 0, vx: f.x * BULLET_SPEED, vz: f.z * BULLET_SPEED, team, life: 60, mesh, owner: t });
  addPuff(from.x, from.y, from.z, 0xffd27a, 3, 0, { alpha: .9, size: .25, glow: true });
  play("mg", from.x, from.z);
}
function updateShells() {
  for (const s of shells) {
    for (let k = 0; k < 4 && s.life > 0; k++) {              // small steps, so nothing is skipped at this speed
      s.x += s.vx * .7; s.z += s.vz * .7; s.trav += .7;
      s.y = s.h0 + (s.h1 - s.h0) * s.trav / s.reach;
      const hitSoldier = [...players.filter(p => p.alive), ...allies, ...enemies].some(v => Math.hypot(v.x - s.x, v.z - s.z) < .7 && s.y > (v.y || 0) && s.y < (v.y || 0) + 2);
      if (s.x < MINX - 5 || s.x > MAXX + 5 || s.z < MINZ - 5 || s.z > MAXZ + 5 || hitSoldier || tankAt(s.x, s.z, s.y, s.owner)
        || wallStopsShot(s.x, s.z, s.y, s.owner) || s.y < groundY(s.x, s.z) + .05 || s.trav > s.reach + 40) {
        s.life = 0; blast(s.x, Math.max(s.y, groundY(s.x, s.z)), s.z, SHELL_POWER);
      }
    }
    s.mesh.position.set(s.x, s.y, s.z);
    if (--s.life <= 0) scene.remove(s.mesh);
  }
  shells = shells.filter(s => s.life > 0);
}
function knockOut(t) {               // the tank is destroyed: it stops, blackens and burns
  t.dead = true; t.burn = 0; t.speed = 0;
  t.mat.color.setHex(0x3a3632); t.mat.emissive.setHex(0); t.mat.roughness = 1; t.mat.metalness = 0;
  t.turret += rand(-.4, .4); t.turretGroup.position.y += .05; t.turretGroup.rotation.z = rand(-.08, .08);
  t.gun.parent.rotation.x = rand(.05, .2);                   // the gun droops
  t.bar.back.visible = t.bar.fill.visible = false;
  blast(t.x, t.y + 1.5, t.z, 1.2);
  if (t.side === "enemy") score += 500;
}
function burnWreck(t) {              // flames for a while, then a column of smoke
  t.burn++;
  if (t.burn < 1500 && Math.random() < .5) addPuff(t.x + rand(-.8, .8), t.y + 2.3, t.z + rand(-.8, .8), pick([0xff8a2a, 0xffb040, 0xe0501c]), rand(10, 20), .04, { vy: .04, alpha: .9, size: rand(.4, .8), glow: true });
  if (t.burn < 3600 && Math.random() < .25) addPuff(t.x + rand(-.6, .6), t.y + 2.6, t.z + rand(-.6, .6), pick([0x2a2724, 0x3a3631]), rand(150, 260), .012, { vx: .01, vy: rand(.03, .06), alpha: .55, size: rand(.8, 1.4) });
}
function updateTanks() {
  tanks.forEach(updateTank);
  for (const t of tanks) {
    if (!t.dead && t.hp <= 0) knockOut(t);
    if (!t.dead) {
      t.gun.position.z += (0 - t.gun.position.z) * .08;      // gun slides back out after recoil
      const f = Math.max(.001, t.hp / t.maxHp);
      t.bar.fill.scale.set(2.3 * f, .12, 1); t.bar.fill.center.x = .5 / f; t.bar.fill.material.color.set(hpColor(f));
    }
  }
  updateShells();
  engineSound();
}
// reinforcements: your side gets up to ALLY_TANKS, the Germans bring more tanks as the waves go on
function tankWave() {
  const ours = tanks.filter(t => t.side === "ally" && !t.dead).length;
  for (let i = ours; i < ALLY_TANKS; i++) {
    const lead = players[0];
    for (let tries = 0; tries < 60; tries++) {
      const x = Math.max(MINX + 5, lead.x - rand(14, 26)), z = lead.z + rand(-20, 20);
      const t = { x, z, half: [1.4, 2.95] };
      if (tankFits(t, x, z, Math.PI / 2)) { const tk = makeTank("ally", x, z, Math.PI / 2); tk.slot = (i - .5) * 10; tanks.push(tk); break; }
    }
  }
  const theirs = Math.min(ENEMY_TANKS + Math.floor((wave - 1) / 2), 6);   // German tanks still fighting count towards this
  for (let i = tanks.filter(t => t.side === "enemy" && !t.dead).length; i < theirs; i++) {
    for (let tries = 0; tries < 60; tries++) {
      const x = MAXX - rand(5, 10), z = rand(MINZ + 6, MAXZ - 6), t = { x, z, half: [1.5, 2.95] };
      if (tankFits(t, x, z, -Math.PI / 2)) { tanks.push(makeTank("enemy", x, z, -Math.PI / 2)); break; }
    }
  }
}
let engineNode = null;
function engineSound() {             // one shared engine rumble, as loud as the nearest moving tank
  if (!sound.ctx || sound.muted) return;
  if (!engineNode) {
    const ctx = sound.ctx, src = ctx.createBufferSource(); src.buffer = sound.noise; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 140;
    const osc = ctx.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = 38;
    const og = ctx.createGain(); og.gain.value = .25;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(lp); lp.connect(g); osc.connect(og); og.connect(lp); g.connect(sound.master); src.start(); osc.start();
    engineNode = { g, osc };
  }
  let loud = 0;
  for (const t of tanks) if (!t.dead) loud = Math.max(loud, hearing(t.x, t.z).vol * (.4 + Math.min(1, Math.abs(t.speed) / TANK_SPEED) * .6));
  engineNode.g.gain.setTargetAtTime(loud * .9, sound.ctx.currentTime, .1);
}

// ---------- 4) THE SOLDIERS ----------
// Three armies of 1944, each with its own uniform, helmet, kit and rifle.
const KITS = {
  british:  { tunic: 0x7b6b46, trousers: 0x726447, web: 0x8d8a5f, helmet: 0x59563a, boots: 0x1e1a16 },
  american: { tunic: 0x857b59, trousers: 0x5f5a44, web: 0x8b7e57, helmet: 0x4b4f35, boots: 0x3d2c1d },
  german:   { tunic: 0x5c5f4e, trousers: 0x55584a, web: 0x1f1c19, helmet: 0x4d5048, boots: 0x161412 },
};
const SKIN = 0xd6a986;
const HEAD_SIZE = 1.15;       // how big heads are (1 = the original size)

// shape helpers (all sizes in metres-ish; the soldier stands 1.95 tall before scaling)
const vec = (x, y, z) => new THREE.Vector3(x, y, z);
const ball = (rx, ry, rz, seg = 16) => new THREE.SphereGeometry(1, seg, Math.round(seg * .75)).scale(rx, ry, rz);
const lathe = (pts, seg = 22) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
function limbGeo(a, b, r1, r2, seg = 14) {   // a tapered tube running from point a to point b
  const from = vec(...a), to = vec(...b);
  const geo = new THREE.CylinderGeometry(r2, r1, from.distanceTo(to), seg);
  geo.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(vec(0, 1, 0), to.clone().sub(from).normalize())));
  return geo.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
}
function helmetGeo(kind) {           // a side outline spun round, then the front lifted clear of the eyes
  const outline = {
    british:  [[0, .105], [.05, .1], [.09, .085], [.115, .06], [.128, .03], [.135, 0], [.15, -.008], [.2, -.02], [.235, -.028], [.24, -.022]],
    american: [[0, .13], [.07, .122], [.11, .098], [.132, .06], [.142, .02], [.147, -.02], [.15, -.05], [.156, -.058]],
    german:   [[0, .128], [.07, .12], [.108, .098], [.128, .065], [.135, .025], [.138, -.01], [.15, -.045], [.168, -.075], [.176, -.082]],
  }[kind];
  const geo = lathe(outline, 28);
  if (kind !== "british") {          // M1 and M35 come down over the ears and neck but sit above the brow
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < .04) p.setY(i, y + clamp01(p.getZ(i) / .15) * (kind === "german" ? .086 : .062) * clamp01((.04 - y) / .06));
    }
    geo.computeVertexNormals();
  }
  return geo;
}

// ---- the face: one smooth surface sculpted out of a ball, so there are no seams ----
const HEAD = { rx: .096, ry: .122, rz: .112, y: 1.785 };   // half-width, half-height, half-depth, height of its centre
const gauss = (v, w) => Math.exp(-(v / w) * (v / w));      // a soft bump: 1 in the middle, fading to 0
function sculptHead(x, y, z) {       // move a point on the plain ball to where a real head's surface would be
  const front = Math.max(0, z / HEAD.rz);                   // 0 at the sides and back, 1 on the face
  const low = clamp01((-y - .01) / .11);
  x *= 1 - low * .32;                                       // narrower towards the jaw and chin
  if (z < 0) z *= 1 - low * .35;                            // back of the skull curves in to the neck
  z -= front ** 4 * .012;                                   // a face is flatter than a ball
  for (const s of [-1, 1]) {
    z -= .011 * gauss(x - s * .034, .016) * gauss(y - .008, .013) * front;   // eye sockets
    z += .006 * gauss(x - s * .05, .02) * gauss(y + .018, .02) * front;      // cheekbones
    z += .005 * gauss(x - s * .011, .006) * gauss(y + .04, .006) * front;    // nostrils
  }
  z += .007 * gauss(y - .03, .01) * gauss(x, .055) * front;                 // brow ridge
  const t = clamp01((.02 - y) / .058);                                       // 0 at the bridge of the nose, 1 at the tip
  z += (.006 + .022 * t * t) * (y > -.042 ? 1 : gauss(y + .042, .007)) * gauss(x, .009 + .01 * t) * front;   // nose
  z += .005 * gauss(y + .06, .006) * gauss(x, .022) * front;               // upper lip
  z -= .003 * gauss(y + .067, .0025) * gauss(x, .024) * front;             // the line between the lips
  z += .006 * gauss(y + .074, .007) * gauss(x, .02) * front;               // lower lip
  z += .01 * gauss(y + .1, .018) * gauss(x, .03) * front;                   // chin
  return [x, y, z];
}
function facePoint(x, y) {           // where the face's surface is, seen from the front at (x, y)
  return sculptHead(x, y, HEAD.rz * Math.sqrt(Math.max(0, 1 - (x / HEAD.rx) ** 2 - (y / HEAD.ry) ** 2)));
}
function eyelid(start, length, lashes) {   // a thin shell of skin over part of the eye
  const geo = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, start, length);
  const p = geo.attributes.position, cols = [], c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const edge = lashes ? clamp01((Math.acos(p.getY(i)) - (start + length - .22)) / .22) : 0;   // darker along the lash line
    c.set(SKIN).lerp(new THREE.Color(0x2e221a), edge * .9);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  return geo.scale(.0142, .0098, .0122);
}
function headGeometry() {
  const geo = new THREE.SphereGeometry(1, 96, 72);
  const p = geo.attributes.position, cols = [], c = new THREE.Color();
  const hair = new THREE.Color(0x3b2a1d), lips = new THREE.Color(0xbc7c6c), flush = new THREE.Color(0xd08a76), socket = new THREE.Color(0xa67a64);
  const stubble = new THREE.Color(0x9a7b66), brows = new THREE.Color(0x35261b);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) * HEAD.rx, y = p.getY(i) * HEAD.ry, z = p.getZ(i) * HEAD.rz;
    p.setXYZ(i, ...sculptHead(x, y, z));
    // colour, worked out from where the point sits on the plain ball
    const front = Math.max(0, z / HEAD.rz), a = Math.abs(Math.atan2(x, z));   // a: 0 = straight ahead, PI = the back
    c.set(SKIN);
    let s = 0;
    for (const side of [-1, 1]) s += gauss(x - side * .05, .022) * gauss(y + .025, .02);
    c.lerp(flush, s * .35 * front + gauss(x, .012) * gauss(y + .035, .015) * .25 * front);       // cheeks and nose tip
    if (y < -.045) c.lerp(stubble, clamp01((-.045 - y) / .02) * .22 * clamp01(front * 2));       // a day's stubble
    c.lerp(lips, gauss(y + .067, .008) * gauss(x, .02) * front * .6);
    for (const side of [-1, 1]) c.lerp(socket, gauss(x - side * .034, .02) * gauss(y - .006, .016) * front * .3);   // soft shadow round the eyes
    for (const side of [-1, 1]) {                                                                 // eyebrows
      const bx = x - side * .036;
      c.lerp(brows, gauss(y - .029 + bx * bx * 6, .0045) * gauss(bx, .017) * front * .9);
    }
    // short army haircut: high at the forehead, down to the sideburns and the nape
    const hairline = a < .6 ? .07 : a < .95 ? .07 - (a - .6) * .07 : a < 1.4 ? .045 - (a - .95) * .15
      : a < 1.75 ? -.022 + (a - 1.4) * .06 : -.001 - Math.min(1, (a - 1.75) / .7) * .06;
    if (y > hairline) c.lerp(hair, clamp01((y - hairline) / .01) * .85);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return geo;
}

// ---- clothing helpers: cloth that folds, rounded pockets and pouches ----
const WOOL = 1, CANVAS = 2, LEATHER = 3;   // which fabric pattern the shader draws on a part
function clothTube(a, b, r1, r2, { folds = .05, bunchA = 0, bunchB = 0, seed = 0 } = {}) {   // a sleeve or trouser leg with creases
  const from = vec(...a), to = vec(...b), len = from.distanceTo(to);
  const geo = new THREE.CylinderGeometry(r2, r1, len, 22, 14);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = y / len + .5, th = Math.atan2(x, z);
    const crease = .55 * Math.sin(t * 17 + th * 2 + seed) + .35 * Math.sin(t * 29 - th * 3 + seed * 2.3) + .25 * Math.sin(t * 8 + th * 5 + seed * .7);
    const bunch = bunchA * gauss(t, .2) + bunchB * gauss(t - 1, .2);   // cloth gathers at the elbow, knee or ankle
    const k = 1 + folds * crease * (.5 + bunch) + bunch * .04;
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  geo.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(vec(0, 1, 0), to.clone().sub(from).normalize())));
  return geo.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
}
function roundBox(w, h, d, r = .008) {   // a box with softly rounded edges, like a stitched pocket or pouch
  const bs = Math.min(r, d / 2 - .0005), x = w / 2 - bs, y = h / 2 - bs, c = Math.min(r, x, y);
  const s = new THREE.Shape();
  s.moveTo(-x + c, -y); s.lineTo(x - c, -y); s.quadraticCurveTo(x, -y, x, -y + c); s.lineTo(x, y - c);
  s.quadraticCurveTo(x, y, x - c, y); s.lineTo(-x + c, y); s.quadraticCurveTo(-x, y, -x, y - c); s.lineTo(-x, -y + c);
  s.quadraticCurveTo(-x, -y, -x + c, -y);
  const depth = Math.max(.001, d - 2 * bs);
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bs, bevelSize: bs, bevelSegments: 2, curveSegments: 3 });
  return geo.translate(0, 0, -depth / 2);
}
function outlineR(outline, y) {      // how wide the body outline is at height y
  for (let i = 0; i < outline.length - 1; i++) {
    const [r0, y0] = outline[i], [r1, y1] = outline[i + 1];
    if (y >= y0 && y <= y1) return r0 + (r1 - r0) * (y - y0) / (y1 - y0);
  }
  return 0;
}
function torsoGeo(outline, kind) {   // the tunic: the body outline spun round, then given folds and creases
  const pts = [];
  for (let i = 0; i < outline.length - 1; i++) {        // add rows in between, so the cloth has room to fold
    const [r0, y0] = outline[i], [r1, y1] = outline[i + 1], n = Math.max(1, Math.round(Math.abs(y1 - y0) / .012));
    for (let j = 0; j < n; j++) pts.push([r0 + (r1 - r0) * j / n, y0 + (y1 - y0) * j / n]);
  }
  pts.push(outline[outline.length - 1]);
  const geo = lathe(pts, 48), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), th = Math.atan2(x, z);
    let k = 1 + .024 * (noise2(th * 2.5 + 7, y * 14) - .5);                                   // cloth is never perfectly smooth
    if (kind === "german") k += .03 * Math.sin(th * 13) * clamp01((.97 - y) / .15);           // tunic skirt hanging in folds
    else k += .04 * Math.max(0, Math.sin(y * 230 + th * 1.5)) * gauss(y - 1.075, .035);        // blouse bunched over the waistband
    k += .012 * Math.sin(th * 7 + y * 40) * gauss(y - 1.3, .12);                               // soft drape across the chest
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  return geo.scale(1.18, 1, .72);
}

// The cloth pattern is drawn by the graphics card from each point's position, so it never stretches
// or shows seams: a fine twill weave for wool, a basket weave for canvas webbing, grain for leather.
const CLOTH_GLSL = `
float clothHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float clothNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(clothHash(i), clothHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(clothHash(i + vec3(0.0, 1.0, 0.0)), clothHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(clothHash(i + vec3(0.0, 0.0, 1.0)), clothHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(clothHash(i + vec3(0.0, 1.0, 1.0)), clothHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float weave(float v) {               // fine lines that fade away when too small to see, instead of shimmering
  return 0.5 + 0.5 * sin(v) * clamp(1.0 - fwidth(v) * 0.6, 0.0, 1.0);
}`;
function clothShader(shader) {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nattribute float fabric;\nvarying float vFabric;\nvarying vec3 vCloth;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFabric = fabric;\nvCloth = position;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nvarying float vFabric;\nvarying vec3 vCloth;\n" + CLOTH_GLSL)
    .replace("#include <color_fragment>", `#include <color_fragment>
      if (vFabric > 0.5) {
        vec3 p = vCloth;
        float fibre = clothNoise(p * 500.0), mottle = clothNoise(p * 22.0), wear = clothNoise(p * 6.0 + 3.0), shade;
        if (vFabric < 1.5) shade = 0.92 + 0.08 * weave((p.x * 0.7 + p.y + p.z * 0.7) * 1300.0) + 0.07 * (fibre - 0.5) + 0.1 * (mottle - 0.5);
        else if (vFabric < 2.5) shade = 0.9 + 0.1 * weave(p.y * 900.0) * weave((p.x + p.z) * 900.0) + 0.06 * (fibre - 0.5) + 0.12 * (mottle - 0.5);
        else shade = 0.95 + 0.1 * (clothNoise(p * 160.0) - 0.5) + 0.1 * (mottle - 0.5);
        diffuseColor.rgb *= shade * (0.94 + 0.12 * wear);
      }`);
}
function muddy(geo, amount) {        // dirt that builds up towards the ground, worked out from each point's height
  const p = geo.attributes.position, c = geo.attributes.color, mud = new THREE.Color(0x4b3d2c), col = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const m = amount(p.getX(i), p.getY(i), p.getZ(i));
    if (m > 0) { col.fromArray(c.array, i * 3).lerp(mud, m).toArray(c.array, i * 3); }
  }
  return geo;
}

function soldierGeometry(kind) {     // built once per army, then shared by every soldier of that army
  const k = KITS[kind], german = kind === "german", us = kind === "american";
  const strapFabric = german ? LEATHER : CANVAS;
  const T = [];
  let into = T;                                                         // which list add() puts parts in
  const add = (geo, color, at = [0, 0, 0], rot, scale, fabric = 0) => into.push({ geo, color, at, rot, scale, fabric });
  const strap = (a, b, color, r = .013, fabric = strapFabric) => add(limbGeo(a, b, r, r, 6), color, [0, 0, 0], undefined, undefined, fabric);
  const round = (geo, sx, sz) => geo.scale(sx, 1, sz);          // squash a round shape into a body shape
  const button = (at, color = german ? 0x6f7268 : us ? 0x4a3626 : 0x5a4a32) => add(ball(.0085, .0085, .004, 10), color, at);

  // tunic: one outline from the hips to the neck (chest, waist, hips), with folds, shoulders, collar, shoulder straps
  const outline = german
    ? [[0, .79], [.2, .8], [.215, .86], [.205, .95], [.18, 1.04], [.178, 1.12], [.19, 1.22], [.207, 1.32], [.216, 1.4], [.21, 1.47], [.185, 1.53], [.13, 1.575], [.075, 1.6], [0, 1.6]]
    : [[0, .84], [.15, .85], [.185, .9], [.19, .97], [.176, 1.04], [.174, 1.12], [.188, 1.22], [.206, 1.32], [.215, 1.4], [.21, 1.47], [.185, 1.53], [.13, 1.575], [.075, 1.6], [0, 1.6]];
  const chestZ = y => outlineR(outline, y) * .72;                    // how far the front of the tunic sticks out at height y
  add(torsoGeo(outline, kind), k.tunic, undefined, undefined, undefined, WOOL);
  [-1, 1].forEach(s => {
    add(ball(.085, .082, .098, 20), k.tunic, [s * .245, 1.5, 0], undefined, undefined, WOOL);                       // shoulder
    add(roundBox(.13, .05, .012, .006), k.tunic, [s * .17, 1.567, 0], [-Math.PI / 2, 0, s * -.35], undefined, WOOL);   // shoulder strap
    button([s * .115, 1.588, 0]);
  });
  add(new THREE.CylinderGeometry(.084, .092, .055, 24, 1, true), german ? 0x2f3a2e : k.tunic, [0, 1.595, 0], undefined, undefined, WOOL);   // collar
  if (german) [-1, 1].forEach(s => add(roundBox(.03, .022, .006, .003), 0x8f9187, [s * .042, 1.597, .078], [0, s * .5, 0]));   // collar tabs

  // head: neck, the sculpted face, eyes with lids, ears, helmet (built on its own so it can be sized)
  const headParts = [];
  into = headParts;
  add(new THREE.CylinderGeometry(.058, .066, .14, 16), SKIN, [0, 1.63, 0]);
  add(headGeometry(), SKIN, [0, HEAD.y, 0]);
  const iris = { british: 0x56697a, american: 0x5b4128, german: 0x587d8f }[kind];
  [-1, 1].forEach(s => {
    const [ex, ey, ez] = facePoint(s * .034, .008), eye = [ex, HEAD.y + ey, ez - .0035];
    add(ball(.013, .0088, .011, 18), 0xe6ddd0, eye);                                         // white of the eye
    add(ball(.0056, .0056, .0018, 16), iris, [eye[0], eye[1] + .0004, eye[2] + .0102]);      // iris
    add(ball(.0026, .0026, .001, 10), 0x0e0c0b, [eye[0], eye[1] + .0004, eye[2] + .0115]);   // pupil
    add(eyelid(0, 1.2, true), SKIN, eye);                                                     // upper lid with lashes
    add(eyelid(2.25, Math.PI - 2.25, false), SKIN, eye);                                      // lower lid
    const ear = [s * .093, HEAD.y - .008, -.008];
    add(ball(.012, .031, .021, 14), SKIN, ear, [0, s * -.3, s * .08]);
    add(ball(.006, .019, .012, 10), 0xb88066, [ear[0] + s * .006, ear[1], ear[2] + .002], [0, s * -.3, 0]);   // inside of the ear
  });
  add(helmetGeo(kind), k.helmet, [0, kind === "british" ? 1.835 : 1.83, 0], undefined, undefined, LEATHER);   // matt painted steel
  if (kind === "british") {                                                                // chin strap
    strap([-.096, 1.805, .01], [-.045, 1.672, .045], k.web, .006); strap([.096, 1.805, .01], [.045, 1.672, .045], k.web, .006);
    strap([-.045, 1.672, .045], [.045, 1.672, .045], k.web, .006);
  } else if (us) {                                                                          // straps left hanging, as GIs wore them
    strap([-.14, 1.79, .01], [-.12, 1.66, .05], k.web, .006); strap([.14, 1.79, .01], [.12, 1.66, .05], k.web, .006);
  }

  // grow the whole head from the base of the neck, so it suits the broad shoulders and kit
  const neckBase = 1.57;
  T.push({ geo: mergeParts(headParts, 0, true).translate(0, -neckBase, 0).scale(HEAD_SIZE, HEAD_SIZE, HEAD_SIZE).translate(0, neckBase - .02, 0), color: SKIN, at: [0, 0, 0] });
  into = T;

  // arms holding the rifle: creased sleeves that gather at the elbow, a cuff, a fist with a thumb
  const arm = (shoulder, elbow, wrist, hand, seed) => {
    add(clothTube(shoulder, elbow, .085, .07, { folds: .05, bunchB: .9, seed }), k.tunic, undefined, undefined, undefined, WOOL);
    add(ball(.074, .074, .074), k.tunic, elbow, undefined, undefined, WOOL);
    add(clothTube(elbow, wrist, .068, .054, { folds: .05, bunchA: .9, bunchB: .4, seed: seed + 2 }), k.tunic, undefined, undefined, undefined, WOOL);
    add(limbGeo(wrist, wrist.map((v, i) => v + (hand[i] - wrist[i]) * .3), .058, .058), k.tunic, undefined, undefined, undefined, WOOL);   // cuff
    add(ball(.042, .05, .056, 12), SKIN, hand);
    add(limbGeo(hand, [hand[0] + .02, hand[1] + .04, hand[2] + .03], .016, .013, 8), SKIN);           // thumb
  };
  arm([.28, 1.5, 0], [.33, 1.24, .1], [.15, 1.32, .29], [.13, 1.33, .32], 1);
  arm([-.28, 1.5, 0], [-.25, 1.22, .38], [.03, 1.31, .7], [.07, 1.32, .75], 4);

  // pockets with buttoned flaps, and the kit each army carried
  const pocket = (x, y, w = .1, h = .1, z = chestZ(y) + .006) => {
    add(roundBox(w, h, .014, .006), k.tunic, [x, y, z], undefined, undefined, WOOL);
    add(roundBox(w * 1.05, .036, .016, .006), k.tunic, [x, y + h / 2 - .012, z + .004], undefined, undefined, WOOL);   // flap
    button([x, y + h / 2 - .022, z + .013]);
  };
  const kit = (geo, color, at, rot, fabric = CANVAS) => add(geo, color, at, rot, undefined, fabric);
  if (german) {
    [-1, 1].forEach(s => { pocket(s * .095, 1.38); pocket(s * .11, .9, .12, .12, .168); });
    for (const y of [1.08, 1.18, 1.28, 1.38, 1.48]) button([0, y, chestZ(y) + .006]);           // front buttons
    kit(round(new THREE.CylinderGeometry(.2, .2, .052, 24, 1, true), 1.18, .74), k.web, [0, 1.0, 0], undefined, LEATHER);   // black leather belt
    add(roundBox(.065, .05, .012, .004), 0x7a7a72, [0, 1.0, .152]);                              // grey buckle
    [-1, 1].forEach(s => {
      for (let i = 0; i < 3; i++) {                                                               // triple ammo pouches
        const at = [s * (.06 + i * .042), 1.03, .165 - i * .012], rot = [0, s * -.2, 0];
        kit(roundBox(.04, .075, .045, .007), 0x2a231c, at, rot, LEATHER);
        kit(roundBox(.042, .03, .048, .006), 0x231d17, [at[0], 1.06, at[2] + .003], rot, LEATHER);
      }
      strap([s * .09, 1.03, .16], [s * .115, 1.53, .07], k.web);                                  // Y-straps
    });
    strap([0, 1.02, -.15], [0, 1.4, -.13], k.web);
    [-1, 1].forEach(s => strap([0, 1.4, -.13], [s * .115, 1.53, -.06], k.web));
    kit(roundBox(.2, .17, .07, .02), 0x6b6b55, [.17, .92, -.14], [0, .5, 0]);                   // bread bag
    kit(roundBox(.205, .07, .075, .015), 0x5f5f4a, [.17, .98, -.14], [0, .5, 0]);
    kit(ball(.05, .08, .04), 0x5a4a32, [.22, .9, -.2], undefined, WOOL);                         // canteen in its felt cover
    add(new THREE.CylinderGeometry(.06, .06, .3, 18), 0x535a48, [-.12, 1.07, -.22]);            // gas mask canister
    for (const y of [.97, 1.07, 1.17]) add(new THREE.CylinderGeometry(.064, .064, .012, 18), 0x464c3c, [-.12, y, -.22]);
    kit(roundBox(.03, .26, .025, .008), 0x1b1a18, [-.21, .86, -.05], [.15, 0, 0], LEATHER);    // bayonet
    kit(roundBox(.12, .17, .04, .015), 0x3a3a30, [-.2, .94, -.13], [0, -.4, 0], LEATHER);       // spade in its leather case
  } else {
    kit(round(new THREE.CylinderGeometry(.2, .2, .07, 24, 1, true), 1.18, .74), k.tunic, [0, 1.0, 0], undefined, WOOL);   // waistband
    kit(round(new THREE.CylinderGeometry(.205, .205, .055, 24, 1, true), 1.18, .74), k.web, [0, 1.0, 0]);   // webbing belt
    [-1, 1].forEach(s => pocket(s * .095, 1.4));
    if (us) {
      for (const y of [1.14, 1.25, 1.36, 1.47]) button([.025, y, chestZ(y) + .006]);           // jacket buttons
      for (let i = -5; i <= 5; i++) {                                                            // cartridge belt full of clip pouches
        if (i === 0) continue;
        const a = i * .24, at = [Math.sin(a) * .245, 1.0, Math.cos(a) * .155 + .02];
        kit(roundBox(.055, .07, .035, .007), k.web, at, [0, a, 0]);
        button([at[0] + Math.sin(a) * .019, 1.02, at[2] + Math.cos(a) * .019], 0x6a6a62);
      }
      add(roundBox(.06, .05, .012, .004), 0x7a7a72, [0, 1.0, .162]);
      [-1, 1].forEach(s => { strap([s * .1, 1.03, .16], [s * .12, 1.53, .07], k.web); strap([s * .12, 1.53, -.06], [s * .1, 1.03, -.16], k.web); });
      kit(roundBox(.24, .3, .1, .025), k.web, [0, 1.28, -.2]);                                  // haversack
      kit(roundBox(.25, .08, .11, .02), k.web, [0, 1.4, -.2]);
      kit(roundBox(.12, .2, .045, .01), 0x5a5440, [0, 1.06, -.2]);                              // shovel cover
      kit(ball(.055, .08, .035), 0x6e6548, [.18, .92, -.13]);                                    // canteen
    } else {
      add(roundBox(.03, .022, .008, .003), 0x8a7a50, [.13, 1.0, .148]);                         // waistband buckle
      [-1, 1].forEach(s => {
        kit(roundBox(.11, .14, .075, .014), k.web, [s * .095, 1.2, .145]);                     // basic pouches
        kit(roundBox(.116, .05, .082, .012), k.web, [s * .095, 1.255, .148]);
        add(ball(.006, .006, .003, 8), 0x8a7a50, [s * .095, 1.24, .19]);                        // press stud
        strap([s * .095, 1.27, .17], [s * .12, 1.53, .07], k.web);                              // braces over the shoulders
        strap([s * .12, 1.53, -.06], [-s * .1, 1.03, -.16], k.web);                             // crossing at the back
      });
      kit(roundBox(.3, .28, .13, .03), k.web, [0, 1.3, -.215]);                                 // small pack
      kit(roundBox(.31, .07, .14, .02), k.web, [0, 1.42, -.215]);
      kit(ball(.06, .09, .04), k.web, [-.2, .93, -.08]);                                        // water bottle
      kit(roundBox(.12, .18, .05, .015), k.web, [.14, 1.0, -.19]);                              // entrenching tool
    }
  }

  // legs: creased trousers that bunch at the knee and blouse over the boots or gaiters
  const H = [], K = [], addTo = (list, geo, color, at = [0, 0, 0], rot, scale, fabric = 0) => list.push({ geo, color, at, rot, scale, fabric });
  addTo(H, clothTube([0, .02, 0], [0, -.43, .01], .125, .095, { folds: .045, bunchB: .7, seed: 6 }), k.trousers, undefined, undefined, undefined, WOOL);
  if (kind === "british") {                           // battledress trousers have a big map pocket on the thigh
    addTo(H, roundBox(.1, .13, .016, .006), k.trousers, [0, -.17, .117], [-.05, 0, 0], undefined, WOOL);
    addTo(H, roundBox(.105, .035, .018, .006), k.trousers, [0, -.115, .122], [-.05, 0, 0], undefined, WOOL);
  }
  addTo(K, ball(.1, .09, .102), k.trousers, undefined, undefined, undefined, WOOL);                // knee
  addTo(K, clothTube([0, 0, 0], [0, -.37, -.01], .093, .066, { folds: .05, bunchA: .6, seed: 8 }), k.trousers, undefined, undefined, undefined, WOOL);
  if (german) {
    addTo(K, ball(.1, .045, .1), k.trousers, [0, -.075, -.005], undefined, undefined, WOOL);      // trousers bloused into the boots
    addTo(K, clothTube([0, -.08, -.005], [0, -.41, -.005], .094, .08, { folds: .04, bunchB: 1, seed: 9 }), k.boots, undefined, undefined, undefined, LEATHER);   // jackboots, creased at the ankle
  } else if (us) {
    addTo(K, ball(.094, .04, .094), k.trousers, [0, -.17, -.005], undefined, undefined, WOOL);
    addTo(K, new THREE.CylinderGeometry(.088, .078, .22, 20), 0xa39472, [0, -.29, -.005], undefined, undefined, CANVAS);   // canvas leggings
    for (let i = 0; i < 5; i++) addTo(K, ball(.006, .006, .006, 6), 0x2a2a28, [.08 - i * .001, -.2 - i * .045, .03]);   // lace hooks
  } else {
    addTo(K, ball(.088, .038, .088), k.trousers, [0, -.285, -.005], undefined, undefined, WOOL);
    addTo(K, new THREE.CylinderGeometry(.078, .08, .1, 20), k.web, [0, -.34, -.005], undefined, undefined, CANVAS);   // webbing anklets
    for (const y of [-.315, -.36]) addTo(K, new THREE.CylinderGeometry(.081, .081, .012, 20), 0x6d6a48, [0, y, -.005], undefined, undefined, CANVAS);   // anklet straps
  }
  addTo(K, new THREE.CylinderGeometry(.068, .072, .07, 16), k.boots, [0, -.405, 0], undefined, undefined, LEATHER);   // ankle
  addTo(K, ball(.068, .048, .14), k.boots, [0, -.43, .05], undefined, undefined, LEATHER);       // foot
  if (!german) for (let i = 0; i < 3; i++) addTo(K, new THREE.BoxGeometry(.05, .005, .008), 0x1a1612, [0, -.39 - i * .012, .06 + i * .022], [.7, 0, 0]);   // laces
  addTo(K, new THREE.BoxGeometry(.13, .022, .29), 0x14110e, [0, -.461, .045]);                     // sole
  addTo(K, new THREE.BoxGeometry(.12, .03, .07), 0x14110e, [0, -.452, -.06]);                      // heel

  const shin = muddy(mergeParts(K, 0, true), (x, y, z) => clamp01((-.27 - y) / .2) * .5 + gauss(y, .06) * clamp01(z / .1) * .18);   // mud on the boots, dusty knees
  const thigh = muddy(mergeParts(H, 0, true), (x, y, z) => clamp01((-.33 - y) / .1) * .15 * clamp01(z / .08));
  return { torso: mergeParts(T, 0, true), thigh, shin };
}
const soldierGeos = {};

function buildSoldier(kind) {
  const geos = soldierGeos[kind] || (soldierGeos[kind] = soldierGeometry(kind));
  const g = new THREE.Group();
  g.rotation.order = "YXZ";
  // one material per soldier (colours come from the shapes), so a hit can flash just him
  const mat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 6, specular: 0x121212, side: THREE.DoubleSide });
  mat.onBeforeCompile = clothShader;                  // adds the wool, canvas and leather patterns
  mat.extensions = { derivatives: true };
  const mesh = (geo, parent, material = mat) => {
    const m = new THREE.Mesh(geo, material); m.castShadow = true; parent.add(m); return m;
  };
  // skeleton: body (bobs and rolls) holds the legs and the upper body,
  // which pivots at the hips so it can lean, twist and take recoil
  const body = new THREE.Group(); g.add(body);
  const upper = new THREE.Group(); upper.position.y = .95; body.add(upper);
  const torso = new THREE.Group(); torso.position.y = -.95; upper.add(torso);   // lets parts below use plain heights
  const hips = [], knees = [];
  [-.13, .13].forEach(side => {
    const hip = new THREE.Group(); hip.position.set(side, .9, 0); body.add(hip);
    mesh(geos.thigh, hip);
    const knee = new THREE.Group(); knee.position.set(0, -.43, .01); hip.add(knee);
    mesh(geos.shin, knee);
    hips.push(hip); knees.push(knee);
  });
  mesh(geos.torso, torso);
  rifleGeos[kind] = rifleGeos[kind] || rifleGeometry(kind);
  const rifle = mesh(rifleGeos[kind], torso, rifleMat);
  rifle.position.set(.1, 1.37, .02);                                     // rifle, butt in the shoulder
  const slingTilt = new THREE.Group(); slingTilt.position.set(0, 1.28, -.36); slingTilt.rotation.z = .55; torso.add(slingTilt);
  const sling = new THREE.Group(); sling.rotation.x = -Math.PI / 2; slingTilt.add(sling);   // across the back when not in use
  let held;
  if (kind !== "german") {                            // items the players can hold in the right hand
    held = {};
    for (const [id, at] of [["grenade", [.13, 1.37, .34]], ["bandage", [.11, 1.35, .38]], ["smoke", [.13, 1.36, .34]]]) {
      held[id] = mesh(itemGeos[id], torso, itemMat); held[id].position.set(...at); held[id].visible = false;
    }
  }
  const muzzle = new THREE.Object3D(); muzzle.position.set(.1, 1.376, 1.24); torso.add(muzzle);  // end of the barrel
  const ejectPort = new THREE.Object3D(); ejectPort.position.set(.13, 1.4, .47); torso.add(ejectPort);   // where empty cases fly out
  g.scale.setScalar(1.1);                                                // a bit bigger than standard
  scene.add(g);
  return { group: g, body, upper, hips, knees, muzzle, ejectPort, uni: mat, torso, rifle, sling, held };
}

// health bar floating above a soldier's head: green, then yellow, then red as health drops
const hpColor = f => f > .6 ? "#6fbf4a" : f > .3 ? "#e0b030" : "#d8402a";
function makeHealthBar(group) {
  const back = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x14160f, transparent: true, opacity: .75, depthWrite: false }));
  back.scale.set(.9, .13, 1); back.position.y = 2.2; back.renderOrder = 5;
  const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x6fbf4a, depthWrite: false }));
  fill.scale.set(.84, .08, 1); fill.position.y = 2.2; fill.renderOrder = 6;
  group.add(back, fill);                              // sprites always turn to face the camera
  return { back, fill };
}
function updateHealthBar(p) {
  const f = Math.max(.001, p.hp / (p.maxHp || MAX_HP)), { back, fill } = p.bar;
  back.visible = fill.visible = p.alive;
  fill.scale.x = .84 * f;
  fill.center.x = .5 / f;                             // keeps the bar's left end fixed as it shrinks
  fill.material.color.set(hpColor(f));
  back.position.y = fill.position.y = 2.2 - (p.crouchAmt || 0) * .28;   // stays just above the head when crouching
}

function makePlayer(num) {
  const s = buildSoldier(num === 1 ? "british" : "american");
  return {
    num, x: num === 1 ? -10 : 10, z: 0, y: groundY(num === 1 ? -10 : 10, 0), yaw: 0, r: .5, hp: MAX_HP, ammo: MAG_SIZE, reload: 0, cool: 0,
    alive: true, inv: newInventory(), slot: 0, bandaging: 0, shake: 0, vx: 0, vz: 0, jumpY: 0, vy: 0, land: 0, sinceHit: 0, healing: false, crouched: false, crouchAmt: 0, walk: 0, gait: 0, kick: 0, ...s, bar: makeHealthBar(s.group),
    cam: new THREE.PerspectiveCamera(65, 1, .1, 280),
  };
}
function makeAlly() {
  const lead = players[0], s = buildSoldier("british");
  let x, z, tries = 0;
  do { x = lead.x + rand(-14, 10); z = lead.z + rand(-14, 14); }       // spread out around you
  while ((blocked(x, z, .6) || Math.hypot(x - lead.x, z - lead.z) < 3 || trenchAt(x, z).d < TRENCH.half + .3) && ++tries < 50);
  const a = { ally: true, alive: true, x, z, y: groundY(x, z), vy: 0, jumpY: 0, yaw: 0, r: .5, hp: ALLY_HP, maxHp: ALLY_HP,
    cool: rand(30, 90), strafe: Math.random() < .5 ? 1 : -1, vx: 0, vz: 0, pause: 0, walk: rand(0, 6), gait: 0, kick: 0, flash: 0,
    post: { dx: x - lead.x, dz: z - lead.z }, ...s };
  a.bar = makeHealthBar(a.group);
  return a;
}
function makeEnemy() {
  let x, z;
  do {                                                  // arrive from a random edge
    const side = Math.floor(Math.random() * 4);
    x = side === 0 ? MINX + 2 : side === 1 ? MAXX - 2 : rand(MINX + 2, MAXX - 2);
    z = side === 2 ? MINZ + 2 : side === 3 ? MAXZ - 2 : rand(MINZ + 2, MAXZ - 2);
  } while (blocked(x, z, .6));
  const s = buildSoldier("german");
  const maxHp = 40 + wave * 4;
  return { x, z, y: groundY(x, z), vy: 0, jumpY: 0, yaw: 0, r: .5, hp: maxHp, cool: rand(60, 140), strafe: Math.random() < .5 ? 1 : -1,
    vx: 0, vz: 0, pause: 0, walk: rand(0, 6), gait: 0, kick: 0, flash: 0, ...s };
}

// ---------- 5) GAME RULES ----------
let players = [], allies = [], enemies = [], fallen = [], bullets = [], puffs = [];
let wave = 0, score = 0, spawnQueue = 0, spawnTimer = 0, waveTimer = 0;
let state = "menu", paused = false, twoPlayer = false;
const keys = {};
const mouse = { down: false };

const bulletGeo = new THREE.BoxGeometry(.07, .07, .8);
const allyTracer = new THREE.MeshBasicMaterial({ color: 0xfff6d0 });
const enemyTracer = new THREE.MeshBasicMaterial({ color: 0xff9a3c });
const puffGeo = new THREE.SphereGeometry(.3, 8, 6);

function clearWorld() {
  for (const o of [...players, ...allies, ...enemies, ...fallen]) { scene.remove(o.group); if (o.rifle && o.rifle.parent === scene) scene.remove(o.rifle); }
  for (const b of bullets) scene.remove(b.mesh);
  for (const p of puffs) scene.remove(p.mesh);
  for (const c of casings) scene.remove(c.mesh);
  casings = [];
  for (const o of [...players, ...fallen]) removeStain(o);
  for (const g of grenades) scene.remove(g.mesh);
  grenades = [];
  for (const c of smokes) scene.remove(c.mesh);
  smokes = [];
  for (const t of tanks) scene.remove(t.group);
  for (const sh of shells) scene.remove(sh.mesh);
  tanks = []; shells = [];
  if (engineNode) engineNode.g.gain.value = 0;
  players = []; allies = []; enemies = []; fallen = []; bullets = []; puffs = [];
}
function startGame(n) {
  clearWorld();
  twoPlayer = n === 2;
  players = [makePlayer(1)];
  if (twoPlayer) players.push(makePlayer(2));
  wave = 0; score = 0; paused = false;
  for (let i = 0; i < ALLIES; i++) allies.push(makeAlly());
  nextWave();
  state = "play";
  document.getElementById("menu").hidden = true;
  document.getElementById("over").hidden = true;
  document.getElementById("pane2").hidden = !twoPlayer;
  document.getElementById("pane1").hidden = false;
  document.getElementById("topline").hidden = false;
  document.getElementById("pane1").classList.toggle("split", twoPlayer);
  document.getElementById("pane2").classList.toggle("split", twoPlayer);
  layoutPanes();
  for (const p of players) buildHotbar(p);
  showSoundState();
}
function nextWave() {
  wave++;
  setTimeout(() => play("whistle"), 300);
  spawnQueue = 3 + wave * 2 + EXTRA_ENEMIES;
  while (players.length && allies.length < ALLIES) allies.push(makeAlly());   // reinforcements replace the fallen
  if (players.length) tankWave();
  spawnTimer = 0;
  waveTimer = 120;
  for (const p of players) {            // fallen soldiers come back, everyone patches up
    if (!p.alive) { p.alive = true; p.hp = MAX_HP / 2; p.death = null; p.rifleFall = null; removeStain(p); p.shownSlot = undefined; p.group.rotation.set(0, 0, 0); p.vx = p.vz = 0; p.jumpY = p.vy = 0; p.y = supportY(p.x, p.z, 99); p.sinceHit = 0; p.crouched = false; }
    else p.hp = Math.min(MAX_HP, p.hp + MAX_HP / 4);
    if (wave > 1) for (const it of p.inv) if (ITEMS[it.id].perWave) it.count = Math.min(ITEMS[it.id].max, it.count + ITEMS[it.id].perWave);   // resupply
  }
}
// puffs: smoke, dust and sparks. Optional extras: drift speed (vx, vy, vz), starting see-through-ness (alpha), glow
function addPuff(x, y, z, color, life, grow, { vx = 0, vy = 0, vz = 0, alpha = .8, size = 1, glow = false, gravity = false, soft = false } = {}) {
  const mesh = soft ? new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color, transparent: true, opacity: alpha, depthWrite: false }))
    : new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: alpha, depthWrite: false,
      blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
  if (soft) size *= 2.2;                                 // a soft sprite needs to be bigger to look as full as a ball
  mesh.position.set(x, y, z); mesh.scale.setScalar(size); scene.add(mesh);
  puffs.push({ mesh, life, max: life, grow, vx, vy, vz, alpha, gravity });
}

// ---- muzzle flash: a fiery red-orange burst with a yellow-orange heart, gone in a blink ----
const fireMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
const flashCore = fireMat(0xffc23d, 1);                  // hottest middle: yellow-orange
const flashFlame = fireMat(0xff6a14, .95);               // flame tongues: bright orange
const flashFire = fireMat(0xe8361a, .8);                 // outer fireball: red-orange
const flashCone = new THREE.ConeGeometry(.16, .75, 8).rotateX(Math.PI / 2).translate(0, 0, .36);   // points forward
const flashJet = new THREE.ConeGeometry(.08, .42, 6).rotateX(Math.PI / 2).translate(0, 0, .2);
const flashBall = new THREE.SphereGeometry(.15, 12, 10);
const fireBall = new THREE.SphereGeometry(.3, 12, 10);
// a few lights are made once and reused, because adding new lights mid-game makes the screen stutter
const flashLights = [0, 1, 2, 3].map(() => {
  const l = new THREE.PointLight(0xff6a2a, 0, 9, 2); scene.add(l); return l;
});
let nextLight = 0;
const muzzlePos = new THREE.Vector3();

function muzzleFlash(pos, yaw) {
  const fx = new THREE.Group();
  fx.position.copy(pos); fx.rotation.set(0, yaw, Math.random() * Math.PI);
  const core = new THREE.Mesh(flashBall, flashCore); core.position.z = .12; core.renderOrder = 3; fx.add(core);
  for (let i = 0; i < 4; i++) {                          // lumpy red-orange fireball around the core
    const blob = new THREE.Mesh(fireBall, flashFire);
    blob.position.set(rand(-.1, .1), rand(-.1, .1), rand(.1, .45));
    blob.scale.setScalar(rand(.6, 1.05)); blob.renderOrder = 1; fx.add(blob);
  }
  const flame = new THREE.Mesh(flashCone, flashFlame);
  flame.scale.set(1, 1, rand(.7, 1.3)); flame.renderOrder = 2; fx.add(flame);
  for (let i = 0; i < 4; i++) {                          // star-shaped side jets
    const jet = new THREE.Mesh(flashJet, flashFlame);
    jet.rotation.set(0, 0, i * Math.PI / 2); jet.rotateY(Math.PI / 2.6);
    jet.position.z = .05; jet.renderOrder = 2; fx.add(jet);
  }
  fx.scale.setScalar(rand(1.8, 2.2));
  scene.add(fx);
  puffs.push({ mesh: fx, life: 5, max: 5, flash: true });

  const light = flashLights[nextLight++ % flashLights.length];
  const f = forward(yaw);
  light.position.set(pos.x + f.x * .6, pos.y, pos.z + f.z * .6); light.intensity = 2.2; light.distance = 9;   // just ahead, so it lights the ground more than the shooter

  for (let i = 0; i < 3; i++) {                          // thin dark gun smoke rolls forward then drifts up
    const push = rand(.02, .05);
    addPuff(pos.x + f.x * .3, pos.y, pos.z + f.z * .3, i ? 0x6e6a62 : 0x5a5650, rand(35, 60), .045,
      { vx: f.x * push + rand(-.006, .006), vy: rand(.004, .012), vz: f.z * push + rand(-.006, .006), alpha: .3, size: rand(.1, .18) });
  }
  for (let i = 0; i < 5; i++) {                          // hot orange sparks
    const s = rand(.15, .3), side = rand(-.06, .06);
    addPuff(pos.x, pos.y, pos.z, i % 2 ? 0xff7a1a : 0xffb03a, rand(5, 10), -.08,
      { vx: f.x * s + f.z * side, vy: rand(-.01, .03), vz: f.z * s - f.x * side, alpha: 1, size: .08, glow: true });
  }
}

function stepHeight(s, jump) {        // stairs, the upstairs floor, jumping and falling off edges
  const support = supportY(s.x, s.z, s.y);
  const grounded = s.vy <= 0 && s.y <= support + .35;
  if (jump && grounded) { s.vy = JUMP_POWER; s.land = 0; }
  if (s.vy > 0 || s.y > support + .35) {                  // in the air
    s.y += s.vy; s.vy -= GRAVITY;
    if (s.y <= support) { if (s.num && s.vy < -.05) play("land", s.x, s.z); s.land = Math.min(1, -s.vy / JUMP_POWER); s.y = support; s.vy = 0; }   // touch down: bend the knees
  } else {                                                // on the ground, the stairs or the floor
    if (s.vy < -.03) s.land = Math.min(1, -s.vy / JUMP_POWER);
    s.y = support; s.vy = 0;
  }
  s.jumpY = s.y - support;
}

// target: who an enemy is aiming at. Players can't aim up or down, so their shots tilt
// towards the nearest enemy roughly in front (that is how you hit people below from upstairs)
function shoot(from, yaw, team, spread, target) {
  const a = yaw + rand(-spread, spread), f = forward(a);
  from.kick = 1;                                         // rifle recoil, shown in poseSoldier
  from.eject = 16;                                       // the empty case flies out as the bolt is worked
  if (!target) {
    let best = .22;
    for (const e of enemies) {
      const off = Math.abs(Math.atan2(Math.sin(Math.atan2(e.x - from.x, e.z - from.z) - yaw), Math.cos(Math.atan2(e.x - from.x, e.z - from.z) - yaw)));
      if (off < best && dist(from, e) < 45) { best = off; target = e; }
    }
  }
  const h0 = (from.y || 0) + (from.crouched ? 1.2 : 1.5), reach = target ? Math.max(1, dist(from, target)) : 30;
  const h1 = target ? (target.y || 0) + (target.crouched ? .85 : 1.25) : h0;
  const lift = Math.max(from.y || 0, team === "enemy" && target ? target.y || 0 : 0);
  const mesh = new THREE.Mesh(bulletGeo, team === "ally" ? allyTracer : enemyTracer);
  mesh.rotation.order = "YXZ"; mesh.rotation.set(-Math.atan2(h1 - h0, reach), a, 0); scene.add(mesh);
  bullets.push({ x: from.x + f.x * 1.2, z: from.z + f.z * 1.2, y: h0, h0, h1, reach, trav: 1.2, lift,
    vx: f.x * BULLET_SPEED, vz: f.z * BULLET_SPEED, team, life: 60, mesh });
  mesh.position.set(from.x + f.x * 1.2, h0, from.z + f.z * 1.2);
  from.group.position.set(from.x, from.y || 0, from.z); from.group.rotation.y = from.yaw;   // bring the model up to date
  muzzleFlash(from.muzzle.getWorldPosition(muzzlePos), a);
  play("rifle", from.x, from.z, { enemy: team === "enemy" });
}

function updatePlayer(p) {
  if (!p.alive) return;
  let fwd = 0, side = 0, turn = 0;
  const sprint = p.num === 1 ? keys.ShiftLeft : keys.ControlRight;
  const jumpKey = p.num === 1 ? keys.KeyJ : keys.Slash;
  const crouchKey = p.num === 1 ? keys.KeyC : keys.Period;
  if (crouchKey && !p.crouchHeld) p.crouched = !p.crouched;   // tap to crouch, tap again to stand
  p.crouchHeld = crouchKey;
  if (jumpKey && !p.jumpHeld) p.crouched = false;               // jumping stands you up
  if (!twoPlayer) {
    fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    side = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    turn = (keys.ArrowLeft || keys.KeyQ ? 1 : 0) - (keys.ArrowRight || keys.KeyE ? 1 : 0);
  } else if (p.num === 1) {
    fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    turn = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
  } else {
    fwd = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0);
    turn = (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0);
  }
  p.yaw += turn * TURN_SPEED;
  let tx = 0, tz = 0;                                    // the speed we want to reach
  if (fwd || side) {
    const f = forward(p.yaw), r = rightOf(p.yaw), len = Math.hypot(fwd, side);
    if (sprint && fwd > 0) p.crouched = false;                  // sprinting stands you up
    const speed = p.crouched ? PLAYER_SPEED * CROUCH_SPEED * (fwd < 0 ? .7 : 1)
      : sprint && fwd > 0 ? SPRINT_SPEED : fwd < 0 ? PLAYER_SPEED * .7 : PLAYER_SPEED;
    tx = (f.x * fwd + r.x * side) / len * speed;
    tz = (f.z * fwd + r.z * side) / len * speed;
  }
  const inAir = p.jumpY > .35 || p.vy > 0;
  steer(p, tx, tz, inAir ? AGILITY * .12 : AGILITY);   // in the air you mostly keep the speed you jumped with

  // jumping: press the key while standing on the ground (let go and press again for the next jump)
  stepHeight(p, jumpKey && !p.jumpHeld);
  p.jumpHeld = jumpKey;

  // recovering: after a few seconds without being hit, health slowly comes back
  p.sinceHit++;
  p.healing = p.sinceHit > REGEN_DELAY && p.hp < MAX_HP;
  if (p.healing) p.hp = Math.min(MAX_HP, p.hp + REGEN_RATE);

  if (p.cool > 0) p.cool--;
  if (p.reload > 0 && --p.reload === 0) p.ammo = MAG_SIZE;
  if (p.bandaging > 0) { p.bandaging--; p.hp = Math.min(MAX_HP, p.hp + BANDAGE_HEAL / BANDAGE_TIME); }   // bandage going on

  // choosing an item: number keys or the mouse wheel for soldier 1, the ' key for soldier 2
  if (p.num === 1) {
    p.inv.forEach((it, i) => { if (keys["Digit" + (i + 1)]) p.slot = i; });
    if (wheelSteps) { p.slot = (p.slot + wheelSteps + p.inv.length * 9) % p.inv.length; wheelSteps = 0; }
  } else {
    if (keys.Quote && !p.swapHeld) p.slot = (p.slot + 1) % p.inv.length;
    p.swapHeld = keys.Quote;
  }
  const item = p.inv[p.slot];
  const firing = p.num === 1 ? (keys.Space || (!twoPlayer && mouse.down)) : keys.Enter;
  const pressed = firing && !p.fireHeld;                 // grenades and bandages: one per press
  p.fireHeld = firing;
  if (item.id === "rifle") {
    const reloadKey = p.num === 1 ? keys.KeyR : keys.ShiftRight;
    if (reloadKey && p.ammo < MAG_SIZE && !p.reload) { p.reload = RELOAD_TIME; play("reload", p.x, p.z); }
    if (firing && p.cool === 0 && !p.reload) {
      if (p.ammo > 0) { shoot(p, p.yaw, "ally", .02); p.ammo--; p.cool = 12; }
      else { p.reload = RELOAD_TIME; play("reload", p.x, p.z); }
    }
  } else if (item.id === "grenade" || item.id === "smoke") {
    if (pressed && item.count > 0 && p.cool === 0) { throwGrenade(p, item.id); item.count--; p.cool = 40; }
  } else if (item.id === "bandage") {
    if (pressed && item.count > 0 && !p.bandaging && p.hp < MAX_HP) { p.bandaging = BANDAGE_TIME; item.count--; play("bandage", p.x, p.z); }
  }
}

function canSee(s, t) {
  if (s.seeTarget !== t || --s.seeTimer <= 0) { s.seeTarget = t; s.sees = clearShot(s, t) && !smokeBlocks(s, t); s.seeTimer = 8 + Math.floor(Math.random() * 6); }
  return s.sees;
}
function updateAlly(a) {
  if (a.flash > 0 && --a.flash === 0) a.uni.emissive.setHex(0);
  const lead = players.find(p => p.alive) || players[0];
  let t = null, d = 1e9;
  for (const e of enemies) { const de = dist(a, e); if (de < d) { d = de; t = e; } }
  const homeX = lead.x + a.post.dx * .7, homeZ = lead.z + a.post.dz * .7, fromHome = Math.hypot(a.x - homeX, a.z - homeZ);
  const goHome = !t || (fromHome > 30 && d > 20);    // no enemy about, or wandered too far: fall back towards you
  const tx = goHome ? homeX : t.x, tz = goHome ? homeZ : t.z;
  const want = Math.atan2(tx - a.x, tz - a.z);
  const diff = Math.atan2(Math.sin(want - a.yaw), Math.cos(want - a.yaw));
  a.yaw += Math.max(-ENEMY_TURN, Math.min(ENEMY_TURN, diff));
  const sees = t && !goHome && canSee(a, t);
  if (goHome) {
    const f = forward(a.yaw), go = fromHome > 3 ? ENEMY_SPEED * (fromHome > 12 ? 1.3 : 1) : 0;
    steer(a, f.x * go, f.z * go, AGILITY * .6);
  } else if (a.pause > 0) { a.pause--; steer(a, 0, 0, AGILITY * .6); }
  else if (d > 22 || !sees) {
    const f = forward(a.yaw); steer(a, f.x * ENEMY_SPEED, f.z * ENEMY_SPEED, AGILITY * .6);
  } else {
    const r = rightOf(a.yaw); steer(a, r.x * a.strafe * .06, r.z * a.strafe * .06, AGILITY * .6);
    if (Math.random() < .012) a.strafe *= -1;
    if (Math.random() < .008) a.pause = rand(25, 60);
  }
  a.crouched = !goHome && sees && a.pause > 0;          // kneel down to take aim
  stepHeight(a, false);
  if (--a.cool <= 0 && t && sees && d < 36 && Math.abs(diff) < .3) {
    shoot(a, a.yaw, "ally", .03 + d * .004, t);
    a.cool = rand(60, 110);
  }
}
function updateEnemy(e) {
  if (e.flash > 0 && --e.flash === 0) e.uni.emissive.setHex(0);
  const targets = [...players.filter(p => p.alive), ...allies];
  if (!targets.length) return;
  const t = targets.reduce((a, b) => dist(e, a) < dist(e, b) ? a : b);
  const d = dist(e, t);
  const want = Math.atan2(t.x - e.x, t.z - e.z);
  const diff = Math.atan2(Math.sin(want - e.yaw), Math.cos(want - e.yaw));   // shortest way round
  e.yaw += Math.max(-ENEMY_TURN, Math.min(ENEMY_TURN, diff));
  const sees = canSee(e, t);
  if (e.pause > 0) { e.pause--; steer(e, 0, 0, AGILITY * .6); }            // brief stop to take aim
  else if (d > 15 || !sees) {
    const f = forward(e.yaw); steer(e, f.x * ENEMY_SPEED, f.z * ENEMY_SPEED, AGILITY * .6);
  } else {
    const r = rightOf(e.yaw); steer(e, r.x * e.strafe * .06, r.z * e.strafe * .06, AGILITY * .6);
    if (Math.random() < .012) e.strafe *= -1;
    if (Math.random() < .006) e.pause = rand(20, 50);
  }
  stepHeight(e, false);
  if (--e.cool <= 0 && d < 36 && sees && Math.abs(diff) < .3) {
    // harder to hit you from far away, and harder still while you are on the move
    const moving = Math.min(1, Math.hypot(t.vx, t.vz) / PLAYER_SPEED);
    shoot(e, e.yaw, "enemy", .03 + d * .004 + moving * .05 + (t.crouched ? .03 : 0), t);   // crouching makes you a smaller target
    e.cool = rand(70, 130) - Math.min(wave * 4, 40);
  }
}

function update() {
  if (state !== "play" || paused) return;
  players.forEach(updatePlayer);
  enemies.forEach(updateEnemy);
  allies.forEach(updateAlly);
  updateTanks();
  for (const p of players) if (p.alive) animateSoldier(p, false); else animateDeath(p);
  for (const e of enemies) animateSoldier(e, false);
  for (const a of allies) animateSoldier(a, false);

  if (waveTimer > 0) waveTimer--;
  if (spawnQueue > 0 && --spawnTimer <= 0) { enemies.push(makeEnemy()); spawnQueue--; spawnTimer = SPAWN_GAP; }

  for (const b of bullets) {
    b.x += b.vx; b.z += b.vz; b.life--; b.trav += BULLET_SPEED;
    b.y = b.h0 + (b.h1 - b.h0) * b.trav / b.reach;      // a straight line from the muzzle towards the target
    b.mesh.position.set(b.x, b.y, b.z);
    if (b.x < MINX || b.x > MAXX || b.z < MINZ || b.z > MAXZ) b.life = 0;
    const hitTank = [0, .25, .5, .75].map(k => tankAt(b.x - b.vx * k, b.z - b.vz * k, b.y, b.owner)).find(t => t);
    const sweptWall = !hitTank && [.25, .5, .75].some(k => wallStopsShot(b.x - b.vx * k, b.z - b.vz * k, b.y, b.owner));   // check along the whole step too
    if (hitTank) {                                     // a rifle bullet pings off armour
      b.life = 0; hitTank.hp -= 1; play("clang", b.x, b.z);
      addPuff(b.x, b.y, b.z, 0xffd080, 4, 0, { alpha: 1, size: .12, glow: true });
    } else if (sweptWall || wallStopsShot(b.x, b.z, b.y, b.owner)) { b.life = 0; play("dirt", b.x, b.z); addPuff(b.x, Math.min(b.y, 2.5), b.z, 0xd6c9a0, 18, .06); }   // dust off the wall
    else if (b.y < groundY(b.x, b.z)) { b.life = 0; play("dirt", b.x, b.z, { vol: .7 }); addPuff(b.x, groundY(b.x, b.z) + .1, b.z, 0x9a8a6a, 14, .05); }  // kicks up dirt
    const victims = b.team === "ally" ? enemies : [...players.filter(p => p.alive), ...allies];
    if (b.team === "enemy" && b.life > 0 && !b.whizzed) for (const p of players)   // a near miss whizzes past your ear
      if (p.alive && dist(b, p) < 1.8 && dist(b, p) > .6) { b.whizzed = true; play("whiz", b.x, b.z); }
    for (const v of victims) {
      if (b.life > 0 && dist(b, v) < .6 && b.y > (v.y || 0) - .2 && b.y < (v.y || 0) + 2.3) {
        b.life = 0;
        play("hit", v.x, v.z);
        v.hp -= b.team === "ally" ? 20 : 12;
        v.sinceHit = 0;                                    // getting hit stops recovery for a while
        v.lastHit = { dx: b.vx, dz: b.vz };               // which way the bullet was going (decides how they fall)
        if (v.uni && b.team === "ally") { v.uni.emissive.setHex(0x777777); v.flash = 6; }
        bloodPuff(b.x, b.y, b.z, b.vx, b.vz);
        if (v.num) v.hurtFlash = 1;                        // red at the edges of your screen
      }
    }
  }
  for (const b of bullets) if (b.life <= 0) scene.remove(b.mesh);
  bullets = bullets.filter(b => b.life > 0);

  for (const e of enemies) if (e.hp <= 0) { score += 100; e.fall = 0; startDeath(e, e.lastHit); fallen.push(e); }
  enemies = enemies.filter(e => e.hp > 0);
  for (const a of allies) if (a.hp <= 0) { a.alive = false; a.fall = 0; a.bar.back.visible = a.bar.fill.visible = false; startDeath(a, a.lastHit); fallen.push(a); }
  allies = allies.filter(a => a.hp > 0);
  for (const f of fallen) {                 // the dead lie where they fell for a while, then sink away
    f.fall++;
    animateDeath(f);
    if (f.fall > 600) { f.death.sink += .015; updateStain(f, clamp01((680 - f.fall) / 80)); }
    if (f.fall > 680) { removeStain(f); scene.remove(f.group); if (f.rifle.parent === scene) scene.remove(f.rifle); }
  }
  fallen = fallen.filter(f => f.fall <= 680);

  for (const p of players) if (p.alive && p.hp <= 0) { p.alive = false; p.hp = 0; startDeath(p, p.lastHit); }

  for (const p of puffs) {
    p.life--;
    if (p.flash) p.mesh.scale.multiplyScalar(p.life > 3 ? 1.12 : .62);   // fireball swells for a moment, then shrinks away
    else {
      p.mesh.position.x += p.vx; p.mesh.position.y += p.vy; p.mesh.position.z += p.vz;
      p.vx *= .94; p.vz *= .94;                          // smoke slows down in the air
      if (p.gravity) { p.vy -= .012; if (p.mesh.position.y < groundY(p.mesh.position.x, p.mesh.position.z)) p.life = 0; }   // dirt falls back down
      p.mesh.scale.multiplyScalar(1 + p.grow); p.mesh.material.opacity = p.alpha * p.life / p.max;
    }
    if (p.life <= 0) scene.remove(p.mesh);
  }
  puffs = puffs.filter(p => p.life > 0);
  updateCasings();
  updateGrenades();
  updateSmokes();
  for (const l of flashLights) l.intensity *= .45;       // flash light fades in a few frames

  if (!players.some(p => p.alive)) {
    state = "over";
    if (document.pointerLockElement) document.exitPointerLock();
    document.getElementById("overText").textContent = `You held out until wave ${wave} and scored ${score} points.`;
    document.getElementById("over").hidden = false;
  } else if (spawnQueue === 0 && enemies.length === 0) {
    score += wave * 250;
    nextWave();
  }
}

// ---------- 6) DRAWING ----------
// ---------- BLOOD (kept mild): a puff of red mist on a hit, a small stain under the fallen ----------
function bloodPuff(x, y, z, dx = 0, dz = 0) {
  const len = Math.hypot(dx, dz) || 1;
  for (let i = 0; i < 10; i++) {                       // red mist
    const s = rand(.015, .045);
    addPuff(x, y + rand(-.15, .15), z, i % 2 ? 0x7a1010 : 0x5c0b0b, rand(14, 24), .05,
      { vx: dx / len * s + rand(-.012, .012), vy: rand(-.005, .02), vz: dz / len * s + rand(-.012, .012), alpha: .7, size: rand(.16, .3) });
  }
  for (let i = 0; i < 5; i++) {                        // a few drops that fall to the ground
    const s = rand(.02, .06);
    addPuff(x, y, z, 0x6a0c0c, 60, 0, { vx: dx / len * s + rand(-.02, .02), vy: rand(0, .05), vz: dz / len * s + rand(-.02, .02), alpha: .9, size: rand(.04, .07), gravity: true });
  }
  // a small spatter on the ground just behind where they were hit; it fades after a while
  const gx = x + dx / len * rand(.3, .8), gz = z + dz / len * rand(.3, .8);
  const spot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: stainTex, transparent: true, depthWrite: false, opacity: .6 }));
  spot.rotation.set(-Math.PI / 2, 0, rand(0, 6.3)); spot.scale.setScalar(rand(.3, .5)); spot.renderOrder = 1;
  spot.position.set(gx, supportY(gx, gz, y) + .02, gz); scene.add(spot);
  puffs.push({ mesh: spot, life: 900, max: 900, grow: 0, vx: 0, vy: 0, vz: 0, alpha: .6 });
}
const stainTex = (() => {               // a soft round blot, darker in the middle
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), grad = g.createRadialGradient(32, 32, 4, 32, 32, 31);
  grad.addColorStop(0, "rgba(70,8,8,.85)"); grad.addColorStop(.6, "rgba(60,6,6,.6)"); grad.addColorStop(1, "rgba(50,5,5,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  return t;
})();
function addStain(s) {                  // spreads slowly on the ground beneath someone who has fallen
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: stainTex, transparent: true, depthWrite: false, opacity: .75 }));
  mesh.rotation.set(-Math.PI / 2, 0, rand(0, 6.3));
  mesh.scale.set(.1, .1, 1); mesh.renderOrder = 1;
  scene.add(mesh);
  s.stain = { mesh, size: rand(1.4, 1.9) };
}
const stainAt = new THREE.Vector3();
function updateStain(s, fade) {
  const st = s.stain;
  if (!st) return;
  const at = s.upper.getWorldPosition(stainAt);            // under the body, not the feet
  st.mesh.position.set(at.x, (s.death ? s.death.baseY : s.group.position.y) + .025, at.z);
  const k = st.mesh.scale.x + (st.size - st.mesh.scale.x) * .01;   // grows slowly over several seconds
  st.mesh.scale.set(k, k, 1);
  if (fade !== undefined) st.mesh.material.opacity = .75 * fade;
}
function removeStain(s) { if (s.stain) { scene.remove(s.stain.mesh); s.stain = null; } }

// ---------- DYING: soldiers fall in different, natural ways ----------
// Each way of falling is a few key poses over time (in game steps, 60 = 1 second); the body moves smoothly between them.
// pitch: tip forward (+) or back (-) · roll: tip onto the side · twist: turn round · lift: raise off the ground when lying
// drop: sink at the knees · lean: bend forward at the hips · side: bend sideways · hip / knee / splay: each leg [left, right]
const DEATHS = {
  crumple: [                         // knees give way, he sags, then slumps forward onto his face
    [0, {}],
    [10, { drop: -.3, hip: [-.55, -.4], knee: [1.2, 1], lean: .45 }],
    [22, { drop: -.55, hip: [-1.1, -.9], knee: [2, 1.8], lean: .8, pitch: .3 }],
    [38, { pitch: 1.5, lift: .17, drop: -.45, hip: [-.35, -.2], knee: [1.1, 1.5], lean: .25, side: .12 }],
  ],
  backward: [                        // the hit rocks him back off his feet
    [0, {}],
    [7, { lean: -.4, pitch: -.12, knee: [.45, .2] }],
    [28, { pitch: -1.5, lift: .3, lean: -.1, hip: [-.55, -.2], knee: [.7, .35], splay: [.22, -.15] }],
  ],
  spin: [                            // spun round by the hit and dropped on his side
    [0, {}],
    [12, { twist: .9, roll: .25, drop: -.15, knee: [.6, .2], side: .3 }],
    [32, { twist: 1.4, roll: 1.5, lift: .28, knee: [.95, .4], hip: [-.55, -.1], side: .2 }],
  ],
  kneel: [                           // drops to his knees, sways there, then topples over
    [0, {}],
    [14, { drop: -.55, hip: [-1.25, -1.25], knee: [2.3, 2.3], lean: .35 }],
    [42, { drop: -.55, hip: [-1.2, -1.3], knee: [2.3, 2.3], lean: .65, side: .15 }],
    [60, { roll: 1.45, pitch: .3, lift: .25, drop: -.3, hip: [-.9, -1.1], knee: [1.5, 1.8], lean: .4 }],
  ],
};
const pickOne = (...ways) => ways[Math.floor(Math.random() * ways.length)];

// choose how someone falls from what hit them: shot in the back, the front, the side, or thrown by a blast
function startDeath(s, hit = {}) {
  const f = forward(s.yaw), r = rightOf(s.yaw), len = Math.hypot(hit.dx || 0, hit.dz || 0) || 1;
  const dx = (hit.dx || 0) / len, dz = (hit.dz || 0) / len;     // which way the bullet or blast was travelling
  const ahead = dx * f.x + dz * f.z, across = dx * r.x + dz * r.z;
  let type, mirror = Math.random() < .5 ? 1 : -1, fly = null;
  if (hit.blast) {
    type = ahead < 0 ? "backward" : "crumple";
    fly = { x: dx * .13, z: dz * .13, y: .14 };                  // thrown through the air, away from the explosion
  } else if (!hit.dx && !hit.dz) type = pickOne("crumple", "kneel");
  else if (ahead > .35) type = pickOne("crumple", "crumple", "kneel");             // shot in the back: pitches forward
  else if (ahead < -.35) type = pickOne("backward", "backward", "crumple", "kneel"); // shot from the front: knocked back
  else { type = "spin"; mirror = across > 0 ? 1 : -1; }                           // from the side: spun round that way
  if (Math.random() < .15 && !fly) type = "kneel";
  s.death = { type, mirror, t: 0, ox: 0, oz: 0, oy: 0, sink: 0, fly, baseY: s.y ?? groundY(s.x, s.z) };
  removeStain(s);
}

function dropRifle(s) {              // the rifle falls out of his hands
  if (!s.rifle || s.rifle.parent === scene) return;
  s.rifle.updateWorldMatrix(true, false);
  const m = s.rifle.matrixWorld.clone();
  scene.add(s.rifle);
  m.decompose(s.rifle.position, s.rifle.quaternion, s.rifle.scale);
  s.rifleFall = { vx: rand(-.02, .02), vy: .03, vz: rand(-.02, .02), spin: rand(-.12, .12), down: false,
    flat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand(0, 6.3), Math.PI / 2, "YXZ")) };
}

function animateDeath(s) {
  const d = s.death;
  if (!d) return;
  d.t++;
  if (s.flash > 0 && --s.flash === 0) s.uni.emissive.setHex(0);
  const keys = DEATHS[d.type];
  let i = 0;
  while (i < keys.length - 2 && d.t > keys[i + 1][0]) i++;
  const [t0, a] = keys[i], [t1, b] = keys[i + 1], last = i === keys.length - 2;
  let u = clamp01((d.t - t0) / (t1 - t0));
  u = last ? u * u : u * u * (3 - 2 * u);              // the final drop speeds up like a real fall
  const m = d.mirror;
  const val = (k, j) => {
    const get = p => p[k] === undefined ? 0 : Array.isArray(p[k]) ? p[k][m < 0 ? 1 - j : j] : p[k];
    return get(a) + (get(b) - get(a)) * u;
  };
  for (let j = 0; j < 2; j++) {
    s.hips[j].rotation.x = val("hip", j);
    s.hips[j].rotation.z = val("splay", j) * m;
    s.knees[j].rotation.x = val("knee", j);
  }
  s.body.position.y = val("drop"); s.body.rotation.z = 0;
  s.upper.rotation.set(val("lean"), 0, val("side") * m); s.upper.position.z = 0;
  // thrown by a blast: fly, land, slide a little
  if (d.fly) {
    d.ox += d.fly.x; d.oz += d.fly.z; d.oy += d.fly.y; d.fly.y -= .012;
    if (d.oy <= 0 && d.fly.y < 0) { d.oy = 0; d.fly.x *= .6; d.fly.z *= .6; d.fly.y = 0; }
  }
  const x = s.x + d.ox, z = s.z + d.oz, floor = d.fly ? supportY(x, z, d.baseY + d.oy) : d.baseY;
  s.group.position.set(x, floor + val("lift") + d.oy - d.sink, z);
  s.group.rotation.set(val("pitch"), s.yaw + val("twist") * m, val("roll") * m);
  if (d.t === 5) dropRifle(s);
  if (d.t === 40) addStain(s);                             // once they have come to rest
  updateStain(s);
  // the dropped rifle falls, bounces once and lies flat
  const rf = s.rifleFall;
  if (rf && s.rifle.parent === scene) {
    const g = s.rifle.position, ground = groundY(g.x, g.z) + .04;
    if (!rf.down) {
      g.x += rf.vx; g.y += rf.vy; g.z += rf.vz; rf.vy -= .012;
      s.rifle.rotateX(rf.spin);
      if (g.y <= ground) { g.y = ground; rf.down = true; }
    } else {
      s.rifle.quaternion.slerp(rf.flat, .3);
      g.y += (ground - g.y) * .3;
    }
  }
}

function poseSoldier(s, down) {
  if (s.death) return;                                 // the dying are moved by animateDeath
  s.group.position.set(s.x, s.y ?? groundY(s.x, s.z), s.z);           // feet on the ground, the stairs or the floor (or in the air)
  s.group.rotation.y = s.yaw;
  if (down) s.group.rotation.x = Math.max(s.group.rotation.x - .08, -Math.PI / 2);
}
function animateSoldier(s, down) {   // runs once per game step, so it looks the same on every screen
  // how far they actually moved this step, split into forwards and sideways
  const dx = s.x - (s.px ?? s.x), dz = s.z - (s.pz ?? s.z);
  s.px = s.x; s.pz = s.z;
  const f = forward(s.yaw), r = rightOf(s.yaw);
  const ahead = dx * f.x + dz * f.z, across = dx * r.x + dz * r.z;
  const speed = Math.hypot(dx, dz);
  s.gait += ((down ? 0 : Math.min(1, speed / SPRINT_SPEED)) - s.gait) * .15;   // 0 standing .. 1 sprinting
  const stepBefore = Math.floor(s.walk / Math.PI);
  s.walk += speed * 1.9;                                 // steps follow distance, so feet don't slide
  if (s.num && s.jumpY < .05 && Math.floor(s.walk / Math.PI) !== stepBefore) play("step", s.x, s.z, { run: speed > PLAYER_SPEED * 1.1, vol: s.crouched ? .5 : 1 });
  s.breath = (s.breath || 0) + .04;
  s.kick *= .8;
  if (s.eject > 0 && --s.eject === 0) ejectCasing(s);

  // which way the steps go: 1 = straight ahead, -1 = backwards, 0 = straight sideways
  if (speed > .005) {
    s.fa = (s.fa ?? 1) + (ahead / speed - (s.fa ?? 1)) * .2;
    s.sa = (s.sa ?? 0) + (across / speed - (s.sa ?? 0)) * .2;
  }
  const fa = s.fa ?? 1, sa = s.sa ?? 0;

  // legs: thighs swing opposite each other, the knee bends as the leg comes forward,
  // and sideways movement becomes side-steps instead of a forward walk
  const g = s.gait, stride = .25 + g * .55, on = Math.min(1, g * 4);
  for (let i = 0; i < 2; i++) {
    const t = s.walk + i * Math.PI;
    s.hips[i].rotation.x = (-Math.sin(t) * stride * fa - g * .15) * on;
    s.hips[i].rotation.z = (i ? 1 : -1) * Math.abs(Math.sin(s.walk)) * .22 * Math.abs(sa) * on;   // feet apart, together
    s.knees[i].rotation.x = (Math.max(0, Math.cos(t)) * (.4 + g * .9) * (.4 + .6 * Math.abs(fa)) + g * .15) * on;
  }
  // jumping: tuck the legs up in the air, then bend the knees to soak up the landing
  s.air = (s.air || 0) + ((s.jumpY > 0 ? 1 : 0) - (s.air || 0)) * .35;
  s.land = (s.land || 0) * .82;
  // crouching: thighs forward, knees deeply bent, body low, leaning slightly forward
  s.crouchAmt = (s.crouchAmt || 0) + ((s.crouched ? 1 : 0) - (s.crouchAmt || 0)) * .18;
  const c = s.crouchAmt;
  if (c > .005) for (let i = 0; i < 2; i++) {
    s.hips[i].rotation.x = s.hips[i].rotation.x * (1 - .4 * c) - (i ? 1.05 : .9) * c;
    s.knees[i].rotation.x = s.knees[i].rotation.x * (1 - .4 * c) + (i ? 1.75 : 1.6) * c;
  }
  const bend = Math.max(s.air, s.land * .8);
  if (bend > .01) for (let i = 0; i < 2; i++) {
    const lead = i ? .25 : -.1;                          // one leg a little ahead of the other
    s.hips[i].rotation.x = s.hips[i].rotation.x * (1 - bend) + (-.75 - lead) * bend;
    s.knees[i].rotation.x = s.knees[i].rotation.x * (1 - bend) + (1.15 + lead) * bend;
  }
  // body dips as the legs spread, and rolls a little into sideways steps
  s.body.position.y = (-Math.abs(Math.sin(s.walk)) * .05 * Math.min(1, g * 4) - g * .04) * (1 - s.air) - s.land * .1 - c * .31;
  s.body.rotation.z = across / SPRINT_SPEED * .12;
  // upper body: lean into the run, small sway with the steps, breathing, recoil
  s.upper.rotation.x = Math.max(-.1, ahead / SPRINT_SPEED * .22) + Math.sin(s.breath) * .012 * (1 - g) - s.kick * .12 + c * .12;
  s.upper.rotation.y = Math.sin(s.walk) * .07 * g;
  s.upper.position.z = -s.kick * .05;
}
const camRay = new THREE.Raycaster(), camHead = new THREE.Vector3(), camWant = new THREE.Vector3(), camLook = new THREE.Vector3();
function placeCamera(p) {
  const f = forward(p.yaw), r = rightOf(p.yaw);
  const floorY = (p.y ?? groundY(p.x, p.z)) - (p.jumpY || 0);
  const want = floorY + (p.jumpY || 0) * .15 - (p.crouchAmt || 0) * .55;   // follow the floor; barely rise with a jump; drop with a crouch
  p.camY = p.camY === undefined ? want : p.camY + (want - p.camY) * .15;
  camHead.set(p.x, p.camY + 1.6, p.z);
  camWant.set(p.x - f.x * 5.2 + r.x * 1.0, 3.0 + p.camY, p.z - f.z * 5.2 + r.z * 1.0);
  const gap = camWant.distanceTo(camHead);
  camRay.set(camHead, camWant.clone().sub(camHead).normalize()); camRay.far = gap;
  const hit = camRay.intersectObject(houseMesh)[0];   // a wall or the ceiling in the way: come in closer
  p.cam.position.copy(hit ? camHead.clone().addScaledVector(camRay.ray.direction, Math.max(.3, hit.distance - .3)) : camWant);
  p.camClose = p.cam.position.distanceTo(camHead) < 1.6;   // squeezed right up behind the soldier
  camLook.set(p.x + f.x * 10, 1.3 + p.camY, p.z + f.z * 10);
  // a nearby explosion shakes the view
  if (p.shake > .01) { p.cam.position.x += rand(-1, 1) * p.shake * .3; p.cam.position.y += rand(-1, 1) * p.shake * .3; p.shake *= .9; }
  p.cam.lookAt(camLook);
}
const menuCam = new THREE.PerspectiveCamera(55, 1, .1, 450);
let menuAngle = 0;

function render() {
  windTime.value = performance.now() / 1000;
  const w = stage.clientWidth, h = stage.clientHeight;
  for (const p of players) { poseSoldier(p, !p.alive); updateHealthBar(p); showItem(p); }
  for (const e of enemies) poseSoldier(e, false);
  for (const a of allies) { poseSoldier(a, false); updateHealthBar(a); }

  renderer.setScissorTest(true);
  if (state === "menu" || !players.length) {
    menuAngle += .0015;                               // slow fly-around behind the menu
    menuCam.position.set(Math.sin(menuAngle) * 80, 34, Math.cos(menuAngle) * 60);
    menuCam.lookAt(0, 0, 0);
    sky.position.copy(menuCam.position);
    menuCam.aspect = w / h; menuCam.updateProjectionMatrix();
    renderer.setViewport(0, 0, w, h); renderer.setScissor(0, 0, w, h);
    renderer.render(scene, menuCam);
    return;
  }
  const n = players.length;
  players.forEach((p, i) => {
    placeCamera(p);
    sky.position.copy(p.cam.position);
    const vw = w / n;
    p.cam.aspect = vw / h; p.cam.updateProjectionMatrix();
    renderer.setViewport(i * vw, 0, vw, h); renderer.setScissor(i * vw, 0, vw, h);
    p.group.visible = !p.camClose;                    // never look out from inside your own body
    renderer.render(scene, p.cam);
    p.group.visible = true;
  });
}

function updateHUD() {
  if (state === "menu") return;
  players.forEach(p => {
    document.getElementById("name" + p.num).textContent = `SOLDIER ${p.num}${!p.alive ? " · DOWN" : p.crouched ? " · CROUCHED" : ""}`;
    const bar = document.getElementById("hp" + p.num);
    bar.style.width = p.hp / MAX_HP * 100 + "%";
    bar.style.backgroundColor = hpColor(p.hp / MAX_HP);
    bar.parentElement.classList.toggle("healing", p.healing);   // the bar glows while health is coming back
    document.getElementById("hptext" + p.num).textContent = `${Math.ceil(p.hp)} / ${MAX_HP}`;
    updateHotbar(p);
    p.hurtFlash = (p.hurtFlash || 0) * .93;               // red flash when hit, and a faint glow while health is low
    const low = p.alive ? clamp01((.35 - p.hp / MAX_HP) / .35) * .45 : .6;
    document.getElementById("hurt" + p.num).style.opacity = Math.max(p.hurtFlash * .75, low);
    document.getElementById("ammo" + p.num).textContent = p.reload ? "RELOADING..." : "AMMO " + "▮".repeat(p.ammo) + "▯".repeat(MAG_SIZE - p.ammo);
  });
  document.getElementById("topline").textContent = `WAVE ${wave} · SCORE ${score} · ALLIES ${allies.length} · ENEMIES ${enemies.length + spawnQueue} · TANKS ${tanks.filter(t => !t.dead && t.side === "ally").length} v ${tanks.filter(t => !t.dead && t.side === "enemy").length}`;
  const banner = document.getElementById("banner");
  banner.textContent = paused ? "PAUSED" : "WAVE " + wave;
  banner.style.opacity = paused || waveTimer > 0 ? 1 : 0;
  document.getElementById("hint").hidden = !(state === "play" && !twoPlayer && document.pointerLockElement !== canvas);
}
function layoutPanes() {
  const p1 = document.getElementById("pane1"), p2 = document.getElementById("pane2");
  p1.style.left = "0"; p1.style.width = twoPlayer ? "50%" : "100%";
  p2.style.left = "50%"; p2.style.width = "50%";
}

function resize() { renderer.setSize(stage.clientWidth, stage.clientHeight, false); }
new ResizeObserver(resize).observe(stage);
resize();
layoutPanes();

// fixed-step loop: the game runs at the same speed on fast and slow screens
let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(.1, (now - last) / 1000); last = now;
  while (acc >= 1 / 60) { update(); acc -= 1 / 60; }
  render(); updateHUD();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- 7) CONTROLS ----------
const gameKeys = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Slash", "Quote"];
let wheelSteps = 0;                // mouse wheel turns since the last game step (changes soldier 1's item)
window.addEventListener("wheel", e => {
  if (state !== "play") return;
  e.preventDefault();
  wheelSteps += Math.sign(e.deltaY);
}, { passive: false });
window.addEventListener("keydown", e => {
  if (state === "play" && gameKeys.includes(e.code)) e.preventDefault();
  startSound();
  if (e.code === "KeyM") toggleMute();
  if (e.code === "KeyP" && state === "play") paused = !paused;
  keys[e.code] = true;
});
window.addEventListener("keyup", e => { keys[e.code] = false; });
window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; mouse.down = false; });

// Mouse aiming: clicking the battlefield "captures" the mouse so moving it turns you
stage.addEventListener("mousedown", e => {
  startSound();
  if (state !== "play" || twoPlayer) return;
  if (document.pointerLockElement !== canvas) {
    try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* arrows still work */ }
  } else mouse.down = true;
});
window.addEventListener("mouseup", () => { mouse.down = false; });
document.addEventListener("mousemove", e => {
  if (document.pointerLockElement === canvas && players[0] && !paused) players[0].yaw -= e.movementX * MOUSE_SENSITIVITY;
});

document.getElementById("btn1").onclick = () => { startSound(); startGame(1); };
document.getElementById("btn2").onclick = () => { startSound(); startGame(2); };
document.getElementById("btnAgain").onclick = () => { startSound(); startGame(twoPlayer ? 2 : 1); };
document.getElementById("btnMenu").onclick = () => {
  clearWorld(); state = "menu";
  document.getElementById("over").hidden = true;
  document.getElementById("menu").hidden = false;
  document.getElementById("pane1").hidden = true;
  document.getElementById("pane2").hidden = true;
  document.getElementById("topline").hidden = true;
  document.getElementById("banner").style.opacity = 0;
};
