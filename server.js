const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();

const PORT = 3000;
const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';
const MODEL = 'llama3.2';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Load dataset ───────────────────────────────────────────────
let skillsDataset = { roles: [] };
try {
  const raw = fs.readFileSync(path.join(__dirname, 'skills-dataset.json'), 'utf-8');
  skillsDataset = JSON.parse(raw);
  console.log(`📊 Dataset loaded: ${skillsDataset.roles.length} roles`);
} catch (err) {
  console.log('⚠ skills-dataset.json not found');
}

function findRoleData(jobRole) {
  if (!jobRole) return null;
  const role = jobRole.toLowerCase().trim();
  return skillsDataset.roles.find(r =>
    r.role.toLowerCase().includes(role) || role.includes(r.role.toLowerCase())
  );
}

// ── Clean AI response ──────────────────────────────────────────
function cleanAIResponse(text) {
  if (!text) return '';
  let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('AI did not return valid JSON');
  cleaned = cleaned.slice(start, end + 1);
  cleaned = cleaned.replace(/[\u0000-\u0019]+/g, ' ');
  return cleaned;
}

function extractJSON(text) {
  try {
    return JSON.parse(cleanAIResponse(text));
  } catch (err) {
    console.log('RAW AI RESPONSE:\n', text);
    throw new Error('Failed to parse AI JSON response');
  }
}

// ── Ollama ─────────────────────────────────────────────────────
async function testOllama() {
  try {
    await axios.get('http://127.0.0.1:11434/api/tags', { timeout: 5000 });
    return true;
  } catch { return false; }
}

async function callOllama(prompt, maxTokens = 1500) {
  const running = await testOllama();
  if (!running) throw new Error('Cannot connect to Ollama. Make sure it is running and llama3.2 is pulled.');
  try {
    const response = await axios.post(
      OLLAMA_URL,
      { model: MODEL, prompt, stream: false, options: { temperature: 0.3, num_predict: maxTokens } },
      { headers: { 'Content-Type': 'application/json' }, timeout: 180000 }
    );
    return response.data.response || '';
  } catch (err) {
    if (err.code === 'ECONNREFUSED') throw new Error('Ollama server is not running.');
    throw new Error(err.message);
  }
}

// ── Health ─────────────────────────────────────────────────────
app.get('/', async (req, res) => {
  const ollamaRunning = await testOllama();
  res.json({ server: 'running', ollama: ollamaRunning, model: MODEL, dataset_roles: skillsDataset.roles.length });
});

app.get('/roles', (req, res) => {
  res.json({ roles: skillsDataset.roles.map(r => r.role) });
});

