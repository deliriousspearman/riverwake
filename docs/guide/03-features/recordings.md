---
title: Terminal recordings
description: Playing back a recorded terminal session that learners can pause, scrub and copy from.
sidebar:
  order: 5
---

A recording plays back a real terminal session. Unlike a video, the text stays text: learners can pause it and copy commands straight out of it, and it's tiny compared with a video.

```asciinema
src: /casts/lorem-course-2/lorem-recording-1.cast
title: Hashing and salting
```

````md
```asciinema
src: /casts/lorem-course-2/lorem-recording-1.cast
title: Hashing and salting
speed: 1.5          # optional: playback speed
idleTimeLimit: 2    # optional: shorten long pauses to 2 seconds
```
````

## Making a recording

1. Install [asciinema](https://asciinema.org) on a lab machine.
2. Run `asciinema rec my-recording.cast`, do the task, then type `exit` (or press Ctrl+D) to stop.
3. Put the file in `static/casts/<course>/`, with git.
4. Add an `asciinema` block to the lesson, with `src` pointing at the file.

The build fails if the file doesn't exist or a setting is misspelled.

:::caution
A recording captures everything shown in the terminal: user names, host names, addresses and anything you type, including passwords typed in plain view. Record on a lab machine using documentation addresses such as `192.0.2.10`, and watch it through before publishing.
:::
