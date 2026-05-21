import { useState, useRef, useEffect } from "react";
import "./MultiSelectFilter.css";

export interface MultiSelectFilterProps {
  readonly value: readonly string[];
  readonly onChange: (values: string[]) => void;
  readonly allOptions: readonly string[];
  readonly ariaLabel: string;
}

export function MultiSelectFilter({
  value,
  onChange,
  allOptions,
  ariaLabel,
}: MultiSelectFilterProps) {
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
    <div ref={containerRef} className="msf-wrapper">
      <div className="msf-input-row">
        <input
          type="text"
          className="msf-input"
          value={summary}
          readOnly
          onClick={openDropdown}
          onFocus={openDropdown}
          placeholder="Filter…"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
        />
        {value.length > 0 && (
          <button
            type="button"
            className="msf-clear-btn"
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
        <div className="msf-dropdown" role="listbox" aria-multiselectable>
          <div className="msf-dropdown-body">
            <input
              ref={searchRef}
              type="text"
              className="msf-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search options…"
              aria-label={`Search ${ariaLabel} options`}
            />
            {visibleOptions.length === 0 && <div className="msf-no-options">No options</div>}
            {visibleOptions.map((opt) => (
              <label key={opt} className="msf-option">
                <input
                  type="checkbox"
                  checked={value.includes(opt)}
                  onChange={() => toggleOption(opt)}
                  aria-label={opt}
                />
                {opt}
              </label>
            ))}
          </div>
          <div className="msf-actions">
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
