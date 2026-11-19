import type { ReadonlyDeep } from "type-fest";
import {
  type Container,
  type ContainerId,
  type Ingredient,
  type IngredientId,
  type KitchenwareLabel,
  type KitchenwareLabelId,
  Container as ContainerSchema,
  Ingredient as IngredientSchema,
  KitchenwareLabel as LabelSchema,
} from "../types/kitchenware.ts";
import {
  type Recipe,
  type RecipeId,
  type RecipeVersion,
  type SectionItem,
  Recipe as RecipeSchema,
} from "../types/recipe.ts";
import type { RecipeBookId } from "../types/recipeBook.ts";
import { type RecipeFolder, type RecipeFolderId } from "../types/recipeGroup.ts";
import { collectIngredientItems, collectInstructions } from "../types/sections.ts";
import { isInvalid, validate } from "../yjs/validation.ts";
import {
  EXPORT_FORMAT,
  EXPORT_FORMAT_VERSION,
  type MissingReference,
  type RecipeBookExport,
} from "./recipeBookExport.ts";

/** Everything an export can draw from: a book's kitchenware, labels, folders, and recipes. */
export type ExportSource = ReadonlyDeep<{
  ingredients: Ingredient[];
  containers: Container[];
  labels: KitchenwareLabel[];
  recipe_folders: Array<Omit<RecipeFolder, "children">>;
  recipes: Recipe[];
}>;

export type ExportInfo = {
  /** The book the data comes from, if known. */
  source_book?: { id: RecipeBookId; name: string };
  /** Epoch milliseconds. */
  exported_at: number;
};

/** Collects the references an export could not satisfy, once each. */
class MissingCollector {
  private readonly seen = new Set<string>();
  public readonly list: MissingReference[] = [];

