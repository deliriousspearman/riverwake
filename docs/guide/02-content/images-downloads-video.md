---
title: Images, downloads and video
description: Adding pictures to lessons, files learners can download, and lesson videos with captions.
sidebar:
  order: 7
# Working examples: this page shows the lesson video player and downloads list, as a lesson would.
video: /videos/guide/intro.mp4
captions: /captions/guide/intro.vtt
attachments:
  - file: /files/guide/nmap-cheat-sheet.txt
    title: Nmap cheat sheet
    description: Common scans and options on one page.
  - file: /files/guide/http-login.pcap
    title: HTTP login capture
    description: A short capture of one HTTP request, to open in Wireshark.
---

The video and the two downloads above are working examples: this page has them set in the same way as a lesson (see [Downloads](#downloads) and [Videos](#videos) below). Try the player's **CC** button for the captions.

Files live under `static/` and are served from the site's root: `static/images/x.png` is at `/images/x.png`. Pages link to them by that path. The site only uses its own files: pictures, videos or recordings from other websites are blocked, and the build fails if a page uses one.

## Images in lessons

**In the admin editor:** use the image button in the Markdown toolbar; the upload goes to `static/images/`. **With git:** put the file in `static/images/<course>/`, then:

```md
![A network diagram with the DMZ between two firewalls](/images/lorem-course-3/dmz.png)
```

Always describe the picture in the square brackets, for learners using screen readers. To set its width, use an HTML tag instead:

<img src="/images/courses/lorem-course-3.svg" alt="The Lorem Ipsum Course 3 course picture" width="128" />

```html
<img src="/images/courses/lorem-course-3.svg" alt="The Lorem Ipsum Course 3 course picture" width="128" />
```

An image wider than the text column is scaled down to fit; learners can click it to see it full size. Keep images small (a few hundred KB at most): each is downloaded in full on every visit. The build warns about an image over 500 KB and refuses one over 1 MB (the admin editor won't upload it either); resize it to about 1600px wide, or save it as WebP or a compressed JPEG. Course, lab and pathway **pictures** (the square icons on cards) are limited to 200 KB.

Images can be PNG, JPEG, WebP, AVIF, GIF or SVG. An SVG must be a plain picture: the build fails if one contains a script, an `on…` attribute, embedded HTML or a link to another site, because a browser would run those as part of the site. Most drawing tools export plain SVGs; if one is refused, export it again as "plain" or "optimised" SVG, or as PNG. draw.io diagrams are different: saved as `.drawio.svg`, they're shown as part of the page (see [Network diagrams](diagrams.md#adding-it-to-a-lesson)). The same goes for any other kind of file put in `static/images/`.

## Downloads

Files learners can download, like cheat sheets, scripts or packet captures, are listed on the lesson or course under **Downloads** (`attachments`).

**In the admin editor:** add a download on the lesson or course, and upload the file there. **With git:** put the file in `static/files/<course>/`, then list it:

```yaml
attachments:
  - file: /files/lorem-course-4/injection-cheat-sheet.pdf
    title: Injection cheat sheet
    description: One page, printable.     # optional
```

- Up to **10 MB** per file.
- Allowed: PDF, text and Markdown, CSV, JSON, YAML, logs, scripts (`.py`, `.sh`, `.ps1`), packet captures, ZIP/7z/tar archives, Office documents and images.
- **Not** HTML, SVG, JavaScript or programs: a browser could run them as part of the site.

A lesson's downloads are shown above the lesson, like the two at the top of this page, and, with every other lesson's, on the course overview under **Downloads**. A course overview can have `attachments` of its own, for files that belong to the whole course; they're listed first there. The build fails if a listed file is missing, too large or not an allowed type.

### A download in the page text

To show a download where it's needed, say just under the step that uses it, put an `attachment` block there instead. It takes the same fields as `attachments`:

````md
```attachment
file: /files/guide/common-ports.csv
title: Common ports
description: Ports worth knowing when reading firewall logs, as a spreadsheet.
```
````

which shows:

```attachment
file: /files/guide/common-ports.csv
title: Common ports
description: Ports worth knowing when reading firewall logs, as a spreadsheet.
```

- For several files, make it a list: start each file with `- `, as under `attachments`.
- A file in a block is shown only there, not above the lesson, and isn't listed on the course overview. To list it there too, add `overview: true`.
- Each file can be on a page only once: in `attachments` or in one block.
- The file has to be in `static/files/` already. With git, add it as above. In the admin editor, upload it as a download on the page and save, then remove that download and save again: the file stays.
- The same rules apply as for `attachments`, and the build fails, naming the page and line, if the file is missing, too large or not an allowed type. The editor's preview shows the block, without the file's size.

## Videos

A lesson can have one video, shown in a player above the text, like the one at the top of this page. Videos are stored with **Git LFS**, which keeps large files out of the project's history, so they're added with git, not in the admin editor.

1. Install Git LFS once on your computer (`sudo apt install git-lfs`, or from [git-lfs.com](https://git-lfs.com)), then run `git lfs install`.
2. Put the video in `static/videos/<course>/`, as MP4 (H.264 video, AAC audio), which plays in every browser.
3. Point the lesson at it, in the editor's **Video path** field or in the file:

   ```yaml
   video: /videos/lorem-course-4/02-lorem-lesson-2.mp4
   ```

4. Commit and push. `git lfs ls-files` lists the videos being stored with LFS.

If Git LFS wasn't installed when you committed, the pipeline fails with "Not stored with Git LFS" and nothing is published. Install it, then run `git rm --cached <file>` and `git add <file>`, and commit again.

**Keep videos short.** The whole site, videos included, is limited to 100 MB unless a GitLab admin raises it, and the site's hosting can't jump straight to the middle of a video: learners skipping ahead wait for everything before that point to download. A few minutes per video works well; talk to the site's admin before adding long ones. The build warns once the site passes 80 MB, and above the limit the site isn't published, naming the largest files: remove or shrink one of those and save again.

### Adding an opener

To start a video with a title card in the site's style (a green bar, the course in small capitals, the lesson title and an optional line under it, fading in and out over four seconds), run this from the project folder, with your own text:

```sh
npm run video-opener -- --label "Lorem Ipsum Course 1 · Lesson 1" --title "Lorem culpa sunt commodo" \
  --subtitle "Confidentiality, integrity and availability" \
  --join ~/Videos/cia-triad.mp4 --captions ~/Videos/cia-triad.vtt
```

It writes `cia-triad-with-opener.mp4` next to your recording, the same size as it, ready for `static/videos/<course>/`. With `--captions`, it also writes `cia-triad-with-opener.vtt`: the captions moved later by the opener's length, so they still line up. Leave out `--join` to get the opener on its own (`opener.mp4`). `--seconds` changes its length and `--out` the file name; `--help` lists everything. A title can take two lines and the line under it two more: if the text is too long for the card, it says so.

It needs **ffmpeg** on your computer (`sudo apt install ffmpeg`, `brew install ffmpeg` on a Mac, or `winget install ffmpeg` on Windows) and the project's packages (`npm install`).

If the video file is missing or can't play, learners see **Video unavailable** with a **Try again** button instead of a broken player, and can still read the lesson.

## Captions

Give a video subtitles with a WebVTT (`.vtt`) file, up to 500 KB. Most editing tools, and speech-to-text tools such as Whisper, can export one. Upload it in the editor's **Video captions** field, or put it in `static/captions/<course>/` and list it next to the video:

```yaml
video: /videos/lorem-course-4/02-lorem-lesson-2.mp4
captions: /captions/lorem-course-4/02-lorem-lesson-2.vtt
```

Learners turn captions on with the **CC** button in the player. The build fails if the file is missing, isn't really WebVTT, or the lesson has no video.
