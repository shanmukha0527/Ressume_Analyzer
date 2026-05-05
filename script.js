// ── Setup ──────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── App state ──────────────────────────────────────────────────
let extractedResumeText = '';
let lastAnalysisResult = null;
let lastJobRole = '';
let previewOpen = false;
let pieChart = null, barChart = null, radar = null;

// ── DOM helpers ────────────────────────────────────────────────
const show = id => document.getElementById(id).style.display = 'block';
const hide = id => document.getElementById(id).style.display = 'none';
const showFlex = id => document.getElementById(id).style.display = 'flex';
const el = id => document.getElementById(id);

// ── Role pills ─────────────────────────────────────────────────
function setRole(role) {
    el('jobRole').value = role;
    document.querySelectorAll('.pill').forEach(p =>
        p.classList.toggle('active', p.textContent.trim() === role)
    );
    checkReady();
}

el('jobRole').addEventListener('input', checkReady);

function checkReady() {
    const job = el('jobRole').value.trim();
    el('analyzeBtn').disabled = !(job && extractedResumeText.length > 50);
}

// ── Drag & Drop ────────────────────────────────────────────────
function handleDragOver(e) { e.preventDefault(); el('dropZone').classList.add('drag-over'); }
function handleDragLeave() { el('dropZone').classList.remove('drag-over'); }
function handleDrop(e) {
    e.preventDefault(); el('dropZone').classList.remove('drag-over');
    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
}
function handleFileSelect(e) { if (e.target.files[0]) processFile(e.target.files[0]); }

// ── Process file ───────────────────────────────────────────────
async function processFile(file) {
    extractedResumeText = '';
    hide('filePreview'); hide('textPreview'); hide('errorCard');
    el('previewToggle').style.display = 'none';
    checkReady();
    showFlex('processingRow');
    el('processingMsg').textContent = 'Reading ' + file.name + '...';
    const ext = file.name.split('.').pop().toLowerCase();
    try {
        if (ext === 'pdf') extractedResumeText = await readPDF(file);
        else if (ext === 'docx' || ext === 'doc') extractedResumeText = await readDOCX(file);
        else if (ext === 'txt') extractedResumeText = await readTXT(file);
        else throw new Error('Unsupported format. Please upload PDF, DOCX, or TXT.');
        if (extractedResumeText.trim().length < 20) throw new Error('Very little text found.');
        showFilePreview(file, extractedResumeText);
    } catch (err) {
        hide('processingRow'); show('errorCard');
        el('errorMessage').innerHTML = '<strong>File error:</strong> ' + err.message;
    }
    checkReady();
}

async function readPDF(file) {
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        el('processingMsg').textContent = 'Reading page ' + i + ' of ' + pdf.numPages + '...';
        const page = await pdf.getPage(i);
        const c = await page.getTextContent();
        text += c.items.map(x => x.str).join(' ') + '\n';
    }
    return text.trim();
}

async function readDOCX(file) {
    el('processingMsg').textContent = 'Extracting Word document...';
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return r.value.trim();
}

function readTXT(file) {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = e => res(e.target.result);
        r.onerror = () => rej(new Error('Could not read file.'));
        r.readAsText(file);
    });
}

function showFilePreview(file, text) {
    hide('processingRow');
    const ext = file.name.split('.').pop().toLowerCase();
    const icons = { pdf: '📕', docx: '📘', doc: '📘', txt: '📄' };
    const colors = { pdf: '#e0705520', docx: '#7eb8f520', doc: '#7eb8f520', txt: '#c8f55a20' };
    el('fileIconBox').textContent = icons[ext] || '📄';
    el('fileIconBox').style.background = colors[ext] || '#c8f55a20';
    el('fileName').textContent = file.name;
    el('fileMeta').textContent =
        (file.size / 1024).toFixed(1) + ' KB · ' +
        text.trim().split(/\s+/).length.toLocaleString() + ' words ✓';
    el('textPreview').textContent = text.length > 600
        ? text.slice(0, 600) + '\n[truncated...]' : text;
    showFlex('filePreview');
    el('previewToggle').style.display = 'block';
    el('previewToggle').textContent = '▸ Show extracted text';
    previewOpen = false;
}

function toggleTextPreview() {
    previewOpen = !previewOpen;
    el('textPreview').style.display = previewOpen ? 'block' : 'none';
    el('previewToggle').textContent = previewOpen
        ? '▾ Hide extracted text' : '▸ Show extracted text';
}

function removeFile() {
    extractedResumeText = '';
    el('fileInput').value = '';
    hide('filePreview'); hide('textPreview'); hide('errorCard');
    el('previewToggle').style.display = 'none';
    previewOpen = false; checkReady();
}

