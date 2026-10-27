"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Foto dari bucket privat Supabase Storage, ditampilkan lewat link sementara. */
export function StoragePhoto({
  bucket,
  path,
}: {
  bucket: string;
  path: string;
}) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)
      .then(({ data }) => setUrl(data?.signedUrl));
  }, [bucket, path]);

  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- link sementara dari Supabase
  return <img src={url} alt="" className="max-h-48 w-fit rounded-md" />;
}
