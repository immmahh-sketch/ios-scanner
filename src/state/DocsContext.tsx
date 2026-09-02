import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { ScanDoc } from '../types';
import { deleteDoc, listDocs } from '../lib/storage';

interface DocsContextValue {
  docs: ScanDoc[];
  loading: boolean;
  refresh: () => Promise<void>;
  /** Insert or replace a document in the in-memory list (after a mutation). */
  putDoc: (doc: ScanDoc) => void;
  removeDoc: (id: string) => Promise<void>;
  getDoc: (id: string) => ScanDoc | undefined;
}

const DocsContext = createContext<DocsContextValue | null>(null);

export function DocsProvider({ children }: { children: React.ReactNode }) {
  const [docs, setDocs] = useState<ScanDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDocs(await listDocs());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const putDoc = useCallback((doc: ScanDoc) => {
    setDocs((prev) => {
      const next = prev.filter((d) => d.id !== doc.id);
      next.unshift(doc);
      return next.sort((a, b) => b.updatedAt - a.updatedAt);
    });
  }, []);

  const removeDoc = useCallback(async (id: string) => {
    await deleteDoc(id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const getDoc = useCallback((id: string) => docs.find((d) => d.id === id), [docs]);

  const value = useMemo(
    () => ({ docs, loading, refresh, putDoc, removeDoc, getDoc }),
    [docs, loading, refresh, putDoc, removeDoc, getDoc],
  );

  return <DocsContext.Provider value={value}>{children}</DocsContext.Provider>;
}

export function useDocs(): DocsContextValue {
  const ctx = useContext(DocsContext);
  if (!ctx) throw new Error('useDocs must be used inside <DocsProvider>');
  return ctx;
}
