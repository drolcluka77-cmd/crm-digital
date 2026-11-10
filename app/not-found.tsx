import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-sand-50 px-4">
      <div className="text-center">
        <div className="text-6xl font-semibold text-brand-500 mb-2">404</div>
        <p className="text-black/50 mb-6">That page doesn&apos;t exist.</p>
        <Link href="/" className="btn-primary">
          Back home
        </Link>
      </div>
    </div>
  );
}
