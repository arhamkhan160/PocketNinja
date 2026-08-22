import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../utils/format";

/**
 * One fetch plus its three states. Replaces the useState/useEffect/catch
 * triplet every list page would otherwise repeat.
 *
 *   const { data, isLoading, error, reload } = useFetch(fetchFn, [deps]);
 */
export default function useFetch(fetcher, deps = []) {
  const [state, setState] = useState({
    data: null,
    isLoading: true,
    error: null,
  });
  const latestRequest = useRef(0);

  const reload = useCallback(() => {
    const requestId = ++latestRequest.current;
    setState((s) => ({ ...s, isLoading: true, error: null }));

    Promise.resolve()
      .then(fetcher)
      .then((data) => {
        // Ignore a slow response a newer filter change already superseded.
        if (requestId === latestRequest.current) {
          setState({ data, isLoading: false, error: null });
        }
      })
      .catch((err) => {
        if (requestId === latestRequest.current) {
          setState({ data: null, isLoading: false, error: errorMessage(err) });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
