import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Sparkles, FastForward } from 'lucide-react';
import { formatTime } from '../services/audioUtils';

const KaraokePlayer = forwardRef(function KaraokePlayer({
  audioBlob,
  audioMimeType = 'audio/wav',
  duration = 0,
  onTimeUpdate,
  activeWord = null,
  seekingBadge = null,
}, ref) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1.0);

  // Expose imperative API for external seek & play (from word click)
  useImperativeHandle(ref, () => ({
    seekAndPlay: (seconds) => {
      const audio = audioRef.current;
      if (!audio) return;
      const targetTime = Math.max(0, Math.min(seconds, totalDuration || 9999));
      audio.currentTime = targetTime;
      setCurrentTime(targetTime);
      onTimeUpdate?.(targetTime);
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    },
    pause: () => {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    },
    getCurrentTime: () => currentTime,
  }));

  // Create Object URL from audio Blob
  useEffect(() => {
    if (!audioBlob) {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);
    setIsPlaying(false);
    setCurrentTime(0);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [audioBlob]);

  // Sync total duration when prop changes
  useEffect(() => {
    if (duration > 0) {
      setTotalDuration(duration);
    }
  }, [duration]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn("Audio play prevented:", err);
      });
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const curr = audio.currentTime;
    setCurrentTime(curr);
    onTimeUpdate?.(curr);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
      setTotalDuration(audio.duration);
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    const target = parseFloat(e.target.value);
    if (audio) {
      audio.currentTime = target;
    }
    setCurrentTime(target);
    onTimeUpdate?.(target);
  };

  const handleSkip = (delta) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = Math.max(0, Math.min(audio.currentTime + delta, totalDuration || 9999));
    audio.currentTime = newTime;
    setCurrentTime(newTime);
    onTimeUpdate?.(newTime);
  };

  const cycleSpeed = () => {
    const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    onTimeUpdate?.(0);
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="relative bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl">
      {/* Hidden native audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleAudioEnded}
          preload="auto"
        />
      )}

      {/* Floating Seek / Active Word Badge */}
      {seekingBadge && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-full shadow-lg border border-indigo-400 animate-bounce">
          <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
          <span>Jumped to {seekingBadge}</span>
        </div>
      )}

      {/* Progress Scrubber */}
      <div className="space-y-1.5 mb-3">
        <div className="relative flex items-center group">
          <input
            type="range"
            min="0"
            max={totalDuration || 100}
            step="0.05"
            value={currentTime}
            onChange={handleSeek}
            aria-label="Seek audio playback"
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
            style={{
              background: `linear-gradient(to right, #6366f1 ${progressPercent}%, #334155 ${progressPercent}%)`
            }}
          />
        </div>

        {/* Timers & Active Karaoke Word Preview */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span className="text-indigo-400 font-semibold">{formatTime(currentTime)}</span>
          {activeWord && (
            <span className="text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 max-w-[200px] truncate text-center">
              Now: <strong className="text-indigo-300">{activeWord.word}</strong>
            </span>
          )}
          <span>{formatTime(totalDuration)}</span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Replay 5s */}
          <button
            onClick={() => handleSkip(-5)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Rewind 5 seconds"
            aria-label="Rewind 5 seconds"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Main Play / Pause Button */}
          <button
            onClick={togglePlay}
            disabled={!audioBlob}
            className={`p-3 rounded-full font-medium transition-all shadow-md ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/25 ring-2 ring-amber-400/40'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 ring-2 ring-indigo-400/40'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isPlaying ? 'Pause' : 'Play (Click any word to seek)'}
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          {/* Forward 5s */}
          <button
            onClick={() => handleSkip(5)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Fast forward 5 seconds"
            aria-label="Fast forward 5 seconds"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Speed & Volume Tools */}
        <div className="flex items-center gap-2">
          {/* Speed Toggle */}
          <button
            onClick={cycleSpeed}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition-colors flex items-center gap-1"
            title="Playback Speed"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>{playbackRate}x</span>
          </button>

          {/* Mute toggle */}
          <button
            onClick={toggleMute}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
});

export default KaraokePlayer;
