// Frontmatter and settings schemas (scripts/schema.mjs), the rules for downloads
// (scripts/attachments.mjs) and video captions (scripts/captions.mjs), and the uploads under static/
// (scripts/static-files.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ATTACHMENT_TYPES, attachmentProblems, formatBytes } from '../scripts/attachments.mjs';
import { captionProblems } from '../scripts/captions.mjs';
import { bannerSchema, check, pageSchema, picture } from '../scripts/schema.mjs';
import { IMAGE_MAX_KB, IMAGE_WARN_KB, staticFileProblems, staticFileWarnings, svgProblems } from '../scripts/static-files.mjs';
import { tempDir, writeFiles } from './helpers.mjs';

test('captions: a WebVTT file under /captions/, present and not too large', (t) => {
	const staticDir = writeFiles(tempDir(t), {
		'captions/web/ok.vtt': 'WEBVTT\n\n00:00.000 --> 00:02.000\nHello.\n',
		'captions/web/bom.vtt': '﻿WEBVTT - with a header\n',
		'captions/web/renamed.vtt': '1\n00:00:00,000 --> 00:00:02,000\nHello.\n',
		'captions/web/huge.vtt': 600 * 1024,
	});
	assert.deepEqual(captionProblems('/captions/web/ok.vtt', staticDir), []);
	assert.deepEqual(captionProblems('/captions/web/bom.vtt', staticDir), []);
	assert.match(captionProblems('/captions/web/renamed.vtt', staticDir)[0], /not a WebVTT file/);
	assert.match(captionProblems('/captions/web/huge.vtt', staticDir)[0], /larger than 500 KB/);
	assert.match(captionProblems('/captions/web/gone.vtt', staticDir)[0], /file not found: static\/captions\/web\/gone\.vtt/);
	assert.match(captionProblems('/captions/web/ok.srt', staticDir)[0], /must be a path like/);
	assert.match(captionProblems('/captions/../ok.vtt', staticDir)[0], /must be a path like/);
});

test('captions need a video on the same page', () => {
	// The site guide's example captions exist, so the only problem is the missing video.
	const result = pageSchema.safeParse({ title: 'Lesson', captions: '/captions/guide/intro.vtt' });
	assert.deepEqual(
		result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
		['captions: captions need a `video` on the same page'],
	);
	assert.equal(pageSchema.safeParse({ title: 'Lesson', video: '/videos/guide/intro.mp4', captions: '/captions/guide/intro.vtt' }).success, true);
});

test('fields cleared in the CMS (empty string or null) count as not set', () => {
	const data = check(pageSchema, { title: 'Lesson', description: '', lastUpdated: '', sections: null }, 'Frontmatter in x.md');
	assert.equal(data.description, undefined);
	assert.equal(data.lastUpdated, undefined);
});

test('a bad field fails with the file and the field named', () => {
	assert.throws(
		() => check(pageSchema, { title: 'Lesson', aliases: ['/old-lesson'], video: '/videos/x.mov' }, 'Frontmatter in docs/courses/web/a.md'),
		(error) => {
			assert.match(error.message, /^Frontmatter in docs\/courses\/web\/a\.md:/);
			assert.match(error.message, /aliases.0: must be an old path like \/courses\/<course>\/<lesson>/);
			assert.match(error.message, /video: must look like \/videos\/<course>\/<file>\.mp4/);
			return true;
		},
	);
});

test('pictures must exist under static/ and be small', (t) => {
	const staticDir = writeFiles(tempDir(t), { 'images/ok.png': 1000, 'images/huge.png': 300 * 1024 });
	const schema = picture(staticDir);
	assert.equal(schema.safeParse('/images/ok.png').success, true);
	assert.match(schema.safeParse('/images/missing.png').error.issues[0].message, /image not found/);
	assert.match(schema.safeParse('/images/huge.png').error.issues[0].message, /larger than 200 KB/);
	assert.match(schema.safeParse('https://example.com/a.png').error.issues[0].message, /must be a path like/);
});

