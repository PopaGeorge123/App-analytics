"use client";

import React, { useState, useRef, useEffect } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;
}

// ─── Date helpers ──────────────────────────────────────────────────────────────
export function today(): string { return new Date().toISOString().slice(0, 10); }
export function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
}
function startOfWeek(): string {
  const now = new Date(); const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  return mon.toISOString().slice(0, 10);
}
function startOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}
function startOfYear(): string { return `${new Date().getFullYear()}-01-01`; }

export const PRESETS: { label: string; getRange: () => DateRange }[] = [
  { label: "Today",          getRange: () => { const d = today(); return { from: d, to: d }; } },
  { label: "Yesterday",      getRange: () => { const d = daysAgo(1); return { from: d, to: d }; } },
  { label: "This week",      getRange: () => ({ from: startOfWeek(),  to: today() }) },
  { label: "Last 7 days",    getRange: () => ({ from: daysAgo(7),    to: today() }) },
  { label: "Last 14 days",   getRange: () => ({ from: daysAgo(14),   to: today() }) },
  { label: "This month",     getRange: () => ({ from: startOfMonth(), to: today() }) },
  { label: "Last 30 days",   getRange: () => ({ from: daysAgo(30),   to: today() }) },
  { label: "Last 90 days",   getRange: () => ({ from: daysAgo(90),   to: today() }) },
  { label: "Last quarter",   getRange: () => ({ from: daysAgo(91),   to: today() }) },
  { label: "This year",      getRange: () => ({ from: startOfYear(),  to: today() }) },
  { label: "Last 12 months", getRange: () => ({ from: daysAgo(365),  to: today() }) },
  { label: "All time",       getRange: () => ({ from: "2000-01-01",   to: today() }) },
];

// ─── Mini Calendar ─────────────────────────────────────────────────────────────
const WEEKDAYS   = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

interface MiniCalendarProps {
  rangeFrom: string | null;
  rangeTo: string | null;
  selecting: "from" | "to";
  hovered: string | null;
  onSetHovered: (d: string | null) => void;
  onSelectDate: (d: string) => void;
}

