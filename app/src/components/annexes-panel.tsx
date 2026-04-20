"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Minus, Plus, Maximize2 } from "lucide-react";
import type { AnnexItem } from "@/types/case";

// Default keyword patterns per annex type — used when the annex has
// no explicit reveal_triggers. Matches in student or patient messages
// (case-insensitive) unlock the annex.
const DEFAULT_TRIGGERS: Partial<Record<AnnexItem["type"], RegExp>> = {
  ecg: /\b(ecg|électro(cardiogramme)?|electro(cardiogramme)?|trac[ée]\s+cardiaque?)\b/i,
  lab: /\b(bilan(\s+(biologique|sanguin|lipidique|h[ée]patique|r[ée]nal))?|biolog\w*|n\.?f\.?s\.?|ionogramme|h[ée]mogramme|glyc[ée]mie|cr[ée]atinin\w*|prise\s+de\s+sang|gaz\s+du\s+sang|bilan\s+thyro[ïi]dien)\b/i,
  biologie: /\b(bilan(\s+(biologique|sanguin|lipidique|h[ée]patique|r[ée]nal))?|biolog\w*|n\.?f\.?s\.?|ionogramme|h[ée]mogramme|glyc[ée]mie|cr[ée]atinin\w*|prise\s+de\s+sang|gaz\s+du\s+sang|bilan\s+thyro[ïi]dien|[ée]lectrophor[èe]se|eps)\b/i,
  eps: /\b(eps|[ée]lectrophor[èe]se|spirom[ée]trie|efr|vems|cvf|dlco|bronchodilatateur)\b/i,
  photo: /\b(photo(graphie)?|image|clich[ée])\b/i,
  radio: /\b(radio(graphie)?|rx|radiographie)\b/i,
  scan: /\b(scan(ner)?|tdm|tomodensitom[ée]trie)\b/i,
  irm: /\b(irm|r[ée]sonance\s+magn[ée]tique)\b/i,
  echographie: /\b([ée]chograph\w*|ultrasons?|doppler)\b/i,
  ophtalmo: /\b(fond\s+d['']?œil|fond\s+d['']?oeil|fo\b|r[ée]tine|pupille|mydriase|myosis|œil|oeil|segment\s+ant[ée]rieur)\b/i,
  derma: /\b(l[ée]sion|[ée]ruption|plaque|bouton|rash|peau|dermato\w*)\b/i,
};

export function annexRevealRegex(annex: AnnexItem): RegExp | null {
  if (annex.reveal_triggers && annex.reveal_triggers.length > 0) {
    const alt = annex.reveal_triggers
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    return new RegExp(`\\b(${alt})\\b`, "i");
  }
  return DEFAULT_TRIGGERS[annex.type] ?? null;
}

const TYPE_LABELS: Record<string, string> = {
  ecg: "ECG",
  photo: "Photo",
  lab: "Labo",
  biologie: "Biologie",
  eps: "EFR",
  radio: "Radio",
  scan: "Scanner",
  irm: "IRM",
  echographie: "Échographie",
  ophtalmo: "Ophtalmo",
  derma: "Dermato",
  schema: "Schéma",
  tableau: "Tableau",
  other: "Document",
};

const TYPE_COLORS: Record<string, string> = {
  ecg: "bg-red-100 text-red-700",
  photo: "bg-blue-100 text-blue-700",
  lab: "bg-green-100 text-green-700",
  biologie: "bg-green-100 text-green-700",
  eps: "bg-cyan-100 text-cyan-700",
  radio: "bg-indigo-100 text-indigo-700",
  scan: "bg-indigo-100 text-indigo-700",
  irm: "bg-indigo-100 text-indigo-700",
  echographie: "bg-indigo-100 text-indigo-700",
  ophtalmo: "bg-amber-100 text-amber-700",
  derma: "bg-pink-100 text-pink-700",
  schema: "bg-violet-100 text-violet-700",
  tableau: "bg-slate-100 text-slate-700",
  other: "bg-gray-100 text-gray-700",
};

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.25;

