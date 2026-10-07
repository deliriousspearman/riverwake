// Makes a title-card opener for a lesson video, in the site's style, and (with --join) puts it in
// front of a recording, giving one MP4 ready for static/videos/<course>/. Not published; editors run
// it on their own computer (guide → Images, downloads and video → Adding an opener).
//
//   npm run video-opener -- --title "Lorem culpa sunt commodo" [--label "Lorem Ipsum Course 1 · Lesson 1"]
//     [--subtitle "One line under the title"] [--seconds 4] [--join recording.mp4]
//     [--captions recording.vtt] [--size 1920x1080] [--out file.mp4]
//
// The card is drawn by ffmpeg: a plain background with an ASS subtitle script on it (green bar, spaced
// label, large title, grey line under it, each fading in, all fading out at the end). The colours and
// font are the site's Hardline Classic theme (src/css/site/theme.css); the font is Chakra Petch from
// templates/drawio/fonts/. With --join the opener takes the recording's size, the recording is fitted
// to it (letterboxed if its shape differs) and a recording without sound gets silence, so the two
// join cleanly. --captions writes a copy of the recording's WebVTT captions moved later by the
// opener's length, to go with the joined video.
//
// Needs ffmpeg built with libass (most are: apt install ffmpeg, brew install ffmpeg), or set FFMPEG
// to one. It isn't an npm dependency: the npm packages that bundle ffmpeg download it while
// installing, which the pipeline can't do offline. tests/video-opener.test.mjs tests the parts.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const FONTS = fileURLToPath(new URL('../drawio/fonts/', import.meta.url));
const BACKGROUND = '0x111927';
// The card is laid out for 1280×720 and scaled to other sizes.
const BASE = { width: 1280, height: 720 };
// The card's text area is 1040 wide (120 each side); lines wrap a little short of it.
const TEXT_WIDTH = 1000;

export const USAGE = `Usage: npm run video-opener -- --title "Title" [options]

  --title "…"       the large text (required; up to two lines, wrapped for you)
  --label "…"       small spaced text above it, e.g. the course name (shown in capitals)
  --subtitle "…"    a line under the title
  --seconds N       how long the opener lasts (default 4, at least 2)
  --join FILE       a recording to put the opener in front of
  --captions FILE   the recording's WebVTT captions: writes a copy moved later to match
  --size WxH        the video size (default: the recording's, or 1280x720)
  --out FILE        where to write the video (default: <recording>-with-opener.mp4, or opener.mp4)`;

/** The command line → settings. Throws a message for the person running it on a mistake. */
export function parseOptions(argv, cwd = process.cwd()) {
	const { values, positionals } = parseArgs({
		args: argv,
		allowPositionals: true,
		options: {
			title: { type: 'string' },
			label: { type: 'string' },
			subtitle: { type: 'string' },
			seconds: { type: 'string' },
			join: { type: 'string' },
			captions: { type: 'string' },
			size: { type: 'string' },
			out: { type: 'string' },
			help: { type: 'boolean', short: 'h' },
		},
	});
	if (values.help) return { help: true };
	if (positionals.length) throw new Error(`Unexpected "${positionals[0]}": put text in quotes after an option, e.g. --title "${positionals[0]}"`);
	if (!values.title?.trim()) throw new Error('--title is required');
	const seconds = values.seconds === undefined ? 4 : Number(values.seconds);
	if (!(seconds >= 2 && seconds <= 30)) throw new Error('--seconds must be a number from 2 to 30');
	let size;
	if (values.size !== undefined) {
		const m = /^(\d+)x(\d+)$/.exec(values.size);
		if (!m || Number(m[1]) < 320 || Number(m[2]) < 180) throw new Error('--size must be like 1280x720 (at least 320x180)');
		size = even({ width: Number(m[1]), height: Number(m[2]) });
	}
	if (values.captions && !values.join) throw new Error('--captions goes with --join (it moves the recording\'s captions to match)');
	const path = (p) => (p === undefined ? undefined : resolve(cwd, p));
	const join_ = path(values.join);
	const out = path(values.out) ?? (join_ ? join(dirname(join_), `${basename(join_, extname(join_))}-with-opener.mp4`) : resolve(cwd, 'opener.mp4'));
	if (extname(out).toLowerCase() !== '.mp4') throw new Error('--out must end in .mp4');
	if (join_ && out === join_) throw new Error('--out must be a different file from the recording');
	return {
		title: values.title,
		label: values.label,
		subtitle: values.subtitle,
		seconds,
		size,
		join: join_,
		captions: path(values.captions),
		out,
	};
}

