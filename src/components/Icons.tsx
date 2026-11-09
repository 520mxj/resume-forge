interface IconProps {
  size?: number;
  className?: string;
}

function base(size = 16, className = '') {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };
}

export const IconUpload = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 16V4m0 0L7 9m5-5 5 5" />
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

export const IconDownload = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 4v12m0 0 5-5m-5 5-5-5" />
    <path d="M4 18v2h16v-2" />
  </svg>
);

export const IconPrinter = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M7 8V3h10v5" />
    <rect x="4" y="8" width="16" height="8" rx="2" />
    <path d="M7 14h10v7H7z" />
  </svg>
);

export const IconSpark = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  </svg>
);

export const IconTrash = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </svg>
);

export const IconEye = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);

export const IconEyeOff = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M3 3l18 18" />
    <path d="M10.6 6.2A9.6 9.6 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.3 3.9M6.2 7.6A16.5 16.5 0 0 0 2 12s3.5 6 10 6a9.6 9.6 0 0 0 3.6-.7" />
  </svg>
);

export const IconPlus = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconGrip = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="9" cy="6" r="1" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="9" cy="18" r="1" />
    <circle cx="15" cy="6" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="15" cy="18" r="1" />
  </svg>
);

export const IconGear = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" />
  </svg>
);

export const IconFile = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </svg>
);

export const IconCheck = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 12.5 9 17.5 20 6.5" />
  </svg>
);

export const IconWarn = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 4 2.6 20h18.8L12 4Z" />
    <path d="M12 10v4.5M12 17.4v.2" />
  </svg>
);

export const IconInfo = ({ size, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8v.2" />
  </svg>
);

export const IconSettings = IconGear;
