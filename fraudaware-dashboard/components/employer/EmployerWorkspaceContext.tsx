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
  refreshWorkspaces: () => Promise<void>;
  loading: boolean;
  error: string | null;
};

const EmployerWorkspaceContext = createContext<EmployerWorkspaceContextValue | null>(null);

function storageKey(userId: string): string {
  return `fa_employer_workspace:${userId}`;
}

function withCompanyLogoFallback(
  workspace: EmployerWorkspace,
  companyLogo?: string | null
): EmployerWorkspace {
  if (!companyLogo || workspace.logo === companyLogo) return workspace;
  if (workspace.logo) return workspace;
  return { ...workspace, logo: companyLogo };
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

  const companyLogo = user.company?.logo || null;

  const applyWorkspaces = useCallback(
    (items: EmployerWorkspace[], logo: string | null) => {
      const activeItems = items
        .filter((workspace) => workspace.status === 'active')
        .map((workspace) => withCompanyLogoFallback(workspace, logo));

      setWorkspaces(activeItems);

      const home = activeItems[0] ?? null;
      setActiveWorkspaceState(home);

      try {
        if (home) localStorage.setItem(storageKey(user.id), home.id);
        else localStorage.removeItem(storageKey(user.id));
      } catch {
        // The in-memory selection remains usable.
      }
    },
    [user.id]
  );

  const refreshWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listEmployerWorkspaces(token);
      applyWorkspaces(items, companyLogo);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not load employer workspaces.'
      );
    } finally {
      setLoading(false);
    }
  }, [applyWorkspaces, companyLogo, token]);

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
        applyWorkspaces(items, companyLogo);
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
    // Reload when auth identity changes; logo overlays are handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- companyLogo applied via dedicated effect
  }, [applyWorkspaces, token, user.id]);

  // Keep sidebar branding live when profile logo updates without a full remount.
  useEffect(() => {
    if (!companyLogo) return;
    setWorkspaces((prev) =>
      prev.map((workspace) => withCompanyLogoFallback(workspace, companyLogo))
    );
    setActiveWorkspaceState((prev) =>
      prev ? withCompanyLogoFallback(prev, companyLogo) : prev
    );
  }, [companyLogo]);

  const setActiveWorkspace = useCallback(
    (workspace: EmployerWorkspace) => {
      if (!workspaces.some((entry) => entry.id === workspace.id)) return;
      setActiveWorkspaceState(withCompanyLogoFallback(workspace, companyLogo));
      try {
        localStorage.setItem(storageKey(user.id), workspace.id);
      } catch {
        // The in-memory selection remains usable.
      }
    },
    [companyLogo, user.id, workspaces]
  );

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspace,
      setActiveWorkspace,
      refreshWorkspaces,
      loading,
      error,
    }),
    [workspaces, activeWorkspace, setActiveWorkspace, refreshWorkspaces, loading, error]
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
