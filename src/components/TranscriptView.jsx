import React, { useState, useRef, useEffect } from 'react';
import {
  Highlighter, Edit3, Search, Sparkles, Check, X, Clock, HelpCircle,
  FileText, Wand2, Loader2, Plus, Volume2
} from 'lucide-react';
import { formatTime } from '../services/audioUtils';

export default function TranscriptView({
  words = [],
  currentTime = 0,
  duration = 0,
  onWordClick,
  onWordUpdate,
  onBatchWordsUpdate,
  highlightMode = false,
  highlightColor = 'yellow', // 'yellow' | 'green'
  setHighlightMode,
  setHighlightColor,
  onTranscribe,
  isTranscribing = false,
  hasAudio = true,
}) {
  const [editingWordId, setEditingWordId] = useState(null);
  const [editInputValue, setEditInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isManualNoteModalOpen, setIsManualNoteModalOpen] = useState(false);
  const [manualNoteText, setManualNoteText] = useState('');
  const editInputRef = useRef(null);

  // Auto-focus input on double click
  useEffect(() => {
    if (editingWordId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingWordId]);

  const handleWordAction = (wordObj, e) => {
    if (editingWordId) return;

    if (highlightMode) {
      e?.preventDefault?.();
      toggleWordHighlight(wordObj);
    } else {
      // Tap to seek
      onWordClick?.(wordObj);
    }
  };

  const handleWordMouseDown = (wordObj, e) => {
    if (editingWordId) return;

    if (highlightMode) {
      e?.preventDefault?.();
      setIsDragging(true);
      toggleWordHighlight(wordObj);
    } else {
      // Tap to seek
      onWordClick?.(wordObj);
    }
  };

  const handleWordMouseEnter = (wordObj) => {
    if (highlightMode && isDragging) {
      toggleWordHighlight(wordObj);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const lastToggledRef = useRef({ id: null, time: 0 });

  const toggleWordHighlight = (wordObj) => {
    const now = Date.now();
    if (lastToggledRef.current.id === wordObj.id && now - lastToggledRef.current.time < 350) {
      return; // prevent duplicate trigger between mousedown and click
    }
    lastToggledRef.current = { id: wordObj.id, time: now };

    const nextHighlighted = !wordObj.isHighlighted;
    const updated = {
      ...wordObj,
      isHighlighted: nextHighlighted,
      highlightColor: nextHighlighted ? highlightColor : wordObj.highlightColor || 'yellow'
    };
    onWordUpdate?.(updated);
  };

  const startEditing = (wordObj, e) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingWordId(wordObj.id);
    setEditInputValue(wordObj.word);
  };

  const commitEditing = (wordObj) => {
    if (!editingWordId) return;
    const trimmed = editInputValue.trim();
    if (trimmed && trimmed !== wordObj.word) {
      onWordUpdate?.({
        ...wordObj,
        word: trimmed
      });
    }
    setEditingWordId(null);
  };

  const cancelEditing = () => {
    setEditingWordId(null);
  };

  // Convert manual text note into timestamped interactive words
  const handleSaveManualNotes = () => {
    const text = manualNoteText.trim();
    if (!text) {
      setIsManualNoteModalOpen(false);
      return;
    }

    const rawWords = text.split(/\s+/).filter(Boolean);
    const totalDuration = Math.max(1, duration || rawWords.length * 0.4);
    const timePerWord = totalDuration / rawWords.length;

    const newWords = rawWords.map((w, idx) => ({
      id: `manual-w-${idx}-${Date.now()}`,
      word: w,
      startTime: parseFloat((idx * timePerWord).toFixed(2)),
      endTime: parseFloat(((idx + 1) * timePerWord).toFixed(2)),
      isHighlighted: false,
      highlightColor: 'yellow'
    }));

    onBatchWordsUpdate?.(newWords);
    setIsManualNoteModalOpen(false);
    setManualNoteText('');
  };

  // Group words into readable paragraphs based on punctuation or longer pauses
  const paragraphs = [];
  let currentParagraph = [];

  words.forEach((w, idx) => {
    currentParagraph.push(w);
    const hasSentenceEnd = /[।\.\?!]$/.test(w.word.trim());
    const next = words[idx + 1];
    const isLongPause = next && (next.startTime - w.endTime > 1.2);

    if ((hasSentenceEnd && currentParagraph.length > 25) || isLongPause || idx === words.length - 1) {
      paragraphs.push(currentParagraph);
      currentParagraph = [];
    }
  });

  const highlightedCount = words.filter(w => w.isHighlighted).length;
  const isOnlyPlaceholders = words.length <= 4 && words.some(w =>
    w.word.includes('Recorded Voice Note') || w.word.startsWith('[Speech') || w.word.startsWith('[Audio')
  );

  return (
    <div className="flex flex-col h-full bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-2xl shadow-xl overflow-hidden relative">
      {/* Top Interactive Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900/90 border-b border-slate-800">
        {/* Left: Mode toggles */}
        <div className="flex items-center justify-between sm:justify-start gap-2">
          {/* Highlighter Toggle */}
          <button
            onClick={() => setHighlightMode(!highlightMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
              highlightMode
                ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
            title="Toggle Highlight Marker: click/drag words to highlight for study summary"
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span>{highlightMode ? 'Highlight Marker ON' : 'Highlight Marker'}</span>
          </button>

          {/* Color Switcher (Yellow vs Green) */}
          {highlightMode && (
            <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-lg border border-slate-700 animate-fadeIn">
              <button
                onClick={() => setHighlightColor('yellow')}
                className={`w-5 h-5 rounded-full bg-yellow-300 transition-transform ${
                  highlightColor === 'yellow' ? 'ring-2 ring-white scale-110' : 'opacity-60'
                }`}
                title="Yellow Highlighter"
              />
              <button
                onClick={() => setHighlightColor('green')}
                className={`w-5 h-5 rounded-full bg-emerald-400 transition-transform ${
                  highlightColor === 'green' ? 'ring-2 ring-white scale-110' : 'opacity-60'
                }`}
                title="Emerald Highlighter"
              />
            </div>
          )}

          {/* AI Transcribe / Manual Notes buttons */}
          {hasAudio && (
            <button
              onClick={onTranscribe}
              disabled={isTranscribing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-950/80 text-indigo-300 hover:bg-indigo-900 border border-indigo-700 transition-colors disabled:opacity-50"
              title="Run AI Whisper Transcription on audio"
            >
              {isTranscribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 text-indigo-400" />}
              <span className="hidden sm:inline">{isTranscribing ? 'Transcribing...' : 'AI Transcribe'}</span>
            </button>
          )}

          <button
            onClick={() => setIsManualNoteModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="Paste or type lecture text to auto-sync with audio timestamps"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Add/Paste Notes</span>
          </button>
        </div>

        {/* Right: Search & Stats */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search words..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-44 bg-slate-800/80 border border-slate-700 text-xs rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <span className="bg-slate-800 px-2 py-1 rounded">
              {words.length} words
            </span>
            {highlightedCount > 0 && (
              <span className="bg-yellow-950/60 text-yellow-300 border border-yellow-800 px-2 py-1 rounded font-medium">
                {highlightedCount} highlighted
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Guidance Banner */}
      <div className="bg-indigo-950/30 border-b border-indigo-900/40 px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-[11px] text-indigo-300 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
          <span className="leading-snug">
            💡 <strong>Tap word</strong> to seek audio • <strong>Double-tap</strong> to edit spelling • <strong>Highlighter</strong> captures key points
          </span>
        </div>
      </div>

      {/* Prompt Banner if audio has only placeholder blocks */}
      {isOnlyPlaceholders && (
        <div className="m-3 p-3.5 bg-gradient-to-r from-indigo-950/80 to-slate-900 border border-indigo-800/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mt-0.5">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Audio Recorded Successfully!</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Generate full word-by-word transcription with AI (Free with Groq Whisper) or paste your lecture text notes.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onTranscribe}
              disabled={isTranscribing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-colors disabled:opacity-50"
            >
              {isTranscribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              <span>{isTranscribing ? 'Transcribing...' : 'Transcribe with AI'}</span>
            </button>
            <button
              onClick={() => setIsManualNoteModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
            >
              Paste Notes
            </button>
          </div>
        </div>
      )}

      {/* Main Words Area */}
      <div className="flex-1 p-3.5 sm:p-6 overflow-y-auto font-sans leading-relaxed text-sm sm:text-base select-text">
        {words.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-center">
            <HelpCircle className="w-10 h-10 mb-2 stroke-1" />
            <p className="text-sm font-medium">No transcription words yet.</p>
            <p className="text-xs text-slate-600 mt-1 max-w-sm">
              Use "AI Transcribe" or "Add/Paste Notes" above to populate word notes for this recording.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={onTranscribe}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
              >
                Transcribe with AI
              </button>
              <button
                onClick={() => setIsManualNoteModalOpen(true)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700"
              >
                Paste Lecture Text
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5 sm:space-y-4">
            {paragraphs.map((pWords, pIdx) => {
              const pStartTime = pWords[0]?.startTime || 0;
              return (
                <div key={`p-${pIdx}`} className="relative group/p flex items-start gap-2 sm:gap-3">
                  {/* Paragraph Timestamp Gutter Marker */}
                  <button
                    onClick={() => onWordClick?.(pWords[0])}
                    className="mt-1 flex-shrink-0 text-[10px] font-mono font-medium text-slate-400 hover:text-indigo-400 bg-slate-800/60 hover:bg-slate-800 px-1 sm:px-1.5 py-0.5 rounded border border-slate-700/60 transition-colors"
                    title={`Jump to ${formatTime(pStartTime)}`}
                  >
                    {formatTime(pStartTime)}
                  </button>

                  {/* Flowing Words */}
                  <div className="flex-1">
                    {pWords.map((w) => {
                      const isKaraokeActive = currentTime >= w.startTime && currentTime < w.endTime;
                      const isEditing = editingWordId === w.id;
                      const matchesSearch = searchQuery && w.word.toLowerCase().includes(searchQuery.toLowerCase());

                      if (isEditing) {
                        return (
                          <span key={w.id} className="inline-flex items-center gap-1 my-0.5 mx-1">
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editInputValue}
                              onChange={(e) => setEditInputValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEditing(w);
                                if (e.key === 'Escape') cancelEditing();
                              }}
                              className="bg-indigo-900 text-white font-medium text-xs sm:text-sm px-1.5 py-0.5 rounded border border-indigo-400 focus:outline-none w-28 sm:w-auto"
                            />
                            <button
                              onClick={() => commitEditing(w)}
                              className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="p-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      }

                      // Dynamic classes for word token
                      let wordClasses = 'word-token ';
                      if (isKaraokeActive) {
                        wordClasses += 'is-active-karaoke ';
                      } else if (w.isHighlighted) {
                        wordClasses += w.highlightColor === 'green' ? 'is-highlighted-green ' : 'is-highlighted ';
                      }

                      if (matchesSearch) {
                        wordClasses += ' ring-2 ring-sky-400 ';
                      }

                      return (
                        <span
                          key={w.id}
                          className={wordClasses}
                          onClick={(e) => handleWordAction(w, e)}
                          onMouseDown={(e) => handleWordMouseDown(w, e)}
                          onMouseEnter={() => handleWordMouseEnter(w)}
                          onDoubleClick={(e) => startEditing(w, e)}
                          title={`${w.word} (${formatTime(w.startTime)} - ${formatTime(w.endTime)}) • Tap to seek, double-click to edit`}
                          data-start-time={w.startTime}
                          data-word-id={w.id}
                        >
                          {w.word}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Note Paste / Write Modal */}
      {isManualNoteModalOpen && (
        <div className="absolute inset-0 z-40 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Add / Paste Lecture Notes</h3>
              </div>
              <button
                onClick={() => setIsManualNoteModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-normal">
              Type or paste your classroom lecture text or notes below. LecNote AI will automatically convert them into interactive word tokens synchronized to the audio timestamps!
            </p>

            <textarea
              rows={6}
              value={manualNoteText}
              onChange={(e) => setManualNoteText(e.target.value)}
              placeholder="Paste lecture notes or transcript here (English, Bangla, or Banglish)..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setIsManualNoteModalOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveManualNotes}
                disabled={!manualNoteText.trim()}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                Sync with Audio Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
