# 🎙️ LecNote AI — Voice Lecture Recorder & Interactive Note-Taker

**LecNote AI** is an offline-first, production-ready Progressive Web App (PWA) designed for students, academics, and researchers. It provides interactive, word-level audio transcription, karaoke playback synchronization, user highlighting, and AI-powered study summaries for **Bangla (বাংলা)**, **English**, and **mixed Banglish** classroom lectures — **100% free of cost with local browser storage (`IndexedDB`)**.

---

## 🌟 Key Highlights & Core Capabilities

### 1. ⚡ 100% Keyless Default Engine (Zero API Keys Required)
* **Out-of-the-Box Operation:** Works immediately without asking for user API keys or registrations.
* **Browser Web Speech API (`webkitSpeechRecognition`):** Live streaming voice transcription directly inside the browser.
* **Smart Syllable-Weighted Alignment Engine:** Automatically tracks word-level start & end timestamps (`{ id, word, startTime, endTime, isHighlighted }`).
* **Local Extractive AI Summarizer:** Generates structured bullet points, key takeaways, and highlighted formulas offline using zero-cost client-side NLP.

### 2. 🗄️ Local-First Storage (`IndexedDB`)
* Built on `idb` for browser-native database storage.
* Stores full audio blobs (`.wav` / `.webm`), word arrays with microsecond timestamps, user highlights, and study notes directly on the device.
* No external server database or cloud costs required.

### 3. 🎤 Live Recording Studio & Audio Visualizer
* Record, Pause, Resume, and Stop controls with live timer.
* Real-time HTML5 Canvas waveform visualizer that reacts to live microphone audio frequencies.
* Language selection: **Bangla (`bn-BD`)**, **English (`en-US`)**, and **Mixed Banglish (`auto`)**.

### 4. 🎵 Interactive Tap-to-Seek & Karaoke Playback
* **Tap-to-Seek:** Tap or click *any* word in the written transcript to jump the audio player to that exact millisecond, displaying a floating timestamp badge (e.g. `Jumped to 00:06`).
* **Karaoke Sync:** Active words glow in real time as the lecturer speaks.
* **Audio Controls:** Play/Pause, Rewind/Fast Forward 5s, 0.75x–2.0x playback speed, and interactive timeline scrubber.

### 5. ✏️ Word Highlighting & Inline Double-Click Editing
* **Highlight Marker Toggle:** Tap or drag across words with Yellow or Emerald highlighters to mark key terms for exam preparation. Highlighting updates IndexedDB instantly.
* **Inline Spelling Correction:** Double-click any word to edit spelling or misrecognized words without breaking timestamp synchronization.

### 6. 🚀 Optional Cloud AI Boost (Groq / Gemini)
* Auto-detects keys from `.env` or allows users to paste free Groq / Gemini API keys anytime.
* Provides **Groq Whisper Large v3** word-level granularity and **Llama 3.3 70B / Gemini 1.5 Flash** academic summaries.
* Automatic graceful fallback to the local engine if network drops or quotas are reached.

### 7. 📤 Serverless Sharing & Export
* **Web Share API (`navigator.share`):** One-click share of audio and notes to WhatsApp, AirDrop, Telegram, or Drive.
* **Portable Bundle (`.lecnote.json`):** Export full interactive lecture sessions (including audio) into a single portable file that classmates can import into their own browsers.
* **Document Exports:** Export formatted PDF notes with summaries and timestamps, or plain text / markdown.

---

## 🚀 Quick Start Guide

### 1. Start the Development Server
```bash
npm run dev
```
Open **[http://localhost:5188](http://localhost:5188)** in your browser.

### 2. Run the Autonomous End-to-End Test Suite
```bash
npm run test:e2e
```
This runs automated Playwright browser tests that verify:
1. Sample lecture loading into `IndexedDB`.
2. Interactive word token rendering.
3. Tap-to-Seek jumps audio to the exact second (`mm:ss`) with floating badge.
4. Word highlight persistence in `IndexedDB`.
5. Inline double-click spelling updates.
6. Local summary generation and key takeaway extraction.
7. Export modal (.lecnote.json, PDF, TXT).
8. Cloud AI boost modal & key auto-detection.
9. Live recording studio & saving new notes.

### 3. Production Build
```bash
npm run build
npm run preview
```

---

## 📂 Project Architecture

```
├── public/
│   ├── icon.svg               # App branding vector icon
│   ├── pwa-192x192.png        # PWA Icon 192x192
│   ├── pwa-512x512.png        # PWA Icon 512x512
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── AudioWaveform.jsx  # HTML5 Canvas real-time visualizer
│   │   ├── KaraokePlayer.jsx  # Synchronized audio player & timeline
│   │   ├── TranscriptView.jsx # Word-level tokens, tap-to-seek, highlighter
│   │   ├── SummaryView.jsx    # Key takeaways, action items, quotes
│   │   ├── RecordModal.jsx    # Live studio recording & mic capture
│   │   ├── CloudAiModal.jsx   # One-click Groq/Gemini key settings
│   │   └── ExportModal.jsx    # Web Share API, .lecnote.json, PDF & TXT
│   ├── services/
│   │   ├── db.js              # IndexedDB store (idb wrapper)
│   │   ├── audioUtils.js      # Synthesizer, WAV generator, Base64 & time
│   │   ├── sampleLecture.js   # Pre-configured realistic Banglish lecture
│   │   ├── speechRecognition.js # Web Speech + syllable timestamp alignment
│   │   └── summarizer.js      # Extractive local NLP + Cloud AI
│   ├── App.jsx                # Main application interface
│   ├── main.jsx               # PWA service worker registration & entry
│   └── index.css              # Tailwind CSS & karaoke highlight styles
├── .env                       # Optional Cloud AI configuration
├── test-e2e.mjs               # Autonomous Playwright E2E verification
├── vite.config.js             # Vite + PWA configuration
└── package.json
```

---

## 🔒 Privacy & Offline Guarantee
All recordings and notes remain **100% on the local device** inside IndexedDB. No audio or transcriptions are sent to any remote server unless the user explicitly configures a personal Cloud AI key.
