import humanize, { type HumanizeDurationOptions } from "humanize-duration";

const HUMANIZE_OPTS: HumanizeDurationOptions = {
  units: ["h", "m", "s"],
  largest: 2,
  round: true,
};

export function humanizeSeconds(seconds: number): string {
  return humanize(seconds * 1000, HUMANIZE_OPTS);
}
