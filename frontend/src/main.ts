const probeForm = document.getElementById('probe-form') as HTMLFormElement;
const targetInput = document.getElementById('target-input') as HTMLInputElement;
const resultsArea = document.getElementById('results-area') as HTMLDivElement;
const navPort = document.getElementById('nav-port') as HTMLButtonElement;
const navDns = document.getElementById('nav-dns') as HTMLButtonElement;
const navDiag = document.getElementById('nav-diag') as HTMLButtonElement;
const navStatus = document.getElementById('nav-status') as HTMLButtonElement;
const navWebhook = document.getElementById('nav-webhook') as HTMLButtonElement;
const sidebar = document.getElementById('history-sidebar') as HTMLElement;
const historyList = document.getElementById('history-list') as HTMLDivElement;
const toggleHistory = document.getElementById('toggle-history') as HTMLButtonElement;
const closeHistory = document.getElementById('close-history') as HTMLButtonElement;

const presetsArea = document.getElementById('presets-area') as HTMLDivElement;

let currentTab: 'port' | 'dns' | 'diag' | 'status' | 'webhook' = 'port';
let testHistory: any[] = JSON.parse(localStorage.getItem('cnnct_history') || '[]');
let lastResponse: any = null;

const PRESETS: { label: string; value: string }[] = [
    { label: 'doompatrol.io', value: 'doompatrol.io' },
    { label: 'Google DNS', value: '8.8.8.8' },
    { label: 'Cloudflare', value: '1.1.1.1' },
    { label: 'GitHub', value: 'github.com' },
];

function addToHistory(target: string, type: string, outcome: string) {
    const entry = { target, type, outcome, time: new Date().toLocaleTimeString() };
    testHistory = [entry, ...testHistory].slice(0, 10);
    localStorage.setItem('cnnct_history', JSON.stringify(testHistory));
    renderHistory();
}

function renderHistory() {
    historyList.innerHTML = testHistory.map((item: any) => `
        <div class="p-3 bg-white/5 border border-white/5 rounded-lg mb-2">
            <div class="flex justify-between text-[10px] mb-1">
                <span class="text-blue-400 font-bold uppercase">${item.type}</span>
                <span class="text-slate-500">${item.time}</span>
            </div>
            <p class="text-white text-sm font-mono truncate">${item.target}</p>
        </div>
    `).join('');
}

function copyButtonHtml(): string {
    return `<button id="copy-json-btn" class="mt-3 w-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg transition-all">Copy JSON</button>`;
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
    if (currentTab === 'status') {
        presetsArea.innerHTML = '';
        return;
    }
    presetsArea.innerHTML = PRESETS.map(p => {
        const val = currentTab === 'diag' ? `https://${p.value}` : p.value;
        return `<button type="button" data-preset="${val}" class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-white/5 hover:bg-blue-600/30 text-slate-400 hover:text-blue-300 border border-white/10 transition-all">${p.label}</button>`;
    }).join('');
    presetsArea.querySelectorAll('[data-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
            targetInput.value = (btn as HTMLElement).dataset.preset!;
            probeForm.requestSubmit();
        });
    });
}

toggleHistory.onclick = () => sidebar.classList.remove('-translate-x-full');
closeHistory.onclick = () => sidebar.classList.add('-translate-x-full');

function updateNav(active: HTMLButtonElement) {
    [navPort, navDns, navDiag, navStatus, navWebhook].forEach(btn => {
        btn.classList.remove('bg-white/10', 'text-blue-400');
        btn.classList.add('text-slate-400');
    });
    active.classList.add('bg-white/10', 'text-blue-400');
    active.classList.remove('text-slate-400');
}

navPort.onclick = () => {
    currentTab = 'port';
    updateNav(navPort);
    targetInput.placeholder = "Enter IP or Domain (e.g. 8.8.8.8)";
    probeForm.classList.remove('hidden');
    renderPresets();
};

navDns.onclick = () => {
    currentTab = 'dns';
    updateNav(navDns);
    targetInput.placeholder = "Enter Domain for DNS lookup...";
    probeForm.classList.remove('hidden');
    renderPresets();
};

navDiag.onclick = () => {
    currentTab = 'diag';
    updateNav(navDiag);
    targetInput.placeholder = "Enter URL (e.g. https://google.com)";
    probeForm.classList.remove('hidden');
    renderPresets();
};

navStatus.onclick = async () => {
    currentTab = 'status';
    updateNav(navStatus);
    probeForm.classList.add('hidden');
    renderPresets();
    await fetchStatus();
};

navWebhook.onclick = async () => {
    currentTab = 'webhook';
    updateNav(navWebhook);
    probeForm.classList.add('hidden');
    renderPresets();
    await fetchWebhookResults();
};

