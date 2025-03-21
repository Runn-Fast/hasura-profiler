import { errorBoundary } from '@stayradiated/error-boundary';

import { type } from 'arktype';

import type { Storage } from '$lib/utils/storage.js';

/**
 * Hasura connection details
 */
const parseHasuraConnectionJSON = type('string.json.parse').to({
	server: 'string',
	adminPassword: 'string'
});

type HasuraConnection = typeof parseHasuraConnectionJSON.infer;

/**
 * GraphQL query result
 */
interface GraphQLResult<T = Record<string, unknown>> {
	data?: T;
	errors?: Array<{
		message: string;
		[key: string]: unknown;
	}>;
}

/**
 * SQL query result
 */
const parseHasuraQueryResult = type({
	result_type: '"TuplesOk"',
	result: 'unknown[][]'
});
type HasuraQueryResult = typeof parseHasuraQueryResult.infer;

const parseHasuraQueryError = type({
	error: 'string',
	path: 'string',
	code: 'string',
	'internal?': {
		arguments: 'unknown[]',
		error: {
			description: 'string | null',
			exec_status: 'string',
			hint: 'string | null',
			message: 'string',
			status_code: 'string'
		},
		prepared: 'boolean',
		statement: 'string'
	}
});

type HasuraConnectionStatus =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'ready' }
	| { status: 'error'; error: Error };

/**
 * Options for creating the Hasura store
 */
type HasuraStoreOptions = {
	storage?: Storage;
	storageKey?: string;
};

type ExecuteSQLOptions = {
	allowMutations?: boolean;
};

/**
 * Hasura store interface
 */
type HasuraStore = {
	// State properties
	readonly server: string;
	readonly adminPassword: string;
	readonly connection: HasuraConnectionStatus;

	// Methods
	updateConnection(server: string, adminPassword: string): void;
	clearConnection(): void;
	testConnection(): Promise<boolean>;
	executeGraphQL<T = Record<string, unknown>>(
		query: string,
		variables?: Record<string, unknown>
	): Promise<{ data: T } | Error>;
	executeSQL(sql: string, options?: ExecuteSQLOptions): Promise<HasuraQueryResult | Error>;
};

/**
 * Creates a Hasura store for managing connection and query execution
 * @param options - Configuration options
 * @returns Hasura store with state and methods
 */
const createHasuraStore = (options: HasuraStoreOptions = {}): HasuraStore => {
	const { storage, storageKey = 'hasura_connection' } = options;

	let server = $state('');
	let adminPassword = $state('');
	let connectionStatus = $state<HasuraConnectionStatus>({ status: 'idle' });

	// Load saved connection from storage
	if (storage) {
		try {
			const savedConnection = storage.getItem(storageKey);
			if (savedConnection) {
				const hasuraConnection = parseHasuraConnectionJSON(savedConnection);
				if (hasuraConnection instanceof type.errors) {
					throw new TypeError(hasuraConnection.summary);
				}
				server = hasuraConnection.server;
				adminPassword = hasuraConnection.adminPassword;
			}
		} catch (error) {
			console.error('Failed to load Hasura connection from storage:', error);
		}
	}

	// Save connection to storage whenever it changes
	if (storage) {
		$effect(() => {
			try {
				storage.setItem(
					storageKey,
					JSON.stringify({
						server,
						adminPassword
					} satisfies HasuraConnection)
				);
			} catch (error) {
				console.error('Failed to save Hasura connection to storage:', error);
			}
		});
	}

	/**
	 * Updates the server connection information
	 * @param server - The Hasura server URL
	 * @param adminPassword - The admin password
	 */
	const updateConnection = (nextServer: string, nextAdminPassword: string): void => {
		if (nextServer !== server || nextAdminPassword !== adminPassword) {
			server = nextServer;
			adminPassword = nextAdminPassword;
			connectionStatus = { status: 'idle' };
		}
	};

	/**
	 * Clears the current connection
	 */
	const clearConnection = (): void => {
		updateConnection('', '');
	};

	/**
	 * Tests if the current server and admin password combination is valid
	 * @returns Whether the connection is valid
	 */
	const testConnection = async (): Promise<boolean> => {
		if (!server || !adminPassword) {
			return false;
		}

		connectionStatus = { status: 'loading' };

		const result = await executeSQL('SELECT 1');

		if (result instanceof Error) {
			connectionStatus = { status: 'error', error: result };
			return false;
		}

		connectionStatus = { status: 'ready' };
		return true;
	};

	/**
	 * Executes a GraphQL query against the Hasura server
	 * @param query - The GraphQL query to execute
	 * @param variables - Variables for the GraphQL query
	 * @returns The query result
	 */
	const executeGraphQL = async <T = Record<string, unknown>>(
		query: string,
		variables: Record<string, unknown> = {}
	): Promise<{ data: T } | Error> => {
		return errorBoundary(async () => {
			const response = await fetch(`${server}/v1/graphql`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-hasura-admin-secret': adminPassword
				},
				body: JSON.stringify({
					query,
					variables
				})
			});

			const data = (await response.json()) as GraphQLResult<T>;

			// Store the last executed query
			if (data.errors?.length) {
				const errorMessage = data.errors[0]?.message || 'GraphQL query failed';
				throw new Error(errorMessage);
			}

			return data as { data: T };
		});
	};

	/**
	 * Executes a raw SQL query against the Hasura server
	 */
	const executeSQL = async (
		sql: string,
		options: ExecuteSQLOptions = {}
	): Promise<HasuraQueryResult | Error> => {
		const { allowMutations = false } = options;

		return errorBoundary(async () => {
			const response = await fetch(`${server}/v2/query`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-hasura-admin-secret': adminPassword
				},
				body: JSON.stringify({
					status: 'run_sql',
					args: {
						source: 'default',
						sql,
						cascade: false,
						read_only: !allowMutations
					}
				})
			});

			if (!response.ok) {
				const errorData = parseHasuraQueryError(await response.json());
				if (errorData instanceof type.errors) {
					return new TypeError(errorData.summary);
				}
				return new Error(errorData.error || 'SQL query failed');
			}

			const result = parseHasuraQueryResult(await response.json());
			if (result instanceof type.errors) {
				return new TypeError(result.summary);
			}
			return result;
		});
	};

	return {
		get server() {
			return server;
		},
		get adminPassword() {
			return adminPassword;
		},
		get connection() {
			return connectionStatus;
		},

		// Methods
		updateConnection,
		clearConnection,
		testConnection,
		executeGraphQL,
		executeSQL
	};
};

export { createHasuraStore };

export type {
	HasuraStore,
	GraphQLResult,
	HasuraStoreOptions,
};
