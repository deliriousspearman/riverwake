---
title: Editing files with git
description: Working on the site's files directly, in GitLab's web editor or on your own computer.
sidebar:
  order: 3
---

For anything the admin editor can't do, edit the files themselves. Small changes can be made in the browser; bigger ones are easier on your own computer, where you can preview the site before publishing.

## In the browser: GitLab's web editor

The quickest way to a page's file: open the page on the site and choose **Edit this page** at the bottom, in the footer. It opens that file in GitLab's editor (sign in to GitLab first).

Or find it yourself:

1. Open the project at `https://gitlab.example.com/group/codex`.
2. Browse to the file (for example `docs/courses/lorem-course-4/`), then choose **Edit → Edit single file**, or **Edit → Open in Web IDE** to change several files at once.
3. To create a file in a new folder, such as a new section, choose **+ → New file** and type the whole path, for example `docs/courses/lorem-course-4/03-defences/01-input-validation.md`. The folders are created with it.
4. Commit to `main`. That publishes the change, exactly like a save in the admin editor.

## On your computer

You need [Git](https://git-scm.com), [Git LFS](https://git-lfs.com) and [Node.js](https://nodejs.org) 20 or newer, and an editor such as VS Code.

**Once, to set up:**

```sh
git lfs install
git clone https://gitlab.example.com/group/codex.git
cd codex
npm install
```

**Each time:**

```sh
git pull                  # get everyone else's changes, including admin editor saves
npm run dev               # preview at http://localhost:3000, updating as you save files
```

Edit the files, and check the result in the preview. Drafts (`draft: true`) are shown in the preview but not on the live site. Before publishing, run the same checks the pipeline does:

```sh
npm test
npm run build
```

Then commit and push:

```sh
git add -A
git commit -m "Add the input validation lesson"
git push
```

:::tip
The admin editor saves to `main` too, so pull before you start and again before you push. If the push is rejected because `main` has moved on, run `git pull` and push again.
:::

## Checking a big change before it goes live

Pushing to `main` publishes. To have a change checked without publishing it:

1. Push it to a new branch instead: `git switch -c new-course`, commit, then `git push -u origin new-course`.
2. Open a **merge request** into `main` in GitLab. The pipeline runs the tests and a full build on it, but doesn't publish.
3. When it passes and you're happy, merge it. That publishes.
