// ============================================================
//  FRONTLINE 1944 (3D) — built with Three.js
//  The game logic happens on a flat map (x and z, like the 2D
//  version). Three.js then draws it in 3D with a camera behind
//  each soldier.
//  Sections: 1 settings · 2 map · 3 3D world · 4 soldiers
//            5 game rules · 6 drawing · 7 controls
// ============================================================

// ---------- 1) SETTINGS: change these to tweak the game ----------
const PLAYER_SPEED = 0.15;    // map units per frame (60 frames = 1 second)
const SPRINT_SPEED = 0.23;    // holding sprint while moving forward
const AGILITY = 0.28;         // how quickly soldiers speed up and stop (1 = instant)
const JUMP_POWER = 0.1;       // how fast you leave the ground (higher = jump higher)
const GRAVITY = 0.0085;       // how fast you come back down
const ENEMY_SPEED = 0.08;
const ENEMY_TURN = 0.12;      // how fast enemies swing round to face you
const BULLET_SPEED = 1.1;
const TURN_SPEED = 0.045;     // how fast the keys turn you
const MOUSE_SENSITIVITY = 0.0025;
const MAX_HP = 150;          // how much health a soldier has
const MAG_SIZE = 8;
const RELOAD_TIME = 70;
const MINX = -48, MAXX = 48, MINZ = -30, MAXZ = 30;   // edges of the battlefield

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
];

// ---------- helpers for the flat map ----------
const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function circleHitsRect(cx, cz, r, w) {
  const nx = Math.max(w.x, Math.min(cx, w.x + w.w));
  const nz = Math.max(w.z, Math.min(cz, w.z + w.d));
  return (cx - nx) ** 2 + (cz - nz) ** 2 < r * r;
}
const insideWall = (x, z) => walls.some(w => x > w.x && x < w.x + w.w && z > w.z && z < w.z + w.d);
function blocked(x, z, r) {
  if (x < MINX + r || x > MAXX - r || z < MINZ + r || z > MAXZ - r) return true;
  return walls.some(w => circleHitsRect(x, z, r, w));
}
function move(o, dx, dz) {           // slide along walls instead of sticking
  if (!blocked(o.x + dx, o.z, o.r)) o.x += dx; else o.vx = 0;
  if (!blocked(o.x, o.z + dz, o.r)) o.z += dz; else o.vz = 0;
}
function steer(o, tx, tz, agility) { // ease towards the wanted speed, so soldiers have a bit of weight
  o.vx += (tx - o.vx) * agility;
  o.vz += (tz - o.vz) * agility;
  move(o, o.vx, o.vz);
}
function clearShot(a, b) {           // can a bullet get from a to b?
  const steps = Math.ceil(dist(a, b) / 0.8);
  for (let i = 1; i < steps; i++) {
    if (insideWall(a.x + (b.x - a.x) * i / steps, a.z + (b.z - a.z) * i / steps)) return false;
  }
  return true;
}
// "yaw" is the direction a soldier faces. These turn it into arrows on the map.
const forward = yaw => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
const rightOf = yaw => ({ x: -Math.cos(yaw), z: Math.sin(yaw) });

// ---------- 3) THE 3D WORLD ----------
const canvas = document.getElementById("game");
const stage = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa7ab92);          // hazy overcast sky
scene.fog = new THREE.Fog(0xa7ab92, 35, 115);

