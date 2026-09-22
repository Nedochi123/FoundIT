import { useRef, useState } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { compressImage } from "../../lib/imageCompress";

// capture="environment" opens the rear camera directly on mobile
// browsers — no gallery/file-picker detour. Desktop browsers ignore
// `capture` and just show a normal file picker, which is expected.
export default function CameraCapture({ onCapture }) {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [processing, setProcessing] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    try {
      const compressed = await compressImage(file);
      const url = URL.createObjectURL(compressed);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      onCapture(compressed);
    } finally {
      setProcessing(false);
      e.target.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleFile}
      />
      {previewUrl ? (
        <div className="relative">
          <img src={previewUrl} alt="Captured item" className="w-full rounded-xl object-cover" style={{ maxHeight: 320 }} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Retake
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={processing}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-600 bg-slate-900/40 py-10 text-slate-300 transition hover:border-brand-teal hover:text-brand-teal disabled:opacity-60"
        >
          <Camera className="h-8 w-8" strokeWidth={1.8} />
          <span className="font-medium">{processing ? "Processing..." : "Take Photo"}</span>
        </button>
      )}
    </div>
  );
}
