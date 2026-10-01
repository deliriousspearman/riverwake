---
title: How the site works
description: Where the content lives, how a change becomes live, and what the automatic checks catch.
sidebar:
  order: 1
---

## Everything is a file

The site is built from the files in the GitLab project `group/codex` at `https://gitlab.example.com/group/codex`:

| What | Where |
|---|---|
| Courses and lessons | `docs/courses/<course>/` |
| Pro labs | `docs/labs/<lab>.md` |
| This guide | `docs/guide/` |
| Pathways | `content/pathways/<id>.yml` |
| Glossary terms | `content/glossary/<id>.yml` |
| Theme and banner | `content/settings/` |
| Images, downloads, captions, recordings, videos | `static/images/`, `static/files/`, `static/captions/`, `static/casts/`, `static/videos/` |

Pages are Markdown: plain text with a few symbols for formatting (`**bold**`, `## Heading`, `- list item`). Each page starts with a block of settings between two `---` lines, called the **frontmatter**: its title, description, position and so on.

## From change to live site

1. A change is saved to the `main` branch, either by the admin editor or by a `git push`.
2. GitLab runs the **pipeline**: it runs the site's tests, then builds the whole site.
3. If both succeed, the new site is published with GitLab Pages, usually two or three minutes after the save.
4. If either fails, **nothing is published**, and the live site stays as it was. See [Publishing and fixing mistakes](publishing.md).

There's no separate "publish" button and no staging site: whatever is on `main` is what learners see. For a big change you'd like checked first, use a merge request (see [Editing files with git](editing-files.md)).

## What the checks catch

The build stops, naming the file and the problem, when content breaks a rule. For example:

- a misspelled setting, or a required one that's missing (a lesson with no title, a pro lab with no machines);
- a quiz with no correct answer, or a misspelled field in a quiz, exercise, timeline or recording;
- a link to a page that doesn't exist, including links left behind after deleting or moving a page;
- a pathway that lists a course that doesn't exist;
- a missing picture, download, caption file or recording, or a download of a type that isn't allowed;
- an image or video from another website (the site only uses its own files);
- a video committed without Git LFS (see [Images, downloads and video](../02-content/images-downloads-video.md)).

The checks can't catch wrong facts, typos or a lesson in the wrong order, so look over your change on the live site afterwards.

## Visiting the site

The site is only reachable on the local network. Its security certificate isn't from a public authority, so the first visit in each browser shows a warning: choose **Advanced**, then **Proceed** (the wording varies by browser).
