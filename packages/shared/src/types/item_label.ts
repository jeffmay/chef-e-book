import type { Brand } from "ts-brand";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ItemLabel {
  export type Id = Brand<string, "ItemLabel.Id">;
}

export interface ItemLabel {
  readonly id: ItemLabel.Id;
  readonly name: string;
  readonly kinds: ReadonlySet<"ingredient" | "container" | "equipment">;
}
