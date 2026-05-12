import { useCallback, useEffect, useState } from "react";

export function useDebouncedQuery(delayMs = 300) {
  const [query, setQueryState] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query);
    }, delayMs);

    return () => clearTimeout(timeout);
  }, [delayMs, query]);

  const setQuery = useCallback((nextQuery: string) => {
    setQueryState(nextQuery);
    if (nextQuery.length === 0) {
      setDebouncedQuery("");
    }
  }, []);

  const clearQuery = useCallback(() => {
    setQueryState("");
    setDebouncedQuery("");
  }, []);

  return { query, debouncedQuery, setQuery, clearQuery };
}
