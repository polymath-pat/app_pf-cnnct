import './main.css';

const probeForm = document.getElementById('probe-form') as HTMLFormElement;
const targetInput = document.getElementById('target-input') as HTMLInputElement;
const resultsArea = document.getElementById('results-area') as HTMLDivElement;
const navDns = document.getElementById('nav-dns') as HTMLButtonElement;
const navDiag = document.getElementById('nav-diag') as HTMLButtonElement;
const sidebar = document.getElementById('history-sidebar') as HTMLElement;
const historyList = document.getElementById('history-list') as HTMLDivElement;
const toggleHistory = document.getElementById('toggle-history') as HTMLButtonElement;
const closeHistory = document.getElementById('close-history') as HTMLButtonElement;
const presetsArea = document.getElementById('presets-area') as HTMLDivElement;
const statusMeta = document.getElementById('status-meta') as HTMLDivElement;
const statusCardBody = document.getElementById('status-card-body') as HTMLDivElement;
const webhookResultsArea = document.getElementById('webhook-results-area') as HTMLDivElement;

let currentTab: 'dns' | 'diag' = 'dns';
let testHistory: any[] = JSON.parse(localStorage.getItem('cnnct_history') || '[]');
let lastResponse: any = null;
let webhookPage = 0;
const WEBHOOK_PAGE_SIZE = 10;
let webhookPollInterval: number | null = null;
const WEBHOOK_POLL_MS = 15000;
let lastWebhookResponse: any = null;

const tabResultsCache: Record<string, string> = {
    dns: '',
    diag: '',
};

interface HealthResponse {
    app: { git_sha: string; uptime_seconds: number; python_version: string };
    valkey: { connected: boolean; backend: string; error?: string; latency_ms?: number; version?: string; [key: string]: any };
    postgres: { connected: boolean; backend: string; error?: string; latency_ms?: number; version?: string; [key: string]: any };
    opensearch: { configured: boolean; connected?: boolean; status: string; latency_ms?: number; [key: string]: any };
    dns_canary: { domain: string; ok: boolean; records: string[]; latency_ms: number; error: string | null };
    rate_limiter: { backend: string; in_memory_fallback: boolean };
}

// --- Per-tab presets ---
const DNS_PRESETS: { label: string; value: string }[] = [
    { label: 'doompatrol.io', value: 'doompatrol.io' },
    { label: 'google.com', value: 'google.com' },
    { label: 'github.com', value: 'github.com' },
    { label: 'cloudflare.com', value: 'cloudflare.com' },
];

const DIAG_PRESETS: { label: string; value: string }[] = [
    { label: 'doompatrol.io', value: 'https://doompatrol.io' },
    { label: 'Google', value: 'https://google.com' },
    { label: 'GitHub', value: 'https://github.com' },
    { label: 'Cloudflare', value: 'https://cloudflare.com' },
];

function saveCurrentTabResults() {
    tabResultsCache[currentTab] = resultsArea.innerHTML;
}

function restoreTabResults(tab: string) {
    const cached = tabResultsCache[tab];
    if (cached) {
        resultsArea.innerHTML = cached;
        attachCopyHandler();
    } else {
        resultsArea.innerHTML = '';
    }
}

function updateTabCache() {
    tabResultsCache[currentTab] = resultsArea.innerHTML;
}

function addToHistory(target: string, type: string, outcome: string) {
    const entry = { target, type, outcome, time: new Date().toLocaleTimeString() };
    testHistory = [entry, ...testHistory].slice(0, 10);
    localStorage.setItem('cnnct_history', JSON.stringify(testHistory));
    renderHistory();
}

function renderHistory() {
    historyList.innerHTML = testHistory.map((item: any) => `
        <div class="p-3 bg-white/5 border border-cyan-500/10 rounded-lg mb-2 service-row">
            <div class="flex justify-between text-[10px] mb-1">
                <span class="text-cyan-400 font-bold uppercase">${item.type}</span>
                <span class="text-slate-600">${item.time}</span>
            </div>
            <p class="text-cyan-200 text-sm font-mono truncate">${item.target}</p>
        </div>
    `).join('');
}

