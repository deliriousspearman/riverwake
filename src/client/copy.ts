// Copy buttons on ```terminal blocks (scripts/terminal.mjs): copies the terminal's text and shows
// "Copied!" briefly. One listener for every page.
if (typeof document !== 'undefined') {
	document.addEventListener('click', async (event) => {
		const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]');
		const code = button?.closest('figure')?.querySelector('pre');
		if (!button || !code) return;
		try {
			await navigator.clipboard.writeText(code.innerText.replace(/\n$/, ''));
			button.classList.add('is-copied');
			setTimeout(() => button.classList.remove('is-copied'), 1500);
		} catch {
			// Clipboard unavailable (e.g. not a secure context): nothing to do.
		}
	});
}

export {};
