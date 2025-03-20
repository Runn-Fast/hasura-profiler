<script lang="ts">
	import { onMount } from 'svelte';
	import { EditorView, basicSetup } from 'codemirror';
	import { EditorState } from '@codemirror/state';
	import { json } from '@codemirror/lang-json';
	import { graphql } from 'cm6-graphql';

	// Using Svelte 5 runes with $state
	let hasuraUrl = $state('http://localhost:8080');
	let customUrl = $state('');
	let urlSelection = $state('local');
	let hasuraPassword = $state('TripleCommaClub');
	let showPassword = $state(false);

	// Account selection
	let accountSearchQuery = $state('');
	let accountSearchId = $state('');
	let accounts = $state<Array<{ id: number; name: string }>>([]);
	let selectedAccount = $state<{ id: number; name: string } | null>(null);

	// User selection
	let userSearchQuery = $state('');
	let userSearchId = $state('');
	let users = $state<
		Array<{
			user: {
				id: number;
				first_name: string;
				last_name: string;
				email: string;
			};
			permissions: string[];
		}>
	>([]);
	let selectedUser = $state<{
		id: number;
		first_name: string;
		last_name: string;
		email: string;
	} | null>(null);

	// Role selection
	const roles: string[] = [
		'app_admin_with_manage_account',
		'app_admin_without_manage_account',
		'app_manager',
		'app_contributor_or_limited_manager',
		'app_contributor_without_planner'
	];
	let selectedRole = $state(roles[0]);

	// Query and variables
	let queryEditor: EditorView;
	let variablesEditor: EditorView;
	let queryResult = $state<unknown>(null);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (urlSelection === 'custom') {
			hasuraUrl = customUrl;
		} else if (urlSelection === 'local') {
			hasuraUrl = 'http://localhost:8080';
		} else if (urlSelection === 'staging') {
			hasuraUrl = 'https://hasura.app.runn-testing.net';
		}
	});

	onMount(() => {
		// Initialize GraphQL query editor
		const queryState = EditorState.create({
			doc: 'query {\n  # Your GraphQL query here\n}',
			extensions: [
				basicSetup,
				graphql(),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						// Update query when editor content changes
					}
				})
			]
		});

		queryEditor = new EditorView({
			state: queryState,
			parent: document.getElementById('query-editor')!
		});

		// Initialize variables editor
		const variablesState = EditorState.create({
			doc: '{\n  "variableName": "value"\n}',
			extensions: [
				basicSetup,
				json(),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						// Update variables when editor content changes
					}
				})
			]
		});

		variablesEditor = new EditorView({
			state: variablesState,
			parent: document.getElementById('variables-editor')!
		});
	});

	async function searchAccounts(): Promise<void> {
		error = null;
		isLoading = true;

		try {
			const id = parseInt(accountSearchId) || 0;
			const queryText = `%${accountSearchQuery}%`;

			const response = await fetch(`${hasuraUrl}/v1/graphql`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-hasura-admin-secret': hasuraPassword
				},
				body: JSON.stringify({
					query: `
            query findAccount($id: Int!, $query: String!) {
              accounts(limit: 5, where: {_or: [{id: {_eq: $id}}, {name: {_ilike: $query}}]}) {
                id
                name
              }
            }
          `,
					variables: {
						id,
						query: queryText
					}
				})
			});

			const result = await response.json();

			if (result.errors) {
				error = result.errors[0].message;
			} else {
				accounts = result.data.accounts;
			}
		} catch (err: unknown) {
			error = err.message;
		} finally {
			isLoading = false;
		}
	}

	async function searchUsers(): Promise<void> {
		if (!selectedAccount) return;

		error = null;
		isLoading = true;

		try {
			const id = parseInt(userSearchId) || 0;
			const queryText = `%${userSearchQuery}%`;

			const response = await fetch(`${hasuraUrl}/v1/graphql`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-hasura-admin-secret': hasuraPassword
				},
				body: JSON.stringify({
					query: `
            query findUser($accountId: Int!, $id: Int!, $query: String!) {
              user_accounts(
                limit: 5,
                where: {
                  account_id: {_eq: $accountId},
                  user: {
                    _or: [
                      {id: {_eq: $id}},
                      {email: {_ilike: $query}},
                      {last_name: {_ilike: $query}},
                      {first_name: {_ilike: $query}}
                    ]
                  }
                }
              ) {
                user {
                  id
                  first_name
                  last_name
                  email
                }
                permissions
              }
            }
          `,
					variables: {
						accountId: selectedAccount.id,
						id,
						query: queryText
					}
				})
			});

			const result = await response.json();

			if (result.errors) {
				error = result.errors[0].message;
			} else {
				users = result.data.user_accounts;
			}
		} catch (err: unknown) {
			error = err.message;
		} finally {
			isLoading = false;
		}
	}

	function selectAccount(account: { id: number; name: string }): void {
		selectedAccount = account;
		selectedUser = null;
		users = [];
	}

	function selectUser(userAccount: {
		user: {
			id: number;
			first_name: string;
			last_name: string;
			email: string;
		};
		permissions: string[];
	}): void {
		selectedUser = userAccount.user;
	}

	async function executeQuery(): Promise<void> {
		if (!selectedAccount || !selectedUser) {
			error = 'Please select an account and user first';
			return;
		}

		error = null;
		isLoading = true;
		queryResult = null;

		try {
			const query = queryEditor.state.doc.toString();
			let variables: Record<string, unknown> = {};

			try {
				variables = JSON.parse(variablesEditor.state.doc.toString());
			} catch (e) {
				error = 'Invalid JSON in variables editor';
				isLoading = false;
				return;
			}

			const response = await fetch(`${hasuraUrl}/v1/graphql`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-hasura-admin-secret': hasuraPassword,
					'x-hasura-user-id': selectedUser.id.toString(),
					'x-hasura-account-id': selectedAccount.id.toString(),
					'x-hasura-role': selectedRole
				},
				body: JSON.stringify({
					query,
					variables
				})
			});

			const result = await response.json();
			queryResult = result;
		} catch (err: unknown) {
			error = err.message;
		} finally {
			isLoading = false;
		}
	}
