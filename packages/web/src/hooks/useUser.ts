import { useState, useCallback } from "react";

export const USER_STORAGE_KEY = "recipe_book_current_user";

export interface UseUserResult {
  readonly userName: string | null;
  readonly setUserName: (name: string) => void;
  readonly clearUser: () => void;
}

export function useUser(): UseUserResult {
  const [userName, setState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(USER_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const setUserName = useCallback((name: string) => {
    localStorage.setItem(USER_STORAGE_KEY, name);
    setState(name);
  }, []);

  const clearUser = useCallback(() => {
    localStorage.removeItem(USER_STORAGE_KEY);
    setState(null);
  }, []);

  return { userName, setUserName, clearUser };
}
