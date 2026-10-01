---
title: Network diagrams
description: Drawing network diagrams in draw.io that match the site, and adding them to a lesson.
sidebar:
  order: 8
---

Network diagrams are drawn in draw.io (your organisation's own copy, in the browser: ask an administrator for its address) from one of the site's templates, so they match the site: navy panels, square corners, coloured zones and monospace names and addresses.

For a flow or a sequence (the steps of an attack, a decision, the messages in a protocol), a [Mermaid diagram](../03-features/diagrams.md) written in the lesson is quicker, and can be changed in the admin editor.

<img src="/images/guide/network-diagram-example.drawio.svg" alt="Example network diagram in the site's style. The internet zone (red, dashed) holds an attacker at 203.0.113.66 and the internet. A firewall, fw01, links the internet to a DMZ (orange) with web01 and mail01, and to the internal network (green) with a switch, a domain controller, a file server and two workstations. A management zone (blue) has a jump host sending logs to a SIEM. Red dashed arrows show the attack: 1, exploit from the attacker to web01; 2, lateral movement from web01 to the domain controller." />

## Choose a layout

There's a template for each layout, all in the same style. The example above is **Zones**; this one is **Icons**:

<img src="/images/guide/network-diagram-icons.drawio.svg" alt="The same network drawn with device symbols instead of boxes. Tinted zones: internet (red, dashed) with an attacker and the internet as a cloud; a firewall symbol; the DMZ (orange) with two servers, web01 outlined in green; management (blue) with jump01 sending to a SIEM monitor; and the internal network (green) with a switch, the domain controller, a file server and two workstations. Red dashed arrows: 1, exploit from the attacker to web01; 2, lateral movement from web01 to the domain controller." />

| Template | Layout | Good for |
|---|---|---|
| `codex-network-zones.drawio` | A box per zone, hosts as cards (the first example on this page) | General "here is the network" diagrams |
| `codex-network-lanes.drawio` | One column per trust level, least trusted on the left | Trust boundaries and segmentation |
| `codex-network-bands.drawio` | The same order as bands from top to bottom, narrow | Most lessons: its text stays almost full size in the lesson column and on phones |
| `codex-network-hub.drawio` | The firewall in the middle, every zone connected to it | Firewall rules: what can reach what |
| `codex-network-icons.drawio` | Device symbols instead of cards, tinted zones (above) | Overviews with many hosts |
| `codex-network-icons-os.drawio` | Icons with each host's operating system on it, and virtual machines inside their hypervisor | Labs and environments where the OS matters |
| `codex-network-attack.drawio` | The network in grey; only the attack path, its hosts and numbered steps in colour | Walkthroughs of one attack |

Wide diagrams are scaled down to fit the lesson column (about 720px), text and all: the 1,320px-wide layouts end up at about half size. Learners can click a scaled-down picture to see it full size, but the bands layout reads well without that.

## Get the template

The templates are in the project, under [`templates/drawio/`](https://gitlab.example.com/group/codex/-/tree/main/templates/drawio). Download the one you want and the shape library (open each file in GitLab, then **Download**):

| File | What it is |
|---|---|
| `codex-network-<layout>.drawio` | The diagram to start from. Its **New diagram** page is the layout's empty zones with the title and legend; the **Example** page is the network drawn in that layout. |
| `codex-network-library.xml` | The shapes for every template: zones (outlined, tinted and quiet), a hypervisor box, host cards, icons, OS badges, the kinds of line, step markers and a legend. |

In draw.io:

1. **File → Open from → Device**, and pick the template.
2. **File → Open Library from → Device**, and pick `codex-network-library.xml`. Its shapes appear in the left panel; drag them onto the page.
3. **File → Save as** with a new name, so the template stays as it is.

## Drawing

Start on the **New diagram** page: change the title and the one-line description under it, then add zones and hosts from the library.

| Colour | Use it for |
|---|---|
| Red, dashed | Untrusted networks: the internet, an attacker's machine |
| Orange | The DMZ: servers the internet can reach |
| Green | The internal network |
| Blue | Management: jump hosts, logging, monitoring |
| Purple | Any other segment (the library's "Zone: other") |

- **Hosts** show a type above the box (`WEB SERVER`), then the name and address inside it. Give the host a lesson is about the green outline ("Host: highlighted"), and an attacker the red one.
- **Lines:** grey for a network link, blue with an arrow for traffic that matters to the lesson, and red dashed for an attack path. Number attack steps in their labels (`1 · exploit`, `2 · lateral movement`) so the text can refer to them.
- Use documentation addresses (`192.0.2.x`, `198.51.100.x`, `203.0.113.x`), never real ones.
- Zones are containers: drag a host into a zone and it moves with it. The same goes for a hypervisor box and the virtual machines inside it.
- Keep labels short; the lesson text can explain the rest.
- Labels are plain text, and don't wrap by themselves: start a new line in a label where you want it to break. Leave **Formatted Text** (in the Text panel on the right) unticked: formatted labels can't be shown on the site (see below).
- Each host's address (and operating system) is a text of its own, attached to the card or icon, so it moves with it. Double-click it to change it.

### Operating systems on icons

In the icons-with-OS template, each host has a small badge on its icon for its operating system or platform, and the full name and version under its address (`Windows Server 2022`, `Ubuntu 24.04`, `Proxmox VE 8`). The badge's colour shows the family:

| Badge | Family |
|---|---|
| `WIN` (blue) | Windows |
| `LINUX` (yellow) | Linux: Ubuntu, Debian, Kali, Rocky… |
| `BSD` (teal) | BSD-based: pfSense, OPNsense, FreeBSD |
| `PVE` (purple) | Hypervisors: Proxmox VE, ESXi, Hyper-V |
| `IOS` (grey) | Network operating systems: Cisco IOS, RouterOS |
| `MACOS` (white) | macOS |

The library has an icon with each badge already on it, and the badges on their own. The badge is part of its icon, so it moves with it. To change one, double-click the badge text and type (for example `ESXI` or `QEMU`), and change the full name under the address. Put virtual machines inside a **hypervisor** box (dashed purple), named after the host and what it runs, such as `pve01 · Proxmox VE 8 (QEMU/KVM)`, so it's clear where each one runs.

The template's text uses the site's fonts (Chakra Petch, Figtree and JetBrains Mono), which draw.io loads from Google Fonts while you're online. Without internet access, draw.io shows other fonts unless they're installed on your computer: install the ones in the project's [`templates/drawio/fonts/`](https://gitlab.example.com/group/codex/-/tree/main/templates/drawio/fonts) folder once (download each file, then open it and choose Install). The site itself always shows diagrams in its own fonts.

## Adding it to a lesson

1. **File → Export as → SVG**, with:
   - **Zoom** 100% and **Border width** 0;
   - **Include a copy of my diagram** ticked: the picture then carries the whole diagram, so it can be opened in draw.io and changed later, and there's no separate `.drawio` file to keep;
   - **Embed fonts** unticked: the site draws diagrams in its own fonts.
2. Name the file ending in **`.drawio.svg`**, such as `dmz.drawio.svg`. That ending is what tells the site it's a draw.io diagram.
3. Upload it with the image button in the admin editor, or put it in `static/images/<course>/` with git (see [Images, downloads and video](images-downloads-video.md#images-in-lessons)).
4. Put it on a line of its own in the lesson, with alt text that describes it, as the examples on this page do: what's connected to what, and the path that matters. Learners using screen readers rely on it, so say the important part in the lesson text too. Text in quotes after the address is an optional caption under the diagram.

```md
![The DMZ between two firewalls, with web01 reachable from the internet](/images/lorem-course-3/dmz.drawio.svg "The DMZ")
```

The diagram becomes part of the page rather than a picture of it: learners can select and copy its text (an address, a host name), find it with Ctrl+F and site search, and it's drawn in the site's fonts, sharp at any size. A diagram wider than the text column is scaled down to fit, and opens full size when clicked, like the examples above.

**To change a diagram later,** open the `.drawio.svg` in draw.io (**File → Open from → Device**; download it from GitLab first), change it, and export it again over the same file.

### If the build refuses a diagram

Diagrams become part of the page, so the build only lets drawing through: shapes, lines and text. It fails, naming the file and the problem, if a diagram has:

- **labels drawn as HTML:** a label with **Formatted Text** or **Word wrap** on exports as HTML, which the site can't show. Select everything (Ctrl+A), untick both in the Text panel, and export again. Text that needs to wrap can be broken into lines instead;
- **no copy of the diagram:** export again with **Include a copy of my diagram** ticked;
- a link, a script, or a picture from another site, which a browser would run or load as part of the site;
- **no alt text**, or it's in the middle of a sentence rather than on a line of its own.

A plain `.drawio` file in `static/` is refused too, with a reminder to export it as `.drawio.svg`.

A PNG export (**File → Export as → PNG**) still works as an ordinary picture, but its text can't be selected or found, and it blurs when zoomed.

Diagrams stay dark when a learner switches the site to light mode, like the terminal windows do.
