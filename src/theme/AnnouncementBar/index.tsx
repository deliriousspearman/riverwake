// Wraps Docusaurus's announcement bar, which shows the site banner (content/settings/banner.yml,
// "Site settings → Banner" in the CMS; docusaurus.config.ts turns it into `announcementBar`). The
// bar only takes colours, so the banner's font size, height, bold and italic are applied here.
import React from 'react';
import AnnouncementBar from '@theme-original/AnnouncementBar';
import type AnnouncementBarType from '@theme/AnnouncementBar';
import type { WrapperProps } from '@docusaurus/types';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

type Props = WrapperProps<typeof AnnouncementBarType>;
type Banner = { fontSize: number; height: number; bold: boolean; italic: boolean } | null;

export default function AnnouncementBarWrapper(props: Props) {
	const banner = useDocusaurusContext().siteConfig.customFields?.banner as Banner;
	if (!banner) return <AnnouncementBar {...props} />;
	const style = {
		'--lms-banner-font-size': `${banner.fontSize}px`,
		'--lms-banner-min-height': `${banner.height}px`,
		'--lms-banner-weight': banner.bold ? 700 : 400,
		'--lms-banner-style': banner.italic ? 'italic' : 'normal',
	} as React.CSSProperties;
	return (
		<div className="site-banner" style={style}>
			<AnnouncementBar {...props} />
		</div>
	);
}
