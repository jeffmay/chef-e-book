import type { ReadonlyDeep } from "type-fest";
import type { ExportSource } from "../export/buildExport.ts";
import { collectContainerIds, collectIngredientIds } from "../export/buildExport.ts";
import type { RecipeBookExport } from "../export/recipeBookExport.ts";
import { buildNameIndex, findNameClash } from "../names/nameIndex.ts";
import { ingredientNameKey, labelNameKey } from "../names/nameKey.ts";
import { randomId } from "../types/ids.ts";
import {
  type Container,
  ContainerId,
  type Ingredient,
  IngredientId,
  type KitchenwareKind,
  type KitchenwareLabel,
  KitchenwareLabelId,
} from "../types/kitchenware.ts";
import { type Recipe, RecipeId, type RecipeVersion, RecipeVersionId } from "../types/recipe.ts";
import type { Measurement } from "../types/measurement.ts";
import { type RecipeFolder, RecipeFolderId } from "../types/recipeGroup.ts";
import { remapVersionReferences } from "../types/sections.ts";

export type RecipeMatchAction = "merge_version" | "keep_both" | "skip";
export type FolderMode = "retain" | "flatten";

export type ImportOptions = ReadonlyDeep<{
  /** The folder imported recipes go under; `undefined` is the top level. */
  target_folder_id?: RecipeFolderId;
  /** Import into a folder of this name under the target (reused if it already exists, else created). */
  new_folder_name?: string;
  /** `retain` recreates the file's folder tree under the destination; `flatten` puts every recipe straight in it. */
  folder_mode: FolderMode;
  /** What to do with a recipe that matches one already in the book, unless overridden below. */
  on_match: RecipeMatchAction;
  /** Per-recipe overrides of `on_match`, keyed by the recipe's id in the file. */
  recipe_actions?: Record<string, RecipeMatchAction>;
  /**
   * Replace the name, labels, and parent (and an ingredient's default amount) of ingredients and
   * containers the book already has with the file's versions. Off by default: otherwise the book's
   * own kitchenware is left untouched.
   */
  overwrite_kitchenware?: boolean;
  /** Where the data came from; goes into the description of a version added to an existing recipe. */
  source_label: string;
  /** Epoch milliseconds. */
  now: number;
}>;

export type ImportEntity = "ingredient" | "container" | "label" | "folder" | "recipe";

export type ImportAction =
  /** A new entry will be written. */
  | "create"
  /** The book already has it; it is left untouched (local wins unless overwriting was asked for). */
  | "reuse"
  /** An ingredient or container the book already has will be overwritten with the file's version. */
  | "update"
  /** A new version will be appended to a recipe the book already has. */
  | "new_version"
  /** A recipe the book already has holds this version's content; nothing to write. */
  | "unchanged"
  /** Left out on request. */
  | "skip";

export type ImportRow = {
  entity: ImportEntity;
  action: ImportAction;
  name: string;
  reason: string;
  /** The id in the file. */
  incoming_id: string;
  /** For recipes that match one already in the book: how it matched, so the preview can offer a choice. */
  recipe_match?: "id" | "name";
};

/** Everything an import will write, worked out in advance. Applying it is only writes. */
export type ImportPlan = {
  labels_to_create: KitchenwareLabel[];
  /** Existing labels that gain kinds from the file. */
  label_kind_updates: Array<{ id: KitchenwareLabelId; kinds: Set<KitchenwareKind> }>;
  ingredients_to_create: Ingredient[];
  /** Ingredients the book already has, whole, as they will be after being overwritten. */
  ingredients_to_update: Ingredient[];
  containers_to_create: Container[];
  /** Containers the book already has, whole, as they will be after being overwritten. */
  containers_to_update: Container[];
  folders_to_create: RecipeFolder[];
  recipes_to_create: Recipe[];
  versions_to_add: Array<{ recipe_id: RecipeId; version: RecipeVersion }>;
  /** One row per thing in the file, for the preview. */
  rows: ImportRow[];
  /** Things worth knowing that do not stop the import. */
  warnings: string[];
};

