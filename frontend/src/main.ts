const probeForm = document.getElementById('probe-form') as HTMLFormElement;
const targetInput = document.getElementById('target-input') as HTMLInputElement;
const resultsArea = document.getElementById('results-area') as HTMLDivElement;
const navPort = document.getElementById('nav-port') as HTMLButtonElement;
const navDns = document.getElementById('nav-dns') as HTMLButtonElement;
const sidebar = document.getElementById('history-sidebar') as HTMLElement;
const historyList = document.getElementById('history-list') as HTMLDivElement;
const toggleHistory = document.getElementById('toggle-history') as HTMLButtonElement;
const closeHistory = document.getElementById('close-history') as HTMLButtonElement;

let currentTab: 'port' | 'dns' = 'port';
// Renamed to avoid TS collision with Window.history
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

navPort.onclick = () => {
    currentTab = 'port';
    navPort.classList.add('bg-white/10', 'text-blue-400');
    navDns.classList.remove('bg-white/10', 'text-blue-400');
    targetInput.placeholder = "Enter IP or Domain (e.g. 8.8.8.8)";
};

navDns.onclick = () => {
    currentTab = 'dns';
    navDns.classList.add('bg-white/10', 'text-blue-400');
    navPort.classList.remove('bg-white/10', 'text-blue-400');
    targetInput.placeholder = "Enter Domain for DNS lookup...";
};

probeForm.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    const target = targetInput.value.trim();
    if (!target) return;

    resultsArea.innerHTML = `<div class="p-4 bg-white/5 animate-pulse text-blue-300 rounded-xl">Probing...</div>`;
    
    try {
        const endpoint = currentTab === 'port' ? `/api/cnnct?target=${encodeURIComponent(target)}` : `/api/dns/${encodeURIComponent(target)}`;
        const response = await fetch(endpoint);
        
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        
        const data = await response.json();
        if (currentTab === 'port') {
            renderPortResults(data);
            addToHistory(target, 'Port', data.tcp_443 ? 'Success' : 'Failed');
        } else {
            renderDnsResults(data);
            addToHistory(target, 'DNS', 'Resolved');
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
                <span class="text-slate-300 text-sm font-medium text-uppercase">Port 443</span>
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

renderHistory();