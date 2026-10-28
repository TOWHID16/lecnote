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
    this.lastProcessedWordCount = 0;
    this.allAccumulatedWords = [];
    this.phraseStartTime = 0;

    this.initRecognition();
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech API not supported in this browser. Falling back to manual or audio-only mode.");
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
        // Auto-restart if still flagged listening (browsers stop speech recognition on silence)
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
    this.audioStartTime = currentTimeSeconds;
    this.phraseStartTime = currentTimeSeconds;
    this.lastProcessedWordCount = 0;
    this.allAccumulatedWords = [];

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
  }

  /**
   * Smart Syllable-Weighted Word Timestamp Alignment
   * Distributes the spoken phrase duration proportionally to each word's length,
   * producing realistic word-level start & end times.
   */
  handleSpeechResult(event) {
    let fullTranscript = '';
    let isFinal = false;

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      fullTranscript += event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        isFinal = true;
      }
    }

    const rawWords = fullTranscript.trim().split(/\s+/).filter(Boolean);
    if (rawWords.length === 0) return;

    const currentAudioTime = (performance.now() - this.systemStartTime) / 1000 + this.audioStartTime;
    const chunkDuration = Math.max(0.6, currentAudioTime - this.phraseStartTime);

    // Compute relative character/syllable weight for each word
    const totalChars = rawWords.reduce((sum, w) => sum + Math.max(2, w.length), 0);
    let cumulativeTime = this.phraseStartTime;

    const wordObjects = rawWords.map((wordStr, index) => {
      const weight = Math.max(2, wordStr.length) / totalChars;
      const wordDuration = Math.max(0.25, chunkDuration * weight);
      const start = cumulativeTime;
      const end = cumulativeTime + wordDuration;
      cumulativeTime = end;

      return {
        id: `word-${this.allAccumulatedWords.length + index}-${Date.now()}`,
        word: wordStr,
        startTime: parseFloat(start.toFixed(2)),
        endTime: parseFloat(end.toFixed(2)),
        isHighlighted: false,
        highlightColor: 'yellow'
      };
    });

    if (isFinal) {
      this.allAccumulatedWords.push(...wordObjects);
      this.phraseStartTime = currentAudioTime;
      this.onWordsChunk?.(this.allAccumulatedWords, true);
    } else {
      // Stream interim words
      const interimList = [...this.allAccumulatedWords, ...wordObjects];
      this.onWordsChunk?.(interimList, false);
    }
  }
}

/**
 * Transcribe Audio Blob using Groq Whisper Large v3 (Word-Level Timestamps)
 * Used when user triggers Cloud AI Boost for Whisper accuracy
 */
export async function transcribeWithGroqWhisper({ audioBlob, apiKey, language = 'auto' }) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'lecture.webm');
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');

  if (language && language !== 'auto') {
    // Groq whisper expects 2-letter ISO code: bn or en
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
    startTime: parseFloat(item.start.toFixed(2)),
    endTime: parseFloat(item.end.toFixed(2)),
    isHighlighted: false,
    highlightColor: 'yellow'
  }));

  return {
    text: data.text,
    words: words,
    duration: data.duration
  };
}
