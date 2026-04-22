const GAS_URL = "https://script.google.com/macros/s/AKfycbx8e0UuJQsn2_8plYbhMIqZvGw0ttOJSOBzgJkmy8mbL-AJGsKVZHQ-8xI62BMkuQdrtg/exec";

let sessionUser  = null;
let sessionEmail = null;
let vehiculos    = {};
let placaActiva  = null;
let stream       = null;
let camaraOn     = false;
let modoCaptura  = null;
let fileTarget   = null;

window.addEventListener('DOMContentLoaded', () => {
  cargarSesion();
  cargarVehiculos();
});

function cargarSesion() {
  const saved = localStorage.getItem('evid_session');
  if (saved) {
    const s = JSON.parse(saved);
    sessionUser  = s.usuario;
    sessionEmail = s.correo;
    document.getElementById('header-user').textContent = sessionUser;
    showScreen('main');
    renderVehiculos();
  }
}

function cargarVehiculos() {
  const saved = localStorage.getItem('evid_vehiculos');
  if (saved) vehiculos = JSON.parse(saved);
}

function guardarVehiculos() {
  localStorage.setItem('evid_vehiculos', JSON.stringify(vehiculos));
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.classList.add('hidden');
  });
  const t = document.getElementById('screen-' + name);
  t.classList.remove('hidden');
  t.classList.add('active');
}

// ─── LOGIN ───────────────────────────────────────────────────────
async function login() {
  const usuario  = document.getElementById('inp-usuario').value.trim();
  const clave    = document.getElementById('inp-clave').value.trim();
  const errDiv   = document.getElementById('login-error');
  const btnLogin = document.getElementById('btn-login');

  if (!usuario || !clave) { showToast('Completa todos los campos', 'error'); return; }

  errDiv.classList.add('hidden');
  btnLogin.disabled = true;
  btnLogin.innerHTML = '<div class="loader-spinner" style="width:20px;height:20px;margin:0;border-width:2px"></div><span>Verificando...</span>';

  try {
    const res = await postGAS({ action: 'login', usuario, clave });
    if (res.success) {
      sessionUser  = res.usuario;
      sessionEmail = res.correo;
      localStorage.setItem('evid_session', JSON.stringify({ usuario: sessionUser, correo: sessionEmail }));
      document.getElementById('header-user').textContent = sessionUser;
      showScreen('main');
      renderVehiculos();
    } else {
      errDiv.classList.remove('hidden');
    }
  } catch(e) {
    if (GAS_URL === "https://script.google.com/macros/s/AKfycbysNdQfhUrfhVjwwIRaheHK5fqFbOuXhUssEAvi5SVX8ZZvmgNEIqwMeLTRnMBPxQou7g/exec") {
      sessionUser  = usuario;
      sessionEmail = usuario + '@empresa.com';
      localStorage.setItem('evid_session', JSON.stringify({ usuario: sessionUser, correo: sessionEmail }));
      document.getElementById('header-user').textContent = sessionUser;
      showToast('Modo demo activo', 'warning');
      showScreen('main');
      renderVehiculos();
    } else {
      showToast('Error de conexión con el servidor', 'error');
    }
  }

  btnLogin.disabled = false;
  btnLogin.innerHTML = '<span>Ingresar</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
}

function logout() {
  if (!confirm('¿Deseas cerrar sesión?')) return;
  detenerCamara();
  sessionUser = null; sessionEmail = null;
  localStorage.removeItem('evid_session');
  showScreen('login');
  document.getElementById('inp-usuario').value = '';
  document.getElementById('inp-clave').value   = '';
}

