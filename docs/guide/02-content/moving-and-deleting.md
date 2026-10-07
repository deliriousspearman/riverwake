---
title: Moving, renaming and deleting
description: Changing a page's address without breaking links or learners' progress, and removing content safely.
sidebar:
  order: 3
---

Learners' progress and bookmarks are tied to each page's address. Moving or deleting a page changes that address, so do it with care.

## Moving or renaming a lesson

Renaming a lesson's file, or moving it to another section or course, changes its address. List the old address under **Old addresses** (`aliases`) on the lesson:

```yaml
aliases:
  - /courses/lorem-course-4/01-injection
```

The old address then redirects to the new one, and learners who completed the lesson keep it completed. If you forget, the site won't publish: the pipeline names the old address and asks for the alias (it checks every course and lesson page GitLab's history shows was renamed or deleted).

Changing only a lesson's **title** or **Lesson number** doesn't change its address: no alias needed.

## Renaming a course folder

Rename the folder with git, then add the old address to the course overview's **Old addresses**:

```yaml
aliases:
  - /courses/lorem-pathway-3
```

That redirects the old course address and the old address of every lesson in it, and keeps progress. Update any [pathway](pathways.md) that lists the course: pathways use the folder name.

## Hiding instead of deleting

Two ways to take something off the site without losing it:

- `draft: true` leaves a lesson, or a whole course, out of the live site. It's still in GitLab, and `npm run dev` still shows it.
- `sidebar.hidden: true` on a lesson keeps its page reachable by its address, but out of the course's lesson list, counts and progress.

## Deleting

The build checks every link, so deleting something that's still linked to fails the pipeline, and the site stays as it was. Remove or change the links first. The error names each page that links to the deleted one.

**Before the site goes live**, none of this is checked: rename and delete courses and lessons freely. On launch day, an administrator sets **Site settings → Removed pages → Check from** to that day. From then on, the rules below apply to every page renamed or deleted on or after it (renames from before are never checked).

**After deleting a lesson or a course** (once **Check from** is set), add its old address to **Site settings → Removed pages** in the admin editor (`content/settings/removed-pages.yml`), with a short reason. Until you do, the site won't publish, so that a page doesn't vanish by accident: learners lose their progress for it, and links to it from bookmarks or other sites break. A course's address covers all of its lessons.

```yaml
pages:
  - path: /courses/lorem-course-4/03-old-lesson
    reason: Replaced by the new injection lessons.
```

| To delete | How | Also update |
|---|---|---|
| A lesson | Admin editor: open it, **Delete**. Or delete the file with git | Links to it from other lessons, and **Removed pages** |
| A course | With git: delete its folder (the admin editor can't delete courses) | [Pathways](pathways.md) that list it (the build fails otherwise), links to it, and **Removed pages** |
| A pro lab | Admin editor, or delete `docs/labs/<lab>.md` | Links to it |
| A pathway | Admin editor, or delete `content/pathways/<id>.yml` | Nothing |
| A glossary term | Admin editor, or delete `content/glossary/<id>.yml` | Other terms that list it under **See also** (the build fails otherwise) |
| An image, download or recording | With git: delete it from `static/` | Pages that use it: the build fails if a listed download or a recording is missing, so check images by eye |

Learners who completed a deleted lesson keep it in their saved progress, but it's no longer counted anywhere.
