// ─────────────────────────────────────────────────────────────────
//  server.js  —  AI Resume Analyzer Backend (Ollama, FREE)
//
//  ROUTES:
//    GET  /           → health check
//    GET  /roles      → list all roles from dataset
//    POST /analyze    → analyze resume → score, gaps, strengths
//    POST /improve    → rewrite resume for 90+ ATS score
//    POST /interview  → generate categorized interview questions
//    POST /match      → match resume against a job description
//    POST /dashboard  → chart data for visual dashboard
//
//  HOW TO RUN:
//    node server.js
// ─────────────────────────────────────────────────────────────────

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// ── CORS fix ──────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '5mb' }));

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'llama3.2';

// ─────────────────────────────────────────────────────────────────
//  Load skills dataset
// ─────────────────────────────────────────────────────────────────
let skillsDataset = { roles: [] };
try {
  const raw = fs.readFileSync(path.join(__dirname, 'skills-dataset.json'), 'utf-8');
  skillsDataset = JSON.parse(raw);
  console.log('  📊  Dataset loaded:', skillsDataset.roles.length, 'roles');
} catch (e) {
  console.warn('  ⚠️   skills-dataset.json not found — AI uses general knowledge');
}

function findRoleData(jobRole) {
  if (!jobRole) return null;
  const s = jobRole.toLowerCase().trim();
  return skillsDataset.roles.find(r =>
    r.role.toLowerCase().includes(s) || s.includes(r.role.toLowerCase())
  );
}

// ─────────────────────────────────────────────────────────────────
//  COMMON: Call Ollama AI
// ─────────────────────────────────────────────────────────────────
async function callOllama(prompt, maxTokens = 1000) {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: maxTokens
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error('Ollama error: ' + err);
  }

  const data = await response.json();
  return data.response || '';
}

// ─────────────────────────────────────────────────────────────────
//  COMMON: Sanitize raw AI text before JSON.parse
//
//  THE CORE FIX:
//  Ollama sometimes returns the improved_resume field with REAL
//  newline/tab/carriage-return characters embedded inside the JSON
//  string value. JSON spec forbids raw control chars inside strings,
//  so JSON.parse throws:
//    "Bad control character in string literal in JSON at position N"
//
//  Strategy:
//  1. Strip markdown fences
//  2. Find the outermost { ... } block
//  3. Walk char-by-char, tracking whether we are INSIDE a JSON string
//     - Inside a string  → escape any raw control chars safely
//     - Outside a string → leave as-is (structural characters)
//  4. Parse the sanitized string
// ─────────────────────────────────────────────────────────────────
function sanitizeJSONString(raw) {
  // Step 1 – strip markdown fences
  let cleaned = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  // Step 2 – find the outermost JSON object
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('AI did not return valid JSON. Please try again.');
  }
  cleaned = cleaned.slice(start, end + 1);

  // Step 3 – walk character by character and fix control chars inside strings
  let result = '';
  let inString = false;
  let escaped = false;   // previous char was backslash

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const code = cleaned.charCodeAt(i);

    if (escaped) {
      // Previous char was \  → this char is already escaped, pass through
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      // Backslash → next char is escaped
      result += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      // Toggle string mode
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString) {
      // We are inside a JSON string value — control chars MUST be escaped
      if (ch === '\n') { result += '\\n'; continue; }
      else if (ch === '\r') { result += '\\r'; continue; }
      else if (ch === '\t') { result += '\\t'; continue; }
      else if (code < 0x20) {
        // Other ASCII control chars (bell, form-feed, etc.) — just drop them
        continue;
      }
    }

    result += ch;
  }

  return result;
}

function extractJSON(raw) {
  const sanitized = sanitizeJSONString(raw);
  return JSON.parse(sanitized);
}

// ─────────────────────────────────────────────────────────────────
//  GET /  — Health check
// ─────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    model: MODEL,
    routes: ['/analyze', '/improve', '/interview', '/match', '/dashboard'],
    roles: skillsDataset.roles.length
  });
});

