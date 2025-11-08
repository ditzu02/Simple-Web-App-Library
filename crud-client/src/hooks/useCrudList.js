import { useCallback, useEffect, useState } from "react";

const defaultParser = (response) =>
  Array.isArray(response) ? response : response?.items ?? [];

export function useCrudList(
  fetchFn,
  { auto = true, parser = defaultParser, initialParams = {} } = {}
) {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [params, setParamsState] = useState(() => ({ ...initialParams }));

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFn(params);
      const parsed = parser(data);
      if (data && !Array.isArray(data)) {
        const itemsLength = Array.isArray(data.items)
          ? data.items.length
          : parsed.length;
        const total = data.total ?? itemsLength;
        const limitValue = Math.max(
          1,
          data.limit ?? params.limit ?? (itemsLength || 1)
        );
        const offsetValue = Math.max(0, data.offset ?? params.offset ?? 0);
        const hasMore =
          typeof data.has_more === "boolean"
            ? data.has_more
            : offsetValue + limitValue < total;

        if (parsed.length === 0 && total > 0 && offsetValue >= total) {
          const pages = Math.max(1, Math.ceil(total / limitValue));
          const newOffset = Math.max(0, (pages - 1) * limitValue);
          if (newOffset !== offsetValue) {
            setParamsState((prev) => ({ ...prev, offset: newOffset }));
            return;
          }
        }

        setItems(parsed);
        setMeta({
          total,
          limit: limitValue,
          offset: offsetValue,
          has_more: hasMore
        });
      } else {
        setItems(parsed);
        setMeta(null);
      }
    } catch (err) {
      console.error("Failed to load data", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [fetchFn, parser, params]);

  useEffect(() => {
    if (auto) refresh();
  }, [auto, refresh]);

  const setParams = useCallback((updates) => {
    setParamsState((prev) => ({ ...prev, ...updates }));
  }, []);

  const replaceParams = useCallback((next) => {
    setParamsState({ ...next });
  }, []);

  return {
    items,
    meta,
    loading,
    error,
    refresh,
    params,
    setParams,
    replaceParams,
    setItems,
  };
}

export function getErrorMessage(err, fallback = "Something went wrong") {
  if (!err) return fallback;
  if (err.response?.data?.error) return err.response.data.error;
  if (typeof err.message === "string" && err.message.trim()) return err.message;
  return fallback;
}