</script>

<main class="container mx-auto p-4">
	<h1 class="text-2xl font-bold mb-6">Hasura GraphQL Explorer</h1>

	{#if error}
		<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
			<p>{error}</p>
		</div>
	{/if}

	<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
		<!-- Hasura URL Selection -->
		<div>
			<h2 class="text-lg font-semibold mb-2">Hasura Server URL</h2>
			<div class="mb-4">
				<select bind:value={urlSelection} class="w-full p-2 border rounded">
					<option value="local">Local Development (http://localhost:8080)</option>
					<option value="staging">Staging (https://hasura.app.runn-testing.net)</option>
					<option value="custom">Custom URL</option>
				</select>
			</div>

			{#if urlSelection === 'custom'}
				<div class="mb-4">
					<input
						type="text"
						bind:value={customUrl}
						placeholder="Enter custom Hasura URL"
						class="w-full p-2 border rounded"
					/>
				</div>
			{/if}
		</div>

		<!-- Hasura Admin Password -->
		<div>
			<h2 class="text-lg font-semibold mb-2">Hasura Admin Password</h2>
			<div class="flex mb-4">
				<input
					type={showPassword ? 'text' : 'password'}
					bind:value={hasuraPassword}
					class="w-full p-2 border rounded-l"
				/>
				<button
					onclick={() => (showPassword = !showPassword)}
					class="bg-gray-200 px-3 rounded-r border border-l-0"
				>
					{showPassword ? 'Hide' : 'Show'}
				</button>
			</div>
		</div>
	</div>

	<!-- Account Selection -->
	<div class="mb-6">
		<h2 class="text-lg font-semibold mb-2">Select Account</h2>
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<input
				type="text"
				bind:value={accountSearchId}
				placeholder="Search by ID"
				class="p-2 border rounded"
			/>
			<input
				type="text"
				bind:value={accountSearchQuery}
				placeholder="Search by Name"
				class="p-2 border rounded"
			/>
			<button
				onclick={searchAccounts}
				class="bg-blue-500 text-white p-2 rounded"
				disabled={isLoading}
			>
				{isLoading ? 'Searching...' : 'Search Accounts'}
			</button>
		</div>

		{#if accounts.length > 0}
			<div class="mt-4">
				<h3 class="font-medium mb-2">Results:</h3>
				<div class="border rounded divide-y">
					{#each accounts as account}
						<div
							class="p-3 hover:bg-gray-100 cursor-pointer flex justify-between"
							class:bg-blue-100={selectedAccount && selectedAccount.id === account.id}
							onclick={() => selectAccount(account)}
						>
							<span><strong>ID:</strong> {account.id}</span>
							<span><strong>Name:</strong> {account.name}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if selectedAccount}
			<div class="mt-4 p-3 bg-blue-50 rounded">
				<h3 class="font-medium">Selected Account:</h3>
				<p>
					<strong>ID:</strong>
					{selectedAccount.id} - <strong>Name:</strong>
					{selectedAccount.name}
				</p>
			</div>
		{/if}
	</div>

	<!-- User Selection -->
	<div class="mb-6">
		<h2 class="text-lg font-semibold mb-2">Select User</h2>

		{#if !selectedAccount}
			<p class="text-amber-600">Please select an account first</p>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<input
					type="text"
					bind:value={userSearchId}
					placeholder="Search by ID"
					class="p-2 border rounded"
				/>
				<input
					type="text"
					bind:value={userSearchQuery}
					placeholder="Search by Email/Name"
					class="p-2 border rounded"
				/>
				<button
					onclick={searchUsers}
					class="bg-blue-500 text-white p-2 rounded"
					disabled={isLoading}
				>
					{isLoading ? 'Searching...' : 'Search Users'}
				</button>
			</div>

			{#if users.length > 0}
				<div class="mt-4">
					<h3 class="font-medium mb-2">Results:</h3>
					<div class="border rounded divide-y">
						{#each users as userAccount}
							<div
								class="p-3 hover:bg-gray-100 cursor-pointer"
								class:bg-blue-100={selectedUser && selectedUser.id === userAccount.user.id}
								onclick={() => selectUser(userAccount)}
							>
								<div class="flex justify-between">
									<span><strong>ID:</strong> {userAccount.user.id}</span>
									<span
										><strong>Name:</strong>
										{userAccount.user.first_name}
										{userAccount.user.last_name}</span
									>
								</div>
								<div><strong>Email:</strong> {userAccount.user.email}</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if selectedUser}
				<div class="mt-4 p-3 bg-blue-50 rounded">
					<h3 class="font-medium">Selected User:</h3>
					<p>
						<strong>ID:</strong>
						{selectedUser.id} -
						<strong>Name:</strong>
						{selectedUser.first_name}
						{selectedUser.last_name} -
						<strong>Email:</strong>
						{selectedUser.email}
					</p>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Role Selection -->
	<div class="mb-6">
		<h2 class="text-lg font-semibold mb-2">Select Role</h2>
		<select bind:value={selectedRole} class="w-full p-2 border rounded">
			{#each roles as role}
				<option value={role}>{role}</option>
			{/each}
		</select>
	</div>

	<!-- GraphQL Query -->
	<div class="mb-6">
		<h2 class="text-lg font-semibold mb-2">GraphQL Query</h2>
		<div id="query-editor" class="border rounded h-64"></div>
	</div>

	<!-- Query Variables -->
	<div class="mb-6">
		<h2 class="text-lg font-semibold mb-2">Query Variables</h2>
		<div id="variables-editor" class="border rounded h-32"></div>
	</div>

	<!-- Execute Query -->
	<div class="mb-6">
		<button
			onclick={executeQuery}
			class="bg-green-500 text-white p-3 rounded w-full"
			disabled={isLoading || !selectedAccount || !selectedUser}
		>
			{isLoading ? 'Executing...' : 'Execute Query'}
		</button>
	</div>

	<!-- Query Results -->
	{#if queryResult}
		<div class="mb-6">
			<h2 class="text-lg font-semibold mb-2">Query Results</h2>
			<pre class="bg-gray-100 p-4 rounded overflow-auto max-h-96">{JSON.stringify(
					queryResult,
					null,
					2
				)}</pre>
		</div>
	{/if}
</main>

<style>
	:global(#query-editor .cm-editor),
	:global(#variables-editor .cm-editor) {
		height: 100%;
	}
</style>
