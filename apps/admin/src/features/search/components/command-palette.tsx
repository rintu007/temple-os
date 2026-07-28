'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { globalSearchAction, type SearchResultGroup } from '../actions';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setGroups([]);
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setGroups([]);
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const result = await globalSearchAction(query);
        setGroups(result);
        setActiveIndex(0);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function navigateTo(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onInputKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const item = flatItems[activeIndex];
      if (item) navigateTo(item.href);
    }
  }

  let renderedIndex = -1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/70"
      >
        <Search className="size-4" aria-hidden />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[12vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Search devotees, donations, expenses, vendors…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2">
              {query.trim().length < 2 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Type at least 2 characters to search.
                </p>
              ) : isPending && groups.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">Searching…</p>
              ) : groups.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">No results.</p>
              ) : (
                groups.map((group) => (
                  <div key={group.category} className="mb-2 last:mb-0">
                    <div className="px-2 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
                      {group.category}
                    </div>
                    {group.items.map((item) => {
                      renderedIndex += 1;
                      const isActive = renderedIndex === activeIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => navigateTo(item.href)}
                          onMouseEnter={() => setActiveIndex(renderedIndex)}
                          className={`flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-left text-sm ${
                            isActive ? 'bg-accent text-accent-foreground' : ''
                          }`}
                        >
                          <span className="min-w-0 truncate font-medium">{item.label}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {item.sublabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
