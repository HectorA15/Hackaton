window.addEventListener('DOMContentLoaded', () => {
  const api = '/api/products';
  const welcomeEl = document.getElementById('welcome');
  const tableBody = document.querySelector('#productsTable tbody');
  const summary = document.getElementById('summary');

  function daysUntil(dateStr){
    const today = new Date();
    const d = new Date(dateStr + 'T23:59:59');
    return Math.ceil((d - today) / 86400000);
  }

  function renderProducts(list){
    if (!tableBody || !summary) return;
    tableBody.innerHTML = '';
    if (!list.length) {
      tableBody.innerHTML = '<tr><td colspan="6" style="color:var(--muted)">No hay productos</td></tr>';
      summary.textContent = 'No hay productos registrados.';
      return;
    }
    let expSoon = 0;
    for (const p of list){
      const days = daysUntil(p.expiry);
      const badgeClass = days <= 7 ? 'badge warn' : 'badge ok';
      if (days <= 7) expSoon++;
      const lotHtml = p.lot ? `<br><small>Lote: ${p.lot}</small>` : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.name}</td>
        <td>${p.sku || ''} ${lotHtml}</td>
        <td>${p.expiry}</td>
        <td><span class="${badgeClass}">${days} días</span></td>
        <td>${p.qty ?? 0}</td>
        <td>
          <button class="btn btn-small" data-id="${p.id}" data-action="view">Ver</button>
          <button class="btn btn-small" data-id="${p.id}" data-action="del">Eliminar</button>
        </td>`;
      tableBody.appendChild(tr);
    }
    summary.textContent = `${list.length} productos. ${expSoon ? expSoon + ' próximos a caducar.' : 'Sin caducidades próximas.'}`;
  }

  async function loadProducts(){
    try{
      const res = await fetch(api);
      renderProducts(await res.json());
    }catch(err){
      console.error(err);
      if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" style="color:#c0392b">Error cargando productos</td></tr>';
    }
  }

  // Delegación de eventos: Ver / Eliminar
  tableBody?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === 'view') {
      try {
        const r = await fetch(`/api/products/${id}`);
        if (!r.ok) return alert('No se pudo cargar el producto.');
        const p = await r.json();
        alert(`Nombre: ${p.name}\nSKU: ${p.sku || ''}\nLote: ${p.lot || ''}\nCaducidad: ${p.expiry}\nCantidad: ${p.qty ?? 0}`);
      } catch (err) { console.error(err); }
    } else if (action === 'del') {
      if (!confirm('¿Eliminar producto?')) return;
      await fetch(`/api/products/${id}`, { method:'DELETE' });
      await loadProducts();
    }
  });

  // ---------- Scanner (prioriza ZXing streaming; si no, BarcodeDetector ROI)
  let codeReader, currentStream, stopLoop = () => {};
  const scannerModal = document.getElementById('scannerModal');
  const preview = document.getElementById('preview');
  const scanFrame = document.getElementById('scanFrame') || document.querySelector('.scan-frame');
  const cameraSelect = document.getElementById('cameraSelect');
  const scanMode = document.getElementById('scanMode');
  const engineLabel = document.getElementById('engineLabel');
  const hintLabel = document.getElementById('hintLabel');

  function applyOverlayClass(){
    if (!scanFrame || !scanMode || !hintLabel) return;
    scanFrame.classList.remove('auto','qr','bar');
    const m = scanMode.value || 'auto';
    scanFrame.classList.add(m);
    hintLabel.textContent = m === 'qr'
      ? 'Modo QR: centra el QR y acércalo hasta llenar el recuadro.'
      : m === 'bar'
        ? 'Modo barras: alinea el código horizontal dentro del recuadro.'
        : 'Modo auto: coloca el código dentro del recuadro.';
  }

  async function enumerateCamerasWithPermission() {
    const t = await navigator.mediaDevices.getUserMedia({ video: true });
    t.getTracks().forEach(x=>x.stop());
    const devs = await navigator.mediaDevices.enumerateDevices();
    const vids = devs.filter(d => d.kind === 'videoinput');
    if (!cameraSelect) return;
    cameraSelect.innerHTML = '';
    vids.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `Cámara ${i+1}`;
      cameraSelect.appendChild(opt);
    });
    const back = vids.find(d => /back|rear|environment/i.test(d.label));
    cameraSelect.value = back ? back.deviceId : vids.at(-1)?.deviceId || '';
  }

  function getFormatsFor(mode){
    return {
      auto: ['QR_CODE','EAN_13','CODE_128','CODE_39','UPC_A','UPC_E','EAN_8','ITF'],
      qr:   ['QR_CODE'],
      bar:  ['EAN_13','CODE_128','CODE_39','UPC_A','UPC_E','EAN_8','ITF']
    }[mode] || ['QR_CODE','EAN_13','CODE_128','CODE_39','UPC_A','UPC_E','EAN_8','ITF'];
  }

  async function startZXingStreaming(){
    if (!window.ZXing) throw new Error('ZXing no cargado');
    if (engineLabel) engineLabel.textContent = 'Motor: ZXing (streaming)';
    const Hints = new Map();
    const DT = window.ZXing.DecodeHintType;
    const BF = window.ZXing.BarcodeFormat;
    const fmts = getFormatsFor(scanMode?.value || 'auto').map(f => BF[f]).filter(Boolean);
    Hints.set(DT.POSSIBLE_FORMATS, fmts);
    Hints.set(DT.TRY_HARDER, true);

    if (codeReader) { try { codeReader.reset(); } catch {} }
    codeReader = new window.ZXing.BrowserMultiFormatReader(Hints);

    const deviceId = cameraSelect?.value || undefined;
    await codeReader.decodeFromVideoDevice(deviceId, preview, (result, err) => {
      if (preview && preview.paused) preview.play().catch(()=>{});
      if (result && result.getText) {
        const text = result.getText();
        console.log('SCAN (zxing-stream):', text);
        handleScannedCode(text);
        stopScanner();
      }
    });
  }

  function getRoiRect() {
    if (!preview) return { rx:0, ry:0, rw:0, rh:0 };
    const vw = preview.videoWidth || 1280;
    const vh = preview.videoHeight || 720;
    const mode = scanMode?.value || 'auto';
    if (mode === 'qr') {
      const size = Math.floor(Math.min(vw, vh) * 0.75);
      return { rx: (vw-size)/2|0, ry: (vh-size)/2|0, rw: size, rh: size };
    }
    if (mode === 'bar') {
      const rw = Math.floor(vw * 0.88);
      const rh = Math.floor(vh * 0.26);
      return { rx: (vw-rw)/2|0, ry: (vh-rh)/2|0, rw, rh };
    }
    const rw = Math.floor(vw * 0.75);
    const rh = Math.floor(vh * 0.42);
    return { rx: (vw-rw)/2|0, ry: (vh-rh)/2|0, rw, rh };
  }

  async function startNativeLoopROI() {
    if (!('BarcodeDetector' in window)) throw new Error('Sin BarcodeDetector');
    if (engineLabel) engineLabel.textContent = 'Motor: BarcodeDetector (ROI)';
    const map = { auto:['qr_code','ean_13','code_128','code_39','upc_a','upc_e','ean_8','itf'], qr:['qr_code'], bar:['ean_13','code_128','code_39','upc_a','upc_e','ean_8','itf'] };
    const detector = new window.BarcodeDetector({ formats: map[scanMode?.value] || map.auto });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let stopped = false;
    stopLoop = () => { stopped = true; };

    async function tick(){
      if (stopped) return;
      const vw = preview?.videoWidth, vh = preview?.videoHeight;
      if (vw && vh) {
        const {rx, ry, rw, rh} = getRoiRect();
        for (const scale of [3, 2]) {
          canvas.width = rw * scale; canvas.height = rh * scale;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(preview, rx, ry, rw, rh, 0, 0, rw*scale, rh*scale);
          try {
            const codes = await detector.detect(canvas);
            if (codes && codes.length) {
              const text = codes[0].rawValue;
              console.log('SCAN (native-ROI):', text);
              handleScannedCode(text);
              stopScanner();
              return;
            }
          } catch {}
        }
      }
      requestAnimationFrame(tick);
    }
    tick();
  }

  async function startScanner() {
    if (!scannerModal) return;
    scannerModal.classList.remove('hidden');
    scannerModal.setAttribute('aria-hidden','false');
    applyOverlayClass();
    try {
      await enumerateCamerasWithPermission();
      try {
        await startZXingStreaming();
      } catch (e) {
        console.warn('ZXing streaming no disponible, usando BarcodeDetector ROI:', e);
        await openBasicStream();
        await startNativeLoopROI();
      }
    } catch (e) {
      console.error('No se pudo iniciar el escáner:', e);
      alert('No se pudo acceder a la cámara. Revisa permisos o si otra app la está usando.');
      stopScanner();
    }
  }

  async function openBasicStream(){
    const constraints = cameraSelect?.value ? { video: { deviceId: { exact: cameraSelect.value } } }
                                           : { video: { facingMode: { ideal: 'environment' } } };
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    preview.srcObject = currentStream;
    await preview.play().catch(()=>{});
    await new Promise(r => setTimeout(r, 200));
  }

  async function restartScanner(){
    stopOnlyLoops();
    applyOverlayClass();
    try {
      await startZXingStreaming();
    } catch (e) {
      console.warn('ZXing streaming no disponible en restart, ROI nativo:', e);
      await openBasicStream();
      await startNativeLoopROI();
    }
  }

  function stopOnlyLoops(){
    try { stopLoop(); } catch {}
    if (codeReader) { try { codeReader.reset(); } catch {} codeReader = null; }
  }

  function stopScanner() {
    stopOnlyLoops();
    if (currentStream) { try { currentStream.getTracks().forEach(t => t.stop()); } catch {} currentStream = null; }
    if (!scannerModal) return;
    scannerModal.classList.add('hidden');
    scannerModal.setAttribute('aria-hidden','true');
  }

  cameraSelect?.addEventListener('change', restartScanner);
  scanMode?.addEventListener('change', restartScanner);
  document.getElementById('openScanner')?.addEventListener('click', startScanner);
  document.getElementById('closeScanner')?.addEventListener('click', stopScanner);

  // -------- Modal de producto (creación on-demand si no existe)
  let productModal = document.getElementById('productModal');
  let productForm = document.getElementById('productForm');

  function ensureProductModal(){
    productModal = document.getElementById('productModal');
    productForm = document.getElementById('productForm');
    if (!productModal) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
      <div id="productModal" class="modal hidden" aria-hidden="true">
        <div class="box">
          <h3>Nuevo producto</h3>
          <form id="productForm">
            <div class="form-grid">
              <label>Nombre
                <input type="text" name="name" required />
              </label>
              <label>SKU
                <input type="text" name="sku" />
              </label>
              <label>Lote
                <input type="text" name="lot" />
              </label>
              <label>Caducidad
                <input type="date" name="expiry" required />
              </label>
              <label>Cantidad
                <input type="number" name="qty" min="0" step="1" value="1" required />
              </label>
            </div>
            <div class="actions">
              <button type="button" id="cancelProduct" class="btn">Cancelar</button>
              <button type="submit" class="btn btn-primary">Guardar</button>
            </div>
          </form>
        </div>
      </div>`;
      document.body.appendChild(wrapper.firstElementChild);
      productModal = document.getElementById('productModal');
      productForm = document.getElementById('productForm');
    }
    const cancelBtn = document.getElementById('cancelProduct');
    if (cancelBtn && !cancelBtn.dataset.bound) {
      cancelBtn.addEventListener('click', () => { productModal.classList.add('hidden'); });
      cancelBtn.dataset.bound = '1';
    }
    if (productForm && !productForm.dataset.bound) {
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
      productForm.dataset.bound = '1';
    }
  }

  document.getElementById('newProduct')?.addEventListener('click', () => { ensureProductModal(); openProductModal(); });

  function openProductModal(prefill){
    ensureProductModal();
    if (!productModal || !productForm) return;
    productModal.classList.remove('hidden');
    const fields = ['name','sku','lot','expiry','qty'];
    for (const k of fields){
      if (prefill && prefill[k] !== undefined) productForm.elements[k].value = prefill[k];
      else if (k === 'qty') productForm.elements[k].value = 1;
      else productForm.elements[k].value = '';
    }
  }

  // Manejo de código escaneado
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
    } catch(e){ console.error(e); }
  }

  (async () => {
    try {
      const s = await fetch('/api/session');
      if (s.ok){
        const user = await s.json();
        if (welcomeEl) welcomeEl.textContent = `Bienvenido ${user.username}`;
      }
    } catch(e){}
    await loadProducts();
  })();
});