test('downloads: under /files/, an allowed type, present, and at most 10 MB', (t) => {
	const staticDir = writeFiles(tempDir(t), { 'files/web/notes.pdf': 2048, 'files/web/big.zip': 11 * 1024 * 1024, 'files/web/page.html': 10 });
	assert.deepEqual(attachmentProblems('/files/web/notes.pdf', staticDir), []);
	assert.match(attachmentProblems('/files/web/page.html', staticDir)[0], /file type "\.html" isn't allowed/);
	assert.match(attachmentProblems('/files/web/gone.pdf', staticDir)[0], /file not found: static\/files\/web\/gone\.pdf/);
	assert.match(attachmentProblems('/files/web/big.zip', staticDir)[0], /larger than 10 MB/);
	assert.match(attachmentProblems('/images/x.pdf', staticDir)[0], /must be a path under \/files\//);
	assert.match(attachmentProblems('/files/../.env', staticDir)[0], /must be a path under \/files\//);
});

test('file sizes read naturally', () => {
	assert.equal(formatBytes(840), '840 B');
	assert.equal(formatBytes(12 * 1024), '12 KB');
	assert.equal(formatBytes(3.4 * 1024 * 1024), '3.4 MB');
	assert.equal(formatBytes(25 * 1024 * 1024), '25 MB');
});

test('the banner has defaults and lower-cases its colours', () => {
	assert.deepEqual(bannerSchema.parse({ enabled: true, message: 'Hi', backgroundColor: '#FFAF00' }), {
		enabled: true,
		message: 'Hi',
		backgroundColor: '#ffaf00',
		textColor: '#0e1a02',
		fontSize: 15,
		height: 40,
		bold: true,
		italic: false,
	});
	assert.equal(bannerSchema.safeParse({ backgroundColor: 'orange' }).success, false);
});

test('static/: each folder takes only its own file types; generated folders are skipped', (t) => {
	const staticDir = writeFiles(tempDir(t), {
		'favicon.svg': '<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>',
		'images/courses/web.png': 10,
		'files/web/notes.pdf': 10,
		'captions/web/intro.vtt': 'WEBVTT\n',
		'casts/web/demo.cast': '{}',
		'videos/web/intro.mp4': 10,
		'admin/index.html': '<script src="/admin/sveltia-cms.js"></script>',
		'vendor/asciinema-player.css': '',
		'images/page.html': '<script>alert(1)</script>',
		'files/web/payload.js': 'alert(1)',
		'captions/web/intro.srt': '1',
		'uploads/x.png': 10,
	});
	assert.deepEqual(staticFileProblems(staticDir).sort(), [
		"static/captions/web/intro.srt: .srt files aren't allowed in static/captions/ (allowed: vtt)",
		`static/files/web/payload.js: .js files aren't allowed in static/files/ (allowed: ${Object.keys(ATTACHMENT_TYPES).join(', ')})`,
		"static/images/page.html: .html files aren't allowed in static/images/ (allowed: png, jpg, jpeg, webp, avif, gif, svg)",
		"static/uploads/x.png: static/uploads/ isn't a folder the site uses (images, files, captions, casts, videos)",
	].sort());
});

test('SVGs must be plain pictures: no scripts, handlers, embedded HTML or outside links', (t) => {
	assert.deepEqual(svgProblems('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use href="#a"/></svg>'), []);
	assert.deepEqual(svgProblems('<svg><script>alert(1)</script></svg>'), ['a <script>']);
	assert.deepEqual(svgProblems('<svg onload="alert(1)"></svg>'), ['an event handler attribute (on…=)']);
	assert.deepEqual(svgProblems('<svg><foreignObject><div/></foreignObject></svg>'), ['embedded HTML (<foreignObject>, <iframe>, <embed> or <object>)']);
	assert.deepEqual(svgProblems('<svg><a href="javascript:alert(1)"/></svg>'), ['a javascript: link']);
	assert.deepEqual(svgProblems('<svg><image href="https://evil.example/x.png"/></svg>'), ['a link to another site (href="https://…")']);
	const staticDir = writeFiles(tempDir(t), { 'images/bad.svg': '<svg onload="alert(1)"></svg>' });
	assert.match(staticFileProblems(staticDir)[0], /^static\/images\/bad\.svg: this SVG contains an event handler/);
});

test('large images: a warning above the warning size, a build failure above the limit', (t) => {
	const staticDir = writeFiles(tempDir(t), {
		'images/web/small.png': 100 * 1024,
		'images/web/large.png': (IMAGE_WARN_KB + 100) * 1024,
		'images/web/huge.jpg': (IMAGE_MAX_KB + 200) * 1024,
		'files/web/capture.pcap': (IMAGE_MAX_KB + 200) * 1024,
	});
	assert.deepEqual(
		staticFileProblems(staticDir).map((p) => p.split(':')[0]),
		['static/images/web/huge.jpg'],
	);
	assert.match(staticFileProblems(staticDir)[0], new RegExp(`over the ${IMAGE_MAX_KB} KB limit`));
	assert.deepEqual(staticFileWarnings(staticDir).map((w) => w.split(' ')[0]), ['static/images/web/large.png']);
});
