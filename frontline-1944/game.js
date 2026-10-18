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
const ENEMY_SPEED = 0.075;
const BULLET_SPEED = 1.1;
const TURN_SPEED = 0.045;     // how fast the keys turn you
const MOUSE_SENSITIVITY = 0.0025;
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
  if (!blocked(o.x + dx, o.z, o.r)) o.x += dx;
  if (!blocked(o.x, o.z + dz, o.r)) o.z += dz;
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

// Ground: we paint a muddy field onto a hidden canvas and use it as a texture
(function makeGround() {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 730;
  const g = c.getContext("2d");
  g.fillStyle = "#6d6f45"; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 9000; i++) {
    const shade = ["#64663e", "#77784c", "#5d5a3a", "#7d7350"][i % 4];
    g.fillStyle = shade; g.fillRect(Math.random() * c.width, Math.random() * c.height, 3, 3);
  }
  for (let i = 0; i < 26; i++) {                      // shell craters
    const x = Math.random() * c.width, y = Math.random() * c.height, r = 10 + Math.random() * 34;
    g.fillStyle = "rgba(60,46,28,.55)"; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = "rgba(38,30,18,.45)"; g.beginPath(); g.arc(x, y, r * .5, 0, 7); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 100), new THREE.MeshLambertMaterial({ map: tex }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x5f6340 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02;
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
  p.position.set(x, .65, z); scene.add(p);
  wirePts[0].push(new THREE.Vector3(x, .45, z)); wirePts[1].push(new THREE.Vector3(x, 1.05, z));
}
for (const pts of wirePts) scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x2f2f2a })));

// Shattered trees beyond the fence
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x3e3326 });
const leafMat = new THREE.MeshLambertMaterial({ color: 0x4d5a33 });
for (let i = 0; i < 60; i++) {
  let x, z;
  do { x = rand(-75, 75); z = rand(-50, 50); } while (Math.abs(x) < 52 && Math.abs(z) < 34);
  const h = rand(3, 7);
  const t = new THREE.Mesh(new THREE.CylinderGeometry(.18, .3, h, 6), trunkMat);
  t.position.set(x, h / 2, z); t.castShadow = true; scene.add(t);
  if (Math.random() < .6) {
    const top = new THREE.Mesh(new THREE.ConeGeometry(rand(1.4, 2.4), rand(3, 5), 7), leafMat);
    top.position.set(x, h + 1.2, z); top.castShadow = true; scene.add(top);
  }
}

// ---------- 4) THE SOLDIERS (built from simple boxes and spheres) ----------
function buildSoldier(uniformColor, helmetColor, enemy) {
  const g = new THREE.Group();
  g.rotation.order = "YXZ";
  const uni = new THREE.MeshLambertMaterial({ color: uniformColor });
  const dark = new THREE.MeshLambertMaterial({ color: 0x24241e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8b08c });
  const helm = new THREE.MeshLambertMaterial({ color: helmetColor });
  const wood = new THREE.MeshLambertMaterial({ color: 0x5a3d22 });
  const part = (geo, mat, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
  };
  const legs = [-.15, .15].map(side => {
    const hip = new THREE.Group(); hip.position.set(side, .85, 0); g.add(hip);
    part(new THREE.BoxGeometry(.22, .78, .24), uni, 0, -.39, 0, hip);
    part(new THREE.BoxGeometry(.24, .14, .34), dark, 0, -.8, .04, hip);
    return hip;
  });
  part(new THREE.BoxGeometry(.6, .72, .34), uni, 0, 1.22, 0);           // body
  part(new THREE.BoxGeometry(.62, .08, .36), dark, 0, .9, 0);           // belt
  part(new THREE.BoxGeometry(.4, .4, .16), uni, 0, 1.25, -.24);         // backpack
  part(new THREE.SphereGeometry(.17, 12, 10), skin, 0, 1.76, 0);        // head
  part(new THREE.SphereGeometry(.23, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), helm, 0, 1.8, 0);
  if (enemy) part(new THREE.CylinderGeometry(.24, .28, .14, 16), helm, 0, 1.75, -.02);   // flared helmet
  else part(new THREE.CylinderGeometry(.33, .33, .03, 16), helm, 0, 1.8, 0);              // wide-brim helmet
  part(new THREE.BoxGeometry(.15, .15, .55), uni, .3, 1.32, .22);       // arms
  part(new THREE.BoxGeometry(.15, .15, .6), uni, -.18, 1.32, .34);
  part(new THREE.BoxGeometry(.07, .1, 1.0), wood, .1, 1.36, .55);       // rifle
  part(new THREE.BoxGeometry(.04, .04, .45), dark, .1, 1.39, 1.25);
  scene.add(g);
  return { group: g, legs, uni };
}

