---
title: Pro labs
description: Describing a lab environment, its machines and its rules, and the flags learners submit.
sidebar:
  order: 4
---

A pro lab page describes a practice environment that runs elsewhere: the site shows its scenario, stats, machines and skills, and learners connect to the lab itself separately. Each lab is one file, `docs/labs/<lab>.md`, shown at `/labs/<lab>/` and listed under **Pro Labs**. While labs are being built, you can hide them from visitors with **Site settings → Features → Show Pro Labs** ([site settings](site-settings.md#features)).

## Adding a lab

**In the admin editor:** **Pro Labs → New Pro lab**. **With git:** copy `docs/labs/lorem-lab-1.md` (a domain lab) or `docs/labs/lorem-lab-2.md` and change it.

```yaml
---
kind: lab
title: Lorem Lab 1
description: Shown on the lab's card.
order: 1
level: Intermediate
environment: domain            # or standalone
domain: lorem-lab-1.example       # domain labs only
entryPoint: 198.51.100.0/24
flags: 6
machines:
  - name: DC01
    os: Windows                # Windows, Linux, FreeBSD or Other
    role: Domain controller
    network: Internal
    domainJoined: true
skills:
  - Kerberoasting
  - Lateral movement
---

The scenario, scope and rules of engagement, and how learners get access.
```

## Lab settings

| Setting | What it does |
|---|---|
| `level` | Beginner, Intermediate or Advanced |
| `environment` | `domain` (an Active Directory domain) or `standalone` hosts |
| `domain` | The domain name, for domain labs only |
| `entryPoint` | Where learners start: an address range or host |
| `flags` | How many flags there are to find. Leave it out once the lab has a flags file (below): the count comes from there |
| `machines` | Each machine's name, operating system and, optionally, role, network and whether it's domain-joined |
| `skills` | What learners will practise, shown as a list |

The page's text is the scenario. The stats tiles, machine list and skills are added around it automatically.

The build checks that the settings fit together: a domain lab needs a `domain`, a standalone lab can't have domain-joined machines, and so on. The error explains what to change.

:::caution
Use documentation addresses (`192.0.2.x`, `198.51.100.x`, `203.0.113.x`) and `.example` domains in lab pages, never real ones.
:::

## Flags

Learners can submit the flags they capture on the lab's page, under **Submit a flag**, to track their progress: the stats show how many they have, the machine list ticks each machine's flags, a **Flags** list shows which are left, and the lab's card shows its progress (and counts as complete once every flag is captured). Progress is kept in each learner's browser, like course progress.

A lab's flags go in their own file, **never in the lab page**: everything in a lab page reaches learners' browsers. **In the admin editor:** **Lab flags**, one entry per lab, named after the lab's file (`lorem-lab-2` for `docs/labs/lorem-lab-2.md`). **With git:** `content/lab-flags/<lab>.yml`:

```yaml
flags:
  - machine: SHOP          # optional: one of the lab's machines
    label: User            # shown to learners: "SHOP · User"
    flag: HL{9c1f2a7e4b0d8c3f6a5e1b2d}
  - label: Enterprise admin   # a flag that isn't on one machine
    flag: HL{0b8d3e6f1a2c5b9e7d4f8a1c}
```

- Learners see each flag's machine and label from the start, as a map of what's left to find. They never see its value.
- The site only gets a scrambled fingerprint (a hash) of each flag, and checks what a learner submits against it in their browser. So use **long, random flags**: a short or guessable one could be found by trying guesses. The build warns about any shorter than 12 characters.
- A submitted flag is matched exactly, apart from spaces around it.
- **Changing a flag's value** makes learners' browsers forget they captured it. Renaming its label doesn't.
- Captured flags aren't in progress backups, and **Reset progress** doesn't clear them.
- The flags in this repository for all five labs (Lorem Lab 1, Lorem Lab 2, Lorem Lab 3, Lorem Lab 4 and Lorem Lab 5) are **placeholders**: replace them with the lab's real flags.

The build checks the file: a flag's machine must be one of the lab's, no two flags may have the same value (or the same machine and label), and if the lab page still has `flags:`, it must match the number of flags in the file.
