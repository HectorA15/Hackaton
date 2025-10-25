// App State
const state = {
    token: localStorage.getItem('token'),
    user: null,
    currentTab: 'scan'
};

const API_BASE = '/api';

// Utility Functions
async function apiRequest(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        logout();
        return;
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data;
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    document.getElementById(screenId).style.display = 'block';
}

function showTab(tabName) {
    state.currentTab = tabName;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Load data for the tab
    loadTabData(tabName);
}

function showAdminElements() {
    if (state.user && (state.user.role === 'admin' || state.user.role === 'manager')) {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = '';
        });
    }
}

// Authentication
async function login(username, password) {
    try {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        state.token = data.token;
        state.user = data.user;
        localStorage.setItem('token', data.token);

        showMainApp();
    } catch (error) {
        throw error;
    }
}

function logout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('token');
    showScreen('login-screen');
}

function showMainApp() {
    document.getElementById('user-name').textContent = state.user.username;
    showAdminElements();
    showScreen('main-screen');
    showTab('scan');
}

// Tab Data Loading
async function loadTabData(tabName) {
    switch(tabName) {
        case 'inventory':
            await loadInventory();
            break;
        case 'batches':
            await loadBatches();
            break;
        case 'products':
            await loadProducts();
            break;
        case 'audit':
            await loadAuditLogs();
            break;
    }
}

// Inventory Functions
async function loadInventory(status = '') {
    const listEl = document.getElementById('inventory-list');
    listEl.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const query = status ? `?status=${status}` : '';
        const items = await apiRequest(`/inventory${query}`);

        if (items.length === 0) {
            listEl.innerHTML = '<p>No inventory items found.</p>';
            return;
        }

        listEl.innerHTML = items.map(item => `
            <div class="list-item ${item.is_expired ? 'expired' : ''} ${item.priority_level >= 2 ? 'priority-high' : ''}">
                <h3>${item.product_name}</h3>
                <p><strong>GTIN:</strong> ${item.gtin || 'N/A'}</p>
                <p><strong>Batch:</strong> ${item.batch_number}</p>
                <p><strong>Expiry Date:</strong> ${item.expiry_date}</p>
                <p><strong>Location:</strong> ${item.location || 'N/A'}</p>
                <p><strong>Barcode:</strong> ${item.barcode || 'N/A'}</p>
                <span class="status ${item.status}">${item.status}</span>
                ${item.is_expired ? '<span class="status expired">EXPIRED</span>' : ''}
            </div>
        `).join('');
    } catch (error) {
        listEl.innerHTML = `<p class="error">Failed to load inventory: ${error.message}</p>`;
    }
}

// Batches Functions
async function loadBatches() {
    const listEl = document.getElementById('batches-list');
    listEl.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const batches = await apiRequest('/batches');

        if (batches.length === 0) {
            listEl.innerHTML = '<p>No batches found.</p>';
            return;
        }

        listEl.innerHTML = batches.map(batch => `
            <div class="list-item ${batch.is_expired ? 'expired' : ''} ${batch.priority_level >= 2 ? 'priority-high' : ''}">
                <h3>${batch.product_name}</h3>
                <p><strong>Batch Number:</strong> ${batch.batch_number}</p>
                <p><strong>Expiry Date:</strong> ${batch.expiry_date}</p>
                <p><strong>Manufacturing Date:</strong> ${batch.manufacturing_date || 'N/A'}</p>
                <p><strong>Quantity:</strong> ${batch.quantity || 0}</p>
                <p><strong>Items in Stock:</strong> ${batch.item_count || 0}</p>
                <p><strong>Priority Level:</strong> ${batch.priority_level}</p>
                ${batch.is_expired ? '<span class="status expired">EXPIRED</span>' : ''}
            </div>
        `).join('');
    } catch (error) {
        listEl.innerHTML = `<p class="error">Failed to load batches: ${error.message}</p>`;
    }
}

// Products Functions
async function loadProducts() {
    const listEl = document.getElementById('products-list');
    listEl.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const products = await apiRequest('/products');

        if (products.length === 0) {
            listEl.innerHTML = '<p>No products found.</p>';
            return;
        }

        listEl.innerHTML = products.map(product => `
            <div class="list-item">
                <h3>${product.name}</h3>
                <p><strong>GTIN:</strong> ${product.gtin || 'N/A'}</p>
                <p><strong>Manufacturer:</strong> ${product.manufacturer || 'N/A'}</p>
                <p><strong>Category:</strong> ${product.category || 'N/A'}</p>
                <p>${product.description || ''}</p>
            </div>
        `).join('');
    } catch (error) {
        listEl.innerHTML = `<p class="error">Failed to load products: ${error.message}</p>`;
    }
}

