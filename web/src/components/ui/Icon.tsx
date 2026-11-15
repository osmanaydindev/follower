// A small inline icon set. Emoji are not used as icons anywhere in the web app:
// they render differently per platform, cannot inherit colour, and read as
// decoration to a screen reader. Every icon here is aria-hidden — the label it
// sits next to carries the meaning.

export type IconName =
  | 'arrowRight'
  | 'arrowLeft'
  | 'arrowUp'
  | 'bookmark'
  | 'check'
  | 'chevronDown'
  | 'close'
  | 'copy'
  | 'dots'
  | 'download'
  | 'eye'
  | 'eyeOff'
  | 'globe'
  | 'handshake'
  | 'heart'
  | 'info'
  | 'lock'
  | 'logout'
  | 'moon'
  | 'plusSquare'
  | 'refresh'
  | 'search'
  | 'share'
  | 'shield'
  | 'sun'
  | 'tabs'
  | 'trend'
  | 'userMinus'
  | 'users'
  | 'verified'
  | 'warning';

const paths: Record<IconName, React.ReactNode> = {
  arrowRight: <path d="M5 12h13m0 0-5.5-5.5M18 12l-5.5 5.5" />,
  arrowLeft: <path d="M19 12H6m0 0 5.5-5.5M6 12l5.5 5.5" />,
  arrowUp: <path d="M12 19V6m0 0-5.5 5.5M12 6l5.5 5.5" />,
  bookmark: <path d="M6.5 4h11a1 1 0 0 1 1 1v15l-6.5-4-6.5 4V5a1 1 0 0 1 1-1Z" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-6A3.5 3.5 0 0 0 3 6.5v6A2.5 2.5 0 0 0 5.5 15" />
    </>
  ),
  dots: (
    <>
      <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  download: <path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 20h16" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.6 3.3M6.4 8.2A17 17 0 0 0 2.5 12S6 18 12 18c.9 0 1.7-.1 2.5-.4" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9h17M3.5 15h17M12 3c2.5 3 2.5 15 0 18-2.5-3-2.5-15 0-18Z" />
    </>
  ),
  handshake: <path d="M3 12.5 7 8.5l3 3 2-2 2 2 3-3 4 4-4 4-3-3-2 2-2-2-3 3-4-4Z" />,
  heart: <path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 7.8a4.1 4.1 0 0 1 7.5 2.8c0 4.8-7.5 9.4-7.5 9.4Z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <circle cx="12" cy="7.8" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  logout: <path d="M14 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2m3-5H9m11 0-3.5-3.5M20 12l-3.5 3.5" />,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  plusSquare: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  refresh: <path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4.5h-4.5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  share: <path d="M12 16V4m0 0L8 8m4-4 4 4M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14" />,
  shield: <path d="M12 3l7.5 3v5.5c0 4.5-3.2 7.8-7.5 9.5-4.3-1.7-7.5-5-7.5-9.5V6L12 3Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </>
  ),
  tabs: (
    <>
      <rect x="3.5" y="7.5" width="13" height="13" rx="2.5" />
      <path d="M7.5 4.5h11a2 2 0 0 1 2 2v11" />
    </>
  ),
  trend: <path d="M3 17l5.5-5.5 3.5 3.5L21 6m0 0h-5.5M21 6v5.5" />,
  userMinus: (
    <>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3.5 20c0-3.3 2.7-6 6-6 1 0 2 .3 2.9.7M16 17.5h5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 5.6M18 14.4c1.8.9 3 2.7 3 4.8" />
    </>
  ),
  verified: (
    <>
      <path d="M12 3l2.1 1.6 2.6-.3 1 2.4 2.3 1.3-.6 2.6.6 2.6-2.3 1.3-1 2.4-2.6-.3L12 21l-2.1-1.6-2.6.3-1-2.4L4 16l.6-2.6L4 10.8 6.3 9.5l1-2.4 2.6.3L12 3Z" />
      <path d="m8.8 12.2 2.2 2.2 4.2-4.6" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4.5 21 19.5H3L12 4.5Z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.7,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