  public add(reference: MissingReference): void {
    const key = `${reference.kind}|${reference.id}|${reference.referenced_by.kind}|${reference.referenced_by.id}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.list.push(reference);
  }
}

type Referrer = MissingReference["referenced_by"];

function byNameThenId<T extends { readonly id: string; readonly name: string }>(a: T, b: T) {
  return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

/** Keeps an entry only if it passes its schema; logs and drops it otherwise. */
function validOrSkip<S extends Parameters<typeof validate>[0]>(
  schema: S,
  data: unknown,
  what: string,
): S["type"]["infer"] | undefined {
  const result = validate(schema, data);
  if (isInvalid(result)) {
    console.warn(`Leaving ${what} out of the export: ${result.reason}`);
    return undefined;
  }
  return result;
}

/**
 * `startIds` plus every ancestor reachable through `parent_id`, so a hierarchy ("Shredded Cheddar →
 * Shredded Cheese → Cheese") survives. Ids that resolve to nothing are recorded, not thrown.
 */
function closeOverParents<Id extends string>(
  startIds: Iterable<readonly [Id, Referrer]>,
  byId: ReadonlyMap<Id, { readonly parent_id?: Id | undefined }>,
  kind: "ingredient" | "container",
  missing: MissingCollector,
): Set<Id> {
  const included = new Set<Id>();
  const queue: Array<readonly [Id, Referrer]> = [...startIds];
  // The queue grows as ancestors are found, so walk it by index.
  for (let next = 0; next < queue.length; next++) {
    const entry = queue[next];
    if (entry === undefined) continue;
    const [id, referrer] = entry;
    if (included.has(id)) continue;
    const item = byId.get(id);
    if (item === undefined) {
      missing.add({ kind, id, referenced_by: referrer });
      continue;
    }
    included.add(id);
    if (item.parent_id !== undefined) queue.push([item.parent_id, { kind, id }]);
  }
  return included;
}

function indexById<Id extends string, T extends { readonly id: Id }>(
  items: readonly T[],
): Map<Id, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/** Every container item in a version's sections, however deeply nested. */
export function collectContainerIds(version: ReadonlyDeep<RecipeVersion>): ContainerId[] {
  const ids: ContainerId[] = [];
  function walk(items: ReadonlyDeep<SectionItem[]>) {
    for (const item of items) {
      if (item.kind === "container") ids.push(item.container_id);
      else if (item.kind === "section") walk(item.contents);
    }
  }
  for (const section of version.sections) walk(section.contents);
  return ids;
}

/** The ingredients a version uses: its list, its ingredient rows, and the ingredients its steps act on. */
export function collectIngredientIds(version: ReadonlyDeep<RecipeVersion>): IngredientId[] {
  const ids = new Set<IngredientId>();
  for (const row of version.ingredients) ids.add(row.ingredient_id);
  for (const item of collectIngredientItems(version.sections)) ids.add(item.ingredient_id);
  for (const step of collectInstructions(version.sections)) {
    for (const id of step.ingredient_ids ?? []) ids.add(id);
  }
  return [...ids];
}

/**
 * An ingredient or container as it goes in the file: its labels narrowed to the ones that exist,
 * and a `parent_id` that names nothing dropped, so the file never points at something it lacks.
 */
function exportKitchenware<T extends ReadonlyDeep<Ingredient> | ReadonlyDeep<Container>>(
  item: T,
  labelsById: ReadonlyMap<string, unknown>,
  parentIds: ReadonlySet<string>,
  kind: "ingredient" | "container",
  missing: MissingCollector,
) {
  const labels = new Set<KitchenwareLabelId>();
  for (const labelId of item.labels) {
    if (labelsById.has(labelId)) labels.add(labelId);
    else missing.add({ kind: "label", id: labelId, referenced_by: { kind, id: item.id } });
  }
  const { parent_id, ...rest } = item;
  const keepParent = parent_id !== undefined && parentIds.has(parent_id);
  // The schemas read labels as an array (and turn them into a Set), so validate that form.
  return { ...rest, labels: [...labels], ...(keepParent && { parent_id }) };
}

type KitchenwareSelection = {
  ingredientIds: ReadonlyArray<readonly [IngredientId, Referrer]>;
  containerIds: ReadonlyArray<readonly [ContainerId, Referrer]>;
};

/** The ingredients, containers, and labels for a selection, with their ancestors and labels. */
function gatherKitchenware(
  source: ExportSource,
  selection: KitchenwareSelection,
  missing: MissingCollector,
) {
  const ingredientsById = indexById(source.ingredients);
  const containersById = indexById(source.containers);
  const labelsById = indexById(source.labels);

  const ingredientIds = closeOverParents(
    selection.ingredientIds,
    ingredientsById,
    "ingredient",
    missing,
  );
  const containerIds = closeOverParents(
    selection.containerIds,
    containersById,
    "container",
    missing,
  );

  const ingredients: Ingredient[] = [];
  for (const id of ingredientIds) {
    const found = ingredientsById.get(id);
    if (found === undefined) continue;
    const exported = exportKitchenware(found, labelsById, ingredientIds, "ingredient", missing);
    const valid = validOrSkip(IngredientSchema, exported, `ingredient "${found.name}"`);
    if (valid !== undefined) ingredients.push(valid);
  }
  const containers: Container[] = [];
  for (const id of containerIds) {
    const found = containersById.get(id);
    if (found === undefined) continue;
    const exported = exportKitchenware(found, labelsById, containerIds, "container", missing);
    const valid = validOrSkip(ContainerSchema, exported, `container "${found.name}"`);
    if (valid !== undefined) containers.push(valid);
  }

  const labelIds = new Set<KitchenwareLabelId>();
  for (const item of [...ingredients, ...containers]) {
    for (const labelId of item.labels) labelIds.add(labelId);
  }
  const labels: KitchenwareLabel[] = [];
  for (const id of labelIds) {
    const found = labelsById.get(id);
    if (found === undefined) continue;
    const valid = validOrSkip(
      LabelSchema,
      { ...found, kinds: [...found.kinds] },
      `label "${found.name}"`,
    );
    if (valid !== undefined) labels.push(valid);
  }

  // A label left out above (it failed its schema) must not stay listed on what carries it.
  const kept = new Set(labels.map((l) => l.id));
  const withoutLeftOutLabels = <T extends Ingredient | Container>(item: T): T => {
    const missingLabels = [...item.labels].filter((id) => !kept.has(id));
    if (missingLabels.length === 0) return item;
    for (const id of missingLabels) {
      missing.add({
        kind: "label",
        id,
        referenced_by: { kind: item.kind, id: item.id },
      });
    }
    return { ...item, labels: new Set([...item.labels].filter((id) => kept.has(id))) };
  };

  return {
    ingredients: ingredients.map(withoutLeftOutLabels).sort(byNameThenId),
    containers: containers.map(withoutLeftOutLabels).sort(byNameThenId),
    labels: labels.sort(byNameThenId),
  };
}

function header(info: ExportInfo) {
  return {
    format: EXPORT_FORMAT,
    format_version: EXPORT_FORMAT_VERSION,
    exported_at: info.exported_at,
    ...(info.source_book !== undefined && { source_book: info.source_book }),
  };
}

/**
 * The export of some ingredients: each selected ingredient plus its ancestors (so its place in the
 * hierarchy survives) and the labels they carry. Ids that name no ingredient are recorded as
 * missing. There are no recipes, folders, or containers in it.
 */
export function buildIngredientExport(
  source: ExportSource,
  ingredientIds: readonly IngredientId[],
  info: ExportInfo,
): RecipeBookExport {
  const missing = new MissingCollector();
  const kitchenware = gatherKitchenware(
    source,
    {
      ingredientIds: ingredientIds.map((id) => [id, { kind: "selection", id }] as const),
      containerIds: [],
    },
    missing,
  );
  return {
    ...header(info),
    ...kitchenware,
    containers: [],
    recipe_folders: [],
    recipes: [],
    missing_references: missing.list,
  };
}

/**
 * The export of some recipes: each with **only its latest version**, exactly the ingredients and
 * containers that version uses (plus their ancestors and labels — ingredients used only by older
 * versions are left out), and the folders the recipes sit in (with their ancestors, so a folder tree
 * can be recreated). A recipe that fails its schema is left out; references that resolve to nothing
 * are recorded in `missing_references`, and the file says what it lacks instead of failing.
 */
export function buildRecipeExport(
  source: ExportSource,
  recipeIds: readonly RecipeId[],
  info: ExportInfo,
): RecipeBookExport {
  const missing = new MissingCollector();
  const recipesById = indexById(source.recipes);
  const foldersById = indexById(source.recipe_folders);

  const chosen: Array<ReadonlyDeep<Recipe>> = [];
  for (const id of new Set(recipeIds)) {
    const recipe = recipesById.get(id);
    if (recipe === undefined)
      missing.add({ kind: "recipe", id, referenced_by: { kind: "selection", id } });
    else chosen.push(recipe);
  }

  // Each recipe, narrowed to its latest version, then checked against the export schema.
  const recipes: Recipe[] = [];
  const latestVersions: Array<ReadonlyDeep<RecipeVersion>> = [];
  for (const recipe of chosen) {
    const latest = recipe.versions.at(-1);
    const narrowed = { ...recipe, versions: latest === undefined ? [] : [latest] };
    const valid = validOrSkip(RecipeSchema, narrowed, `recipe "${recipe.title}"`);
    if (valid === undefined) continue;
    recipes.push(valid);
    if (latest !== undefined) latestVersions.push(latest);
  }

  const ingredientRefs: Array<readonly [IngredientId, Referrer]> = [];
  const containerRefs: Array<readonly [ContainerId, Referrer]> = [];
  for (const recipe of recipes) {
    const version = recipe.versions[0];
    if (version === undefined) continue;
    const referrer: Referrer = { kind: "recipe", id: recipe.id };
    for (const id of collectIngredientIds(version)) ingredientRefs.push([id, referrer]);
    for (const id of collectContainerIds(version)) containerRefs.push([id, referrer]);
  }
  const kitchenware = gatherKitchenware(
    source,
    { ingredientIds: ingredientRefs, containerIds: containerRefs },
    missing,
  );

  // The folders the recipes sit in, with every ancestor.
  const folderIds = new Set<RecipeFolderId>();
  function includeFolderChain(startId: RecipeFolderId, referrer: Referrer) {
    let id: RecipeFolderId | undefined = startId;
    let from = referrer;
    while (id !== undefined && !folderIds.has(id)) {
      const folder = foldersById.get(id);
      if (folder === undefined) {
        missing.add({ kind: "folder", id, referenced_by: from });
        return;
      }
      folderIds.add(id);
      from = { kind: "folder", id };
      id = folder.parent_folder_id;
    }
  }
  for (const recipe of recipes) {
    if (recipe.parent_folder_id !== undefined) {
      includeFolderChain(recipe.parent_folder_id, { kind: "recipe", id: recipe.id });
    }
  }

  const includedIds = new Set<string>([...recipes.map((r) => r.id), ...folderIds]);
  const recipeFolders: RecipeFolder[] = [];
  for (const id of folderIds) {
    const folder = foldersById.get(id);
    if (folder === undefined) continue;
    const { parent_folder_id, manual_order, ...rest } = folder;
    recipeFolders.push({
      ...rest,
      tags: [...folder.tags],
      ...(parent_folder_id !== undefined &&
        folderIds.has(parent_folder_id) && { parent_folder_id }),
      ...(manual_order !== undefined && {
        manual_order: manual_order.filter((x) => includedIds.has(x)),
      }),
    });
  }

  // A recipe whose folder is not in the book keeps no dangling pointer.
  const exportedRecipes = recipes.map((recipe) => {
    const { parent_folder_id, ...rest } = recipe;
    return parent_folder_id !== undefined && folderIds.has(parent_folder_id) ? recipe : rest;
  });

  return {
    ...header(info),
    ...kitchenware,
    recipe_folders: recipeFolders.sort(byNameThenId),
    recipes: exportedRecipes.sort(
      (a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
    ),
    missing_references: missing.list,
  };
}
