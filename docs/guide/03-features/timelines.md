---
title: Timelines
description: Events in order, down the page or across it.
sidebar:
  order: 3
---

A `timeline` block shows events in order, each with a date, a title and optional text: a history, an incident write-up, or the steps of a process. This page shows every layout and style.

## Vertical (the default)

```timeline
events:
  - date: 09:12
    title: Alert
    text: The SIEM flags logins from a new country.
  - date: 09:40
    title: Contained
    text: The account is disabled and its sessions revoked.
  - date: 11:05
    title: Closed
    text: Password reset, **MFA** enrolled, report filed.
```

````md
```timeline
events:
  - date: 09:12
    title: Alert
    text: The SIEM flags logins from a new country.
  - date: 09:40
    title: Contained
    text: The account is disabled and its sessions revoked.
  - date: 11:05
    title: Closed
    text: Password reset, **MFA** enrolled, report filed.
```
````

## Horizontal

Add `layout: horizontal` to put the events side by side. If they don't all fit, learners scroll sideways. Where there isn't room, such as on phones, the timeline is shown vertically instead, so keep each event's text short.

```timeline
layout: horizontal
title: Incident response
events:
  - date: Phase 1
    title: Preparation
    text: Plans, contacts and tools ready before anything happens.
  - date: Phase 2
    title: Detection and analysis
    text: Spot the incident and work out its scope.
  - date: Phase 3
    title: Containment and recovery
    text: Stop the spread, remove the cause, restore service.
  - date: Phase 4
    title: Lessons learned
    text: Review what happened and improve the plan.
```

````md
```timeline
layout: horizontal
title: Incident response
events:
  - date: Phase 1
    title: Preparation
    text: Plans, contacts and tools ready before anything happens.
  - date: Phase 2
    title: Detection and analysis
    text: Spot the incident and work out its scope.
  - date: Phase 3
    title: Containment and recovery
    text: Stop the spread, remove the cause, restore service.
  - date: Phase 4
    title: Lessons learned
    text: Review what happened and improve the plan.
```
````

## Snake

`layout: snake` runs the events left to right, then turns down and runs the next row right to left, and so on, so a long timeline fits the page without scrolling. Each row holds as many events as the width allows (two to four); on phones it's shown vertically.

```timeline
layout: snake
title: Phishing attack, step by step
events:
  - date: Step 1
    title: Research
    text: The attacker finds staff names and roles online.
  - date: Step 2
    title: Lure
    text: A convincing email about an "overdue invoice".
  - date: Step 3
    title: Click
    text: The link opens a copy of the company's sign-in page.
  - date: Step 4
    title: Credentials
    text: The password typed there goes to the attacker.
  - date: Step 5
    title: Sign-in
    text: The attacker signs in as the employee.
  - date: Step 6
    title: Payment fraud
    text: A real invoice is resent with new bank details.
```

````md
```timeline
layout: snake
title: Phishing attack, step by step
events:
  - date: Step 1
    title: Research
    text: The attacker finds staff names and roles online.
  - date: Step 2
    title: Lure
    text: A convincing email about an "overdue invoice".
```
````

## Cards

Add `style: cards` to show each event in a panel. It works with every layout.

### Vertical cards

Where there's room, the cards alternate either side of a centre line; on phones they're all on one side.

```timeline
style: cards
title: Patch Tuesday
events:
  - date: Day 0
    title: Updates released
    text: Read the advisories and note anything rated **Critical**.
  - date: Day 1
    title: Test
    text: Install on a small group of test machines first.
  - date: Day 3
    title: Roll out
    text: Deploy to everyone, servers last.
  - date: Day 7
    title: Check
    text: Confirm every machine reports the update as installed.
```

````md
```timeline
style: cards
title: Patch Tuesday
events:
  - date: Day 0
    title: Updates released
    text: Read the advisories and note anything rated **Critical**.
  - date: Day 1
    title: Test
    text: Install on a small group of test machines first.
```
````

### Horizontal cards

```timeline
layout: horizontal
style: cards
title: Resetting a forgotten password
events:
  - date: Step 1
    title: Request
    text: The user asks for a reset on the sign-in page.
  - date: Step 2
    title: Email
    text: A one-time link, valid for 30 minutes.
  - date: Step 3
    title: New password
    text: Checked against a list of known breached passwords.
  - date: Step 4
    title: Sign out everywhere
    text: Other sessions end, in case the old password leaked.
```

````md
```timeline
layout: horizontal
style: cards
title: Resetting a forgotten password
events:
  - date: Step 1
    title: Request
    text: The user asks for a reset on the sign-in page.
```
````

### Snake cards

```timeline
layout: snake
style: cards
title: Investigating a suspicious sign-in
events:
  - date: 10:02
    title: Alert
    text: A sign-in from an unusual country.
  - date: 10:05
    title: Check the user
    text: They're at their desk, not abroad.
  - date: 10:07
    title: Lock the account
    text: Sessions revoked, password reset forced.
  - date: 10:30
    title: Review the logs
    text: What did the attacker open or change?
  - date: 11:15
    title: Find the cause
    text: The password was reused from a breached site.
  - date: 11:40
    title: Close
    text: MFA enrolled, user briefed, report filed.
```

````md
```timeline
layout: snake
style: cards
title: Investigating a suspicious sign-in
events:
  - date: 10:02
    title: Alert
    text: A sign-in from an unusual country.
```
````

## Settings

| Setting | What it does |
|---|---|
| `title` | Optional heading above the timeline |
| `layout` | `vertical` (the default), `horizontal` or `snake` |
| `style` | `plain` (the default) or `cards` |
| `events` | The events, at least two, shown in the order written (they aren't sorted by date) |
| `date` | Required on each event. Any text: `1989`, `May 2017`, `09:12`, `Step 1` |
| `title` | Required on each event |
| `text` | Optional. Can use `code`, **bold**, *italic*, links and simple lists |

The build fails, naming the page and the event, if a setting is misspelled, an event has no date or title, `layout` isn't `vertical`, `horizontal` or `snake`, or `style` isn't `plain` or `cards`.
