// The video opener (templates/video-opener/opener.mjs): its title card, text wrapping, options, how it
// reads ffmpeg's description of a recording, and moving captions to match. Rendering needs ffmpeg with
// libass (and libx264), which the pipeline doesn't have, so that test only runs where one is installed.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { assText, makeOpener, openerAss, parseOptions, probeInfo, shiftVtt, textWidth, wrap } from '../templates/video-opener/opener.mjs';
import { tempDir, writeFiles } from './helpers.mjs';

const events = (ass) => ass.split('\n').filter((line) => line.startsWith('Dialogue:'));

test('opener card: the label in capitals, the title and subtitle, all ending with the opener', () => {
	const ass = openerAss({ title: 'Lorem culpa sunt commodo', label: 'Example Course', subtitle: 'Lesson 1', seconds: 5 });
	const lines = events(ass);
	assert.equal(lines.length, 4); // bar, label, title, subtitle
	assert.ok(lines.every((line) => line.startsWith('Dialogue: 0,0:00:00.00,0:00:05.00,')));
	assert.match(ass, /\}EXAMPLE COURSE$/m);
	assert.match(ass, /\}Lorem culpa sunt commodo$/m);
	assert.match(ass, /\}Lesson 1$/m);
	assert.match(ass, /^PlayResX: 1280\nPlayResY: 720$/m);
	// Without a label or subtitle, just the bar and the title.
	assert.equal(events(openerAss({ title: 'Hi' })).length, 2);
});

test('opener card: scaled to other sizes', () => {
	const ass = openerAss({ title: 'Hi', width: 1920, height: 1080 });
	assert.match(ass, /^PlayResX: 1920\nPlayResY: 1080$/m);
	assert.match(ass, /^Style: Title,Chakra Petch,126,/m);
	assert.match(ass, /\\pos\(180,\d+\).*\}Hi$/m);
});

test('opener card: text is shown as typed, never read as ASS codes', () => {
	assert.equal(assText('{\\b1}bold'), '\\{\\⁠b1\\}bold');
	assert.equal(assText('a\\Nb'), 'a\\⁠Nb');
	assert.equal(assText('  two\n lines '), 'two lines');
});

test('text wraps onto two even lines, and too much text is an error', () => {
	assert.deepEqual(wrap('Lorem culpa sunt commodo', 84, 2, 'title'), ['Lorem culpa sunt commodo']);
	const lines = wrap('Reading packet captures in Wireshark, one stream at a time', 84, 2, 'title');
	assert.equal(lines.length, 2);
	assert.ok(Math.abs(textWidth(lines[0], 84) - textWidth(lines[1], 84)) < 200, lines.join(' | '));
	assert.throws(() => wrap('Word '.repeat(60), 84, 2, 'title'), /title is too long/);
	assert.throws(() => wrap('W'.repeat(40), 84, 2, 'title'), /title is too long/);
	assert.throws(() => openerAss({ title: 'Hi', label: 'Network forensics and incident handling for defenders · Lesson 13' }), /label is too long/);
});

test('options: --title is needed; paths are from where the command was typed; outputs are named', () => {
	assert.throws(() => parseOptions([]), /--title is required/);
	assert.throws(() => parseOptions(['--title', 'The', 'CIA']), /Unexpected "CIA"/);
	assert.throws(() => parseOptions(['--title', 'x', '--seconds', '1']), /--seconds/);
	assert.throws(() => parseOptions(['--title', 'x', '--size', 'big']), /--size/);
	assert.throws(() => parseOptions(['--title', 'x', '--captions', 'a.vtt']), /--captions goes with --join/);
	assert.throws(() => parseOptions(['--title', 'x', '--out', 'a.mov']), /\.mp4/);
	assert.throws(() => parseOptions(['--title', 'x', '--join', 'a.mp4', '--out', 'a.mp4'], '/rec'), /different file/);
	assert.deepEqual(parseOptions(['--title', 'x'], '/rec'), {
		title: 'x', label: undefined, subtitle: undefined, seconds: 4, size: undefined,
		join: undefined, captions: undefined, out: '/rec/opener.mp4',
	});
	const o = parseOptions(['--title', 'x', '--join', 'videos/lesson.mp4', '--captions', 'lesson.vtt', '--size', '1281x721'], '/rec');
	assert.equal(o.join, '/rec/videos/lesson.mp4');
	assert.equal(o.captions, '/rec/lesson.vtt');
	assert.equal(o.out, '/rec/videos/lesson-with-opener.mp4');
	assert.deepEqual(o.size, { width: 1280, height: 720 });
});

