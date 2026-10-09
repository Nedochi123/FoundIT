import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer, RefreshCcw } from "lucide-react";
import { api } from "../../lib/api";

const cardClass = "rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow-lg shadow-black/20 backdrop-blur";
const pretty = (c) => `${c.slice(0, 4)}-${c.slice(4)}`;

// Print rules: when printing, hide the whole app and show only the sheet of stickers.
const PRINT_CSS = `
@page { size: A4; margin: 8mm; }
@media print {
  body * { visibility: hidden !important; }
  #tag-sheet, #tag-sheet * { visibility: visible !important; }
  #tag-sheet { position: absolute; left: 0; top: 0; width: 100%; }
  .tag-sticker { break-inside: avoid; }
}
`;

function Sticker({ code, qr }) {
  return (
    <div
      className="tag-sticker flex flex-col items-center justify-between border border-dashed border-slate-400 bg-white text-center text-black"
      style={{ width: "44mm", height: "54mm", padding: "2.5mm" }}
    >
      <p style={{ fontSize: "9pt", fontWeight: 800, letterSpacing: "0.04em", lineHeight: 1 }}>FOUND ME?</p>
      {qr ? <img src={qr} alt={`QR code ${code}`} style={{ width: "32mm", height: "32mm" }} /> : <div style={{ width: "32mm", height: "32mm" }} />}
      <div style={{ lineHeight: 1.15 }}>
        <p style={{ fontSize: "6.5pt", fontWeight: 700 }}>Scan to message my owner</p>
        <p style={{ fontSize: "6pt" }}>FoundIT · Nile University</p>
        <p style={{ fontSize: "6.5pt", fontFamily: "monospace", marginTop: "0.5mm" }}>{pretty(code)}</p>
      </div>
    </div>
  );
}

/** Admin: make new tag codes and print them as a sheet of QR stickers. */
export default function AdminTagsScreen() {
  const [summary, setSummary] = useState(null);
  const [count, setCount] = useState(24);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [codes, setCodes] = useState([]);
  const [qrs, setQrs] = useState({});
  const origin = window.location.origin;

  const loadSummary = () => api.adminTagSummary().then(setSummary).catch((err) => setError(err.message));
  useEffect(() => {
    loadSummary();
  }, []);

  // make the QR pictures for whatever is on the sheet
  useEffect(() => {
    let alive = true;
    Promise.all(
      codes.map((c) => QRCode.toDataURL(`${origin}/t/${c}`, { margin: 1, width: 360, errorCorrectionLevel: "M" }).then((url) => [c, url]))
    ).then((pairs) => alive && setQrs(Object.fromEntries(pairs)));
    return () => {
      alive = false;
    };
  }, [codes, origin]);

  async function handleGenerate(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api.adminGenerateTags(Number(count));
      setCodes(data.codes);
      await loadSummary();
    } catch (err) {
      setError(err.message || "Couldn't make tags.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <style>{PRINT_CSS}</style>

      <div className={`${cardClass} flex flex-col gap-3`}>
        <p className="text-sm font-bold text-slate-50">QR tags</p>
        {summary && (
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Unclaimed", summary.counts.unclaimed],
              ["Active", summary.counts.active],
              ["Paused", summary.counts.paused],
            ].map(([label, n]) => (
              <div key={label} className="rounded-lg bg-slate-800/70 py-2">
                <p className="text-lg font-extrabold text-slate-50">{n}</p>
                <p className="text-[11px] text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleGenerate} className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="tag-count" className="mb-1 block text-sm font-medium text-slate-300">How many new tags? (1 to 200)</label>
            <input
              id="tag-count"
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </div>
          <button type="submit" disabled={busy} className="rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 px-4 py-2.5 text-sm font-bold text-amber-950 disabled:opacity-60">
            {busy ? "Making..." : "Make tags"}
          </button>
        </form>

        <button
          type="button"
          disabled={!summary?.unclaimedCodes?.length}
          onClick={() => setCodes(summary.unclaimedCodes)}
          className="flex items-center gap-1.5 self-start text-xs font-semibold text-amber-300 underline underline-offset-2 disabled:opacity-40"
        >
          <RefreshCcw className="h-3.5 w-3.5" /> Show the {summary?.unclaimedCodes?.length ?? 0} unclaimed tags again (to reprint)
        </button>

        <p className="text-xs text-slate-400">
          The stickers will point to <span className="font-mono text-slate-300">{origin}</span>. Make and print them from the live site, not from a test copy. Print the sheet on sticker paper (A4) and cut along the dashed lines.
        </p>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      </div>

      {codes.length > 0 && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 rounded-lg bg-brand-gradient px-4 py-3 text-sm font-bold text-white shadow-md shadow-brand-blue/20"
          >
            <Printer className="h-4 w-4" /> Print {codes.length} stickers
          </button>
          <div id="tag-sheet" className="flex flex-wrap gap-[2mm] overflow-x-auto bg-slate-200 p-2">
            {codes.map((c) => (
              <Sticker key={c} code={c} qr={qrs[c]} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
