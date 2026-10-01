// Replaces @docusaurus/theme-mermaid's Mermaid component (same markup) so diagrams use the selected
// theme's colours in light and dark mode, read from the page (src/lib/mermaid.ts). The plugin's own
// option takes one fixed config for both modes. Mermaid itself is only downloaded on pages that have
// a diagram. Until a diagram is drawn (and in the page's HTML), a placeholder panel of about its
// height stands in for it, so the text below doesn't jump when it appears.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MermaidConfig } from 'mermaid';
import ErrorBoundary from '@docusaurus/ErrorBoundary';
import { ErrorBoundaryErrorMessageFallback, useColorMode } from '@docusaurus/theme-common';
import { MermaidContainerClassName, useMermaidRenderResult } from '@docusaurus/theme-mermaid/client';
import { estimatedHeight, mermaidConfig } from '../../lib/mermaid';

type RenderResult = NonNullable<ReturnType<typeof useMermaidRenderResult>>;

/**
 * Mermaid sizes a diagram to fit its container (`width="100%"`, up to its natural width). A wide one
 * then shrinks until its text is unreadable, so it may only shrink to 3/4 of its natural width;
 * beyond that the panel scrolls sideways (src/css/site/code.css, `.lms-mermaid`).
 */
const limitShrinking = (svg: string) =>
	svg.replace(/style="max-width: ([\d.]+)px;/, (match, width: string) => `${match} min-width: ${Math.round(Number(width) * 0.75)}px;`);

function MermaidRenderResult({ renderResult }: { renderResult: RenderResult }) {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (ref.current) renderResult.bindFunctions?.(ref.current);
	}, [renderResult]);
	const svg = useMemo(() => limitShrinking(renderResult.svg), [renderResult]);
	// Mermaid's SVG, sanitised by Mermaid (securityLevel: strict).
	return <div ref={ref} className={`${MermaidContainerClassName} lms-mermaid not-content`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** The diagram's panel before it's drawn, about as tall as the diagram will be. */
function Placeholder({ value }: { value: string }) {
	return (
		<div className="lms-mermaid lms-mermaid-loading not-content" style={{ minHeight: estimatedHeight(value) }} aria-busy="true">
			<span>Loading diagram…</span>
			<noscript>This diagram needs JavaScript to be drawn.</noscript>
		</div>
	);
}

function MermaidRenderer({ value, config }: { value: string; config: MermaidConfig }) {
	const renderResult = useMermaidRenderResult({ text: value, config });
	return renderResult === null ? <Placeholder value={value} /> : <MermaidRenderResult renderResult={renderResult} />;
}

/**
 * The config for `colorMode`, read from the page once it shows that mode. Docusaurus applies a mode
 * change to <html data-theme> in an effect that can run after this component's, so wait (a frame at
 * a time, briefly) until the attribute matches before reading the colours.
 */
function useMermaidConfig(colorMode: 'light' | 'dark') {
	const [config, setConfig] = useState<MermaidConfig | null>(null);
	useEffect(() => {
		let frame = 0;
		let tries = 0;
		const read = () => {
			if (document.documentElement.dataset.theme === colorMode || ++tries > 10) setConfig(mermaidConfig());
			else frame = requestAnimationFrame(read);
		};
		read();
		return () => cancelAnimationFrame(frame);
	}, [colorMode]);
	return config;
}

/**
 * A new renderer (`key`) for each colour mode. The plugin keeps one diagram id for a component's
 * whole life, and Mermaid deletes any element with that id before drawing: re-drawing in place for
 * the new mode could delete the diagram on screen and then, if the new drawing came out the same
 * (Mermaid's config is global, so concurrent diagrams can share one), never put it back. That left
 * a page loaded in light mode with an empty panel.
 */
function ThemedMermaid({ value, colorMode }: { value: string; colorMode: 'light' | 'dark' }) {
	const config = useMermaidConfig(colorMode);
	return config ? <MermaidRenderer value={value} config={config} /> : <Placeholder value={value} />;
}

export default function Mermaid(props: { value: string }) {
	const { colorMode } = useColorMode();
	return (
		<ErrorBoundary key={colorMode} fallback={(params) => <ErrorBoundaryErrorMessageFallback {...params} />}>
			<ThemedMermaid value={props.value} colorMode={colorMode} />
		</ErrorBoundary>
	);
}
