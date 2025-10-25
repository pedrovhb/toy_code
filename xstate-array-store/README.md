# XState Array Store with Immer Patches

A type-safe XState store that wraps an array and emits [Immer patches](https://immerjs.github.io/immer/patches) for fine-grained synchronization with external systems.

## Features

- **Type-safe array operations**: Push, remove, update, insert, filter, map, sort, and more
- **Immer patch emission**: Every change generates fine-grained patches and inverse patches
- **XState integration**: Built on `@xstate/store` for predictable state management
- **Fine-grained syncing**: Only the changes (patches) are emitted, not the entire state
- **Undo/Redo support**: Inverse patches enable time-travel debugging
- **Real-time collaboration ready**: Patches can be synced to remote systems

## Installation

```bash
npm install @xstate/store immer
```

Then copy `src/index.ts` to your project, or install this package if published.

## Quick Start

```typescript
import { createArrayStore } from './index';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

// Create a store
const store = createArrayStore<Todo>([
  { id: 1, text: 'Learn XState', completed: false }
]);

// Subscribe to state changes
store.subscribe((snapshot) => {
  console.log('Current items:', snapshot.context.items);
});

// Subscribe to patch events for syncing
store.on('patches', ({ patches, inversePatches, snapshot }) => {
  console.log('Patches:', patches);
  // Sync patches to external system (WebSocket, REST API, etc.)
});

// Modify the array
store.send({ type: 'push', item: { id: 2, text: 'Learn Immer', completed: false } });
store.send({ type: 'update', index: 0, item: { id: 1, text: 'Learn XState', completed: true } });
store.send({ type: 'remove', index: 1 });
```

## API Reference

### Creating a Store

```typescript
const store = createArrayStore<T>(initialItems?: T[]);
```

### Available Events

#### Single Item Operations

```typescript
// Add item to end
store.send({ type: 'push', item: T });

// Remove item at index
store.send({ type: 'remove', index: number });

// Update item at index
store.send({ type: 'update', index: number, item: T });

// Insert item at index
store.send({ type: 'insert', index: number, item: T });
```

#### Batch Operations

```typescript
// Add multiple items
store.send({ type: 'pushMany', items: T[] });

// Remove multiple items
store.send({ type: 'removeMany', indices: number[] });

// Update multiple items
store.send({
  type: 'updateMany',
  updates: Array<{ index: number; item: T }>
});
```

#### Array Transformations

```typescript
// Filter items
store.send({
  type: 'filter',
  predicate: (item: T, index: number) => boolean
});

// Map/transform items
store.send({
  type: 'map',
  transform: (item: T, index: number) => T
});

// Sort items
store.send({
  type: 'sort',
  compareFn?: (a: T, b: T) => number
});
```

#### Wholesale Operations

```typescript
// Replace entire array
store.send({ type: 'replace', items: T[] });

// Clear all items
store.send({ type: 'clear' });
```

### Subscribing to Changes

```typescript
// Subscribe to state changes
const unsubscribe = store.subscribe((snapshot) => {
  console.log(snapshot.context.items);
});

// Subscribe to patch events
store.on('patches', ({ patches, inversePatches, snapshot }) => {
  // patches: Array of changes made
  // inversePatches: Array of changes to undo the operation
  // snapshot: The new state after applying patches
});

// Get current state
const currentState = store.getSnapshot();
```

## Patch Format

Patches follow the [RFC-6902 JSON Patch](https://tools.ietf.org/html/rfc6902) standard with array-based paths:

```typescript
// Add operation
{
  "op": "add",
  "path": ["items", 2],
  "value": { id: 3, text: "New item", completed: false }
}

// Replace operation
{
  "op": "replace",
  "path": ["items", 0],
  "value": { id: 1, text: "Updated item", completed: true }
}

// Remove operation
{
  "op": "remove",
  "path": ["items", 1]
}
```

## Syncing with External Systems

The library provides powerful utilities for applying patches and syncing state across systems.

### Basic Patch Application

Apply patches to any data structure (arrays, objects, Maps, etc.):

```typescript
import { applyPatchesToState } from './sync';

const state = { users: ['Alice', 'Bob'], count: 2 };
const patches = [
  { op: 'add', path: ['users', 2], value: 'Charlie' },
  { op: 'replace', path: ['count'], value: 3 }
];

const newState = applyPatchesToState(state, patches);
// newState = { users: ['Alice', 'Bob', 'Charlie'], count: 3 }
```

### SyncTarget - Receiving Remote Updates

For one-way syncing (receiving updates from a remote source):

```typescript
import { SyncTarget } from './sync';

const target = new SyncTarget({
  initialState: { todos: [] },
  onChange: (newState, patches) => {
    console.log('State updated:', newState);
  },
  onRemotePatches: (patches) => {
    console.log('Received patches from remote');
  }
});

// When you receive patches from remote
websocket.on('message', (data) => {
  const { patches } = JSON.parse(data);
  target.applyRemotePatches(patches);
});
```

### SyncManager - Bidirectional Syncing

For two-way syncing with automatic patch transmission:

```typescript
import { SyncManager } from './sync';

const manager = new SyncManager({
  initialState: { items: [] },
  sendToRemote: async (patches) => {
    // Send patches to server
    await fetch('/api/sync', {
      method: 'POST',
      body: JSON.stringify(patches)
    });
  },
  onLocalChange: (state, patches) => {
    console.log('Local change:', patches);
  },
  onRemoteChange: (state, patches) => {
    console.log('Remote change:', patches);
  },
  autoSync: true // Automatically sync local changes
});

// Apply local changes (will auto-sync if autoSync is true)
await manager.applyLocalPatches(patches, inversePatches);

// Apply remote changes
manager.applyRemotePatches(remotePatchesFromServer);
```

### Syncing Two Stores

Keep two XState stores in sync:

```typescript
import { createArrayStore } from './index';
import { applyPatchesToState } from './sync';

const storeA = createArrayStore([1, 2, 3]);
const storeB = createArrayStore([1, 2, 3]);

// Sync A → B
storeA.on('patches', ({ patches }) => {
  const currentB = storeB.getSnapshot().context;
  const newContext = applyPatchesToState(currentB, patches);
  storeB.send({ type: 'replace', items: newContext.items });
});

// Sync B → A
storeB.on('patches', ({ patches }) => {
  const currentA = storeA.getSnapshot().context;
  const newContext = applyPatchesToState(currentA, patches);
  storeA.send({ type: 'replace', items: newContext.items });
});
```

### Patch Utilities

Useful utilities for working with patches:

```typescript
import { PatchUtils } from './sync';

// Format patches for logging
console.log(PatchUtils.formatPatches(patches));
// Output:
// ADD users.2 = {"name":"Charlie"}
// REPLACE count = 3

// Filter patches by path
const userPatches = PatchUtils.filterByPath(patches, ['users']);

// Check if patches affect a path
const affectsUsers = PatchUtils.affectsPath(patches, ['users']);

// Get root paths affected
const roots = PatchUtils.getAffectedRootPaths(patches);
// Returns: ['users', 'count']

// Merge multiple patch arrays
const merged = PatchUtils.mergePatches(patches1, patches2, patches3);
```

## Use Cases

### Real-time Collaboration

```typescript
store.on('patches', ({ patches }) => {
  // Send patches via WebSocket
  websocket.send(JSON.stringify({ type: 'patches', patches }));
});

// Apply remote patches
websocket.on('message', (message) => {
  const { patches } = JSON.parse(message);
  applyPatches(store.getSnapshot().context, patches);
});
```

### Undo/Redo

```typescript
const history: Patch[][] = [];
const inverseHistory: Patch[][] = [];

store.on('patches', ({ patches, inversePatches }) => {
  history.push(patches);
  inverseHistory.push(inversePatches);
});

function undo() {
  const inverse = inverseHistory.pop();
  if (inverse) {
    // Apply inverse patches to revert
    const current = store.getSnapshot().context;
    const reverted = applyPatches(current, inverse);
    store.send({ type: 'replace', items: reverted.items });
  }
}
```

### Optimistic Updates

```typescript
store.on('patches', async ({ patches }) => {
  try {
    // Apply locally first (already done by store)
    // Then sync to server
    await fetch('/api/sync', {
      method: 'POST',
      body: JSON.stringify(patches)
    });
  } catch (error) {
    // Revert using inverse patches on failure
    console.error('Sync failed, reverting...');
  }
});
```

### Audit Trail

```typescript
const auditLog: Array<{
  timestamp: Date;
  patches: Patch[];
  inversePatches: Patch[];
}> = [];

store.on('patches', ({ patches, inversePatches }) => {
  auditLog.push({
    timestamp: new Date(),
    patches,
    inversePatches
  });
});

// Later: replay all changes
auditLog.forEach(({ patches }) => {
  console.log('Change at', entry.timestamp, ':', patches);
});
```

## Running the Examples

```bash
npm install

# Run the basic array store example
npm run dev

# Run the sync examples (patch application, SyncTarget, SyncManager, etc.)
npm run dev:sync
```

- `src/example.ts` - Shows all array operations and their patches
- `src/sync-examples.ts` - Demonstrates syncing patterns and utilities

## Building

```bash
npm run build
```

## Why Use This?

1. **Efficiency**: Only changes are transmitted, not the full state
2. **Type Safety**: Full TypeScript support with generics
3. **Predictability**: XState provides deterministic state management
4. **Flexibility**: Patches can be sent anywhere (WebSocket, REST, IndexedDB, etc.)
5. **Time Travel**: Inverse patches enable undo/redo
6. **Collaboration**: Fine-grained patches make real-time collaboration easier
7. **Audit Trail**: Every change is recorded with precise details

## License

MIT
