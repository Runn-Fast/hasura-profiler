import { test as anyTest, expect } from 'vitest';
import { flushSync } from 'svelte';
import { assertOk, assertError } from '@stayradiated/error-boundary';

import { createHasuraStore } from './hasura.svelte.js';

import { useGlobalAgent } from '$lib/test/use-global-agent.js';
import { useStorage, MockStorage } from '$lib/test/use-storage.js';

// Setup test with agent fixture and mock storage
const test = anyTest.extend({
	agent: useGlobalAgent('http://localhost:8080'),
	storage: useStorage()
});

test('should initialize with empty state', () => {
	const hasuraStore = createHasuraStore();

	expect(hasuraStore.serverList).toEqual([]);
	expect(hasuraStore.selectedServer).toBeUndefined();
	expect(hasuraStore.connection.status).toBe('idle');
});

test('should load servers from storage', () => {
	const cleanup = $effect.root(() => {
		const savedServerList = {
			serverList: [
				{
					id: '123',
					name: 'Test Server',
					url: 'http://localhost:8080',
					password: 'testPassword'
				}
			],
			selectedServerId: '123'
		};

		// Create a store with pre-populated storage using our factory
		const storageWithData = new MockStorage({
			hasura_serverList: JSON.stringify(savedServerList)
		});

		const storeWithConnection = createHasuraStore({ storage: storageWithData });

		expect(storeWithConnection.serverList).toHaveLength(1);
		expect(storeWithConnection.selectedServer).toBeDefined();
		expect(storeWithConnection.selectedServer?.name).toBe('Test Server');
		expect(storeWithConnection.selectedServer?.url).toBe('http://localhost:8080');
		expect(storeWithConnection.selectedServer?.password).toBe('testPassword');
		expect(storeWithConnection.connection.status).toBe('idle');
	});

	cleanup();
});

test('should add a new server', ({ storage }) => {
	const cleanup = $effect.root(() => {
		const hasuraStore = createHasuraStore({ storage });

		const serverId = hasuraStore.addServer('Test Server', 'http://localhost:8080', 'testPassword');
		flushSync();

		expect(hasuraStore.serverList).toHaveLength(1);
		expect(hasuraStore.serverList[0].id).toBe(serverId);
		expect(hasuraStore.serverList[0].name).toBe('Test Server');
		expect(hasuraStore.serverList[0].url).toBe('http://localhost:8080');
		expect(hasuraStore.serverList[0].password).toBe('testPassword');

		// First server should be auto-selected
		expect(hasuraStore.selectedServer).toBeDefined();
		expect(hasuraStore.selectedServer?.id).toBe(serverId);

		// Check if it saved to storage
		const savedData = JSON.parse(storage.getItem('hasura_serverList') || '{}');
		expect(savedData.serverList).toHaveLength(1);
		expect(savedData.selectedServerId).toBe(serverId);
	});

	cleanup();
});

test('should update a server', ({ storage }) => {
	const cleanup = $effect.root(() => {
		const hasuraStore = createHasuraStore({ storage });

		// Add a server first
		const serverId = hasuraStore.addServer('Test Server', 'http://localhost:8080', 'testPassword');
		flushSync();

		// Update the server
		hasuraStore.updateServer(serverId, 'Updated Server', 'http://localhost:8081', 'newPassword');
		flushSync();

		expect(hasuraStore.serverList).toHaveLength(1);
		expect(hasuraStore.serverList[0].name).toBe('Updated Server');
		expect(hasuraStore.serverList[0].url).toBe('http://localhost:8081');
		expect(hasuraStore.serverList[0].password).toBe('newPassword');

		// Verify storage was updated
		const savedData = JSON.parse(storage.getItem('hasura_serverList') || '{}');
		expect(savedData.serverList[0].name).toBe('Updated Server');
	});

	cleanup();
});

test('should remove a server', ({ storage }) => {
	const cleanup = $effect.root(() => {
		const hasuraStore = createHasuraStore({ storage });

		// Add a server first
		const serverId = hasuraStore.addServer('Test Server', 'http://localhost:8080', 'testPassword');
		flushSync();

		// Remove the server
		hasuraStore.removeServer(serverId);
		flushSync();

		expect(hasuraStore.serverList).toHaveLength(0);
		expect(hasuraStore.selectedServer).toBeUndefined();

		// Verify storage was updated
		const savedData = JSON.parse(storage.getItem('hasura_serverList') || '{}');
		expect(savedData.serverList).toHaveLength(0);
		expect(savedData.selectedServerId).toBeUndefined();
	});

	cleanup();
});

test('should select a server', ({ storage }) => {
	const cleanup = $effect.root(() => {
		const hasuraStore = createHasuraStore({ storage });

		// Add two servers
		const serverId1 = hasuraStore.addServer('Test Server 1', 'http://localhost:8080', 'password1');
		const serverId2 = hasuraStore.addServer('Test Server 2', 'http://localhost:8081', 'password2');
		flushSync();

		// First server should be selected by default
		expect(hasuraStore.selectedServer?.id).toBe(serverId1);

		// Select the second server
		hasuraStore.selectServer(serverId2);
		flushSync();

		expect(hasuraStore.selectedServer?.id).toBe(serverId2);
		expect(hasuraStore.selectedServer?.name).toBe('Test Server 2');

		// Verify storage was updated
		const savedData = JSON.parse(storage.getItem('hasura_serverList') || '{}');
		expect(savedData.selectedServerId).toBe(serverId2);
	});

	cleanup();
});

