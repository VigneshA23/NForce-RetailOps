import type { AdminTask } from '../types/adminTask';

export interface TaskGrouping {
  // One row per distinct task title -- a single-member group is just that
  // task unchanged; a multi-member group is a synthetic merged row (stores
  // unioned, active if any member is active) representing every underlying
  // task that shares that title.
  displayTasks: AdminTask[];
  // Merged-row id -> every real underlying task id it represents, including
  // itself for a single-row "group" -- callers never need to special-case
  // the common (non-merged) case.
  memberIdsByDisplayId: Map<number, number[]>;
}

// Rows are merged only when they share BOTH an exact task title AND the same
// owner -- e.g. an Owner Admin with no store-scope editing UI (a since-fixed
// gap) repeatedly clicking "Create Task" instead of adding a store to their
// existing one, leaving several real duplicate rows under that one owner.
// Deliberately NOT grouped by title alone: this platform's data is generally
// one independent Task row per owner/store, and several genuinely unrelated
// owners commonly configure a same-titled task in parallel (their own
// "Closing Checks" checklist, say) -- title-only grouping blended those
// distinct, independently-editable rows into one misleading merged row
// (e.g. showing "Active" and one category the instant any single owner's
// copy happened to still be active/correctly categorized, silently hiding
// that other owners' copies were deactivated or miscategorized). Scoping to
// (name, ownerId) only ever merges rows that could actually be the same
// mistake by the same person, never two different owners' independent tasks.
// Purely a display grouping either way: the underlying rows are untouched,
// and callers use memberIdsByDisplayId to act on every underlying row a
// merged row represents.
export function groupTasksByName(tasks: AdminTask[]): TaskGrouping {
  const groups = new Map<string, AdminTask[]>();
  for (const task of tasks) {
    const key = `${task.name}::${task.ownerId ?? ''}`;
    const list = groups.get(key) ?? [];
    list.push(task);
    groups.set(key, list);
  }

  const displayTasks: AdminTask[] = [];
  const memberIdsByDisplayId = new Map<number, number[]>();

  for (const members of groups.values()) {
    if (members.length === 1) {
      displayTasks.push(members[0]);
      memberIdsByDisplayId.set(members[0].id, [members[0].id]);
      continue;
    }
    const primary = members.find((m) => m.active) ?? members[0];
    const storeMap = new Map<number, AdminTask['stores'][number]>();
    members.forEach((m) => m.stores.forEach((s) => storeMap.set(s.id, s)));
    displayTasks.push({
      ...primary,
      active: members.some((m) => m.active),
      appliesToAllStores: members.some((m) => m.appliesToAllStores),
      stores: Array.from(storeMap.values()),
    });
    memberIdsByDisplayId.set(primary.id, members.map((m) => m.id));
  }

  return { displayTasks, memberIdsByDisplayId };
}
