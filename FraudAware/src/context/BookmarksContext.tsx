import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getSavedJobs, saveJob, unsaveJob } from '../api/jobApi';
import { useUser } from './UserContext';

type BookmarksContextValue = {
  bookmarkedIds: Set<string>;
  isBookmarked: (id: string) => boolean;
  toggleBookmark: (id: string) => void;
};

const BookmarksContext = createContext<BookmarksContextValue | undefined>(
  undefined
);

export function BookmarksProvider({ children }: { children: ReactNode }) {
  const { token } = useUser();
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setBookmarkedIds(new Set());
      return;
    }

    (async () => {
      try {
        const response = await getSavedJobs(token, { limit: 50 });
        if (!cancelled) {
          setBookmarkedIds(new Set(response.savedJobIds));
        }
      } catch {
        if (!cancelled) {
          setBookmarkedIds(new Set());
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const toggleBookmark = useCallback(
    (id: string) => {
      const wasSaved = bookmarkedIds.has(id);

      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });

      if (!token) return;

      (async () => {
        try {
          if (wasSaved) {
            await unsaveJob(token, id);
          } else {
            await saveJob(token, id);
          }
        } catch {
          setBookmarkedIds((prev) => {
            const next = new Set(prev);
            if (wasSaved) {
              next.add(id);
            } else {
              next.delete(id);
            }
            return next;
          });
        }
      })();
    },
    [bookmarkedIds, token]
  );

  const isBookmarked = useCallback(
    (id: string) => bookmarkedIds.has(id),
    [bookmarkedIds]
  );

  const value = useMemo(
    () => ({
      bookmarkedIds,
      isBookmarked,
      toggleBookmark,
    }),
    [bookmarkedIds, isBookmarked, toggleBookmark]
  );

  return (
    <BookmarksContext.Provider value={value}>
      {children}
    </BookmarksContext.Provider>
  );
}

export function useBookmarks() {
  const ctx = useContext(BookmarksContext);
  if (!ctx) {
    throw new Error('useBookmarks must be used within BookmarksProvider');
  }
  return ctx;
}
