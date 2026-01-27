const probeForm = document.getElementById('probe-form') as HTMLFormElement;
const targetInput = document.getElementById('target-input') as HTMLInputElement;
const resultsArea = document.getElementById('results-area') as HTMLDivElement;
const navPort = document.getElementById('nav-port') as HTMLButtonElement;
const navDns = document.getElementById('nav-dns') as HTMLButtonElement;
const navDiag = document.getElementById('nav-diag') as HTMLButtonElement;
const sidebar = document.getElementById('history-sidebar') as HTMLElement;
const historyList = document.getElementById('history-list') as HTMLDivElement;
const toggleHistory = document.getElementById('toggle-history') as HTMLButtonElement;
const closeHistory = document.getElementById('close-history') as HTMLButtonElement;

let currentTab: 'port' | 'dns' | 'diag' = 'port';
let testHistory: any[] = JSON.parse(localStorage.getItem('cnnct_history') || '[]');

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

toggleHistory.onclick = () => sidebar.classList.remove('-translate-x-full');
closeHistory.onclick = () => sidebar.classList.add('-translate-x-full');

function updateNav(active: HTMLButtonElement) {
    [navPort, navDns, navDiag].forEach(btn => {
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
};

navDns.onclick = () => {
    currentTab = 'dns';
    updateNav(navDns);
    targetInput.placeholder = "Enter Domain for DNS lookup...";
};

navDiag.onclick = () => {
    currentTab = 'diag';
    updateNav(navDiag);
    targetInput.placeholder = "Enter URL (e.g. https://google.com)";
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
        
        if (currentTab === 'port') {
            renderPortResults(data);
            addToHistory(target, 'Port', data.tcp_443 ? 'Success' : 'Failed');
        } else if (currentTab === 'dns') {
            renderDnsResults(data);
            addToHistory(target, 'DNS', 'Resolved');
        } else if (currentTab === 'diag') {
            renderDiagResults(data);
            addToHistory(target, 'HTTP', `${data.http_code} OK`);
        }
    } catch (err) {
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
        </div>`;
}

function renderDnsResults(data: any) {
    resultsArea.innerHTML = `
        <div class="pt-6 border-t border-white/10 mt-6">
            <h3 class="text-white font-semibold mb-4">A Records</h3>
            <div class="space-y-2">
                ${data.records.map((ip: string) => `<div class="bg-white/5 p-2 rounded font-mono text-emerald-400 text-sm text-center border border-white/5">${ip}</div>`).join('')}
            </div>
        </div>`;
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
        </div>`;
}

renderHistory();