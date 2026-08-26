interface BrowserTaskReservation {
  resourceKeys: readonly string[];
}

export function hasBrowserTaskConflict<T extends BrowserTaskReservation>(
  activeTasks: ReadonlyMap<number, T>,
  resourceKeys: readonly string[],
  maxActiveTasks: number
): boolean {
  if (activeTasks.size >= maxActiveTasks) return true;
  const requested = new Set(resourceKeys);
  return [...activeTasks.values()].some((task) =>
    task.resourceKeys.some((key) => requested.has(key))
  );
}

export function tryReserveBrowserTask<T extends BrowserTaskReservation>(
  activeTasks: Map<number, T>,
  tabId: number,
  task: T,
  maxActiveTasks: number
): boolean {
  if (hasBrowserTaskConflict(activeTasks, task.resourceKeys, maxActiveTasks)) return false;
  activeTasks.set(tabId, task);
  return true;
}
