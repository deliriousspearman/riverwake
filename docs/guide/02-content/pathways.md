---
title: Pathways
description: Grouping courses into a suggested order.
sidebar:
  order: 5
---

A pathway is a list of courses in the order learners should take them, such as "Blue team foundations". Pathways are listed on `/pathways/`, each with its own page listing its courses in order. A course can be in any number of pathways.

## Adding a pathway

**In the admin editor:** **Pathways → New Pathway**, pick the courses from the list and drag them into order.

**With git:** create `content/pathways/<id>.yml`:

```yaml
title: Web security fundamentals
description: From how the web works to the most common attacks.
level: Beginner
order: 1
image: /images/icons/badge/pathways/lorem-pathway-1.svg   # optional, square, up to 200 KB
courses:
  - lorem-course-1
  - lorem-course-4
```

The file name (`<id>`) becomes the pathway's address, `/pathways/<id>/`.

## Pathway settings

| Setting | What it does |
|---|---|
| `title`, `description` | Shown on the pathway's card and page |
| `level` | Beginner, Intermediate or Advanced (optional) |
| `order` | Position in the list: lower first |
| `image` | Optional square picture, at most 200 KB |
| `courses` | Course folder names, in order. At least one |

A pathway that lists a course that doesn't exist fails the build, which also catches courses that were renamed or deleted. The error lists the course folder names to choose from.
