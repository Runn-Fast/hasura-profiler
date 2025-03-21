<script>
	import { onMount } from 'svelte';

	import Header from '$lib/components/Header.svelte';
	import HasuraServerForm from '$lib/components/HasuraServerForm.svelte';
	import UserForm from '$lib/components/UserForm.svelte';
	import AccountForm from '$lib/components/AccountForm.svelte';
	import RoleForm from '$lib/components/RoleForm.svelte';
	import GraphQLForm from '$lib/components/GraphQLForm.svelte';
	import GraphQLExecutor from '$lib/components/GraphQLExecutor.svelte';

	// State management
	let hasuraServer = '';
	let hasuraAdminPassword = '';
	let user = { email: '', emailVerified: false };
	let account = { provider: 'email', providerAccountId: '' };
	let role = { name: 'user' };
	let query = '';
	let variables = '{}';
	let graphqlResponse = '';
	let isLoading = false;
	let error = null;

	// Handler functions
	function handleServerUpdate(event) {
		hasuraServer = event.detail.server;
		hasuraAdminPassword = event.detail.password;
	}

	function handleUserUpdate(event) {
		user = event.detail;
	}

	function handleAccountUpdate(event) {
		account = event.detail;
	}

	function handleRoleUpdate(event) {
		role = event.detail;
	}

	function handleQueryUpdate(event) {
		query = event.detail.query;
		variables = event.detail.variables;
	}

	async function executeGraphQL() {
		isLoading = true;
		error = null;

		try {
			const response = await fetch(`${hasuraServer}/v1/graphql`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-hasura-admin-secret': hasuraAdminPassword
				},
				body: JSON.stringify({
					query: query,
					variables: JSON.parse(variables)
				})
			});

			const data = await response.json();
			graphqlResponse = JSON.stringify(data, null, 2);
		} catch (err) {
			error = err.message;
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		// Default query
		query = `
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
}
    `.trim();

		// Default variables
		variables = JSON.stringify(
			{
				email: user.email
			},
			null,
			2
		);
	});
</script>

<div class="app-container">
	<Header />

	<main class="main-content">
		<div class="forms-container">
			<HasuraServerForm {hasuraServer} {hasuraAdminPassword} on:update={handleServerUpdate} />

			<UserForm {user} on:update={handleUserUpdate} />

			<AccountForm {account} on:update={handleAccountUpdate} />

			<RoleForm {role} on:update={handleRoleUpdate} />
		</div>

		<div class="graphql-container">
			<GraphQLForm {query} {variables} on:update={handleQueryUpdate} />

			<GraphQLExecutor {graphqlResponse} {isLoading} {error} executeQuery={executeGraphQL} />
		</div>
	</main>
</div>

<style>
	.app-container {
		font-family: Arial, sans-serif;
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px;
	}

	.main-content {
		display: flex;
		flex-direction: column;
		gap: 20px;
		margin-top: 20px;
	}

	.forms-container {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 20px;
	}

	.graphql-container {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
	}

	@media (max-width: 768px) {
		.forms-container,
		.graphql-container {
			grid-template-columns: 1fr;
		}
	}
</style>
