import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, Pause, Play, Square, X, Radio, Languages, Sparkles, Volume2,
  Tag, Edit3, Loader2, CheckCircle2, AlertCircle
} from 'lucide-react';
import AudioWaveform from './AudioWaveform';
import { LiveSpeechEngine, transcribeWithGroqWhisper } from '../services/speechRecognition';
import { formatTime } from '../services/audioUtils';

const QUICK_SUBJECT_TAGS = [
  'CSE', 'Physics', 'Bangla', 'English', 'Math', 'Biology', 'Chemistry', 'General'
];

export default function RecordModal({
  isOpen,
  onClose,
  onSaveLecture,
  currentLanguage = 'auto',
  userSettings = {}
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState(
    currentLanguage && currentLanguage !== 'auto' ? currentLanguage : 'en-US'
  );
  const [liveWords, setLiveWords] = useState([]);
  const [lectureTitle, setLectureTitle] = useState('');
  const [courseTag, setCourseTag] = useState('');
  const [mediaStream, setMediaStream] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [isTranscribingWithAi, setIsTranscribingWithAi] = useState(false);
  const [speechApiSupported, setSpeechApiSupported] = useState(true);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const speechEngineRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      setLectureTitle(`Lecture - ${dateStr} ${timeStr}`);
      setCourseTag('General');
      setLiveWords([]);
      setRecordingSeconds(0);
      setIsRecording(false);
      setIsPaused(false);
      setErrorNotice(null);
      setIsTranscribingWithAi(false);

      const hasSpeech = typeof window !== 'undefined' &&
        !!(window.SpeechRecognition || window.webkitSpeechRecognition);
      setSpeechApiSupported(hasSpeech);
    } else {
      stopRecordingCleanup();
    }
  }, [isOpen]);

  const stopRecordingCleanup = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (speechEngineRef.current) {
      speechEngineRef.current.stop();
      speechEngineRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      setMediaStream(null);
    }
  };

  const startRecording = async () => {
    setErrorNotice(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      setMediaStream(stream);

      // Setup MediaRecorder
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      }

      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(250); // collect chunks every 250ms
      setIsRecording(true);
      setIsPaused(false);

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(sec => sec + 1);
      }, 1000);

      // Start Web Speech Engine
      const speech = new LiveSpeechEngine({
        language: selectedLanguage,
        onWordsChunk: (wordsList) => {
          setLiveWords([...wordsList]);
        },
        onError: (err) => {
          console.warn("Live speech notice:", err);
          if (err === 'network') {
            setErrorNotice("Browser speech service unreachable (network/firewall). Audio is recording in high quality!");
          } else if (err === 'not-allowed') {
            setErrorNotice("Speech recognition permission denied by browser.");
          }
        }
      });
      speechEngineRef.current = speech;
      speech.start(0);

    } catch (err) {
      console.warn("Microphone access error:", err);
      setErrorNotice("Microphone unavailable or blocked. Please allow mic permissions in your browser.");
    }
  };

  const togglePauseResume = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (isPaused) {
      // Resume
      recorder.resume();
      speechEngineRef.current?.start(recordingSeconds);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(sec => sec + 1);
      }, 1000);
      setIsPaused(false);
    } else {
      // Pause
      recorder.pause();
      speechEngineRef.current?.stop();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      setIsPaused(true);
    }
  };

  const stopAndSave = async () => {
    const recorder = mediaRecorderRef.current;
    const finalSeconds = Math.max(1, recordingSeconds);

    // Stop speech engine and get latest words
    let capturedWords = speechEngineRef.current?.stop() || [];
    if (capturedWords.length === 0 && liveWords.length > 0) {
      capturedWords = [...liveWords];
    }

    const processAndSave = async (blob) => {
      let finalWords = [...capturedWords];

      // If no speech words detected & user has Groq API key, run Whisper AI automatically!
      if (finalWords.length === 0 && userSettings?.groqKey && blob && blob.size > 0) {
        setIsTranscribingWithAi(true);
        try {
          const whisperResult = await transcribeWithGroqWhisper({
            audioBlob: blob,
            apiKey: userSettings.groqKey,
            language: selectedLanguage
          });
          if (whisperResult && whisperResult.words && whisperResult.words.length > 0) {
            finalWords = whisperResult.words;
          }
        } catch (whisperErr) {
          console.warn("Whisper transcription fallback failed:", whisperErr);
        } finally {
          setIsTranscribingWithAi(false);
        }
      }

      // If still 0 words (offline or speech API unsupported), generate interactive time-sliced phrase blocks
      // so user can seek, tap, highlight, and type words at exact timestamps!
      if (finalWords.length === 0) {
        const segmentDuration = 4; // every 4 seconds
        const count = Math.max(1, Math.ceil(finalSeconds / segmentDuration));
        finalWords = [];

        for (let i = 0; i < count; i++) {
          const start = i * segmentDuration;
          const end = Math.min(finalSeconds, (i + 1) * segmentDuration);
          finalWords.push({
            id: `seg-${i}-${Date.now()}`,
            word: `[Speech ${formatTime(start)}]`,
            startTime: parseFloat(start.toFixed(2)),
            endTime: parseFloat(end.toFixed(2)),
            isHighlighted: false,
            highlightColor: 'yellow'
          });
        }
      }

      const newLecture = {
        id: `lecture-${Date.now()}`,
        title: lectureTitle.trim() || `Lecture - ${new Date().toLocaleDateString()}`,
        course: courseTag.trim() || 'General',
        duration: finalSeconds,
        language: selectedLanguage,
        audioBlob: blob,
        audioMimeType: blob?.type || 'audio/webm',
        words: finalWords,
        bookmarked: false,
      };

      stopRecordingCleanup();
      onSaveLecture?.(newLecture);
      onClose();
    };

    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        const mime = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        processAndSave(audioBlob);
      };
      recorder.stop();
    } else {
      processAndSave(new Blob([], { type: 'audio/webm' }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isTranscribingWithAi}
          className="absolute top-4 sm:top-5 right-4 sm:right-5 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-5">
          <div className="p-2.5 sm:p-3 rounded-2xl bg-rose-600/20 text-rose-400 border border-rose-500/30 flex-shrink-0">
            <Radio className={`w-5 h-5 sm:w-6 sm:h-6 ${isRecording && !isPaused ? 'animate-pulse text-rose-500' : ''}`} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">Live Recording Studio</h2>
            <p className="text-[11px] sm:text-xs text-slate-400">Offline-first word-by-word transcription & audio sync</p>
          </div>
        </div>

        {/* Name & Subject Inputs (Prominent to avoid stacking unnamed recordings) */}
        <div className="space-y-3 mb-4 p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800/80">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Lecture Title / Topic
            </label>
            <input
              type="text"
              value={lectureTitle}
              onChange={(e) => setLectureTitle(e.target.value)}
              placeholder="e.g. CSE 207 - Binary Search Trees, Physics - Waves"
              className="w-full bg-slate-900 border border-slate-700 text-sm rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Course / Subject Tag
              </label>
              <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] sm:max-w-none">
                {QUICK_SUBJECT_TAGS.slice(0, 5).map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setCourseTag(tag)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                      courseTag === tag
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={courseTag}
              onChange={(e) => setCourseTag(e.target.value)}
              placeholder="e.g. CSE 207, PHY 101, Bangla"
              className="w-full bg-slate-900 border border-slate-700 text-xs rounded-xl px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Language Selection */}
          <div className="pt-1">
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Speech Recognition Language
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'en-US', label: 'English (Global)' },
                { id: 'en-IN', label: 'Mixed Banglish' },
                { id: 'bn-BD', label: 'বাংলা (Bangla)' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSelectedLanguage(opt.id);
                    speechEngineRef.current?.setLanguage(opt.id);
                  }}
                  className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                    selectedLanguage === opt.id
                      ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Select <strong>English</strong> if speaking English words, or <strong>বাংলা</strong> if speaking pure Bangla.
            </p>
          </div>
        </div>

        {/* Status Notice if Speech API is limited */}
        {!speechApiSupported && (
          <div className="mb-3 p-2.5 bg-amber-950/40 border border-amber-800/60 rounded-xl text-[11px] text-amber-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
            <span>
              Web Speech API is not natively supported in this browser. Don't worry! Your audio will record crystal clear, and you can transcribe it using Free Cloud AI or sync manual notes.
            </span>
          </div>
        )}

        {/* Live Audio Waveform & Timer */}
        <div className="my-2 bg-slate-950 rounded-2xl border border-slate-800 p-4 flex flex-col items-center">
          <AudioWaveform
            stream={mediaStream}
            isRecording={isRecording && !isPaused}
            height={70}
          />

          {/* Big Digital Timer */}
          <div className="mt-3 flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isRecording && !isPaused ? 'bg-rose-500 animate-ping' : isPaused ? 'bg-amber-400' : 'bg-slate-600'}`} />
            <span className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-wider">
              {formatTime(recordingSeconds)}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 mt-1">
            {isRecording ? (isPaused ? 'Recording Paused' : 'Listening & Recording Audio...') : 'Ready to record lecture'}
          </p>
        </div>

        {/* Live Transcription Preview Area (Critical user feedback!) */}
        <div className="mb-4 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 flex flex-col min-h-[75px] max-h-36 overflow-y-auto">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold mb-1 border-b border-slate-800 pb-1">
            <span className="flex items-center gap-1.5 text-indigo-400">
              <Sparkles className="w-3.5 h-3.5" />
              Live Spoken Words Stream
            </span>
            <span className="font-mono text-slate-500">
              {liveWords.length} words
            </span>
          </div>
          
          {liveWords.length === 0 ? (
            <p className="text-xs text-slate-600 italic py-2 text-center">
              {isRecording
                ? "🎙️ Speak clearly into your mic... words will appear here in real-time."
                : "Spoken transcription will stream here during recording."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1 py-1">
              {liveWords.map((w) => (
                <span
                  key={w.id}
                  className="text-xs bg-indigo-950/60 text-indigo-200 border border-indigo-800/50 px-1.5 py-0.5 rounded"
                >
                  {w.word}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Error message if any */}
        {errorNotice && (
          <div className="mb-3 p-2 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-xl">
            {errorNotice}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 pt-1">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="w-full py-3 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition-transform active:scale-95"
            >
              <Mic className="w-5 h-5 fill-current" />
              <span>Start Recording Lecture</span>
            </button>
          ) : (
            <>
              {/* Pause / Resume */}
              <button
                onClick={togglePauseResume}
                disabled={isTranscribingWithAi}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {isPaused ? <Play className="w-4 h-4 fill-current text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
                <span>{isPaused ? 'Resume' : 'Pause'}</span>
              </button>

              {/* Stop & Save */}
              <button
                onClick={stopAndSave}
                disabled={isTranscribingWithAi}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {isTranscribingWithAi ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI Transcribing...</span>
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4 fill-current text-white" />
                    <span>Stop & Save Note</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
