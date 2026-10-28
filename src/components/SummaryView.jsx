import React, { useState } from 'react';
import { Sparkles, BookOpen, CheckCircle2, Highlighter, Copy, Check, RefreshCw, Cpu, Cloud } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function SummaryView({
  summary,
  words = [],
  onRegenerate,
  isGenerating = false,
  cloudConfigured = false,
  activeEngineName = 'Local AI Engine (Zero-Cost)',
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!summary) return;
    const textToCopy = `
LECNOTE AI SUMMARY & STUDY NOTES
--------------------------------
OVERVIEW:
${summary.overview || ''}

KEY TAKEAWAYS:
${(summary.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n')}

HIGHLIGHTED TERMS & FORMULAS:
${(summary.highlightedPhrases || []).join(', ')}

ACTION / STUDY ITEMS:
${(summary.actionItems || []).map(a => `• ${a}`).join('\n')}

Generated via: ${summary.generatedBy || activeEngineName}
    `.trim();

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.8 }
    });
  };

  const handleRegenerateClick = () => {
    onRegenerate?.();
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-3.5 sm:px-5 sm:py-4 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center gap-2 flex-wrap">
          <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400 flex-shrink-0" />
          <h3 className="font-semibold text-slate-100 text-xs sm:text-sm">Summary & Smart Notes</h3>
          <span className="text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/80 flex items-center gap-1">
            {cloudConfigured ? <Cloud className="w-3 h-3 text-sky-400" /> : <Cpu className="w-3 h-3 text-emerald-400" />}
            <span className="truncate max-w-[160px] sm:max-w-none">{summary?.generatedBy || activeEngineName}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleCopy}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
            title="Copy formatted summary to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          <button
            onClick={handleRegenerateClick}
            disabled={isGenerating || words.length === 0}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Analyzing...' : 'Regenerate'}</span>
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex-1 p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6">
        {!summary ? (
          <div className="text-center py-12 text-slate-500 space-y-3">
            <Sparkles className="w-10 h-10 mx-auto text-indigo-400 stroke-1" />
            <p className="text-sm font-medium">No summary generated yet.</p>
            <button
              onClick={handleRegenerateClick}
              disabled={isGenerating || words.length === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow"
            >
              Generate Instant Summary (100% Free)
            </button>
          </div>
        ) : (
          <>
            {/* Overview Section */}
            <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Lecture Overview
              </h4>
              <p className="text-sm text-slate-200 leading-relaxed">
                {summary.overview || 'Overview not available.'}
              </p>
            </div>

            {/* Key Takeaways */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Core Takeaways & Conceptual Insights
              </h4>
              <div className="space-y-2">
                {(summary.keyPoints || []).map((point, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-800/60 hover:border-slate-700 transition-colors"
                  >
                    <span className="w-5 h-5 rounded-full bg-indigo-900/60 text-indigo-300 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-sm text-slate-200 leading-snug">{point}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Highlighted Phrases */}
            {(summary.highlightedPhrases && summary.highlightedPhrases.length > 0) && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2.5 flex items-center gap-1.5">
                  <Highlighter className="w-3.5 h-3.5" />
                  Highlighted Important Terms & Formulas
                </h4>
                <div className="flex flex-wrap gap-2">
                  {summary.highlightedPhrases.map((phrase, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 text-xs font-semibold rounded-md bg-yellow-400 text-slate-950 shadow-sm"
                    >
                      {phrase}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items */}
            {summary.actionItems && summary.actionItems.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-sky-400 mb-2.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Exam Prep & Follow-up Actions
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {summary.actionItems.map((act, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
