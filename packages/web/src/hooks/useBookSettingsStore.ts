import {
  type BookSettings,
  getBookSettings,
  getBookSettingsYmap,
  setBookSecondsPerIngredient,
} from "@recipe-book/shared";
import { useEffect, useState } from "react";
import { BUILD_SECONDS_PER_INGREDIENT } from "../config.ts";
import { useRecipeBookDoc } from "../contexts/docContext.ts";

export interface BookSettingsStore {
  /** The book's per-ingredient prep time, falling back to the build default. */
  secondsPerIngredient: number;
  /** The raw book-level override, when one has been set. */
  bookSecondsPerIngredient: number | undefined;
  /** Sets (or clears, with undefined) the book-level override. */
  setSecondsPerIngredient: (seconds: number | undefined) => void;
}

export function useBookSettings(): BookSettingsStore {
  const { doc, whenSynced } = useRecipeBookDoc();
  const [settings, setSettings] = useState<BookSettings>(() => getBookSettings(doc));

  useEffect(() => {
    const map = getBookSettingsYmap(doc);
    function update() {
      setSettings(getBookSettings(doc));
    }
    map.observe(update);
    whenSynced.then(() => setSettings(getBookSettings(doc)));
    return () => map.unobserve(update);
  }, [doc, whenSynced]);

  return {
    secondsPerIngredient: settings.seconds_per_ingredient ?? BUILD_SECONDS_PER_INGREDIENT,
    bookSecondsPerIngredient: settings.seconds_per_ingredient,
    setSecondsPerIngredient: (seconds) => setBookSecondsPerIngredient(doc, seconds),
  };
}
