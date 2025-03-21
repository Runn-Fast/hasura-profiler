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
 * Connection status types
 */
type ConnectionStatus = 'connecting' | 'connected' | 'error' | 'configured' | 'unconfigured';

/**
 * Connection history item
 */
type ConnectionHistoryItem = {
	server: string;
	lastUsed: Date;
};

/**
 * Last executed query information
 */
type QueryInfo = {
	query: string;
	variables: Record<string, unknown>;
	timestamp: Date;
	hasErrors: boolean;
};

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
type HasuraQueryError = typeof parseHasuraQueryError.infer;

/**
 * Schema query result
 */
type SchemaResult = {
	result: Array<unknown>;
	[key: string]: unknown;
};

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
	readonly isConnected: boolean;
	readonly isLoading: boolean;
	readonly error: string | undefined;
	readonly connectionHistory: ReadonlyArray<ConnectionHistoryItem>;
	readonly connectionStatus: ConnectionStatus;

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
 * Table information from Hasura schema
 */
type TableInfo = {
	table_schema: string;
	table_name: string;
	table_type: 'TABLE' | 'VIEW' | 'FOREIGN TABLE' | 'MATERIALIZED VIEW' | 'PARTITIONED TABLE';
	columns: ColumnInfo[];
};

/**
 * Column information from Hasura schema
 */
type ColumnInfo = {
	column_name: string;
	data_type: string;
	is_nullable: 'YES' | 'NO';
	column_default?: string;
	is_identity: boolean;
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
	let isConnected = $state(false);
	let isLoading = $state(false);
	let error = $state<string | undefined>(undefined);
	let lastQuery = $state<QueryInfo | undefined>(undefined);
	const connectionHistory = $state<ConnectionHistoryItem[]>([]);

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

	// Derived state
	const isConnectionConfigured = $derived(Boolean(server && adminPassword));

	const connectionStatus = $derived.by<ConnectionStatus>(() => {
		if (isLoading) return 'connecting';
		if (isConnected) return 'connected';
		if (error) return 'error';
		if (isConnectionConfigured) return 'configured';
		return 'unconfigured';
	});

	// Save connection to storage whenever it changes
	if (storage) {
		$effect(() => {
			if (server || adminPassword) {
				try {
					storage.setItem(
						storageKey,
						JSON.stringify({
							server: server,
							adminPassword: adminPassword
						} satisfies HasuraConnection)
					);
				} catch (error) {
					console.error('Failed to save Hasura connection to storage:', error);
				}
			}
		});
	}

	/**
	 * Updates the server connection information
	 * @param server - The Hasura server URL
	 * @param adminPassword - The admin password
	 */
	const updateConnection = (nextServer: string, nextAdminPassword: string): void => {
		server = nextServer;
		adminPassword = nextAdminPassword;
		isConnected = false;
		error = undefined;
	};

	/**
	 * Clears the current connection
	 */
	const clearConnection = (): void => {
		server = '';
		adminPassword = '';
		isConnected = false;
		error = undefined;

		if (storage) {
			try {
				storage.removeItem(storageKey);
			} catch (error) {
				console.error('Failed to remove Hasura connection from storage:', error);
			}
		}
	};

	/**
	 * Tests if the current server and admin password combination is valid
	 * @returns Whether the connection is valid
	 */
	const testConnection = async (): Promise<boolean> => {
		if (!server || !adminPassword) {
			error = 'Server URL and admin password are required';
			return false;
		}

		const result = await executeSQL('SELECT 1');

		if (result instanceof Error) {
      isConnected = false;
		} else {
      isConnected = true;
    }

		return isConnected;
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
		isLoading = true;
		error = undefined;

    const result = await errorBoundary(async () => {
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
			lastQuery = {
				query,
				variables,
				timestamp: new Date(),
				hasErrors: Boolean(data.errors?.length)
			};

			if (data.errors?.length) {
				error = data.errors[0]?.message || 'GraphQL query failed';
				throw new Error(error);
			}

			return data as { data: T };
    })
    isLoading = false;

    if (result instanceof Error) {
			error = result.message
			return result;
    }
    return result
	};

	/**
	 * Executes a raw SQL query against the Hasura server
	 */
	const executeSQL = async (
		sql: string,
		options: ExecuteSQLOptions = {}
	): Promise<HasuraQueryResult | Error> => {
		const { allowMutations = false } = options;

		isLoading = true;
		error = undefined;

		const result = await errorBoundary(async () => {
			const response = await fetch(`${server}/v2/query`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-hasura-admin-secret': adminPassword
				},
				body: JSON.stringify({
					type: 'run_sql',
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

			const result = parseHasuraQueryResult(await response.json())
      if (result instanceof type.errors) {
        return new TypeError(result.summary);
      }
      return result;
		});
		isLoading = false;
		if (result instanceof Error) {
			error = result.message;
			return result;
		}
		return result;
	};


	return {
		get server() {
			return server;
		},
		get adminPassword() {
			return adminPassword;
		},
		get isConnected() {
			return isConnected;
		},
		get isLoading() {
			return isLoading;
		},
		get error() {
			return error;
		},
		get connectionHistory() {
			return connectionHistory;
		},
		get connectionStatus() {
			return connectionStatus;
		},

		// Methods
		updateConnection,
		clearConnection,
		testConnection,
		executeGraphQL,
		executeSQL,
	};
};

export { createHasuraStore };
export type {
	HasuraStore,
	ConnectionHistoryItem,
	QueryInfo,
	GraphQLResult,
	SchemaResult,
	HasuraStoreOptions,
	TableInfo,
	ColumnInfo
};
