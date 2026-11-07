import type { ReactElement } from 'react';
import type { EntityKind } from '../shared/model';

/** 内联线性图标：1.5px 描边、currentColor，不依赖任何远端字体或图标库。 */
export type IconName =
  | 'sprout'
  | 'ring'
  | 'record'
  | 'plan'
  | 'sop'
  | 'sample'
  | 'note'
  | 'search'
  | 'refresh'
  | 'plus'
  | 'back'
  | 'edit'
  | 'archive'
  | 'copy'
  | 'upload'
  | 'download'
  | 'check'
  | 'alert'
  | 'close'
  | 'spark'
  | 'link'
  | 'inbox'
  | 'forest'
  | 'data';

const PATHS: Record<IconName, ReactElement> = {
  sprout: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5Z" />
      <path d="M12 15c0-3.2-2.4-5.2-5.6-5.2 0 3.2 2.4 5.2 5.6 5.2Z" />
      <path d="M7 21h10" />
    </>
  ),
  ring: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="2.4" />
    </>
  ),
  record: (
    <>
      <path d="M9 3h6" />
      <path d="M10 3v5.5L5.2 17.4A2.4 2.4 0 0 0 7.3 21h9.4a2.4 2.4 0 0 0 2.1-3.6L14 8.5V3" />
      <path d="M7.5 14.5h9" />
    </>
  ),
  plan: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="M8 13.5h3M8 16.5h6" />
    </>
  ),
  sop: (
    <>
      <path d="M12 3v7" />
      <path d="M12 10c-3 0-4 2-6 2.5M12 10c3 0 4 2 6 2.5" />
      <path d="M12 10v4c0 2-2 3-4 4.5M12 14c0 2 2 3 4 4.5" />
      <path d="M12 14v7" />
    </>
  ),
  sample: (
    <>
      <path d="M9 3h6M10 3v13.5a2 2 0 0 0 4 0V3" />
      <path d="M10 11h4" />
      <path d="M17.5 8.5 19 7m0 3h2" />
    </>
  ),
  note: (
    <>
      <path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15Z" />
      <path d="M5 19 13 11" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14.3-4.6L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14.3 4.6L20 16" />
      <path d="M20 20v-4h-4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />,
  edit: (
    <>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m14 8 3 3" />
    </>
  ),
  archive: (
    <>
      <rect x="3.5" y="4" width="17" height="4.5" rx="1" />
      <path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5" />
      <path d="M10 12.5h4" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" />
      <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: (
    <>
      <path d="M12 4 2.8 19.5h18.4L12 4Z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  spark: (
    <>
      <path d="M12 3.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5Z" />
      <path d="M18.5 16.5c.2 1.4.9 2.1 2.3 2.3-1.4.2-2.1.9-2.3 2.3-.2-1.4-.9-2.1-2.3-2.3 1.4-.2 2.1-.9 2.3-2.3Z" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13.5 6.5 5h11l2.5 8.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5.5Z" />
      <path d="M4 13.5h4.5l1 2h5l1-2H20" />
    </>
  ),
  forest: (
    <>
      <path d="M8 3 3.5 11h3L3 17h10l-3.5-6h3L8 3Z" />
      <path d="M8 17v4" />
      <path d="M16.5 7 13.6 12h2l-2.4 4.5h6.6L17.4 12h2l-2.9-5Z" />
      <path d="M16.5 16.5V21" />
    </>
  ),
  data: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      <path d="M5 6v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" />
      <path d="M5 12v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6" />
    </>
  ),
};

export function Icon({ name, size = 16, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      className="fa-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

export const KIND_ICON: Record<EntityKind, IconName> = {
  project: 'ring',
  record: 'record',
  plan: 'plan',
  sop: 'sop',
  sample: 'sample',
  note: 'note',
};
