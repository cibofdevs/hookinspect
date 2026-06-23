const ENDPOINT_ID = location.pathname.split('/')[2];
const WEBHOOK_URL = `${location.origin}/r/${ENDPOINT_ID}`;
const STORAGE_KEY = `wh_requests_${ENDPOINT_ID}`;

if (!ENDPOINT_ID) location.href = '/';

let currentRequest = null;
let allRequests = [];

const isMobile = () => window.innerWidth <= 640;

// Set webhook URL display and curl example
document.getElementById('webhook-url').textContent = WEBHOOK_URL;
document.getElementById('curl-example').textContent =
    `curl -X POST ${WEBHOOK_URL} \\\n  -H "Content-Type: application/json" \\\n  -d '{"hello":"world"}'`;

// New URL button
document.getElementById('new-url-btn').addEventListener('click', async () => {
    const res = await fetch('/api/new', { method: 'POST' });
    if (!res.ok) return;
    const { id } = await res.json();
    window.location.href = `/view/${id}`;
});

// ===== MOBILE NAVIGATION =====

function backToList() {
    document.getElementById('sidebar').classList.remove('mobile-hidden');
    document.getElementById('detail').classList.remove('mobile-active');
    currentRequest = null;
}

// ===== BADGE HELPERS =====

function createBadgeClass(method) {
    return 'badge badge-' + (method || '').toLowerCase();
}

function timeAgo(iso) {
    if (!iso) return '';
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60) return diff + 's';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    return Math.floor(diff / 86400) + 'd';
}

function shortCt(ct) {
    if (!ct) return '';
    if (ct.includes('json')) return 'JSON';
    if (ct.includes('xml')) return 'XML';
    if (ct.includes('form')) return 'Form';
    if (ct.includes('text/plain')) return 'Text';
    if (ct.includes('text/')) return 'Text';
    const part = ct.split(';')[0].split('/')[1];
    return part ? part.toUpperCase().substring(0, 8) : '';
}

// ===== REQUEST LIST =====

function buildRequestItem(req) {
    const div = document.createElement('div');
    div.className = 'request-item';
    div.dataset.id = req.id;
    div.dataset.time = req.createdAt;
    div.addEventListener('click', () => loadDetail(req.id));

    const ct = shortCt(req.contentType);
    div.innerHTML = `
        <div class="request-item-top">
            <span class="${createBadgeClass(req.method)}">${escHtml(req.method || '')}</span>
            <span class="request-path">${escHtml(req.path || '/')}</span>
            <span class="request-time">${timeAgo(req.createdAt)}</span>
            <button class="request-delete-btn" title="Delete request" data-id="${escHtml(req.id)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
        <div class="request-meta">
            <span class="request-ip">${escHtml(req.remoteAddr || 'unknown')}</span>
            ${ct ? `<span class="request-ct">${escHtml(ct)}</span>` : ''}
        </div>`;

    div.querySelector('.request-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteRequest(req.id);
    });

    return div;
}

function prependRequest(req) {
    const list = document.getElementById('request-list');
    document.getElementById('empty-sidebar')?.remove();
    list.insertBefore(buildRequestItem(req), list.firstChild);
    updateCount();
    document.getElementById('clear-btn').style.display = '';
}

function updateCount() {
    const n = document.querySelectorAll('.request-item').length;
    document.getElementById('request-count').textContent = n;
}

// ===== LOCAL STORAGE =====

function saveToStorage(requests) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    } catch { /* quota exceeded or private browsing — fail silently */ }
}

function loadFromStorage() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch { return []; }
}

function renderFullList(list) {
    const requestList = document.getElementById('request-list');
    if (list.length === 0) {
        if (!document.getElementById('empty-sidebar')) {
            requestList.innerHTML = `<div class="empty-sidebar" id="empty-sidebar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
                <p>No requests yet.<br>Send a request to the URL above to get started.</p>
            </div>`;
        }
        document.getElementById('clear-btn').style.display = 'none';
    } else {
        document.getElementById('empty-sidebar')?.remove();
        document.getElementById('clear-btn').style.display = '';
        requestList.innerHTML = '';
        list.forEach(r => requestList.appendChild(buildRequestItem(r)));
    }
    updateCount();
}

// ===== LOAD REQUESTS (initial + polling) =====

async function loadRequests() {
    try {
        const res = await fetch(`/api/requests/${ENDPOINT_ID}`);
        if (res.status === 404) { location.href = '/'; return; }
        if (!res.ok) return;

        const incoming = await res.json();

        // Find new requests (not yet in the list)
        const existingIds = new Set(allRequests.map(r => r.id));
        const newRequests = incoming.filter(r => !existingIds.has(r.id));

        allRequests = incoming;
        saveToStorage(incoming);

        if (newRequests.length > 0) {
            newRequests.forEach(r => prependRequest(r));
            if (!currentRequest && !isMobile()) {
                loadDetail(incoming[0].id);
            }
        }
    } catch { /* network blip */ }
}

