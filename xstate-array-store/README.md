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

## Running the Example

```bash
npm install
npm run dev
```

This will run the comprehensive example in `src/example.ts` showing all operations and their patches.

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
