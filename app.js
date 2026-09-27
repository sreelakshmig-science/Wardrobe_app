// ================= Config / auth =================
function getApiBase() { return localStorage.getItem('apiBase') || ''; }
function getToken() { return localStorage.getItem('token') || ''; }

let wardrobe = [];
let cart = [];
let pendingFile = null;
let selectedClothId = null;
let stream = null;
let ov = { x: 0, y: 0, scale: 150, rot: 0 };
let autoFit = false;
let poseDetector = null;
let autoLoopId = null;

function toast(t) {
  const el = document.getElementById('toast');
  el.textContent = t;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1600);
}

// Wrapper around fetch that adds the base URL + auth header + basic error handling
async function api(path, method = 'GET', body) {
  const base = getApiBase().replace(/\/$/, '');
  if (!base) throw new Error('No backend URL set yet');
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ================= Auth screen =================
document.getElementById('apiBaseInput').value = getApiBase();

async function doAuth(kind) {
  const msg = document.getElementById('authMsg');
  msg.style.display = 'none';
  const apiBase = document.getElementById('apiBaseInput').value.trim();
  const username = document.getElementById('authUser').value.trim();
  const password = document.getElementById('authPass').value;
  if (!apiBase) { showAuthMsg('Enter your backend URL first (see README).'); return; }
  localStorage.setItem('apiBase', apiBase);
  if (!username || !password) { showAuthMsg('Enter a username and password.'); return; }

  try {
    const data = await api(kind === 'login' ? '/auth/login' : '/auth/signup', 'POST', { username, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username);
    await enterApp();
  } catch (err) {
    showAuthMsg(err.message);
  }
}

function showAuthMsg(text) {
  const msg = document.getElementById('authMsg');
  msg.textContent = text;
  msg.style.display = 'block';
}

function logout() {
  localStorage.removeItem('token');
  stopCamera();
  document.getElementById('mainNav').style.display = 'none';
  document.getElementById('logoutBtn').style.display = 'none';
  document.getElementById('cartBadge').style.display = 'none';
  document.querySelectorAll('.view').forEach(s => s.classList.remove('active'));
  document.getElementById('view-auth').classList.add('active');
}

async function enterApp() {
  try {
    wardrobe = await api('/wardrobe');
    cart = await api('/cart');
  } catch (err) {
    showAuthMsg('Could not load your data: ' + err.message);
    return;
  }
  document.getElementById('mainNav').style.display = 'flex';
  document.getElementById('logoutBtn').style.display = 'inline-block';
  document.getElementById('cartBadge').style.display = 'inline-block';
  renderWardrobe();
  updateCartBadge();
  switchTab('wardrobe');
}

// Try to auto-login on page load if a token is already saved
(async function initialLoad() {
  if (getToken() && getApiBase()) {
    try { await enterApp(); } catch { logout(); }
  }
})();

// ================= Tabs =================
function switchTab(v) {
  document.querySelectorAll('.view').forEach(s => s.classList.remove('active'));
  document.getElementById('view-' + v).classList.add('active');
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
  if (v !== 'tryon' && stream) stopCamera();
  if (v === 'cart') renderCart();
  if (v === 'tryon') renderStrip();
}

// ================= Wardrobe =================
function onFileChosen(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { pendingFile = r.result; renderPending(); };
  r.readAsDataURL(f);
  e.target.value = '';
}

function renderPending() {
  const box = document.getElementById('pendingBox');
  if (!pendingFile) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="pending">
    <img src="${pendingFile}">
    <div class="fields">
      <input type="text" id="pName" placeholder="e.g. Blue denim jacket">
      <select id="pCat">
        <option>Top</option><option>Bottom</option><option>Dress</option>
        <option>Outerwear</option><option>Shoes</option><option>Accessory</option>
      </select>
      <div style="display:flex;gap:6px">
        <button class="btn-primary btn-sm" onclick="savePending()">Save</button>
        <button class="btn-ghost btn-sm" onclick="pendingFile=null;renderPending()">Cancel</button>
      </div>
    </div></div>`;
}

async function savePending() {
  const name = document.getElementById('pName').value.trim() || 'Unnamed item';
  const cat = document.getElementById('pCat').value;
  try {
    const item = await api('/wardrobe', 'POST', { name, cat, img: pendingFile });
    wardrobe.unshift(item);
    pendingFile = null;
    renderPending();
    renderWardrobe();
    toast('Added to wardrobe');
  } catch (err) {
    toast('Could not save: ' + err.message);
  }
}

function renderWardrobe() {
  const filt = document.getElementById('filterCat').value;
  const grid = document.getElementById('wardrobeGrid');
  const items = wardrobe.filter(i => !filt || i.cat === filt);
  grid.innerHTML = items.length
    ? items.map(i => `
      <div class="card">
        <span class="tag">${i.cat}</span>
        <img src="${i.img}">
        <div class="info"><div class="name">${i.name}</div></div>
        <div class="actions">
          <button class="btn-primary btn-sm" onclick="tryOn('${i._id}')">Try on</button>
          <button class="btn-ghost btn-sm" onclick="deleteItem('${i._id}')">Delete</button>
        </div>
      </div>`).join('')
    : `<div class="empty">No clothes yet — add a photo of something you own to get started.</div>`;
}

async function deleteItem(id) {
  try {
    await api('/wardrobe/' + id, 'DELETE');
    wardrobe = wardrobe.filter(i => i._id !== id);
    renderWardrobe();
  } catch (err) {
    toast('Could not delete: ' + err.message);
  }
}

function tryOn(id) {
  selectedClothId = id;
  switchTab('tryon');
  resetOverlay();
  setOverlayImage();
}

// ================= Try-on / camera =================
function renderStrip() {
  const s = document.getElementById('clothStrip');
  s.innerHTML = wardrobe.map(i =>
    `<img src="${i.img}" class="${i._id === selectedClothId ? 'sel' : ''}" onclick="selectedClothId='${i._id}';setOverlayImage()">`
  ).join('');
}

function setOverlayImage() {
  const item = wardrobe.find(i => i._id === selectedClothId);
  const img = document.getElementById('overlayImg');
  const ctrl = document.getElementById('overlayControls');
  if (!item) { img.style.display = 'none'; ctrl.style.display = 'none'; return; }
  img.src = item.img;
  img.style.display = 'block';
  ctrl.style.display = 'flex';
  renderStrip();
  applyOverlay();
}

function applyOverlay() {
  const img = document.getElementById('overlayImg');
  img.style.width = ov.scale + 'px';
  img.style.left = `calc(50% + ${ov.x}px)`;
  img.style.top = `calc(50% + ${ov.y}px)`;
  img.style.transform = `translate(-50%,-50%) rotate(${ov.rot}deg)`;
}

// Manual slider tweak — turns auto-fit off since the user is taking over
function manualAdjust() {
  ov.scale = +document.getElementById('scaleR').value;
  ov.rot = +document.getElementById('rotR').value;
  if (autoFit) toggleAutoFit();
  applyOverlay();
}

function resetOverlay() {
  ov = { x: 0, y: 0, scale: 150, rot: 0 };
  document.getElementById('scaleR').value = 150;
  document.getElementById('rotR').value = 0;
  applyOverlay();
}

// Drag to reposition the overlay (mouse + touch via Pointer Events)
(function enableDrag() {
  const img = document.getElementById('overlayImg');
  let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
  const start = e => {
    dragging = true;
    if (autoFit) toggleAutoFit(); // manual drag overrides auto-fit
    const p = e.touches ? e.touches[0] : e;
    sx = p.clientX; sy = p.clientY; ox = ov.x; oy = ov.y;
  };
  const move = e => {
    if (!dragging) return;
    const p = e.touches ? e.touches[0] : e;
    ov.x = ox + (p.clientX - sx);
    ov.y = oy + (p.clientY - sy);
    applyOverlay();
  };
  const end = () => dragging = false;
  img.addEventListener('pointerdown', start);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
})();

async function toggleCamera() {
  if (stream) { stopCamera(); return; }
  const msg = document.getElementById('camMsg');
  msg.style.display = 'none';
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
      audio: false,
    });
    document.getElementById('video').srcObject = stream;
    document.getElementById('camBtn').textContent = 'Stop camera';
  } catch (err) {
    msg.style.display = 'block';
    msg.textContent = "Couldn't access a camera on this device. Camera access needs HTTPS (or localhost) — once this is deployed (see README) it'll just work on your phone.";
  }
}

function stopCamera() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  document.getElementById('camBtn').textContent = 'Start camera';
  if (autoFit) toggleAutoFit();
}

// ---------- Auto-fit (pose detection) ----------
async function ensureDetector() {
  if (poseDetector) return poseDetector;
  const msg = document.getElementById('camMsg');
  msg.style.display = 'block';
  msg.textContent = 'Loading auto-fit model (only happens once per visit)...';
  poseDetector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
  });
  msg.style.display = 'none';
  return poseDetector;
}

function toggleAutoFit() {
  autoFit = !autoFit;
  document.getElementById('autoBtn').textContent = 'Auto-fit: ' + (autoFit ? 'On' : 'Off');
  if (autoFit) startAutoFitLoop(); else stopAutoFitLoop();
}

async function startAutoFitLoop() {
  try { await ensureDetector(); }
  catch (err) {
    toast('Could not load auto-fit model — check your connection');
    autoFit = false;
    document.getElementById('autoBtn').textContent = 'Auto-fit: Off';
    return;
  }
  if (autoLoopId) clearInterval(autoLoopId);
  autoLoopId = setInterval(runAutoFitTick, 150);
}

function stopAutoFitLoop() {
  if (autoLoopId) { clearInterval(autoLoopId); autoLoopId = null; }
}

async function runAutoFitTick() {
  if (!stream || !selectedClothId || !poseDetector) return;
  const video = document.getElementById('video');
  if (!video.videoWidth) return;
  const item = wardrobe.find(i => i._id === selectedClothId);
  if (!item) return;
  try {
    const poses = await poseDetector.estimatePoses(video);
    if (!poses.length) return;
    const rect = document.getElementById('camwrap').getBoundingClientRect();
    const t = computeAutoTransform(poses[0].keypoints, item.cat, video.videoWidth, video.videoHeight, rect.width, rect.height);
    if (!t) return;
    ov = t;
    document.getElementById('scaleR').value = Math.round(ov.scale);
    document.getElementById('rotR').value = Math.round(ov.rot);
    applyOverlay();
  } catch (err) { /* skip this frame */ }
}

// Turns detected body keypoints into an overlay transform. Approximate on purpose —
// good enough to land the garment roughly in place, then you can nudge it by hand.
function computeAutoTransform(keypoints, category, videoW, videoH, rectW, rectH) {
  const scaleX = rectW / videoW, scaleY = rectH / videoH;
  const minScore = 0.3;
  const get = n => keypoints.find(k => k.name === n);
  // Mirror x because the video preview is mirrored (selfie view)
  const toDisplay = p => ({ x: rectW - p.x * scaleX, y: p.y * scaleY });

  let a, b;
  if (category === 'Bottom') { a = get('left_hip'); b = get('right_hip'); }
  else if (category === 'Shoes') {
    a = get('left_ankle'); b = get('right_ankle');
    if (!a || !b || a.score < minScore || b.score < minScore) { a = get('left_hip'); b = get('right_hip'); }
  } else { a = get('left_shoulder'); b = get('right_shoulder'); }

  if (!a || !b || a.score < minScore || b.score < minScore) return null;

  const da = toDisplay(a), db = toDisplay(b);
  const mid = { x: (da.x + db.x) / 2, y: (da.y + db.y) / 2 };
  const width = Math.hypot(db.x - da.x, db.y - da.y);
  const angle = Math.atan2(db.y - da.y, db.x - da.x) * 180 / Math.PI;

  let yOffset = 0;
  if (category === 'Dress') yOffset = width * 1.3;
  else if (category === 'Top' || category === 'Outerwear') yOffset = width * 0.7;
  else if (category === 'Accessory') yOffset = width * 0.15;

  return {
    x: mid.x - rectW / 2,
    y: mid.y - rectH / 2 + yOffset,
    scale: Math.max(40, Math.min(400, width * 2.1)),
    rot: angle,
  };
}

// ================= Cart =================
async function addToCart() {
  const item = wardrobe.find(i => i._id === selectedClothId);
  if (!item) { toast('Pick a clothing item first'); return; }
  const video = document.getElementById('video');
  let snap = item.img;
  if (stream && video.videoWidth) {
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const ctx = c.getContext('2d');
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, c.width, c.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const rect = document.getElementById('camwrap').getBoundingClientRect();
    const scaleX = c.width / rect.width, scaleY = c.height / rect.height;
    const ovImg = document.getElementById('overlayImg');
    const w = ov.scale * scaleX;
    const h = w * (ovImg.naturalHeight / ovImg.naturalWidth || 1.3);
    const cx = c.width / 2 + ov.x * scaleX;
    const cy = c.height / 2 + ov.y * scaleY;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ov.rot * Math.PI / 180);
    ctx.drawImage(ovImg, -w / 2, -h / 2, w, h);
    ctx.restore();

    snap = c.toDataURL('image/jpeg', 0.85);
  }
  try {
    const saved = await api('/cart', 'POST', { clothId: item._id, name: item.name, img: snap });
    cart.unshift(saved);
    updateCartBadge();
    toast('Added to cart ❤️');
  } catch (err) {
    toast('Could not add to cart: ' + err.message);
  }
}

function updateCartBadge() {
  document.getElementById('cartBadge').textContent = 'Cart: ' + cart.length;
}

function renderCart() {
  const list = document.getElementById('cartList');
  list.innerHTML = cart.length
    ? cart.map(c => `
      <div class="cartcard">
        <img src="${c.img}">
        <div class="ci">
          <div style="font-weight:600">${c.name}</div>
          <button class="btn-ghost btn-sm" style="align-self:flex-start" onclick="removeCart('${c._id}')">Remove</button>
        </div>
      </div>`).join('')
    : `<div class="empty">Your cart is empty. Try something on and tap "Add to cart".</div>`;
}

async function removeCart(id) {
  try {
    await api('/cart/' + id, 'DELETE');
    cart = cart.filter(c => c._id !== id);
    renderCart();
    updateCartBadge();
  } catch (err) {
    toast('Could not remove: ' + err.message);
  }
}
