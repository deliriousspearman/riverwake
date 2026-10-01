// Keeps the admin editor out of frames on other sites (clickjacking: a page that shows the editor
// invisibly and tricks a signed-in editor into clicking Save or Delete). Loaded before the editor by
// cms/index.html, and copied to static/admin/ by scripts/prepare.mjs. If the editor is framed, the
// page stays blank and tries to replace the framing page; the Pages server's X-Frame-Options header
// (README → Security checklist) stops the frame from loading at all.
if (window.top !== window.self) {
	document.documentElement.style.display = 'none';
	try {
		window.top.location = window.self.location.href;
	} catch {
		// A sandboxed frame can't navigate the page above it: stay blank.
	}
}
