// Wraps Docusaurus's "Toggle word wrap" code block button: with "Wrap long code lines" on in
// Settings (data-lms-wrap="on" on <html>, src/lib/preferences.ts), a code block too wide for the
// column starts wrapped, as if the reader had pressed the button; the button still switches each
// block. Docusaurus keeps the state per block, off at first, and only knows a block is too wide
// after it's drawn (`isCodeScrollable`), hence the effect. It decides that while the page is still
// being laid out, so a block that fits can count as too wide: the block is measured again a frame
// later. Each block is wrapped once at most, so turning it off for a block isn't undone, e.g. on
// resizing.
import React, { useEffect, useRef } from 'react';
import WordWrapButton from '@theme-original/CodeBlock/Buttons/WordWrapButton';
import type WordWrapButtonType from '@theme/CodeBlock/Buttons/WordWrapButton';
import type { WrapperProps } from '@docusaurus/types';
import { useCodeBlockContext } from '@docusaurus/theme-common/internal';

type Props = WrapperProps<typeof WordWrapButtonType>;

export default function WordWrapButtonWrapper(props: Props) {
	const { wordWrap } = useCodeBlockContext();
	const done = useRef(false);
	useEffect(() => {
		if (done.current || !wordWrap.isCodeScrollable || wordWrap.isEnabled) return;
		if (document.documentElement.dataset.lmsWrap !== 'on') return;
		const frame = requestAnimationFrame(() => {
			const pre = wordWrap.codeBlockRef.current;
			if (!pre || pre.scrollWidth <= pre.clientWidth) return;
			done.current = true;
			wordWrap.toggle();
		});
		return () => cancelAnimationFrame(frame);
	}, [wordWrap]);
	return <WordWrapButton {...props} />;
}
