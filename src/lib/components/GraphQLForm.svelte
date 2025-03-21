<script>
	import { createEventDispatcher, onMount } from 'svelte';

	// Props
	export let query = '';
	export let variables = '{}';

	// Event dispatcher
	const dispatch = createEventDispatcher();

	// Local state for validation
	let queryError = '';
	let variablesError = '';
	let queryHeight = '250px';
	let variablesHeight = '150px';

	function validateQuery() {
		if (!query.trim()) {
			queryError = 'Query is required';
			return false;
		}
		queryError = '';
		return true;
	}

	function validateVariables() {
		if (!variables.trim()) {
			variables = '{}';
		}

		try {
			JSON.parse(variables);
			variablesError = '';
			return true;
		} catch (error) {
			variablesError = 'Invalid JSON: ' + error.message;
			return false;
		}
	}

	function handleUpdate() {
		const isQueryValid = validateQuery();
		const areVariablesValid = validateVariables();

		if (isQueryValid && areVariablesValid) {
			dispatch('update', {
				query,
				variables
			});
		}
	}

	function formatQuery() {
		try {
			// Very basic formatting
			query = query.replace(/{\s+/g, '{\n  ').replace(/}/g, '\n}').replace(/,\s*/g, ',\n  ');

			queryError = '';
		} catch (error) {
			queryError = 'Unable to format query';
		}
	}

	function formatVariables() {
		try {
			const parsed = JSON.parse(variables);
			variables = JSON.stringify(parsed, null, 2);
			variablesError = '';
		} catch (error) {
			variablesError = 'Invalid JSON: ' + error.message;
		}
	}

	// Sample queries for reference
	const sampleQueries = {
		getUserWithRole: `
query GetUserWithRole($email: String!) {
  users(where: {email: {_eq: $email}}) {
    id
    email
    emailVerified
    accounts {
      id
      provider
      providerAccountId
    }
    user_roles {
      role {
        name
      }
    }
  }
}`.trim(),
		createUser: `
mutation CreateUser($user: users_insert_input!) {
  insert_users_one(object: $user) {
    id
    email
    emailVerified
  }
}`.trim()
	};

	function loadSampleQuery(queryName) {
		query = sampleQueries[queryName];

		if (queryName === 'getUserWithRole') {
			variables = JSON.stringify(
				{
					email: ''
				},
				null,
				2
			);
		} else if (queryName === 'createUser') {
			variables = JSON.stringify(
				{
					user: {
						email: '',
						emailVerified: false
					}
				},
				null,
				2
			);
		}

		queryError = '';
		variablesError = '';

		handleUpdate();
	}
</script>

<div class="form-container">
	<div class="form-header">
		<h2>GraphQL Query</h2>
		<div class="sample-queries">
			<span>Load sample:</span>
			<button class="sample-button" on:click={() => loadSampleQuery('getUserWithRole')}
				>Get User</button
			>
			<button class="sample-button" on:click={() => loadSampleQuery('createUser')}
				>Create User</button
			>
		</div>
	</div>

	<div class="form-group">
		<div class="textarea-header">
			<label for="query">Query</label>
			<button class="format-button" on:click={formatQuery}>Format</button>
		</div>
		<textarea
			id="query"
			bind:value={query}
			style="height: {queryHeight};"
			placeholder="Enter your GraphQL query here"
		></textarea>
		{#if queryError}
			<div class="error">{queryError}</div>
		{/if}
	</div>

	<div class="form-group">
		<div class="textarea-header">
			<label for="variables">Variables</label>
			<button class="format-button" on:click={formatVariables}>Format</button>
		</div>
		<textarea
			id="variables"
			bind:value={variables}
			style="height: {variablesHeight};"
			placeholder={'{ }'}
		></textarea>
		{#if variablesError}
			<div class="error">{variablesError}</div>
		{/if}
	</div>

	<button type="button" class="update-button" on:click={handleUpdate}>Update Query</button>
</div>

<style>
	.form-container {
		background-color: #f9f9f9;
		padding: 15px;
		border-radius: 5px;
		border: 1px solid #ddd;
	}

	.form-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 15px;
	}

	h2 {
		margin: 0;
		font-size: 1.2rem;
		color: #333;
	}

	.sample-queries {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.8rem;
	}

	.sample-button {
		background-color: #f0f0f0;
		border: 1px solid #ddd;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.sample-button:hover {
		background-color: #e0e0e0;
	}

	.form-group {
		margin-bottom: 15px;
	}

	.textarea-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 5px;
	}

	label {
		font-weight: bold;
		font-size: 0.9rem;
	}

	.format-button {
		background-color: #f0f0f0;
		border: 1px solid #ddd;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.format-button:hover {
		background-color: #e0e0e0;
	}

	textarea {
		width: 100%;
		padding: 10px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-family: 'Courier New', monospace;
		font-size: 0.9rem;
		line-height: 1.4;
		resize: vertical;
	}

	.update-button {
		background-color: #0070f3;
		color: white;
		border: none;
		padding: 8px 15px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.update-button:hover {
		background-color: #0051a8;
	}

	.error {
		color: #e53e3e;
		font-size: 0.8rem;
		margin-top: 5px;
	}
</style>
