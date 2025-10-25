import { createStore } from '@xstate/store';
import { enablePatches, produceWithPatches, Patch } from 'immer';

// Enable Immer patches globally
enablePatches();

/**
 * Context for the array store
 */
export interface ArrayStoreContext<T> {
  items: T[];
}

/**
 * Events that can be sent to the array store
 */
export type ArrayStoreEvents<T> =
  | { type: 'push'; item: T }
  | { type: 'pushMany'; items: T[] }
  | { type: 'remove'; index: number }
  | { type: 'removeMany'; indices: number[] }
  | { type: 'update'; index: number; item: T }
  | { type: 'updateMany'; updates: Array<{ index: number; item: T }> }
  | { type: 'insert'; index: number; item: T }
  | { type: 'replace'; items: T[] }
  | { type: 'clear' }
  | { type: 'filter'; predicate: (item: T, index: number) => boolean }
  | { type: 'map'; transform: (item: T, index: number) => T }
  | { type: 'sort'; compareFn?: (a: T, b: T) => number };

/**
 * Events emitted by the array store
 */
export interface ArrayStoreEmittedEvents {
  patches: {
    patches: Patch[];
    inversePatches: Patch[];
    snapshot: any;
  };
}

/**
 * Creates an XState store that wraps an array and emits Immer patches
 * for fine-grained synchronization with external systems.
 *
 * @param initialItems - Initial array items
 * @returns An XState store with array operations and patch emission
 *
 * @example
 * ```typescript
 * const store = createArrayStore<string>(['hello', 'world']);
 *
 * // Subscribe to patch events
 * store.on('patches', ({ patches, inversePatches }) => {
 *   console.log('Patches:', patches);
 *   // Sync patches to external system
 * });
 *
 * // Subscribe to state changes
 * store.subscribe((snapshot) => {
 *   console.log('Current items:', snapshot.context.items);
 * });
 *
 * // Modify the array
 * store.send({ type: 'push', item: 'new item' });
 * store.send({ type: 'update', index: 0, item: 'updated' });
 * ```
 */
export function createArrayStore<T>(initialItems: T[] = []) {
  return createStore<
    ArrayStoreContext<T>,
    ArrayStoreEvents<T>,
    ArrayStoreEmittedEvents
  >({
    context: {
      items: initialItems,
    },
    on: {
      push: (context, event, { emit }) => {
        const [nextState, patches, inversePatches] = produceWithPatches(
          context,
          (draft) => {
            draft.items.push(event.item);
          }
        );
        emit({
          type: 'patches',
          patches,
          inversePatches,
          snapshot: nextState,
        });
        return nextState;
      },

      pushMany: (context, event, { emit }) => {
        const [nextState, patches, inversePatches] = produceWithPatches(
          context,
          (draft) => {
            draft.items.push(...event.items);
          }
        );
        emit({
          type: 'patches',
          patches,
          inversePatches,
          snapshot: nextState,
        });
        return nextState;
      },

      remove: (context, event, { emit }) => {
        const [nextState, patches, inversePatches] = produceWithPatches(
          context,
          (draft) => {
            if (event.index >= 0 && event.index < draft.items.length) {
              draft.items.splice(event.index, 1);
            }
          }
        );
        emit({
          type: 'patches',
          patches,
          inversePatches,
          snapshot: nextState,
        });
        return nextState;
      },

      removeMany: (context, event, { emit }) => {
        const [nextState, patches, inversePatches] = produceWithPatches(
          context,
          (draft) => {
            // Sort indices in descending order to remove from end to start
            const sortedIndices = [...event.indices].sort((a, b) => b - a);
            for (const index of sortedIndices) {
              if (index >= 0 && index < draft.items.length) {
                draft.items.splice(index, 1);
              }
            }
          }
        );
        emit({
          type: 'patches',
          patches,
          inversePatches,
          snapshot: nextState,
        });
        return nextState;
      },

      update: (context, event, { emit }) => {
        const [nextState, patches, inversePatches] = produceWithPatches(
          context,
          (draft) => {
            if (event.index >= 0 && event.index < draft.items.length) {
              draft.items[event.index] = event.item;
            }
          }
        );
        emit({
          type: 'patches',
          patches,
          inversePatches,
          snapshot: nextState,
        });
        return nextState;
      },

      updateMany: (context, event, { emit }) => {
        const [nextState, patches, inversePatches] = produceWithPatches(
          context,
          (draft) => {
            for (const { index, item } of event.updates) {
              if (index >= 0 && index < draft.items.length) {
                draft.items[index] = item;
              }
            }
          }
        );
        emit({
          type: 'patches',
          patches,
          inversePatches,
          snapshot: nextState,
        });
        return nextState;
      },

      insert: (context, event, { emit }) => {
        const [nextState, patches, inversePatches] = produceWithPatches(
          context,
          (draft) => {
            const index = Math.max(0, Math.min(event.index, draft.items.length));
            draft.items.splice(index, 0, event.item);
          }
        );
        emit({
          type: 'patches',
          patches,
          inversePatches,
          snapshot: nextState,
        });
        return nextState;
      },

      replace: (context, event, { emit }) => {
        const [nextState, patches, inversePatches] = produceWithPatches(
          context,
          (draft) => {
            draft.items = event.items;
          }
        );
        emit({
          type: 'patches',
          patches,
          inversePatches,
          snapshot: nextState,
        });
        return nextState;
      },

      clear: (context, _event, { emit }) => {
        const [nextState, patches, inversePatches] = produceWithPatches(
          context,
          (draft) => {
            draft.items = [];
          }
        );
        emit({
          type: 'patches',
          patches,
          inversePatches,
          snapshot: nextState,
        });
        return nextState;
      },

      filter: (context, event, { emit }) => {
        const [nextState, patches, inversePatches] = produceWithPatches(
          context,
          (draft) => {
            draft.items = draft.items.filter(event.predicate);
          }
        );
        emit({
          type: 'patches',
          patches,
          inversePatches,
          snapshot: nextState,
        });
        return nextState;
      },

      map: (context, event, { emit }) => {
        const [nextState, patches, inversePatches] = produceWithPatches(
          context,
          (draft) => {
            draft.items = draft.items.map(event.transform);
          }
        );
        emit({
          type: 'patches',
          patches,
          inversePatches,
          snapshot: nextState,
        });
        return nextState;
      },

      sort: (context, event, { emit }) => {
        const [nextState, patches, inversePatches] = produceWithPatches(
          context,
          (draft) => {
            draft.items.sort(event.compareFn);
          }
        );
        emit({
          type: 'patches',
          patches,
          inversePatches,
          snapshot: nextState,
        });
        return nextState;
      },
    },
  });
}

/**
 * Type for the array store instance
 */
export type ArrayStore<T> = ReturnType<typeof createArrayStore<T>>;
