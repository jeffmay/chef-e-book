import type {
  ContainerItem,
  Ingredient,
  IngredientItem,
  Instruction,
  ItemState,
  Measurement,
  Recipe,
  RecipeId,
  RecipeVersion,
  Section,
  SectionItem,
  SectionItemId,
  Session,
} from "@recipe-book/shared";
import {
  DEFAULT_VERSION_DESCRIPTION,
  MeasurementUnit,
  RecipeVersionId,
  collectIngredientItems,
  collectInstructions,
  computeItemWeights,
  computeTopIngredients,
  formatFraction,
  isCompletedSession,
  minimumEstimatedSeconds,
  progressFraction,
  randomId,
  removeSectionItemsById,
  resolveEstimatedSeconds,
  resolveSecondsPerIngredient,
} from "@recipe-book/shared";
import { Accordion, AccordionTab } from "primereact/accordion";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { ReadonlyDeep } from "type-fest";
import { DurationEditor } from "../components/duration/DurationEditor.tsx";
import { humanizeSeconds } from "../components/duration/humanizeSeconds.ts";
import { COMMON_CONTAINERS } from "../components/recipe_editor/containers.ts";
import { RecipeVersionEditor } from "../components/recipe_editor/RecipeVersionEditor.tsx";
import { useBookSettings } from "../hooks/useBookSettingsStore.ts";
import { useIngredientStore } from "../hooks/useIngredientStore.ts";
import { useRecipeStore } from "../hooks/useRecipeStore.ts";
import { useSessionStore } from "../hooks/useSessionStore.ts";
import "./RecipeSessionPage.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type HeadingLevel = "h2" | "h3" | "h4" | "h5" | "h6";

function headingForDepth(depth: number): HeadingLevel {
  const levels: HeadingLevel[] = ["h2", "h3", "h4", "h5", "h6"];
  return levels[Math.min(depth - 1, levels.length - 1)] ?? "h6";
}

function formatAmount(amount: Measurement): string {
  return `${formatFraction(amount.value)} ${MeasurementUnit.display[amount.unit]}`;
}

function ingredientName(
  item: ReadonlyDeep<IngredientItem>,
  allIngredients: readonly Ingredient[],
): string {
  return allIngredients.find((i) => i.id === item.ingredient_id)?.name ?? item.ingredient_id;
}

function ingredientAmount(
  item: ReadonlyDeep<IngredientItem>,
  allIngredients: readonly Ingredient[],
): Measurement | undefined {
  return (
    item.customAmount ??
    allIngredients.find((i) => i.id === item.ingredient_id)?.default_measurement_value
  );
}

function instructionLabel(item: ReadonlyDeep<Instruction>): string {
  return item.instruction.trim() !== "" ? item.instruction : "Instruction";
}

function itemState(session: Session, itemId: string): ItemState {
  return session.item_states[itemId] ?? { checked: false };
}

function isDone(state: ItemState): boolean {
  return state.checked || state.skipped === true;
}

// ---------------------------------------------------------------------------
// CheckableRow — checkbox + label + optional detail + skip toggle
// ---------------------------------------------------------------------------

type CheckableRowProps = ReadonlyDeep<{
  label: string;
  detail?: string;
  state: ItemState;
  onCheckedChange: (checked: boolean) => void;
  onSkippedChange: (skipped: boolean) => void;
}>;