scene.add(new THREE.HemisphereLight(0xe4e6d0, 0x4a4630, 0.8));
const sun = new THREE.DirectionalLight(0xfff0d0, 0.85);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 45, bottom: -45, near: 1, far: 140 });
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
function wallGap(x, z) {             // distance to the nearest sandbag or ruin wall
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
for (let tries = 0; craters.length < 24 && tries < 600; tries++) {
  const c = { x: rand(-64, 64), z: rand(-46, 46), r: rand(1.3, 3.6) };
  if (wallGap(c.x, c.z) < c.r + 1.5 || Math.hypot(Math.abs(c.x) - 10, c.z) < c.r + 2.5) continue;
  if (craters.some(o => Math.hypot(o.x - c.x, o.z - c.z) < o.r + c.r + .5)) continue;
  craters.push(c);
}
// how high the ground is at a spot: gentle rolls (flat by the walls) plus crater dips with raised rims
function groundY(x, z) {
  const edge = clamp01((100 - Math.abs(x)) / 12) * clamp01((75 - Math.abs(z)) / 12);
  let y = (fbm(x * .07, z * .07) - .5) * .55 * Math.min(1, wallGap(x, z) / 3) * edge;
  for (const c of craters) {
    const d = Math.hypot(x - c.x, z - c.z) / c.r;
    if (d < 1.7) y += c.r * .14 * (-Math.max(0, 1 - d * d) + .35 * Math.exp(-(((d - 1) * 3.5) ** 2)));
  }
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
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(60, 45);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const geo = new THREE.PlaneGeometry(200, 150, 250, 188); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, cols = [];
  const grass = new THREE.Color(0x667a38), dry = new THREE.Color(0x9a9152), dirt = new THREE.Color(0x7d6747);
  const mud = new THREE.Color(0x54432d), scorch = new THREE.Color(0x2f281d), col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, groundY(x, z));
    col.copy(grass).lerp(dry, dryness(x, z) * .85);
    const inField = Math.abs(x) < MAXX + 2 && Math.abs(z) < MAXZ + 2;
    let wear = Math.max(inField ? (1 - wallGap(x, z) / 2.8) * .85 : 0, Math.abs(x) < 90 ? track(x, z) * .9 : 0);
    wear += (noise2(x * .6, z * .6) - .5) * .45;      // ragged edges
    col.lerp(dirt, clamp01(wear));
    for (const cr of craters) {                       // churned mud with a scorched middle
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
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshLambertMaterial({ color: 0x5e6838 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.03;
  scene.add(outer);
})();

// Sandbag walls are stacks of little boxes; ruins are broken brick walls
const bagMat = new THREE.MeshLambertMaterial({ color: 0xb9a676 });
const bagMat2 = new THREE.MeshLambertMaterial({ color: 0xa8956a });
const brickMat = new THREE.MeshLambertMaterial({ color: 0x8c6a56 });
for (const w of walls) {
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
    for (let i = 0; i < p.length; i += 3) {
      pos.push(p[i], p[i + 1], p[i + 2]);
      nors.push(n[i], n[i + 1], n[i + 2]);
      fabs.push(pt.fabric || 0);
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
const outsideFence = (x, z, gap) => Math.abs(x) > MAXX + gap || Math.abs(z) > MAXZ + gap;

// Trees beyond the fence: leafy trees, pines, and trees shattered by shellfire
(function makeTrees() {
  const parts = [];
  const bark = [0x3d3226, 0x463a2b, 0x342c22], leaves = [0x3d5223, 0x4a5e29, 0x55672e, 0x3a4a22], deadBark = [0x4a4238, 0x3b352e];
  for (let i = 0; i < 120; i++) {
    let x, z;
    do { x = rand(-92, 92); z = rand(-68, 68); } while (!outsideFence(x, z, 4));
    const y = groundY(x, z) - .1, kind = Math.random(), lean = [rand(-.06, .06), 0, rand(-.06, .06)];
    if (kind < .45) {                                 // leafy tree: trunk, a few branches, lumpy crown
      const h = rand(3, 5.5), r = rand(.22, .34);
      parts.push({ geo: new THREE.CylinderGeometry(r * .6, r, h, 7), at: [x, y + h / 2, z], rot: lean, color: pick(bark) });
      for (let b = 0; b < 3; b++) {
        const a = rand(0, 6.3), len = rand(1, 1.8);
        parts.push({ geo: new THREE.CylinderGeometry(.05, r * .45, len, 5), at: [x + Math.cos(a) * len * .35, y + h * .8 + len * .3, z + Math.sin(a) * len * .35],
          rot: [Math.sin(a) * .9, 0, -Math.cos(a) * .9], color: pick(bark) });
      }
      const crown = rand(1.6, 2.6);
      for (let b = 0; b < 6; b++) {
        const s = crown * rand(.5, .8);
        parts.push({ geo: lumpy(new THREE.IcosahedronGeometry(1, 1), .35), at: [x + rand(-1, 1) * crown * .55, y + h + rand(-.2, 1.2) * crown * .6, z + rand(-1, 1) * crown * .55],
          scale: [s, s * rand(.75, .95), s], rot: [0, rand(0, 6), 0], color: pick(leaves) });
      }
    } else if (kind < .75) {                          // pine: thin trunk and stacked layers of needles
      const h = rand(5, 8.5);
      parts.push({ geo: new THREE.CylinderGeometry(.1, .24, h, 6), at: [x, y + h / 2, z], color: pick(bark) });
      for (let b = 0; b < 4; b++) {
        const w = (1 - b / 4.5) * rand(1.4, 1.9), ch = rand(1.6, 2.2);
        parts.push({ geo: lumpy(new THREE.ConeGeometry(w, ch, 8, 1), .15), at: [x, y + h * .3 + b * h * .19 + ch / 2, z],
          rot: [0, rand(0, 6), 0], color: b % 2 ? 0x34482a : 0x2f4226 });
      }
    } else {                                          // shattered tree: bare trunk with a splintered top
      const h = rand(2.5, 6), r = rand(.2, .32);
      parts.push({ geo: new THREE.CylinderGeometry(r * .7, r, h, 6), at: [x, y + h / 2, z], rot: lean, color: pick(deadBark) });
      parts.push({ geo: new THREE.ConeGeometry(r * .7, rand(.5, 1.1), 5), at: [x + rand(-.05, .05), y + h + .3, z], rot: [rand(-.3, .3), 0, rand(-.3, .3)], color: 0x6b5a45 });
      for (let b = 0; b < 2; b++) {
        const a = rand(0, 6.3), len = rand(.6, 1.3);
        parts.push({ geo: new THREE.CylinderGeometry(.03, .08, len, 4), at: [x + Math.cos(a) * len * .4, y + h * rand(.5, .85), z + Math.sin(a) * len * .4],
          rot: [Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1], color: pick(deadBark) });
      }
    }
  }
  mergedMesh(parts);
})();

// Bushes along the fence and out in the fields
(function makeBushes() {
  const parts = [], greens = [0x45582a, 0x50632e, 0x3b4c25, 0x5d6a34];
  for (let i = 0; i < 90; i++) {
    let x, z;
    do { x = rand(-95, 95); z = rand(-70, 70); } while (!outsideFence(x, z, 1.2));
    const y = groundY(x, z), size = rand(.5, 1.1), color = pick(greens);
    for (let b = 0; b < 3; b++) {
      const s = size * rand(.6, 1);
      parts.push({ geo: lumpy(new THREE.IcosahedronGeometry(1, 1), .4), at: [x + rand(-.6, .6) * size, y + s * .45, z + rand(-.6, .6) * size],
        scale: [s, s * .75, s], rot: [0, rand(0, 6), 0], color });
    }
  }
  mergedMesh(parts);
})();

// Rocks and rubble: around the ruins, on crater rims, and scattered about
(function makeRocks() {
  const parts = [], stone = [0x77705f, 0x6a6455, 0x837a68, 0x8c6a56];
  const spots = [];
  for (const w of walls) if (w.type === "ruin") for (let i = 0; i < 14; i++) spots.push([w.x + rand(-1, w.w + 1), w.z + rand(-1.5, w.d + 1.5), .14]);
  for (const c of craters) for (let i = 0; i < 5; i++) { const a = rand(0, 6.3), d = c.r * rand(.9, 1.3); spots.push([c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, .12]); }
  for (let i = 0; i < 60; i++) spots.push([rand(-90, 90), rand(-66, 66), .22]);
  for (const [x, z, s0] of spots) {
    if (insideWall(x, z)) continue;
    const s = s0 * rand(.6, 1.6);
    parts.push({ geo: lumpy(new THREE.DodecahedronGeometry(1, 0), .5), at: [x, groundY(x, z) + s * .25, z],
      scale: [s * rand(1, 1.6), s * rand(.6, 1), s * rand(1, 1.4)], rot: [rand(0, 3), rand(0, 6), rand(0, 3)], color: pick(stone) });
  }
  mergedMesh(parts);
})();

// Grass: thousands of little tufts drawn in one go, swaying gently in the wind
const windTime = { value: 0 };
(function makeGrass() {
  const verts = [], shade = [];
  for (let i = 0; i < 6; i++) {                       // one tuft = 6 thin blades fanning out
    const a = i / 6 * Math.PI * 2 + rand(-.3, .3), lean = rand(.08, .25), h = rand(.25, .5), w = .022;
    const ox = Math.cos(a) * .04, oz = Math.sin(a) * .04, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    const tx = ox + Math.cos(a) * lean, tz = oz + Math.sin(a) * lean;
    verts.push(ox - px, 0, oz - pz, ox + px, 0, oz + pz, tx, h, tz);    // front of the blade
    verts.push(ox + px, 0, oz + pz, ox - px, 0, oz - pz, tx, h, tz);    // and its back
    for (let s = 0; s < 2; s++) shade.push(.55, .6, .45, .55, .6, .45, 1.1, 1.1, .92);   // darker root, lighter tip
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(shade, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(verts.map((_, i) => i % 3 === 1 ? 1 : 0), 3));   // lit like the ground
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = shader => {                   // bend the blade tips with the wind
    shader.uniforms.windTime = windTime;
    shader.vertexShader = "uniform float windTime;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      vec4 root = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float bend = position.y * position.y;
      transformed.x += sin(windTime * 1.6 + root.x * .3 + root.z * .2) * .35 * bend;
      transformed.z += cos(windTime * 1.2 + root.z * .25) * .2 * bend;`);
  };
  const COUNT = 26000;
  const grass = new THREE.InstancedMesh(geo, mat, COUNT);
  const green = new THREE.Color(0x5e7a32), yellow = new THREE.Color(0x9a8f52), col = new THREE.Color();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  let n = 0;
  for (let tries = 0; n < COUNT && tries < COUNT * 6; tries++) {
    const x = rand(-98, 98), z = rand(-73, 73);
    if (fbm(x * .09, z * .09) < rand(.25, .7)) continue;        // grows in patches
    if (wallGap(x, z) < .5 || track(x, z) > rand(.3, 1)) continue;
    if (craters.some(c => Math.hypot(x - c.x, z - c.z) < c.r * .8)) continue;
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

  // wildflowers: mostly red poppies, some yellow and white
  const FLOWERS = 900;
  const flowers = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.055, 0), new THREE.MeshLambertMaterial(), FLOWERS);
  const petals = [0xb3261e, 0xb3261e, 0xc23a22, 0xd9c043, 0xe8e4d8];
  let f = 0;
  for (let tries = 0; f < FLOWERS && tries < FLOWERS * 10; tries++) {
    const x = rand(-98, 98), z = rand(-73, 73);
    if (fbm(x * .09, z * .09) < .5 || wallGap(x, z) < 1 || track(x, z) > .2) continue;
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
      m.position.y = floor; c.vy = -c.vy * .35; c.vx *= .5; c.vz *= .5; c.spin *= .5;
      if (Math.abs(c.vy) < .01) { c.vy = 0; c.spin = 0; m.rotation.x = Math.PI / 2; }
    }
    if (--c.life <= 0) scene.remove(m);
  }
  casings = casings.filter(c => c.life > 0);
}

// ---------- 4) THE SOLDIERS ----------
// Three armies of 1944, each with its own uniform, helmet, kit and rifle.
const KITS = {
  british:  { tunic: 0x7b6b46, trousers: 0x726447, web: 0x8d8a5f, helmet: 0x59563a, boots: 0x1e1a16 },
  american: { tunic: 0x857b59, trousers: 0x5f5a44, web: 0x8b7e57, helmet: 0x4b4f35, boots: 0x3d2c1d },
  german:   { tunic: 0x5c5f4e, trousers: 0x55584a, web: 0x1f1c19, helmet: 0x4d5048, boots: 0x161412 },
};
const SKIN = 0xd6a986;

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
  const T = [], add = (geo, color, at = [0, 0, 0], rot, scale, fabric = 0) => T.push({ geo, color, at, rot, scale, fabric });
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

  // head: neck, the sculpted face, eyes with lids, ears
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
  mesh(rifleGeos[kind], torso, rifleMat).position.set(.1, 1.37, .02);                  // rifle, butt in the shoulder
  const muzzle = new THREE.Object3D(); muzzle.position.set(.1, 1.376, 1.24); torso.add(muzzle);  // end of the barrel
  const ejectPort = new THREE.Object3D(); ejectPort.position.set(.13, 1.4, .47); torso.add(ejectPort);   // where empty cases fly out
  g.scale.setScalar(1.1);                                                // a bit bigger than standard
  scene.add(g);
  return { group: g, body, upper, hips, knees, muzzle, ejectPort, uni: mat };
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
  const f = Math.max(.001, p.hp / MAX_HP), { back, fill } = p.bar;
  back.visible = fill.visible = p.alive;
  fill.scale.x = .84 * f;
  fill.center.x = .5 / f;                             // keeps the bar's left end fixed as it shrinks
  fill.material.color.set(hpColor(f));
}

function makePlayer(num) {
  const s = buildSoldier(num === 1 ? "british" : "american");
  return {
    num, x: num === 1 ? -10 : 10, z: 0, yaw: 0, r: .5, hp: MAX_HP, ammo: MAG_SIZE, reload: 0, cool: 0,
    alive: true, vx: 0, vz: 0, jumpY: 0, vy: 0, land: 0, walk: 0, gait: 0, kick: 0, ...s, bar: makeHealthBar(s.group),
    cam: new THREE.PerspectiveCamera(65, 1, .1, 200),
  };
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
  return { x, z, yaw: 0, r: .5, hp: maxHp, cool: rand(60, 140), strafe: Math.random() < .5 ? 1 : -1,
    vx: 0, vz: 0, pause: 0, walk: rand(0, 6), gait: 0, kick: 0, flash: 0, ...s };
}

// ---------- 5) GAME RULES ----------
let players = [], enemies = [], fallen = [], bullets = [], puffs = [];
let wave = 0, score = 0, spawnQueue = 0, spawnTimer = 0, waveTimer = 0;
let state = "menu", paused = false, twoPlayer = false;
const keys = {};
const mouse = { down: false };

const bulletGeo = new THREE.BoxGeometry(.07, .07, .8);
const allyTracer = new THREE.MeshBasicMaterial({ color: 0xfff6d0 });
const enemyTracer = new THREE.MeshBasicMaterial({ color: 0xff9a3c });
const puffGeo = new THREE.SphereGeometry(.3, 8, 6);

function clearWorld() {
  for (const o of [...players, ...enemies, ...fallen]) scene.remove(o.group);
  for (const b of bullets) scene.remove(b.mesh);
  for (const p of puffs) scene.remove(p.mesh);
  for (const c of casings) scene.remove(c.mesh);
  casings = [];
  players = []; enemies = []; fallen = []; bullets = []; puffs = [];
}
function startGame(n) {
  clearWorld();
  twoPlayer = n === 2;
  players = [makePlayer(1)];
  if (twoPlayer) players.push(makePlayer(2));
  wave = 0; score = 0; paused = false;
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
}
function nextWave() {
  wave++;
  spawnQueue = 3 + wave * 2;
  spawnTimer = 0;
  waveTimer = 120;
  for (const p of players) {            // fallen soldiers come back, everyone patches up
    if (!p.alive) { p.alive = true; p.hp = MAX_HP / 2; p.group.rotation.x = 0; p.group.position.y = 0; p.vx = p.vz = 0; p.jumpY = p.vy = 0; }
    else p.hp = Math.min(MAX_HP, p.hp + MAX_HP / 4);
  }
}
// puffs: smoke, dust and sparks. Optional extras: drift speed (vx, vy, vz), starting see-through-ness (alpha), glow
function addPuff(x, y, z, color, life, grow, { vx = 0, vy = 0, vz = 0, alpha = .8, size = 1, glow = false } = {}) {
  const mesh = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: alpha, depthWrite: false,
    blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));
  mesh.position.set(x, y, z); mesh.scale.setScalar(size); scene.add(mesh);
  puffs.push({ mesh, life, max: life, grow, vx, vy, vz, alpha });
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
  light.position.set(pos.x + f.x * .6, pos.y, pos.z + f.z * .6); light.intensity = 2.2;   // just ahead, so it lights the ground more than the shooter

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

function shoot(from, yaw, team, spread) {
  const a = yaw + rand(-spread, spread), f = forward(a);
  from.kick = 1;                                         // rifle recoil, shown in poseSoldier
  from.eject = 16;                                       // the empty case flies out as the bolt is worked
  const mesh = new THREE.Mesh(bulletGeo, team === "ally" ? allyTracer : enemyTracer);
  mesh.rotation.y = a; scene.add(mesh);
  bullets.push({ x: from.x + f.x * 1.2, z: from.z + f.z * 1.2, vx: f.x * BULLET_SPEED, vz: f.z * BULLET_SPEED, team, life: 60, mesh });
  from.group.position.x = from.x; from.group.position.z = from.z; from.group.rotation.y = from.yaw;   // bring the model up to date
  muzzleFlash(from.muzzle.getWorldPosition(muzzlePos), a);
}

function updatePlayer(p) {
  if (!p.alive) return;
  let fwd = 0, side = 0, turn = 0;
  const sprint = p.num === 1 ? keys.ShiftLeft : keys.ControlRight;
  const jumpKey = p.num === 1 ? keys.KeyJ : keys.Slash;
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
    const speed = sprint && fwd > 0 ? SPRINT_SPEED : fwd < 0 ? PLAYER_SPEED * .7 : PLAYER_SPEED;
    tx = (f.x * fwd + r.x * side) / len * speed;
    tz = (f.z * fwd + r.z * side) / len * speed;
  }
  const inAir = p.jumpY > 0 || p.vy > 0;
  steer(p, tx, tz, inAir ? AGILITY * .12 : AGILITY);   // in the air you mostly keep the speed you jumped with

  // jumping: press the key while standing on the ground (let go and press again for the next jump)
  if (jumpKey && !p.jumpHeld && !inAir) { p.vy = JUMP_POWER; p.land = 0; }
  p.jumpHeld = jumpKey;
  if (p.vy !== 0 || p.jumpY > 0) {
    p.jumpY += p.vy; p.vy -= GRAVITY;
    if (p.jumpY <= 0) { p.land = Math.min(1, -p.vy / JUMP_POWER); p.jumpY = 0; p.vy = 0; }   // touch down: bend the knees
  }

  if (p.cool > 0) p.cool--;
  if (p.reload > 0) { if (--p.reload === 0) p.ammo = MAG_SIZE; return; }
  const reloadKey = p.num === 1 ? keys.KeyR : keys.ShiftRight;
  if (reloadKey && p.ammo < MAG_SIZE) { p.reload = RELOAD_TIME; return; }
  const firing = p.num === 1 ? (keys.Space || (!twoPlayer && mouse.down)) : keys.Enter;
  if (firing && p.cool === 0) {
    if (p.ammo > 0) { shoot(p, p.yaw, "ally", .02); p.ammo--; p.cool = 12; }
    else p.reload = RELOAD_TIME;
  }
}

function updateEnemy(e) {
  if (e.flash > 0 && --e.flash === 0) e.uni.emissive.setHex(0);
  const targets = players.filter(p => p.alive);
  if (!targets.length) return;
  const t = targets.reduce((a, b) => dist(e, a) < dist(e, b) ? a : b);
  const d = dist(e, t);
  const want = Math.atan2(t.x - e.x, t.z - e.z);
  const diff = Math.atan2(Math.sin(want - e.yaw), Math.cos(want - e.yaw));   // shortest way round
  e.yaw += Math.max(-ENEMY_TURN, Math.min(ENEMY_TURN, diff));
  const sees = clearShot(e, t);
  if (e.pause > 0) { e.pause--; steer(e, 0, 0, AGILITY * .6); }            // brief stop to take aim
  else if (d > 15 || !sees) {
    const f = forward(e.yaw); steer(e, f.x * ENEMY_SPEED, f.z * ENEMY_SPEED, AGILITY * .6);
  } else {
    const r = rightOf(e.yaw); steer(e, r.x * e.strafe * .06, r.z * e.strafe * .06, AGILITY * .6);
    if (Math.random() < .012) e.strafe *= -1;
    if (Math.random() < .006) e.pause = rand(20, 50);
  }
  if (--e.cool <= 0 && d < 36 && sees && Math.abs(diff) < .3) {
    shoot(e, e.yaw, "enemy", .07);
    e.cool = rand(70, 130) - Math.min(wave * 4, 40);
  }
}

function update() {
  if (state !== "play" || paused) return;
  players.forEach(updatePlayer);
  enemies.forEach(updateEnemy);
  for (const p of players) animateSoldier(p, !p.alive);
  for (const e of enemies) animateSoldier(e, false);

  if (waveTimer > 0) waveTimer--;
  if (spawnQueue > 0 && --spawnTimer <= 0) { enemies.push(makeEnemy()); spawnQueue--; spawnTimer = 50; }

  for (const b of bullets) {
    b.x += b.vx; b.z += b.vz; b.life--;
    if (b.x < MINX || b.x > MAXX || b.z < MINZ || b.z > MAXZ) b.life = 0;
    if (insideWall(b.x, b.z)) { b.life = 0; addPuff(b.x, 1, b.z, 0xd6c9a0, 18, .06); }   // dust off the sandbags
    const victims = b.team === "ally" ? enemies : players.filter(p => p.alive);
    for (const v of victims) {
      if (b.life > 0 && dist(b, v) < .6) {
        b.life = 0;
        v.hp -= b.team === "ally" ? 20 : 12;
        if (v.uni && b.team === "ally") { v.uni.emissive.setHex(0x777777); v.flash = 6; }
        addPuff(b.x, 1.2, b.z, 0xd0c4a4, 10, .04);
      }
    }
  }
  for (const b of bullets) if (b.life <= 0) scene.remove(b.mesh);
  bullets = bullets.filter(b => b.life > 0);

  for (const e of enemies) if (e.hp <= 0) { score += 100; e.fall = 0; fallen.push(e); }
  enemies = enemies.filter(e => e.hp > 0);
  for (const f of fallen) {                 // knocked-out enemies topple, then fade away
    f.fall++;
    f.group.rotation.x = -Math.min(1, f.fall / 20) * Math.PI / 2;
    if (f.fall > 150) f.group.position.y -= .02;
    if (f.fall > 220) scene.remove(f.group);
  }
  fallen = fallen.filter(f => f.fall <= 220);

  for (const p of players) if (p.alive && p.hp <= 0) { p.alive = false; p.hp = 0; }

  for (const p of puffs) {
    p.life--;
    if (p.flash) p.mesh.scale.multiplyScalar(p.life > 3 ? 1.12 : .62);   // fireball swells for a moment, then shrinks away
    else {
      p.mesh.position.x += p.vx; p.mesh.position.y += p.vy; p.mesh.position.z += p.vz;
      p.vx *= .94; p.vz *= .94;                          // smoke slows down in the air
      p.mesh.scale.multiplyScalar(1 + p.grow); p.mesh.material.opacity = p.alpha * p.life / p.max;
    }
    if (p.life <= 0) scene.remove(p.mesh);
  }
  puffs = puffs.filter(p => p.life > 0);
  updateCasings();
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
function poseSoldier(s, down) {
  s.group.position.set(s.x, groundY(s.x, s.z) + (s.jumpY || 0), s.z);  // stand on the bumpy ground (or jump off it)
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
  s.walk += speed * 1.9;                                 // steps follow distance, so feet don't slide
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
  const bend = Math.max(s.air, s.land * .8);
  if (bend > .01) for (let i = 0; i < 2; i++) {
    const lead = i ? .25 : -.1;                          // one leg a little ahead of the other
    s.hips[i].rotation.x = s.hips[i].rotation.x * (1 - bend) + (-.75 - lead) * bend;
    s.knees[i].rotation.x = s.knees[i].rotation.x * (1 - bend) + (1.15 + lead) * bend;
  }
  // body dips as the legs spread, and rolls a little into sideways steps
  s.body.position.y = (-Math.abs(Math.sin(s.walk)) * .05 * Math.min(1, g * 4) - g * .04) * (1 - s.air) - s.land * .1;
  s.body.rotation.z = across / SPRINT_SPEED * .12;
  // upper body: lean into the run, small sway with the steps, breathing, recoil
  s.upper.rotation.x = Math.max(-.1, ahead / SPRINT_SPEED * .22) + Math.sin(s.breath) * .012 * (1 - g) - s.kick * .12;
  s.upper.rotation.y = Math.sin(s.walk) * .07 * g;
  s.upper.position.z = -s.kick * .05;
}
function placeCamera(p) {
  const f = forward(p.yaw), r = rightOf(p.yaw);
  const gy = groundY(p.x, p.z);
  const want = gy + (p.jumpY || 0) * .15;             // follow the ground smoothly; barely rise with a jump, so you see it
  p.camY = p.camY === undefined ? want : p.camY + (want - p.camY) * .15;
  p.cam.position.set(p.x - f.x * 5.2 + r.x * 1.0, 3.0 + p.camY, p.z - f.z * 5.2 + r.z * 1.0);
  p.cam.lookAt(p.x + f.x * 10, 1.3 + p.camY, p.z + f.z * 10);
}
const menuCam = new THREE.PerspectiveCamera(55, 1, .1, 300);
let menuAngle = 0;

function render() {
  windTime.value = performance.now() / 1000;
  const w = stage.clientWidth, h = stage.clientHeight;
  for (const p of players) { poseSoldier(p, !p.alive); updateHealthBar(p); }
  for (const e of enemies) poseSoldier(e, false);

  renderer.setScissorTest(true);
  if (state === "menu" || !players.length) {
    menuAngle += .0015;                               // slow fly-around behind the menu
    menuCam.position.set(Math.sin(menuAngle) * 45, 22, Math.cos(menuAngle) * 35);
    menuCam.lookAt(0, 0, 0);
    menuCam.aspect = w / h; menuCam.updateProjectionMatrix();
    renderer.setViewport(0, 0, w, h); renderer.setScissor(0, 0, w, h);
    renderer.render(scene, menuCam);
    return;
  }
  const n = players.length;
  players.forEach((p, i) => {
    placeCamera(p);
    const vw = w / n;
    p.cam.aspect = vw / h; p.cam.updateProjectionMatrix();
    renderer.setViewport(i * vw, 0, vw, h); renderer.setScissor(i * vw, 0, vw, h);
    renderer.render(scene, p.cam);
  });
}

function updateHUD() {
  if (state === "menu") return;
  players.forEach(p => {
    document.getElementById("name" + p.num).textContent = `SOLDIER ${p.num}${p.alive ? "" : " · DOWN"}`;
    const bar = document.getElementById("hp" + p.num);
    bar.style.width = p.hp / MAX_HP * 100 + "%";
    bar.style.backgroundColor = hpColor(p.hp / MAX_HP);
    document.getElementById("hptext" + p.num).textContent = `${Math.ceil(p.hp)} / ${MAX_HP}`;
    document.getElementById("ammo" + p.num).textContent = p.reload ? "RELOADING..." : "AMMO " + "▮".repeat(p.ammo) + "▯".repeat(MAG_SIZE - p.ammo);
  });
  document.getElementById("topline").textContent = `WAVE ${wave} · SCORE ${score} · ENEMIES ${enemies.length + spawnQueue}`;
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
const gameKeys = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Slash"];
window.addEventListener("keydown", e => {
  if (state === "play" && gameKeys.includes(e.code)) e.preventDefault();
  if (e.code === "KeyP" && state === "play") paused = !paused;
  keys[e.code] = true;
});
window.addEventListener("keyup", e => { keys[e.code] = false; });
window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; mouse.down = false; });

// Mouse aiming: clicking the battlefield "captures" the mouse so moving it turns you
stage.addEventListener("mousedown", e => {
  if (state !== "play" || twoPlayer) return;
  if (document.pointerLockElement !== canvas) {
    try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* arrows still work */ }
  } else mouse.down = true;
});
window.addEventListener("mouseup", () => { mouse.down = false; });
document.addEventListener("mousemove", e => {
  if (document.pointerLockElement === canvas && players[0] && !paused) players[0].yaw -= e.movementX * MOUSE_SENSITIVITY;
});

document.getElementById("btn1").onclick = () => startGame(1);
document.getElementById("btn2").onclick = () => startGame(2);
document.getElementById("btnAgain").onclick = () => startGame(twoPlayer ? 2 : 1);
document.getElementById("btnMenu").onclick = () => {
  clearWorld(); state = "menu";
  document.getElementById("over").hidden = true;
  document.getElementById("menu").hidden = false;
  document.getElementById("pane1").hidden = true;
  document.getElementById("pane2").hidden = true;
  document.getElementById("topline").hidden = true;
  document.getElementById("banner").style.opacity = 0;
};
