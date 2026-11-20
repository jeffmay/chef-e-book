import { useId, useState, useRef, useEffect } from "react";
import "./MultiSelectFilter.css";

export type MultiSelectFilterProps = {
  readonly value: readonly string[];
  readonly onChange: (values: string[]) => void;
  readonly allOptions: readonly string[];
  readonly ariaLabel: string;
};

export function MultiSelectFilter({
  value,
  onChange,
  allOptions,
  ariaLabel,
}: MultiSelectFilterProps) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  function openDropdown() {
    if (open) return;
    setSnapshot([...value]);
    setOpen(true);
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  function toggleOption(opt: string) {
    const next = value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt];
    onChange(next);
  }

  function handleAccept() {
    setOpen(false);
    setSearch("");
  }

  function handleRevert() {
    onChange(snapshot);
    setOpen(false);
    setSearch("");
  }

  useEffect(() => {
    if (!open) return;
    function onMousedown(e: MouseEvent) {
      if (
        containerRef.current instanceof Node &&
        !containerRef.current.contains(e.target instanceof Node ? e.target : null)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onMousedown);
    return () => document.removeEventListener("mousedown", onMousedown);
  }, [open]);

  const visibleOptions =
    search === ""
      ? allOptions
      : allOptions.filter((o) => o.toLowerCase().includes(search.toLowerCase()));

  const summary =
    value.length === 0 ? "" : value.length === 1 ? value[0]! : `${value.length} selected`;

  return (
    <div ref={containerRef} className="multi-select-filter-wrapper">
      <div className="multi-select-filter-input-row">
        <input
          type="text"
          className="multi-select-filter-input"
          value={summary}
          readOnly
          onClick={openDropdown}
          onFocus={openDropdown}
          placeholder="Filter…"
          id={`${uid}-filter`}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
        />
        {value.length > 0 && (
          <button
            type="button"
            className="multi-select-filter-clear-btn"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            aria-label={`Clear ${ariaLabel}`}
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div className="multi-select-filter-dropdown" role="listbox" aria-multiselectable>
          <div className="multi-select-filter-dropdown-body">
            <input
              ref={searchRef}
              type="text"
              className="multi-select-filter-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search options…"
              id={`${uid}-search`}
              aria-label={`Search ${ariaLabel} options`}
            />
            {visibleOptions.length === 0 && (
              <div className="multi-select-filter-no-options">No options</div>
            )}
            {visibleOptions.map((opt) => (
              <label key={opt} className="multi-select-filter-option">
                <input
                  type="checkbox"
                  checked={value.includes(opt)}
                  onChange={() => toggleOption(opt)}
                  id={`${uid}-option-${visibleOptions.indexOf(opt)}`}
                  aria-label={opt}
                />
                {opt}
              </label>
            ))}
          </div>
          <div className="multi-select-filter-actions">
            <button type="button" onClick={handleRevert} aria-label="Revert filter">
              ↩
            </button>
            <button type="button" onClick={handleAccept} aria-label="Accept filter">
              ✔︎
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
