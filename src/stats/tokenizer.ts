import { createRequire } from 'module';
import { pluginState } from '../core/state';

const require = createRequire(import.meta.url);
const nodejieba: { cut: (text: string) => string[] } = require('nodejieba');

const mentionRegex = /@(\d{5,12})/g;

export function tokenize(text: string): string[] {
    if (!text) return [];
    const words = nodejieba.cut(text);
    const stopWords = new Set(pluginState.config.keyword.stopWords);
    const minLen = pluginState.config.keyword.minWordLength;
    return words.filter((w) => w && w.length >= minLen && !stopWords.has(w));
}

export function extractMentions(text: string): string[] {
    const out: string[] = [];
    for (const matched of text.matchAll(mentionRegex)) {
        if (matched[1]) out.push(matched[1]);
    }
    return out;
}
