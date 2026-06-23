const HISTORY_KEY = 'wh_endpoints';
const MAX_HISTORY = 10;
const PAGE_SIZE = 4;

let currentPage = 0;

// ===== HISTORY HELPERS =====

function getHistory() {
    try {
        const data = localStorage.getItem(HISTORY_KEY);
        return data ? JSON.parse(data) : [];
    } catch { return []; }
}

function saveToHistory(id) {
    try {
        const history = getHistory().filter(e => e.id !== id);
        history.unshift({ id, lastVisitedAt: new Date().toISOString() });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
    } catch { /* quota exceeded — ignore */ }
}

function timeAgo(iso) {
    if (!iso) return '?';
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60) return diff + 's';
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    return Math.floor(diff / 86400) + 'd';
}

// ===== RENDER WITH PAGINATION =====

function removeFromHistory(id) {
    try {
        const history = getHistory().filter(e => e.id !== id);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch { /* ignore */ }
}

function renderHistory(page) {
    const history = getHistory();
    const section = document.getElementById('recent-section');

    if (history.length === 0) { section.style.display = 'none'; return; }

    const totalPages = Math.ceil(history.length / PAGE_SIZE);
    currentPage = Math.max(0, Math.min(page ?? currentPage, totalPages - 1));

    section.style.display = 'block';

    const start = currentPage * PAGE_SIZE;
    document.getElementById('recent-list').innerHTML = history
        .slice(start, start + PAGE_SIZE)
        .map(e => {
            const webhookUrl = `${location.origin}/r/${e.id}`;
            return `
                <div class="recent-item">
                    <div class="recent-item-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                        </svg>
                    </div>
                    <div class="recent-item-info">
                        <span class="recent-item-url">${webhookUrl}</span>
                        <div class="recent-item-time">Last visited ${timeAgo(e.lastVisitedAt)} ago</div>
                    </div>
                    <a href="/view/${e.id}" class="btn-view">View</a>
                    <button class="recent-item-close" data-id="${e.id}" title="Remove from history">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>`;
        }).join('');

    const pagination = document.getElementById('recent-pagination');
    if (totalPages > 1) {
        pagination.style.display = 'flex';
        document.getElementById('page-prev').disabled = currentPage === 0;
        document.getElementById('page-next').disabled = currentPage === totalPages - 1;
        document.getElementById('page-info').textContent = `${currentPage + 1} / ${totalPages}`;
    } else {
        pagination.style.display = 'none';
    }
}

// ===== EVENT LISTENERS =====

document.getElementById('recent-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.recent-item-close');
    if (!btn) return;
    removeFromHistory(btn.dataset.id);
    renderHistory(currentPage);
});

document.getElementById('clear-history-btn').addEventListener('click', () => {
    localStorage.removeItem(HISTORY_KEY);
    currentPage = 0;
    document.getElementById('recent-section').style.display = 'none';
});

document.getElementById('page-prev').addEventListener('click', () => renderHistory(currentPage - 1));
document.getElementById('page-next').addEventListener('click', () => renderHistory(currentPage + 1));

// ===== CREATE BUTTON =====

const btn = document.getElementById('create-btn');

btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.innerHTML = btn.innerHTML.replace('Create New Webhook URL', 'Creating…');

    try {
        const res = await fetch('/api/new', { method: 'POST' });
        if (!res.ok) throw new Error('Failed');
        const { id } = await res.json();
        saveToHistory(id);
        window.location.href = `/view/${id}`;
    } catch {
        btn.disabled = false;
        btn.innerHTML = btn.innerHTML.replace('Creating…', 'Create New Webhook URL');
    }
});

// ===== INIT =====
renderHistory(0);
