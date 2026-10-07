---
title: Site settings
description: The site's theme, the announcement banner across the top of every page, and hiding Pro Labs while they're being built.
sidebar:
  order: 10
---

These settings are in the admin editor under **Site settings**, or in `content/settings/` with git. Like any change, they go live a few minutes after saving.

## Theme

The theme sets the look of the whole site: its shapes, fonts and its own dark and light colours. Visitors choose the colours they see with the menu in the top bar (or on the Settings page): **Hacklab Night** and **Hacklab Day** are the theme's own dark and light, and the others (Dracula, Catppuccin, Tokyo Night, Nord, Gruvbox, One Dark, Solarized and High Contrast) are well-known code editor colours over the same shapes and fonts. Everyone starts on Hacklab Night. The names stay the same whichever theme is set here, so with `nightshift` Hacklab Night has a teal accent.

| Theme | Look |
|---|---|
| `hacklab` | Navy panels, lime accent, rounded corners (the default) |
| `hardline` | Square corners, heavier outlines, monospace headings |
| `hardline-classic` | Hardline, with Hacklab's headings and round switches |
| `nightshift` | Teal accent, rounder corners, soft glows |

With git, `content/settings/theme.yml` has one line:

```yaml
theme: hardline-classic
```

## Banner

The banner is a bar across the top of every page for short notices, such as planned maintenance. Switch it off when the notice no longer applies.

| Setting | Editor field | What it does |
|---|---|---|
| `enabled` | Show the banner | On or off |
| `message` | Message | One or two short sentences |
| `backgroundColor` | Bar colour | A colour like `#ffaf00` |
| `textColor` | Text colour | Must stand out against the bar: dark text on a light bar, or the other way round |
| `fontSize` | Text size (pixels) | 10 to 32. The site's body text is 16 |
| `bold`, `italic` | Bold text, Italic text | Text style |
| `height` | Bar height (pixels) | 20 to 120. The bar grows if the message doesn't fit on one line |

```yaml
enabled: true
message: Scheduled maintenance on Saturday from 09:00 to 11:00.
backgroundColor: '#ffaf00'
textColor: '#0e1a02'
fontSize: 15
bold: true
italic: false
height: 40
```

If the text and bar colours are too close to read easily, the build still publishes, but prints a warning in the pipeline log. Check the banner on the live site in a light and a dark colour theme.

## Features

**Show Pro Labs** (`proLabs`) hides Pro Labs while they're being built. Switched off, visitors don't see them: there's no **Pro Labs** link in the top bar or the footer, no Pro Labs section on the home page, and labs don't come up in search. The lab pages still exist at their addresses (`/labs/` and `/labs/<lab>/`), so you can check them on the live site; anyone given the address can open them too, so this hides labs but doesn't make them secret. Switch it back on when they're ready.

With git, `content/settings/features.yml`:

```yaml
proLabs: false
```