/** Whether applying the plan would write nothing at all (e.g. importing the same file twice). */
export function isEmptyImportPlan(plan: ReadonlyDeep<ImportPlan>): boolean {
  return (
    plan.labels_to_create.length === 0 &&
    plan.label_kind_updates.length === 0 &&
    plan.ingredients_to_create.length === 0 &&
    plan.ingredients_to_update.length === 0 &&
    plan.containers_to_create.length === 0 &&
    plan.containers_to_update.length === 0 &&
    plan.folders_to_create.length === 0 &&
    plan.recipes_to_create.length === 0 &&
    plan.versions_to_add.length === 0
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const byNameThenId = <T extends { readonly id: string; readonly name: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

function copyMeasurement(m: ReadonlyDeep<Measurement>): Measurement {
  return {
    value: { numerator: m.value.numerator, denominator: m.value.denominator },
    unit: m.unit,
  };
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

/** Tracks the ids in use so new entries can keep the file's id when it is free, and get a fresh one when not. */
class IdAllocator<Id extends string> {
  private readonly used: Set<string>;

  public constructor(
    private readonly generate: () => Id,
    existing: Iterable<string>,
  ) {
    this.used = new Set(existing);
  }

  public has(id: string): boolean {
    return this.used.has(id);
  }

  /** `preferred` if it is free, otherwise a new random id. */
  public claim(preferred: Id): Id {
    if (!this.used.has(preferred)) {
      this.used.add(preferred);
      return preferred;
    }
    return this.fresh();
  }

  public fresh(): Id {
    for (;;) {
      const id = this.generate();
      if (!this.used.has(id)) {
        this.used.add(id);
        return id;
      }
    }
  }
}

/** Items in an order where every parent comes before its children; a cycle is broken at its first item. */
function parentsFirst<T extends { readonly id: string; readonly parent_id?: string | undefined }>(
  items: readonly T[],
  onCycle: (item: T) => void,
): T[] {
  const ids = new Set(items.map((i) => i.id));
  const emitted = new Set<string>();
  const ordered: T[] = [];
  let remaining = [...items];
  while (remaining.length > 0) {
    const ready = remaining.filter(
      (i) => i.parent_id === undefined || !ids.has(i.parent_id) || emitted.has(i.parent_id),
    );
    if (ready.length === 0) {
      const [first] = remaining;
      if (first === undefined) break;
      onCycle(first);
      ordered.push(first);
      emitted.add(first.id);
      remaining = remaining.filter((i) => i !== first);
      continue;
    }
    for (const item of ready) {
      ordered.push(item);
      emitted.add(item.id);
    }
    remaining = remaining.filter((i) => !emitted.has(i.id));
  }
  return ordered;
}

/** A version's content with ids, timestamps and its description left out, to tell "the same recipe" from "changed". */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "id")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => [key, canonical(v)]),
    );
  }
  return value;
}

export function versionContentSignature(version: ReadonlyDeep<RecipeVersion>): string {
  return JSON.stringify(
    canonical({
      sections: version.sections,
      ingredients: [...version.ingredients]
        .map((row) => ({ ingredient_id: row.ingredient_id, amount: row.amount }))
        .sort((a, b) => a.ingredient_id.localeCompare(b.ingredient_id)),
      estimated_time_seconds: version.estimated_time_seconds,
      seconds_per_ingredient: version.seconds_per_ingredient,
    }),
  );
}

// ---------------------------------------------------------------------------
// planImport
// ---------------------------------------------------------------------------

/**
 * Works out what importing `bundle` into the book described by `target` would do, without doing it.
 *
 * Nothing in the file is trusted to carry a name key: names are matched through the keys this book
 * would give them (`ingredientNameKey`, `labelNameKey`), so singular and plural forms merge.
 *
 * - **Local always wins.** An ingredient, container, or label the book already has (by id, else by
 *   name key) is reused untouched; a label only gains kinds it did not have.
 * - **New entries keep the file's id** when it is free, and get a fresh one when it is not, so
 *   importing the same file twice finds everything again and writes nothing.
 * - **Recipes** match an existing one by id, else by title within the destination folder. A match is
 *   merged (the incoming version is appended unless the book already has that content), kept
 *   alongside, or skipped, per `on_match` and `recipe_actions`. Recipes in the same file are never
 *   matched to each other.
 * - **References inside imported recipes** are rewritten to the entries they now resolve to.
 * - **Folders** are recreated under the destination (`retain`, merging into same-named folders) or
 *   ignored (`flatten`).
 */
