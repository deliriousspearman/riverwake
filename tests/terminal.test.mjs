// ```terminal blocks (scripts/terminal.mjs): which parts of each line are coloured as what.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderTerminal, terminalLine, titleFromMeta } from '../scripts/terminal.mjs';

/** The colour roles of a line's parts, e.g. ['user', 'frame', 'prompt', 'command']. */
const roles = (line) => terminalLine(line).map((n) => n.properties?.className?.[0]?.replace('t-', '') ?? 'text');

test('prompts: classic, root, path-only and Kali two-line', () => {
	assert.deepEqual(roles('analyst@soc:~$ ls -la'), ['user', 'frame', 'prompt', 'command']);
	assert.deepEqual(roles('root@web01:~# last -n 2'), ['user', 'frame', 'root', 'command']);
	assert.deepEqual(roles(':~# id'), ['frame', 'root', 'command']);
	assert.deepEqual(roles('$ nmap -sV 192.0.2.10'), ['prompt', 'command']);
	assert.deepEqual(roles('┌──(student㉿kali)-[~]'), ['frame', 'user', 'frame', 'path', 'frame']);
	assert.deepEqual(roles('└─# whoami'), ['frame', 'root', 'command']);
});

test('Windows prompts: PowerShell and cmd.exe', () => {
	assert.deepEqual(roles('PS C:\\Users\\admin> netsh advfirewall show currentprofile'), ['user', 'path', 'prompt', 'command']);
	assert.deepEqual(roles('C:\\>route print'), ['path', 'prompt', 'command']);
	assert.deepEqual(roles('C:\\Windows\\System32\\LogFiles\\Firewall\\pfirewall.log'), ['output']);
	assert.deepEqual(roles('Ok.'), ['output']);
});

test('a bare "# " line is output, not a root prompt (e.g. a comment in a printed config file)', () => {
	assert.deepEqual(roles('# listen on all interfaces'), ['output']);
	assert.deepEqual(roles('#'), ['output']);
	assert.deepEqual(roles('$5 total'), ['output']);
	assert.deepEqual(roles(''), []);
});

test('the title comes from the code block meta, in either quotes', () => {
	assert.equal(titleFromMeta('title="Attacker (Kali)"'), 'Attacker (Kali)');
	assert.equal(titleFromMeta("title='SOC'"), 'SOC');
	assert.equal(titleFromMeta(''), undefined);
});

test('a coloured terminal carries its palette and variant class', () => {
	const figure = renderTerminal({ language: 'terminal-red', title: 'Attacker', code: '$ id\nuid=0\n' });
	assert.deepEqual(figure.properties.className, ['lms-terminal', 'lms-terminal-red', 'not-content']);
	assert.match(figure.properties.style, /--t-prompt-user:#ff5c5c/);
});
