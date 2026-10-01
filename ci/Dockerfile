# The pipeline's image for a GitLab without internet access (README → Running offline): Node, plus
# every npm package the project needs already in npm's cache, so the pipeline's `npm ci` runs
# offline. Build it where there is internet, after any change to package-lock.json:
#
#   docker build -f ci/Dockerfile -t codex-ci:$(sha256sum package-lock.json | cut -c1-12) .
#
# then copy it across with `docker save` / `docker load`, push it to the offline GitLab's container
# registry, and point the CI/CD variables at it: PIPELINE_IMAGE (the image), NPM_CACHE=/opt/npm-cache and
# NPM_CONFIG_OFFLINE=true. Keep the base image the same as the one pinned in .gitlab-ci.yml.
FROM node:22-bookworm@sha256:363e1587494626837fa7f9a23bdb453d13b0ff3c67c705c2805cfc69c2d2fad7

# Only the cache is kept: the pipeline installs from it into each job's own checkout.
COPY package.json package-lock.json /tmp/codex/
RUN cd /tmp/codex \
	&& npm ci --cache /opt/npm-cache --no-audit --no-fund --ignore-scripts \
	&& cd / && rm -rf /tmp/codex \
	&& chmod -R a+rX /opt/npm-cache
