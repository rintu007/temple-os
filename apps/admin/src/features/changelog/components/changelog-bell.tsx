'use client';

import { useEffect, useRef, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { cn } from '@templeos/ui';
import type { ChangelogFeed } from '@templeos/core';
import { markChangelogReadAction } from '../actions';

function timeAgo(date: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function ChangelogBell({ feed }: { feed: ChangelogFeed }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`What's new${feed.unreadCount > 0 ? ` (${feed.unreadCount} unread)` : ''}`}
        className="relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
      >
        <Megaphone className="size-[18px]" aria-hidden />
        {feed.unreadCount > 0 ? (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-medium">What's new</span>
            {feed.unreadCount > 0 ? (
              <form action={markChangelogReadAction}>
                <button type="submit" className="text-xs text-primary hover:underline">
                  Mark all read
                </button>
              </form>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {feed.items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nothing here yet — new features will be announced here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {feed.items.map((item) => (
                  <li key={item.id} className={cn('px-4 py-3', item.unread && 'bg-primary/5')}>
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          'mt-1.5 size-1.5 shrink-0 rounded-full',
                          item.unread ? 'bg-primary' : 'bg-transparent',
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{item.body}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {timeAgo(item.publishedAt)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
