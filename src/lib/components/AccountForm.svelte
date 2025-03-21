<script>
	import { createEventDispatcher } from 'svelte';

	// Props
	export let account = { provider: 'email', providerAccountId: '' };

	// Event dispatcher
	const dispatch = createEventDispatcher();

	// Local copy for editing
	let localAccount = { ...account };

	// Provider options
	const providers = ['email', 'google', 'github', 'facebook', 'twitter', 'apple'];

	// Validation
	let providerIdError = '';

	function validateForm() {
		let isValid = true;

		if (!localAccount.providerAccountId) {
			providerIdError = 'Provider Account ID is required';
			isValid = false;
		} else {
			providerIdError = '';
		}

		return isValid;
	}

	function handleUpdate() {
		if (validateForm()) {
			dispatch('update', localAccount);
		}
	}
</script>

<div class="form-container">
	<h2>Account Information</h2>

	<div class="form-group">
		<label for="provider">Authentication Provider</label>
		<select id="provider" bind:value={localAccount.provider}>
			{#each providers as provider}
				<option value={provider}>{provider}</option>
			{/each}
		</select>
	</div>

	<div class="form-group">
		<label for="provider-account-id">Provider Account ID</label>
		<input
			type="text"
			id="provider-account-id"
			bind:value={localAccount.providerAccountId}
			placeholder="Provider-specific ID"
		/>
		{#if providerIdError}
			<div class="error">{providerIdError}</div>
		{/if}
	</div>

	<button type="button" on:click={handleUpdate}>Update Account</button>
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

	input,
	select {
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
