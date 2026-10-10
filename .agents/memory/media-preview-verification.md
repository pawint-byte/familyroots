---
name: Media preview verification
description: Browser testing constraints for live camera previews and autoplay recovery.
---

A blocked-preview simulation must disable native autoplay as well as reject the JavaScript playback request.

**Why:** Native autoplay can still start a video independently of a patched playback method, causing the simulated rejection to be superseded by a playing event.

**How to apply:** Test the explicit retry and recording guard under genuinely paused playback. Review playback with audio needs an actual user gesture; synthetic camera/frame tests validate wiring and cleanup but do not establish physical iPhone or Android behavior.
