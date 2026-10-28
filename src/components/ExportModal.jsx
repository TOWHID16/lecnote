import React, { useState } from 'react';
import { X, Share2, Download, FileText, FileSpreadsheet, Upload, Check, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import { blobToBase64, formatTime } from '../services/audioUtils';

export default function ExportModal({
  isOpen,
  onClose,
  lecture,
  onImportBundle,
}) {
  const [copied, setCopied] = useState(false);
  const [exportingBundle, setExportingBundle] = useState(false);
  const [importNotice, setImportNotice] = useState(null);

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !lecture) return null;

  // 1. Web Share API
  const handleNativeShare = async () => {
    if (!navigator.share) {
      alert("Web Share API is not supported on this browser. Use the Download or Copy options below!");
      return;
    }

    try {
      const summaryText = lecture.summary
        ? `\n\nOverview:\n${lecture.summary.overview}\n\nKey Points:\n${(lecture.summary.keyPoints || []).map(p => `• ${p}`).join('\n')}`
        : '';
      const textToShare = `LecNote AI: ${lecture.title}\nCourse: ${lecture.course || 'General'}\nDuration: ${formatTime(lecture.duration)}${summaryText}`;

      const shareData = {
        title: lecture.title,
        text: textToShare,
      };

      // If audioBlob is present and can be shared as file
      if (lecture.audioBlob && navigator.canShare && navigator.canShare({ files: [new File([lecture.audioBlob], 'lecture.wav', { type: lecture.audioMimeType || 'audio/wav' })] })) {
        const file = new File([lecture.audioBlob], `${lecture.title.replace(/\s+/g, '_')}.wav`, { type: lecture.audioMimeType || 'audio/wav' });
        shareData.files = [file];
      }

      await navigator.share(shareData);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn("Share failed:", err);
      }
    }
  };

  // 2. Export Portable .lecnote.json Bundle
  const handleExportBundle = async () => {
    setExportingBundle(true);
    try {
      let audioBase64 = null;
      if (lecture.audioBlob) {
        audioBase64 = await blobToBase64(lecture.audioBlob);
      }

      const bundle = {
        version: "1.0",
        app: "LecNote AI",
        exportedAt: new Date().toISOString(),
        lecture: {
          id: lecture.id,
          title: lecture.title,
          course: lecture.course,
          duration: lecture.duration,
          language: lecture.language,
          createdAt: lecture.createdAt,
          words: lecture.words,
          summary: lecture.summary,
          audioMimeType: lecture.audioMimeType,
          audioBase64: audioBase64,
        }
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${lecture.title.replace(/[^a-zA-Z0-9_\-\u0980-\u09FF]/g, '_')}.lecnote.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Bundle export failed:", err);
      alert("Failed to export bundle: " + err.message);
    } finally {
      setExportingBundle(false);
    }
  };

  // 3. Export Audio File Only
  const handleDownloadAudio = () => {
    if (!lecture.audioBlob) {
      alert("No audio data available for this note.");
      return;
    }
    const ext = lecture.audioMimeType?.includes('webm') ? 'webm' : 'wav';
    const url = URL.createObjectURL(lecture.audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lecture.title.replace(/[^a-zA-Z0-9_\-\u0980-\u09FF]/g, '_')}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 4. Export Formatted TXT
  const handleExportTxt = () => {
    const lines = [];
    lines.push(`====================================================`);
    lines.push(`LECNOTE AI - INTERACTIVE LECTURE NOTE`);
    lines.push(`Title: ${lecture.title}`);
    lines.push(`Course: ${lecture.course || 'General'}`);
    lines.push(`Date: ${new Date(lecture.createdAt).toLocaleString()}`);
    lines.push(`Duration: ${formatTime(lecture.duration)}`);
    lines.push(`====================================================\n`);

    if (lecture.summary) {
      lines.push(`[SUMMARY & KEY TAKEAWAYS]`);
      lines.push(lecture.summary.overview || '');
      lines.push('');
      (lecture.summary.keyPoints || []).forEach((kp, i) => {
        lines.push(`${i + 1}. ${kp}`);
      });
      lines.push('');
      if (lecture.summary.highlightedPhrases?.length) {
        lines.push(`Highlighted Key Concepts: ${lecture.summary.highlightedPhrases.join(', ')}`);
        lines.push('');
      }
    }

    lines.push(`[FULL TIME-ALIGNED TRANSCRIPTION]`);
    lecture.words.forEach((w) => {
      const mark = w.isHighlighted ? `[★ ${w.word}]` : w.word;
      lines.push(`(${formatTime(w.startTime)}) ${mark}`);
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lecture.title.replace(/[^a-zA-Z0-9_\-\u0980-\u09FF]/g, '_')}_notes.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 5. Export PDF using jsPDF
  const handleExportPdf = () => {
    const doc = new jsPDF();
    let y = 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(79, 70, 229); // indigo
    doc.text("LecNote AI - Lecture Notes", 14, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text(`Title: ${lecture.title}`, 14, y);
    y += 6;
    doc.text(`Duration: ${formatTime(lecture.duration)}  |  Course: ${lecture.course || 'General'}`, 14, y);
    y += 10;

    // Summary Section
    if (lecture.summary) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59);
      doc.text("Overview & Core Insights", 14, y);
      y += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const splitOverview = doc.splitTextToSize(lecture.summary.overview || '', 180);
      doc.text(splitOverview, 14, y);
      y += splitOverview.length * 5 + 4;

      (lecture.summary.keyPoints || []).forEach((kp, idx) => {
        if (y > 270) {
          doc.addPage();
          y = 15;
        }
        const bulletText = `${idx + 1}. ${kp}`;
        const splitBullet = doc.splitTextToSize(bulletText, 175);
        doc.text(splitBullet, 16, y);
        y += splitBullet.length * 5 + 2;
      });
      y += 6;
    }

    // Highlighted words list
    const highlighted = lecture.words.filter(w => w.isHighlighted).map(w => w.word);
    if (highlighted.length > 0) {
      if (y > 260) {
        doc.addPage();
        y = 15;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(180, 83, 9); // amber
      doc.text("Important Highlighted Terms:", 14, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      const splitHL = doc.splitTextToSize(highlighted.join(', '), 180);
      doc.text(splitHL, 14, y);
      y += splitHL.length * 4 + 8;
    }

    // Transcript Section
    if (y > 250) {
      doc.addPage();
      y = 15;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text("Lecture Transcript & Timestamps", 14, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);

    const fullTranscript = lecture.words.map(w => `${w.word}`).join(' ');
    const splitTranscript = doc.splitTextToSize(fullTranscript, 180);

    splitTranscript.forEach(line => {
      if (y > 280) {
        doc.addPage();
        y = 15;
      }
      doc.text(line, 14, y);
      y += 4.5;
    });

    doc.save(`${lecture.title.replace(/[^a-zA-Z0-9_\-\u0980-\u09FF]/g, '_')}_notes.pdf`);
  };

  // 6. Handle Import .lecnote.json Bundle
  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (!json.lecture || !json.lecture.words) {
          throw new Error("Invalid .lecnote.json file format");
        }
        onImportBundle?.(json.lecture);
        setImportNotice("Bundle imported successfully!");
        setTimeout(() => {
          setImportNotice(null);
          onClose();
        }, 1200);
      } catch (err) {
        setImportNotice("Import error: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 sm:top-5 right-4 sm:right-5 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
          <div className="p-2.5 sm:p-3 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex-shrink-0">
            <Share2 className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">Share Recording</h2>
            <p className="text-[11px] sm:text-xs text-slate-400">Share or export this specific voice lecture note</p>
          </div>
        </div>

        {/* Selected Lecture Details Badge */}
        <div className="p-3 bg-slate-950/90 rounded-2xl border border-indigo-900/60 mb-3 sm:mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Selected Recording:</span>
            <h3 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">{lecture.title}</h3>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {lecture.course || 'General'} • {formatTime(lecture.duration)} • {lecture.words?.length || 0} words
            </p>
          </div>
        </div>

        {/* 1. Web Share API */}
        <div className="p-3 sm:p-4 bg-indigo-950/40 border border-indigo-800/60 rounded-xl sm:rounded-2xl mb-3 sm:mb-4 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-1.5 sm:gap-2">
              <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400 flex-shrink-0" />
              <span>One-Click Share ({lecture.title})</span>
            </h4>
            <p className="text-[11px] text-slate-300 mt-0.5 truncate">Send via WhatsApp, AirDrop, Telegram, etc.</p>
          </div>
          <button
            onClick={handleNativeShare}
            className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow transition-all flex items-center gap-1.5 flex-shrink-0"
          >
            <span>Share</span>
          </button>
        </div>

        {/* 2. Export Formats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-4">
          {/* Portable .lecnote.json */}
          <button
            onClick={handleExportBundle}
            disabled={exportingBundle}
            className="flex flex-col items-start p-3.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 rounded-2xl text-left transition-colors group"
          >
            <Download className="w-5 h-5 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-white">.lecnote.json Bundle</span>
            <span className="text-[11px] text-slate-400 mt-0.5">Full interactive note + audio for friends</span>
          </button>

          {/* PDF Document */}
          <button
            onClick={handleExportPdf}
            className="flex flex-col items-start p-3.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 rounded-2xl text-left transition-colors group"
          >
            <FileText className="w-5 h-5 text-rose-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-white">Export PDF</span>
            <span className="text-[11px] text-slate-400 mt-0.5">Printable summary and full transcript</span>
          </button>

          {/* Text File */}
          <button
            onClick={handleExportTxt}
            className="flex flex-col items-start p-3.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 rounded-2xl text-left transition-colors group"
          >
            <FileSpreadsheet className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-white">Plain Text (.txt)</span>
            <span className="text-[11px] text-slate-400 mt-0.5">Markdown and timestamped transcript</span>
          </button>

          {/* Raw Audio File */}
          <button
            onClick={handleDownloadAudio}
            className="flex flex-col items-start p-3.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 rounded-2xl text-left transition-colors group"
          >
            <Download className="w-5 h-5 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-white">Download Audio</span>
            <span className="text-[11px] text-slate-400 mt-0.5">Original recorded .wav/.webm audio</span>
          </button>
        </div>

        {/* 3. Import Bundle Section */}
        <div className="p-4 bg-slate-800/30 border border-dashed border-slate-700 rounded-2xl text-center">
          <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
          <h4 className="text-xs font-bold text-slate-200">Import .lecnote.json from Peer</h4>
          <p className="text-[11px] text-slate-400 mt-1 mb-3">Load a peer-shared lecture bundle into your browser storage</p>
          <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold cursor-pointer border border-slate-700 transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Select .lecnote.json</span>
            <input
              type="file"
              accept=".json,.lecnote.json"
              onChange={handleFileImport}
              className="hidden"
            />
          </label>
        </div>

        {importNotice && (
          <div className="mt-3 p-2.5 rounded-xl text-xs bg-indigo-950/80 text-indigo-300 border border-indigo-800 flex items-center justify-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{importNotice}</span>
          </div>
        )}
      </div>
    </div>
  );
}
