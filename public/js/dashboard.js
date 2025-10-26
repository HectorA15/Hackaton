async function(){
  const api = '/api/products';
  const welcomeEl = document.getElementById('welcome');
  const tableBody = document.querySelector('#productsTable tbody');
  const summary = document.getElementById('summary');

  function daysUntil(dateStr){
    const today = new Date();
    const d = new Date(dateStr + 'T23:59:59');
    const diffMs = d - today;
    return Math.ceil(diffMs / (1000*60*60*24));
  }

  function renderProducts(list){
    tableBody.innerHTML = '';
    if (!list.length) {
      tableBody.innerHTML = '<tr><td colspan="6" style="color:var(--muted)">No hay productos</td></tr>';
      summary.textContent = 'No hay productos registrados.';
      return;
    }
    let expiringSoon = 0;
    list.forEach(p => {
      const days = daysUntil(p.expiry);
      const badgeClass = days <= 7 ? 'badge warn' : 'badge ok';
      if (days <= 7) expiringSoon++;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.name}</td>
        <td>${p.sku || ''} ${p.lot ? '<br><small>Lote: '+p.lot+'</small>':''}</td>
        <td>${p.expiry}</td>
        <td><span class="${badgeClass}">${days} días</span></td>
        <td>${p.qty ?? 0}</td>
        <td>
          <button class="btn btn-small" data-id="${p.id}" data-action="view">Ver</button>
          <button class="btn btn-small" data-id="${p.id}" data-action="del">Eliminar</button>
        </td>`;
      tableBody.appendChild(tr);
    });
    summary.textContent = `${list.length} productos. ${expiringSoon ? expiringSoon + ' próximos a caducar.' : 'Sin caducidades próximas.'}`;
  }

  async function loadProducts(){
    try{
      const res = await fetch(api);
      const data = await res.json();
      renderProducts(data);
    }catch(err){
      console.error(err);
      tableBody.innerHTML = '<tr><td colspan="6" style="color:#c0392b">Error cargando productos</td></tr>';
    }
  }

  // ---------- Scanner mejorado (ROI + BarcodeDetector/ZXing)
  let codeReader;
  let selectedDeviceId;
  let currentStream;
  let stopLoop = () => {};
  const scannerModal = document.getElementById('scannerModal');
  const preview = document.getElementById('preview');
  const cameraSelect = document.getElementById('cameraSelect');
  const scanMode = document.getElementById('scanMode');
  const scanFrameEl = document.querySelector('.scan-frame');
  const engineLabel = document.getElementById('engineLabel');
  const hintLabel = document.getElementById('hintLabel');

  preview.setAttribute('autoplay','');
  preview.setAttribute('playsinline','');
  preview.muted = true;

  const nativeFormats = {
    auto: ['qr_code','ean_13','code_128','code_39','upc_a','upc_e','ean_8','itf'],
    qr:   ['qr_code'],
    bar:  ['ean_13','code_128','code_39','upc_a','upc_e','ean_8','itf']
  };
  const zxingFormats = {
    auto: ['QR_CODE','EAN_13','CODE_128','CODE_39','UPC_A','UPC_E','EAN_8','ITF'],
    qr:   ['QR_CODE'],
    bar:  ['EAN_13','CODE_128','CODE_39','UPC_A','UPC_E','EAN_8','ITF']
  };

  function ZXING_List(formats){
    if (!window.ZXing) return [];
    const out = [];
    const F = window.ZXing.BarcodeFormat;
    formats.forEach(f => { if (F[f]) out.push(F[f]); });
    return out;
  }

  function applyOverlayClass(){
    if (!scanFrameEl) return;
    scanFrameEl.classList.remove('auto','qr','bar');
    const m = scanMode?.value || 'auto';
    scanFrameEl.classList.add(m);
    if (hintLabel) {
      hintLabel.textContent = m === 'qr'
        ? 'Modo QR: centra el QR y acércalo para que llene el recuadro.'
        : m === 'bar'
          ? 'Modo barras: alinea el código horizontalmente dentro del recuadro.'
          : 'Modo auto: coloca el código dentro del recuadro y acércalo un poco más.';
    }
  }

  async function enumerateCamerasWithPermission() {
    const test = await navigator.mediaDevices.getUserMedia({ video: true });
    test.getTracks().forEach(t => t.stop());
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videos = devices.filter(d => d.kind === 'videoinput');
    cameraSelect.innerHTML = '';
    videos.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `Cámara ${i+1}`;
      cameraSelect.appendChild(opt);
    });
    const back = videos.find(d => /back|rear|environment/i.test(d.label));
    selectedDeviceId = back ? back.deviceId : (videos[videos.length - 1]?.deviceId);
    if (selectedDeviceId) cameraSelect.value = selectedDeviceId;
  }

  function getConstraints() {
    const base = selectedDeviceId
      ? { deviceId: { exact: selectedDeviceId } }
      : { facingMode: { ideal: 'environment' } };
    return {
      video: {
        ...base,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        advanced: [{ focusMode: 'continuous' }]
      }
    };
  }

  async function openStream() {
    if (currentStream) {
      try { currentStream.getTracks().forEach(t => t.stop()); } catch {}
      currentStream = null;
    }
    currentStream = await navigator.mediaDevices.getUserMedia(getConstraints());
    preview.srcObject = currentStream;
    try {
      const track = currentStream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() || {};
      const adj = {};
      if (caps.focusMode?.includes?.('continuous')) adj.focusMode = 'continuous';
      if (Object.keys(adj).length) await track.applyConstraints({ advanced: [adj] });
    } catch {}
    await preview.play().catch(()=>{});
    await new Promise(r => setTimeout(r, 300));
  }

  function getRoiRect() {
    const vw = preview.videoWidth || 1280;
    const vh = preview.videoHeight || 720;
    const mode = scanMode?.value || 'auto';
    if (mode === 'qr') {
      const size = Math.floor(Math.min(vw, vh) * 0.6);
      const rx = Math.floor((vw - size)/2);
      const ry = Math.floor((vh - size)/2);
      return { rx, ry, rw: size, rh: size };
    }
    if (mode === 'bar') {
      const rw = Math.floor(vw * 0.82);
      const rh = Math.floor(vh * 0.28);
      const rx = Math.floor((vw - rw)/2);
      const ry = Math.floor((vh - rh)/2);
      return { rx, ry, rw, rh };
    }
    const rw = Math.floor(vw * 0.70);
    const rh = Math.floor(vh * 0.40);
    const rx = Math.floor((vw - rw)/2);
    const ry = Math.floor((vh - rh)/2);
    return { rx, ry, rw, rh };
  }

  async function startNativeLoopROI() {
    if (engineLabel) engineLabel.textContent = 'Motor: BarcodeDetector';
    const fmts = nativeFormats[scanMode?.value] || nativeFormats.auto;
    const detector = new window.BarcodeDetector({ formats: fmts });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let attempts = 0;
    let stopped = false;
    stopLoop = () => { stopped = true; };

    async function tick(){
      if (stopped) return;
      const vw = preview.videoWidth, vh = preview.videoHeight;
      if (vw && vh) {
        const {rx, ry, rw, rh} = getRoiRect();
        for (const scale of [2, 3]) {
          canvas.width = rw * scale; canvas.height = rh * scale;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(preview, rx, ry, rw, rh, 0, 0, rw*scale, rh*scale);
          try {
            const codes = await detector.detect(canvas);
            if (codes && codes.length) {
              handleScannedCode(codes[0].rawValue);
              stopScanner();
              return;
            }
          } catch {}
        }
      }
      attempts++;
      if (attempts > 60) { // ~1-2s, fallback a ZXing
        await startZXingLoopROI();
        return;
      }
      requestAnimationFrame(tick);
    }
    tick();
  }

  async function startZXingLoopROI() {
    if (engineLabel) engineLabel.textContent = 'Motor: ZXing';
    if (!window.ZXing) return;
    const hints = new Map();
    const DT = window.ZXing.DecodeHintType;
    hints.set(DT.POSSIBLE_FORMATS, ZXING_List(zxingFormats[scanMode?.value] || zxingFormats.auto));
    hints.set(DT.TRY_HARDER, true);

    if (codeReader) { try { codeReader.reset(); } catch {} }
    codeReader = new window.ZXing.BrowserMultiFormatReader(hints);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let stopped = false;
    stopLoop = () => { stopped = true; try { codeReader.reset(); } catch {} };

    async function tick(){
      if (stopped) return;
      const vw = preview.videoWidth, vh = preview.videoHeight;
      if (vw && vh) {
        const {rx, ry, rw, rh} = getRoiRect();
        for (const scale of [3, 2, 1]) {
          canvas.width = rw * scale; canvas.height = rh * scale;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(preview, rx, ry, rw, rh, 0, 0, rw*scale, rh*scale);
          try {
            const result = await codeReader.decodeFromCanvas(canvas);
            if (result?.getText) {
              handleScannedCode(result.getText());
              stopScanner();
              return;
            }
          } catch {
            // NotFound: seguir
          }
        }
      }
      setTimeout(tick, 70);
    }
    tick();
  }

  async function startScanner() {
    scannerModal.classList.remove('hidden');
    scannerModal.setAttribute('aria-hidden','false');
    applyOverlayClass();
    try {
      await enumerateCamerasWithPermission();
      await openStream();
      if ('BarcodeDetector' in window) {
        await startNativeLoopROI();
      } else {
        await startZXingLoopROI();
      }
    } catch (e) {
      console.error('No se pudo iniciar el escáner:', e);
      alert('No se pudo acceder a la cámara. Revisa permisos o si otra app la está usando.');
      stopScanner();
    }
  }

  async function restartScanner(){
    stopOnlyLoops();
    applyOverlayClass();
    await openStream();
    if ('BarcodeDetector' in window) {
      await startNativeLoopROI();
    } else {
      await startZXingLoopROI();
    }
  }

  function stopOnlyLoops(){
    try { stopLoop(); } catch {}
    if (codeReader) { try { codeReader.reset(); } catch {} codeReader = null; }
  }

  function stopScanner() {
    stopOnlyLoops();
    if (currentStream) {
      try { currentStream.getTracks().forEach(t => t.stop()); } catch {}
      currentStream = null;
    }
    scannerModal.classList.add('hidden');
    scannerModal.setAttribute('aria-hidden','true');
  }

  cameraSelect?.addEventListener('change', restartScanner);
  scanMode?.addEventListener('change', restartScanner);
  document.getElementById('openScanner').addEventListener('click', startScanner);
  document.getElementById('closeScanner').addEventListener('click', stopScanner);

  async function handleScannedCode(code){
    try {
      const res = await fetch(`/api/products?sku=${encodeURIComponent(code)}`);
      const list = await res.json();
      if (list.length) {
        const p = list[0];
        alert(`Producto encontrado: ${p.name}\nCaduca en ${daysUntil(p.expiry)} días`);
      } else {
        openProductModal({ sku: code });
      }
    } catch(e){
      console.error(e);
    }
  }

  // -------- Alta de producto
  const productModal = document.getElementById('productModal');
  const productForm = document.getElementById('productForm');
  document.getElementById('newProduct').addEventListener('click', () => openProductModal());
  document.getElementById('cancelProduct').addEventListener('click', () => { productModal.classList.add('hidden'); });

  function openProductModal(prefill={} as any){
    productModal.classList.remove('hidden');
    for(const k of ['name','sku','lot','expiry','qty']){
      if(prefill[k] !== undefined) productForm.elements[k].value = prefill[k];
      else if(k === 'qty') productForm.elements[k].value = 1;
      else productForm.elements[k].value = '';
    }
  }

  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(productForm);
    const body = {
      name: form.get('name'),
      sku: form.get('sku'),
      lot: form.get('lot'),
      expiry: form.get('expiry'),
      qty: Number(form.get('qty'))
    };
    await fetch('/api/products', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    productModal.classList.add('hidden');
    await loadProducts();
  });

  try {
    const s = await fetch('/api/session');
    if (s.ok){
      const user = await s.json();
      welcomeEl.textContent = `Bienvenido ${user.username}`;
    }
  } catch(e){}

  await loadProducts();
}();