probeForm.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    const target = targetInput.value.trim();
    if (!target) return;

    resultsArea.innerHTML = `<div class="p-4 bg-white/5 animate-pulse text-blue-300 rounded-xl">Probing...</div>`;

    try {
        let endpoint = '';
        if (currentTab === 'port') endpoint = `/api/cnnct?target=${encodeURIComponent(target)}`;
        else if (currentTab === 'dns') endpoint = `/api/dns/${encodeURIComponent(target)}`;
        else if (currentTab === 'diag') endpoint = `/api/diag?url=${encodeURIComponent(target)}`;

        const response = await fetch(endpoint);

        if (!response.ok) throw new Error(`Server returned ${response.status}`);

        const data = await response.json();
        lastResponse = data;

        if (currentTab === 'port') {
            renderPortResults(data);
            attachCopyHandler();
            addToHistory(target, 'Port', data.tcp_443 ? 'Success' : 'Failed');
        } else if (currentTab === 'dns') {
            renderDnsResults(data);
            attachCopyHandler();
            addToHistory(target, 'DNS', 'Resolved');
        } else if (currentTab === 'diag') {
            renderDiagResults(data);
            attachCopyHandler();
            addToHistory(target, 'HTTP', `${data.http_code} OK`);
        }
    } catch (err) {
        lastResponse = null;
        resultsArea.innerHTML = `<div class="p-4 bg-rose-500/20 text-rose-300 rounded-xl">Error: ${err}</div>`;
    }
});

function renderPortResults(data: any) {
    const color = data.tcp_443 ? 'text-emerald-400' : 'text-rose-400';
    resultsArea.innerHTML = `
        <div class="pt-6 border-t border-white/10 mt-6">
            <h3 class="text-white font-semibold flex items-center justify-between mb-4">
                <span>Target: <span class="text-blue-300">${data.target}</span></span>
                ${data.latency_ms ? `<span class="text-[10px] text-emerald-400 bg-white/5 px-2 py-1 rounded border border-white/10">${data.latency_ms}ms</span>` : ''}
            </h3>
            <div class="bg-white/5 p-3 rounded-lg border border-white/5 flex justify-between items-center">
                <span class="text-slate-300 text-sm font-medium uppercase">Port 443</span>
                <span class="text-xs font-bold ${color}">${data.tcp_443 ? 'OPEN' : 'CLOSED'}</span>
            </div>
        </div>` + copyButtonHtml();
}

function renderDnsResults(data: any) {
    resultsArea.innerHTML = `
        <div class="pt-6 border-t border-white/10 mt-6">
            <h3 class="text-white font-semibold mb-4">A Records</h3>
            <div class="space-y-2">
                ${data.records.map((ip: string) => `<div class="bg-white/5 p-2 rounded font-mono text-emerald-400 text-sm text-center border border-white/5">${ip}</div>`).join('')}
            </div>
        </div>` + copyButtonHtml();
}

function renderDiagResults(data: any) {
    resultsArea.innerHTML = `
        <div class="pt-6 border-t border-white/10 mt-6 space-y-3">
            <h3 class="text-white font-semibold flex items-center justify-between mb-4">
                <span class="truncate">URL: <span class="text-blue-300">${data.url}</span></span>
                <span class="text-[10px] text-emerald-400 bg-white/5 px-2 py-1 rounded border border-white/10">${data.http_code}</span>
            </h3>
            <div class="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div class="bg-white/5 p-2 rounded border border-white/5 text-slate-400">Method: <span class="text-white">${data.method}</span></div>
                <div class="bg-white/5 p-2 rounded border border-white/5 text-slate-400">IP: <span class="text-white">${data.remote_ip}</span></div>
                <div class="bg-white/5 p-2 rounded border border-white/5 text-slate-400">Time: <span class="text-white">${data.total_time_ms}ms</span></div>
                <div class="bg-white/5 p-2 rounded border border-white/5 text-slate-400">Speed: <span class="text-white">${(data.speed_download_bps / 1024).toFixed(2)} KB/s</span></div>
                <div class="bg-white/5 p-2 rounded border border-white/5 text-slate-400 col-span-2">Type: <span class="text-white truncate">${data.content_type}</span></div>
                <div class="bg-white/5 p-2 rounded border border-white/5 text-slate-400 col-span-2">Redirects: <span class="text-white">${data.redirects}</span></div>
            </div>
        </div>` + copyButtonHtml();
}

