(async function(){
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

  tableBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if(!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if(action === 'del'){
      if(!confirm('Eliminar producto?')) return;
      await fetch(`/api/products/${id}`, { method:'DELETE' });
      await loadProducts();
    } else if(action === 'view'){
      const r = await fetch(`/api/products/${id}`);
      const p = await r.json();
      alert(`Nombre: ${p.name}\nSKU: ${p.sku}\nLote: ${p.lot}\nCaducidad: ${p.expiry}\nCantidad: ${p.qty}`);
    }
  });

  let codeReader;
  let selectedDeviceId;
  let currentStream;
  const scannerModal = document.getElementById('scannerModal');
  const preview = document.getElementById('preview');
  const cameraSelect = document.getElementById('cameraSelect');

  preview.setAttribute('autoplay','');
  preview.setAttribute('playsinline','');
  preview.muted = true;

  async function enumerateCameras() {
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

  cameraSelect?.addEventListener('change', async () => {
    selectedDeviceId = cameraSelect.value;
    await restartScanner();
  });

  async function startScanner() {
    scannerModal.classList.remove('hidden');
    scannerModal.setAttribute('aria-hidden','false');
    await enumerateCameras();

    try {
      if (window.ZXing) {
        codeReader = new ZXing.BrowserMultiFormatReader();
        await codeReader.decodeFromVideoDevice(selectedDeviceId, preview, (result, err) => {
          if (preview.paused) { preview.play().catch(()=>{}); }
          if (result) {
            const text = result.getText();
            handleScannedCode(text);
            stopScanner();
          }
        });
        preview.addEventListener('canplay', () => {
          if (preview.paused) { preview.play().catch(()=>{}); }
        }, { once:true });
        return;
      }
    } catch (err) {
      console.error('ZXing error:', err);
    }

    await startGetUserMedia();
  }

  async function startGetUserMedia() {
    try {
      const constraints = selectedDeviceId
        ? { video: { deviceId: { exact: selectedDeviceId } } }
        : { video: { facingMode: { ideal: 'environment' } } };
      currentStream = await navigator.mediaDevices.getUserMedia(constraints);
      preview.srcObject = currentStream;
      await preview.play().catch(()=>{});
    } catch (err) {
      console.error('getUserMedia error:', err);
      alert('No se pudo acceder a la cámara. Revisa permisos del navegador/Windows o si otra app la está usando.');
      stopScanner();
    }
  }

  async function restartScanner(){
    if (codeReader) { try { codeReader.reset(); } catch {} codeReader = null; }
    if (currentStream) { try { currentStream.getTracks().forEach(t => t.stop()); } catch {} currentStream = null; }

    if (window.ZXing) {
      codeReader = new ZXing.BrowserMultiFormatReader();
      await codeReader.decodeFromVideoDevice(selectedDeviceId, preview, (result, err) => {
        if (preview.paused) { preview.play().catch(()=>{}); }
        if (result) {
          const text = result.getText();
          handleScannedCode(text);
          stopScanner();
        }
      });
    } else {
      await startGetUserMedia();
    }
  }

  function stopScanner() {
    if (codeReader) {
      try { codeReader.reset(); } catch {}
      codeReader = null;
    }
    if (currentStream) {
      try { currentStream.getTracks().forEach(t => t.stop()); } catch {}
      currentStream = null;
    }
    scannerModal.classList.add('hidden');
    scannerModal.setAttribute('aria-hidden','true');
  }

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

  const productModal = document.getElementById('productModal');
  const productForm = document.getElementById('productForm');
  document.getElementById('newProduct').addEventListener('click', () => openProductModal());
  document.getElementById('cancelProduct').addEventListener('click', () => { productModal.classList.add('hidden'); });

  function openProductModal(prefill={}){
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
})();