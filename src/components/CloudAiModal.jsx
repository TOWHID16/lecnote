import React, { useState, useEffect } from 'react';
import { X, Sparkles, Key, CheckCircle, ShieldCheck, Zap, ExternalLink, RefreshCw, Cpu } from 'lucide-react';

export default function CloudAiModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) {
  const [groqKey, setGroqKey] = useState(settings?.groqKey || '');
  const [geminiKey, setGeminiKey] = useState(settings?.geminiKey || '');
  const [preferredProvider, setPreferredProvider] = useState(settings?.preferredProvider || 'groq');
  const [testStatus, setTestStatus] = useState(null); // { type: 'success' | 'error', message: '' }
  const [isTesting, setIsTesting] = useState(false);

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-detect keys from Vite environment variables if available
  useEffect(() => {
    const envGroq = import.meta.env.VITE_GROQ_API_KEY || '';
    const envGemini = import.meta.env.VITE_GEMINI_API_KEY || '';

    if (!groqKey && envGroq) {
      setGroqKey(envGroq);
    }
    if (!geminiKey && envGemini) {
      setGeminiKey(envGemini);
    }
  }, [isOpen]);

  const handleAutoDetect = () => {
    const envGroq = import.meta.env.VITE_GROQ_API_KEY || '';
    const envGemini = import.meta.env.VITE_GEMINI_API_KEY || '';

    let found = 0;
    if (envGroq) {
      setGroqKey(envGroq);
      found++;
    }
    if (envGemini) {
      setGeminiKey(envGemini);
      found++;
    }

    if (found > 0) {
      setTestStatus({
        type: 'success',
        message: `Auto-detected ${found} key(s) from .env environment configuration!`
      });
    } else {
      setTestStatus({
        type: 'info',
        message: 'No keys detected in .env file. You can paste keys below or continue using the 100% Free Offline Engine!'
      });
    }
  };

  const testGroqConnection = async () => {
    if (!groqKey) {
      setTestStatus({ type: 'error', message: 'Please enter a Groq API Key first.' });
      return;
    }
    setIsTesting(true);
    setTestStatus(null);
    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${groqKey.trim()}` }
      });
      if (res.ok) {
        setTestStatus({ type: 'success', message: 'Groq Cloud AI Connected! Whisper Large v3 & Llama 3.3 are ready.' });
      } else {
        const err = await res.text();
        setTestStatus({ type: 'error', message: `Groq error: ${res.status} ${err}` });
      }
    } catch (e) {
      setTestStatus({ type: 'error', message: `Connection test failed: ${e.message}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    onSaveSettings?.({
      groqKey: groqKey.trim(),
      geminiKey: geminiKey.trim(),
      preferredProvider,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 sm:top-5 right-4 sm:right-5 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-5">
          <div className="p-2.5 sm:p-3 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex-shrink-0">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">Cloud AI Boost (Optional)</h2>
            <p className="text-[11px] sm:text-xs text-slate-400">Upgrade to Whisper Large v3 & Llama 3.3 for high-speed Banglish accuracy</p>
          </div>
        </div>

        {/* Keyless Notice Banner */}
        <div className="bg-emerald-950/40 border border-emerald-800/70 rounded-2xl p-3.5 mb-5 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-200">
            <strong className="text-emerald-300 font-semibold">100% Free Default Mode Active:</strong> LecNote AI works offline without any API keys using your browser's Web Speech engine and built-in local extractive AI. Adding keys below is strictly optional!
          </div>
        </div>

        {/* One-Click Auto-Detect Button */}
        <div className="mb-5">
          <button
            onClick={handleAutoDetect}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
            <span>Auto-Detect Keys from Project Environment (.env)</span>
          </button>
        </div>

        {/* Groq Settings */}
        <div className="space-y-4 mb-5">
          <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                Groq API Key (Recommended for Whisper Large v3)
              </label>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <span>Get Free Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <input
              type="password"
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              placeholder="gsk_..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
            />

            <div className="flex justify-end">
              <button
                onClick={testGroqConnection}
                disabled={isTesting || !groqKey}
                className="text-xs font-semibold px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
              >
                {isTesting ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </div>

          {/* Gemini Settings */}
          <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-sky-400" />
                Google Gemini API Key (Gemini 1.5/2.0 Flash)
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <span>Get Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
        </div>

        {/* Status Message */}
        {testStatus && (
          <div className={`p-3 rounded-xl text-xs mb-4 flex items-center gap-2 ${
            testStatus.type === 'success'
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
              : testStatus.type === 'error'
              ? 'bg-rose-950/60 text-rose-300 border border-rose-800'
              : 'bg-indigo-950/60 text-indigo-300 border border-indigo-800'
          }`}>
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{testStatus.message}</span>
          </div>
        )}

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