export function planImport(
  target: ExportSource,
  bundle: ReadonlyDeep<RecipeBookExport>,
  options: ImportOptions,
): ImportPlan {
  const plan: ImportPlan = {
    labels_to_create: [],
    label_kind_updates: [],
    ingredients_to_create: [],
    ingredients_to_update: [],
    containers_to_create: [],
    containers_to_update: [],
    folders_to_create: [],
    recipes_to_create: [],
    versions_to_add: [],
    rows: [],
    warnings: [],
  };
  const warn = (message: string) => {
    if (!plan.warnings.includes(message)) plan.warnings.push(message);
  };

  // ----- labels -----------------------------------------------------------------------------
  const labelsById = new Map(target.labels.map((l) => [l.id, l]));
  const labelIndex = buildNameIndex(
    target.labels.map((l) => ({ id: l.id, key: labelNameKey(l.name) })),
  );
  const labelIds = new IdAllocator<KitchenwareLabelId>(
    () => randomId(KitchenwareLabelId),
    labelsById.keys(),
  );
  const labelMap = new Map<string, KitchenwareLabelId>();
  const createdLabels = new Map<KitchenwareLabelId, KitchenwareLabel>();
  const createdLabelByKey = new Map<string, KitchenwareLabelId>();
  const kindUpdates = new Map<KitchenwareLabelId, Set<KitchenwareKind>>();

  for (const incoming of [...bundle.labels].sort(byNameThenId)) {
    const key = labelNameKey(incoming.name);
    const matched =
      labelsById.get(incoming.id)?.id ??
      findNameClash(labelIndex, key) ??
      createdLabelByKey.get(key);
    if (matched !== undefined) {
      labelMap.set(incoming.id, matched);
      const existing = labelsById.get(matched);
      if (existing !== undefined) {
        const kinds = kindUpdates.get(matched) ?? new Set(existing.kinds);
        for (const kind of incoming.kinds) kinds.add(kind);
        if (kinds.size > existing.kinds.size) kindUpdates.set(matched, kinds);
      } else {
        const created = createdLabels.get(matched);
        if (created !== undefined) for (const kind of incoming.kinds) created.kinds.add(kind);
      }
      plan.rows.push({
        entity: "label",
        action: "reuse",
        name: incoming.name,
        reason: "The book already has this label.",
        incoming_id: incoming.id,
      });
      continue;
    }
    const id = labelIds.claim(incoming.id);
    createdLabels.set(id, { id, name: incoming.name, kinds: new Set(incoming.kinds) });
    createdLabelByKey.set(key, id);
    labelMap.set(incoming.id, id);
    plan.rows.push({
      entity: "label",
      action: "create",
      name: incoming.name,
      reason: "New label.",
      incoming_id: incoming.id,
    });
  }
  plan.labels_to_create = [...createdLabels.values()];
  plan.label_kind_updates = [...kindUpdates].map(([id, kinds]) => ({ id, kinds }));
  const resolveLabel = (id: KitchenwareLabelId): KitchenwareLabelId | undefined =>
    labelMap.get(id) ?? (labelsById.has(id) ? id : undefined);

  // ----- ingredients and containers ---------------------------------------------------------
  function planKitchenware<
    Id extends string,
    Item extends {
      readonly id: Id;
      readonly name: string;
      readonly labels: ReadonlySet<KitchenwareLabelId>;
      readonly parent_id?: Id | undefined;
    },
    Existing extends {
      readonly id: Id;
      readonly name: string;
      readonly labels: ReadonlySet<KitchenwareLabelId>;
      readonly parent_id?: Id | undefined;
    },
    Made extends { readonly id: Id; readonly parent_id?: Id | undefined },
  >(args: {
    entity: "ingredient" | "container";
    existing: readonly Existing[];
    incoming: readonly Item[];
    allocator: IdAllocator<Id>;
    make: (item: Item, fields: { id: Id; labels: Set<KitchenwareLabelId>; parent_id?: Id }) => Made;
    /**
     * When given, a match is overwritten with the file's version of its name, labels and parent
     * instead of being left alone. The id never changes, so everything that points at it stays valid.
     */
    overwrite?:
      | {
          /** Differences beyond name, labels and parent (an ingredient's default amount). */
          extraChanges?: (item: Item, existing: Existing) => string[];
          /** The entry as it will be after the overwrite. */
          made: (
            item: Item,
            existing: Existing,
            fields: { name: string; labels: Set<KitchenwareLabelId>; parent_id?: Id },
          ) => Made;
          collect: (made: Made) => void;
        }
      | undefined;
  }) {
    const existingById = new Map(args.existing.map((e) => [e.id, e]));
    const index = buildNameIndex(
      args.existing.map((e) => ({ id: e.id, key: ingredientNameKey(e.name) })),
    );
    const map = new Map<string, Id>();
    const created: Made[] = [];
    const createdByKey = new Map<string, Id>();
    const overwritten = new Set<Id>();
    const plannedParents = new Map<Id, Id | undefined>();
    const effectiveParent = (id: Id): Id | undefined =>
      plannedParents.has(id) ? plannedParents.get(id) : existingById.get(id)?.parent_id;
    const resolveParent = (item: Item): Id | undefined =>
      item.parent_id === undefined
        ? undefined
        : (map.get(item.parent_id) ??
          (existingById.has(item.parent_id) ? item.parent_id : undefined));
    const resolveLabels = (item: Item): Set<KitchenwareLabelId> => {
      const labels = new Set<KitchenwareLabelId>();
      for (const labelId of item.labels) {
        const resolved = resolveLabel(labelId);
        if (resolved !== undefined) labels.add(resolved);
      }
      return labels;
    };
    /** Whether giving `id` this parent would make a loop, counting the overwrites planned so far. */
    const wouldLoop = (id: Id, parent: Id): boolean => {
      const seen = new Set<Id>();
      for (
        let at: Id | undefined = parent;
        at !== undefined && !seen.has(at);
        at = effectiveParent(at)
      ) {
        if (at === id) return true;
        seen.add(at);
      }
      return false;
    };
    const planOverwrite = (item: Item, existing: Existing) => {
      const overwrite = args.overwrite;
      if (overwrite === undefined) return undefined;
      const changed: string[] = [];

      let name = existing.name;
      if (item.name !== existing.name) {
        if (findNameClash(index, ingredientNameKey(item.name), existing.id) !== undefined) {
          warn(
            `"${existing.name}" was not renamed to "${item.name}": another ${args.entity} in the book already has that name.`,
          );
        } else {
          name = item.name;
          changed.push("name");
        }
      }
      changed.push(...(overwrite.extraChanges?.(item, existing) ?? []));

      const labels = resolveLabels(item);
      if (!sameSet(labels, existing.labels)) changed.push("labels");

      let parent: Id | undefined = existing.parent_id;
      const fileParent = resolveParent(item);
      if (fileParent !== undefined && fileParent !== existing.parent_id) {
        if (fileParent === existing.id || wouldLoop(existing.id, fileParent)) {
          warn(
            `"${existing.name}" keeps its parent: the file's parent would make a loop in the book.`,
          );
        } else {
          parent = fileParent;
          changed.push("parent");
        }
      }

      if (changed.length === 0) return undefined;
      const made = overwrite.made(item, existing, {
        name,
        labels,
        ...(parent !== undefined && { parent_id: parent }),
      });
      overwrite.collect(made);
      return { made, changed };
    };
    const ordered = parentsFirst([...args.incoming].sort(byNameThenId), (item) =>
      warn(`"${item.name}" is in a loop of parents in the file; it is imported without a parent.`),
    );
    for (const item of ordered) {
      const key = ingredientNameKey(item.name);
      const matched =
        existingById.get(item.id)?.id ?? findNameClash(index, key) ?? createdByKey.get(key);
      if (matched !== undefined) {
        map.set(item.id, matched);
        const existing = existingById.get(matched);
        const result =
          existing !== undefined && !overwritten.has(matched)
            ? planOverwrite(item, existing)
            : undefined;
        if (result !== undefined) {
          overwritten.add(matched);
          plannedParents.set(matched, result.made.parent_id);
          plan.rows.push({
            entity: args.entity,
            action: "update",
            name: item.name,
            reason: `Overwrites the book's ${result.changed.join(", ")}.`,
            incoming_id: item.id,
          });
          continue;
        }
        plan.rows.push({
          entity: args.entity,
          action: "reuse",
          name: item.name,
          reason:
            args.overwrite !== undefined && existing !== undefined
              ? `The book's ${args.entity} already matches.`
              : `The book already has this ${args.entity}.`,
          incoming_id: item.id,
        });
        continue;
      }
      const id = args.allocator.claim(item.id);
      const labels = new Set<KitchenwareLabelId>();
      for (const labelId of item.labels) {
        const resolved = resolveLabel(labelId);
        if (resolved !== undefined) labels.add(resolved);
      }
      const parent =
        item.parent_id === undefined
          ? undefined
          : (map.get(item.parent_id) ??
            (existingById.has(item.parent_id) ? item.parent_id : undefined));
      if (item.parent_id !== undefined && parent === undefined) {
        warn(`"${item.name}" has a parent that is not in the file; it is imported without one.`);
      }
      created.push(
        args.make(item, { id, labels, ...(parent !== undefined && { parent_id: parent }) }),
      );
      createdByKey.set(key, id);
      map.set(item.id, id);
      plan.rows.push({
        entity: args.entity,
        action: "create",
        name: item.name,
        reason: `New ${args.entity}.`,
        incoming_id: item.id,
      });
    }
    return { map, created, existingById };
  }

  const ingredientPlan = planKitchenware<
    IngredientId,
    ReadonlyDeep<Ingredient>,
    ReadonlyDeep<Ingredient>,
    Ingredient
  >({
    entity: "ingredient",
    existing: target.ingredients,
    incoming: bundle.ingredients,
    allocator: new IdAllocator<IngredientId>(
      () => randomId(IngredientId),
      target.ingredients.map((i) => i.id),
    ),
    make: (item, fields) => ({
      kind: "ingredient",
      id: fields.id,
      name: item.name,
      default_measurement_value: copyMeasurement(item.default_measurement_value),
      labels: fields.labels,
      ...(fields.parent_id !== undefined && { parent_id: fields.parent_id }),
    }),
    overwrite:
      options.overwrite_kitchenware === true
        ? {
            extraChanges: (item, existing) =>
              JSON.stringify(copyMeasurement(item.default_measurement_value)) !==
              JSON.stringify(existing.default_measurement_value)
                ? ["default amount"]
                : [],
            made: (item, existing, fields) => ({
              kind: "ingredient",
              id: existing.id,
              name: fields.name,
              default_measurement_value: copyMeasurement(item.default_measurement_value),
              labels: fields.labels,
              ...(fields.parent_id !== undefined && { parent_id: fields.parent_id }),
            }),
            collect: (made) => plan.ingredients_to_update.push(made),
          }
        : undefined,
  });
  plan.ingredients_to_create = ingredientPlan.created;

  const containerPlan = planKitchenware<
    ContainerId,
    ReadonlyDeep<Container>,
    ReadonlyDeep<Container>,
    Container
  >({
    entity: "container",
    existing: target.containers,
    incoming: bundle.containers,
    allocator: new IdAllocator<ContainerId>(
      () => randomId(ContainerId),
      target.containers.map((c) => c.id),
    ),
    make: (item, fields) => ({
      kind: "container",
      id: fields.id,
      name: item.name,
      labels: fields.labels,
      ...(fields.parent_id !== undefined && { parent_id: fields.parent_id }),
    }),
    overwrite:
      options.overwrite_kitchenware === true
        ? {
            made: (_item, existing, fields) => ({
              kind: "container",
              id: existing.id,
              name: fields.name,
              labels: fields.labels,
              ...(fields.parent_id !== undefined && { parent_id: fields.parent_id }),
            }),
            collect: (made) => plan.containers_to_update.push(made),
          }
        : undefined,
  });
  plan.containers_to_create = containerPlan.created;

  const knownIngredientIds = new Set<string>([
    ...target.ingredients.map((i) => i.id),
    ...ingredientPlan.created.map((i) => i.id),
  ]);
  const knownContainerIds = new Set<string>([
    ...target.containers.map((c) => c.id),
    ...containerPlan.created.map((c) => c.id),
  ]);

  // ----- folders ----------------------------------------------------------------------------
  const folderIds = new IdAllocator<RecipeFolderId>(
    () => randomId(RecipeFolderId),
    target.recipe_folders.map((f) => f.id),
  );
  const foldersById = new Map(target.recipe_folders.map((f) => [f.id, f]));
  const childKey = (parent: RecipeFolderId | undefined, name: string) =>
    `${parent ?? ""}|${labelNameKey(name)}`;
  const folderChildren = new Map<string, RecipeFolderId>();
  for (const folder of [...target.recipe_folders].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = childKey(folder.parent_folder_id, folder.name);
    if (!folderChildren.has(key)) folderChildren.set(key, folder.id);
  }
  const createdFolders = new Map<RecipeFolderId, RecipeFolder>();

  /** The folder named `name` under `parent`, created if the book has none. */
  function ensureFolder(
    parent: RecipeFolderId | undefined,
    name: string,
    template: ReadonlyDeep<RecipeFolder> | undefined,
  ): { id: RecipeFolderId; created: boolean } {
    const existing = folderChildren.get(childKey(parent, name));
    if (existing !== undefined) return { id: existing, created: false };
    const id = folderIds.claim(template?.id ?? folderIds.fresh());
    createdFolders.set(id, {
      id,
      name,
      tags: template === undefined ? [] : [...template.tags],
      sort_order: template === undefined ? "manual" : template.sort_order,
      ...(parent !== undefined && { parent_folder_id: parent }),
    });
    folderChildren.set(childKey(parent, name), id);
    return { id, created: true };
  }

  let destinationRoot: RecipeFolderId | undefined = options.target_folder_id;
  const newFolderName = options.new_folder_name?.trim() ?? "";
  if (newFolderName !== "") {
    const root = ensureFolder(destinationRoot, newFolderName, undefined);
    destinationRoot = root.id;
    plan.rows.push({
      entity: "folder",
      action: root.created ? "create" : "reuse",
      name: newFolderName,
      reason: root.created
        ? "The folder everything is imported into."
        : "The book already has this folder.",
      incoming_id: "",
    });
  }

  const folderMap = new Map<string, RecipeFolderId>();
  if (options.folder_mode === "retain") {
    const incomingFolders = bundle.recipe_folders.map((f) => ({
      ...f,
      parent_id: f.parent_folder_id,
    }));
    const ordered = parentsFirst(incomingFolders.sort(byNameThenId), (f) =>
      warn(`Folder "${f.name}" is in a loop of parents in the file; it is imported at the top.`),
    );
    for (const folder of ordered) {
      const parent =
        folder.parent_folder_id === undefined
          ? destinationRoot
          : (folderMap.get(folder.parent_folder_id) ?? destinationRoot);
      // The same folder id already in the book (a folder imported before) is the same folder.
      const sameId = foldersById.has(folder.id) ? folder.id : undefined;
      const resolved =
        sameId !== undefined
          ? { id: sameId, created: false }
          : ensureFolder(parent, folder.name, folder);
      folderMap.set(folder.id, resolved.id);
      plan.rows.push({
        entity: "folder",
        action: resolved.created ? "create" : "reuse",
        name: folder.name,
        reason: resolved.created ? "New folder." : "The book already has this folder.",
        incoming_id: folder.id,
      });
    }
  }

  // ----- recipes ----------------------------------------------------------------------------
  const recipesById = new Map(target.recipes.map((r) => [r.id, r]));
  const recipesByFolderTitle = new Map<string, ReadonlyDeep<Recipe>>();
  for (const recipe of [...target.recipes].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = childKey(recipe.parent_folder_id, recipe.title);
    if (!recipesByFolderTitle.has(key)) recipesByFolderTitle.set(key, recipe);
  }
  const recipeIds = new IdAllocator<RecipeId>(() => randomId(RecipeId), recipesById.keys());
  const versionIds = new IdAllocator<RecipeVersionId>(
    () => randomId(RecipeVersionId),
    target.recipes.flatMap((r) => r.versions.map((v) => v.id)),
  );
  const recipeMap = new Map<string, RecipeId>();
  const importDate = new Date(options.now).toISOString().slice(0, 10);

  const remap = {
    ingredient: (id: IngredientId): IngredientId => ingredientPlan.map.get(id) ?? id,
    container: (id: ContainerId): ContainerId => containerPlan.map.get(id) ?? id,
  };
  function remapped(
    recipe: ReadonlyDeep<Recipe>,
    version: ReadonlyDeep<RecipeVersion>,
  ): RecipeVersion {
    const result = remapVersionReferences(version, remap);
    if (collectIngredientIds(result).some((id) => !knownIngredientIds.has(id))) {
      warn(`"${recipe.title}" uses an ingredient that is not in the file or in this book.`);
    }
    if (collectContainerIds(result).some((id) => !knownContainerIds.has(id))) {
      warn(`"${recipe.title}" uses a container that is not in the file or in this book.`);
    }
    return result;
  }

  for (const incoming of [...bundle.recipes].sort(
    (a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  )) {
    const destination =
      options.folder_mode === "retain" && incoming.parent_folder_id !== undefined
        ? (folderMap.get(incoming.parent_folder_id) ?? destinationRoot)
        : destinationRoot;

    const byId = recipesById.get(incoming.id);
    const byName =
      byId === undefined
        ? recipesByFolderTitle.get(childKey(destination, incoming.title))
        : undefined;
    const matched = byId ?? byName;
    const recipe_match = byId !== undefined ? "id" : byName !== undefined ? "name" : undefined;
    const action: RecipeMatchAction =
      matched === undefined
        ? "merge_version"
        : (options.recipe_actions?.[incoming.id] ?? options.on_match);

    if (matched !== undefined && action === "skip") {
      plan.rows.push({
        entity: "recipe",
        action: "skip",
        name: incoming.title,
        reason: "Skipped.",
        incoming_id: incoming.id,
        ...(recipe_match !== undefined && { recipe_match }),
      });
      continue;
    }

    if (matched !== undefined && action === "merge_version") {
      recipeMap.set(incoming.id, matched.id);
      const latest = incoming.versions.at(-1);
      if (latest === undefined) {
        plan.rows.push({
          entity: "recipe",
          action: "unchanged",
          name: incoming.title,
          reason: "The file has no version of this recipe.",
          incoming_id: incoming.id,
          ...(recipe_match !== undefined && { recipe_match }),
        });
        continue;
      }
      const version = remapped(incoming, latest);
      const signature = versionContentSignature(version);
      const already =
        matched.versions.some((v) => v.id === latest.id) ||
        matched.versions.some((v) => versionContentSignature(v) === signature);
      if (already) {
        plan.rows.push({
          entity: "recipe",
          action: "unchanged",
          name: incoming.title,
          reason: "The book already has a version with this content.",
          incoming_id: incoming.id,
          ...(recipe_match !== undefined && { recipe_match }),
        });
        continue;
      }
      plan.versions_to_add.push({
        recipe_id: matched.id,
        version: {
          ...version,
          id: versionIds.claim(latest.id),
          recipe_id: matched.id,
          description: `Imported from ${options.source_label} on ${importDate}`,
          created_at: options.now,
        },
      });
      plan.rows.push({
        entity: "recipe",
        action: "new_version",
        name: incoming.title,
        reason: "Adds the file's version to the recipe the book already has.",
        incoming_id: incoming.id,
        ...(recipe_match !== undefined && { recipe_match }),
      });
      continue;
    }

    // A new recipe: unmatched, or matched and the choice is to keep both.
    const keepBoth = matched !== undefined;
    const id = keepBoth ? recipeIds.fresh() : recipeIds.claim(incoming.id);
    recipeMap.set(incoming.id, id);
    plan.recipes_to_create.push({
      id,
      title: incoming.title,
      ...(incoming.subtitle !== undefined && { subtitle: incoming.subtitle }),
      ...(incoming.source_url !== undefined && { source_url: incoming.source_url }),
      ...(destination !== undefined && { parent_folder_id: destination }),
      versions: incoming.versions.map((version) => ({
        ...remapped(incoming, version),
        id: keepBoth ? versionIds.fresh() : versionIds.claim(version.id),
        recipe_id: id,
      })),
      created_at: incoming.created_at,
      updated_at: options.now,
    });
    plan.rows.push({
      entity: "recipe",
      action: "create",
      name: incoming.title,
      reason: keepBoth ? "Kept alongside the recipe the book already has." : "New recipe.",
      incoming_id: incoming.id,
      ...(recipe_match !== undefined && { recipe_match }),
    });
  }

  // A created folder's manual order keeps only entries that now resolve to something.
  for (const incoming of bundle.recipe_folders) {
    const id = folderMap.get(incoming.id);
    const created = id === undefined ? undefined : createdFolders.get(id);
    if (created === undefined || incoming.manual_order === undefined) continue;
    const order = incoming.manual_order.flatMap((entry) => {
      const resolved = recipeMap.get(entry) ?? folderMap.get(entry);
      return resolved === undefined ? [] : [resolved];
    });
    if (order.length > 0) created.manual_order = order;
  }
  plan.folders_to_create = [...createdFolders.values()];

  return plan;
}
