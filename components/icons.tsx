// Small hand-drawn icon set (no external icon library dependency).
// All icons are 24x24, stroke-based, and inherit color via currentColor.
import type { SVGProps } from "react";

function Base(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

export function GridIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </Base>
  );
}

export function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <circle cx="17" cy="8.5" r="2.6" />
      <path d="M15.2 14.8c2.3.4 3.8 2.3 3.8 5.2" />
    </Base>
  );
}

export function FileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M6.5 3h7l4 4v13a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M13.5 3v4h4" />
      <path d="M8.5 13h7M8.5 16.5h7M8.5 9.5h3" />
    </Base>
  );
}

export function FolderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3.5 6.5a1 1 0 0 1 1-1h4.4l1.8 2h8.3a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1h-14.5a1 1 0 0 1-1-1z" />
    </Base>
  );
}

export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M17.7 6.3l-1.5 1.5M7.8 16.2l-1.5 1.5M17.7 17.7l-1.5-1.5M7.8 7.8 6.3 6.3" />
    </Base>
  );
}

export function LogOutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M9 20H5.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1H9" />
      <path d="M14.5 16.5 19 12l-4.5-4.5" />
      <path d="M19 12H9" />
    </Base>
  );
}

export function PackageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16z" />
      <path d="M3.5 8 12 12.5 20.5 8" />
      <path d="M12 12.5v8" />
    </Base>
  );
}

export function SendIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M20.5 3.5 3 10.2l6.7 2.6 2.6 6.7z" />
      <path d="M20.5 3.5 12.3 12.9" />
    </Base>
  );
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M19.5 19.5 15.3 15.3" />
    </Base>
  );
}

export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4.5 7h15" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6.5 7 7.3 19a1 1 0 0 0 1 1h7.4a1 1 0 0 0 1-1L17.5 7" />
      <path d="M10 11v5M14 11v5" />
    </Base>
  );
}

export function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 20l.9-3.9L16.6 4.4a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2L8 19.1z" />
      <path d="M13.8 6.6 17.4 10.2" />
    </Base>
  );
}

export function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 3.5v11.5M8 11.5l4 4 4-4" />
      <path d="M4.5 17.5v2a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-2" />
    </Base>
  );
}

export function CheckCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 12.3l2.4 2.4 5-5" />
    </Base>
  );
}

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Base>
  );
}

export function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Base>
  );
}

export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M9 5l7 7-7 7" />
    </Base>
  );
}

export function DropletIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 3.5s6.5 7 6.5 11.5a6.5 6.5 0 1 1-13 0C5.5 10.5 12 3.5 12 3.5z" />
    </Base>
  );
}

export function KeyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="8" cy="15.5" r="4" />
      <path d="M11 12.5 19.5 4M16.5 7l2.5 2.5M13.7 9.8l2 2" />
    </Base>
  );
}

export function ChartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4.5 20V10M12 20V4M19.5 20v-7" />
      <path d="M3 20h18" />
    </Base>
  );
}

export function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
      <path d="M4.5 6.5 12 12l7.5-5.5" />
    </Base>
  );
}

export function PhoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M6 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 4.5 5.1 1.5 1.5 0 0 1 6 3.5z" />
    </Base>
  );
}

export function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 15V3.5M8 7.5l4-4 4 4" />
      <path d="M4.5 17.5v2a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-2" />
    </Base>
  );
}

export function BuildingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="5" y="3.5" width="10" height="17" rx="1" />
      <path d="M15 9.5h4a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-4" />
      <path d="M8.2 7.5h.01M11.8 7.5h.01M8.2 11h.01M11.8 11h.01M8.2 14.5h.01M11.8 14.5h.01" />
    </Base>
  );
}

export function LayersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 3.5 20.5 8 12 12.5 3.5 8z" />
      <path d="M3.5 12 12 16.5 20.5 12" />
      <path d="M3.5 16 12 20.5 20.5 16" />
    </Base>
  );
}

export function LinkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" />
    </Base>
  );
}

export function PlayIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 8.8v6.4l5.2-3.2z" />
    </Base>
  );
}

export function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </Base>
  );
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </Base>
  );
}

export function ShieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 3.5 19 6v5.5c0 4.2-3 7.6-7 9-4-1.4-7-4.8-7-9V6z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </Base>
  );
}

export function SparkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.8 2.8M15.2 15.2 18 18M18 6l-2.8 2.8M8.8 15.2 6 18" />
    </Base>
  );
}

export function CoinsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <ellipse cx="9.5" cy="7" rx="5.5" ry="2.5" />
      <path d="M4 7v4c0 1.4 2.5 2.5 5.5 2.5S15 12.4 15 11V7" />
      <path d="M9 16.2c.2 1.3 2.6 2.3 5.5 2.3 3 0 5.5-1.1 5.5-2.5v-4c0-1.2-1.8-2.2-4.3-2.4" />
    </Base>
  );
}
