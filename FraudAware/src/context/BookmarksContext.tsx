import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type BookmarksContextValue = {
  bookmarkedIds: Set<string>;
  isBookmarked: (id: string) => boolean;
  toggleBookmark: (id: string) => void;
};

const BookmarksContext = createContext<BookmarksContextValue | undefined>(
  undefined
);

export function BookmarksProvider({ children }: { children: ReactNode }) {
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const toggleBookmark = useCallback((id: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

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
