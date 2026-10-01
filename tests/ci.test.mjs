// The pipeline (.gitlab-ci.yml) and the image for running it offline (ci/Dockerfile, README →
// Running offline) must start from the same pinned Node image, or an offline pipeline would build
// with a different Node from the online one.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the offline pipeline image starts from the image the pipeline pins', () => {
	const pinned = read('.gitlab-ci.yml').match(/^\s+PIPELINE_IMAGE:\s*(\S+)$/m)?.[1];
	const base = read('ci/Dockerfile').match(/^FROM\s+(\S+)$/m)?.[1];
	assert.match(pinned ?? '', /^node:[\w.-]+@sha256:[0-9a-f]{64}$/, 'pinned by digest');
	assert.equal(base, pinned);
	assert.match(read('.gitlab-ci.yml'), /^\s+image: \$PIPELINE_IMAGE$/m);
	assert.match(read('.gitlab-ci.yml'), /npm ci --cache "\$NPM_CACHE"/);
});