test('should test connection successfully', async ({ agent }) => {
	const adminSecret = 'test-password-1';

	// Setup mock response for successful connection
	agent
		.intercept({
			method: 'POST',
			path: '/v2/query',
			headers: {
				'x-hasura-admin-secret': adminSecret
			}
		})
		.reply(200, {
			result_type: 'TuplesOk',
			result: [['connection_test'], ['1']]
		})
		.times(1);

	const hasuraStore = createHasuraStore();

	// Add a server
	const serverId = hasuraStore.addServer('Test Server', 'http://localhost:8080', adminSecret);
	hasuraStore.selectServer(serverId);
	flushSync();

	// Test connection
	const result = await hasuraStore.testConnection();

	assertOk(result);
	expect(result).toBe(true);

	// Verify connection state
	flushSync();
	expect(hasuraStore.connection.status).toBe('ready');
});

test('should handle connection failure', async ({ agent }) => {
	const adminSecret = 'test-password-2';

	// Setup mock response for failed connection
	agent
		.intercept({
			method: 'POST',
			path: '/v2/query',
			headers: {
				'x-hasura-admin-secret': adminSecret
			}
		})
		.reply(403, {
			error: 'invalid x-hasura-admin-secret/x-hasura-access-key',
			path: '$',
			code: 'access-denied'
		})
		.times(1);

	const hasuraStore = createHasuraStore();

	// Add a server
	const serverId = hasuraStore.addServer('Test Server', 'http://localhost:8080', adminSecret);
	hasuraStore.selectServer(serverId);
	flushSync();

	// Test connection
	const result = await hasuraStore.testConnection();
	assertOk(result);
	expect(result).toBe(false);

	// Verify connection state
	flushSync();
	expect(hasuraStore.connection.status).toBe('error');
});

test('should execute GraphQL query successfully', async ({ agent }) => {
	const adminSecret = 'test-password-3';

	agent
		.intercept({
			method: 'POST',
			path: '/v1/graphql',
			headers: { 'x-hasura-admin-secret': adminSecret }
		})
		.reply(200, {
			data: {
				users: [{ id: 1, name: 'Test User' }]
			}
		})
		.times(1);

	const hasuraStore = createHasuraStore();

	// Add and select a server
	const serverId = hasuraStore.addServer('Test Server', 'http://localhost:8080', adminSecret);
	hasuraStore.selectServer(serverId);
	flushSync();

	// Execute GraphQL query
	const query = `query { users { id name } }`;
	const result = await hasuraStore.executeGraphQL<{
		users: Array<{ id: number; name: string }>;
	}>(query);

	// Verify result
	assertOk(result);
	expect(result.data.users[0].name).toBe('Test User');
});

test('should handle GraphQL query with errors', async ({ agent }) => {
	const adminSecret = 'test-password-4';

	agent
		.intercept({
			method: 'POST',
			path: '/v1/graphql',
			headers: { 'x-hasura-admin-secret': adminSecret }
		})
		.reply(200, {
			errors: [{ message: 'Field does not exist' }]
		})
		.times(1);

	const hasuraStore = createHasuraStore();

	// Add and select a server
	const serverId = hasuraStore.addServer('Test Server', 'http://localhost:8080', adminSecret);
	hasuraStore.selectServer(serverId);
	flushSync();

	// Execute GraphQL query that will fail
	const query = `query { nonExistentField }`;

	// Expect the promise to reject
	const result = await hasuraStore.executeGraphQL(query);

	// Verify error state
	assertError(result);
	expect(result.message).toBe('Field does not exist');
});

test('should execute SQL query successfully', async ({ agent }) => {
	const adminSecret = 'test-password-5';

	agent
		.intercept({
			method: 'POST',
			path: '/v2/query',
			headers: { 'x-hasura-admin-secret': adminSecret }
		})
		.reply(200, {
			result_type: 'TuplesOk',
			result: [
				['id', 'name'],
				['1', 'Test User'],
				['2', 'Another User']
			]
		})
		.times(1);

	const hasuraStore = createHasuraStore();

	// Add and select a server
	const serverId = hasuraStore.addServer('Test Server', 'http://localhost:8080', adminSecret);
	hasuraStore.selectServer(serverId);
	flushSync();

	// Execute SQL query
	const sql = 'SELECT id, name FROM users';
	const result = await hasuraStore.executeSQL(sql);

	// Verify result
	assertOk(result);
	expect(result.result_type).toBe('TuplesOk');
	expect(result.result).toHaveLength(3); // Header row + 2 data rows
	expect(result.result[1][1]).toBe('Test User');
});

test('should handle SQL query errors', async ({ agent }) => {
	const adminSecret = 'test-password-6';

	agent
		.intercept({ method: 'POST', path: '/v2/query' })
		.reply(400, {
			error: 'syntax error at or near "INVALID"',
			path: '$[0]',
			code: 'postgres-error'
		})
		.times(1);

	const hasuraStore = createHasuraStore();

	// Add and select a server
	const serverId = hasuraStore.addServer('Test Server', 'http://localhost:8080', adminSecret);
	hasuraStore.selectServer(serverId);
	flushSync();

	// Execute invalid SQL query
	const sql = 'INVALID SQL QUERY';

	// Expect the promise to reject
	const result = await hasuraStore.executeSQL(sql);

	// Verify error state
	assertError(result);
	expect(result.message).toBe('syntax error at or near "INVALID"');
});

test('should handle operations with no server selected', async () => {
	const hasuraStore = createHasuraStore();

	// No server is selected
	expect(hasuraStore.selectedServer).toBeUndefined();

	// Try to execute a GraphQL query
	const graphqlResult = await hasuraStore.executeGraphQL('query { test }');
	assertError(graphqlResult);
	expect(graphqlResult.message).toBe('No server selected');

	// Try to execute an SQL query
	const sqlResult = await hasuraStore.executeSQL('SELECT 1');
	assertError(sqlResult);
	expect(sqlResult.message).toBe('No server selected');
});
