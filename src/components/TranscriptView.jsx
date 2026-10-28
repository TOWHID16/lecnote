import React, { useState, useRef, useEffect } from 'react';
import { Highlighter, Edit3, Search, Sparkles, Check, X, Clock, HelpCircle } from 'lucide-react';
import { formatTime } from '../services/audioUtils';

export default function TranscriptView({
  words = [],
  currentTime = 0,
  onWordClick,
  onWordUpdate,
  onBatchHighlightChange,
  highlightMode = false,
  highlightColor = 'yellow', // 'yellow' | 'green'
  setHighlightMode,
  setHighlightColor,
}) {
  const [editingWordId, setEditingWordId] = useState(null);
  const [editInputValue, setEditInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const editInputRef = useRef(null);

  // Auto-focus input on double click
  useEffect(() => {
    if (editingWordId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingWordId]);

  const handleWordMouseDown = (wordObj, e) => {
    if (editingWordId) return;

    if (highlightMode) {
      e.preventDefault();
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

  const toggleWordHighlight = (wordObj) => {
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

  return (
    <div className="flex flex-col h-full bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      {/* Top Interactive Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900/90 border-b border-slate-800">
        {/* Left: Mode toggles */}
        <div className="flex items-center gap-2">
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
        </div>

        {/* Right: Search & Stats */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search words..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-800/80 border border-slate-700 text-xs rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-36 sm:w-44"
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
      <div className="bg-indigo-950/30 border-b border-indigo-900/40 px-4 py-2 flex items-center justify-between text-[11px] text-indigo-300">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
          <span>
            💡 <strong>Tap any word</strong> to seek & play audio • <strong>Double-click</strong> to edit spelling • <strong>Highlighter</strong> captures key points for AI summary
          </span>
        </div>
      </div>

      {/* Main Words Area */}
      <div className="flex-1 p-6 overflow-y-auto font-sans leading-relaxed text-base select-text">
        {words.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-center">
            <HelpCircle className="w-10 h-10 mb-2 stroke-1" />
            <p className="text-sm font-medium">No transcription words yet.</p>
            <p className="text-xs text-slate-600 mt-1">Start recording above or load the sample Banglish lecture to test.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {paragraphs.map((pWords, pIdx) => {
              const pStartTime = pWords[0]?.startTime || 0;
              return (
                <div key={`p-${pIdx}`} className="relative group/p flex items-start gap-3">
                  {/* Paragraph Timestamp Gutter Marker */}
                  <button
                    onClick={() => onWordClick?.(pWords[0])}
                    className="mt-1 flex-shrink-0 text-[10px] font-mono font-medium text-slate-400 hover:text-indigo-400 bg-slate-800/60 hover:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700/60 transition-colors"
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
                              className="bg-indigo-900 text-white font-medium text-sm px-1.5 py-0.5 rounded border border-indigo-400 focus:outline-none"
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
    </div>
  );
}
