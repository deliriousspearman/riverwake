// The PowerPoint template (templates/powerpoint/): the committed files are what generate.mjs
// writes, and each is a complete package (every part has a content type, every relationship's
// target exists, every slide has a layout and notes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { posix } from 'node:path';
import { build } from '../templates/powerpoint/generate.mjs';

const dir = new URL('../templates/powerpoint/', import.meta.url);

/** The files in a zip (deflated or stored), as path → text. */
function unzip(buf) {
	const files = new Map();
	let p = 0;
	while (buf.readUInt32LE(p) === 0x04034b50) {
		const method = buf.readUInt16LE(p + 8);
		const size = buf.readUInt32LE(p + 18);
		const nameLen = buf.readUInt16LE(p + 26);
		const extraLen = buf.readUInt16LE(p + 28);
		const name = buf.subarray(p + 30, p + 30 + nameLen).toString();
		const data = buf.subarray(p + 30 + nameLen + extraLen, p + 30 + nameLen + extraLen + size);
		files.set(name, (method === 8 ? inflateRawSync(data) : data).toString('utf8'));
		p += 30 + nameLen + extraLen + size;
	}
	return files;
}

test('the committed PowerPoint templates are up to date (node templates/powerpoint/generate.mjs)', () => {
	for (const [name, bytes] of Object.entries(build())) {
		assert.ok(readFileSync(new URL(name, dir)).equals(bytes), `${name} differs from what generate.mjs writes: run it again and commit the result`);
	}
});

test('the PowerPoint templates are complete packages', () => {
	for (const [name, bytes] of Object.entries(build())) {
		const files = unzip(bytes);
		const types = files.get('[Content_Types].xml');
		const main = name.endsWith('.potx') ? 'template.main+xml' : 'presentation.main+xml';
		assert.match(types, new RegExp(`PartName="/ppt/presentation.xml" ContentType="[^"]+\\.${main.replace(/[.+]/g, '\\$&')}"`), `${name}: main part type`);
		for (const path of files.keys()) {
			if (path.endsWith('.rels') || path === '[Content_Types].xml') continue;
			assert.ok(types.includes(`PartName="/${path}"`), `${name}: ${path} has no content type`);
		}
		for (const [path, xml] of files) {
			if (!path.endsWith('.rels')) continue;
			const base = posix.dirname(posix.dirname(path));
			for (const [, target] of xml.matchAll(/Target="([^"]+)"/g)) {
				assert.ok(files.has(posix.normalize(posix.join(base, target))), `${name}: ${path} points to ${target}, which isn't there`);
			}
		}
		const slides = [...files.keys()].filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p));
		assert.ok(slides.length >= 10);
		for (const slide of slides) {
			const rels = files.get(slide.replace('slides/', 'slides/_rels/') + '.rels');
			assert.match(rels, /relationships\/slideLayout"/, `${slide}: no layout`);
			assert.match(rels, /relationships\/notesSlide"/, `${slide}: no notes`);
		}
		// The theme carries the site's fonts and accent.
		assert.match(files.get('ppt/theme/theme1.xml'), /<a:majorFont><a:latin typeface="Chakra Petch"\/>.*<a:accent1><a:srgbClr val="9FEF00"\/>|<a:accent1><a:srgbClr val="9FEF00"\/>.*<a:majorFont><a:latin typeface="Chakra Petch"\/>/s);
	}
});