// x264 needs even sizes.
const even = ({ width, height }) => ({ width: width - (width % 2), height: height - (height % 2) });

/** Text for an ASS line: one line, with its override braces and escapes made literal. */
export function assText(text) {
	return text
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/\\/g, '\\\u2060') // a word joiner after a backslash, so "\N" etc. stay as typed
		.replace(/[{}]/g, (c) => `\\${c}`);
}

/**
 * About how wide text is in Chakra Petch at a font size, from measured renders (in the 1280×720
 * layout): wide letters, other capitals, narrow letters and punctuation, everything else.
 */
export function textWidth(text, fontSize, spacing = 0) {
	let em = 0;
	for (const c of text) {
		if (/[WMwm@%]/.test(c)) em += 0.46;
		else if (/[ijlftrI.,:;'!|() ]/.test(c)) em += 0.17;
		else if (/[A-Z0-9]/.test(c)) em += 0.36;
		else em += 0.3;
	}
	return em * fontSize + [...text].length * spacing;
}

/** Splits text into at most `max` lines that fit across the card, at spaces. Throws if it can't. */
export function wrap(text, fontSize, max, what, spacing = 0) {
	const fits = (line) => textWidth(line, fontSize, spacing) <= TEXT_WIDTH;
	const lines = [];
	for (const word of text.replace(/\s+/g, ' ').trim().split(' ')) {
		const last = lines.at(-1);
		if (last !== undefined && fits(`${last} ${word}`)) lines[lines.length - 1] = `${last} ${word}`;
		else lines.push(word);
	}
	if (lines.length > max || !lines.every(fits)) {
		throw new Error(`The ${what} is too long for the card: it must fit on ${max === 1 ? 'one line' : `${max} lines`}. Shorten it (very long words can't be split).`);
	}
	if (lines.length !== 2) return lines;
	// Two lines: split where they're most even, rather than leaving a word on its own.
	const words = lines.join(' ').split(' ');
	let best = lines;
	for (let i = 1; i < words.length; i++) {
		const pair = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
		const widest = (ls) => Math.max(...ls.map((l) => textWidth(l, fontSize, spacing)));
		if (pair.every(fits) && widest(pair) < widest(best)) best = pair;
	}
	return best;
}

const time = (s) => {
	const cs = Math.round(s * 100);
	const h = Math.floor(cs / 360000);
	const m = Math.floor(cs / 6000) % 60;
	const sec = Math.floor(cs / 100) % 60;
	return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};

/** The ASS script that draws the card, for a video of the given size. */
export function openerAss({ title, label, subtitle, seconds = 4, width = BASE.width, height = BASE.height }) {
	// Scale to fit the smaller way, and centre the 1280×720 layout in the frame.
	const k = Math.min(width / BASE.width, height / BASE.height);
	const ox = (width - BASE.width * k) / 2;
	const oy = (height - BASE.height * k) / 2;
	const x = Math.round(ox + 120 * k);
	const y = (v) => Math.round(oy + v * k);
	const px = (v) => Math.round(v * k);
	const labelLine = label?.trim() ? wrap(label.toUpperCase(), 30, 1, 'label', 6)[0] : undefined;
	const titleLines = wrap(title, 84, 2, 'title');
	const subtitleLines = subtitle?.trim() ? wrap(subtitle, 38, 2, 'subtitle') : [];
	// Vertically centred: the block is taller with a two-line title or subtitle.
	const titleTop = 228;
	const TITLE_STEP = 64;
	const LINE_STEP = 34;
	const subtitleTop = titleTop + 104 + (titleLines.length - 1) * TITLE_STEP;
	const bottom = subtitleLines.length ? subtitleTop + LINE_STEP * subtitleLines.length : subtitleTop - 20;
	const shift = Math.round((720 - (bottom - 150)) / 2 - 150);
	const fadeOut = 500;
	const end = time(seconds);
	const line = (style, top, fadeIn, text) =>
		`Dialogue: 0,0:00:00.00,${end},${style},,0,0,0,,{\\pos(${x},${y(top + shift)})\\fad(${fadeIn},${fadeOut})}${text}`;
	return `[Script Info]
; The opener card, written by templates/video-opener/opener.mjs.
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Label,Chakra Petch,${px(30)},&H0000EF9F,&H0000EF9F,&H00000000,&H00000000,-1,0,0,0,100,100,${px(6)},0,1,0,0,7,0,0,0,1
Style: Title,Chakra Petch,${px(84)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Body,Chakra Petch,${px(38)},&H00CDB1A4,&H00CDB1A4,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${[
	`Dialogue: 0,0:00:00.00,${end},Label,,0,0,0,,{\\pos(${x},${y(150 + shift)})\\fad(400,${fadeOut})\\p1}m 0 0 l ${px(72)} 0 ${px(72)} ${Math.max(2, px(6))} 0 ${Math.max(2, px(6))}{\\p0}`,
	labelLine && line('Label', 178, 400, assText(labelLine)),
	// One event per line, for tighter lines than the font's own spacing.
	...titleLines.map((text, i) => line('Title', titleTop + i * TITLE_STEP, 500, assText(text))),
	...subtitleLines.map((text, i) => line('Body', subtitleTop + i * LINE_STEP, 700, assText(text))),
]
	.filter(Boolean)
	.join('\n')}
`;
}

const STAMP = /^(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})$/;
const stamp = (ms) => {
	const h = Math.floor(ms / 3600000);
	const m = Math.floor(ms / 60000) % 60;
	const s = Math.floor(ms / 1000) % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
};

/** WebVTT captions with every cue moved `seconds` later. */
export function shiftVtt(text, seconds) {
	const by = Math.round(seconds * 1000);
	const move = (t) => {
		const m = STAMP.exec(t);
		if (!m) throw new Error(`Not a WebVTT time: "${t}"`);
		const [, h = '0', min, s, ms] = m;
		return stamp(((Number(h) * 60 + Number(min)) * 60 + Number(s)) * 1000 + Number(ms) + by);
	};
	if (!/^﻿?WEBVTT/.test(text)) throw new Error('The captions file isn\'t WebVTT (it should start with WEBVTT)');
	return text.replace(/^(\S+)[ \t]+-->[ \t]+(\S+)(.*)$/gm, (_, from, to, rest) => `${move(from)} --> ${move(to)}${rest}`);
}

/** What ffmpeg says about a video: its size, frame rate, whether it has sound, and its length. */
export function probeInfo(stderr) {
	const video = /Stream #\S+.*?: Video: .*/.exec(stderr)?.[0];
	if (!video) return undefined;
	const size = /, (\d{2,5})x(\d{2,5})[,\s]/.exec(video);
	const fps = /, ([\d.]+) fps/.exec(video);
	const duration = /Duration: (\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(stderr);
	return {
		width: size ? Number(size[1]) : undefined,
		height: size ? Number(size[2]) : undefined,
		fps: fps ? Number(fps[1]) : undefined,
		audio: /Stream #\S+.*?: Audio: /.test(stderr),
		duration: duration ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]) : undefined,
	};
}

