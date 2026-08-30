import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { SearchResults } from '@/types';

export type SearchType = 'all' | 'people' | 'posts' | 'groups';

export interface TrendingTag {
  tag: string;
  count: number;
}

export const searchKeys = {
  query: (term: string, type: SearchType) => ['search', type, term] as const,
  trending: ['search', 'trending'] as const,
};

/** Debounces a fast-changing value so we don't fire a request per keystroke. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useSearch(term: string, type: SearchType = 'all') {
  const debounced = useDebouncedValue(term.trim(), 300);

  return useQuery({
    queryKey: searchKeys.query(debounced, type),
    enabled: debounced.length > 0,
    queryFn: async () => {
      const response = await api.get<SearchResults>('/search', { params: { q: debounced, type } });
      return response.data;
    },
    // Keeps the previous results on screen while the next query loads.
    placeholderData: (previous) => previous,
  });
}

/** Hashtags used most in the last 24 hours — a plain count, never personalised. */
export function useTrending() {
  return useQuery({
    queryKey: searchKeys.trending,
    queryFn: async () => {
      const response = await api.get<{ items: TrendingTag[]; windowHours: number }>('/search/trending');
      return response.data;
    },
    staleTime: 5 * 60_000,
  });
}

const RECENT_KEY = 'orbit-recent-searches';

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>(readRecent);

  const persist = (next: string[]) => {
    setRecent(next);
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* storage is unavailable in some private-browsing modes */
    }
  };

  const addRecent = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    persist([clean, ...readRecent().filter((item) => item !== clean)].slice(0, 8));
  };

  const removeRecent = (term: string) => persist(readRecent().filter((item) => item !== term));
  const clearRecent = () => persist([]);

  return { recent, addRecent, removeRecent, clearRecent };
}
