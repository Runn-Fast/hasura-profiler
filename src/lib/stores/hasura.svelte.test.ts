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

	expect(hasuraStore.server).toBe('');
	expect(hasuraStore.adminPassword).toBe('');
	expect(hasuraStore.connection.status).toBe('idle');
});

test('should load connection from storage', () => {
	const cleanup = $effect.root(() => {
		const savedConnection = {
			server: 'http://localhost:8080',
			adminPassword: 'testPassword'
		};

		// Create a store with pre-populated storage using our factory
		const storageWithData = new MockStorage({
			hasura_connection: JSON.stringify(savedConnection)
		});

		const storeWithConnection = createHasuraStore({ storage: storageWithData });

		expect(storeWithConnection.server).toBe(savedConnection.server);
		expect(storeWithConnection.adminPassword).toBe(savedConnection.adminPassword);
		expect(storeWithConnection.connection.status).toBe('idle');
	});

	cleanup();
});

test('should update connection and save to storage', ({ storage }) => {
	const cleanup = $effect.root(() => {
		const hasuraStore = createHasuraStore({ storage });
		const server = 'http://localhost:8080';
		const adminPassword = 'testPassword';

		hasuraStore.updateConnection(server, adminPassword);
		flushSync();

		expect(hasuraStore.server).toBe(server);
		expect(hasuraStore.adminPassword).toBe(adminPassword);

		// Check if it saved to storage
		const savedData = JSON.parse(storage.getItem('hasura_connection') || '{}');
		expect(savedData.server).toBe(server);
		expect(savedData.adminPassword).toBe(adminPassword);
	});

	cleanup();
});

test('should clear connection', ({ storage }) => {
	const cleanup = $effect.root(() => {
		const hasuraStore = createHasuraStore({ storage });

		// Setup initial connection
		hasuraStore.updateConnection('http://localhost:8080', 'testPassword');
		flushSync();

		// Verify it's saved to storage
		expect(storage.getItem('hasura_connection')).not.toBe(undefined);

		// Clear connection
		hasuraStore.clearConnection();
		flushSync();

		// Verify state and storage are cleared
		expect(hasuraStore.server).toBe('');
		expect(hasuraStore.adminPassword).toBe('');
		expect(storage.getItem('hasura_connection')).toMatchInlineSnapshot(
			`"{"server":"","adminPassword":""}"`
		);
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

	// Setup initial connection
	hasuraStore.updateConnection('http://localhost:8080', adminSecret);
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

	// Setup initial connection
	hasuraStore.updateConnection('http://localhost:8080', adminSecret);
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

	// Setup initial connection
	hasuraStore.updateConnection('http://localhost:8080', adminSecret);
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

	// Setup initial connection
	hasuraStore.updateConnection('http://localhost:8080', adminSecret);
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

	// Setup initial connection
	hasuraStore.updateConnection('http://localhost:8080', adminSecret);
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

	// Setup initial connection
	hasuraStore.updateConnection('http://localhost:8080', adminSecret);
	flushSync();

	// Execute invalid SQL query
	const sql = 'INVALID SQL QUERY';

	// Expect the promise to reject
	const result = await hasuraStore.executeSQL(sql);

	// Verify error state
	assertError(result);
	expect(result.message).toBe('syntax error at or near "INVALID"');
});