// Audit Logs Functions
async function loadAuditLogs() {
    const listEl = document.getElementById('audit-list');
    listEl.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const logs = await apiRequest('/audit');

        if (logs.length === 0) {
            listEl.innerHTML = '<p>No audit logs found.</p>';
            return;
        }

        listEl.innerHTML = logs.map(log => `
            <div class="list-item">
                <p><strong>Action:</strong> ${log.action}</p>
                <p><strong>User:</strong> ${log.username || 'System'}</p>
                <p><strong>Entity:</strong> ${log.entity_type} (ID: ${log.entity_id || 'N/A'})</p>
                <p><strong>Date:</strong> ${new Date(log.created_at).toLocaleString()}</p>
                <p><strong>IP:</strong> ${log.ip_address || 'N/A'}</p>
            </div>
        `).join('');
    } catch (error) {
        listEl.innerHTML = `<p class="error">Failed to load audit logs: ${error.message}</p>`;
    }
}

// Product Lookup
async function lookupProduct(gtin) {
    const resultEl = document.getElementById('lookup-result');
    resultEl.innerHTML = '<div class="loading">Looking up product...</div>';

    try {
        const data = await apiRequest(`/products/lookup/${gtin}`);
        
        resultEl.innerHTML = `
            <div class="list-item">
                <h3>${data.product.name}</h3>
                <p><strong>Source:</strong> ${data.source}</p>
                <p><strong>GTIN:</strong> ${data.product.gtin || 'N/A'}</p>
                <p><strong>Manufacturer:</strong> ${data.product.manufacturer || 'N/A'}</p>
                <p><strong>Category:</strong> ${data.product.category || 'N/A'}</p>
                <p>${data.product.description || ''}</p>
            </div>
        `;

        await loadProducts();
    } catch (error) {
        resultEl.innerHTML = `<p class="error">Product not found: ${error.message}</p>`;
    }
}

// Scan Item
async function scanItem(formData) {
    try {
        const data = await apiRequest('/inventory/scan', {
            method: 'POST',
            body: JSON.stringify(formData)
        });

        alert('Item added to inventory successfully!');
        document.getElementById('scan-form').reset();
        
        if (state.currentTab === 'inventory') {
            await loadInventory();
        }
    } catch (error) {
        throw error;
    }
}

// Export CSV
async function exportInventory() {
    try {
        const status = document.getElementById('filter-status').value;
        const query = status ? `?status=${status}` : '';
        
        window.location.href = `${API_BASE}/export/inventory${query}`;
    } catch (error) {
        alert('Failed to export: ' + error.message);
    }
}

// Update Expired Batches
async function updateExpiredBatches() {
    try {
        const data = await apiRequest('/batches/update-expired', {
            method: 'POST'
        });

        alert(`Updated ${data.updated} expired batches`);
        await loadBatches();
    } catch (error) {
        alert('Failed to update: ' + error.message);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Login Form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorEl = document.getElementById('login-error');

        try {
            await login(username, password);
        } catch (error) {
            errorEl.textContent = error.message;
        }
    });

    // Logout Button
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Tab Buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showTab(btn.dataset.tab);
        });
    });

    // Scan Form
    document.getElementById('scan-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            barcode: document.getElementById('scan-barcode').value,
            qr_code: document.getElementById('scan-qr').value,
            batch_id: parseInt(document.getElementById('scan-batch').value),
            location: document.getElementById('scan-location').value,
            notes: document.getElementById('scan-notes').value
        };

        try {
            await scanItem(formData);
        } catch (error) {
            alert('Failed to scan item: ' + error.message);
        }
    });

    // Filter Status
    document.getElementById('filter-status').addEventListener('change', (e) => {
        loadInventory(e.target.value);
    });

    // Export CSV
    document.getElementById('export-csv').addEventListener('click', exportInventory);

    // Lookup Product
    document.getElementById('lookup-btn').addEventListener('click', () => {
        const gtin = document.getElementById('lookup-gtin').value;
        if (gtin) {
            lookupProduct(gtin);
        }
    });

    // Update Expired Batches
    document.getElementById('update-expired-btn').addEventListener('click', updateExpiredBatches);

    // Check if already logged in
    if (state.token) {
        apiRequest('/auth/me')
            .then(user => {
                state.user = user;
                showMainApp();
            })
            .catch(() => {
                logout();
            });
    } else {
        showScreen('login-screen');
    }
});
