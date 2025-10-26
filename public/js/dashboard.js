// dashboard.js - carga productos, muestra tabla, abre scanner con ZXing y agrega producto detectado
(async function(){
  const api = '/api/products';
  const welcomeEl = document.getElementById('welcome');
  const tableBody = document.querySelector('#productsTable tbody');
  const summary = document.getElementById('summary');

  // Funciones util
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

  // event delegation for actions
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
      // simple alert, puedes crear modal con más info
      const r = await fetch(`/api/products/${id}`);
      const p = await r.json();
      alert(`Nombre: ${p.name}\nSKU: ${p.sku}\nLote: ${p.lot}\nCaducidad: ${p.expiry}\nCantidad: ${p.qty}`);
    }
  });

  // scanner modal logic using ZXing Browser
  let codeReader;
  let selectedDeviceId;
  const scannerModal = document.getElementById('scannerModal');
  const preview = document.getElementById('preview');
  document.getElementById('openScanner').addEventListener('click', async () => {
    scannerModal.classList.remove('hidden');
    scannerModal.setAttribute('aria-hidden','false');

    // use ZXing's BrowserMultiFormatReader
    codeReader = new ZXing.BrowserMultiFormatReader();
    try {
      const devices = await ZXing.BrowserCodeReader.listVideoInputDevices();
      selectedDeviceId = devices.length ? devices[0].deviceId : undefined;
      await codeReader.decodeFromVideoDevice(selectedDeviceId, preview, (result, err) => {
        if (result) {
          // resultado leído
          const text = result.getText();
          // si quieres buscar producto por sku o crear nuevo:
          handleScannedCode(text);
          // stop
          codeReader.reset();
          scannerModal.classList.add('hidden');
          scannerModal.setAttribute('aria-hidden','true');
        }
        if (err && !(err.name === 'NotFoundException')) {
          console.error(err);
        }
      });
    } catch(err){
      console.error('Error cámara:', err);
      alert('No se pudo acceder a la cámara. Revisa permisos.');
      scannerModal.classList.add('hidden');
    }
  });

  document.getElementById('closeScanner').addEventListener('click', () => {
    if (codeReader) codeReader.reset();
    scannerModal.classList.add('hidden');
  });

  async function handleScannedCode(code){
    // ejemplo: buscar producto por sku
    try {
      const res = await fetch(`/api/products?sku=${encodeURIComponent(code)}`);
      const list = await res.json();
      if (list.length) {
        const p = list[0];
        alert(`Producto encontrado: ${p.name}\nCaduca en ${daysUntil(p.expiry)} días`);
      } else {
        // si no existe, abrir modal de nuevo producto con sku autocompletado
        openProductModal({ sku: code });
      }
    } catch(e){
      console.error(e);
    }
  }

  // nuevo producto modal
  const productModal = document.getElementById('productModal');
  const productForm = document.getElementById('productForm');
  document.getElementById('newProduct').addEventListener('click', () => openProductModal());
  document.getElementById('cancelProduct').addEventListener('click', () => {
    productModal.classList.add('hidden');
  });

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

  // inicializar
  // poner nombre de usuario si lo provee el HTML en alguna variable o por fetch a /session
  // simple: pedir al servidor la página con sesión (tu servidor ya pone req.session.user)
  try {
    // Pedir al servidor quién está en sesión
    const s = await fetch('/api/session');
    if (s.ok){
      const user = await s.json();
      welcomeEl.textContent = `Bienvenido ${user.username}`;
    }
  } catch(e){/*ignorar*/}

  await loadProducts();

})();