<script>
	import { createEventDispatcher } from 'svelte';

	// Props
	export let user = { email: '', emailVerified: false };

	// Event dispatcher
	const dispatch = createEventDispatcher();

	// Local copy for editing
	let localUser = { ...user };

	// Validation
	let emailError = '';

	function validateEmail(email) {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!email) {
			return 'Email is required';
		} else if (!emailRegex.test(email)) {
			return 'Please enter a valid email address';
		}
		return '';
	}

	function handleUpdate() {
		emailError = validateEmail(localUser.email);

		if (!emailError) {
			dispatch('update', localUser);
		}
	}

	function handleInputChange() {
		if (emailError) {
			emailError = validateEmail(localUser.email);
		}
	}
</script>

<div class="form-container">
	<h2>User Information</h2>

	<div class="form-group">
		<label for="user-email">Email</label>
		<input
			type="email"
			id="user-email"
			bind:value={localUser.email}
			on:input={handleInputChange}
			placeholder="user@example.com"
		/>
		{#if emailError}
			<div class="error">{emailError}</div>
		{/if}
	</div>

	<div class="form-group checkbox">
		<label>
			<input type="checkbox" bind:checked={localUser.emailVerified} />
			Email Verified
		</label>
	</div>

	<button type="button" on:click={handleUpdate}>Update User</button>
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

	.form-group.checkbox {
		display: flex;
		align-items: center;
	}

	.form-group.checkbox input {
		width: auto;
		margin-right: 8px;
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
