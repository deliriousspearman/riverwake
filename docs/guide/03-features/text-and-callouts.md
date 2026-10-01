---
title: Text, callouts and images
description: Headings, emphasis, lists, tables, links and callout boxes.
sidebar:
  order: 1
---

Lessons are written in Markdown. Each example below shows the result, then the Markdown that produces it.

## Headings

`##` starts a task (numbered "Task 1", "Task 2" in lessons); `###` a smaller heading inside it. Don't use `#`: the page title is added automatically.

```md
## Scan the network

### Reading the results
```

## Emphasis, lists and links

Use **bold** for things to click or type, *italic* for emphasis, and `code` for commands, file names and values such as `192.0.2.10`.

1. Numbered lists for steps in order.
2. Bullet lists (with `-`) for everything else:

- Confidentiality
- Integrity
- Availability

Link to other pages by their address, such as the [glossary](/glossary/) or [a lesson](/courses/lorem-course-1/01-lorem-lesson-1/), or to another site with its full address: [the OWASP Top 10](https://owasp.org/www-project-top-ten/).

> A quotation, or a line from a document or log you want to set apart.

```md
Use **bold** for things to click or type, *italic* for emphasis, and `code` for commands.

1. Numbered lists for steps in order.
2. Bullet lists (with `-`) for everything else:

- Confidentiality
- Integrity
- Availability

Link to other pages by their address, such as the [glossary](/glossary/), or to another site
with its full address: [the OWASP Top 10](https://owasp.org/www-project-top-ten/).

> A quotation, or a line from a document or log you want to set apart.
```

Links between pages are checked when the site is built: a link to a page that doesn't exist fails the build.

Simple HTML tags such as `<img>`, `<br>` or `<details>` work in a page, but anything that could run code doesn't: `<script>`, `<iframe>`, `<form>`, attributes such as `onclick=`, and `javascript:` links all fail the build, naming the page. Use the site's own blocks (quizzes, exercises, recordings, timelines) for anything interactive.

## Tables

| Port | Service |
|---|---|
| 22 | SSH |
| 443 | HTTPS |

```md
| Port | Service |
|---|---|
| 22 | SSH |
| 443 | HTTPS |
```

## Callouts

There are four kinds, and any of them can have its own title in square brackets:

:::note
A **note** adds useful background that isn't essential.
:::

:::tip
A **tip** suggests a better way to do something.
:::

:::caution
A **caution** warns about a mistake that's easy to make.
:::

:::danger[Only scan machines you're allowed to]
**Danger** is for anything that could break a system or cause harm.
:::

```md
:::note
A **note** adds useful background that isn't essential.
:::

:::tip
A **tip** suggests a better way to do something.
:::

:::caution
A **caution** warns about a mistake that's easy to make.
:::

:::danger[Only scan machines you're allowed to]
**Danger** is for anything that could break a system or cause harm.
:::
```

## Images

See [Images, downloads and video](../02-content/images-downloads-video.md#images-in-lessons), which shows one.
