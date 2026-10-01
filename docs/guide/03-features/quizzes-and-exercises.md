---
title: Quizzes and exercises
description: Knowledge checks with instant feedback, and hands-on tasks with hints and a hidden solution.
sidebar:
  order: 4
---

Both are code blocks whose contents are settings, written the same way as a page's frontmatter. The build checks them: a quiz with no right answer or a misspelled setting fails the build, naming the lesson.

## Quizzes

A `quiz` is a quick self-check. Learners pick an answer, press **Check**, and see straight away whether they were right, with the explanation. Nothing is graded. Each learner's browser remembers their answers, so coming back to the page shows them again, marked, until they press **Try again**. Changing a question, its options or which is right makes browsers forget the old answers to that question; rewording only the explanation doesn't.

```quiz
title: Check your understanding
questions:
  - question: Where is a learner's course progress saved?
    options:
      - On the site's server
      - text: In their own browser
        correct: true
      - In GitLab
    explanation: Progress is saved only in the learner's browser. **Settings → Download a backup** (linked from the footer) moves it to another device.
  - question: Which of these are good defences against password spraying?
    options:
      - text: Proident fugiat aute
        correct: true
      - text: Blocking commonly used passwords
        correct: true
      - Forcing a password change every 30 days
      - text: Rate-limiting failed logins
        correct: true
    explanation: MFA, banned-password lists and rate limits all make spraying fail. Frequent forced changes tend to make people pick *weaker*, predictable passwords.
```

````md
```quiz
title: Check your understanding
questions:
  - question: Where is a learner's course progress saved?
    options:
      - On the site's server
      - text: In their own browser
        correct: true
      - In GitLab
    explanation: Shown after the learner checks their answer.
  - question: Which of these are good defences against password spraying?
    options:
      - text: Proident fugiat aute
        correct: true
      - text: Blocking commonly used passwords
        correct: true
      - Forcing a password change every 30 days
```
````

- A plain option is a wrong answer; mark right ones with `text:` and `correct: true`.
- More than one right answer makes a "select all that apply" question, like the second one above.
- With more than one question, the quiz keeps a score as learners answer.
- `explanation` is optional, and can use **bold**, `code` and links.

## Exercises

An `exercise` is a practical task. Hints are revealed one at a time, and the solution stays hidden until the learner asks for it.

```exercise
title: Find the admin editor
task: |
  Open the site's admin editor and find:
  - where the **banner** message is set;
  - which branch a save is committed to.
hints:
  - The admin editor is at `/admin/` on the site.
  - The banner is a setting for the whole site, not a course or lesson.
solution: |
  Sign in, then open **Site settings → Banner**. Every save is committed straight to `main`, which publishes it; you can see the commits from the command line too.
solutionCode: |
  git log --oneline -5 origin/main
```

````md
```exercise
title: Find the admin editor
task: |
  Open the site's admin editor and find where the **banner** message is set.
hints:
  - The admin editor is at `/admin/` on the site.
  - It's a setting for the whole site, not a course or lesson.
solution: |
  Sign in, then open **Site settings → Banner**.
solutionCode: |
  a command or code, shown in its own copyable block (optional)
```
````

`title` and `task` are required; `hints`, `solution` and `solutionCode` are optional. Text can use `code`, **bold**, *italic*, links and simple `-` lists. `|` after a setting lets its text run over several lines.
