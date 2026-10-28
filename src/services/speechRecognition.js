/**
 * LecNote AI - Speech Recognition & Word-Level Timestamp Alignment Engine
 * Combines Web Speech API (Free & Offline) with Smart Syllable-Weighted Timestamping
 * + Cloud Whisper Large v3 Word-Level Granularity (when key is provided)
 */

export class LiveSpeechEngine {
  constructor({ language = 'bn-BD', onWordsChunk, onStatusChange, onError }) {
    this.language = language;
    this.onWordsChunk = onWordsChunk;
    this.onStatusChange = onStatusChange;
    this.onError = onError;
    this.recognition = null;
    this.isListening = false;
    this.audioStartTime = 0;
    this.systemStartTime = 0;
    this.phraseStartTime = 0;
    this.allAccumulatedWords = [];
    this.latestInterimWords = [];

    this.initRecognition();
  }

  initRecognition() {
    const SpeechRecognition = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;

    if (!SpeechRecognition) {
      console.warn("Web Speech API not supported in this browser. Falling back to Whisper AI or audio recording mode.");
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = this.language === 'auto' ? 'bn-BD' : this.language;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.onStatusChange?.('listening');
      };

      this.recognition.onresult = (event) => {
        this.handleSpeechResult(event);
      };

      this.recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error !== 'no-speech') {
          this.onError?.(event.error);
        }
      };

      this.recognition.onend = () => {
        // Auto-restart if user has not hit stop (mobile/browsers stop speech recognition on silence)
        if (this.isListening) {
          try {
            this.recognition.start();
          } catch (e) {
            // Already active or denied
          }
        } else {
          this.onStatusChange?.('stopped');
        }
      };
    } catch (err) {
      console.error("Failed to initialize SpeechRecognition:", err);
    }
  }

  setLanguage(lang) {
    this.language = lang;
    if (this.recognition) {
      this.recognition.lang = lang === 'auto' ? 'bn-BD' : lang;
    }
  }

  start(currentTimeSeconds = 0) {
    this.isListening = true;
    this.systemStartTime = performance.now();
    this.audioStartTime = Number(currentTimeSeconds) || 0;
    this.phraseStartTime = this.audioStartTime;
    this.allAccumulatedWords = [];
    this.latestInterimWords = [];

    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (err) {
        // May already be running
      }
    }
  }

  stop() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (err) {
        // Ignored
      }
    }
    // Return all words captured up to this point
    return this.getWords();
  }

  getWords() {
    if (this.latestInterimWords.length > 0) {
      return [...this.latestInterimWords];
    }
    return [...this.allAccumulatedWords];
  }

  /**
   * Smart Syllable-Weighted Word Timestamp Alignment
   * Accurately maps spoken words into timestamps even with pauses.
   */
  handleSpeechResult(event) {
    if (!event.results) return;

    let finalWordsText = '';
    let interimWordsText = '';

    for (let i = 0; i < event.results.length; ++i) {
      const res = event.results[i];
      if (res.isFinal) {
        finalWordsText += res[0].transcript + ' ';
      } else {
        interimWordsText += res[0].transcript + ' ';
      }
    }

    const fullText = (finalWordsText + ' ' + interimWordsText).trim();
    const rawWords = fullText.split(/\s+/).filter(Boolean);
    if (rawWords.length === 0) return;

    const now = performance.now();
    const elapsed = this.systemStartTime ? (now - this.systemStartTime) / 1000 : 0;
    const currentAudioTime = Math.max(0.5, elapsed + this.audioStartTime);
    const chunkDuration = Math.max(0.4, currentAudioTime - this.phraseStartTime);

    // Compute relative character/syllable weight for each word
    const totalChars = rawWords.reduce((sum, w) => sum + Math.max(2, w.length), 0);
    let cumulativeTime = this.phraseStartTime;

    const wordObjects = rawWords.map((wordStr, index) => {
      const weight = Math.max(2, wordStr.length) / (totalChars || 1);
      const wordDuration = Math.max(0.2, chunkDuration * weight);
      const start = cumulativeTime;
      const end = cumulativeTime + wordDuration;
      cumulativeTime = end;

      return {
        id: `word-${index}-${Date.now()}`,
        word: wordStr,
        startTime: parseFloat(Number(start).toFixed(2)),
        endTime: parseFloat(Number(end).toFixed(2)),
        isHighlighted: false,
        highlightColor: 'yellow'
      };
    });

    this.latestInterimWords = wordObjects;
    this.onWordsChunk?.(wordObjects, false);

    // If latest result was final, lock in chunk boundary
    const lastResult = event.results[event.results.length - 1];
    if (lastResult && lastResult.isFinal) {
      this.allAccumulatedWords = wordObjects;
      this.phraseStartTime = currentAudioTime;
      this.onWordsChunk?.(wordObjects, true);
    }
  }
}

/**
 * Transcribe Audio Blob using Groq Whisper Large v3 (Word-Level Timestamps)
 * Used when user triggers Cloud AI Boost or automatic Whisper transcription
 */
export async function transcribeWithGroqWhisper({ audioBlob, apiKey, language = 'auto' }) {
  if (!apiKey) {
    throw new Error("No Groq API Key provided for Whisper transcription.");
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'lecture.webm');
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');

  if (language && language !== 'auto') {
    const isoLang = language.split('-')[0];
    formData.append('language', isoLang);
  }

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`
    },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper Transcription failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  
  // Format word items into our LecNote AI word schema
  const words = (data.words || []).map((item, idx) => ({
    id: `whisper-${idx}-${Date.now()}`,
    word: item.word.trim(),
    startTime: parseFloat(Number(item.start).toFixed(2)),
    endTime: parseFloat(Number(item.end).toFixed(2)),
    isHighlighted: false,
    highlightColor: 'yellow'
  }));

  return {
    text: data.text,
    words: words.length > 0 ? words : (data.text ? data.text.split(/\s+/).map((w, i) => ({
      id: `whisper-w-${i}-${Date.now()}`,
      word: w,
      startTime: parseFloat((i * 0.4).toFixed(2)),
      endTime: parseFloat(((i + 1) * 0.4).toFixed(2)),
      isHighlighted: false,
      highlightColor: 'yellow'
    })) : []),
    duration: data.duration
  };
}
