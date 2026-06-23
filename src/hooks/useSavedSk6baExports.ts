import { useCallback, useEffect, useState } from "react";
import {
  listSavedExports,
  saveExport,
  deleteExport,
  clearAllExports,
  type SavedExport,
} from "@/lib/codeplug/saved-exports";

export function useSavedSk6baExports() {
  const [items, setItems] = useState<SavedExport[]>([]);

  useEffect(() => {
    setItems(listSavedExports());
  }, []);

  const refresh = useCallback(() => setItems(listSavedExports()), []);

  const save = useCallback(
    (input: { filename: string; content: string; rowCount: number }) => {
      saveExport(input);
      refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    (id: string) => {
      deleteExport(id);
      refresh();
    },
    [refresh],
  );

  const clear = useCallback(() => {
    clearAllExports();
    setItems([]);
  }, []);

  const find = useCallback((id: string) => listSavedExports().find((e) => e.id === id), []);

  return { items, save, remove, clear, find, refresh };
}
