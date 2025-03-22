import { errorBoundary } from '@stayradiated/error-boundary';

import { type } from 'arktype';

import type { Storage } from '$lib/utils/storage.js';

/**
 * Hasura serverList storage format
 */
const parseHasuraserverListJSON = type('string.json.parse').to({
	serverList: type({
		id: 'string',
		name: 'string',
		url: 'string',
		password: 'string'
	}).array(),
	selectedServerId: 'string?'
});

type HasuraserverListJSON = typeof parseHasuraserverListJSON.infer;
type Server = HasuraserverListJSON['serverList'][number];

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
	readonly serverList: Server[];
	readonly selectedServer: Server | undefined;
	readonly connection: HasuraConnectionStatus;

	// Methods
	addServer(name: string, url: string, password: string): string;
	updateServer(id: string, name: string, url: string, password: string): void;
	removeServer(id: string): void;
	selectServer(id: string): void;
	testConnection(): Promise<boolean>;
	executeGraphQL<T = Record<string, unknown>>(
		query: string,
		variables?: Record<string, unknown>
	): Promise<{ data: T } | Error>;
	executeSQL(sql: string, options?: ExecuteSQLOptions): Promise<HasuraQueryResult | Error>;
};

/**
 * Executes a GraphQL query against a Hasura server
 * @param server - The server to execute against
 * @param query - The GraphQL query to execute
 * @param variables - Variables for the GraphQL query
 * @returns The query result
 */
const executeGraphQL = async <T = Record<string, unknown>>(
	server: Server,
	query: string,
	variables: Record<string, unknown> = {}
): Promise<{ data: T } | Error> => {
	return errorBoundary(async () => {
		const response = await fetch(`${server.url}/v1/graphql`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-hasura-admin-secret': server.password
			},
			body: JSON.stringify({
				query,
				variables
			})
		});

		const data = (await response.json()) as GraphQLResult<T>;

		if (data.errors?.length) {
			const errorMessage = data.errors[0]?.message || 'GraphQL query failed';
			throw new Error(errorMessage);
		}

		return data as { data: T };
	});
};

/**
 * Executes a raw SQL query against a Hasura server
 * @param server - The server to execute against
 * @param sql - The SQL query to execute
 * @param options - Options for SQL execution
 * @returns The query result
 */
const executeSQL = async (
	server: Server,
	sql: string,
	options: ExecuteSQLOptions = {}
): Promise<HasuraQueryResult | Error> => {
	const { allowMutations = false } = options;

	return errorBoundary(async () => {
		const response = await fetch(`${server.url}/v2/query`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-hasura-admin-secret': server.password
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

		const result = parseHasuraQueryResult(await response.json());
		if (result instanceof type.errors) {
			return new TypeError(result.summary);
		}
		return result;
	});
};

/**
 * Creates a Hasura store for managing connections and query execution
 * @param options - Configuration options
 * @returns Hasura store with state and methods
 */
const createHasuraStore = (options: HasuraStoreOptions = {}): HasuraStore => {
	const { storage, storageKey = 'hasura_serverList' } = options;

	let serverList = $state<Server[]>([]);
	let selectedServerId = $state<string | undefined>(undefined);
	let connectionStatus = $state<HasuraConnectionStatus>({ status: 'idle' });

	// Load saved connections from storage
	if (storage) {
		try {
			const savedserverList = storage.getItem(storageKey);
			if (savedserverList) {
				const hasuraserverList = parseHasuraserverListJSON(savedserverList);
				if (hasuraserverList instanceof type.errors) {
					throw new TypeError(hasuraserverList.summary);
				}
				serverList = hasuraserverList.serverList;
				selectedServerId = hasuraserverList.selectedServerId;
			}
		} catch (error) {
			console.error('Failed to load Hasura connections from storage:', error);
		}
	}

	// Save serverList to storage whenever they change
	if (storage) {
		$effect(() => {
			try {
				storage.setItem(
					storageKey,
					JSON.stringify({
						serverList,
						selectedServerId
					})
				);
			} catch (error) {
				console.error('Failed to save Hasura connections to storage:', error);
			}
		});
	}

	/**
	 * Gets the selected server object
	 */
	const getSelectedServer = (): Server | undefined => {
		if (!selectedServerId) return undefined;
		return serverList.find((s) => s.id === selectedServerId);
	};

	/**
	 * Adds a new server to the list
	 * @returns The ID of the new server
	 */
	const addServer = (name: string, url: string, password: string): string => {
		const id = crypto.randomUUID();
		const newServer = { id, name, url, password };
		serverList = [...serverList, newServer];

		// If this is the first server, select it automatically
		if (serverList.length === 1) {
			selectedServerId = id;
		}

		return id;
	};

	/**
	 * Updates an existing server
	 */
	const updateServer = (id: string, name: string, url: string, password: string): void => {
		serverList = serverList.map((server) =>
			server.id === id ? { ...server, name, url, password } : server
		);

		if (id === selectedServerId) {
			connectionStatus = { status: 'idle' };
		}
	};

	/**
	 * Removes a server from the list
	 */
	const removeServer = (id: string): void => {
		serverList = serverList.filter((server) => server.id !== id);

		// If we removed the selected server, clear selection or select another one
		if (id === selectedServerId) {
			selectedServerId = serverList.length > 0 ? serverList[0].id : undefined;
			connectionStatus = { status: 'idle' };
		}
	};

	/**
	 * Selects a server by ID
	 */
	const selectServer = (id: string): void => {
		const server = serverList.find((s) => s.id === id);
		if (server) {
			selectedServerId = id;
			connectionStatus = { status: 'idle' };
		}
	};

	/**
	 * Tests if the currently selected server connection is valid
	 * @returns Whether the connection is valid
	 */
	const testConnection = async (): Promise<boolean> => {
		const server = getSelectedServer();
		if (!server) {
			return false;
		}

		connectionStatus = { status: 'loading' };

		const result = await executeSQL(server, 'SELECT 1');

		if (result instanceof Error) {
			connectionStatus = { status: 'error', error: result };
			return false;
		}

		connectionStatus = { status: 'ready' };
		return true;
	};

	/**
	 * Wraps the standalone executeGraphQL function for the selected server
	 */
	const storeExecuteGraphQL = async <T = Record<string, unknown>>(
		query: string,
		variables: Record<string, unknown> = {}
	): Promise<{ data: T } | Error> => {
		const server = getSelectedServer();
		if (!server) {
			return new Error('No server selected');
		}

		return executeGraphQL<T>(server, query, variables);
	};

	/**
	 * Wraps the standalone executeSQL function for the selected server
	 */
	const storeExecuteSQL = async (
		sql: string,
		options: ExecuteSQLOptions = {}
	): Promise<HasuraQueryResult | Error> => {
		const server = getSelectedServer();
		if (!server) {
			return new Error('No server selected');
		}

		return executeSQL(server, sql, options);
	};

	return {
		get serverList() {
			return serverList;
		},
		get selectedServer() {
			return getSelectedServer();
		},
		get connection() {
			return connectionStatus;
		},

		// Methods
		addServer,
		updateServer,
		removeServer,
		selectServer,
		testConnection,
		executeGraphQL: storeExecuteGraphQL,
		executeSQL: storeExecuteSQL
	};
};

export { createHasuraStore, executeGraphQL, executeSQL };

export type {
	HasuraStore,
	Server,
	GraphQLResult,
	HasuraQueryResult,
	HasuraStoreOptions,
	ExecuteSQLOptions
};
