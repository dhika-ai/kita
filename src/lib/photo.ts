import { supabase } from "./supabase";

// Foto diperkecil di perangkat sebelum diunggah (sekitar 300 KB) supaya muat di
// kuota gratis Supabase Storage.
const maxSide = 1280;

export async function compressPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("compress failed"))),
      "image/jpeg",
      0.7,
    ),
  );
}

/** Perkecil lalu unggah foto ke bucket privat. Mengembalikan path file. Butuh online. */
export async function uploadPhoto(bucket: string, folder: string, file: File) {
  const path = `${folder}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, await compressPhoto(file), { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}