function togglePass() {
  const inp = document.getElementById('inp-clave');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

// ─── VEHÍCULOS ───────────────────────────────────────────────────
function showModalPlaca() {
  document.getElementById('modal-placa').classList.remove('hidden');
  setTimeout(() => document.getElementById('inp-placa').focus(), 100);
}

function hideModalPlaca() {
  document.getElementById('modal-placa').classList.add('hidden');
  document.getElementById('inp-placa').value = '';
}

function crearVehiculo() {
  const placa = document.getElementById('inp-placa').value.trim().toUpperCase();
  if (!placa || placa.length < 2) { showToast('Ingresa un identificador válido', 'error'); return; }
  if (!vehiculos[placa]) {
    vehiculos[placa] = {
      fotos: [], documentos: [],
      categoria: '', responsable: '',
      fechaCreado: new Date().toISOString()
    };
    guardarVehiculos();
  }
  hideModalPlaca();
  abrirVehiculo(placa);
}

function abrirVehiculo(placa) {
  placaActiva = placa;
  const v = vehiculos[placa];
  document.getElementById('placa-badge').textContent  = placa;
  document.getElementById('categoria').value          = v.categoria   || '';
  document.getElementById('responsable').value        = v.responsable || '';
  renderPreviews('fotos');
  renderPreviews('documentos');
  actualizarCounts();
  detenerCamara();
  document.getElementById('cam-status-text').textContent = 'Activar';
  document.getElementById('cam-container').classList.add('hidden');
  camaraOn = false;
  showScreen('detalle');
}

function renderVehiculos() {
  const container  = document.getElementById('lista-vehiculos');
  const emptyState = document.getElementById('empty-state');
  const vcCount    = document.getElementById('vehicle-count');
  const placas     = Object.keys(vehiculos);

  vcCount.textContent = placas.length + ' vehículo' + (placas.length !== 1 ? 's' : '');
  container.querySelectorAll('.vehicle-card').forEach(c => c.remove());

  if (placas.length === 0) { emptyState.style.display = ''; return; }
  emptyState.style.display = 'none';

  placas.forEach(placa => {
    const v = vehiculos[placa];
    const total = (v.fotos ? v.fotos.length : 0) + (v.documentos ? v.documentos.length : 0);
    const card = document.createElement('div');
    card.className = 'vehicle-card';
    card.onclick = () => abrirVehiculo(placa);
    card.innerHTML = `
      ${total > 0 ? `<div class="vehicle-photos-badge">${total}</div>` : ''}
      <div class="vehicle-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="1" y="3" width="15" height="13" rx="1"/>
          <path d="M16 8h4l3 3v5h-7V8z"/>
          <circle cx="5.5" cy="18.5" r="2.5"/>
          <circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
      </div>
      <div class="vehicle-placa">${placa}</div>
      <div class="vehicle-meta">${v.categoria || 'Sin categoría'}</div>
      <div class="vehicle-meta">${total} foto${total !== 1 ? 's' : ''}</div>
    `;
    container.appendChild(card);
  });
}

function volver() {
  if (placaActiva && vehiculos[placaActiva]) {
    vehiculos[placaActiva].categoria   = document.getElementById('categoria').value;
    vehiculos[placaActiva].responsable = document.getElementById('responsable').value;
    guardarVehiculos();
  }
  detenerCamara();
  placaActiva = null;
  showScreen('main');
  renderVehiculos();
}

// ─── CÁMARA ──────────────────────────────────────────────────────
async function toggleCamera() {
  if (!camaraOn) { await activarCamara(); } else { detenerCamara(); }
}

async function activarCamara() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    document.getElementById('video').srcObject = stream;
    document.getElementById('cam-container').classList.remove('hidden');
    document.getElementById('cam-status-text').textContent = 'Apagar';
    camaraOn = true;
  } catch(e) { showToast('No se pudo acceder a la cámara', 'error'); }
}

function detenerCamara() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  document.getElementById('video').srcObject = null;
  document.getElementById('cam-container').classList.add('hidden');
  document.getElementById('cam-status-text').textContent = 'Activar';
  camaraOn = false;
}

function capturar(tipo) {
  modoCaptura = tipo;
  if (!camaraOn) { activarCamara().then(() => setTimeout(tomarFotoActual, 600)); }
  else { tomarFotoActual(); }
}

