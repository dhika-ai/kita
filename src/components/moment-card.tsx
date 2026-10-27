import { StoragePhoto } from "@/components/storage-photo";
import type { LocalMoment } from "@/lib/local-db";

export const momentBucket = "moment-photos";

/** Satu moment: nama, foto, dan jurnal (feed M-07, pilihan M-08). */
export function MomentCard({
  moment,
  name,
  children,
}: {
  moment: LocalMoment;
  name: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-md border p-3">
      <span className="text-sm font-medium">{name}</span>
      {moment.photo_path && (
        <StoragePhoto bucket={momentBucket} path={moment.photo_path} />
      )}
      {moment.journal && (
        <p className="whitespace-pre-wrap">{moment.journal}</p>
      )}
      {children}
    </li>
  );
}
