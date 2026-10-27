"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { pendingPhoto } from "@/lib/sync/sync";

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
    let objectUrl: string | undefined;
    void (async () => {
      // Foto yang belum terunggah (diambil saat offline) ditampilkan dari perangkat.
      const blob = await pendingPhoto(path);
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        return setUrl(objectUrl);
      }
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3600);
      setUrl(data?.signedUrl);
    })();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [bucket, path]);

  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- link sementara dari Supabase
  return <img src={url} alt="" className="max-h-48 w-fit rounded-md" />;
}
