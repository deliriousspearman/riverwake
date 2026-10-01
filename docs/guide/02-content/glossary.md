---
title: Glossary
description: Adding security terms, which are explained on /glossary/ and in every lesson that uses them.
sidebar:
  order: 6
---

Each glossary term is explained in two places:

- on `/glossary/`, and on its own page `/glossary/<id>/`, which site search finds;
- in lessons and pro labs: the **first use** of the term on each page is underlined, and learners can hover or tap it to read the definition.

Nothing needs adding to lessons: terms are found and marked automatically when the site is built.

## Adding a term

**In the admin editor:** **Glossary → New Term**. **With git:** create `content/glossary/<id>.yml`:

```yaml
term: Kerberoasting
aliases:
  - Kerberoast
definition: Requesting Kerberos service tickets for accounts with a service principal name, then cracking them offline to recover the service account's password.
seeAlso:
  - active-directory
  - hash-cracking
```

| Setting | What it does |
|---|---|
| `term` | The term as it should be shown |
| `aliases` | Abbreviations and other spellings to recognise too, such as `ACL` for access control list. Each name can belong to one term only |
| `definition` | One or two plain sentences, shown in the tooltip and on the glossary page |
| `seeAlso` | Related terms, by their file names |

## How terms are matched

- Whole words only, with or without a plural "s".
- Case doesn't matter, except for abbreviations in capitals (`ACL`), which must match exactly.
- The longest name wins, so "access control list" is marked rather than "access control" inside it.
- Never marked: headings, links, code, and quizzes, exercises and other blocks.

To stop marking terms on a page where it would be distracting, switch off **Mark glossary terms** on it (`glossary: false`).

The build fails if two terms share a name or alias, or if **See also** lists a term that doesn't exist.
