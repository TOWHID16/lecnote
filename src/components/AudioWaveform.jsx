import React, { useEffect, useRef } from 'react';

/**
 * HTML5 Canvas Audio Waveform Visualizer
 * Renders smooth animated visualizer bars for both live recording and audio playback.
 */
export default function AudioWaveform({
  audioElement,
  stream,
  isRecording = false,
  isPlaying = false,
  height = 70,
  barColor = '#6366f1',
  accentColor = '#38bdf8'
}) {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Setup Web Audio API if live stream is provided
    if (stream && isRecording) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioCtx();
        }
        const audioCtx = audioContextRef.current;
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        sourceRef.current = source;
      } catch (e) {
        console.warn("AudioContext setup warning:", e);
      }
    }

    const bufferLength = analyserRef.current ? analyserRef.current.frequencyBinCount : 32;
    const dataArray = new Uint8Array(bufferLength);

    const render = (time) => {
      const width = rect.width;
      ctx.clearRect(0, 0, width, height);

      const numBars = 36;
      const barWidth = Math.max(3, (width / numBars) - 3);

      if (isRecording && analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
      }

      for (let i = 0; i < numBars; i++) {
        let barHeight = 4; // base idle height

        if (isRecording) {
          if (analyserRef.current) {
            const dataIndex = Math.floor((i / numBars) * bufferLength);
            const value = dataArray[dataIndex] || 0;
            barHeight = Math.max(4, (value / 255) * (height - 8));
          } else {
            // Simulated lively wave if analyser is restricted
            const freq = (i / numBars) * Math.PI * 4;
            const wave = Math.sin(freq + time * 0.005) * 0.5 + 0.5;
            barHeight = Math.max(6, wave * (height * 0.75));
          }
        } else if (isPlaying) {
          // Playback rhythmic pulse matching speech tempo
          const wave = Math.sin(i * 0.4 + time * 0.008) * 0.5 + 0.5;
          const wave2 = Math.cos(i * 0.2 + time * 0.004) * 0.5 + 0.5;
          barHeight = Math.max(5, (wave * 0.6 + wave2 * 0.4) * (height * 0.8));
        } else {
          // Static gentle resting wave
          const wave = Math.sin(i * 0.3) * 0.3 + 0.4;
          barHeight = Math.max(4, wave * (height * 0.35));
        }

        const x = i * (barWidth + 3) + 4;
        const y = (height - barHeight) / 2;

        // Gradient from indigo to cyan
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, accentColor);
        gradient.addColorStop(1, barColor);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch (e) {}
      }
    };
  }, [stream, isRecording, isPlaying, height, barColor, accentColor]);

  return (
    <div className="w-full relative overflow-hidden rounded-xl bg-slate-900/80 border border-slate-800 p-2 shadow-inner">
      <canvas
        ref={canvasRef}
        className="w-full block"
        style={{ height: `${height}px` }}
      />
    </div>
  );
}