async function fetchStatus() {
    resultsArea.innerHTML = `<div class="p-4 bg-white/5 animate-pulse text-blue-300 rounded-xl">Checking status...</div>`;
    try {
        const response = await fetch('/api/status');
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const data = await response.json();
        lastResponse = data;
        renderStatusResults(data);
        attachCopyHandler();
    } catch (err) {
        lastResponse = null;
        resultsArea.innerHTML = `<div class="p-4 bg-rose-500/20 text-rose-300 rounded-xl">Error: ${err}</div>`;
    }
}

function renderStatusResults(data: any) {
    const connected = data.connected;
    const statusColor = connected ? 'text-emerald-400' : 'text-rose-400';
    const statusText = connected ? 'CONNECTED' : 'DISCONNECTED';

    let details = '';
    if (data.backend === 'memory') {
        details = `<div class="bg-white/5 p-2 rounded border border-white/5 text-slate-400 col-span-2">${data.message}</div>`;
    } else if (connected) {
        details = `
            <div class="bg-white/5 p-2 rounded border border-white/5 text-slate-400">Version: <span class="text-white">${data.version}</span></div>
            <div class="bg-white/5 p-2 rounded border border-white/5 text-slate-400">Latency: <span class="text-white">${data.latency_ms}ms</span></div>
            <div class="bg-white/5 p-2 rounded border border-white/5 text-slate-400">Clients: <span class="text-white">${data.connected_clients}</span></div>
            <div class="bg-white/5 p-2 rounded border border-white/5 text-slate-400">Memory: <span class="text-white">${data.used_memory_human}</span></div>
            <div class="bg-white/5 p-2 rounded border border-white/5 text-slate-400 col-span-2">Uptime: <span class="text-white">${data.uptime_seconds}s</span></div>`;
    } else {
        details = `<div class="bg-white/5 p-2 rounded border border-white/5 text-rose-400 col-span-2">Error: ${data.error}</div>`;
    }

    resultsArea.innerHTML = `
        <div class="pt-6 border-t border-white/10 mt-6 space-y-3">
            <h3 class="text-white font-semibold flex items-center justify-between mb-4">
                <span>Backend: <span class="text-blue-300">${data.backend}</span></span>
                <span class="text-xs font-bold ${statusColor}">${statusText}</span>
            </h3>
            <div class="grid grid-cols-2 gap-2 text-[11px] font-mono">
                ${details}
            </div>
        </div>` + copyButtonHtml();
}

async function fetchWebhookResults() {
    resultsArea.innerHTML = `<div class="p-4 bg-white/5 animate-pulse text-blue-300 rounded-xl">Loading webhook results...</div>`;
    try {
        const response = await fetch('/api/webhook-results');
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const data = await response.json();
        lastResponse = data;
        renderWebhookResultsList(data);
        attachCopyHandler();
    } catch (err) {
        lastResponse = null;
        resultsArea.innerHTML = `<div class="p-4 bg-rose-500/20 text-rose-300 rounded-xl">Error: ${err}</div>`;
    }
}

function formatRound(round: string): { label: string; color: string } {
    switch (round) {
        case 'pomodoro': return { label: 'Pomodoro', color: 'text-rose-400' };
        case 'short_break': return { label: 'Short Break', color: 'text-emerald-400' };
        case 'long_break': return { label: 'Long Break', color: 'text-blue-400' };
        default: return { label: round || 'unknown', color: 'text-slate-400' };
    }
}

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function renderWebhookResultsList(data: any) {
    if (data.count === 0) {
        resultsArea.innerHTML = `<div class="p-4 bg-white/5 text-slate-400 rounded-xl text-center">No webhook events received yet</div>`;
        return;
    }

    const items = data.results.slice(0, 10).map((r: any) => {
        const time = new Date(r.timestamp).toLocaleString();
        const p = r.payload || {};
        const round = formatRound(p.round);
        const duration = p.seconds ? formatDuration(p.seconds) : '';
        const task = p.task || '';
        const project = p.project || '';

        return `
            <div class="bg-white/5 p-3 rounded-lg border border-white/5 mb-2">
                <div class="flex justify-between text-[10px] mb-1">
                    <span class="${round.color} font-bold uppercase">${round.label}</span>
                    <span class="text-slate-500">${time}</span>
                </div>
                <p class="text-white text-sm font-medium truncate">${task || '(no task)'}</p>
                <div class="flex justify-between text-[10px] mt-1">
                    <span class="text-slate-500">${project || 'No project'}</span>
                    <span class="text-slate-400">${duration}</span>
                </div>
            </div>`;
    }).join('');

    resultsArea.innerHTML = `
        <div class="pt-6 border-t border-white/10 mt-6">
            <h3 class="text-white font-semibold mb-4">Recent Sessions <span class="text-slate-500 text-xs">(${data.count} total)</span></h3>
            ${items}
        </div>` + copyButtonHtml();
}

renderHistory();
renderPresets();