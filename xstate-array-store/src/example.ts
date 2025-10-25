import { createArrayStore } from './index';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

console.log('=== XState Array Store with Immer Patches Demo ===\n');

// Create a store with initial todos
const todoStore = createArrayStore<Todo>([
  { id: 1, text: 'Learn XState', completed: true },
  { id: 2, text: 'Learn Immer', completed: false },
]);

// Subscribe to state changes
console.log('1. Setting up subscribers...\n');
todoStore.subscribe((snapshot) => {
  console.log('Current state:', JSON.stringify(snapshot.context.items, null, 2));
});

// Subscribe to patch events for syncing
const patchHistory: any[] = [];
todoStore.on('patches', ({ patches, inversePatches, snapshot }) => {
  console.log('\n--- Patches emitted ---');
  console.log('Patches:', JSON.stringify(patches, null, 2));
  console.log('Inverse patches:', JSON.stringify(inversePatches, null, 2));

  patchHistory.push({ patches, inversePatches, snapshot });

  // Here you could sync patches to:
  // - A remote server via WebSocket
  // - LocalStorage
  // - IndexedDB
  // - Another UI component
  // - A collaborative editing backend
  console.log('(These patches can be sent to external systems for syncing)\n');
});

// Demo various operations
console.log('2. Testing PUSH operation...');
todoStore.send({
  type: 'push',
  item: { id: 3, text: 'Build something cool', completed: false }
});

console.log('\n3. Testing UPDATE operation...');
todoStore.send({
  type: 'update',
  index: 1,
  item: { id: 2, text: 'Learn Immer', completed: true }
});

console.log('\n4. Testing INSERT operation...');
todoStore.send({
  type: 'insert',
  index: 1,
  item: { id: 4, text: 'Understand patches', completed: false }
});

console.log('\n5. Testing REMOVE operation...');
todoStore.send({
  type: 'remove',
  index: 0
});

console.log('\n6. Testing PUSH MANY operation...');
todoStore.send({
  type: 'pushMany',
  items: [
    { id: 5, text: 'Test filtering', completed: false },
    { id: 6, text: 'Test sorting', completed: false },
  ]
});

console.log('\n7. Testing FILTER operation...');
todoStore.send({
  type: 'filter',
  predicate: (todo) => !todo.completed
});

console.log('\n8. Testing MAP operation (toggle completion)...');
todoStore.send({
  type: 'map',
  transform: (todo) => ({ ...todo, completed: !todo.completed })
});

console.log('\n9. Testing SORT operation...');
todoStore.send({
  type: 'sort',
  compareFn: (a, b) => a.text.localeCompare(b.text)
});

console.log('\n10. Testing UPDATE MANY operation...');
todoStore.send({
  type: 'updateMany',
  updates: [
    { index: 0, item: { id: 100, text: 'First updated', completed: true } },
    { index: 1, item: { id: 101, text: 'Second updated', completed: true } },
  ]
});

console.log('\n11. Testing CLEAR operation...');
todoStore.send({ type: 'clear' });

console.log('\n12. Testing REPLACE operation...');
todoStore.send({
  type: 'replace',
  items: [
    { id: 10, text: 'Start fresh', completed: false },
    { id: 11, text: 'New beginning', completed: false },
  ]
});

// Summary
console.log('\n=== Summary ===');
console.log(`Total operations performed: ${patchHistory.length}`);
console.log(`Final state:`, todoStore.getSnapshot().context.items);

console.log('\n=== Patch Types Observed ===');
const patchTypes = new Set(
  patchHistory.flatMap(h => h.patches.map((p: any) => p.op))
);
console.log('Operations:', Array.from(patchTypes).join(', '));

console.log('\n=== Use Cases for Patches ===');
console.log('1. Real-time collaboration: Send patches to other users');
console.log('2. Undo/Redo: Use inverse patches to revert changes');
console.log('3. Optimistic updates: Apply patches locally, sync to server');
console.log('4. Efficient syncing: Only send changes, not full state');
console.log('5. Audit trail: Keep history of all changes');
console.log('6. Conflict resolution: Merge patches from different sources');