// ── ANALYZE ────────────────────────────────────────────────────
async function handleAnalyze() {
    const jobRole = el('jobRole').value.trim();
    lastJobRole = jobRole;

    hide('resultsPlaceholder'); hide('resultsOutput'); hide('errorCard');
    hide('actionButtons'); hide('improveOutput'); hide('dashboardOutput'); hide('interviewOutput');
    show('loadingCard');
    el('analyzeBtn').disabled = true;
    el('loadingStatus').textContent = 'Sending to server...';

    try {
        const resp = await fetch('http://127.0.0.1:3000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resumeText: extractedResumeText, jobRole })
        });
        if (!resp.ok) { const e = await resp.json(); throw new Error(e.error || 'Server error'); }

        el('loadingStatus').textContent = 'Rendering results...';
        const result = await resp.json();
        lastAnalysisResult = result;

        hide('loadingCard');
        renderResults(result, jobRole);
        el('actionButtons').style.display = 'flex';

    } catch (err) {
        hide('loadingCard'); show('errorCard'); show('resultsPlaceholder');
        el('analyzeBtn').disabled = false;
        let msg = err.message;
        if (msg.includes('Failed to fetch'))
            msg = 'Cannot reach the server. Make sure node server.js is running.';
        el('errorMessage').innerHTML = '<strong>Error:</strong> ' + msg;
    }
}

function renderResults(result, jobRole) {
    el('resultRoleBadge').textContent = jobRole;
    const score = result.overall_score || 0;
    const col = score >= 75 ? '#c8f55a' : score >= 50 ? '#f5c842' : '#e07070';

    el('resultSections').innerHTML = [
        '<div class="result-section" style="animation-delay:0s">' +
        '<div class="result-section-title"><span>◎</span> ATS compatibility score</div>' +
        '<div class="score-display"><span class="score-number" style="color:' + col + '">' + score + '</span>' +
        '<span style="font-size:13px;color:#666360">/ 100 · ' + (result.score_label || '') + '</span></div>' +
        '<div class="score-bar-track"><div class="score-bar-fill" id="scoreBar" style="width:0%;background:' + col + '"></div></div>' +
        '<p>' + (result.summary || '') + '</p>' +
        (result.salary_range
            ? '<p style="margin-top:8px;font-size:12px;color:#666360">💰 Avg salary: ' +
            result.salary_range + ' · 🗓 Experience: ' + result.experience + '</p>'
            : '') +
        '</div>',
        listCard('Strengths', '✓', result.strengths, '#c8f55a', 0.10),
        listCard('Areas to improve', '⚡', result.weaknesses, '#f5c842', 0.20),
        listCard('Skills gap for ' + jobRole, '△', result.skills_gap, '#e07070', 0.30),
        listCard('ATS optimisation tips', '◈', result.ats_tips, '#7eb8f5', 0.40),
        listCard('Suggested career paths', '→', result.career_paths, '#c8f55a', 0.50),
        result.required_skills
            ? listCard('Required skills for this role', '★', result.required_skills, '#f5c842', 0.60)
            : ''
    ].join('');

    show('resultsOutput');
    setTimeout(() => { const b = el('scoreBar'); if (b) b.style.width = score + '%'; }, 300);
    el('resultsOutput').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function listCard(title, icon, items, color, delay) {
    if (!items || !items.length) return '';
    return '<div class="result-section" style="animation-delay:' + delay + 's">' +
        '<div class="result-section-title" style="color:' + color + '88">' +
        '<span style="color:' + color + '">' + icon + '</span> ' + title + '</div>' +
        '<ul>' + items.map(i => '<li>' + i + '</li>').join('') + '</ul></div>';
}

// ── IMPROVE RESUME ─────────────────────────────────────────────
async function handleImprove() {
    if (!lastAnalysisResult) return;
    el('improveBtn').disabled = true;
    el('improveContent').style.display = 'none';
    show('improveOutput');
    show('improveLoading');
    el('improveOutput').scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        el('improveStatus').textContent = 'AI is rewriting your resume...';
        const resp = await fetch('http://127.0.0.1:3000/improve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                resumeText: extractedResumeText,
                jobRole: lastJobRole,
                analysisResult: lastAnalysisResult
            })
        });
        if (!resp.ok) { const e = await resp.json(); throw new Error(e.error); }
        const result = await resp.json();
        hide('improveLoading');
        renderImprove(result);
    } catch (err) {
        hide('improveLoading');
        show('errorCard');
        el('errorMessage').innerHTML = '<strong>Improve error:</strong> ' + err.message;
    }
    el('improveBtn').disabled = false;
}

function renderImprove(result) {
    el('oldScore').textContent = lastAnalysisResult.overall_score || '—';
    el('newScore').textContent = result.new_ats_score || '90+';
    el('originalResumeText').textContent = extractedResumeText;
    el('improvedResumeText').textContent = result.improved_resume || '';
    el('changesList').innerHTML = (result.changes_made || [])
        .map(c => '<li>' + c + '</li>').join('');
    el('keywordsAdded').innerHTML = (result.keywords_added || []).map(k =>
        '<span style="background:#c8f55a12;border:1px solid #c8f55a33;color:#c8f55a;' +
        'font-size:11px;padding:3px 10px;border-radius:100px;">' + k + '</span>'
    ).join('');
    el('improveContent').style.display = 'block';
    el('improveContent').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function copyImprovedResume() {
    const text = el('improvedResumeText').textContent;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = '✓ Copied to clipboard!';
        setTimeout(() => btn.textContent = '📋 Copy Improved Resume to Clipboard', 2000);
    });
}