function copyButtonHtml(): string {
    return `<button id="copy-json-btn" class="mt-3 w-full bg-white/5 hover:bg-cyan-500/10 border border-cyan-500/10 text-slate-500 hover:text-cyan-400 text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg transition-all">Copy JSON</button>`;
}

function attachCopyHandler() {
    const btn = document.getElementById('copy-json-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        if (!lastResponse) return;
        navigator.clipboard.writeText(JSON.stringify(lastResponse, null, 2)).then(() => {
            btn.textContent = 'Copied!';
            btn.classList.add('text-emerald-400');
            setTimeout(() => {
                btn.textContent = 'Copy JSON';
                btn.classList.remove('text-emerald-400');
            }, 1500);
        });
    });
}

function renderPresets() {
    const presets = currentTab === 'diag' ? DIAG_PRESETS : DNS_PRESETS;
    presetsArea.innerHTML = presets.map(p => {
        return `<button type="button" data-preset="${p.value}" class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-white/5 hover:bg-cyan-500/15 text-slate-500 hover:text-cyan-300 border border-cyan-500/10 hover:border-cyan-500/30 transition-all">${p.label}</button>`;
    }).join('');
    presetsArea.querySelectorAll('[data-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
            targetInput.value = (btn as HTMLElement).dataset.preset!;
            probeForm.requestSubmit();
        });
    });
}

toggleHistory.onclick = () => sidebar.classList.toggle('-translate-x-full');
closeHistory.onclick = () => sidebar.classList.add('-translate-x-full');

function updateNav(active: HTMLButtonElement) {
    [navDns, navDiag].forEach(btn => {
        btn.classList.remove('cyber-tab-active', 'text-cyan-400');
        btn.classList.add('text-slate-500');
    });
    active.classList.add('cyber-tab-active', 'text-cyan-400');
    active.classList.remove('text-slate-500');
}

function startWebhookPolling() {
    if (webhookPollInterval !== null) return;
    webhookPollInterval = window.setInterval(async () => {
        await fetchWebhookResults(true);
    }, WEBHOOK_POLL_MS);
}

function updateUrl(tab?: string, target?: string) {
    const params = new URLSearchParams();
    params.set('tab', tab || currentTab);
    if (target) params.set('target', target);
    history.replaceState(null, '', '?' + params.toString());
}

navDns.onclick = () => {
    saveCurrentTabResults();
    currentTab = 'dns';
    updateNav(navDns);
    targetInput.placeholder = "Enter Domain for DNS lookup...";
    probeForm.classList.remove('hidden');
    renderPresets();
    restoreTabResults('dns');
    updateUrl('dns');
};

navDiag.onclick = () => {
    saveCurrentTabResults();
    currentTab = 'diag';
    updateNav(navDiag);
    targetInput.placeholder = "Enter URL (e.g. https://google.com)";
    probeForm.classList.remove('hidden');
    renderPresets();
    restoreTabResults('diag');
    updateUrl('diag');
};

probeForm.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    const target = targetInput.value.trim();
    if (!target) return;

    resultsArea.innerHTML = `<div class="p-4 bg-cyan-500/5 border border-cyan-500/10 rounded-lg text-cyan-500 animate-pulse">Probing target...</div>`;

    try {
        let endpoint = '';
        if (currentTab === 'dns') endpoint = `/api/dns/${encodeURIComponent(target)}`;
        else if (currentTab === 'diag') endpoint = `/api/diag?url=${encodeURIComponent(target)}`;

        const response = await fetch(endpoint);

        if (!response.ok) throw new Error(`Server returned ${response.status}`);

        const data = await response.json();
        lastResponse = data;

        updateUrl(currentTab, target);

        if (currentTab === 'dns') {
            renderDnsResults(data);
            attachCopyHandler();
            addToHistory(target, 'DNS', 'Resolved');
        } else if (currentTab === 'diag') {
            renderDiagResults(data);
            attachCopyHandler();
            addToHistory(target, 'HTTP', `${data.http_code} OK`);
        }
        updateTabCache();
    } catch (err) {
        lastResponse = null;
        resultsArea.innerHTML = `<div class="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">Error: ${err}</div>`;
        updateTabCache();
    }
});