// ─── EFECTO ESCÁNER B&N ──────────────────────────────────────────
function aplicarEfectoEscaner(ctx, w, h) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    let gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    gray = Math.min(255, Math.max(0, (gray - 128) * 1.6 + 148));
    if (gray > 200) gray = Math.min(255, gray * 1.05);
    else if (gray < 80) gray = Math.max(0, gray * 0.7);
    data[i] = data[i+1] = data[i+2] = Math.round(gray);
  }
  ctx.putImageData(imageData, 0, 0);
  return ctx.canvas.toDataURL('image/jpeg', 0.88);
}

function tomarFotoActual() {
  const video  = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  if (!video.videoWidth) { showToast('Cámara no lista, intenta de nuevo', 'warning'); return; }

  const MAX_W = 1200;
  let w = video.videoWidth, h = video.videoHeight;
  if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, w, h);

  const base64 = modoCaptura === 'documentos'
    ? aplicarEfectoEscaner(ctx, w, h)
    : canvas.toDataURL('image/jpeg', 0.80);

  agregarImagen(modoCaptura, base64);

  const f = document.createElement('div');
  f.style.cssText = 'position:fixed;inset:0;background:white;opacity:0.8;z-index:999;pointer-events:none;';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 200);
}

function subirArchivo(tipo) {
  fileTarget = tipo;
  const input = document.getElementById('file-input');
  input.value = ''; input.click();
}

function handleFileUpload(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  Promise.all(files.map(f => comprimirArchivo(f, fileTarget))).then(results => {
    results.forEach(b64 => agregarImagen(fileTarget, b64));
  });
}

