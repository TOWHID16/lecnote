import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, Sparkles, BookOpen, Share2, Settings, Plus, Search, Trash2,
  FolderOpen, Bookmark, Radio, Volume2, Highlighter, Check, FileDown,
  Layers, Info, RefreshCw
} from 'lucide-react';
import {
  getAllLectures, saveLecture, getLectureById, deleteLecture,
  updateLectureWords, updateLectureSummary, getSetting, setSetting
} from './services/db';
import { createSampleLecture } from './services/sampleLecture';
import { summarizeLecture } from './services/summarizer';
import { formatTime, base64ToBlob } from './services/audioUtils';
import KaraokePlayer from './components/KaraokePlayer';
import TranscriptView from './components/TranscriptView';
import SummaryView from './components/SummaryView';
import RecordModal from './components/RecordModal';
import CloudAiModal from './components/CloudAiModal';
import ExportModal from './components/ExportModal';

export default function App() {
  // Application State
  const [lectures, setLectures] = useState([]);
  const [activeLectureId, setActiveLectureId] = useState(null);
  const [activeLecture, setActiveLecture] = useState(null);
  const [activeTab, setActiveTab] = useState('transcript'); // 'transcript' | 'summary'

  // Audio Playback & Karaoke Sync
  const [currentTime, setCurrentTime] = useState(0);
  const [activeWord, setActiveWord] = useState(null);
  const [seekingBadge, setSeekingBadge] = useState(null);
  const playerRef = useRef(null);

  // Highlighter State
  const [highlightMode, setHighlightMode] = useState(false);
  const [highlightColor, setHighlightColor] = useState('yellow'); // 'yellow' | 'green'

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isCloudAiModalOpen, setIsCloudAiModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Summarizer & Cloud Settings
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [userSettings, setUserSettings] = useState({
    groqKey: import.meta.env.VITE_GROQ_API_KEY || '',
    geminiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
    preferredProvider: 'groq'
  });

  // Search & Filter
  const [searchLectureQuery, setSearchLectureQuery] = useState('');

  // 1. Initialize Database & Load Lectures
  useEffect(() => {
    async function init() {
      // Load saved settings
      const savedGroq = await getSetting('groqKey');
      const savedGemini = await getSetting('geminiKey');
      const savedProvider = await getSetting('preferredProvider', 'groq');

      setUserSettings({
        groqKey: savedGroq || import.meta.env.VITE_GROQ_API_KEY || '',
        geminiKey: savedGemini || import.meta.env.VITE_GEMINI_API_KEY || '',
        preferredProvider: savedProvider || 'groq'
      });

      // Load all lectures
      const all = await getAllLectures();
      if (all && all.length > 0) {
        setLectures(all);
        setActiveLectureId(all[0].id);
        setActiveLecture(all[0]);
      } else {
        // First run: automatically insert the realistic sample Banglish lecture!
        const sample = createSampleLecture();
        await saveLecture(sample);
        setLectures([sample]);
        setActiveLectureId(sample.id);
        setActiveLecture(sample);
      }
    }
    init();
  }, []);

  // 2. Fetch active lecture when activeLectureId changes
  useEffect(() => {
    async function loadActive() {
      if (!activeLectureId) return;
      const lec = await getLectureById(activeLectureId);
      if (lec) {
        setActiveLecture(lec);
        setCurrentTime(0);
        setActiveWord(null);
      }
    }
    loadActive();
  }, [activeLectureId]);

  // 3. Track active word for Karaoke playback
  useEffect(() => {
    if (!activeLecture || !activeLecture.words) {
      setActiveWord(null);
      return;
    }
    const current = activeLecture.words.find(
      w => currentTime >= w.startTime && currentTime <= w.endTime
    );
    setActiveWord(current || null);
  }, [currentTime, activeLecture]);

  // 4. Tap-to-Seek Handler: Triggered when user clicks a word in transcript
  const handleWordClick = (wordObj) => {
    if (!wordObj) return;
    const seekTarget = wordObj.startTime;
    setSeekingBadge(formatTime(seekTarget));

    // Clear badge after 2.5 seconds
    setTimeout(() => {
      setSeekingBadge(null);
    }, 2500);

    // Command player to jump & play
    playerRef.current?.seekAndPlay(seekTarget);
  };

  // 5. Update a single word (highlight toggle or inline spelling fix)
  const handleWordUpdate = async (updatedWord) => {
    if (!activeLecture) return;
    const updatedWords = activeLecture.words.map(w => w.id === updatedWord.id ? updatedWord : w);
    const updatedLecture = { ...activeLecture, words: updatedWords };

    setActiveLecture(updatedLecture);
    await updateLectureWords(activeLecture.id, updatedWords);

    // Refresh list view state
    setLectures(prev => prev.map(l => l.id === activeLecture.id ? { ...l, words: updatedWords } : l));
  };

  // 6. Regenerate Lecture Summary (Local or Cloud)
  const handleRegenerateSummary = async () => {
    if (!activeLecture || !activeLecture.words) return;
    setIsGeneratingSummary(true);

    try {
      const summaryResult = await summarizeLecture({
        words: activeLecture.words,
        userSettings,
      });

      const updated = await updateLectureSummary(activeLecture.id, summaryResult);
      setActiveLecture(prev => ({ ...prev, summary: summaryResult }));
      setLectures(prev => prev.map(l => l.id === activeLecture.id ? { ...l, summary: summaryResult } : l));
    } catch (err) {
      console.error("Summary regeneration error:", err);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // 7. Save a newly recorded lecture
  const handleSaveRecordedLecture = async (newLectureData) => {
    // Generate initial summary automatically
    const summary = await summarizeLecture({
      words: newLectureData.words,
      userSettings,
    });

    const fullLecture = {
      ...newLectureData,
      summary,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveLecture(fullLecture);
    setLectures(prev => [saved, ...prev]);
    setActiveLectureId(saved.id);
    setActiveLecture(saved);
  };

  // 8. Delete active lecture
  const handleDeleteLecture = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this lecture note?")) return;

    await deleteLecture(id);
    const remaining = lectures.filter(l => l.id !== id);
    setLectures(remaining);

    if (activeLectureId === id) {
      if (remaining.length > 0) {
        setActiveLectureId(remaining[0].id);
      } else {
        setActiveLectureId(null);
        setActiveLecture(null);
      }
    }
  };

  // 9. Load / Reset Sample Lecture
  const handleLoadSampleLecture = async () => {
    const sample = createSampleLecture();
    sample.id = `sample-${Date.now()}`;
    await saveLecture(sample);
    setLectures(prev => [sample, ...prev]);
    setActiveLectureId(sample.id);
    setActiveLecture(sample);
  };

  // 10. Import Bundle (.lecnote.json)
  const handleImportBundle = async (importedData) => {
    let blob = null;
    if (importedData.audioBase64) {
      blob = base64ToBlob(importedData.audioBase64, importedData.audioMimeType || 'audio/wav');
    }

    const newId = `imported-${Date.now()}`;
    const lectureToStore = {
      ...importedData,
      id: newId,
      audioBlob: blob,
      audioBase64: undefined, // remove string to conserve DB
      createdAt: new Date().toISOString(),
    };

    const saved = await saveLecture(lectureToStore);
    setLectures(prev => [saved, ...prev]);
    setActiveLectureId(saved.id);
    setActiveLecture(saved);
  };

  // 11. Save Cloud Settings
  const handleSaveSettings = async (newSettings) => {
    setUserSettings(newSettings);
    await setSetting('groqKey', newSettings.groqKey);
    await setSetting('geminiKey', newSettings.geminiKey);
    await setSetting('preferredProvider', newSettings.preferredProvider);
  };

  const filteredLectures = lectures.filter(l =>
    l.title.toLowerCase().includes(searchLectureQuery.toLowerCase()) ||
    (l.course && l.course.toLowerCase().includes(searchLectureQuery.toLowerCase()))
  );

  const hasCloudBoost = !!(userSettings.groqKey || userSettings.geminiKey);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Top Header Navbar */}
      <header className="flex-shrink-0 h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-30">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 p-0.5 shadow-lg shadow-indigo-600/30 flex items-center justify-center">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">LecNote AI</h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/60 uppercase">
                Free PWA
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Bangla • English • Banglish Voice Note Studio
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Cloud AI Boost Status */}
          <button
            onClick={() => setIsCloudAiModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              hasCloudBoost
                ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800 hover:bg-indigo-900/80'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
            }`}
            title="Configure Cloud AI Boost (Whisper Large v3 & Groq/Gemini)"
          >
            <Sparkles className={`w-3.5 h-3.5 ${hasCloudBoost ? 'text-yellow-400' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">{hasCloudBoost ? 'Cloud Boost Active' : 'Cloud Boost'}</span>
          </button>

          {/* Share & Export */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            disabled={!activeLecture}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
            title="Share with Web Share API or download .lecnote.json/PDF"
          >
            <Share2 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Export & Share</span>
          </button>

          {/* New Recording Button */}
          <button
            onClick={() => setIsRecordModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 ring-2 ring-rose-400/40 transition-all"
            title="Open Live Recording Studio"
          >
            <Mic className="w-4 h-4 fill-current" />
            <span>Record Lecture</span>
          </button>
        </div>
      </header>

      {/* Main Body Layout (Sidebar + Note Studio) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Lecture Notes Drawer */}
        <aside className="w-72 sm:w-80 border-r border-slate-800 bg-slate-900/40 flex flex-col flex-shrink-0">
          {/* Sidebar Top: Search & Sample loader */}
          <div className="p-3.5 border-b border-slate-800 space-y-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search lectures..."
                value={searchLectureQuery}
                onChange={(e) => setSearchLectureQuery(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 text-xs rounded-xl pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={handleLoadSampleLecture}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-[11px] font-semibold border border-slate-700/80 transition-colors"
            >
              <RefreshCw className="w-3 h-3 text-indigo-400" />
              <span>+ Load Sample Banglish Lecture</span>
            </button>
          </div>

          {/* Lectures List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredLectures.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No lectures found.
              </div>
            ) : (
              filteredLectures.map((lec) => {
                const isActive = lec.id === activeLectureId;
                const highlightWordsCount = lec.words?.filter(w => w.isHighlighted)?.length || 0;

                return (
                  <div
                    key={lec.id}
                    onClick={() => setActiveLectureId(lec.id)}
                    className={`group relative p-3 rounded-2xl cursor-pointer transition-all border ${
                      isActive
                        ? 'bg-indigo-950/60 border-indigo-600/80 shadow-md shadow-indigo-950'
                        : 'bg-slate-900/30 hover:bg-slate-800/50 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-xs font-semibold truncate ${isActive ? 'text-indigo-200' : 'text-slate-200'}`}>
                          {lec.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {lec.course || 'General Lecture'}
                        </p>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDeleteLecture(lec.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-all"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Metadata Footer */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 font-mono">
                      <span>{formatTime(lec.duration)}</span>
                      <div className="flex items-center gap-1.5">
                        {highlightWordsCount > 0 && (
                          <span className="text-yellow-400 bg-yellow-950/40 px-1 rounded">
                            ★ {highlightWordsCount}
                          </span>
                        )}
                        <span>{new Date(lec.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Main Studio: Active Lecture Note View */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-950/90">
          {!activeLecture ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <FolderOpen className="w-12 h-12 stroke-1 mb-3 text-slate-600" />
              <h3 className="text-base font-semibold text-slate-400">No Lecture Selected</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Select an existing lecture from the sidebar, load a sample lecture, or hit Record to capture a classroom session.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Lecture Header & Tabs */}
              <div className="px-6 pt-4 pb-3 border-b border-slate-800 bg-slate-900/30 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      {activeLecture.title}
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-indigo-400 border border-slate-700">
                      {formatTime(activeLecture.duration)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activeLecture.course} • Recorded in {activeLecture.language === 'auto' ? 'Mixed Banglish' : activeLecture.language}
                  </p>
                </div>

                {/* View Tabs: Interactive Transcript vs Summary & Notes */}
                <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-inner">
                  <button
                    onClick={() => setActiveTab('transcript')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'transcript'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Highlighter className="w-3.5 h-3.5" />
                    <span>Interactive Transcript</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('summary')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'summary'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Summary & Key Notes</span>
                  </button>
                </div>
              </div>

              {/* Main Content Pane */}
              <div className="flex-1 overflow-hidden p-4 sm:p-6">
                {activeTab === 'transcript' ? (
                  <TranscriptView
                    words={activeLecture.words || []}
                    currentTime={currentTime}
                    onWordClick={handleWordClick}
                    onWordUpdate={handleWordUpdate}
                    highlightMode={highlightMode}
                    highlightColor={highlightColor}
                    setHighlightMode={setHighlightMode}
                    setHighlightColor={setHighlightColor}
                  />
                ) : (
                  <SummaryView
                    summary={activeLecture.summary}
                    words={activeLecture.words || []}
                    onRegenerate={handleRegenerateSummary}
                    isGenerating={isGeneratingSummary}
                    cloudConfigured={hasCloudBoost}
                    activeEngineName={hasCloudBoost ? "Groq/Gemini Cloud AI" : "Local Extractive AI (Zero-Cost)"}
                  />
                )}
              </div>

              {/* Bottom Synchronized Karaoke Player Bar */}
              <div className="flex-shrink-0 p-4 border-t border-slate-800/80 bg-slate-950/80">
                <KaraokePlayer
                  ref={playerRef}
                  audioBlob={activeLecture.audioBlob}
                  audioMimeType={activeLecture.audioMimeType}
                  duration={activeLecture.duration}
                  onTimeUpdate={setCurrentTime}
                  activeWord={activeWord}
                  seekingBadge={seekingBadge}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Record Live Studio Modal */}
      <RecordModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSaveLecture={handleSaveRecordedLecture}
        currentLanguage="auto"
      />

      {/* Cloud AI Boost Settings Modal */}
      <CloudAiModal
        isOpen={isCloudAiModalOpen}
        onClose={() => setIsCloudAiModalOpen(false)}
        settings={userSettings}
        onSaveSettings={handleSaveSettings}
      />

      {/* Share & Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        lecture={activeLecture}
        onImportBundle={handleImportBundle}
      />
    </div>
  );
}
