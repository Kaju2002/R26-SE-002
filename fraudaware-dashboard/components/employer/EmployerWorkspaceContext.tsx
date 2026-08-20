'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthUser } from '@/lib/api/authTypes';
import {
  listEmployerWorkspaces,
  type EmployerWorkspace,
} from '@/lib/api/jobApi';

type EmployerWorkspaceContextValue = {
  workspaces: EmployerWorkspace[];
  activeWorkspace: EmployerWorkspace | null;
  setActiveWorkspace: (workspace: EmployerWorkspace) => void;
  loading: boolean;
  error: string | null;
};

const EmployerWorkspaceContext = createContext<EmployerWorkspaceContextValue | null>(null);

function storageKey(userId: string): string {
  return `fa_employer_workspace:${userId}`;
}

export function EmployerWorkspaceProvider({
  user,
  token,
  children,
}: {
  user: AuthUser;
  token: string;
  children: ReactNode;
}) {
  const [workspaces, setWorkspaces] = useState<EmployerWorkspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<EmployerWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      setWorkspaces([]);
      setActiveWorkspaceState(null);
    });

    listEmployerWorkspaces(token)
      .then((items) => {
        if (cancelled) return;
        const activeItems = items.filter((workspace) => workspace.status === 'active');
        setWorkspaces(activeItems);

        const home = activeItems[0] ?? null;
        setActiveWorkspaceState(home);

        try {
          if (home) localStorage.setItem(storageKey(user.id), home.id);
          else localStorage.removeItem(storageKey(user.id));
        } catch {
          // The in-memory selection remains usable.
        }
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Could not load employer workspaces.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, user]);

  const setActiveWorkspace = useCallback(
    (workspace: EmployerWorkspace) => {
      if (!workspaces.some((entry) => entry.id === workspace.id)) return;
      setActiveWorkspaceState(workspace);
      try {
        localStorage.setItem(storageKey(user.id), workspace.id);
      } catch {
        // The in-memory selection remains usable.
      }
    },
    [user.id, workspaces]
  );

  const value = useMemo(
    () => ({ workspaces, activeWorkspace, setActiveWorkspace, loading, error }),
    [workspaces, activeWorkspace, setActiveWorkspace, loading, error]
  );

  return (
    <EmployerWorkspaceContext.Provider value={value}>
      {children}
    </EmployerWorkspaceContext.Provider>
  );
}

export function useEmployerWorkspace(): EmployerWorkspaceContextValue {
  const context = useContext(EmployerWorkspaceContext);
  if (!context) {
    throw new Error('useEmployerWorkspace must be used within EmployerWorkspaceProvider');
  }
  return context;
}
