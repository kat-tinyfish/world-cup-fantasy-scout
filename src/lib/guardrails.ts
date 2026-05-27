import { FUNNY_MARKERS, USEFULNESS_MARKERS } from "./personality";
import type { Source } from "./types";

export type GuardrailResult = {
  ok: boolean;
  errors: string[];
  toneScore: number;
  usefulnessScore: number;
};

const BLOCKED_PATTERNS: Array<[RegExp, string]> = [
  [/@[A-Za-z0-9_]{1,15}/, "Do not mention users in v1 broadcast posts."],
  [/\b(idiot|moron|stupid|trash human|fraud human)\b/i, "Avoid personal attacks."],
  [/\b(kill yourself|die|kys)\b/i, "Violent harassment is blocked."],
  [/\b(injur|hurt|limp|acl).*\b(lol|lmao|haha|funny|banter|tiny hat|joke)\b/i, "Do not joke about injuries."],
  [/\b(slur|racial|homophobic)\b/i, "Protected-class abuse is blocked."]
];

export function validateDraftText(text: string, sources: Source[], landingUrl: string): GuardrailResult {
  const errors: string[] = [];
  const toneScore = scoreMarkers(text, FUNNY_MARKERS);
  const usefulnessScore = scoreMarkers(text, USEFULNESS_MARKERS);

  if (xWeightedLength(text) > 280) {
    errors.push("Post exceeds the X weighted 280 character limit.");
  }

  if (!sources.length) {
    errors.push("Every draft must have at least one source.");
  }

  if (!text.includes(landingUrl)) {
    errors.push("Post must include the campaign or receipts link.");
  }

  if (toneScore < 1) {
    errors.push("Draft needs a distinctive joke, bit, or funny hook.");
  }

  if (usefulnessScore < 1) {
    errors.push("Draft needs at least one useful fantasy insight marker.");
  }

  for (const [pattern, message] of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      errors.push(message);
    }
  }

  if (hasLongCopiedExcerpt(text, sources)) {
    errors.push("Draft appears to copy a long source excerpt.");
  }

  return {
    ok: errors.length === 0,
    errors,
    toneScore,
    usefulnessScore
  };
}

export function xWeightedLength(text: string): number {
  return text
    .split(/(https?:\/\/\S+)/g)
    .reduce((length, part) => length + (part.startsWith("http") ? 23 : [...part].length), 0);
}

function scoreMarkers(text: string, markers: string[]): number {
  const lower = text.toLowerCase().replace(/https?:\/\/\S+/g, "");
  return markers.reduce((score, marker) => score + (lower.includes(marker) ? 1 : 0), 0);
}

function hasLongCopiedExcerpt(text: string, sources: Source[]): boolean {
  const normalizedText = normalizeWords(text).join(" ");
  for (const source of sources) {
    const words = normalizeWords(source.fetchedText || source.snippet);
    if (words.length < 10) continue;
    for (let i = 0; i <= words.length - 10; i += 1) {
      const phrase = words.slice(i, i + 10).join(" ");
      if (phrase.length > 30 && normalizedText.includes(phrase)) {
        return true;
      }
    }
  }
  return false;
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}
