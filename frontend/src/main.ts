// Select DOM elements
const probeForm = document.getElementById('probe-form') as HTMLFormElement;
const targetInput = document.getElementById('target-input') as HTMLInputElement;
const resultsArea = document.getElementById('results-area') as HTMLDivElement;

// Handle the submission (Click OR Enter key)
probeForm.addEventListener('submit', async (e: Event) => {
    e.preventDefault(); // Stop page refresh

    const target = targetInput.value.trim();
    if (!target) return;

    // UI Feedback
    resultsArea.innerHTML = `<p>Probing <strong>${target}</strong>...</p>`;
    
    try {
        const response = await fetch(`/api/cnnct?target=${encodeURIComponent(target)}`);
        
        if (!response.ok) {
            if (response.status === 429) {
                resultsArea.innerHTML = `<p style="color: red;">Rate limit exceeded. Try again later.</p>`;
            } else {
                throw new Error(`Server returned ${response.status}`);
            }
            return;
        }

        const data = await response.json();
        renderResults(data);
    } catch (err) {
        resultsArea.innerHTML = `<p style="color: red;">Error connecting to backend: ${err}</p>`;
        console.error("Fetch error:", err);
    }
});

function renderResults(data: any) {
    resultsArea.innerHTML = `
        <h3>Results for ${data.target}</h3>
        <ul>
            <li>TCP Port 80: ${data.tcp_80 ? '✅ Open' : '❌ Closed'}</li>
            <li>TCP Port 443: ${data.tcp_443 ? '✅ Open' : '❌ Closed'}</li>
            <li>HTTP Status: ${data.http_response || 'Unreachable'}</li>
        </ul>
    `;
}