test("reads a recording's size, frame rate, sound and length from ffmpeg's description", () => {
	const stderr = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'rec.mp4':
  Duration: 00:01:06.02, start: 0.000000, bitrate: 145 kb/s
  Stream #0:0[0x1](und): Video: h264 (Constrained Baseline) (avc1 / 0x31637661), yuv420p(tv, smpte170m, progressive), 1280x720, 142 kb/s, SAR 1:1 DAR 16:9, 29.73 fps, 240 tbr, 30k tbn (default)
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 128 kb/s (default)`;
	assert.deepEqual(probeInfo(stderr), { width: 1280, height: 720, fps: 29.73, audio: true, duration: 66.02 });
	assert.equal(probeInfo(stderr.split('\n').slice(0, 3).join('\n')).audio, false);
	assert.equal(probeInfo('Input #0, wav, from x.wav:\n  Stream #0:0: Audio: pcm_s16le'), undefined);
});

test('captions move later by the opener, keeping cue settings', () => {
	const vtt = 'WEBVTT\n\n1\n00:00.500 --> 00:02.000\nHello\n\n59:59.999 --> 01:00:01.000 line:90%\nWorld\n';
	assert.equal(
		shiftVtt(vtt, 4),
		'WEBVTT\n\n1\n00:00:04.500 --> 00:00:06.000\nHello\n\n01:00:03.999 --> 01:00:05.000 line:90%\nWorld\n',
	);
	assert.throws(() => shiftVtt('1\n00:00:01,000 --> 00:00:02,000\nx\n', 4), /isn't WebVTT/);
});

const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const hasFfmpeg = (() => {
	const run = spawnSync(ffmpeg, ['-hide_banner', '-filters'], { encoding: 'utf8' });
	return run.status === 0 && /^\s*\S+\s+ass\s/m.test(run.stdout);
})();

test('renders an opener and joins it to a recording', { skip: !hasFfmpeg && 'needs ffmpeg with libass (set FFMPEG)' }, (t) => {
	const dir = tempDir(t);
	// A 1-second silent test recording of an odd size, and its captions.
	spawnSync(ffmpeg, ['-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=s=640x360:r=30:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(dir, 'rec.mp4')]);
	writeFiles(dir, { 'rec.vtt': 'WEBVTT\n\n00:00.000 --> 00:01.000\nHi\n' });
	const result = makeOpener(parseOptions(['--title', 'Test', '--seconds', '2', '--join', 'rec.mp4', '--captions', 'rec.vtt'], dir));
	assert.deepEqual(result, { wrote: [join(dir, 'rec-with-opener.mp4'), join(dir, 'rec-with-opener.vtt')], width: 640, height: 360, fps: 30 });
	const info = probeInfo(spawnSync(ffmpeg, ['-hide_banner', '-i', result.wrote[0]], { encoding: 'utf8' }).stderr);
	assert.equal(info.audio, true);
	assert.ok(Math.abs(info.duration - 3) < 0.1, `duration ${info.duration}`);
	assert.match(readFileSync(result.wrote[1], 'utf8'), /^00:00:02\.000 --> 00:00:03\.000$/m);
	assert.ok(existsSync(result.wrote[0]));
});