function CheckableRow({
  label,
  detail,
  state,
  onCheckedChange,
  onSkippedChange,
}: CheckableRowProps) {
  const skipped = state.skipped === true;
  return (
    <div className={`rs-item${skipped ? " rs-item--skipped" : ""}`} role="group" aria-label={label}>
      <label className="rs-item-check">
        <input
          type="checkbox"
          checked={state.checked}
          disabled={skipped}
          onChange={(e) => onCheckedChange(e.target.checked)}
          aria-label={`Mark ${label} done`}
        />
        <span className="rs-item-label">{label}</span>
      </label>
      {detail !== undefined && <span className="rs-item-detail">{detail}</span>}
      {skipped && <span className="rs-item-skipped-tag">skipped</span>}
      <button
        type="button"
        className="rs-skip-btn"
        disabled={state.checked}
        onClick={() => onSkippedChange(!skipped)}
        aria-label={skipped ? `Unskip ${label}` : `Skip ${label}`}
      >
        {skipped ? "Unskip" : "Skip"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session item tree (run view)
// ---------------------------------------------------------------------------

type SessionItemsProps = {
  readonly session: Session;
  readonly allIngredients: readonly Ingredient[];
  readonly onItemChange: (itemId: string, patch: Partial<ItemState>) => void;
};

type SessionSectionProps = SessionItemsProps & {
  readonly section: Section;
  readonly depth: number;
};

function SessionIngredientRow({
  item,
  session,
  allIngredients,
  onItemChange,
}: SessionItemsProps & { readonly item: IngredientItem }) {
  const amount = ingredientAmount(item, allIngredients);
  return (
    <CheckableRow
      label={ingredientName(item, allIngredients)}
      {...(amount !== undefined && { detail: formatAmount(amount) })}
      state={itemState(session, item.id)}
      onCheckedChange={(checked) => onItemChange(item.id, { checked })}
      onSkippedChange={(skipped) => onItemChange(item.id, { skipped })}
    />
  );
}

function SessionContainerGroup({
  item,
  ...rest
}: SessionItemsProps & { readonly item: ContainerItem }) {
  const containerName =
    COMMON_CONTAINERS.find((c) => c.id === item.container_id)?.name ?? item.container_id;
  const title = item.descriptor !== "" ? `${containerName} — ${item.descriptor}` : containerName;
  return (
    <div className="rs-container" role="group" aria-label={`Container: ${title}`}>
      <p className="rs-container-title">{title}</p>
      <div className="rs-container-contents">
        {item.contents.map((content) => (
          <SessionIngredientRow key={content.id} item={content} {...rest} />
        ))}
      </div>
    </div>
  );
}

function SessionInstructionRow({
  item,
  session,
  onItemChange,
}: Omit<SessionItemsProps, "allIngredients"> & { readonly item: Instruction }) {
  return (
    <CheckableRow
      label={instructionLabel(item)}
      {...(item.duration_seconds !== undefined && {
        detail: humanizeSeconds(item.duration_seconds),
      })}
      state={itemState(session, item.id)}
      onCheckedChange={(checked) => onItemChange(item.id, { checked })}
      onSkippedChange={(skipped) => onItemChange(item.id, { skipped })}
    />
  );
}

function SessionSection({ section, depth, ...rest }: SessionSectionProps) {
  const Heading = headingForDepth(depth);
  return (
    <div className="rs-section" role="group" aria-label={`Section: ${section.header ?? "unnamed"}`}>
      {section.header !== undefined && (
        <Heading className="rs-section-header">{section.header}</Heading>
      )}
      {section.contents.map((item: SectionItem) => {
        if (item.kind === "ingredient") {
          return <SessionIngredientRow key={item.id} item={item} {...rest} />;
        }
        if (item.kind === "container") {
          return <SessionContainerGroup key={item.id} item={item} {...rest} />;
        }
        if (item.kind === "instruction") {
          return (
            <SessionInstructionRow
              key={item.id}
              item={item}
              session={rest.session}
              onItemChange={rest.onItemChange}
            />
          );
        }
        if (item.kind === "text_block") {
          return (
            <p key={item.id} className="rs-text-block">
              {item.text}
            </p>
          );
        }
        return <SessionSection key={item.id} section={item} depth={depth + 1} {...rest} />;
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionRunView — checkboxes, skip buttons, progress bar, complete button
// ---------------------------------------------------------------------------

type SessionRunViewProps = {
  readonly session: Session;
  readonly recipe: Recipe;
  readonly version: RecipeVersion;
};

function SessionRunView({ session, recipe, version }: SessionRunViewProps) {
  const { updateItemState, complete } = useSessionStore();
  const { ingredients } = useIngredientStore();
  const { secondsPerIngredient: bookSecondsPerIngredient } = useBookSettings();

  const secondsPerIngredient = resolveSecondsPerIngredient(version, bookSecondsPerIngredient);
  const totalSeconds = resolveEstimatedSeconds(version, secondsPerIngredient);
  const weights = useMemo(
    () => computeItemWeights(version, totalSeconds, secondsPerIngredient),
    [version, totalSeconds, secondsPerIngredient],
  );

  const doneIds = new Set(
    Object.entries(session.item_states)
      .filter(([, state]) => isDone(state))
      .map(([id]) => id),
  );
  const fraction = progressFraction(weights, doneIds);
  const percent = Math.round(fraction * 100);
  const remainingSeconds = Math.max(0, Math.round(totalSeconds * (1 - fraction)));

  return (
    <main className="rs-page" aria-label="Recipe session">
      <div className="rs-header">
        <h1 className="rs-title">{recipe.title}</h1>
        <p className="rs-version-desc">{version.description}</p>
      </div>

      <div
        className="rs-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Session progress"
      >
        <div className="rs-progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="rs-progress-text">
        {percent}% complete — about {humanizeSeconds(remainingSeconds)} left
      </p>

      <div className="rs-items">
        {version.sections.map((section) => (
          <SessionSection
            key={section.id}
            section={section}
            depth={1}
            session={session}
            allIngredients={ingredients}
            onItemChange={(itemId, patch) => updateItemState(session.id, itemId, patch)}
          />
        ))}
      </div>

      <div className="rs-complete-row">
        <button
          type="button"
          className="rs-complete-btn"
          onClick={() => complete(session.id, [...weights.keys()])}
          aria-label="Complete session"
        >
          ✔︎ Complete
        </button>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// SessionSummaryView — post-completion review + version/recipe creation
// ---------------------------------------------------------------------------

type SessionSummaryViewProps = {
  readonly session: Session & { status: "completed"; completed_at: number };
  readonly recipe: Recipe;
  readonly version: RecipeVersion;
};

function SessionSummaryView({ session, recipe, version }: SessionSummaryViewProps) {
  const navigate = useNavigate();
  const { save, create } = useRecipeStore();
  const { secondsPerIngredient: bookSecondsPerIngredient } = useBookSettings();

  const [sections, setSections] = useState<ReadonlyDeep<Section[]>>(() => version.sections);
  // Items the session skipped stay in the editor decorated as skipped; they
  // are removed from any saved version unless restored.
  const [skippedIds, setSkippedIds] = useState<ReadonlySet<SectionItemId>>(() => {
    const checkables = [
      ...collectIngredientItems(version.sections),
      ...collectInstructions(version.sections),
    ];
    return new Set(
      checkables
        .filter((item) => itemState(session, item.id).skipped === true)
        .map((item) => item.id),
    );
  });
  const [secondsPerIngredient, setSecondsPerIngredient] = useState(() =>
    resolveSecondsPerIngredient(version, bookSecondsPerIngredient),
  );
  const [estimatedSeconds, setEstimatedSeconds] = useState(() =>
    resolveEstimatedSeconds(
      version,
      resolveSecondsPerIngredient(version, bookSecondsPerIngredient),
    ),
  );
  const [versionSummary, setVersionSummary] = useState("");
  const [newRecipeName, setNewRecipeName] = useState(recipe.title);

  // Skipped items are dropped from the saved version unless restored.
  const finalSections = useMemo(
    () => removeSectionItemsById(sections, skippedIds),
    [sections, skippedIds],
  );
  const minSeconds = minimumEstimatedSeconds(
    { ...version, sections: finalSections },
    secondsPerIngredient,
  );
  const effectiveEstimatedSeconds = Math.max(minSeconds, estimatedSeconds);

  const actualSeconds = Math.max(0, Math.round((session.completed_at - session.started_at) / 1000));
  const maxSeconds = Math.max(minSeconds * 3, actualSeconds, minSeconds + 3600);

  const versionSummaryError =
    versionSummary.trim() === "" ? "A version summary is required to create a new version" : null;
  const newRecipeNameError =
    newRecipeName.trim() === ""
      ? "A recipe name is required"
      : newRecipeName.trim() === recipe.title.trim()
        ? "Choose a name different from the current recipe"
        : null;

  function restoreItem(id: SectionItemId) {
    setSkippedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function dismissItem(id: SectionItemId) {
    setSections((prev) => removeSectionItemsById(prev, new Set([id])));
    restoreItem(id);
  }

  function buildVersion(recipeId: RecipeId, description: string): ReadonlyDeep<RecipeVersion> {
    return {
      id: randomId(RecipeVersionId),
      recipe_id: recipeId,
      description,
      ingredients: computeTopIngredients(finalSections),
      sections: finalSections,
      estimated_time_seconds: effectiveEstimatedSeconds,
      seconds_per_ingredient: secondsPerIngredient,
      created_at: Date.now(),
    };
  }

  function handleCreateVersion() {
    save(recipe.id, {
      title: recipe.title,
      ...(recipe.subtitle !== undefined && { subtitle: recipe.subtitle }),
      ...(recipe.source_url !== undefined && { source_url: recipe.source_url }),
      ...(recipe.parent_folder_id !== undefined && { parent_folder_id: recipe.parent_folder_id }),
      version: buildVersion(recipe.id, versionSummary.trim()),
      create_new_version: true,
    });
    navigate(`/recipes/${recipe.id}`);
  }

  function handleCreateRecipe() {
    const created = create({
      title: newRecipeName.trim(),
      ...(recipe.parent_folder_id !== undefined && { parent_folder_id: recipe.parent_folder_id }),
    });
    save(created.id, {
      title: created.title,
      version: buildVersion(created.id, DEFAULT_VERSION_DESCRIPTION),
      create_new_version: false,
    });
    navigate(`/recipes/${created.id}`);
  }

  return (
    <main className="rs-page rs-page--summary" aria-label="Session summary">
      <div className="rs-header">
        <h1 className="rs-title">{recipe.title}</h1>
        <p className="rs-version-desc">{version.description}</p>
      </div>

      <section className="rs-summary-block" aria-label="Session result">
        <h2 className="rs-summary-heading">Session complete</h2>
        <p className="rs-summary-total-time">Total time: {humanizeSeconds(actualSeconds)}</p>
      </section>

      {/* Full version editor — skipped items are decorated in place and are
          removed from any saved version unless restored. */}
      <RecipeVersionEditor
        sections={sections}
        onChange={setSections}
        skippedIds={skippedIds}
        onRestoreItem={restoreItem}
        onDismissItem={dismissItem}
      />

      <section className="rs-summary-block" aria-label="Time estimates">
        <h2 className="rs-summary-heading">Time estimates</h2>

        <div className="rs-field-label rs-time-per-ingredient">
          <span className="rs-time-per-ingredient-label">Time per ingredient</span>
          <span className="rs-field-separator" aria-hidden="true" />
          <DurationEditor value={secondsPerIngredient} onCommit={setSecondsPerIngredient} />
        </div>

        <label className="rs-field-label" htmlFor="rs-estimated-time-slider">
          Estimated total time: {humanizeSeconds(effectiveEstimatedSeconds)}
          <input
            id="rs-estimated-time-slider"
            className="rs-estimated-slider"
            type="range"
            min={minSeconds}
            max={maxSeconds}
            step={30}
            value={effectiveEstimatedSeconds}
            onChange={(e) => setEstimatedSeconds(Math.max(minSeconds, Number(e.target.value)))}
            aria-label="Estimated total time"
          />
        </label>
        <p className="rs-summary-hint">Minimum: {humanizeSeconds(minSeconds)}</p>
      </section>

      <section className="rs-summary-block" aria-label="Save session results">
        <h2 className="rs-summary-heading">Save as</h2>

        {/* PrimeReact CSSTransition is disabled (transitionOptions.disabled) —
            e-ink screens never animate. */}
        <Accordion className="rs-save-accordion" transitionOptions={{ timeout: 0, disabled: true }}>
          <AccordionTab header="Create a new version">
            <label className="rs-field-label" htmlFor="rs-version-summary">
              Version summary
              <span className="field-required" aria-hidden="true">
                *
              </span>
              <input
                id="rs-version-summary"
                className={`rs-field-input${versionSummaryError !== null ? " field-input--error" : ""}`}
                value={versionSummary}
                onChange={(e) => setVersionSummary(e.target.value)}
                aria-label="Version summary"
                required
              />
              {versionSummaryError !== null && (
                <span className="field-error" role="alert">
                  {versionSummaryError}
                </span>
              )}
            </label>
            <button
              type="button"
              className="rs-summary-btn"
              onClick={handleCreateVersion}
              disabled={versionSummaryError !== null}
            >
              ✔︎ Create a new version
            </button>
          </AccordionTab>

          <AccordionTab header="Create a new recipe">
            <label className="rs-field-label" htmlFor="rs-new-recipe-name">
              New recipe name
              <span className="field-required" aria-hidden="true">
                *
              </span>
              <input
                id="rs-new-recipe-name"
                className={`rs-field-input${newRecipeNameError !== null ? " field-input--error" : ""}`}
                value={newRecipeName}
                onChange={(e) => setNewRecipeName(e.target.value)}
                aria-label="New recipe name"
                required
              />
              {newRecipeNameError !== null && (
                <span className="field-error" role="alert">
                  {newRecipeNameError}
                </span>
              )}
            </label>
            <button
              type="button"
              className="rs-summary-btn"
              onClick={handleCreateRecipe}
              disabled={newRecipeNameError !== null}
            >
              ✔︎ Create a new recipe
            </button>
          </AccordionTab>

          <AccordionTab header="Discard recipe version" className="rs-discard-tab">
            <p className="rs-discard-warning">⚠ You will lose all changes to the recipe</p>
            <button type="button" className="rs-summary-btn" onClick={() => navigate("/recipes")}>
              Continue
            </button>
          </AccordionTab>
        </Accordion>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// RecipeSessionPage
// ---------------------------------------------------------------------------

export type RecipeSessionPageProps = {
  readonly sessionId: string;
};

export function RecipeSessionPage({ sessionId }: RecipeSessionPageProps) {
  const { sessions } = useSessionStore();
  const { recipes } = useRecipeStore();

  const session = sessions.find((s) => s.id === sessionId);
  const recipe =
    session !== undefined ? (recipes.find((r) => r.id === session.recipe_id) ?? null) : null;
  const version = recipe?.versions.find((v) => v.id === session?.recipe_version_id);

  // The book doc loads asynchronously from IndexedDB, so on a hard refresh the
  // session arrives a tick after first render — render nothing identifiable as
  // an error until the stores have had a chance to load.
  if (session === undefined || recipe === null || version === undefined) {
    return (
      <main className="rs-page" aria-label="Recipe session">
        <p className="rs-not-found">Session not found.</p>
      </main>
    );
  }

  if (isCompletedSession(session)) {
    return <SessionSummaryView session={session} recipe={recipe} version={version} />;
  }
  return <SessionRunView session={session} recipe={recipe} version={version} />;
}
