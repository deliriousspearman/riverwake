---
title: Site settings
description: The site's theme, and the announcement banner across the top of every page.
sidebar:
  order: 9
---

Both settings are in the admin editor under **Site settings**, or in `content/settings/` with git. Like any change, they go live a few minutes after saving.

## Theme

The theme sets the look of the whole site. Every theme has a light and a dark mode, and visitors still choose between those with the switch in the top bar.

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

If the text and bar colours are too close to read easily, the build still publishes, but prints a warning in the pipeline log. Check the banner on the live site in both light and dark mode.
