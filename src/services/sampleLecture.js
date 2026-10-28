import { generateRealisticLectureWav } from './audioUtils';

/**
 * Pre-configured realistic mixed Bangla-English (Banglish) lecture.
 * Used for instant zero-config testing and out-of-the-box demonstration.
 */
export function createSampleLecture() {
  const lectureDuration = 14.2; // seconds
  const audioBlob = generateRealisticLectureWav(lectureDuration);

  // Classroom lecture sentence:
  // "আজকের ক্লাসে আমরা binary search tree আর time complexity নিয়ে discuss করব।
  //  লক্ষ্য করো, একটা balanced tree তে search operation takes O(log n) time,
  //  কিন্তু worst case এ unbalanced হলে complexity O(n) হয়ে যায়।
  //  এইজন্য AVL tree এবং Red-Black tree use করা হয় rotation এর মাধ্যমে balance maintain করার জন্য।"

  const wordDefinitions = [
    { word: "আজকের", start: 0.2, end: 0.6 },
    { word: "ক্লাসে", start: 0.65, end: 1.0 },
    { word: "আমরা", start: 1.05, end: 1.35 },
    { word: "binary", start: 1.4, end: 1.85 },
    { word: "search", start: 1.9, end: 2.3 },
    { word: "tree", start: 2.35, end: 2.7 },
    { word: "আর", start: 2.75, end: 2.95 },
    { word: "time", start: 3.0, end: 3.3 },
    { word: "complexity", start: 3.35, end: 3.9 },
    { word: "নিয়ে", start: 3.95, end: 4.25 },
    { word: "discuss", start: 4.3, end: 4.75 },
    { word: "করব।", start: 4.8, end: 5.2 },

    // Brief pause at 5.2 - 5.5
    { word: "লক্ষ্য", start: 5.5, end: 5.85 },
    { word: "করো,", start: 5.9, end: 6.2 },
    { word: "একটা", start: 6.25, end: 6.55 },
    { word: "balanced", start: 6.6, end: 7.1 },
    { word: "tree", start: 7.15, end: 7.45 },
    { word: "তে", start: 7.5, end: 7.7 },
    { word: "search", start: 7.75, end: 8.15 },
    { word: "operation", start: 8.2, end: 8.75 },
    { word: "takes", start: 8.8, end: 9.15 },
    { word: "O(log n)", start: 9.2, end: 9.85, highlighted: true, color: 'yellow' },
    { word: "time,", start: 9.9, end: 10.3 },

    // Sentence 3
    { word: "কিন্তু", start: 10.4, end: 10.7 },
    { word: "unbalanced", start: 10.75, end: 11.35, highlighted: true, color: 'green' },
    { word: "হলে", start: 11.4, end: 11.65 },
    { word: "worst-case", start: 11.7, end: 12.25 },
    { word: "complexity", start: 12.3, end: 12.8 },
    { word: "O(n)", start: 12.85, end: 13.4, highlighted: true, color: 'yellow' },
    { word: "হয়ে যায়।", start: 13.45, end: 14.1 },
  ];

  const words = wordDefinitions.map((item, idx) => ({
    id: `w-${idx}`,
    word: item.word,
    startTime: item.start,
    endTime: item.end,
    isHighlighted: !!item.highlighted,
    highlightColor: item.color || 'yellow',
  }));

  const initialSummary = {
    overview: "Data Structures ক্লাসে Binary Search Tree (BST) এর টাইম কমপ্লেক্সিটি এবং ব্যালেন্সিং টেকনিক নিয়ে আলোচনা।",
    keyPoints: [
      "Balanced Binary Search Tree তে search অপারেশন সম্পন্ন হতে O(log n) সময় লাগে।",
      "যদি ট্রি unbalanced বা skewed হয়, তবে worst-case complexity O(n) এ নেমে যায়।",
      "ব্যালেন্স বজায় রাখতে AVL Tree এবং Red-Black Tree রোটেটিং মেকানিজম ব্যবহার করে।"
    ],
    highlightedPhrases: [
      "O(log n) time",
      "unbalanced tree worst-case O(n)",
      "Balanced Search Operations"
    ],
    generatedBy: "Local Extractive AI Engine (Zero-Cost)"
  };

  return {
    id: 'sample-lecture-bst-banglish',
    title: 'CSE 207: Binary Search Tree & Time Complexity (Banglish)',
    course: 'CSE 207: Data Structures & Algorithms',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    duration: lectureDuration,
    language: 'auto',
    audioBlob: audioBlob,
    audioMimeType: 'audio/wav',
    words: words,
    summary: initialSummary,
    tags: ['Banglish', 'Algorithms', 'BST', 'Complexity'],
    bookmarked: true,
  };
}
