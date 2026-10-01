---
title: Publishing and fixing mistakes
description: Following a change to the live site, and what to do when it doesn't get there or shouldn't have.
sidebar:
  order: 4
---

## Following a change

Every change to `main` starts a pipeline. To see it, open the project in GitLab and go to **Build → Pipelines**. The newest is at the top:

- **Running** (blue): tests and build in progress, usually about a minute.
- **Passed** (green): published. The live site updates within a minute or two; reload the page to see it.
- **Failed** (red): nothing was published, and the live site still shows the previous version.

## When a pipeline fails

1. Open the failed pipeline, then the failed job (`pages`).
2. Scroll to the bottom of the log. The error names the file and the problem, for example:

   ```text
   Content problems:

   Frontmatter in docs/courses/lorem-course-4/02-lorem-lesson-2.md:
   - video: must look like /videos/<course>/<file>.mp4
   ```

3. Fix that file, in the admin editor or with git, and save or push again. The next pipeline publishes everything, including the change that failed.

Until it's fixed, later changes don't publish either, because each pipeline builds the whole site.

## Undoing a change

Every change is kept in GitLab's history, so any change can be undone:

1. In GitLab, go to **Code → Commits** and open the change you want to undo. Admin editor saves are named after what they changed, for example `content: update Lesson “02-lorem-lesson-2”` or `content: update Site settings “banner”`.
2. Choose **Options → Revert**, leave **Revert in branch** as `main`, and confirm.

That adds a new change that reverses the old one, and publishes it. Nothing is lost: the reverted change stays in the history.

## When the site looks out of date

- The pipeline may still be running, or may have failed: check **Build → Pipelines**.
- Pages are cached for up to ten minutes. Reload, or open the page in a private window.
- For a few seconds after a new version is published, a page can briefly show "Page not found". Reload.