async function initialLoad() {
    // Show cached data instantly so the page is not blank on reload
    const cached = loadFromStorage();
    if (cached.length > 0) {
        allRequests = cached;
        renderFullList(cached);
        if (!isMobile()) loadDetail(cached[0].id);
    }

    // Fetch from server — server is always authoritative
    try {
        const res = await fetch(`/api/requests/${ENDPOINT_ID}`);
        if (res.status === 404) { location.href = '/'; return; }
        if (!res.ok) return;

        const list = await res.json();
        saveToStorage(list);

        // Re-render only if server data differs from what we showed
        const changed = list.length !== allRequests.length ||
                        list[0]?.id !== allRequests[0]?.id;
        allRequests = list;
        if (changed) {
            renderFullList(list);
            if (!currentRequest && !isMobile() && list.length > 0) {
                loadDetail(list[0].id);
            }
        }
    } catch { /* ignore — cached data already shown */ }
}

// ===== DETAIL =====

function loadDetail(id) {
    const req = allRequests.find(r => r.id === id);
    if (!req) return;
    currentRequest = req;
    renderDetail(req);
    if (isMobile()) {
        document.getElementById('sidebar').classList.add('mobile-hidden');
        document.getElementById('detail').classList.add('mobile-active');
    }
}

function renderDetail(req) {
    // Highlight selected item
    document.querySelectorAll('.request-item').forEach(el => el.classList.remove('selected'));
    const item = document.querySelector(`.request-item[data-id="${req.id}"]`);
    if (item) item.classList.add('selected');

    // Show detail panel
    document.getElementById('empty-detail').style.display = 'none';
    document.getElementById('detail-view').classList.add('visible');

    // Header info
    const badge = document.getElementById('detail-badge');
    badge.textContent = req.method;
    badge.className = createBadgeClass(req.method);
    document.getElementById('detail-path').textContent = req.path || '/';
    document.getElementById('detail-time').textContent = formatDate(req.createdAt);
    document.getElementById('detail-ip').textContent = req.remoteAddr || 'unknown';

    // Headers tab — req.headers is already an object
    const headers = (typeof req.headers === 'string')
        ? safeParseJson(req.headers, {})
        : (req.headers || {});
    const headerEntries = Object.entries(headers);
    const tbody = document.getElementById('headers-body');
    tbody.innerHTML = '';
    headerEntries.forEach(([k, v]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="header-name">${escHtml(k)}</td><td class="header-value">${escHtml(v)}</td>`;
        tbody.appendChild(tr);
    });
    document.getElementById('headers-count').textContent = headerEntries.length;

    // Body tab
    const body = req.body || '';
    const ct = (req.contentType || '').toLowerCase();
    if (body) {
        document.getElementById('body-empty').style.display = 'none';
        document.getElementById('body-content-wrap').style.display = '';
        let display = body;
        let isJson = false;
        if (ct.includes('json')) {
            try { display = JSON.stringify(JSON.parse(body), null, 2); isJson = true; } catch (_) {}
        }
        const pre = document.getElementById('body-pre');
        if (isJson) {
            pre.innerHTML = syntaxHighlightJson(display);
        } else {
            pre.textContent = display;
        }
        // Line numbers
        const lines = display.split('\n').length;
        document.getElementById('body-line-nums').textContent =
            Array.from({length: lines}, (_, i) => i + 1).join('\n');
        // Format label
        let fmt = 'RAW';
        if (ct.includes('json')) fmt = 'JSON';
        else if (ct.includes('xml')) fmt = 'XML';
        else if (ct.includes('form')) fmt = 'FORM';
        else if (ct.includes('text')) fmt = 'TEXT';
        document.getElementById('body-format-label').textContent = 'FORMAT: ' + fmt;
    } else {
        document.getElementById('body-empty').style.display = '';
        document.getElementById('body-content-wrap').style.display = 'none';
    }

    // Query params tab — req.queryParams is already an object or null
    const params = (typeof req.queryParams === 'string')
        ? safeParseJson(req.queryParams, {})
        : (req.queryParams || {});
    const paramEntries = Object.entries(params);
    document.getElementById('params-count').textContent = paramEntries.length;
    if (paramEntries.length > 0) {
        document.getElementById('params-empty').style.display = 'none';
        document.getElementById('params-content-wrap').style.display = '';
        const pbody = document.getElementById('params-body');
        pbody.innerHTML = '';
        paramEntries.forEach(([k, v]) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="param-key">${escHtml(k)}</td><td class="param-value">${escHtml(String(v))}</td>`;
            pbody.appendChild(tr);
        });
    } else {
        document.getElementById('params-empty').style.display = '';
        document.getElementById('params-content-wrap').style.display = 'none';
    }

    // Raw tab
    let raw = `${req.method} ${req.path || '/'}`;
    if (paramEntries.length > 0) raw += '?' + buildQueryString(params);
    raw += ' HTTP/1.1\n';
    headerEntries.forEach(([k, v]) => { raw += `${k}: ${v}\n`; });
    if (body) raw += `\n${body}`;
    document.getElementById('raw-pre').textContent = raw;

    // Stats bar
    const sigHeaders = ['x-signature','x-hub-signature','x-hub-signature-256','x-webhook-signature','x-shopify-hmac-sha256','stripe-signature'];
    const hasSig = Object.keys(headers).some(k => sigHeaders.includes(k.toLowerCase()));
    const ctShort = shortCt(req.contentType) || 'NONE';
    document.getElementById('stat-time').textContent = ctShort;
    document.getElementById('stat-size').textContent = body ? formatSize(body.length) : '0 B';
    const sigEl = document.getElementById('stat-sig');
    sigEl.textContent = hasSig ? 'VERIFIED' : 'NONE';
    sigEl.className = 'stat-value' + (hasSig ? ' stat-verified' : ' stat-none');

    // Default to body tab
    showTab('body');
}