// ── ANALYZE ────────────────────────────────────────────────────
app.post('/analyze', async (req, res) => {
  try {
    const { resumeText, jobRole } = req.body;
    if (!resumeText || !jobRole) return res.status(400).json({ error: 'Missing resumeText or jobRole' });

    const roleData = findRoleData(jobRole);

    const prompt = `You are an expert ATS resume analyzer. Carefully read the resume below and analyze it for the "${jobRole}" role.

CRITICAL RULES:
- Base your analysis ONLY on what is actually written in the resume
- Do NOT use placeholder text like s1, s2, w1, g1, etc.
- Write specific, real observations about this candidate
- All strings must be actual meaningful sentences

Return ONLY valid JSON, no extra text:

{
  "overall_score": <integer 0-100 reflecting real ATS match for ${jobRole}>,
  "score_label": "<one of: Weak / Fair / Good / Strong / Excellent>",
  "summary": "<2-3 sentences describing this specific candidate's profile and fit for ${jobRole}>",
  "strengths": [
    "<real strength from this resume relevant to ${jobRole}>",
    "<real strength from this resume relevant to ${jobRole}>",
    "<real strength from this resume relevant to ${jobRole}>"
  ],
  "weaknesses": [
    "<real gap or weakness in this resume for ${jobRole}>",
    "<real gap or weakness in this resume for ${jobRole}>",
    "<real gap or weakness in this resume for ${jobRole}>"
  ],
  "skills_gap": [
    "<important skill for ${jobRole} not found in resume>",
    "<important skill for ${jobRole} not found in resume>",
    "<important skill for ${jobRole} not found in resume>"
  ],
  "skills_present": [
    "<actual technical skill found in resume>",
    "<actual technical skill found in resume>",
    "<actual technical skill found in resume>",
    "<actual technical skill found in resume>",
    "<actual technical skill found in resume>"
  ],
  "ats_tips": [
    "<specific actionable improvement for this resume's ATS score>",
    "<specific actionable improvement for this resume's ATS score>",
    "<specific actionable improvement for this resume's ATS score>"
  ],
  "career_paths": [
    "<career path suitable for this candidate and ${jobRole}>",
    "<career path suitable for this candidate and ${jobRole}>",
    "<career path suitable for this candidate and ${jobRole}>"
  ]
}

Resume:
${resumeText.slice(0, 3000)}`;

    const raw = await callOllama(prompt, 1500);
    const result = extractJSON(raw);

    if (roleData) {
      result.dataset_match = true;
      result.required_skills = roleData.required_skills;
    }

    res.json(result);
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── INTERVIEW QUESTIONS (role-specific) ───────────────────────
app.post('/interview', async (req, res) => {
  try {
    const { resumeText, jobRole } = req.body;
    if (!resumeText || !jobRole) return res.status(400).json({ error: 'Missing data' });

    const prompt = `You are a senior technical interviewer at a top tech company. Generate interview questions SPECIFICALLY for a "${jobRole}" candidate.

RULES:
- Every question must be directly relevant to the "${jobRole}" role
- Technical questions must involve real tools, frameworks, or concepts used in "${jobRole}"
- Questions must differ completely from other roles
- Do NOT write generic questions that could apply to any job
- Base some questions on the candidate's actual resume

Return ONLY valid JSON:

{
  "technical": [
    { "question": "<specific technical question for ${jobRole}>", "tip": "<how to answer well>" },
    { "question": "<specific technical question for ${jobRole}>", "tip": "<how to answer well>" },
    { "question": "<specific technical question for ${jobRole}>", "tip": "<how to answer well>" },
    { "question": "<specific technical question for ${jobRole}>", "tip": "<how to answer well>" },
    { "question": "<specific technical question for ${jobRole}>", "tip": "<how to answer well>" }
  ],
  "behavioral": [
    { "question": "<behavioral question relevant to ${jobRole} work>", "tip": "<use STAR method>" },
    { "question": "<behavioral question relevant to ${jobRole} work>", "tip": "<use STAR method>" },
    { "question": "<behavioral question relevant to ${jobRole} work>", "tip": "<use STAR method>" },
    { "question": "<behavioral question relevant to ${jobRole} work>", "tip": "<use STAR method>" }
  ],
  "role_specific": [
    { "question": "<deep ${jobRole} domain question about tools, processes, or decisions>", "tip": "<tip>" },
    { "question": "<deep ${jobRole} domain question>", "tip": "<tip>" },
    { "question": "<deep ${jobRole} domain question>", "tip": "<tip>" },
    { "question": "<deep ${jobRole} domain question>", "tip": "<tip>" }
  ],
  "preparation_tips": [
    "<specific prep tip for ${jobRole} interviews>",
    "<specific prep tip for ${jobRole} interviews>",
    "<specific prep tip for ${jobRole} interviews>",
    "<specific prep tip for ${jobRole} interviews>"
  ]
}

Candidate Resume:
${resumeText.slice(0, 2000)}`;

    const raw = await callOllama(prompt, 2000);
    const result = extractJSON(raw);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DASHBOARD ──────────────────────────────────────────────────
app.post('/dashboard', (req, res) => {
  try {
    const { analysisResult, jobRole } = req.body;
    if (!analysisResult) return res.status(400).json({ error: 'Missing analysisResult' });

    const currentScore = analysisResult.overall_score || 0;
    const improvedScore = Math.min(currentScore + 18, 98);
    const skillsPresent = (analysisResult.skills_present || []).length || 4;
    const skillsMissing = (analysisResult.skills_gap || []).length || 2;
    const weaknesses = (analysisResult.weaknesses || []).length || 2;

    // Radar labels per role
    const role = (jobRole || '').toLowerCase();
    let radarLabels;
    if (role.includes('data scientist')) {
      radarLabels = ['Machine Learning', 'Statistics', 'Python/R', 'Data Viz', 'Research', 'Communication'];
    } else if (role.includes('data analyst')) {
      radarLabels = ['SQL', 'Excel/Sheets', 'Data Viz', 'Statistics', 'Python', 'Reporting'];
    } else if (role.includes('aiml') || role.includes('ai') || role.includes('ml')) {
      radarLabels = ['Deep Learning', 'Python', 'MLOps', 'Mathematics', 'NLP/CV', 'Cloud'];
    } else if (role.includes('devops')) {
      radarLabels = ['CI/CD', 'Docker/K8s', 'Cloud', 'Scripting', 'Monitoring', 'Security'];
    } else if (role.includes('product')) {
      radarLabels = ['Strategy', 'Analytics', 'Leadership', 'Communication', 'Technical', 'UX'];
    } else if (role.includes('ux') || role.includes('design')) {
      radarLabels = ['Figma/Tools', 'Research', 'Prototyping', 'Visual Design', 'Usability', 'Communication'];
    } else if (role.includes('software') || role.includes('developer')) {
      radarLabels = ['Algorithms', 'System Design', 'Frameworks', 'Testing', 'Code Quality', 'Collaboration'];
    } else {
      radarLabels = ['Technical Skills', 'Experience', 'Education', 'Communication', 'Problem Solving', 'Leadership'];
    }

    const base = currentScore;
    const radarValues = radarLabels.map(() =>
      Math.max(20, Math.min(100, Math.round(base + (Math.random() * 30 - 15))))
    );

    res.json({
      summary: {
        current_score: currentScore,
        improved_score: improvedScore,
        skills_missing: skillsMissing
      },
      skills_pie: {
        labels: ['Skills Present', 'Skills Missing', 'Improvement Areas'],
        values: [skillsPresent, skillsMissing, weaknesses],
        colors: ['#c8f55a', '#e07070', '#f5c842']
      },
      score_comparison: {
        labels: ['Your Score', 'After Optimizing', 'Industry Avg'],
        values: [currentScore, improvedScore, 72],
        colors: ['#f5c842', '#c8f55a', '#7eb8f5']
      },
      skill_radar: {
        labels: radarLabels,
        values: radarValues
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── INTERVIEW QUESTIONS (instant, no Ollama timeout) ──────────
app.post("/interview", (req, res) => {
  try {
    const { jobRole } = req.body;
    if (!jobRole) return res.status(400).json({ error: "Missing jobRole" });
    const questions = getRoleQuestions(jobRole);
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── START ──────────────────────────────────────────────────────
app.listen(PORT, async () => {
  const ollamaRunning = await testOllama();
  console.log('');
  console.log('🚀 SERVER RUNNING');
  console.log('🌐 http://localhost:' + PORT);
  console.log('🤖 MODEL:', MODEL);
  console.log('🦙 OLLAMA:', ollamaRunning ? 'CONNECTED' : 'NOT CONNECTED');
  console.log('');
});