function renderDnsResults(data: any) {
    resultsArea.innerHTML = `
        <div class="pt-6 border-t border-cyan-500/10 mt-6">
            <h3 class="text-cyan-200 font-semibold mb-4">A Records</h3>
            <div class="space-y-2">
                ${data.records.map((ip: string) => `<div class="bg-white/5 p-2 rounded font-mono text-emerald-400 text-sm text-center border border-cyan-500/10">${ip}</div>`).join('')}
            </div>
        </div>` + copyButtonHtml();
}

function renderDiagResults(data: any) {
    resultsArea.innerHTML = `
        <div class="pt-6 border-t border-cyan-500/10 mt-6 space-y-3">
            <h3 class="text-cyan-200 font-semibold flex items-center justify-between mb-4">
                <span class="truncate">URL: <span class="text-cyan-400">${data.url}</span></span>
                <span class="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">${data.http_code}</span>
            </h3>
            <div class="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div class="bg-white/5 p-2 rounded border border-cyan-500/10 text-slate-500">Method: <span class="text-cyan-300">${data.method}</span></div>
                <div class="bg-white/5 p-2 rounded border border-cyan-500/10 text-slate-500">IP: <span class="text-cyan-300">${data.remote_ip}</span></div>
                <div class="bg-white/5 p-2 rounded border border-cyan-500/10 text-slate-500">Time: <span class="text-cyan-300">${data.total_time_ms}ms</span></div>
                <div class="bg-white/5 p-2 rounded border border-cyan-500/10 text-slate-500">Speed: <span class="text-cyan-300">${(data.speed_download_bps / 1024).toFixed(2)} KB/s</span></div>
                <div class="bg-white/5 p-2 rounded border border-cyan-500/10 text-slate-500 col-span-2">Type: <span class="text-cyan-300 truncate">${data.content_type}</span></div>
                <div class="bg-white/5 p-2 rounded border border-cyan-500/10 text-slate-500 col-span-2">Redirects: <span class="text-cyan-300">${data.redirects}</span></div>
            </div>
        </div>` + copyButtonHtml();
}

// --- Status Bar + Status Card ---

