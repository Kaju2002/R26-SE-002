'use client';

import { createContext, useContext, type ReactNode } from 'react';

const InchatBasePathContext = createContext('/recruiter');

export function InchatBasePathProvider({
  basePath,
  children,
}: {
  basePath: string;
  children: ReactNode;
}) {
  return (
    <InchatBasePathContext.Provider value={basePath}>
      {children}
    </InchatBasePathContext.Provider>
  );
}

export function useInchatBasePath(): string {
  return useContext(InchatBasePathContext);
}
