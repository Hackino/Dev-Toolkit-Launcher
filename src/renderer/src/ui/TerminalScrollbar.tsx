import { useEffect, useRef, useState, useCallback } from 'react';
import type { Terminal } from '@xterm/xterm';

type Thumb = { top: number; height: number; visible: boolean };
type Drag = { startY: number; startViewport: number; baseY: number; travelPx: number };

/**
 * A custom, always-visible vertical scrollbar for the terminal — synced to the
 * active xterm buffer. The native xterm scrollbar is hidden (it auto-hides on
 * macOS); this one behaves like the app's other scrollbars and supports
 * drag + track-click.
 */
export default function TerminalScrollbar({ term }: { term: Terminal | null }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const rafRef = useRef<number | null>(null);
  const [thumb, setThumb] = useState<Thumb>({ top: 0, height: 100, visible: false });

  const recompute = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (!term) { setThumb((t) => ({ ...t, visible: false })); return; }
      const buf = term.buffer.active;
      const length = buf.length;
      const rows = term.rows;
      const baseY = buf.baseY;
      if (baseY <= 0 || length <= rows) {
        setThumb({ top: 0, height: 100, visible: false });
        return;
      }
      const heightPct = Math.max((rows / length) * 100, 6);
      const topPct = (buf.viewportY / baseY) * (100 - heightPct);
      setThumb({ top: topPct, height: heightPct, visible: true });
    });
  }, [term]);

  useEffect(() => {
    if (!term) { setThumb((t) => ({ ...t, visible: false })); return; }
    recompute();
    const subs = [term.onScroll(recompute), term.onRender(recompute), term.onResize(recompute)];
    return () => {
      subs.forEach((s) => s.dispose());
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [term, recompute]);

  // Global drag handlers
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !term || drag.travelPx <= 0) return;
      const dy = e.clientY - drag.startY;
      const target = drag.startViewport + (dy / drag.travelPx) * drag.baseY;
      term.scrollToLine(Math.max(0, Math.min(drag.baseY, Math.round(target))));
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [term]);

  if (!thumb.visible || !term) return null;

  const onThumbDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const track = trackRef.current;
    if (!track) return;
    const thumbPx = (thumb.height / 100) * track.clientHeight;
    dragRef.current = {
      startY: e.clientY,
      startViewport: term.buffer.active.viewportY,
      baseY: term.buffer.active.baseY,
      travelPx: track.clientHeight - thumbPx,
    };
    document.body.style.userSelect = 'none';
  };

  const onTrackDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const frac = (e.clientY - rect.top) / rect.height;
    term.scrollToLine(Math.round(frac * term.buffer.active.baseY));
  };

  return (
    <div className="term-scrollbar" ref={trackRef} onPointerDown={onTrackDown}>
      <div
        className="term-scrollbar-thumb"
        style={{ top: `${thumb.top}%`, height: `${thumb.height}%` }}
        onPointerDown={onThumbDown}
      />
    </div>
  );
}
