# 🚀 AI Resume Analyzer

An intelligent web application that analyzes resumes using AI and provides ATS score, skill gaps, improvements, and interview preparation.

---

## 📌 Features

* 🔍 **Resume Analysis**
  Evaluates resumes and gives an ATS score (0–100)

* 📊 **Skill Gap Detection**
  Identifies missing skills based on job role

* ✨ **Resume Improvement**
  Rewrites resume to achieve 90+ ATS score

* 🎯 **Job Role Matching**
  Matches resume with specific job roles

* 📈 **Dashboard Visualization**
  Displays insights using charts

* 💬 **Interview Preparation**
  Generates technical and HR questions

---

## 🛠️ Tech Stack

### Frontend

* HTML5
* CSS3
* JavaScript
* Chart.js

### Backend

* Node.js
* Express.js
* CORS

### AI Integration

* Ollama (LLaMA 3.2 Model)

---

## 📂 Project Structure

```
AI-Resume-Analyzer/
│
├── phase1.html        # Frontend UI
├── server.js          # Backend API
├── servernew.js       # Updated backend version
├── package.json       # Dependencies
├── package-lock.json
└── README.md
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone Repository

```bash
git clone https://github.com/shanmukha0527/Resume_Analyzer.git
cd Resume_Analyzer
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Run Backend Server

```bash
node server.js
```

---

## 🧠 Run AI Model (Important)

Make sure Ollama is installed and running:

```bash
ollama run llama3.2
```

---

## 🌐 Run Frontend

Open `phase1.html` in browser
OR use Live Server in VS Code

---

## 🔗 API Endpoints

| Method | Endpoint   | Description                  |
| ------ | ---------- | ---------------------------- |
| POST   | /analyze   | Analyze resume               |
| POST   | /improve   | Improve resume               |
| POST   | /interview | Generate interview questions |
| POST   | /match     | Match resume with job role   |
| POST   | /dashboard | Generate analytics data      |

---

## 📸 Screenshots

(Add your project screenshots here)

---

## 🚀 Future Enhancements

* User authentication (Login/Signup)
* Cloud deployment (Render / Vercel)
* Database integration
* File upload storage

---

## 👨‍💻 Author

**Shanmukha Akhilesh**
📧 [akhileshgondrala27@gmail.com](mailto:akhileshgondrala27@gmail.com)
🔗 LinkedIn: (Add your LinkedIn link)

---

## ⭐ Support

If you like this project, give it a ⭐ on GitHub!

---
