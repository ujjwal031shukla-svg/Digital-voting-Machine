export function cn(...classes: (string | undefined | null | boolean)[]) {
  return classes.filter((c) => c && typeof c !== "boolean").join(" ");
}