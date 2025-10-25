import { applyPatches, enablePatches, enableMapSet, Patch } from 'immer';

// Ensure patches and MapSet support are enabled
enablePatches();
enableMapSet();

/**
 * Apply Immer patches to any data structure (object, array, Map, etc.)
 *
 * @param baseState - The current state to apply patches to
 * @param patches - Array of patches to apply
 * @returns The new state after applying patches
 *
 * @example
 * ```typescript
 * const state = { items: [1, 2, 3] };
 * const patches = [{ op: 'add', path: ['items', 3], value: 4 }];
 * const newState = applyPatchesToState(state, patches);
 * // newState = { items: [1, 2, 3, 4] }
 * ```
 */
export function applyPatchesToState<T>(baseState: T, patches: Patch[]): T {
  return applyPatches(baseState, patches);
}

/**
 * Options for creating a sync target
 */
export interface SyncTargetOptions<T> {
  /**
   * Initial state
   */
  initialState: T;

  /**
   * Callback when state changes locally (before patches are applied)
   */
  onBeforeChange?: (oldState: T, patches: Patch[]) => void;

  /**
   * Callback when state changes (after patches are applied)
   */
  onChange?: (newState: T, patches: Patch[], inversePatches: Patch[]) => void;

  /**
   * Callback when patches are received from remote source
   */
  onRemotePatches?: (patches: Patch[]) => void;
}

/**
 * A sync target that can receive and apply patches from external sources
 * while maintaining its own state.
 */
export class SyncTarget<T> {
  private state: T;
  private options: SyncTargetOptions<T>;
  private patchHistory: Array<{ patches: Patch[]; inversePatches: Patch[] }> = [];

  constructor(options: SyncTargetOptions<T>) {
    this.options = options;
    this.state = options.initialState;
  }

  /**
   * Get the current state
   */
  getState(): T {
    return this.state;
  }

  /**
   * Apply patches from a remote source
   *
   * @param patches - Patches to apply
   * @returns The new state after applying patches
   */
  applyRemotePatches(patches: Patch[]): T {
    this.options.onBeforeChange?.(this.state, patches);
    this.options.onRemotePatches?.(patches);

    this.state = applyPatches(this.state, patches);

    this.options.onChange?.(this.state, patches, []);

    return this.state;
  }

  /**
   * Get the patch history
   */
  getHistory() {
    return this.patchHistory;
  }

  /**
   * Clear the patch history
   */
  clearHistory() {
    this.patchHistory = [];
  }
}

/**
 * Options for the sync manager
 */
export interface SyncManagerOptions<T> {
  /**
   * Initial state
   */
  initialState: T;

  /**
   * Callback to send patches to remote (e.g., via WebSocket)
   */
  sendToRemote?: (patches: Patch[]) => void | Promise<void>;

  /**
   * Callback when state changes locally
   */
  onLocalChange?: (newState: T, patches: Patch[], inversePatches: Patch[]) => void;

  /**
   * Callback when state changes from remote patches
   */
  onRemoteChange?: (newState: T, patches: Patch[]) => void;

  /**
   * Whether to automatically send patches to remote on local changes
   */
  autoSync?: boolean;
}

/**
 * Manages bidirectional syncing between local state and remote sources.
 * Handles patch application and transmission.
 *
 * @example
 * ```typescript
 * const manager = new SyncManager({
 *   initialState: { items: [] },
 *   sendToRemote: async (patches) => {
 *     await websocket.send(JSON.stringify({ type: 'patches', patches }));
 *   },
 *   autoSync: true
 * });
 *
 * // Apply local changes
 * manager.applyLocalPatches(patches, inversePatches);
 *
 * // Receive remote changes
 * websocket.on('message', (data) => {
 *   const { patches } = JSON.parse(data);
 *   manager.applyRemotePatches(patches);
 * });
 * ```
 */
export class SyncManager<T> {
  private state: T;
  private options: SyncManagerOptions<T>;
  private patchQueue: Patch[] = [];
  private isApplyingRemotePatches = false;

  constructor(options: SyncManagerOptions<T>) {
    this.options = { autoSync: true, ...options };
    this.state = options.initialState;
  }

  /**
   * Get the current state
   */
  getState(): T {
    return this.state;
  }

