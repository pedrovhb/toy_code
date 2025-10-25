import { createArrayStore } from './index';
import {
  SyncManager,
  SyncTarget,
  createSyncBridge,
  applyPatchesToState,
  PatchUtils
} from './sync';
import { Patch } from 'immer';

async function runExamples() {
  console.log('=== Patch Application & Syncing Examples ===\n');

  // ============================================================================
  // Example 1: Basic Patch Application
  // ============================================================================
  console.log('--- Example 1: Basic Patch Application ---\n');

  const initialData = {
    users: [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 }
    ],
    metadata: {
      count: 2,
      lastUpdated: '2024-01-01'
    }
  };

  console.log('Initial state:', JSON.stringify(initialData, null, 2));

  // Patches that would come from a remote source
  const patches: Patch[] = [
    { op: 'add', path: ['users', 2], value: { id: 3, name: 'Charlie', age: 35 } },
    { op: 'replace', path: ['metadata', 'count'], value: 3 },
    { op: 'replace', path: ['metadata', 'lastUpdated'], value: '2024-01-02' }
  ];

  console.log('\nApplying patches:', PatchUtils.formatPatches(patches));

  const newData = applyPatchesToState(initialData, patches);
  console.log('\nNew state:', JSON.stringify(newData, null, 2));

  // ============================================================================
  // Example 2: SyncTarget - Receiving Remote Updates
  // ============================================================================
  console.log('\n\n--- Example 2: SyncTarget - Receiving Remote Updates ---\n');

  interface TodoState {
    todos: Array<{ id: number; text: string; completed: boolean }>;
    filter: 'all' | 'active' | 'completed';
  }

  const syncTarget = new SyncTarget<TodoState>({
    initialState: {
      todos: [
        { id: 1, text: 'Learn XState', completed: false },
        { id: 2, text: 'Learn Immer', completed: false }
      ],
      filter: 'all'
    },
    onChange: (newState, patches) => {
      console.log('State changed!');
      console.log('Patches applied:', PatchUtils.formatPatches(patches));
      console.log('New state:', JSON.stringify(newState, null, 2));
    },
    onRemotePatches: (patches) => {
      console.log(`Received ${patches.length} patch(es) from remote`);
    }
  });

  console.log('Initial state:', JSON.stringify(syncTarget.getState(), null, 2));

  // Simulate receiving patches from remote
  console.log('\nSimulating remote update...');
  const remotePatches: Patch[] = [
    { op: 'replace', path: ['todos', 0, 'completed'], value: true },
    { op: 'add', path: ['todos', 2], value: { id: 3, text: 'Build something', completed: false } }
  ];

  syncTarget.applyRemotePatches(remotePatches);

  // ============================================================================
  // Example 3: Bidirectional Sync with SyncManager
  // ============================================================================
  console.log('\n\n--- Example 3: Bidirectional Sync with SyncManager ---\n');

  // Simulate a simple in-memory message queue for demonstration
  const messageQueue: Patch[][] = [];

  const syncManager = new SyncManager({
    initialState: {
      items: ['apple', 'banana', 'cherry']
    },
    sendToRemote: async (patches) => {
      console.log('📤 Sending to remote:', PatchUtils.formatPatches(patches));
      messageQueue.push(patches);
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 10));
    },
    onLocalChange: (newState, patches) => {
      console.log('Local change detected');
      console.log('New local state:', JSON.stringify(newState, null, 2));
    },
    onRemoteChange: (newState, patches) => {
      console.log('📥 Remote change received');
      console.log('Patches:', PatchUtils.formatPatches(patches));
      console.log('New state:', JSON.stringify(newState, null, 2));
    },
    autoSync: true
  });

  console.log('Initial state:', JSON.stringify(syncManager.getState(), null, 2));

  // Apply local changes
  console.log('\nApplying local changes...');
  const localPatches: Patch[] = [
    { op: 'add', path: ['items', 3], value: 'date' }
  ];
  const inversePatches: Patch[] = [
    { op: 'remove', path: ['items', 3] }
  ];

  await syncManager.applyLocalPatches(localPatches, inversePatches);

  // Simulate receiving updates from remote
  console.log('\n\nSimulating remote update...');
  const incomingPatches: Patch[] = [
    { op: 'replace', path: ['items', 0], value: 'avocado' }
  ];
  syncManager.applyRemotePatches(incomingPatches);

  console.log('\nFinal state:', JSON.stringify(syncManager.getState(), null, 2));

  // ============================================================================
  // Example 4: Syncing Two XState Array Stores
  // ============================================================================
  console.log('\n\n--- Example 4: Syncing Two XState Array Stores ---\n');

  interface Task {
    id: number;
    title: string;
    priority: 'low' | 'medium' | 'high';
  }

  // Create two stores that will be kept in sync
  const storeA = createArrayStore<Task>([
    { id: 1, title: 'Design UI', priority: 'high' },
    { id: 2, title: 'Write tests', priority: 'medium' }
  ]);

  const storeB = createArrayStore<Task>([
    { id: 1, title: 'Design UI', priority: 'high' },
    { id: 2, title: 'Write tests', priority: 'medium' }
  ]);

  // Create a bridge to sync them
  let syncingFromA = false;
  let syncingFromB = false;

  storeA.on('patches', ({ patches }) => {
    if (!syncingFromB) {
      syncingFromA = true;
      console.log('📤 Store A → Store B:', PatchUtils.formatPatches(patches));
      // Apply patches to store B's state
      const currentB = storeB.getSnapshot().context;
      const newContext = applyPatchesToState(currentB, patches);
      storeB.send({ type: 'replace', items: newContext.items });
      syncingFromA = false;
    }
  });

  storeB.on('patches', ({ patches }) => {
    if (!syncingFromA) {
      syncingFromB = true;
      console.log('📤 Store B → Store A:', PatchUtils.formatPatches(patches));
      // Apply patches to store A's state
      const currentA = storeA.getSnapshot().context;
      const newContext = applyPatchesToState(currentA, patches);
      storeA.send({ type: 'replace', items: newContext.items });
      syncingFromB = false;
    }
  });

  console.log('Store A initial:', storeA.getSnapshot().context.items);
  console.log('Store B initial:', storeB.getSnapshot().context.items);

  console.log('\n\nModifying Store A...');
  storeA.send({ type: 'push', item: { id: 3, title: 'Deploy to prod', priority: 'high' } });

  console.log('\nStore A after change:', storeA.getSnapshot().context.items);
  console.log('Store B after sync:', storeB.getSnapshot().context.items);

  console.log('\n\nModifying Store B...');
  storeB.send({ type: 'update', index: 0, item: { id: 1, title: 'Design UI (Updated)', priority: 'high' } });

  console.log('\nStore A after sync:', storeA.getSnapshot().context.items);
  console.log('Store B after change:', storeB.getSnapshot().context.items);

  // ============================================================================
  // Example 5: Syncing with Maps and Complex Objects
  // ============================================================================
  console.log('\n\n--- Example 5: Syncing with Maps and Complex Objects ---\n');

  interface AppState {
    users: Map<string, { name: string; online: boolean }>;
    messages: Array<{ id: string; text: string; userId: string }>;
  }

  // Note: Immer supports Maps!
  const appState: any = {
    users: new Map([
      ['user1', { name: 'Alice', online: true }],
      ['user2', { name: 'Bob', online: false }]
    ]),
    messages: [
      { id: 'msg1', text: 'Hello!', userId: 'user1' }
    ]
  };

  console.log('Initial state:');
  console.log('Users:', Array.from(appState.users.entries()));
  console.log('Messages:', appState.messages);

  // Apply patches to add a message and update user status
  const complexPatches: Patch[] = [
    { op: 'add', path: ['messages', 1], value: { id: 'msg2', text: 'Hi there!', userId: 'user2' } },
    { op: 'replace', path: ['users', 'user2', 'online'], value: true }
  ];

  console.log('\nApplying patches:', PatchUtils.formatPatches(complexPatches));
  const newAppState = applyPatchesToState(appState, complexPatches);

  console.log('\nNew state:');
  console.log('Users:', Array.from(newAppState.users.entries()));
  console.log('Messages:', newAppState.messages);

  // ============================================================================
  // Example 6: Patch Utilities
  // ============================================================================
  console.log('\n\n--- Example 6: Patch Utilities ---\n');

  const mixedPatches: Patch[] = [
    { op: 'replace', path: ['users', 0, 'name'], value: 'Updated Name' },
    { op: 'add', path: ['users', 1], value: { id: 2, name: 'New User' } },
    { op: 'replace', path: ['metadata', 'count'], value: 2 },
    { op: 'remove', path: ['cache', 'old-key'] }
  ];

  console.log('All patches:');
  console.log(PatchUtils.formatPatches(mixedPatches));

  console.log('\n\nPatches affecting "users" path:');
  const usersPatches = PatchUtils.filterByPath(mixedPatches, ['users']);
  console.log(PatchUtils.formatPatches(usersPatches));

  console.log('\n\nRoot paths affected:');
  console.log(PatchUtils.getAffectedRootPaths(mixedPatches));

  console.log('\n\nChecking if patches affect ["users", 0]:');
  console.log(PatchUtils.affectsPath(mixedPatches, ['users', 0]));

  // ============================================================================
  // Example 7: Simulated WebSocket Sync
  // ============================================================================
  console.log('\n\n--- Example 7: Simulated WebSocket Sync ---\n');

  // Simulate a WebSocket connection
  class MockWebSocket {
    private handlers: Map<string, Function[]> = new Map();

    on(event: string, handler: Function) {
      if (!this.handlers.has(event)) {
        this.handlers.set(event, []);
      }
      this.handlers.get(event)!.push(handler);
    }

    send(data: string) {
      console.log('📡 WebSocket send:', data);
      // Simulate receiving the message back after a delay
      setTimeout(() => {
        const handlers = this.handlers.get('message') || [];
        handlers.forEach(h => h(data));
      }, 50);
    }
  }

  const ws = new MockWebSocket();

  const wsSync = new SyncManager({
    initialState: { counter: 0, items: [] as string[] },
    sendToRemote: async (patches) => {
      ws.send(JSON.stringify({ type: 'patches', patches }));
    },
    onLocalChange: (state, patches) => {
      console.log('💻 Local change:', { counter: state.counter, items: state.items });
    },
    onRemoteChange: (state, patches) => {
      console.log('🌐 Remote change:', { counter: state.counter, items: state.items });
    }
  });

  ws.on('message', (data: string) => {
    const message = JSON.parse(data);
    if (message.type === 'patches') {
      // Simulate receiving patches from another client
      console.log('📨 Received from WebSocket');
    }
  });

  console.log('Applying local changes...');
  await wsSync.applyLocalPatches(
    [{ op: 'replace', path: ['counter'], value: 1 }],
    [{ op: 'replace', path: ['counter'], value: 0 }]
  );

  await wsSync.applyLocalPatches(
    [{ op: 'add', path: ['items', 0], value: 'first' }],
    [{ op: 'remove', path: ['items', 0] }]
  );

  // Wait a bit for simulated WebSocket messages
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('\n\n=== Summary ===');
  console.log('✅ Basic patch application');
  console.log('✅ SyncTarget for receiving remote updates');
  console.log('✅ SyncManager for bidirectional syncing');
  console.log('✅ Syncing two XState stores');
  console.log('✅ Syncing Maps and complex objects');
  console.log('✅ Patch utility functions');
  console.log('✅ Simulated WebSocket syncing');
  console.log('\nAll sync patterns demonstrated successfully!');
}

// Run the examples
runExamples().catch(console.error);