// ─────────────────────────────────────────────────────────────────
//  GET /roles
// ─────────────────────────────────────────────────────────────────
app.get('/roles', (req, res) => {
  res.json({ roles: skillsDataset.roles.map(r => r.role) });
});

// ─────────────────────────────────────────────────────────────────
//  POST /analyze
// ─────────────────────────────────────────────────────────────────
app.post('/analyze', async (req, res) => {
  const { resumeText, jobRole } = req.body;

  if (!resumeText || !jobRole)
    return res.status(400).json({ error: 'Missing resumeText or jobRole' });

  if (resumeText.trim().length < 20)
    return res.status(400).json({ error: 'Resume text is too short.' });

  const roleData = findRoleData(jobRole);
  const datasetCtx = roleData
    ? `SKILLS DATASET FOR "${roleData.role}":
- Required Skills : ${roleData.required_skills.join(', ')}
- Core Skills     : ${roleData.core_skills.join(', ')}
- Nice to Have    : ${roleData.nice_to_have.join(', ')}
- Experience      : ${roleData.experience_years} years
- Avg Salary (IN) : ${roleData.avg_salary_lpa} LPA
Use this dataset to identify EXACTLY which required skills are present vs missing.`
    : `No dataset entry for "${jobRole}" — use your general industry knowledge.`;

  const prompt = `You are an expert ATS resume analyst and career coach in India.
Analyze this resume for the role: "${jobRole}".

${datasetCtx}

Return ONLY a raw JSON object. No markdown. No explanation. Just JSON:
{
  "overall_score"  : <number 0-100>,
  "score_label"    : "<Poor|Fair|Good|Strong|Excellent>",
  "summary"        : "<2-3 sentence assessment>",
  "strengths"      : ["<s1>","<s2>","<s3>"],
  "weaknesses"     : ["<w1>","<w2>","<w3>"],
  "skills_gap"     : ["<missing skill 1>","<missing skill 2>","<missing skill 3>"],
  "skills_present" : ["<skill found in resume>","<skill>","<skill>","<skill>","<skill>"],
  "ats_tips"       : ["<tip 1>","<tip 2>","<tip 3>"],
  "career_paths"   : ["<path 1>","<path 2>","<path 3>"]
}

Resume:
${resumeText}

ONLY JSON. Nothing else.`;

  try {
    console.log('\n[/analyze] Role:', jobRole, '| Dataset:', roleData ? 'YES ✓' : 'NO');
    const raw = await callOllama(prompt, 900);
    const result = extractJSON(raw);

    if (roleData) {
      result.dataset_match = true;
      result.required_skills = roleData.required_skills;
      result.core_skills = roleData.core_skills;
      result.nice_to_have = roleData.nice_to_have;
      result.salary_range = roleData.avg_salary_lpa + ' LPA';
      result.experience = roleData.experience_years + ' years';
    }

    console.log('[/analyze] Score:', result.overall_score);
    res.json(result);

  } catch (err) {
    console.error('[/analyze] Error:', err.message);
    let msg = err.message;
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch'))
      msg = 'Cannot connect to Ollama. Make sure it is running and llama3.2 is pulled.';
    res.status(500).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────────
//  POST /improve  ← THIS IS WHERE THE BUG WAS
//
//  The improved_resume field is a large multi-line text block.
//  Ollama often embeds real \n characters directly inside the JSON
//  string, which breaks JSON.parse.
//  The new extractJSON() with sanitizeJSONString() fixes this.
// ─────────────────────────────────────────────────────────────────
app.post('/improve', async (req, res) => {
  const { resumeText, jobRole, analysisResult } = req.body;

  if (!resumeText || !jobRole)
    return res.status(400).json({ error: 'Missing resumeText or jobRole' });

  const roleData = findRoleData(jobRole);
  const skillsCtx = roleData
    ? `Required skills for ${jobRole}: ${roleData.required_skills.join(', ')}`
    : '';
  const gapsCtx = analysisResult?.skills_gap?.length
    ? `Skills currently missing: ${analysisResult.skills_gap.join(', ')}`
    : '';

  // NOTE: We explicitly tell the model to use \n (two chars: backslash + n)
  // for line breaks, NOT actual newlines, so the JSON stays valid.
  const prompt = `You are an expert resume writer and ATS optimization specialist.

Rewrite the resume below for the role: "${jobRole}" to achieve a 90+ ATS score.
${skillsCtx}
${gapsCtx}

Rules:
1. Keep ALL real experience and facts — do NOT invent fake jobs or degrees
2. Add missing keywords NATURALLY into existing experience descriptions
3. Use strong action verbs: Developed, Implemented, Optimized, Led, Built, Designed, Achieved
4. Quantify achievements where possible (e.g. "Improved performance by 30%")
5. Add a Skills section with all required keywords listed
6. Use clean ATS-friendly structure: no tables, no columns, no graphics
7. Add a Professional Summary at the top tailored to the role
8. Keep it concise — 1 to 2 pages maximum

CRITICAL JSON RULES:
- Return ONLY a raw JSON object — no markdown, no explanation
- In the improved_resume value, represent every line break as the TWO characters backslash-n (\\n), NOT a real newline character
- Never put actual newline or tab characters inside any JSON string value

{
  "improved_resume" : "<full improved resume — use \\\\n for line breaks, NOT real newlines>",
  "new_ats_score"   : <estimated score between 90 and 98>,
  "changes_made"    : ["<change 1>","<change 2>","<change 3>","<change 4>","<change 5>"],
  "keywords_added"  : ["<keyword1>","<keyword2>","<keyword3>","<keyword4>","<keyword5>"]
}

Original Resume:
${resumeText}

ONLY JSON. Nothing else.`;

  try {
    console.log('\n[/improve] Improving resume for:', jobRole);
    const raw = await callOllama(prompt, 2000);   // bumped tokens for full resume
    const result = extractJSON(raw);

    // Convert escaped \n back into real newlines for the frontend display
    if (result.improved_resume) {
      result.improved_resume = result.improved_resume
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t');
    }

    console.log('[/improve] New ATS score:', result.new_ats_score);
    res.json(result);

  } catch (err) {
    console.error('[/improve] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
//  POST /interview
// ─────────────────────────────────────────────────────────────────
app.post('/interview', async (req, res) => {
  const { resumeText, jobRole, analysisResult } = req.body;

  if (!resumeText || !jobRole)
    return res.status(400).json({ error: 'Missing resumeText or jobRole' });

  const strengthsCtx = analysisResult?.strengths?.length
    ? `Candidate strengths: ${analysisResult.strengths.join(', ')}`
    : '';

  const prompt = `You are a senior technical interviewer at a top Indian tech company.
Generate interview questions for a "${jobRole}" candidate based on their resume.
${strengthsCtx}

Return ONLY raw JSON. No markdown. No explanation:
{
  "technical": [
    { "question": "<technical question based on skills in resume>", "tip": "<what interviewer looks for in the answer>" },
    { "question": "<question>", "tip": "<tip>" },
    { "question": "<question>", "tip": "<tip>" },
    { "question": "<question>", "tip": "<tip>" },
    { "question": "<question>", "tip": "<tip>" }
  ],
  "behavioral": [
    { "question": "<behavioral/situational question>", "tip": "<suggest using STAR method: Situation Task Action Result>" },
    { "question": "<question>", "tip": "<tip>" },
    { "question": "<question>", "tip": "<tip>" }
  ],
  "role_specific": [
    { "question": "<question specific to ${jobRole}>", "tip": "<tip>" },
    { "question": "<question>", "tip": "<tip>" },
    { "question": "<question>", "tip": "<tip>" }
  ],
  "preparation_tips": [
    "<tip 1>",
    "<tip 2>",
    "<tip 3>"
  ]
}

Resume:
${resumeText}

ONLY JSON. Nothing else.`;

  try {
    console.log('\n[/interview] Generating questions for:', jobRole);
    const raw = await callOllama(prompt, 1200);
    const result = extractJSON(raw);
    console.log('[/interview] Technical questions:', result.technical?.length);
    res.json(result);
  } catch (err) {
    console.error('[/interview] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
//  POST /match
// ─────────────────────────────────────────────────────────────────
app.post('/match', async (req, res) => {
  const { resumeText, jobDescription } = req.body;

  if (!resumeText || !jobDescription)
    return res.status(400).json({ error: 'Missing resumeText or jobDescription' });

  const prompt = `You are an expert ATS (Applicant Tracking System) and job matching specialist.

Compare the resume below against the job description.

Return ONLY raw JSON. No markdown. No explanation:
{
  "match_score"     : <number 0-100, how well resume matches the job>,
  "match_label"     : "<Poor|Fair|Good|Strong|Excellent> Match",
  "matching_skills" : ["<skill found in both resume and JD>","<skill>","<skill>","<skill>","<skill>"],
  "missing_skills"  : ["<skill in JD but NOT in resume>","<skill>","<skill>","<skill>"],
  "suggestions"     : ["<how to tailor resume for this job>","<suggestion>","<suggestion>","<suggestion>"],
  "verdict"         : "<2-3 sentences: should they apply? what to fix first?>"
}

Resume:
${resumeText}

Job Description:
${jobDescription}

ONLY JSON. Nothing else.`;

  try {
    console.log('\n[/match] Matching resume against job description...');
    const raw = await callOllama(prompt, 900);
    const result = extractJSON(raw);
    console.log('[/match] Match score:', result.match_score);
    res.json(result);
  } catch (err) {
    console.error('[/match] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
//  POST /dashboard
// ─────────────────────────────────────────────────────────────────
app.post('/dashboard', async (req, res) => {
  const { analysisResult, jobRole } = req.body;

  if (!analysisResult)
    return res.status(400).json({ error: 'Missing analysisResult' });

  try {
    const score = analysisResult.overall_score || 0;
    const haveCount = (analysisResult.skills_present || analysisResult.strengths || []).length;
    const missCount = (analysisResult.skills_gap || []).length;
    const niceCount = (analysisResult.nice_to_have || []).length;

    const dashboard = {
      skills_pie: {
        labels: ['Skills You Have', 'Skills Missing', 'Nice to Have'],
        values: [Math.max(haveCount, 3), Math.max(missCount, 1), Math.max(niceCount, 2)],
        colors: ['#c8f55a', '#e07070', '#7eb8f5']
      },
      score_comparison: {
        labels: ['Your Current Resume', 'After Improvement'],
        values: [score, Math.min(score + 25, 96)],
        colors: ['#f5c842', '#c8f55a']
      },
      skill_radar: {
        labels: ['Technical Skills', 'Experience', 'Keywords', 'Formatting', 'Achievements', 'Education'],
        values: [
          Math.min(score + 5, 100),
          Math.max(score - 10, 20),
          Math.max(score - 5, 30),
          Math.min(score + 10, 95),
          Math.max(score - 15, 25),
          Math.min(score + 8, 90)
        ]
      },
      summary: {
        current_score: score,
        improved_score: Math.min(score + 25, 96),
        skills_present: haveCount,
        skills_missing: missCount,
        strengths_count: (analysisResult.strengths || []).length,
        gaps_count: missCount
      }
    };

    console.log('\n[/dashboard] Chart data built for:', jobRole);
    res.json(dashboard);

  } catch (err) {
    console.error('[/dashboard] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
//  START SERVER
// ─────────────────────────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, () => {
  console.log('');
  console.log('  ✅  Server running at http://localhost:' + PORT);
  console.log('  🤖  Model:', MODEL);
  console.log('  📊  Dataset roles:', skillsDataset.roles.length);
  console.log('');
  console.log('  Available routes:');
  console.log('    GET  /           → health check');
  console.log('    GET  /roles      → all job roles');
  console.log('    POST /analyze    → resume analysis');
  console.log('    POST /improve    → rewrite for 90+ ATS  ← FIXED ✓');
  console.log('    POST /interview  → interview questions');
  console.log('    POST /match      → match vs job description');
  console.log('    POST /dashboard  → chart data');
  console.log('');
  console.log('  Open phase1.html in your browser!');
  console.log('');
});