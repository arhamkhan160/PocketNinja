import useFetch from "./useFetch";
import { getCategories } from "../api/finance";

/**
 * Three pages need the category list (dropdowns + name lookup). Always
 * returns an array so callers never guard on null.
 */
export default function useCategories() {
  const { data, isLoading, error, reload } = useFetch(getCategories, []);
  return { categories: data || [], isLoading, error, reload };
}
