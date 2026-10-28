/**
 * LecNote AI - Summarizer Engine
 * Supports 100% Free Offline Client-Side Extractive Summarizer
 * + Cloud AI Boost (Groq Llama-3 / Gemini Flash)
 */

// Common English and Bangla stop words for extractive NLP
const STOP_WORDS = new Set([
  // English
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of',
  'it', 'this', 'that', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
  'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
  'i', 'you', 'he', 'she', 'we', 'they', 'them', 'their', 'our', 'my', 'your', 'so', 'then',
  // Bangla
  'এই', 'এবং', 'ও', 'বা', 'কিন্তু', 'যদি', 'তবে', 'তাহলে', 'না', 'কি', 'কী', 'করে', 'করা',
  'হবে', 'হলো', 'হয়েছে', 'আছে', 'ছিল', 'থাকে', 'যে', 'সে', 'তিনি', 'তারা', 'আমরা', 'তোমরা',
  'নিয়ে', 'দিয়ে', 'থেকে', 'পর', 'মধ্যে', 'জন্য', 'মতো', 'আর', 'এক', 'একটা', 'কোন', 'কোনো'
]);

/**
 * Client-Side Extractive Text Summarizer (100% Free & Offline)
 */
export function generateLocalSummary(words = []) {
  if (!words || words.length === 0) {
    return {
      overview: "No transcription text available to summarize.",
      keyPoints: [],
      actionItems: [],
      highlightedPhrases: [],
      generatedBy: "Local Extractive AI (Zero-Cost)"
    };
  }

  // 1. Group words into sentences based on punctuation and pauses
  const sentences = [];
  let currentWords = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    currentWords.push(w);

    const hasTerminator = /[।\.\?!]$/.test(w.word.trim());
    const nextWord = words[i + 1];
    const isBigPause = nextWord && (nextWord.startTime - w.endTime > 0.85);

    if (hasTerminator || isBigPause || i === words.length - 1) {
      if (currentWords.length > 0) {
        sentences.push(currentWords);
        currentWords = [];
      }
    }
  }

  // 2. Frequency table of keywords
  const wordFreq = {};
  words.forEach(w => {
    const clean = w.word.toLowerCase().replace(/[^\w\u0980-\u09FF]/g, '');
    if (clean.length > 1 && !STOP_WORDS.has(clean)) {
      wordFreq[clean] = (wordFreq[clean] || 0) + 1;
    }
  });

  // 3. Score each sentence
  const scoredSentences = sentences.map((sWords, index) => {
    let score = 0;
    const text = sWords.map(w => w.word).join(' ');

    sWords.forEach(w => {
      const clean = w.word.toLowerCase().replace(/[^\w\u0980-\u09FF]/g, '');
      const baseFreq = wordFreq[clean] || 0;
      score += baseFreq;

      // Heavy bonus if the user actively highlighted this word!
      if (w.isHighlighted) {
        score += 8;
      }

      // Bonus for mathematical, algorithmic or complexity notation (e.g. O(log n), O(n), 100ms)
      if (/[O0]\([a-z0-9\s\+\-\*\/]+\)/i.test(w.word) || /\d+/.test(w.word)) {
        score += 5;
      }

      // Bonus for English technical terms in Banglish context
      if (/^[A-Za-z]{3,}$/.test(w.word) && !STOP_WORDS.has(w.word.toLowerCase())) {
        score += 2;
      }
    });

    // Normalize slightly by length to avoid choosing only super-long sentences
    const lengthFactor = Math.sqrt(sWords.length || 1);
    const finalScore = score / lengthFactor;

    return {
      text,
      score: finalScore,
      index,
      words: sWords
    };
  });

  // Sort by score to pick the best sentences
  const sorted = [...scoredSentences].sort((a, b) => b.score - a.score);
  
  // Pick top sentences for key points (up to 4)
  const topCount = Math.min(Math.max(2, Math.ceil(sentences.length * 0.4)), 5);
  const selected = sorted.slice(0, topCount).sort((a, b) => a.index - b.index);

  // Extract highlighted phrases
  const highlightedPhrases = [];
  let tempHighlight = [];
  words.forEach(w => {
    if (w.isHighlighted) {
      tempHighlight.push(w.word);
    } else if (tempHighlight.length > 0) {
      highlightedPhrases.push(tempHighlight.join(' '));
      tempHighlight = [];
    }
  });
  if (tempHighlight.length > 0) {
    highlightedPhrases.push(tempHighlight.join(' '));
  }

  // Overview paragraph: take highest ranked sentence or first + best
  const bestSentence = sorted[0]?.text || words.map(w => w.word).join(' ');
  const overview = `Lecture Focus: ${bestSentence.replace(/[।\.]/g, '')}. The session emphasizes key conceptual mechanisms and core principles outlined in the discussion.`;

  // Key points
  const keyPoints = selected.map(s => s.text.trim());

  // Action items / study review
  const actionItems = [
    "Review highlighted formulas and technical terms from this session.",
    "Verify understanding of core definitions and compare best vs. worst case behavior.",
    "Practice related problem sets and replay key audio sections using tap-to-seek."
  ];

  return {
    overview,
    keyPoints: keyPoints.length > 0 ? keyPoints : [bestSentence],
    actionItems,
    highlightedPhrases: [...new Set(highlightedPhrases)],
    generatedBy: "Local Extractive AI Engine (Zero-Cost & Offline)"
  };
}

