// Pro lab rules a schema can't express (scripts/labs.mjs), and lab flags (scripts/lab-flags.mjs).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { flagHash, labFlagProblems, labFlagWarnings, publicFlags } from '../scripts/lab-flags.mjs';
import { labProblems, labSummary, osCounts } from '../scripts/labs.mjs';

const machine = (name, os = 'Linux', domainJoined = false) => ({ name, os, domainJoined });
const lab = (extra) => ({ level: 'Advanced', environment: 'standalone', flags: 3, entryPoint: '10.0.0.1', machines: [machine('web')], ...extra });

test('a complete standalone lab has no problems', () => {
	assert.deepEqual(labProblems(lab()), []);
});

test('required fields and at least one machine', () => {
	assert.deepEqual(labProblems({ machines: [] }), [
		'`level` is required',
		'`environment` is required',
		'`entryPoint` is required',
		'`flags` is required (the number of flags), unless the lab has a flags file in content/lab-flags/',
		'`machines` needs at least one machine',
	]);
	// With a flags file, the count comes from it.
	assert.deepEqual(labProblems(lab({ flags: undefined }), { hasFlagFile: true }), []);
});

test('a lab\'s flags file: known machines, no repeats, the count matches, short flags warned', () => {
	const checked = { slug: 'web', data: { flags: 3, machines: [machine('WEB01'), machine('DB01')] } };
	const flag = (machine, label, value) => ({ machine, label, flag: value });
	const good = [flag('WEB01', 'User', 'HL{0123456789abcdef}'), flag('web01', 'Root', 'HL{fedcba9876543210}'), flag(undefined, 'Domain admin', 'HL{00112233445566778899}')];
	assert.deepEqual(labFlagProblems('web', good, checked, ['web']), []);
	assert.deepEqual(labFlagProblems('nope', good, undefined, ['web']), ['there\'s no pro lab "nope" (docs/labs/nope.md): name the file after one of web']);
	assert.deepEqual(labFlagProblems('web', [flag('MAIL', 'User', 'HL{aaaaaaaaaaaaaaaa}'), flag('WEB01', 'User', 'HL{aaaaaaaaaaaaaaaa}'), flag('WEB01', 'user', 'HL{bbbbbbbbbbbbbbbb}')], checked, ['web']), [
		'flag 1 (User): machine "MAIL" isn\'t one of this lab\'s machines (WEB01, DB01)',
		'flags 1 and 2 have the same value',
		'flags 2 and 3 have the same machine and label',
	]);
	assert.match(labFlagProblems('web', good.slice(0, 2), checked, ['web'])[0], /says `flags: 3`, but this file has 2/);
	assert.deepEqual(labFlagWarnings('web', [flag('WEB01', 'User', 'short')]), [
		'content/lab-flags/web.yml: flag(s) 1 (User) are shorter than 12 characters, so easy to guess; use long random flags.',
	]);
	// The site gets names and hashes, never the value; the id is the start of the hash.
	const [published] = publicFlags('web', good);
	assert.deepEqual(Object.keys(published).sort(), ['hash', 'id', 'label', 'machine']);
	assert.equal(published.hash, flagHash('web', '  HL{0123456789abcdef} '));
	assert.equal(published.id, published.hash.slice(0, 16));
	assert.ok(!JSON.stringify(published).includes('0123456789abcdef'));
});

test('a domain lab needs a domain and a joined machine; a standalone one has neither', () => {
	assert.deepEqual(labProblems(lab({ environment: 'domain' })), [
		'`domain` is required for a domain environment (e.g. corp.example)',
		'a domain environment needs at least one machine with `domainJoined: true`',
	]);
	assert.deepEqual(labProblems(lab({ environment: 'domain', domain: 'corp.example', machines: [machine('dc', 'Windows', true)] })), []);
	assert.deepEqual(labProblems(lab({ domain: 'corp.example', machines: [machine('dc', 'Windows', true)] })), [
		'`domain` is only for domain environments (remove it, or set `environment: domain`)',
		"machines can't be domain joined in a standalone environment: dc",
	]);
});

test('machine names are unique, ignoring case', () => {
	assert.deepEqual(labProblems(lab({ machines: [machine('WEB'), machine('web')] })), ['machine names must be unique: web']);
});

test('operating systems are counted most common first, and the summary is pluralised', () => {
	const machines = [machine('a', 'Linux'), machine('b', 'Windows'), machine('c', 'Windows')];
	assert.deepEqual(osCounts(machines), [
		['Windows', 2],
		['Linux', 1],
	]);
	assert.equal(labSummary({ machines, flags: 1 }), '3 machines · 1 flag');
});
