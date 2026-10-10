export function uniqueTrees<T extends { id: string }>(trees: readonly T[]): T[] {
  const seen = new Set<string>();
  return trees.filter(tree => {
    if (seen.has(tree.id)) return false;
    seen.add(tree.id);
    return true;
  });
}
