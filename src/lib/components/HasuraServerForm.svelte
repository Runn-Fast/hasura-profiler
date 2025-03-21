<script>
	import { createEventDispatcher } from 'svelte';

	// Props
	export let hasuraServer = '';
	export let hasuraAdminPassword = '';

	// Event dispatcher
	const dispatch = createEventDispatcher();

	// Local state for validation
	let serverError = '';
	let passwordError = '';

	function validateForm() {
		let isValid = true;

		// Validate server URL
		if (!hasuraServer) {
			serverError = 'Server URL is required';
			isValid = false;
		} else if (!hasuraServer.startsWith('http')) {
			serverError = 'Server URL must start with http:// or https://';
			isValid = false;
		} else {
			serverError = '';
		}

		// Validate admin password
		if (!hasuraAdminPassword) {
			passwordError = 'Admin password is required';
			isValid = false;
		} else {
			passwordError = '';
		}

		return isValid;
	}

	function handleUpdate() {
		if (validateForm()) {
			dispatch('update', {
				server: hasuraServer,
				password: hasuraAdminPassword
			});
		}
	}
</script>

<div class="form-container">
	<h2>Hasura Server</h2>

	<div class="form-group">
		<label for="hasura-server">Server URL</label>
		<input
			type="text"
			id="hasura-server"
			bind:value={hasuraServer}
			placeholder="https://your-hasura-instance.com"
		/>
		{#if serverError}
			<div class="error">{serverError}</div>
		{/if}
	</div>

	<div class="form-group">
		<label for="admin-password">Admin Password</label>
		<input
			type="password"
			id="admin-password"
			bind:value={hasuraAdminPassword}
			placeholder="Admin secret"
		/>
		{#if passwordError}
			<div class="error">{passwordError}</div>
		{/if}
	</div>

	<button type="button" on:click={handleUpdate}>Save Connection</button>
</div>

<style>
	.form-container {
		background-color: #f9f9f9;
		padding: 15px;
		border-radius: 5px;
		border: 1px solid #ddd;
	}

	h2 {
		margin-top: 0;
		font-size: 1.2rem;
		color: #333;
		margin-bottom: 15px;
	}

	.form-group {
		margin-bottom: 15px;
	}

	label {
		display: block;
		margin-bottom: 5px;
		font-weight: bold;
		font-size: 0.9rem;
	}

	input {
		width: 100%;
		padding: 8px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 1rem;
	}

	button {
		background-color: #0070f3;
		color: white;
		border: none;
		padding: 8px 15px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
	}

	button:hover {
		background-color: #0051a8;
	}

	.error {
		color: #e53e3e;
		font-size: 0.8rem;
		margin-top: 5px;
	}
</style>
