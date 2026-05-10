# 🤖 AI Resume Analyzer

An AI-powered resume analysis tool built with **Node.js**, **Express**, and **Ollama (llama3.2)**. Upload your resume and get instant ATS scoring, skills gap analysis, a visual dashboard, and role-specific interview questions — all running **100% locally** on your machine.

---

## ✨ Features

- 📄 **Resume Upload** — Supports PDF, DOCX, and TXT formats
- 🎯 **ATS Score** — Real AI analysis of your resume against a target job role
- ✅ **Strengths & Weaknesses** — Specific feedback based on your actual resume content
- △ **Skills Gap Analysis** — Shows exactly what skills you're missing for the role
- 📊 **Visual Dashboard** — Doughnut, bar, and radar charts for your profile
- 🎯 **Interview Questions** — Role-specific questions across Technical, Behavioral, and Role-Specific tabs
- 💊 **Role Pills** — Quick-select for common job roles

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| AI Model | Ollama (llama3.2) — runs locally |
| PDF Parsing | PDF.js |
| DOCX Parsing | Mammoth.js |
| Charts | Chart.js |

---

## 📋 Prerequisites

Make sure you have these installed before running the project:

- [Node.js](https://nodejs.org/) v18 or higher
- [Ollama](https://ollama.com/) installed and running
- llama3.2 model pulled via Ollama

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/ai-resume-analyzer.git
cd ai-resume-analyzer
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start Ollama and pull the model

```bash
ollama pull llama3.2
ollama serve
```

### 4. Start the backend server

```bash
node server.js
```

You should see:
```
🚀 SERVER RUNNING
🌐 http://localhost:3000
🤖 MODEL: llama3.2
🦙 OLLAMA: CONNECTED
```

### 5. Open the frontend

Open `index.html` with **Live Server** (VS Code extension) or any static file server.

The app will be available at:
```
http://127.0.0.1:5500/index.html
```

> ⚠️ Make sure the `API` variable in `script.js` points to `http://localhost:3000`

---

## 📁 Project Structure

```
ai-resume-analyzer/
├── index.html          # Frontend UI
├── styles.css          # Styling
├── script.js           # Frontend logic
├── server.js           # Express backend + Ollama integration
├── package.json        # Dependencies
└── README.md           # This file
```

---

## 🎯 Supported Job Roles

The interview question engine has built-in, role-specific question banks for:

- 🤖 AIML Engineer
- 💻 Software Engineer
- 📊 Data Analyst
- 🔬 Data Scientist
- ⚙️ DevOps Engineer
- 📦 Product Manager
- 🎨 UX Designer

---

## 📊 How It Works

1. User uploads a resume (PDF/DOCX/TXT)
2. Frontend extracts text using PDF.js or Mammoth.js
3. Text is sent to the Express backend at `localhost:3000`
4. Backend sends a structured prompt to Ollama (llama3.2)
5. AI returns JSON with score, strengths, weaknesses, skills gap, and tips
6. Frontend renders the results with animations and charts

---

## ⚙️ Configuration

To change the AI model, update `server.js`:

```js
const MODEL = 'llama3.2'; // Change to any Ollama model
```

To change the backend port:

```js
const PORT = 3000;
```

And update `script.js` to match:

```js
const API = 'http://localhost:3000';
```

---

## 🐛 Common Issues

| Issue | Fix |
|-------|-----|
| `Cannot connect to Ollama` | Run `ollama serve` in a terminal |
| `timeout of 180000ms exceeded` | Ollama is slow — use a lighter model or increase RAM |
| `Failed to fetch` | Make sure `server.js` is running on port 3000 |
| Resume shows `s1, s2, g1` | Outdated server.js — pull the latest version |
| Dashboard crashes | Update server.js — old version had a broken `/dashboard` response structure |

---

## 🙌 Acknowledgements

- [Ollama](https://ollama.com/) for making local LLMs easy
- [PDF.js](https://mozilla.github.io/pdf.js/) by Mozilla
- [Mammoth.js](https://github.com/mwilliamson/mammoth.js) for DOCX parsing
- [Chart.js](https://www.chartjs.org/) for beautiful charts

---

## 📄 License

MIT License — feel free to use, modify, and share.

---

> Built with ❤️ by G SHANMUKHA AKHILESH(https://github.com/shanmukha0527)