function ffmpeg(args, options = {}) {
	const bin = process.env.FFMPEG || 'ffmpeg';
	const run = spawnSync(bin, ['-hide_banner', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
	if (run.error?.code === 'ENOENT') {
		throw new Error(`ffmpeg isn't installed${process.env.FFMPEG ? ` at ${bin}` : ''}. Install it (Debian/Ubuntu: sudo apt install ffmpeg; macOS: brew install ffmpeg; Windows: winget install ffmpeg), or set FFMPEG to its path.`);
	}
	if (run.error) throw run.error;
	return run;
}

function checkFfmpeg() {
	const filters = ffmpeg(['-filters']).stdout;
	const encoders = ffmpeg(['-encoders']).stdout;
	if (!/^\s*\S+\s+ass\s/m.test(filters)) throw new Error('This ffmpeg was built without libass, which draws the card: install a full ffmpeg (e.g. from your package manager), or set FFMPEG to one.');
	if (!/\blibx264\b/.test(encoders)) throw new Error('This ffmpeg was built without libx264 (H.264 video): install a full ffmpeg, or set FFMPEG to one.');
}

/** Renders the opener (and joins the recording to it). Returns what it wrote. */
export function makeOpener(opts) {
	for (const file of [opts.join, opts.captions]) if (file && !existsSync(file)) throw new Error(`${file}: not found`);
	checkFfmpeg();
	let recording;
	if (opts.join) {
		recording = probeInfo(ffmpeg(['-i', opts.join]).stderr);
		if (!recording?.width) throw new Error(`${opts.join}: ffmpeg can't find a video in it`);
	}
	const size = opts.size ?? (recording ? even(recording) : BASE);
	// A whole-number frame rate from the recording (screen recorders give odd ones like 29.73).
	const fps = recording?.fps ? Math.min(60, Math.max(24, Math.round(recording.fps))) : 25;

	const work = mkdtempSync(join(tmpdir(), 'video-opener-'));
	try {
		// ffmpeg's filter options need escaping for some paths, so the card and fonts sit in a work folder
		// and ffmpeg runs there with plain relative names.
		writeFileSync(join(work, 'card.ass'), openerAss({ ...opts, ...size }));
		for (const file of readdirSync(FONTS).filter((f) => /^ChakraPetch-.*\.ttf$/.test(f))) {
			copyFileSync(join(FONTS, file), join(work, file));
		}
		const { width, height } = size;
		const args = [
			'-y',
			'-loglevel', 'error',
			'-f', 'lavfi', '-i', `color=c=${BACKGROUND}:s=${width}x${height}:r=${fps}:d=${opts.seconds}`,
			'-f', 'lavfi', '-t', String(opts.seconds), '-i', 'anullsrc=r=48000:cl=stereo',
		];
		const audio = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo';
		let graph = `[0:v]ass=card.ass:fontsdir=.,format=yuv420p,setsar=1[ov];[1:a]${audio}[oa]`;
		if (recording) {
			args.push('-i', opts.join);
			let recordingAudio = '2:a';
			if (!recording.audio) {
				args.push('-f', 'lavfi', '-t', String(recording.duration ?? 36000), '-i', 'anullsrc=r=48000:cl=stereo');
				recordingAudio = '3:a';
			}
			graph +=
				`;[2:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
				`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${BACKGROUND},fps=${fps},format=yuv420p,setsar=1[rv]` +
				`;[${recordingAudio}]${audio}[ra];[ov][oa][rv][ra]concat=n=2:v=1:a=1[v][a]`;
		} else {
			graph = graph.replace('[ov]', '[v]').replace('[oa]', '[a]');
		}
		args.push(
			'-filter_complex', graph,
			'-map', '[v]', '-map', '[a]',
			...(recording && !recording.audio ? ['-shortest'] : []),
			'-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
			'-r', String(fps),
			'-c:a', 'aac', '-b:a', '128k',
			'-movflags', '+faststart',
			opts.out,
		);
		const run = ffmpeg(args, { cwd: work });
		if (run.status !== 0) throw new Error(`ffmpeg failed:\n${run.stderr.trim()}`);
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
	const wrote = [opts.out];
	if (opts.captions) {
		const vtt = join(dirname(opts.out), `${basename(opts.out, '.mp4')}.vtt`);
		writeFileSync(vtt, shiftVtt(readFileSync(opts.captions, 'utf8'), opts.seconds));
		wrote.push(vtt);
	}
	return { wrote, width: size.width, height: size.height, fps };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		// npm runs scripts from the project folder; INIT_CWD is where it was typed, for relative paths.
		const opts = parseOptions(process.argv.slice(2), process.env.INIT_CWD || process.cwd());
		if (opts.help) {
			console.log(USAGE);
		} else {
			const { wrote, width, height, fps } = makeOpener(opts);
			console.log(`[video-opener] ${width}x${height}, ${fps} fps: wrote ${wrote.join(' and ')}`);
		}
	} catch (err) {
		console.error(`[video-opener] ${err.message}\n\n${USAGE}`);
		process.exit(1);
	}
}