function comprimirArchivo(file, tipo) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const MAX_W = 1200;
        let w = img.width, h = img.height;
        if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
        const canvas = document.getElementById('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const base64 = tipo === 'documentos'
          ? aplicarEfectoEscaner(ctx, w, h)
          : canvas.toDataURL('image/jpeg', 0.80);
        resolve(base64);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function agregarImagen(tipo, base64) {
  if (!vehiculos[placaActiva]) return;
  vehiculos[placaActiva][tipo].push({ base64, ts: Date.now() });
  guardarVehiculos();
  renderPreviews(tipo);
  actualizarCounts();
  showToast('Foto agregada', 'success');
}

function eliminarImagen(tipo, idx) {
  vehiculos[placaActiva][tipo].splice(idx, 1);
  guardarVehiculos();
  renderPreviews(tipo);
  actualizarCounts();
}

function renderPreviews(tipo) {
  const id = tipo === 'fotos' ? 'preview-fotos' : 'preview-docs';
  const container = document.getElementById(id);
  const imgs = vehiculos[placaActiva] ? vehiculos[placaActiva][tipo] : [];
  container.innerHTML = '';
  imgs.forEach((img, idx) => {
    const item = document.createElement('div');
    item.className = 'preview-item' + (tipo === 'documentos' ? ' doc-preview' : '');
    item.innerHTML = `
      <img src="${img.base64}" alt="foto ${idx+1}" loading="lazy">
      <div class="preview-num">${idx+1}</div>
      <button class="delete-photo" onclick="eliminarImagen('${tipo}',${idx})">×</button>
    `;
    container.appendChild(item);
  });
}

function actualizarCounts() {
  if (!vehiculos[placaActiva]) return;
  document.getElementById('count-fotos').textContent = vehiculos[placaActiva].fotos.length;
  document.getElementById('count-docs').textContent  = vehiculos[placaActiva].documentos.length;
}

// ─── GENERAR Y ENVIAR ────────────────────────────────────────────
async function generarTodo() {
  const v           = vehiculos[placaActiva];
  const categoria   = document.getElementById('categoria').value;
  const responsable = document.getElementById('responsable').value.trim();

  if (!categoria)   { showToast('Selecciona la categoría', 'error'); return; }
  if (!responsable) { showToast('Ingresa el nombre del responsable', 'error'); return; }
  if (v.fotos.length + v.documentos.length === 0) { showToast('Agrega al menos una foto', 'error'); return; }

  v.categoria = categoria;
  v.responsable = responsable;
  guardarVehiculos();

  // PASO 1: PDF local
  showLoader('Generando PDF...', 'Por favor espere');
  try {
    const pdfBlob = await generarPDFLocal(v, placaActiva);
    descargaPDF(pdfBlob, placaActiva + '_' + categoria + '_' + fechaFilename() + '.pdf');
  } catch(err) {
    hideLoader();
    showToast('Error al generar PDF: ' + err.message, 'error');
    return;
  }

  // PASO 2: Enviar a GAS
  showLoader('Enviando al servidor...', 'Registrando en Sheets y enviando correo');
  try {
    const payload = {
      action:      'todo',
      placa:       placaActiva,
      categoria,
      responsable,
      usuario:     sessionUser,
      correo:      sessionEmail,
      fotos:       v.fotos,
      documentos:  v.documentos
    };
    const res = await postGAS(payload);
    if (res && res.success) {
      hideLoader();
      showToast('✓ Registrado y correo enviado', 'success');
    } else {
      hideLoader();
      showToast('Error servidor: ' + (res.error || 'desconocido'), 'error');
      return;
    }
  } catch(e) {
    hideLoader();
    showToast('Error de conexión: ' + e.message, 'error');
    return;
  }

  // PASO 3: Limpiar
  detenerCamara();
  delete vehiculos[placaActiva];
  guardarVehiculos();
  placaActiva = null;
  showScreen('main');
  renderVehiculos();
}

// ─── PDF LOCAL: 1 FOTO POR PÁGINA COMPLETA ───────────────────────
async function generarPDFLocal(v, placa) {
  if (!window.jspdf) {
    await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297;
  const M = 10; // margen

  // ══════════════════════════════════════════════
  // PÁGINA 1 — Portada con info del proceso
  // ══════════════════════════════════════════════
  doc.setFillColor(30,58,138);
  doc.rect(0, 0, W, 32, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(20); doc.setFont('helvetica','bold');
  doc.text('EvidLog', M, 14);
  doc.setFontSize(11); doc.setFont('helvetica','normal');
  doc.text('Sistema de Gestión de Evidencias', M, 22);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleString('es-CO'), W - M, 22, { align: 'right' });

  // Caja de info
  let y = 42;
  doc.setFillColor(239,246,255);
  doc.rect(M, y - 4, W - M*2, 68, 'F');
  doc.setDrawColor(219,234,254);
  doc.rect(M, y - 4, W - M*2, 68);

  const info = [
    ['Placa / ID',    placa],
    ['Categoría',     v.categoria],
    ['Responsable',   v.responsable],
    ['Usuario',       sessionUser],
    ['Correo',        sessionEmail],
    ['Fecha',         new Date().toLocaleString('es-CO')],
    ['Fotos vehículo',v.fotos.length + ' imagen(es)'],
    ['Documentos',    v.documentos.length + ' imagen(es)'],
    ['Total páginas', (v.fotos.length + v.documentos.length + 1) + ' páginas']
  ];

  doc.setFontSize(10);
  info.forEach(([k, val], i) => {
    const yy = y + i * 7;
    doc.setFont('helvetica','bold'); doc.setTextColor(30,58,138);
    doc.text(k + ':', M + 4, yy);
    doc.setFont('helvetica','normal'); doc.setTextColor(30,30,30);
    doc.text(String(val || '—'), M + 52, yy);
  });

  y += info.length * 7 + 12;

  // Resumen de secciones
  if (v.fotos.length > 0) {
    doc.setFillColor(220,235,255);
    doc.rect(M, y, (W - M*2)/2 - 4, 18, 'F');
    doc.setTextColor(30,58,138); doc.setFontSize(10); doc.setFont('helvetica','bold');
    doc.text('📸 EVIDENCIAS VEHÍCULO', M + 4, y + 7);
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text(v.fotos.length + ' foto(s) — 1 por página', M + 4, y + 14);
    y += 22;
  }
  if (v.documentos.length > 0) {
    doc.setFillColor(230,230,230);
    doc.rect(M, y, (W - M*2)/2 - 4, 18, 'F');
    doc.setTextColor(40,40,40); doc.setFontSize(10); doc.setFont('helvetica','bold');
    doc.text('📄 DOCUMENTOS (escáner B&N)', M + 4, y + 7);
    doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text(v.documentos.length + ' doc(s) — 1 por página', M + 4, y + 14);
  }

  // ══════════════════════════════════════════════
  // PÁGINAS DE FOTOS VEHÍCULO — 1 por página
  // ══════════════════════════════════════════════
  v.fotos.forEach((img, idx) => {
    doc.addPage();
    _paginaFoto(doc, img, idx, v.fotos.length, placa, v.categoria, v.responsable,
      'EVIDENCIA VEHÍCULO', '#2563eb', false, W, H, M);
  });

  // ══════════════════════════════════════════════
  // PÁGINAS DE DOCUMENTOS — 1 por página, B&N
  // ══════════════════════════════════════════════
  v.documentos.forEach((img, idx) => {
    doc.addPage();
    _paginaFoto(doc, img, idx, v.documentos.length, placa, v.categoria, v.responsable,
      'DOCUMENTO', '#374151', true, W, H, M);
  });

  // Footer en todas las páginas
  const totalPags = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPags; p++) {
    doc.setPage(p);
    doc.setFillColor(245,245,245);
    doc.rect(0, H - 8, W, 8, 'F');
    doc.setFontSize(7); doc.setTextColor(140,140,140); doc.setFont('helvetica','normal');
    doc.text(
      `Página ${p} de ${totalPags}  |  ${placa}  |  ${new Date().toLocaleString('es-CO')}  |  EvidLog v2.0`,
      W/2, H - 2.5, { align: 'center' }
    );
  }

  return doc.output('blob');
}

// ── Helper: renderiza una foto en una página completa ────────────
function _paginaFoto(doc, img, idx, total, placa, categoria, responsable, tipo, colorHex, esBN, W, H, M) {
  // Cabecera
  const r = parseInt(colorHex.slice(1,3),16);
  const g = parseInt(colorHex.slice(3,5),16);
  const b = parseInt(colorHex.slice(5,7),16);
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, W, 14, 'F');
  doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text(tipo + ' #' + (idx+1) + ' de ' + total, M, 6);
  doc.setFont('helvetica','normal');
  doc.text(placa + '  |  ' + categoria + '  |  Resp: ' + responsable, M, 11);

  if (esBN) {
    doc.setFontSize(7);
    doc.text('Escala de grises – Estilo escáner', W - M, 11, { align: 'right' });
  }

  // Imagen ocupando casi toda la página
  const imgX = M;
  const imgY = 16;
  const imgW = W - M * 2;
  const imgH = H - 16 - 10; // descontar cabecera y footer

  try {
    doc.addImage(img.base64, 'JPEG', imgX, imgY, imgW, imgH, undefined, 'FAST');
  } catch(e) {
    doc.setFillColor(220,220,220);
    doc.rect(imgX, imgY, imgW, imgH, 'F');
    doc.setTextColor(120,120,120); doc.setFontSize(12);
    doc.text('Error al cargar imagen', W/2, imgY + imgH/2, { align: 'center' });
  }
}

function descargaPDF(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─── COMUNICACIÓN GAS ────────────────────────────────────────────
async function postGAS(data) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}

// ─── UI HELPERS ──────────────────────────────────────────────────
function showLoader(msg, sub) {
  document.getElementById('loader-msg').textContent = msg || 'Procesando...';
  document.getElementById('loader-sub').textContent = sub || 'Por favor espere';
  document.getElementById('loader-overlay').classList.remove('hidden');
}
function hideLoader() {
  document.getElementById('loader-overlay').classList.add('hidden');
}

let toastTimer = null;
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const icon  = document.getElementById('toast-icon');
  document.getElementById('toast-msg').textContent = msg;
  toast.className = 'toast ' + type;
  const icons = {
    success: '<polyline points="20 6 9 17 4 12"/>',
    error:   '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
  };
  icon.innerHTML = icons[type] || icons.success;
  toast.classList.remove('hidden'); toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 3000);
}

function cargarScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function fechaFilename() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
}