// Lesson captions: one WebVTT subtitle file per lesson video (`captions` frontmatter), stored in git
// under static/captions/ (uploaded through the CMS or committed directly). They're small text files,
// so the build checks them: the path, the size and that they really are WebVTT.
// scripts/schema.mjs uses these rules, and LessonVideo in src/components/DocParts.tsx plays the file
// as the video's caption track (the player's CC button).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { STATIC_DIR } from './content.mjs';

// An hour of captions is around 100 KB. Keep in sync with `max_file_size` on the CMS field.
export const CAPTIONS_MAX_KB = 500;

/**
 * Problems with a captions path (empty if it's fine): under /captions/, a .vtt file that exists,
 * isn't too large and really is WebVTT. `staticDir` is for tests.
 */
export function captionProblems(path, staticDir = STATIC_DIR) {
	if (typeof path !== 'string' || !/^\/captions\/[\w./-]+\.vtt$/.test(path) || path.includes('..')) {
		return ['must be a path like /captions/<course>/<lesson>.vtt (letters, numbers, - _ . / only)'];
	}
	const file = `${staticDir}${path}`;
	if (!existsSync(file) || !statSync(file).isFile()) return [`file not found: static${path}`];
	if (statSync(file).size > CAPTIONS_MAX_KB * 1024) return [`file is larger than ${CAPTIONS_MAX_KB} KB: is it really a captions file?`];
	// Browsers ignore a caption file that doesn't start like this (an .srt renamed to .vtt, say).
	if (!/^﻿?WEBVTT(?:[ \t]|\r?\n|$)/.test(readFileSync(file, 'utf8'))) {
		return ['not a WebVTT file: it must start with "WEBVTT" (export the captions as .vtt, not .srt)'];
	}
	return [];
}
