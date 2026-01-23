import './main.css';
const testBtn = document.getElementById('testBtn') as HTMLButtonElement;
const targetInput = document.getElementById('target') as HTMLInputElement;
const resultsDiv = document.getElementById('results') as HTMLDivElement;
const outputPre = document.getElementById('output') as HTMLPreElement;

testBtn.addEventListener('click', async () => {
    const target = targetInput.value;
    if (!target) return alert('Enter a target!');

    testBtn.disabled = true;
    testBtn.innerText = 'Testing...';
    resultsDiv.classList.add('hidden');

    try {
        // We hit the backend at /api/test (per our spec routing)
        const response = await fetch(`/api/cnnct?target=${target}`);
        const data = await response.json();
        
        resultsDiv.classList.remove('hidden');
        outputPre.innerText = JSON.stringify(data, null, 2);
    } catch (err) {
        outputPre.innerText = 'Error: Could not reach backend.';
        resultsDiv.classList.remove('hidden');
    } finally {
        testBtn.disabled = false;
        testBtn.innerText = 'Run Test';
    }
});
