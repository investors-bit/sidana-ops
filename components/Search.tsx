'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Hit = {
  kind: 'startup' | 'investor';
  id: number;
  name: string;
  meta: string;
};

const CHIPS = ['Spintly', 'Bon Cuisine', 'Appli', 'MonitorExam', 'Pixelence'];

export default function Search() {
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Debounced lookup. Runs as the signed-in user, so RLS decides what returns.
  useEffect(() => {
    const t = term.trim();
    if (t.length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const like = `%${t}%`;
      const [s, i] = await Promise.all([
        supabase
          .from('startups')
          .select('id,name,sector,stage,bucket,owner_name,status')
          .or(`name.ilike.${like},sector.ilike.${like},owner_name.ilike.${like}`)
          .limit(6),
        supabase
          .from('investors')
          .select('id,name,type,status,contact_person')
          .or(`name.ilike.${like},contact_person.ilike.${like}`)
          .limit(6),
      ]);

      const rows: Hit[] = [
        ...(s.data ?? []).map((r: Record<string, string | number | null>) => ({
          kind: 'startup' as const,
          id: Number(r.id),
          name: String(r.name),
          meta: [r.sector, r.bucket ? `Bucket ${r.bucket}` : null].filter(Boolean).join(' · '),
        })),
        ...(i.data ?? []).map((r: Record<string, string | number | null>) => ({
          kind: 'investor' as const,
          id: Number(r.id),
          name: String(r.name),
          meta: [r.type, r.status].filter(Boolean).join(' · ').replace(/_/g, ' '),
        })),
      ];
      setHits(rows);
      setOpen(true);
      setCursor(-1);
    }, 180);
    return () => clearTimeout(timer);
  }, [term]);

  // Close when clicking outside.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function go(h: Hit) {
    setOpen(false);
    setTerm('');
    router.push(`/${h.kind}/${h.id}`);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => (hits.length ? (c + 1) % hits.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => (hits.length ? (c - 1 + hits.length) % hits.length : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (hits.length) go(hits[cursor < 0 ? 0 : cursor]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <>
      <div className="searchbox" ref={box}>
        <svg className="mag" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="6.8" cy="6.8" r="4.6" />
          <path d="M10.3 10.3L14 14" />
        </svg>
        <input
          id="search"
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => hits.length && setOpen(true)}
          placeholder="Search a startup or investor"
          autoComplete="off"
          spellCheck={false}
        />
        {open && (
          <div className="results">
            {hits.length === 0 ? (
              <div className="empty">Nothing matching &ldquo;{term}&rdquo;</div>
            ) : (
              hits.map((h, idx) => (
                <button
                  key={`${h.kind}-${h.id}`}
                  type="button"
                  className={`res${idx === cursor ? ' on' : ''}`}
                  onClick={() => go(h)}
                >
                  <span className="kind">{h.kind === 'startup' ? 'Startup' : 'Investor'}</span>
                  <span className="rn">{h.name}</span>
                  <span className="rm">{h.meta}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <div className="chips">
        {CHIPS.map((c) => (
          <button key={c} type="button" className="chip" onClick={() => setTerm(c)}>
            {c}
          </button>
        ))}
      </div>
    </>
  );
}
