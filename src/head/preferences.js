// Applies this browser's site preferences (src/lib/preferences.ts, set on the Settings page) to
// <html> as data-lms-<name> attributes before the page is drawn, so a larger text size, a wider
// column, reduced motion, a collapsed "On this page", an unpinned breadcrumb bar or hidden glossary
// underlines are there from the first frame instead of the page jumping once the site's scripts
// load. Loaded in <head> by docusaurus.config.ts
// (headTags), and copied to static/head/ by scripts/prepare.mjs: the page policy (scripts/csp.mjs)
// allows no inline scripts of our own. Keep it tiny and dependency-free.
(function () {
	try {
		var saved = JSON.parse(localStorage.getItem('lms-preferences-v1') || '{}');
		for (var name in saved) {
			var value = saved[name];
			if (/^[a-z]{1,16}$/.test(name) && typeof value === 'string' && /^[a-z0-9.]{1,16}$/.test(value)) {
				document.documentElement.setAttribute('data-lms-' + name, value);
			}
		}
	} catch (e) {
		// No storage (blocked, or a private window): the defaults apply.
	}
})();