function formatUptime(seconds: number): string {
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

function renderStatusMeta(data: HealthResponse) {
    const sha = data.app.git_sha.slice(0, 7);
    const uptime = formatUptime(data.app.uptime_seconds);
    statusMeta.innerHTML = `
        <span>sha:${sha}</span>
        <span>up:${uptime}</span>
        <span>py:${data.app.python_version}</span>
    `;
}

function renderStatusCard(data: HealthResponse) {
    const services: { name: string; ok: boolean; detail: string }[] = [
        {
            name: 'valkey',
            ok: data.valkey.connected,
            detail: data.valkey.connected
                ? `v${data.valkey.version || data.valkey.backend} ${data.valkey.latency_ms}ms`
                : data.valkey.backend === 'memory' ? 'in-memory fallback' : 'connection refused',
        },
        {
            name: 'postgres',
            ok: data.postgres.connected,
            detail: data.postgres.connected
                ? `${(data.postgres.version || '').split(' ').slice(0, 2).join(' ').toLowerCase()} ${data.postgres.latency_ms}ms`
                : data.postgres.backend === 'none' ? 'not configured' : 'connection refused',
        },
        {
            name: 'opensearch',
            ok: data.opensearch.configured ? (data.opensearch.connected ?? false) : false,
            detail: !data.opensearch.configured
                ? 'not configured'
                : data.opensearch.connected ? `cluster:${data.opensearch.status} ${data.opensearch.latency_ms}ms` : 'connection refused',
        },
        {
            name: 'dns_canary',
            ok: data.dns_canary.ok,
            detail: data.dns_canary.ok
                ? `${data.dns_canary.records.length} record${data.dns_canary.records.length !== 1 ? 's' : ''} ${data.dns_canary.latency_ms}ms`
                : data.dns_canary.error || 'resolution failed',
        },
    ];

    const lines = services.map(s => {
        const statusClass = s.ok ? 'terminal-ok' : 'terminal-fail';
        const statusTag = s.ok ? '[ OK ]' : '[FAIL]';
        return `<div><span class="terminal-prompt">$</span> probe <span class="text-cyan-400">${s.name}</span> <span class="${statusClass}">${statusTag}</span> <span class="terminal-dim">${s.detail}</span></div>`;
    }).join('');

    const sha = data.app.git_sha.slice(0, 7);
    const uptime = formatUptime(data.app.uptime_seconds);

    statusCardBody.innerHTML = `
        ${lines}
        <div class="mt-2 pt-2 border-t border-emerald-500/10">
            <span class="terminal-prompt">$</span> sysinfo <span class="terminal-dim">sha:${sha} uptime:${uptime} py:${data.app.python_version}</span><span class="terminal-cursor"></span>
        </div>`;
}

async function fetchAndRenderStatusBar() {
    try {
        const response = await fetch('/api/health');
        if (!response.ok) return;
        const data: HealthResponse = await response.json();
        renderStatusMeta(data);
        renderStatusCard(data);
    } catch {
        // Status bar is best-effort; don't show errors
    }
}

// --- Webhook Feed (right panel) ---

async function fetchWebhookResults(silent: boolean = false) {
    if (!silent) {
        webhookResultsArea.innerHTML = `<div class="p-4 bg-cyan-500/5 border border-cyan-500/10 rounded-lg text-cyan-600 animate-pulse">Loading webhook data...</div>`;
    }
    try {
        const response = await fetch('/api/webhook-results');
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const data = await response.json();

        const hasNewData = !lastWebhookResponse ||
            data.count !== lastWebhookResponse.count ||
            (data.results[0]?.id !== lastWebhookResponse.results?.[0]?.id);

        if (hasNewData || !silent) {
            lastWebhookResponse = data;
            renderWebhookResultsList(data);
            attachPaginationHandlers();
        }
    } catch (err) {
        if (!silent) {
            webhookResultsArea.innerHTML = `<div class="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">Error: ${err}</div>`;
        }
    }
}

function formatTimestamp(ms: number): string {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRound(round: string): { label: string; color: string } {
    switch (round) {
        case 'pomodoro': return { label: 'Pomodoro', color: 'text-rose-400' };
        case 'short_break': return { label: 'Short Break', color: 'text-emerald-400' };
        case 'long_break': return { label: 'Long Break', color: 'text-cyan-400' };
        case 'api': return { label: 'Api', color: 'text-amber-400' };
        default: return { label: round || 'unknown', color: 'text-slate-500' };
    }
}

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function renderWebhookResultsList(data: any) {
    if (data.count === 0) {
        webhookResultsArea.innerHTML = `<div class="p-4 bg-white/5 text-slate-500 rounded-lg text-center border border-cyan-500/10">No webhook events received yet</div>`;
        return;
    }

    const totalPages = Math.ceil(data.results.length / WEBHOOK_PAGE_SIZE);
    const start = webhookPage * WEBHOOK_PAGE_SIZE;
    const pageResults = data.results.slice(start, start + WEBHOOK_PAGE_SIZE);

    const items = pageResults.map((r: any) => {
        const time = new Date(r.timestamp).toLocaleString();
        const p = r.payload || {};
        const round = formatRound(p.round);
        const duration = p.seconds ? formatDuration(p.seconds) : '';
        const task = p.task || '';
        const eventType = p.type || 'unknown';
        const sessionStart = p.session_start ? formatTimestamp(p.session_start) : '-';
        const sessionEnd = p.session_end ? formatTimestamp(p.session_end) : '-';

        let testLine = '';
        if (p.test_type && p.test_result && !p.test_result.error) {
            const tr = p.test_result;
            if (p.test_type === 'port_check') {
                const status = tr.tcp_443 ? 'OPEN' : 'CLOSED';
                const color = tr.tcp_443 ? 'text-emerald-400' : 'text-rose-400';
                const latency = tr.latency_ms ? ` (${tr.latency_ms}ms)` : '';
                testLine = `<span class="${color}">Port 443: ${status}${latency}</span>`;
            } else if (p.test_type === 'dns_lookup') {
                const count = tr.records?.length ?? 0;
                testLine = `<span class="text-emerald-400">DNS: ${count} A record${count !== 1 ? 's' : ''}</span>`;
            } else if (p.test_type === 'http_diag') {
                const latency = tr.total_time_ms ? ` (${tr.total_time_ms}ms)` : '';
                testLine = `<span class="text-emerald-400">HTTP ${tr.http_code}${latency}</span>`;
            }
        }

        return `
            <div class="bg-white/5 p-3 rounded-lg border border-cyan-500/10 mb-2 service-row">
                <div class="flex justify-between text-[10px] mb-1">
                    <div class="flex gap-2">
                        <span class="${round.color} font-bold uppercase">${round.label}</span>
                        <span class="text-fuchsia-400 uppercase">${eventType}</span>
                    </div>
                    <span class="text-slate-600">${time}</span>
                </div>
                <p class="text-cyan-200 text-sm font-medium truncate">${task || '(no task)'}</p>
                ${testLine ? `<p class="text-[10px] mt-1">${testLine}</p>` : ''}
                <div class="flex justify-between text-[10px] mt-1">
                    <span class="text-slate-600">${sessionStart} - ${sessionEnd}</span>
                    <span class="text-slate-500">${duration}</span>
                </div>
            </div>`;
    }).join('');

    const pagination = totalPages > 1 ? `
        <div class="flex justify-between items-center mt-4 text-[10px]">
            <button id="webhook-prev" class="px-3 py-1 bg-white/5 hover:bg-cyan-500/10 border border-cyan-500/10 rounded-lg text-slate-500 hover:text-cyan-400 transition-all ${webhookPage === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${webhookPage === 0 ? 'disabled' : ''}>Prev</button>
            <span class="text-slate-600">Page ${webhookPage + 1} of ${totalPages}</span>
            <button id="webhook-next" class="px-3 py-1 bg-white/5 hover:bg-cyan-500/10 border border-cyan-500/10 rounded-lg text-slate-500 hover:text-cyan-400 transition-all ${webhookPage >= totalPages - 1 ? 'opacity-50 cursor-not-allowed' : ''}" ${webhookPage >= totalPages - 1 ? 'disabled' : ''}>Next</button>
        </div>` : '';

    const countLabel = `<span class="text-slate-600 text-xs">(${data.count} total)</span>`;

    webhookResultsArea.innerHTML = `
        <h3 class="text-cyan-200 font-semibold flex items-center gap-2 mb-3">
            Recent Sessions ${countLabel}
        </h3>
        ${items}
        ${pagination}`;
}

function attachPaginationHandlers() {
    const prevBtn = document.getElementById('webhook-prev');
    const nextBtn = document.getElementById('webhook-next');
    if (prevBtn) {
        prevBtn.onclick = () => {
            if (webhookPage > 0) {
                webhookPage--;
                renderWebhookResultsList(lastWebhookResponse);
                attachPaginationHandlers();
            }
        };
    }
    if (nextBtn) {
        nextBtn.onclick = () => {
            const totalPages = Math.ceil(lastWebhookResponse.results.length / WEBHOOK_PAGE_SIZE);
            if (webhookPage < totalPages - 1) {
                webhookPage++;
                renderWebhookResultsList(lastWebhookResponse);
                attachPaginationHandlers();
            }
        };
    }
}

// --- Init ---

renderHistory();
renderPresets();

// Status bar + card: fetch immediately + refresh every 60s
fetchAndRenderStatusBar();
setInterval(fetchAndRenderStatusBar, 60000);

// Webhook feed: fetch immediately + start polling
fetchWebhookResults();
startWebhookPolling();

function initFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const target = params.get('target');

    if (!tab) return;

    const tabNav: Record<string, HTMLButtonElement> = {
        dns: navDns,
        diag: navDiag,
    };

    const btn = tabNav[tab];
    if (!btn) return;

    currentTab = tab as typeof currentTab;
    updateNav(btn);
    probeForm.classList.remove('hidden');
    renderPresets();

    if (tab === 'dns') targetInput.placeholder = "Enter Domain for DNS lookup...";
    else if (tab === 'diag') targetInput.placeholder = "Enter URL (e.g. https://google.com)";

    if (target) {
        targetInput.value = target;
        probeForm.requestSubmit();
    }
}

initFromUrl();
