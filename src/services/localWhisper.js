import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriberPromise = null;

export async function getLocalWhisperPipeline(onProgress) {
  if (!transcriberPromise) {
    transcriberPromise = pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
      progress_callback: onProgress
    });
  }
  return transcriberPromise;
}

export async function transcribeWithLocalWhisper(audioBlob, onProgress) {
  const transcriber = await getLocalWhisperPipeline(onProgress);
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const float32Array = audioBuffer.getChannelData(0);

  const output = await transcriber(float32Array, {
    return_timestamps: 'word',
    chunk_length_s: 30,
  });

  const chunks = output.chunks || [];
  const words = [];

  chunks.forEach((chunk, cIdx) => {
    const chunkText = chunk.text?.trim() || '';
    const chunkWords = chunkText.split(/\s+/).filter(Boolean);
    const start = chunk.timestamp?.[0] || 0;
    const end = chunk.timestamp?.[1] || start + 1;
    const duration = Math.max(0.3, end - start);
    const wordDur = duration / Math.max(1, chunkWords.length);

    chunkWords.forEach((w, wIdx) => {
      const wStart = start + wIdx * wordDur;
      const wEnd = wStart + wordDur;
      words.push({
        id: `local-w-${cIdx}-${wIdx}-${Date.now()}`,
        word: w,
        startTime: parseFloat(wStart.toFixed(2)),
        endTime: parseFloat(wEnd.toFixed(2)),
        isHighlighted: false,
        highlightColor: 'yellow'
      });
    });
  });

  return {
    text: output.text,
    words: words.length > 0 ? words : output.text.split(/\s+/).map((w, i) => ({
      id: `w-${i}-${Date.now()}`,
      word: w,
      startTime: parseFloat((i * 0.4).toFixed(2)),
      endTime: parseFloat(((i + 1) * 0.4).toFixed(2)),
      isHighlighted: false,
      highlightColor: 'yellow'
    }))
  };
}