// ── VISUAL DASHBOARD ───────────────────────────────────────────
async function handleDashboard() {
    if (!lastAnalysisResult) return;
    el('dashboardBtn').disabled = true;
    el('dashboardContent').style.display = 'none';
    show('dashboardOutput');
    show('dashboardLoading');
    el('dashboardOutput').scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        const resp = await fetch('http://127.0.0.1:3000/dashboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ analysisResult: lastAnalysisResult, jobRole: lastJobRole })
        });
        if (!resp.ok) { const e = await resp.json(); throw new Error(e.error); }
        const data = await resp.json();
        hide('dashboardLoading');
        renderDashboard(data);
    } catch (err) {
        hide('dashboardLoading');
        show('errorCard');
        el('errorMessage').innerHTML = '<strong>Dashboard error:</strong> ' + err.message;
    }
    el('dashboardBtn').disabled = false;
}

function renderDashboard(data) {
    el('statCurrent').textContent = data.summary.current_score;
    el('statImproved').textContent = data.summary.improved_score;
    el('statGaps').textContent = data.summary.skills_missing;

    if (pieChart) { pieChart.destroy(); pieChart = null; }
    if (barChart) { barChart.destroy(); barChart = null; }
    if (radar) { radar.destroy(); radar = null; }

    pieChart = new Chart(el('skillsPieChart'), {
        type: 'doughnut',
        data: {
            labels: data.skills_pie.labels,
            datasets: [{ data: data.skills_pie.values, backgroundColor: data.skills_pie.colors, borderWidth: 0 }]
        },
        options: { plugins: { legend: { labels: { color: '#888580', font: { size: 11 } } } }, cutout: '65%' }
    });

    barChart = new Chart(el('scoreBarChart'), {
        type: 'bar',
        data: {
            labels: data.score_comparison.labels,
            datasets: [{
                data: data.score_comparison.values,
                backgroundColor: data.score_comparison.colors,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                y: { min: 0, max: 100, grid: { color: '#2a2a2e' }, ticks: { color: '#888580' } },
                x: { grid: { display: false }, ticks: { color: '#888580' } }
            }
        }
    });

    radar = new Chart(el('radarChart'), {
        type: 'radar',
        data: {
            labels: data.skill_radar.labels,
            datasets: [{
                label: 'Your Profile',
                data: data.skill_radar.values,
                backgroundColor: '#c8f55a22',
                borderColor: '#c8f55a',
                borderWidth: 2,
                pointBackgroundColor: '#c8f55a'
            }]
        },
        options: {
            plugins: { legend: { labels: { color: '#888580' } } },
            scales: {
                r: {
                    min: 0, max: 100,
                    grid: { color: '#2a2a2e' },
                    ticks: { display: false },
                    pointLabels: { color: '#888580', font: { size: 11 } }
                }
            }
        }
    });

    el('dashboardContent').style.display = 'block';
    el('dashboardContent').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── INTERVIEW QUESTIONS ────────────────────────────────────────
async function handleInterview() {
    if (!lastAnalysisResult) return;
    el('interviewBtn').disabled = true;
    el('interviewContent').style.display = 'none';
    show('interviewOutput');
    show('interviewLoading');
    el('interviewOutput').scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        el('interviewStatus').textContent = 'Generating questions for ' + lastJobRole + '...';
        const resp = await fetch('http://127.0.0.1:3000/interview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                resumeText: extractedResumeText,
                jobRole: lastJobRole,
                analysisResult: lastAnalysisResult
            })
        });
        if (!resp.ok) { const e = await resp.json(); throw new Error(e.error); }
        const result = await resp.json();
        hide('interviewLoading');
        renderInterview(result);
    } catch (err) {
        hide('interviewLoading');
        show('errorCard');
        el('errorMessage').innerHTML = '<strong>Interview error:</strong> ' + err.message;
    }
    el('interviewBtn').disabled = false;
}

function renderInterview(result) {
    el('interviewRoleBadge').textContent = lastJobRole;
    ['technical', 'behavioral', 'role_specific'].forEach(cat => {
        const questions = result[cat] || [];
        el('questions-' + cat).innerHTML = questions.map(q =>
            '<div class="question-card">' +
            '<div class="question-text">' + q.question + '</div>' +
            '<div class="question-tip">' + q.tip + '</div>' +
            '</div>'
        ).join('');
    });
    el('prepTipsList').innerHTML = (result.preparation_tips || [])
        .map(t => '<li>' + t + '</li>').join('');
    el('interviewContent').style.display = 'block';
    el('interviewContent').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function switchTab(cat, btn) {
    document.querySelectorAll('.itab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.interview-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    el('panel-' + cat).classList.add('active');
}

// ── Reset ──────────────────────────────────────────────────────
function resetForm() {
    hide('resultsOutput'); hide('errorCard'); hide('actionButtons');
    hide('improveOutput'); hide('dashboardOutput'); hide('interviewOutput');
    show('resultsPlaceholder');
    removeFile();
    el('jobRole').value = '';
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    lastAnalysisResult = null; lastJobRole = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}