// ===== TABS =====

function showTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`panel-${tab}`).classList.add('active');
}

// ===== UTILS — BODY DISPLAY =====

function syntaxHighlightJson(str) {
    const esc = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        (match) => {
            let cls;
            if (/^"/.test(match))      cls = /:$/.test(match) ? 'json-key' : 'json-str';
            else if (/true|false/.test(match)) cls = 'json-bool';
            else if (/null/.test(match))       cls = 'json-null';
            else                               cls = 'json-num';
            return `<span class="${cls}">${match}</span>`;
        }
    );
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ===== ACTIONS =====

function copyUrl() {
    navigator.clipboard.writeText(WEBHOOK_URL).then(() => showToast('URL copied to clipboard'));
}

function copyBody() {
    if (currentRequest?.body) {
        navigator.clipboard.writeText(currentRequest.body)
            .then(() => showToast('Body copied to clipboard'));
    }
}

function downloadBody() {
    if (!currentRequest?.body) return;
    const ct = (currentRequest.contentType || '').toLowerCase();
    const ext = ct.includes('json') ? 'json' : ct.includes('xml') ? 'xml' : ct.includes('html') ? 'html' : 'txt';
    const blob = new Blob([currentRequest.body], { type: currentRequest.contentType || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `body-${currentRequest.id.substring(0, 8)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Body downloaded');
}

function copyRaw() {
    const raw = document.getElementById('raw-pre').textContent;
    navigator.clipboard.writeText(raw).then(() => showToast('Raw request copied to clipboard'));
}

async function clearRequests() {
    if (!confirm('Delete all requests? This action cannot be undone.')) return;
    await fetch(`/api/requests/${ENDPOINT_ID}`, { method: 'DELETE' });
    localStorage.removeItem(STORAGE_KEY);
    allRequests = [];
    currentRequest = null;
    document.getElementById('request-list').innerHTML =
        `<div class="empty-sidebar" id="empty-sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
            <p>No requests yet.<br>Send a request to the URL above to get started.</p>
        </div>`;
    document.getElementById('request-count').textContent = '0';
    document.getElementById('clear-btn').style.display = 'none';
    document.getElementById('empty-detail').style.display = '';
    document.getElementById('detail-view').classList.remove('visible');
    document.getElementById('sidebar').classList.remove('mobile-hidden');
    document.getElementById('detail').classList.remove('mobile-active');
    showToast('All requests cleared');
}

async function deleteRequest(id) {
    await fetch(`/api/requests/${ENDPOINT_ID}/${id}`, { method: 'DELETE' });

    allRequests = allRequests.filter(r => r.id !== id);
    saveToStorage(allRequests);

    const el = document.querySelector(`.request-item[data-id="${id}"]`);
    if (el) el.remove();
    updateCount();

    if (currentRequest?.id === id) {
        currentRequest = null;
        if (allRequests.length > 0) {
            loadDetail(allRequests[0].id);
        } else {
            document.getElementById('empty-detail').style.display = '';
            document.getElementById('detail-view').classList.remove('visible');
            document.getElementById('sidebar').classList.remove('mobile-hidden');
            document.getElementById('detail').classList.remove('mobile-active');
        }
    }

    if (allRequests.length === 0) {
        renderFullList([]);
    }
}

// ===== UTILS =====

function escHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
}

function safeParseJson(str, fallback) {
    if (!str) return fallback;
    try { return JSON.parse(str); } catch (_) { return fallback; }
}

function buildQueryString(params) {
    return Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
}

function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-US', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

// Update relative times every 30s
setInterval(() => {
    document.querySelectorAll('.request-item').forEach(el => {
        const timeEl = el.querySelector('.request-time');
        if (timeEl && el.dataset.time) timeEl.textContent = timeAgo(el.dataset.time);
    });
}, 30000);

// ===== INIT =====

// Save this endpoint to the index-page history
(function () {
    try {
        const HISTORY_KEY = 'wh_endpoints';
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        const filtered = history.filter(e => e.id !== ENDPOINT_ID);
        filtered.unshift({ id: ENDPOINT_ID, lastVisitedAt: new Date().toISOString() });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, 10)));
    } catch { /* ignore */ }
})();

initialLoad();
setInterval(loadRequests, 3000);
