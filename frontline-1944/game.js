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
function mergedMesh(parts) {         // parts: { geo, at: [x,y,z], rot: [x,y,z], scale: [x,y,z], color }
  const pos = [], cols = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  for (const pt of parts) {
    const g = pt.geo.index ? pt.geo.toNonIndexed() : pt.geo.clone();
    q.setFromEuler(new THREE.Euler(...(pt.rot || [0, 0, 0])));
    g.applyMatrix4(m.compose(new THREE.Vector3(...pt.at), q, new THREE.Vector3(...(pt.scale || [1, 1, 1]))));
    const p = g.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      pos.push(p[i], p[i + 1], p[i + 2]);
      c.set(pt.color).multiplyScalar(.88 + hash2(p[i] * 3.1, p[i + 2] * 2.7 + p[i + 1]) * .24);   // dappled colour
      cols.push(c.r, c.g, c.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 0, specular: 0 }));
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
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

// ---------- 4) THE SOLDIERS (built from simple boxes and spheres) ----------
function buildSoldier(uniformColor, helmetColor, enemy) {
  const g = new THREE.Group();
  g.rotation.order = "YXZ";
  // smooth per-pixel lighting so rounded parts don't show jagged patches
  const mat = color => new THREE.MeshPhongMaterial({ color, shininess: 6, specular: 0x151515 });
  const uni = mat(uniformColor);
  const dark = mat(0x24241e);
  const skin = mat(0xd8b08c);
  const helm = mat(helmetColor);
  const wood = mat(0x5a3d22);
  // skeleton: body (bobs and rolls) holds the legs and the upper body,
  // which pivots at the hips so it can lean, twist and take recoil
  const body = new THREE.Group(); g.add(body);
  const upper = new THREE.Group(); upper.position.y = .95; body.add(upper);
  const torso = new THREE.Group(); torso.position.y = -.95; upper.add(torso);   // lets parts below use plain heights
  const part = (geo, mat, x, y, z, parent = torso) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
  };
  const webbing = mat(enemy ? 0x2b2b26 : 0x8a7f55);
  // a rounded limb running from point a to point b
  const limb = (a, b, r1, r2, mat) => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const len = from.distanceTo(to);
    const m = part(new THREE.CylinderGeometry(r2, r1, len, 16), mat, 0, 0, 0);
    m.position.copy(from).add(to).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    part(new THREE.SphereGeometry(r2 * 1.12, 16, 12), mat, ...b);       // rounded joint (a bit wider so it doesn't flicker)
    return m;
  };

  // legs: the thigh swings from the hip, the shin and boot bend at the knee
  const hips = [], knees = [];
  [-.13, .13].forEach(side => {
    const hip = new THREE.Group(); hip.position.set(side, .9, 0); body.add(hip);
    part(new THREE.CylinderGeometry(.13, .11, .44, 16), uni, 0, -.2, 0, hip);    // thigh
    const knee = new THREE.Group(); knee.position.set(0, -.43, .01); hip.add(knee);
    part(new THREE.SphereGeometry(.122, 16, 12), uni, 0, 0, 0, knee);            // knee
    part(new THREE.CylinderGeometry(.1, .085, .36, 16), uni, 0, -.17, -.01, knee);   // shin
    part(new THREE.CylinderGeometry(.095, .1, .14, 24), dark, 0, -.33, -.01, knee);  // boot top
    part(new THREE.BoxGeometry(.18, .1, .32), dark, 0, -.42, .04, knee);             // boot
    hips.push(hip); knees.push(knee);
  });

  // torso: hips, waist, then a broader chest and shoulders (a fit, normal soldier build)
  part(new THREE.BoxGeometry(.42, .2, .27), uni, 0, .95, 0);             // hips
  part(new THREE.CylinderGeometry(.24, .21, .3, 12), uni, 0, 1.15, 0).scale.set(1, 1, .68);   // waist
  part(new THREE.CylinderGeometry(.29, .25, .32, 12), uni, 0, 1.42, 0).scale.set(1, 1, .62);  // chest
  part(new THREE.BoxGeometry(.6, .1, .26), uni, 0, 1.56, -.01);          // shoulder line
  [-.29, .29].forEach(x => part(new THREE.SphereGeometry(.11, 16, 12), uni, x, 1.53, 0));      // shoulders
  part(new THREE.BoxGeometry(.5, .07, .32), dark, 0, 1.02, 0);           // belt
  part(new THREE.BoxGeometry(.07, .06, .02), helm, 0, 1.02, .165);       // buckle
  [-.16, .16].forEach(x => part(new THREE.BoxGeometry(.11, .1, .07), webbing, x, 1.04, .17));  // ammo pouches
  [-.13, .13].forEach(x => part(new THREE.BoxGeometry(.05, .5, .03), webbing, x, 1.3, .2));    // chest straps
  [-.13, .13].forEach(x => part(new THREE.BoxGeometry(.05, .5, .03), webbing, x, 1.3, -.2));   // back straps
  part(new THREE.BoxGeometry(.36, .36, .14), webbing, 0, 1.3, -.24);     // backpack
  part(new THREE.BoxGeometry(.34, .06, .1), webbing, 0, 1.5, -.22);      // bedroll on top

  // neck and head
  part(new THREE.CylinderGeometry(.075, .085, .14, 24), skin, 0, 1.64, 0);
  part(new THREE.SphereGeometry(.13, 20, 16), skin, 0, 1.77, .01).scale.set(.95, 1.1, 1);
  part(new THREE.BoxGeometry(.17, .08, .14), skin, 0, 1.68, .05);        // jaw
  part(new THREE.BoxGeometry(.035, .06, .05), skin, 0, 1.75, .14);       // nose
  [-.125, .125].forEach(x => part(new THREE.SphereGeometry(.03, 6, 6), skin, x, 1.76, 0));     // ears
  part(new THREE.SphereGeometry(.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), helm, 0, 1.82, 0);
  if (enemy) part(new THREE.CylinderGeometry(.21, .25, .14, 24), helm, 0, 1.77, -.02);   // flared helmet
  else part(new THREE.CylinderGeometry(.3, .3, .03, 24), helm, 0, 1.82, 0);               // wide-brim helmet

  // arms holding the rifle: upper arm, elbow, forearm, hand
  limb([.3, 1.52, 0], [.33, 1.24, .1], .085, .075, uni);                 // right arm
  limb([.33, 1.24, .1], [.14, 1.33, .3], .072, .062, uni);
  part(new THREE.SphereGeometry(.055, 12, 10), skin, .13, 1.33, .32);    // right hand
  limb([-.3, 1.52, 0], [-.25, 1.22, .38], .085, .075, uni);              // left arm
  limb([-.25, 1.22, .38], [.06, 1.32, .72], .072, .062, uni);
  part(new THREE.SphereGeometry(.055, 12, 10), skin, .08, 1.32, .75);    // left hand

  part(new THREE.BoxGeometry(.07, .1, 1.0), wood, .1, 1.36, .55);        // rifle
  part(new THREE.BoxGeometry(.04, .04, .45), dark, .1, 1.39, 1.25);
  const muzzle = new THREE.Object3D(); muzzle.position.set(.1, 1.39, 1.5); torso.add(muzzle);   // end of the barrel
  g.scale.setScalar(1.1);                                                // a bit bigger than standard
  scene.add(g);
  return { group: g, body, upper, hips, knees, muzzle, uni };
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
  const s = buildSoldier(num === 1 ? 0xc9b77a : 0x8fb4d8, num === 1 ? 0x6f6438 : 0x4f7398, false);
  return {
    num, x: num === 1 ? -10 : 10, z: 0, yaw: 0, r: .5, hp: MAX_HP, ammo: MAG_SIZE, reload: 0, cool: 0,
    alive: true, vx: 0, vz: 0, walk: 0, gait: 0, kick: 0, ...s, bar: makeHealthBar(s.group),
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
  const s = buildSoldier(0x3d4044, 0x55595e, true);
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
    if (!p.alive) { p.alive = true; p.hp = MAX_HP / 2; p.group.rotation.x = 0; p.group.position.y = 0; p.vx = p.vz = 0; }
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
  steer(p, tx, tz, AGILITY);

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
  s.group.position.set(s.x, groundY(s.x, s.z), s.z);                  // stand on the bumpy ground
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
  // body dips as the legs spread, and rolls a little into sideways steps
  s.body.position.y = -Math.abs(Math.sin(s.walk)) * .05 * Math.min(1, g * 4) - g * .04;
  s.body.rotation.z = across / SPRINT_SPEED * .12;
  // upper body: lean into the run, small sway with the steps, breathing, recoil
  s.upper.rotation.x = Math.max(-.1, ahead / SPRINT_SPEED * .22) + Math.sin(s.breath) * .012 * (1 - g) - s.kick * .12;
  s.upper.rotation.y = Math.sin(s.walk) * .07 * g;
  s.upper.position.z = -s.kick * .05;
}
function placeCamera(p) {
  const f = forward(p.yaw), r = rightOf(p.yaw);
  const gy = groundY(p.x, p.z);
  p.camY = p.camY === undefined ? gy : p.camY + (gy - p.camY) * .08;   // follow the ground smoothly
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
const gameKeys = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"];
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
