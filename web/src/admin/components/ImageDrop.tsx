import clsx from "clsx";
import { useRef, useState, type DragEvent } from "react";
import { Icon } from "../../components/Icon";
import { Spinner } from "../../components/ui";

export const MAX_IMAGE_MB = 4;
const ACCEPT = ["image/png", "image/jpeg", "image/webp"];

/** Drag & drop / click-to-pick image input with client-side type + size checks and instant preview. */
export function ImageDrop({ preview, onFile, uploading, error }: { preview: string | null; onFile: (f: File) => void; uploading?: boolean; error?: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const accept = (f: File | undefined) => {
    if (!f) return;
    if (!ACCEPT.includes(f.type)) return setLocalErr("Only PNG, JPG or WEBP files are allowed.");
    if (f.size > MAX_IMAGE_MB * 1024 * 1024) return setLocalErr(`File is too large — maximum ${MAX_IMAGE_MB} MB.`);
    setLocalErr(null);
    onFile(f);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    accept(e.dataTransfer.files?.[0]);
  };

  const err = localErr ?? error;
  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={clsx(
          "relative grid aspect-[16/10] w-full cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors",
          over ? "border-accent bg-accent/10" : err ? "border-danger/50 bg-danger/5" : "border-white/10 bg-surface2 hover:border-white/20",
        )}
        aria-label="Upload skin image"
      >
        {preview ? (
          <>
            <div className="absolute inset-0 bg-[conic-gradient(#ffffff08_25%,transparent_0_50%,#ffffff08_0_75%,transparent_0)] bg-[length:20px_20px]" />
            <img src={preview} alt="Preview" className="relative h-full w-full object-contain p-3" />
            <span className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-[11px] text-white/90 backdrop-blur">Click or drop to replace</span>
          </>
        ) : (
          <div className="px-4 text-center">
            <Icon name="upload" size={26} className="mx-auto text-muted" />
            <p className="mt-2 text-sm font-medium">Drop image here or click to browse</p>
            <p className="mt-1 text-xs text-muted">PNG, JPG or WEBP · max {MAX_IMAGE_MB} MB · transparent background recommended</p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 grid place-items-center bg-black/50 backdrop-blur-[2px]">
            <span className="flex items-center gap-2 text-sm">
              <Spinner /> Optimizing…
            </span>
          </div>
        )}
      </div>
      <input ref={input} type="file" accept={ACCEPT.join(",")} className="hidden" onChange={(e) => accept(e.target.files?.[0] ?? undefined)} />
      {err && <p className="mt-1.5 text-xs text-danger">{err}</p>}
    </div>
  );
}
