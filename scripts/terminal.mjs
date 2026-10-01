// ```terminal code blocks: a Hack The Box-style terminal window, rendered at build time.
// ```terminal-red, -blue, -green, -purple and -orange are the same window in
// another colour, to tell sessions apart; add a title to name them:
// ```terminal-red title="Attacker (Kali)".
//
// Recognised line types (everything else is treated as command output):
//   ┌──(user㉿host)-[~/dir]      Kali two-line prompt, first line
//   └─$ command                  Kali two-line prompt, second line (└─# for root)
//   user@host:~/dir$ command     classic prompt (user@host and :path are optional, `# ` for root)
//   PS C:\Users\admin> command  PowerShell prompt (`C:\> command` for cmd.exe)
// A line starting with a bare `# ` is output (e.g. a comment in a config file being printed): a root
// prompt needs user@host or a path, like `root@web01:~# ` or `:~# `.
//
// Colours are fixed (terminals are dark in both colour modes). Each block carries its palette as
// CSS variables; the window styling is in src/css/site/code.css under `.lms-terminal`. The copy button
// is wired up by src/client/copy.ts.
import { el, text } from './hast-text.mjs';

/** Line colours per block language. `terminal` is the default; the others tint the prompt. */
export const PALETTES = {
	terminal: {
		frame: '#5cb2ff', // ┌── └─ ( ) - [ ]
		user: '#9fef00', // user@host
		path: '#ffffff', // current directory
		promptUser: '#9fef00', // $
		promptRoot: '#ff3e3e', // #
		command: '#ffffff',
		output: '#a4b1cd',
	},
	'terminal-red': {
		frame: '#ff8484',
		user: '#ff5c5c',
		path: '#ffffff',
		promptUser: '#ff5c5c',
		promptRoot: '#ffcc5c',
		command: '#ffffff',
		output: '#d4b8bc',
	},
	'terminal-blue': {
		frame: '#86c2ff',
		user: '#5cb2ff',
		path: '#ffffff',
		promptUser: '#5cb2ff',
		promptRoot: '#ff8484',
		command: '#ffffff',
		output: '#b3c3de',
	},
	'terminal-green': {
		frame: '#5cecc6',
		user: '#2ee7b6',
		path: '#ffffff',
		promptUser: '#2ee7b6',
		promptRoot: '#ff8484',
		command: '#ffffff',
		output: '#b0d4c6',
	},
	'terminal-purple': {
		frame: '#cf8dfb',
		user: '#c16cfa',
		path: '#ffffff',
		promptUser: '#c16cfa',
		promptRoot: '#ff8484',
		command: '#ffffff',
		output: '#c9b8dc',
	},
	'terminal-orange': {
		frame: '#ffcc5c',
		user: '#ffaf00',
		path: '#ffffff',
		promptUser: '#ffaf00',
		promptRoot: '#ff5c5c',
		command: '#ffffff',
		output: '#d9c9ae',
	},
};

export const KALI_HEADER = /^(┌──\()([^)]*)(\)-\[)([^\]]*)(\])\s*$/;
export const KALI_COMMAND = /^(└─)([$#])(.*)$/;
export const CLASSIC = /^((?:[\w.-]+@[\w.-]+)?)((?::[^\s$#]*)?)([$#])( .*|)$/;
export const WINDOWS = /^((?:PS )?)([A-Za-z]:\\[^>]*)(>)(.*)$/;

/** Shell languages: their code blocks are drawn in a terminal frame. */
export const SHELL_LANGUAGES = new Set(['ansi', 'bash', 'bat', 'batch', 'cmd', 'console', 'powershell', 'ps', 'ps1', 'sh', 'shell', 'shellscript', 'shellsession', 'zsh']);

/** One span per matched regex group, left to right: `roles` are the class suffixes. */
function spans(match, roles) {
	return match.slice(1).flatMap((part, i) => (part ? [roles[i] ? el('span', { className: [`t-${roles[i]}`] }, [text(part)]) : text(part)] : []));
}

/** The coloured parts of one line (hast children). */
export function terminalLine(line) {
	let match;
	if ((match = line.match(KALI_HEADER))) return spans(match, ['frame', 'user', 'frame', 'path', 'frame']);
	if ((match = line.match(KALI_COMMAND))) return spans(match, ['frame', match[2] === '#' ? 'root' : 'prompt', 'command']);
	if ((match = line.match(CLASSIC)) && (match[3] === '$' || match[1] || match[2])) {
		return spans(match, ['user', 'frame', match[3] === '#' ? 'root' : 'prompt', 'command']);
	}
	if ((match = line.match(WINDOWS))) return spans(match, ['user', 'path', 'prompt', 'command']);
	return line.length ? [el('span', { className: ['t-output'] }, [text(line)])] : [];
}

/** CSS variables for a palette, as an inline style. */
export const paletteStyle = (language) =>
	Object.entries(PALETTES[language])
		.map(([role, colour]) => `--t-${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${colour}`)
		.join(';');

/** The window title bar with the traffic-light dots, and a copy button unless `copy` is false. */
export function windowBar(title, copy = true) {
	return el('div', { className: ['lms-window-bar'] }, [
		el('span', { className: ['lms-window-title'] }, title ? [text(title)] : []),
		...(copy
			? [
					el('button', { type: 'button', className: ['lms-copy'], dataCopy: '', title: 'Copy to clipboard', ariaLabel: 'Copy to clipboard' }, [
						el('span', { className: ['lms-copy-feedback'], ariaHidden: 'true' }, [text('Copied!')]),
					]),
				]
			: []),
	]);
}

/** A ```terminal block: `language` is `terminal` or one of the colour variants. */
export function renderTerminal({ language, title, code }) {
	const lines = code.replace(/\n$/, '').split('\n');
	const variant = language === 'terminal' ? [] : [`lms-${language}`];
	return el('figure', { className: ['lms-terminal', ...variant, 'not-content'], style: paletteStyle(language) }, [
		windowBar(title),
		el('pre', { className: ['lms-terminal-code'], tabIndex: 0 }, [
			el('code', {}, lines.flatMap((line, i) => [el('span', { className: ['t-line'] }, terminalLine(line)), ...(i < lines.length - 1 ? [text('\n')] : [])])),
		]),
	]);
}

/** `title="…"` (or `title='…'`) from a code block's meta string. */
export const titleFromMeta = (meta = '') => meta.match(/\btitle=(["'])(.*?)\1/)?.[2];
