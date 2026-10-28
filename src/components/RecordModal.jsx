import React, { useState, useEffect, useRef } from 'react';
import { Mic, Pause, Play, Square, X, Radio, Languages, Sparkles, Volume2 } from 'lucide-react';
import AudioWaveform from './AudioWaveform';
import { LiveSpeechEngine } from '../services/speechRecognition';
import { formatTime } from '../services/audioUtils';

export default function RecordModal({
  isOpen,
  onClose,
  onSaveLecture,
  currentLanguage = 'bn-BD',
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage || 'bn-BD');
  const [liveWords, setLiveWords] = useState([]);
  const [lectureTitle, setLectureTitle] = useState('');
  const [courseTag, setCourseTag] = useState('General Lecture');
  const [mediaStream, setMediaStream] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);

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
      setLectureTitle(`Lecture ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      setLiveWords([]);
      setRecordingSeconds(0);
      setIsRecording(false);
      setIsPaused(false);
      setErrorNotice(null);
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
        }
      });
      speechEngineRef.current = speech;
      speech.start(0);

    } catch (err) {
      console.warn("Microphone access error or simulated environment:", err);
      setErrorNotice("Microphone unavailable or blocked. You can still test with simulated audio or load sample lecture.");
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

  const stopAndSave = () => {
    const recorder = mediaRecorderRef.current;
    const finalSeconds = recordingSeconds || 1;

    // Helper to finish saving
    const finalize = (blob) => {
      // If no words were detected from silence, generate placeholder phrase
      const finalWords = liveWords.length > 0 ? liveWords : [
        {
          id: `w-${Date.now()}`,
          word: "Recorded Voice Note",
          startTime: 0,
          endTime: Math.max(1, finalSeconds),
          isHighlighted: false,
          highlightColor: 'yellow'
        }
      ];

      const newLecture = {
        id: `lecture-${Date.now()}`,
        title: lectureTitle.trim() || 'Untitled Lecture Note',
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
        finalize(audioBlob);
      };
      recorder.stop();
    } else {
      // Fallback empty or tone blob
      finalize(new Blob([], { type: 'audio/webm' }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Radio className={`w-6 h-6 ${isRecording && !isPaused ? 'animate-pulse text-rose-500' : ''}`} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Live Lecture Recording Studio</h2>
            <p className="text-xs text-slate-400">Offline-first word-by-word transcription & audio sync</p>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Lecture Title</label>
            <input
              type="text"
              value={lectureTitle}
              onChange={(e) => setLectureTitle(e.target.value)}
              placeholder="e.g. AI Ethics & Algorithms"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">Language Mode</label>
            <select
              value={selectedLanguage}
              onChange={(e) => {
                setSelectedLanguage(e.target.value);
                speechEngineRef.current?.setLanguage(e.target.value);
              }}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="bn-BD">Bangla (বাংলা - bn-BD)</option>
              <option value="en-US">English (en-US)</option>
              <option value="auto">Banglish / Auto Detect</option>
            </select>
          </div>
        </div>

        {/* Waveform & Timer Visualizer */}
        <div className="my-2 space-y-3">
          <AudioWaveform
            stream={mediaStream}
            isRecording={isRecording && !isPaused}
            height={80}
            barColor="#6366f1"
            accentColor="#ec4899"
          />

          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${
                !isRecording ? 'bg-slate-600' : (isPaused ? 'bg-amber-400' : 'bg-rose-500 animate-rec-pulse')
              }`} />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                {!isRecording ? 'Ready' : (isPaused ? 'Paused' : 'Recording Live')}
              </span>
            </div>
            <div className="font-mono text-2xl font-bold text-slate-100 tracking-wider">
              {formatTime(recordingSeconds)}
            </div>
          </div>
        </div>

        {/* Live Transcript Preview Box */}
        <div className="flex-1 min-h-[100px] max-h-[160px] my-3 p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 overflow-y-auto text-sm text-slate-300 font-sans">
          {liveWords.length === 0 ? (
            <span className="text-xs text-slate-500 italic flex items-center justify-center h-full">
              {isRecording ? "Listening... Speak into your microphone" : "Press Start Recording to begin live speech note-taking"}
            </span>
          ) : (
            <p className="leading-relaxed">
              {liveWords.map((w, idx) => (
                <span key={idx} className="mr-1 text-slate-200">
                  {w.word}
                </span>
              ))}
            </p>
          )}
        </div>

        {errorNotice && (
          <div className="text-xs text-amber-300 bg-amber-950/40 border border-amber-800 rounded-lg p-2 mb-3">
            {errorNotice}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-lg shadow-rose-600/30 ring-2 ring-rose-400/40"
            >
              <Mic className="w-5 h-5 fill-current" />
              <span>Start Recording Lecture</span>
            </button>
          ) : (
            <>
              <button
                onClick={togglePauseResume}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                <span>{isPaused ? 'Resume' : 'Pause'}</span>
              </button>

              <button
                onClick={stopAndSave}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/30"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop & Save Note</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
