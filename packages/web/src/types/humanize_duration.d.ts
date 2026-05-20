declare module "humanize-duration" {
  export interface HumanizeDurationOptions {
    language?: string;
    languages?: Record<string, unknown>;
    fallbacks?: string[];
    delimiter?: string;
    spacer?: string;
    maxDecimalPoints?: number;
    decimal?: string;
    units?: Array<"y" | "mo" | "w" | "d" | "h" | "m" | "s" | "ms">;
    unitMeasures?: Partial<Record<string, number>>;
    round?: boolean;
    largest?: number;
    conjunction?: string;
    serialComma?: boolean;
  }

  export type HumanizerFn = (ms: number, options?: HumanizeDurationOptions) => string;

  interface Humanizer extends HumanizerFn {
    (ms: number, options?: HumanizeDurationOptions): string;
  }

  function humanizeDuration(ms: number, options?: HumanizeDurationOptions): string;
  namespace humanizeDuration {
    function humanizer(options?: HumanizeDurationOptions): Humanizer;
  }

  export default humanizeDuration;
}
