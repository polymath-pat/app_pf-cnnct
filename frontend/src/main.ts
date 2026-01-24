// Select DOM elements
const probeForm = document.getElementById('probe-form') as HTMLFormElement;
const targetInput = document.getElementById('target-input') as HTMLInputElement;
const resultsArea = document.getElementById('results-area') as HTMLDivElement;

// Handle the submission (Click OR Enter key)
probeForm.addEventListener('submit', async (e: Event) => {
    e.preventDefault(); // Stop page refresh

    const target = targetInput.value.trim();
    if (!target) return;

    // UI Feedback with glassmorphic loading state
    resultsArea.innerHTML = `
        <div class="flex items-center justify-center p-4 bg-white/5 rounded-xl border border-white/10 animate-pulse">
            <p class="text-blue-300 font-medium">Probing <span class="font-mono text-white">${target}</span>...</p>
        </div>
    `;
    
    try {
        const response = await fetch(`/api/cnnct?target=${encodeURIComponent(target)}`);
        
        if (!response.ok) {
            if (response.status === 429) {
                resultsArea.innerHTML = `
                    <div class="p-4 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-300 text-sm text-center">
                        Rate limit exceeded. Try again later.
                    </div>
                `;
            } else {
                throw new Error(`Server returned ${response.status}`);
            }
            return;
        }

        const data = await response.json();
        renderResults(data);
    } catch (err) {
        resultsArea.innerHTML = `
            <div class="p-4 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-300 text-sm text-center">
                <strong>Error:</strong> ${err}
            </div>
        `;
        console.error("Fetch error:", err);
    }
});

function renderResults(data: any) {
    // Determine the color for the HTTP status badge
    const statusColor = data.http_response && data.http_response < 400 ? 'text-emerald-400' : 'text-rose-400';

    resultsArea.innerHTML = `
        <div class="pt-6 border-t border-white/10 mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 class="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                <span class="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                Results for <span class="text-blue-300 font-mono text-sm">${data.target}</span>
            </h3>
            
            <ul class="space-y-4">
                <li class="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
                    <span class="text-slate-300 text-sm font-medium">TCP Port 80</span>
                    <span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${data.tcp_80 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/20 text-rose-400 border border-rose-500/20'}">
                        ${data.tcp_80 ? '✅ Open' : '❌ Closed'}
                    </span>
                </li>
                
                <li class="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
                    <span class="text-slate-300 text-sm font-medium">TCP Port 443</span>
                    <span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${data.tcp_443 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/20 text-rose-400 border border-rose-500/20'}">
                        ${data.tcp_443 ? '✅ Open' : '❌ Closed'}
                    </span>
                </li>
                
                <li class="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
                    <span class="text-slate-300 text-sm font-medium">HTTP Status</span>
                    <span class="font-mono font-bold ${statusColor}">
                        ${data.http_response || 'Unreachable'}
                    </span>
                </li>
            </ul>
        </div>
    `;
}