/**
 * Summarize with Cloud AI (Groq or Gemini)
 */
export async function generateCloudSummary({ words, rawText, apiKey, provider = 'groq' }) {
  const fullTranscript = rawText || words.map(w => w.word).join(' ');
  const highlightedList = words
    ? words.filter(w => w.isHighlighted).map(w => w.word).join(', ')
    : '';

  const systemPrompt = `You are LecNote AI, an elite academic transcription and lecture note assistant.
The lecture may be in Bangla, English, or mixed Banglish (Bengali with English technical terms).
Your job is to analyze the lecture transcription and output a clean, highly structured JSON note summary.
Output ONLY valid JSON matching this exact schema:
{
  "overview": "2-3 sentences concise academic overview of what was discussed",
  "keyPoints": [
    "Core insight or theorem 1",
    "Core insight 2",
    "Core insight 3"
  ],
  "actionItems": [
    "Follow-up study task or exam prep point 1",
    "Follow-up study task 2"
  ],
  "highlightedPhrases": [
    "Important phrase 1",
    "Formula or key term 2"
  ]
}`;

  const userPrompt = `Classroom Lecture Transcript:
"""
${fullTranscript}
"""

User Highlighted Keywords in Note:
[${highlightedList || 'None highlighted yet'}]

Please analyze and generate the structured JSON summary now.`;

  if (provider === 'groq') {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    const parsed = JSON.parse(content);
    return {
      ...parsed,
      generatedBy: "Groq Cloud AI (Llama 3.3 70B)"
    };
  } else if (provider === 'gemini') {
    const cleanKey = apiKey.trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${cleanKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${systemPrompt}\n\n${userPrompt}` }
            ]
          }
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.2
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const rawTextResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(rawTextResponse);
    return {
      ...parsed,
      generatedBy: "Google Gemini Cloud AI (1.5 Flash)"
    };
  }

  throw new Error(`Unsupported cloud provider: ${provider}`);
}

/**
 * Universal Unified Summarizer
 * Automatically tries Cloud AI if configured; otherwise seamlessly uses Local Engine!
 */
export async function summarizeLecture({ words, rawText, userSettings }) {
  const { groqKey, geminiKey, preferredProvider } = userSettings || {};
  
  // Check if any cloud key is available
  const activeKey = preferredProvider === 'gemini' 
    ? (geminiKey || groqKey) 
    : (groqKey || geminiKey);

  const activeProvider = preferredProvider === 'gemini' && geminiKey
    ? 'gemini'
    : (groqKey ? 'groq' : (geminiKey ? 'gemini' : null));

  if (activeKey && activeProvider) {
    try {
      return await generateCloudSummary({
        words,
        rawText,
        apiKey: activeKey,
        provider: activeProvider
      });
    } catch (err) {
      console.warn("Cloud summary failed, falling back to local NLP engine:", err);
      // Fallback cleanly to local NLP!
      const fallback = generateLocalSummary(words);
      fallback.cloudError = err.message;
      return fallback;
    }
  }

  // 100% Free Default Local Fallback
  return generateLocalSummary(words);
}
