// Lesson videos (static/videos/) must be stored with Git LFS (.gitattributes, README → Videos).
// Without git-lfs installed, `git add` silently stores a video as an ordinary file, which bloats every
// clone for good; this stops the pipeline before such a commit is published.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const LFS_POINTER = 'version https://git-lfs.github.com/spec/v1';

test('videos are routed to Git LFS', () => {
	assert.match(git('check-attr', 'filter', '--', 'static/videos/course/lesson.mp4'), /: filter: lfs$/m);
});

test('committed videos are Git LFS pointers, not the video files themselves', () => {
	const notInLfs = [];
	// The index holds what git stores, whether or not the real files have been downloaded.
	for (const line of git('ls-files', '--stage', '--', 'static/videos').split('\n').filter(Boolean)) {
		const [info, path] = line.split('\t');
		const blob = info.split(' ')[1];
		// A pointer is about 130 bytes: don't read a large blob just to find out it's a video.
		const pointer = Number(git('cat-file', '-s', blob)) < 1024 && git('cat-file', 'blob', blob).startsWith(LFS_POINTER);
		if (!pointer) notInLfs.push(path);
	}
	assert.deepEqual(notInLfs, [], `Not stored with Git LFS (see README → Videos): ${notInLfs.join(', ')}`);
});
