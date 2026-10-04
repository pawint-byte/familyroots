/** New copied records must get new IDs and creation timestamps. */
export function memberCopyData<T extends { id: string; createdAt: Date }>(record: T): Omit<T, "id" | "createdAt"> {
  const { id, createdAt, ...data } = record;
  return data;
}