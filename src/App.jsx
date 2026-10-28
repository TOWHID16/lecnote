import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, Sparkles, BookOpen, Share2, Settings, Plus, Search, Trash2,
  FolderOpen, Bookmark, Radio, Volume2, Highlighter, Check, FileDown,
  Layers, Info, RefreshCw, Menu, X, Edit2, Pencil
} from 'lucide-react';
import {
  getAllLectures, saveLecture, getLectureById, deleteLecture,
  updateLectureWords, updateLectureSummary, updateLectureMetadata,
  getSetting, setSetting
} from './services/db';
import { createSampleLecture } from './services/sampleLecture';
import { summarizeLecture } from './services/summarizer';
import { transcribeWithGroqWhisper } from './services/speechRecognition';
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
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Audio Playback & Karaoke Sync
  const [currentTime, setCurrentTime] = useState(0);
  const [activeWord, setActiveWord] = useState(null);
  const [seekingBadge, setSeekingBadge] = useState(null);
  const playerRef = useRef(null);

  // Highlighter State
  const [highlightMode, setHighlightMode] = useState(false);
  const [highlightColor, setHighlightColor] = useState('yellow'); // 'yellow' | 'green'

  // Renaming State
  const [renamingLectureId, setRenamingLectureId] = useState(null);
  const [renameTitleInput, setRenameTitleInput] = useState('');
  const [renameCourseInput, setRenameCourseInput] = useState('');

  const [isEditingHeaderTitle, setIsEditingHeaderTitle] = useState(false);
  const [headerTitleInput, setHeaderTitleInput] = useState('');
  const [headerCourseInput, setHeaderCourseInput] = useState('');

  // Modals & Transcription
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isCloudAiModalOpen, setIsCloudAiModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [shareTargetLecture, setShareTargetLecture] = useState(null);
  const [isTranscribingLecture, setIsTranscribingLecture] = useState(false);
  const [quickTranscribeModalOpen, setQuickTranscribeModalOpen] = useState(false);
  const [quickApiKeyInput, setQuickApiKeyInput] = useState('');
  const [localWhisperLoading, setLocalWhisperLoading] = useState(false);
  const [localWhisperProgress, setLocalWhisperProgress] = useState(null);

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
        setIsEditingHeaderTitle(false);
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

  // 6. Batch update words (e.g. from AI Whisper or manual paste)
  const handleBatchWordsUpdate = async (newWords) => {
    if (!activeLecture) return;
    const updatedLecture = { ...activeLecture, words: newWords };
    setActiveLecture(updatedLecture);
    await updateLectureWords(activeLecture.id, newWords);

    setLectures(prev => prev.map(l => l.id === activeLecture.id ? { ...l, words: newWords } : l));

    // Auto-generate summary from new words
    try {
      const summaryResult = await summarizeLecture({
        words: newWords,
        userSettings,
      });
      await updateLectureSummary(activeLecture.id, summaryResult);
      setActiveLecture(prev => ({ ...prev, summary: summaryResult }));
      setLectures(prev => prev.map(l => l.id === activeLecture.id ? { ...l, summary: summaryResult } : l));
    } catch (e) {
      console.warn("Summary generation on batch update notice:", e);
    }
  };

  // 7. Rename lecture (title and/or course)
  const handleRenameLecture = async (id, newTitle, newCourse) => {
    if (!id || !newTitle?.trim()) return;
    const title = newTitle.trim();
    const course = newCourse ? newCourse.trim() : 'General';

    await updateLectureMetadata(id, { title, course });

    setLectures(prev => prev.map(l => l.id === id ? { ...l, title, course } : l));
    if (activeLectureId === id) {
      setActiveLecture(prev => ({ ...prev, title, course }));
    }

    setRenamingLectureId(null);
    setIsEditingHeaderTitle(false);
  };

  // 8. Transcribe current active lecture using Groq Whisper
  const handleTranscribeActiveLecture = async () => {
    if (!activeLecture) return;

    if (!userSettings.groqKey) {
      setQuickTranscribeModalOpen(true);
      return;
    }

    if (!activeLecture.audioBlob || activeLecture.audioBlob.size === 0) {
      alert("No audio stream available for this lecture note to transcribe.");
      return;
    }

    setIsTranscribingLecture(true);
    try {
      const result = await transcribeWithGroqWhisper({
        audioBlob: activeLecture.audioBlob,
        apiKey: userSettings.groqKey,
        language: activeLecture.language || 'auto'
      });

      if (result && result.words && result.words.length > 0) {
        await handleBatchWordsUpdate(result.words);
      } else {
        alert("Whisper completed but returned 0 words. Please verify audio clarity.");
      }
    } catch (err) {
      console.error("Whisper error:", err);
      alert(`Transcription Error: ${err.message}`);
    } finally {
      setIsTranscribingLecture(false);
    }
  };

  // Quick save API key and immediately transcribe active lecture
  const handleQuickSaveKeyAndTranscribe = async () => {
    const key = quickApiKeyInput.trim();
    if (!key) return;

    const newSettings = { ...userSettings, groqKey: key };
    await handleSaveSettings(newSettings);
    setQuickTranscribeModalOpen(false);

    // Immediately run transcription
    if (activeLecture && activeLecture.audioBlob && activeLecture.audioBlob.size > 0) {
      setIsTranscribingLecture(true);
      try {
        const result = await transcribeWithGroqWhisper({
          audioBlob: activeLecture.audioBlob,
          apiKey: key,
          language: activeLecture.language || 'auto'
        });
        if (result && result.words && result.words.length > 0) {
          await handleBatchWordsUpdate(result.words);
        }
      } catch (err) {
        console.error("Whisper error:", err);
        alert(`Transcription Error: ${err.message}`);
      } finally {
        setIsTranscribingLecture(false);
      }
    }
  };

  // Run 100% Free Local In-Browser AI Whisper (Zero Keys)
  const handleRunLocalWhisper = async () => {
    if (!activeLecture || !activeLecture.audioBlob || activeLecture.audioBlob.size === 0) {
      alert("No recorded audio found for this lecture to transcribe.");
      return;
    }

    setLocalWhisperLoading(true);
    setLocalWhisperProgress("Preparing in-browser AI model (0 cost, zero keys)...");

    try {
      const { transcribeWithLocalWhisper } = await import('./services/localWhisper');
      const result = await transcribeWithLocalWhisper(activeLecture.audioBlob, (progress) => {
        if (progress.status === 'progress' && progress.progress) {
          setLocalWhisperProgress(`Downloading AI Model: ${Math.round(progress.progress)}%`);
        } else if (progress.status === 'ready') {
          setLocalWhisperProgress("Transcribing audio directly in your browser...");
        }
      });

      if (result && result.words && result.words.length > 0) {
        await handleBatchWordsUpdate(result.words);
        setQuickTranscribeModalOpen(false);
      } else {
        alert("Local AI finished but detected no audible speech in audio.");
      }
    } catch (err) {
      console.error("Local Whisper error:", err);
      alert(`Local AI notice: ${err.message}. You can also use Free Groq key for 1-second cloud speed!`);
    } finally {
      setLocalWhisperLoading(false);
      setLocalWhisperProgress(null);
    }
  };

  // 9. Regenerate Lecture Summary (Local or Cloud)
  const handleRegenerateSummary = async () => {
    if (!activeLecture || !activeLecture.words) return;
    setIsGeneratingSummary(true);

    try {
      const summaryResult = await summarizeLecture({
        words: activeLecture.words,
        userSettings,
      });

      await updateLectureSummary(activeLecture.id, summaryResult);
      setActiveLecture(prev => ({ ...prev, summary: summaryResult }));
      setLectures(prev => prev.map(l => l.id === activeLecture.id ? { ...l, summary: summaryResult } : l));
    } catch (err) {
      console.error("Summary regeneration error:", err);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // 10. Save a newly recorded lecture
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

  // 11. Delete active lecture
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

  // 12. Load / Reset Sample Lecture
  const handleLoadSampleLecture = async () => {
    const sample = createSampleLecture();
    sample.id = `sample-${Date.now()}`;
    await saveLecture(sample);
    setLectures(prev => [sample, ...prev]);
    setActiveLectureId(sample.id);
    setActiveLecture(sample);
  };

  // 13. Import Bundle (.lecnote.json)
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

  // 14. Save Cloud Settings
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

  const renderSidebarContent = (isMobile = false) => (
    <>
      {/* Sidebar Top: Search & Sample loader */}
      <div className="p-3 sm:p-3.5 border-b border-slate-800 space-y-2">
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
          onClick={() => {
            handleLoadSampleLecture();
            if (isMobile) setIsMobileDrawerOpen(false);
          }}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-[11px] font-semibold border border-slate-700/80 transition-colors"
        >
          <RefreshCw className="w-3 h-3 text-indigo-400" />
          <span>+ Load Sample Banglish Lecture</span>
        </button>
      </div>

      {/* Lectures List with Rename and Delete */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredLectures.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No lectures found.
          </div>
        ) : (
          filteredLectures.map((lec) => {
            const isActive = lec.id === activeLectureId;
            const isRenaming = renamingLectureId === lec.id;
            const highlightWordsCount = lec.words?.filter(w => w.isHighlighted)?.length || 0;

            if (isRenaming) {
              return (
                <div
                  key={lec.id}
                  className="p-3 rounded-2xl bg-slate-900 border border-indigo-500/80 shadow-lg space-y-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={renameTitleInput}
                      onChange={(e) => setRenameTitleInput(e.target.value)}
                      placeholder="Lecture Title"
                      className="w-full bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={renameCourseInput}
                      onChange={(e) => setRenameCourseInput(e.target.value)}
                      placeholder="Course / Tag (e.g. CSE 207)"
                      className="w-full bg-slate-800 border border-slate-700 text-[11px] rounded-lg px-2.5 py-1 text-slate-300 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button
                      onClick={() => setRenamingLectureId(null)}
                      className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleRenameLecture(lec.id, renameTitleInput, renameCourseInput)}
                      className="px-3 py-1 text-[11px] rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                    >
                      Save
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={lec.id}
                onClick={() => {
                  setActiveLectureId(lec.id);
                  if (isMobile) setIsMobileDrawerOpen(false);
                }}
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

                  {/* Actions: Share, Rename & Delete */}
                  <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveLectureId(lec.id);
                        setShareTargetLecture(lec);
                        setIsExportModalOpen(true);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                      title={`Share "${lec.title}"`}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingLectureId(lec.id);
                        setRenameTitleInput(lec.title);
                        setRenameCourseInput(lec.course || 'General');
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors"
                      title="Rename lecture"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteLecture(lec.id, e)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Delete note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
    </>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Top Header Navbar */}
      <header className="flex-shrink-0 h-14 sm:h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between z-30">
        {/* Brand & Mobile Hamburger */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Drawer Button */}
          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            className="md:hidden p-2 -ml-1 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors focus:outline-none flex items-center justify-center"
            title="Open Lecture Notes Drawer"
            aria-label="Open Lectures Drawer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 p-0.5 shadow-lg shadow-indigo-600/30 flex items-center justify-center flex-shrink-0">
            <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">LecNote AI</h1>
              <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/60 uppercase">
                Free PWA
              </span>
            </div>
            <p className="hidden sm:block text-[11px] text-slate-400 font-medium">
              Bangla • English • Banglish Voice Note Studio
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Cloud AI Boost Status */}
          <button
            onClick={() => setIsCloudAiModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
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
            onClick={() => {
              setShareTargetLecture(activeLecture);
              setIsExportModalOpen(true);
            }}
            disabled={!activeLecture}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
            title="Share this specific recording"
          >
            <Share2 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Export & Share</span>
          </button>

          {/* New Recording Button */}
          <button
            onClick={() => setIsRecordModalOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 ring-2 ring-rose-400/40 transition-all"
            title="Open Live Recording Studio"
          >
            <Mic className="w-4 h-4 fill-current" />
            <span className="hidden sm:inline">Record Lecture</span>
            <span className="sm:hidden">Record</span>
          </button>
        </div>
      </header>

      {/* Main Body Layout (Sidebar + Note Studio) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop Left Sidebar: Permanent */}
        <aside className="hidden md:flex w-72 lg:w-80 border-r border-slate-800 bg-slate-900/40 flex-col flex-shrink-0">
          {renderSidebarContent(false)}
        </aside>

        {/* Mobile Slide-Over Drawer with Backdrop */}
        {isMobileDrawerOpen && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm md:hidden animate-fadeIn"
            onClick={() => setIsMobileDrawerOpen(false)}
          >
            <div
              className="fixed inset-y-0 left-0 z-50 w-72 sm:w-80 bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Top Header */}
              <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-900">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    All Lectures ({lectures.length})
                  </span>
                </div>
                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {renderSidebarContent(true)}
            </div>
          </div>
        )}

        {/* Right Main Studio: Active Lecture Note View */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-950/90 w-full min-w-0">
          {!activeLecture ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
              <FolderOpen className="w-12 h-12 stroke-1 mb-3 text-slate-600" />
              <h3 className="text-base font-semibold text-slate-400">No Lecture Selected</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Select an existing lecture from the drawer, load a sample lecture, or hit Record to capture a classroom session.
              </p>
              <button
                onClick={() => setIsMobileDrawerOpen(true)}
                className="mt-4 md:hidden px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
              >
                Browse Lectures
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden w-full min-w-0">
              {/* Lecture Header & Tabs */}
              <div className="px-3 sm:px-6 pt-3 sm:pt-4 pb-2.5 sm:pb-3 border-b border-slate-800 bg-slate-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 flex-shrink-0">
                <div className="min-w-0 flex-1">
                  {isEditingHeaderTitle ? (
                    /* Inline Rename Form in Header */
                    <div className="flex flex-wrap items-center gap-2 py-1">
                      <input
                        type="text"
                        value={headerTitleInput}
                        onChange={(e) => setHeaderTitleInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameLecture(activeLecture.id, headerTitleInput, headerCourseInput);
                          if (e.key === 'Escape') setIsEditingHeaderTitle(false);
                        }}
                        placeholder="Lecture Title"
                        className="bg-slate-800 border border-indigo-500 text-white text-xs sm:text-sm font-semibold rounded-lg px-2.5 py-1 focus:outline-none"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={headerCourseInput}
                        onChange={(e) => setHeaderCourseInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameLecture(activeLecture.id, headerTitleInput, headerCourseInput);
                          if (e.key === 'Escape') setIsEditingHeaderTitle(false);
                        }}
                        placeholder="Course/Tag"
                        className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1 w-24 sm:w-28 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={() => handleRenameLecture(activeLecture.id, headerTitleInput, headerCourseInput)}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs"
                        title="Save Title"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setIsEditingHeaderTitle(false)}
                        className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    /* Normal Display with 1-Click Rename Pencil */
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm sm:text-base md:text-lg font-bold text-white tracking-tight truncate">
                          {activeLecture.title}
                        </h2>
                        <button
                          onClick={() => {
                            setHeaderTitleInput(activeLecture.title);
                            setHeaderCourseInput(activeLecture.course || 'General');
                            setIsEditingHeaderTitle(true);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors"
                          title="Rename this lecture"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setShareTargetLecture(activeLecture);
                            setIsExportModalOpen(true);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                          title={`Share "${activeLecture.title}"`}
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-indigo-400 border border-slate-700 flex-shrink-0">
                          {formatTime(activeLecture.duration)}
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-400 truncate mt-0.5">
                        {activeLecture.course} • {activeLecture.language === 'auto' ? 'Mixed Banglish' : activeLecture.language}
                      </p>
                    </div>
                  )}
                </div>

                {/* View Tabs: Segmented Control */}
                <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-inner w-full sm:w-auto flex-shrink-0">
                  <button
                    onClick={() => setActiveTab('transcript')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'transcript'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Highlighter className="w-3.5 h-3.5" />
                    <span>Transcript</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('summary')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'summary'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Summary & Notes</span>
                  </button>
                </div>
              </div>

              {/* Main Content Pane */}
              <div className="flex-1 overflow-hidden p-2 sm:p-4 md:p-6 w-full min-w-0">
                {activeTab === 'transcript' ? (
                  <TranscriptView
                    words={activeLecture.words || []}
                    currentTime={currentTime}
                    duration={activeLecture.duration}
                    onWordClick={handleWordClick}
                    onWordUpdate={handleWordUpdate}
                    onBatchWordsUpdate={handleBatchWordsUpdate}
                    highlightMode={highlightMode}
                    highlightColor={highlightColor}
                    setHighlightMode={setHighlightMode}
                    setHighlightColor={setHighlightColor}
                    onTranscribe={handleTranscribeActiveLecture}
                    isTranscribing={isTranscribingLecture}
                    hasAudio={!!activeLecture.audioBlob}
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
              <div className="flex-shrink-0 p-2 sm:p-4 border-t border-slate-800/80 bg-slate-950/95 w-full">
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
        userSettings={userSettings}
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
        onClose={() => {
          setIsExportModalOpen(false);
          setShareTargetLecture(null);
        }}
        lecture={shareTargetLecture || activeLecture}
        onImportBundle={handleImportBundle}
      />

      {/* Quick API Key / Instant Whisper Transcription Modal */}
      {quickTranscribeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg bg-slate-900 border border-indigo-500/50 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col space-y-4 max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setQuickTranscribeModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <Sparkles className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Transcribe "{activeLecture?.title}"</h3>
                <p className="text-xs text-slate-400">Convert recorded audio into word-by-word interactive text</p>
              </div>
            </div>

            {/* Option A: Zero-Key In-Browser AI */}
            <div className="p-4 bg-gradient-to-r from-emerald-950/60 to-slate-950 border border-emerald-800/60 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Option 1: 100% Free In-Browser AI (Zero Keys)
                </span>
                <span className="text-[10px] bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded-full font-mono">
                  No API Key
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Runs speech-to-text directly inside your browser using Whisper WebAssembly. 100% free, private, and requires zero setup.
              </p>
              <button
                onClick={handleRunLocalWhisper}
                disabled={localWhisperLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {localWhisperLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{localWhisperProgress || "Transcribing in browser..."}</span>
                  </>
                ) : (
                  <span>⚡ Run Free In-Browser AI (Zero Keys)</span>
                )}
              </button>
            </div>

            {/* Option B: Ultra-Fast Cloud Whisper Large v3 */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  Option 2: Ultra-Fast Cloud Whisper (Groq)
                </span>
                <span className="text-[10px] bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                  0.8s Speed
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Transcribes long audio in ~1 second with Whisper Large v3. Groq provides this for <strong>100% FREE</strong> with 0 credit card.
              </p>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold underline"
              >
                <span>🔑 Click here to get a Free Groq Key (Takes 10s with Google login)</span>
              </a>

              <div className="space-y-1.5">
                <input
                  type="password"
                  value={quickApiKeyInput}
                  onChange={(e) => setQuickApiKeyInput(e.target.value)}
                  placeholder="Paste free Groq key (starts with gsk_...)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleQuickSaveKeyAndTranscribe}
                  disabled={!quickApiKeyInput.trim() || isTranscribingLecture}
                  className="w-full py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isTranscribingLecture ? "Cloud AI Transcribing..." : "Save Key & Transcribe Instantly"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                onClick={() => setQuickTranscribeModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