interface AnnexViewerProps {
  annex: AnnexItem;
  onClose: () => void;
}

// Custom full-screen viewer with click-and-drag panning + zoom buttons.
// Avoids the default DialogContent constraints (sm:max-w-sm) that shrank
// the modal to a narrow strip.
function AnnexViewer({ annex, onClose }: AnnexViewerProps) {
  // Scale is a multiplier relative to the image's natural size:
  //  - scale === null means "fit to container" (auto)
  //  - scale > 0       means "display image at naturalWidth * scale"
  const [scale, setScale] = useState<number | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, sl: 0, st: 0 });
  // Pinch-zoom state: distance + scale captured at gesture start.
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);

  // ESC to close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") zoomIn();
      else if (e.key === "-") zoomOut();
      else if (e.key === "0") fit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomIn = useCallback(() => {
    setScale((s) => {
      if (s === null) return 1.5;
      return Math.min(MAX_SCALE, s + ZOOM_STEP);
    });
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => {
      if (s === null) return null;
      const next = s - ZOOM_STEP;
      return next <= MIN_SCALE ? null : next;
    });
  }, []);

  const fit = useCallback(() => setScale(null), []);

  function onWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  }

  function startDrag(e: React.MouseEvent) {
    const c = containerRef.current;
    if (!c) return;
    draggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      sl: c.scrollLeft,
      st: c.scrollTop,
    };
  }

  function onDrag(e: React.MouseEvent) {
    if (!draggingRef.current) return;
    const c = containerRef.current;
    if (!c) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    c.scrollLeft = dragStartRef.current.sl - dx;
    c.scrollTop = dragStartRef.current.st - dy;
  }

  function endDrag() {
    draggingRef.current = false;
  }

  // Touch handling: single-finger uses native scroll via touch-pan-*
  // CSS, so we only intercept pinch (two fingers) to drive zoom. Native
  // overscroll + momentum then remain snappy on iOS Safari.
  function touchDistance(t: React.TouchList): number {
    const a = t[0];
    const b = t[1];
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const currentScale =
        scale ??
        (natural && containerRef.current
          ? Math.min(
              containerRef.current.clientWidth / natural.w,
              containerRef.current.clientHeight / natural.h
            )
          : 1);
      pinchRef.current = {
        dist: touchDistance(e.touches),
        scale: currentScale,
      };
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const d = touchDistance(e.touches);
      const ratio = d / pinchRef.current.dist;
      const next = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, pinchRef.current.scale * ratio)
      );
      setScale(next);
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchRef.current = null;
  }

  // Auto-fill: on first load, pick a default zoom that fills the
  // viewport nicely — if the natural image is smaller than the
  // container, bump it up; otherwise leave it in fit mode.
  useEffect(() => {
    if (!natural || scale !== null) return;
    const c = containerRef.current;
    if (!c) return;
    const cw = c.clientWidth;
    const ch = c.clientHeight;
    // If the image is quite a bit smaller than the container, auto-zoom
    // in so it reads comfortably without the student having to fiddle.
    if (natural.w < cw * 0.7 && natural.h < ch * 0.7) {
      const factor = Math.min(cw / natural.w, ch / natural.h) * 0.85;
      setScale(Math.max(1, factor));
    }
  }, [natural, scale]);

  const imgStyle: React.CSSProperties =
    scale === null || !natural
      ? {
          maxWidth: "100%",
          maxHeight: "100%",
          width: "auto",
          height: "auto",
          objectFit: "contain",
          margin: "auto",
          display: "block",
        }
      : {
          width: `${natural.w * scale}px`,
          height: `${natural.h * scale}px`,
          maxWidth: "none",
          display: "block",
        };

  const currentScaleText = scale === null ? "Ajusté" : `${Math.round(scale * 100)}%`;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/75 backdrop-blur-sm p-2 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full h-full bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 flex items-center justify-between gap-3 px-3 sm:px-4 py-2 border-b bg-white">
          <h2 className="text-sm font-medium text-gray-900 truncate min-w-0">
            <span className="font-semibold">
              {TYPE_LABELS[annex.type ?? "other"]}
            </span>
            {annex.description && (
              <span className="text-gray-600"> — {annex.description}</span>
            )}
          </h2>
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button
              type="button"
              onClick={zoomOut}
              title="Dézoomer (−)"
              className="h-10 w-10 sm:h-9 sm:w-9 flex items-center justify-center rounded hover:bg-gray-100 text-gray-700"
            >
              <Minus className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
            <span className="text-xs font-mono tabular-nums w-12 sm:w-16 text-center text-gray-600">
              {currentScaleText}
            </span>
            <button
              type="button"
              onClick={zoomIn}
              title="Zoomer (+)"
              className="h-10 w-10 sm:h-9 sm:w-9 flex items-center justify-center rounded hover:bg-gray-100 text-gray-700"
            >
              <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
            <button
              type="button"
              onClick={fit}
              title="Ajuster (0)"
              className="h-10 w-10 sm:h-9 sm:w-9 flex items-center justify-center rounded hover:bg-gray-100 text-gray-700 ml-0.5 sm:ml-1"
            >
              <Maximize2 className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Fermer (Échap)"
              className="h-10 w-10 sm:h-9 sm:w-9 flex items-center justify-center rounded hover:bg-red-50 hover:text-red-600 text-gray-700 ml-0.5 sm:ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        <div
          ref={containerRef}
          onMouseDown={startDrag}
          onMouseMove={onDrag}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ touchAction: "pan-x pan-y" }}
          className={`flex-1 min-h-0 overflow-auto bg-gray-100 select-none ${
            scale === null ? "flex items-center justify-center" : "cursor-grab active:cursor-grabbing"
          }`}
        >
          <img
            src={annex.url}
            alt={annex.description || annex.filename}
            style={imgStyle}
            draggable={false}
            onLoad={(e) => {
              const el = e.currentTarget;
              setNatural({ w: el.naturalWidth, h: el.naturalHeight });
            }}
          />
        </div>
        <footer className="shrink-0 border-t bg-gray-50 px-3 py-1.5 text-[11px] text-gray-500 flex items-center justify-center gap-4">
          <span className="sm:hidden">Pincer pour zoomer · glisser pour déplacer</span>
          <span className="hidden sm:inline">Cliquez-glissez pour déplacer</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">Ctrl + molette pour zoomer</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">+ / − / 0 / Échap</span>
        </footer>
      </div>
    </div>
  );
}

