// Glossary checks and term matching (scripts/glossary.mjs), used to mark terms in lessons.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { glossaryMatcher, glossaryProblems } from '../scripts/glossary.mjs';

test('a term or alias used by two entries, and unknown or self "see also" links, are problems', () => {
	const problems = glossaryProblems([
		{ id: 'hash', term: 'hash', aliases: ['hashing'], seeAlso: ['salt', 'hash'] },
		{ id: 'digest', term: 'Hashing' },
	]);
	assert.deepEqual(problems, ['"Hashing" is used by both hash and digest', 'hash: "see also" lists unknown term salt', 'hash: "see also" lists itself']);
});

const terms = [
	{ id: 'hash', term: 'hash', aliases: ['hash function'] },
	{ id: 'as-rep', term: 'AS-REP roasting' },
	{ id: 'acl', term: 'ACL' },
	{ id: 'port', term: 'port' },
];
const first = (text, seen = new Set()) => {
	const found = glossaryMatcher(terms).first(text, seen);
	return found && { id: found.id, shown: text.slice(found.index, found.index + found.length) };
};

test('whole words only, with an optional plural', () => {
	assert.deepEqual(first('Passwords are stored as hashes.'), { id: 'hash', shown: 'hashes' });
	assert.deepEqual(first('Open ports'), { id: 'port', shown: 'ports' });
	assert.equal(first('A portal and a hashtag'), null);
	assert.equal(first('a pre-port or port-based'), null);
});

test('the longest name wins, and ordinary words match in any case', () => {
	assert.deepEqual(first('A Hash function is one-way.'), { id: 'hash', shown: 'Hash function' });
	assert.deepEqual(first('Try AS-REP roasting next.'), { id: 'as-rep', shown: 'AS-REP roasting' });
});

test('acronyms only match as written', () => {
	assert.deepEqual(first('Check the ACLs.'), { id: 'acl', shown: 'ACLs' });
	assert.equal(first('an acl'), null);
});

test('terms already marked on the page are skipped', () => {
	assert.deepEqual(first('hash then port', new Set(['hash'])), { id: 'port', shown: 'port' });
});
