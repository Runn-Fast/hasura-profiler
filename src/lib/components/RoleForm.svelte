<script>
	import { createEventDispatcher } from 'svelte';

	// Props
	export let role = { name: 'user' };

	// Event dispatcher
	const dispatch = createEventDispatcher();

	// Local copy for editing
	let localRole = { ...role };

	// Predefined roles
	const roleOptions = ['user', 'admin', 'moderator', 'editor', 'guest'];

	// Custom role option
	let isCustomRole = false;
	let customRoleName = '';

	function handleRoleChange() {
		if (localRole.name === 'custom') {
			isCustomRole = true;
			localRole.name = customRoleName || '';
		} else {
			isCustomRole = false;
			customRoleName = '';
		}
	}

	function handleCustomRoleChange() {
		localRole.name = customRoleName;
	}

	function handleUpdate() {
		// Simple validation
		if (localRole.name) {
			dispatch('update', localRole);
		}
	}
</script>

<div class="form-container">
	<h2>User Role</h2>

	<div class="form-group">
		<label for="role-select">Role</label>
		<select id="role-select" bind:value={localRole.name} on:change={handleRoleChange}>
			{#each roleOptions as option}
				<option value={option}>{option}</option>
			{/each}
			<option value="custom">Custom role...</option>
		</select>
	</div>

	{#if isCustomRole}
		<div class="form-group">
			<label for="custom-role">Custom Role Name</label>
			<input
				type="text"
				id="custom-role"
				bind:value={customRoleName}
				on:input={handleCustomRoleChange}
				placeholder="Enter custom role name"
			/>
		</div>
	{/if}

	<button type="button" on:click={handleUpdate}>Update Role</button>
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
</style>