  /**
   * Apply patches from local changes and optionally sync to remote
   *
   * @param patches - Patches generated locally
   * @param inversePatches - Inverse patches for undo
   * @param sync - Whether to sync to remote (defaults to autoSync option)
   */
  async applyLocalPatches(
    patches: Patch[],
    inversePatches: Patch[],
    sync: boolean = this.options.autoSync ?? true
  ): Promise<T> {
    // Don't create infinite loops
    if (this.isApplyingRemotePatches) {
      return this.state;
    }

    this.state = applyPatches(this.state, patches);
    this.options.onLocalChange?.(this.state, patches, inversePatches);

    if (sync && this.options.sendToRemote) {
      try {
        await this.options.sendToRemote(patches);
      } catch (error) {
        console.error('Failed to sync patches to remote:', error);
        // Could implement retry logic or rollback here
      }
    }

    return this.state;
  }

  /**
   * Apply patches received from a remote source
   *
   * @param patches - Patches from remote
   * @returns The new state after applying patches
   */
  applyRemotePatches(patches: Patch[]): T {
    this.isApplyingRemotePatches = true;

    try {
      this.state = applyPatches(this.state, patches);
      this.options.onRemoteChange?.(this.state, patches);
      return this.state;
    } finally {
      this.isApplyingRemotePatches = false;
    }
  }

  /**
   * Queue patches for batch processing
   */
  queuePatches(patches: Patch[]) {
    this.patchQueue.push(...patches);
  }

  /**
   * Flush queued patches
   */
  async flushQueue(): Promise<T> {
    if (this.patchQueue.length === 0) {
      return this.state;
    }

    const patches = [...this.patchQueue];
    this.patchQueue = [];

    if (this.options.sendToRemote) {
      await this.options.sendToRemote(patches);
    }

    return this.state;
  }

  /**
   * Replace the entire state (useful for initial sync)
   */
  setState(newState: T) {
    this.state = newState;
  }
}

/**
 * Create a sync bridge between two sync targets or managers
 *
 * @example
 * ```typescript
 * const store1 = createArrayStore([1, 2, 3]);
 * const store2 = createArrayStore([1, 2, 3]);
 *
 * const bridge = createSyncBridge(
 *   (patches) => store2.applyRemotePatches(patches),
 *   (patches) => store1.applyRemotePatches(patches)
 * );
 *
 * store1.on('patches', ({ patches }) => bridge.syncFromAToB(patches));
 * store2.on('patches', ({ patches }) => bridge.syncFromBToA(patches));
 * ```
 */
export interface SyncBridge {
  syncFromAToB: (patches: Patch[]) => void;
  syncFromBToA: (patches: Patch[]) => void;
  disconnect: () => void;
}

export function createSyncBridge(
  applyToB: (patches: Patch[]) => void,
  applyToA: (patches: Patch[]) => void
): SyncBridge {
  let connected = true;

  return {
    syncFromAToB: (patches: Patch[]) => {
      if (connected) {
        applyToB(patches);
      }
    },
    syncFromBToA: (patches: Patch[]) => {
      if (connected) {
        applyToA(patches);
      }
    },
    disconnect: () => {
      connected = false;
    }
  };
}

/**
 * Utilities for working with patches
 */
export const PatchUtils = {
  /**
   * Merge multiple patch arrays into one
   */
  mergePatches(...patchArrays: Patch[][]): Patch[] {
    return patchArrays.flat();
  },

  /**
   * Check if patches affect a specific path
   */
  affectsPath(patches: Patch[], path: (string | number)[]): boolean {
    return patches.some(patch => {
      if (patch.path.length < path.length) {
        return false;
      }

      return path.every((segment, index) => patch.path[index] === segment);
    });
  },

  /**
   * Filter patches that affect a specific path
   */
  filterByPath(patches: Patch[], path: (string | number)[]): Patch[] {
    return patches.filter(patch => this.affectsPath([patch], path));
  },

  /**
   * Get the root paths affected by patches
   */
  getAffectedRootPaths(patches: Patch[]): (string | number)[] {
    const roots = new Set<string | number>();
    for (const patch of patches) {
      if (patch.path.length > 0) {
        roots.add(patch.path[0]);
      }
    }
    return Array.from(roots);
  },

  /**
   * Convert patches to a human-readable format
   */
  formatPatches(patches: Patch[]): string {
    return patches.map(patch => {
      const path = patch.path.join('.');
      switch (patch.op) {
        case 'add':
          return `ADD ${path} = ${JSON.stringify(patch.value)}`;
        case 'remove':
          return `REMOVE ${path}`;
        case 'replace':
          return `REPLACE ${path} = ${JSON.stringify(patch.value)}`;
        default:
          return `${patch.op.toUpperCase()} ${path}`;
      }
    }).join('\n');
  }
};
