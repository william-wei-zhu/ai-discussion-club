"use client";

import { useEffect, useRef, useState } from "react";

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

// Directory card photo. Falls back to initials when there is no photo OR the image
// fails to load (a stored licdn.com URL can expire and start returning 404).
export function DirectoryAvatar({ name, src }: { name: string; src?: string }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // An image that already failed before hydration never fires onError, so check once.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);
  if (src && !failed) {
    // A direct image (trusted Luma/LinkedIn CDN or the app's own /api/img copy) avoids
    // turning the optimizer into a private avatar proxy.
    // eslint-disable-next-line @next/next/no-img-element
    return <img ref={img} className="h-[72px] w-[72px] shrink-0 rounded-full object-cover" src={src} alt="" width="72" height="72" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
  }
  return <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-background font-medium text-primary" aria-hidden="true">{initials(name)}</div>;
}
