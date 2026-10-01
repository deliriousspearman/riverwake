---
title: Site guide
description: How to edit, add, remove and publish everything on this site, with examples of every lesson feature.
sections:
  01-editing: Editing and publishing
  02-content: Adding and removing content
  03-features: Lesson features
---

This guide is for the people who run the site: course authors and editors. Learners don't need any of it.

Everything on the site (courses, lessons, pro labs, pathways, glossary terms, images, videos and settings) is a file in the site's GitLab project. Changing the site means changing those files. Every change is checked and published automatically a few minutes later.

## Where to start

- **Fix a typo or edit a lesson:** use the [admin editor](01-editing/admin-editor.md) at `/admin/`. No tools to install.
- **Add a course or lesson:** see [Courses and sections](02-content/courses.md) and [Lessons](02-content/lessons.md).
- **Add a quiz, exercise, terminal, timeline, diagram or recording to a lesson:** see [Lesson features](03-features/text-and-callouts.md), where each one is shown working.
- **Draw a network diagram for a lesson:** see [Network diagrams](02-content/diagrams.md), with a draw.io template in the site's style.
- **Something didn't appear, or the site didn't update:** see [Publishing and fixing mistakes](01-editing/publishing.md).

## The two ways to edit

| | Admin editor (`/admin/`) | Files and git |
|---|---|---|
| **Best for** | Text changes, new lessons, downloads, glossary terms, the banner | New sections, videos, moving or deleting courses, big changes |
| **Needs** | A GitLab account with Maintainer access to the project | Git, Git LFS and Node.js, or GitLab's web editor for small changes |
| **Publishes** | Each save, a few minutes later | Each push to `main`, a few minutes later |

Both change the same files, so you can mix them freely.

## What's in this guide

- **Editing and publishing:** [how the site works](01-editing/how-the-site-works.md), the [admin editor](01-editing/admin-editor.md), [editing files with git](01-editing/editing-files.md), and [publishing and fixing mistakes](01-editing/publishing.md).
- **Adding and removing content:** [courses](02-content/courses.md), [lessons](02-content/lessons.md), [moving, renaming and deleting](02-content/moving-and-deleting.md), [pro labs](02-content/pro-labs.md), [pathways](02-content/pathways.md), the [glossary](02-content/glossary.md), [images, downloads and video](02-content/images-downloads-video.md), [network diagrams](02-content/diagrams.md), and [site settings](02-content/site-settings.md).
- **Lesson features:** [text, callouts and images](03-features/text-and-callouts.md), [code and terminals](03-features/code-and-terminals.md), [timelines](03-features/timelines.md), [quizzes and exercises](03-features/quizzes-and-exercises.md), [terminal recordings](03-features/recordings.md), and [diagrams](03-features/diagrams.md).
