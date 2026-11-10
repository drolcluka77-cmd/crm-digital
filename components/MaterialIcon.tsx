import { FileIcon, LinkIcon, PlayIcon } from "@/components/icons";

export default function MaterialIcon({ type, className = "h-5 w-5" }: { type: string; className?: string }) {
  if (type === "DEMO_VIDEO") return <PlayIcon className={className} />;
  if (type === "DEMO_LINK") return <LinkIcon className={className} />;
  return <FileIcon className={className} />;
}