interface AnnexesPanelProps {
  annexes: AnnexItem[];
  highlightedFilename?: string | null;
}

export function AnnexesPanel({ annexes, highlightedFilename }: AnnexesPanelProps) {
  const [selectedAnnex, setSelectedAnnex] = useState<AnnexItem | null>(null);

  const validAnnexes = annexes.filter((a) => a.url);
  if (validAnnexes.length === 0) return null;

  return (
    <>
      <div className="border-b bg-amber-50/60 px-3 py-2 shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-1.5">
          Documents ({validAnnexes.length})
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {validAnnexes.map((annex) => (
            <button
              key={annex.filename}
              onClick={() => setSelectedAnnex(annex)}
              className={`shrink-0 relative rounded-lg overflow-hidden border-2 transition-all active:scale-95 ${
                highlightedFilename === annex.filename
                  ? "border-amber-400 ring-2 ring-amber-300 ring-offset-1 animate-pulse"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <img
                src={annex.url}
                alt={annex.description || annex.filename}
                className="h-16 w-24 sm:h-20 sm:w-28 object-cover bg-gray-100"
              />
              <span
                className={`absolute bottom-0.5 left-0.5 text-[9px] font-semibold px-1 py-0.5 rounded ${
                  TYPE_COLORS[annex.type] ?? TYPE_COLORS.other
                }`}
              >
                {TYPE_LABELS[annex.type] ?? "Doc"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selectedAnnex && (
        <AnnexViewer
          annex={selectedAnnex}
          onClose={() => setSelectedAnnex(null)}
        />
      )}
    </>
  );
}