function MiniCalendar({ rangeFrom, rangeTo, selecting, hovered, onSetHovered, onSelectDate }: MiniCalendarProps) {
  const [viewYear,  setViewYear]  = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth    = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startOffset    = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const cells: (string | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${viewYear}-${String(viewMonth + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = today();

  function isInRange(d: string) {
    const lo = rangeFrom;
    const hi = selecting === "to" ? (hovered ?? rangeTo) : rangeTo;
    if (!lo || !hi) return false;
    const [a, b] = lo <= hi ? [lo, hi] : [hi, lo];
    return d > a && d < b;
  }

  return (
    <div className="w-64">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="flex h-6 w-6 items-center justify-center rounded-lg text-[#6a6a90] hover:bg-[#f2f2f8] transition-colors">
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span className="font-mono text-[11px] font-bold text-[#1a1a2e]">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="flex h-6 w-6 items-center justify-center rounded-lg text-[#6a6a90] hover:bg-[#f2f2f8] transition-colors">
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center font-mono text-[8px] font-semibold text-[#9a9ab8] py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={`e-${i}`} />;
          const isFuture = d > todayStr;
          const isFrom   = d === rangeFrom;
          const isTo     = d === (selecting === "to" ? (hovered ?? rangeTo) : rangeTo);
          const inRange  = isInRange(d);
          const isT      = d === todayStr;
          return (
            <button
              key={d}
              disabled={isFuture}
              onMouseEnter={() => !isFuture && onSetHovered(d)}
              onMouseLeave={() => onSetHovered(null)}
              onClick={() => !isFuture && onSelectDate(d)}
              className={[
                "relative h-7 w-full rounded-lg font-mono text-[10px] transition-colors",
                isFuture ? "opacity-20 cursor-default" : "cursor-pointer",
                isFrom || isTo ? "bg-[#00d4aa] text-white font-bold" : "",
                inRange && !isFrom && !isTo ? "bg-[#00d4aa]/15 text-[#1a1a2e] rounded-none" : "",
                !isFrom && !isTo && !inRange ? "hover:bg-[#f2f2f8] text-[#1a1a2e]" : "",
                isT && !isFrom && !isTo ? "font-bold text-[#00d4aa]" : "",
              ].join(" ")}
            >
              {parseInt(d.split("-")[2])}
              {isT && !isFrom && !isTo && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-2 rounded-full bg-[#00d4aa]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Date Range Button ─────────────────────────────────────────────────────────
export function DateRangeButton({ range, onChange, align = "left" }: { range: DateRange; onChange: (r: DateRange) => void; align?: "left" | "right" }) {
  const [open, setOpen]         = useState(false);
  const [tempFrom, setTempFrom] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<"from" | "to">("from");
  const [hovered, setHovered]   = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function applyPreset(p: typeof PRESETS[0]) {
    onChange(p.getRange());
    setOpen(false);
    setTempFrom(null);
    setSelecting("from");
  }

  function handleDateSelect(d: string) {
    if (selecting === "from") {
      setTempFrom(d);
      setSelecting("to");
    } else {
      if (!tempFrom) return;
      const from = d < tempFrom ? d : tempFrom;
      const to   = d < tempFrom ? tempFrom : d;
      onChange({ from, to });
      setOpen(false);
      setTempFrom(null);
      setSelecting("from");
    }
  }

  function fmtLabel(d: string) {
    return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  const isPresetActive = (p: typeof PRESETS[0]) => {
    const r = p.getRange();
    return r.from === range.from && r.to === range.to;
  };

  const displayLabel =
    range.from === "2000-01-01" ? "All time" :
    range.from === range.to ? fmtLabel(range.from) :
    `${fmtLabel(range.from)} – ${fmtLabel(range.to)}`;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={[
          "flex items-center gap-2 rounded-xl border px-4 py-2.5 font-mono text-xs font-semibold transition-all",
          open
            ? "border-[#00d4aa]/60 bg-white text-[#00d4aa] shadow-md"
            : "border-[#d4d4e8] bg-[#f2f2f8] text-[#4a4a6a] hover:border-[#00d4aa]/40 hover:bg-white hover:text-[#1a1a2e]",
        ].join(" ")}
      >
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>{displayLabel}</span>
        <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div
          className={`absolute ${align === "right" ? "right-0" : "left-0"} top-[calc(100%+8px)] z-50 flex overflow-hidden rounded-2xl border border-[#d4d4e8] bg-white shadow-2xl shadow-black/10`}
          style={{ minWidth: 520 }}
        >
          {/* Preset list */}
          <div className="w-44 shrink-0 border-r border-[#ebebf5] bg-[#fafafa] p-3">
            <p className="px-2 mb-2 font-mono text-[8px] font-semibold uppercase tracking-widest text-[#b0b0c8]">Quick select</p>
            <div className="space-y-0.5">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  className={[
                    "w-full text-left rounded-lg px-2.5 py-1.5 font-mono text-[10px] transition-colors",
                    isPresetActive(p)
                      ? "bg-[#00d4aa]/12 text-[#00d4aa] font-semibold"
                      : "text-[#4a4a6a] hover:bg-[#ececf4]",
                  ].join(" ")}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar */}
          <div className="flex-1 p-5">
            <p className="mb-3 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#9a9ab8]">
              {selecting === "from" ? "Select start date" : (
                <>Select end date <span className="text-[#00d4aa] normal-case">from: {tempFrom ? fmtLabel(tempFrom) : ""}</span></>
              )}
            </p>
            <MiniCalendar
              rangeFrom={tempFrom ?? range.from}
              rangeTo={range.to}
              selecting={selecting}
              hovered={hovered}
              onSetHovered={setHovered}
              onSelectDate={handleDateSelect}
            />
            <div className="mt-4 flex items-center justify-between border-t border-[#ebebf5] pt-3">
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="rounded-md bg-[#f2f2f8] px-2 py-1 text-[#1a1a2e] font-semibold">{fmtLabel(range.from)}</span>
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#9a9ab8" strokeWidth={2}><path d="M5 12h14m-7-7l7 7-7 7"/></svg>
                <span className="rounded-md bg-[#f2f2f8] px-2 py-1 text-[#1a1a2e] font-semibold">{fmtLabel(range.to)}</span>
              </div>
              {selecting === "to" && tempFrom && (
                <button
                  onClick={() => { setTempFrom(null); setSelecting("from"); }}
                  className="font-mono text-[9px] text-[#9a9ab8] hover:text-[#f87171] transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