function makePlayer(num) {
  const s = buildSoldier(num === 1 ? 0xc9b77a : 0x8fb4d8, num === 1 ? 0x6f6438 : 0x4f7398, false);
  return {
    num, x: num === 1 ? -10 : 10, z: 0, yaw: 0, r: .5, hp: 100, ammo: MAG_SIZE, reload: 0, cool: 0,
    alive: true, walk: 0, ...s,
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
  return { x, z, yaw: 0, r: .5, hp: maxHp, cool: rand(60, 140), strafe: Math.random() < .5 ? 1 : -1, walk: 0, flash: 0, ...s };
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
    if (!p.alive) { p.alive = true; p.hp = 50; p.group.rotation.x = 0; p.group.position.y = 0; }
    else p.hp = Math.min(100, p.hp + 25);
  }
}
function addPuff(x, y, z, color, life, grow) {
  const mesh = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8 }));
  mesh.position.set(x, y, z); scene.add(mesh);
  puffs.push({ mesh, life, max: life, grow });
}
function shoot(from, yaw, team, spread) {
  const a = yaw + rand(-spread, spread), f = forward(a);
  const mesh = new THREE.Mesh(bulletGeo, team === "ally" ? allyTracer : enemyTracer);
  mesh.rotation.y = a; scene.add(mesh);
  bullets.push({ x: from.x + f.x * 1.2, z: from.z + f.z * 1.2, vx: f.x * BULLET_SPEED, vz: f.z * BULLET_SPEED, team, life: 60, mesh });
  addPuff(from.x + f.x * 1.5, 1.38, from.z + f.z * 1.5, 0xffe9a0, 4, 0);   // muzzle flash
}

function updatePlayer(p) {
  if (!p.alive) return;
  let fwd = 0, side = 0, turn = 0;
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
  if (fwd || side) {
    const f = forward(p.yaw), r = rightOf(p.yaw), len = Math.hypot(fwd, side);
    move(p, (f.x * fwd + r.x * side) / len * PLAYER_SPEED, (f.z * fwd + r.z * side) / len * PLAYER_SPEED);
    p.walk += .22;
  } else p.walk *= .8;

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
  e.yaw = Math.atan2(t.x - e.x, t.z - e.z);
  const sees = clearShot(e, t);
  if (d > 15 || !sees) {
    const f = forward(e.yaw); move(e, f.x * ENEMY_SPEED, f.z * ENEMY_SPEED); e.walk += .18;
  } else {
    const r = rightOf(e.yaw); move(e, r.x * e.strafe * .05, r.z * e.strafe * .05); e.walk += .1;
    if (Math.random() < .01) e.strafe *= -1;
  }
  if (--e.cool <= 0 && d < 36 && sees) {
    shoot(e, e.yaw, "enemy", .07);
    e.cool = rand(70, 130) - Math.min(wave * 4, 40);
  }
}

function update() {
  if (state !== "play" || paused) return;
  players.forEach(updatePlayer);
  enemies.forEach(updateEnemy);

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
    p.life--; p.mesh.scale.multiplyScalar(1 + p.grow); p.mesh.material.opacity = .8 * p.life / p.max;
    if (p.life <= 0) scene.remove(p.mesh);
  }
  puffs = puffs.filter(p => p.life > 0);

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
  s.group.position.set(s.x, s.group.position.y, s.z);
  s.group.rotation.y = s.yaw;
  const swing = Math.sin(s.walk) * Math.min(1, Math.abs(s.walk) > .01 ? .6 : 0);
  s.legs[0].rotation.x = swing; s.legs[1].rotation.x = -swing;
  if (down) s.group.rotation.x = Math.max(s.group.rotation.x - .08, -Math.PI / 2);
}
function placeCamera(p) {
  const f = forward(p.yaw), r = rightOf(p.yaw);
  p.cam.position.set(p.x - f.x * 5.2 + r.x * 1.0, 3.0, p.z - f.z * 5.2 + r.z * 1.0);
  p.cam.lookAt(p.x + f.x * 10, 1.3, p.z + f.z * 10);
}
const menuCam = new THREE.PerspectiveCamera(55, 1, .1, 300);
let menuAngle = 0;

function render() {
  const w = stage.clientWidth, h = stage.clientHeight;
  for (const p of players) poseSoldier(p, !p.alive);
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
    document.getElementById("hp" + p.num).style.width = p.hp + "%";
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
