<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		createHasuraStore,
		type HasuraStore,
		type Server,
		type HasuraConnectionStatus
	} from '$lib/stores/hasura.svelte.js';

	const hasuraStore: HasuraStore = createHasuraStore();

	let selectedServerId = $state<string | undefined>(undefined);
	let editingServer = $state<Server | null>(null);
	let connectionStatus = $state<HasuraConnectionStatus>({ status: 'idle' });
	let isLoading = $state<boolean>(false);
	let debounceTimeout = $state<ReturnType<typeof setTimeout> | undefined>(undefined);

	// Reset the form to create a new server
	function createNewServer(): void {
		editingServer = {
			id: '',
			name: '',
			url: '',
			password: ''
		};
		selectedServerId = undefined;
	}

	// Select a server for editing
	function selectServer(server: Server): void {
		selectedServerId = server.id;
		editingServer = { ...server };

		// Get current connection status
		connectionStatus = hasuraStore.connection;
	}

	// Save the current server (add new or update existing)
	function saveServer(): void {
		if (!editingServer) return;

		if (selectedServerId) {
			// Update existing server
			hasuraStore.updateServer(
				selectedServerId,
				editingServer.name,
				editingServer.url,
				editingServer.password
			);
		} else {
			// Add new server
			const newServerId = hasuraStore.addServer(
				editingServer.name || 'New Server',
				editingServer.url,
				editingServer.password
			);
			selectedServerId = newServerId;
			hasuraStore.selectServer(newServerId);
		}
	}

	// Delete a server after confirmation
	function deleteServer(id: string): void {
		if (window.confirm('Are you sure you want to delete this server?')) {
			hasuraStore.removeServer(id);
			if (id === selectedServerId) {
				selectedServerId = hasuraStore.serverList[0]?.id;
				editingServer = selectedServerId ? { ...hasuraStore.serverList[0] } : null;
			}
		}
	}

	// Test connection with debounce
	function testConnection(): void {
		// Cancel previous debounce if exists
		if (debounceTimeout) clearTimeout(debounceTimeout);

		// Only test if we have a URL and password
		if (!editingServer?.url || !editingServer?.password) {
			connectionStatus = { status: 'idle' };
			return;
		}

		// Save current values first
		saveServer();

		// Set a debounced test
		debounceTimeout = setTimeout(async () => {
			isLoading = true;
			await hasuraStore.testConnection();
			connectionStatus = hasuraStore.connection;
			isLoading = false;
		}, 500); // 500ms debounce
	}

	// Update form fields and trigger connection test
	function handleInputChange(): void {
		saveServer();
		testConnection();
	}

	// Cleanup timeout on component destroy
	onDestroy(() => {
		if (debounceTimeout) clearTimeout(debounceTimeout);
	});

	// Initialize component
	onMount(() => {
		// If there's a selected server, load it
		if (hasuraStore.selectedServer) {
			selectedServerId = hasuraStore.selectedServer.id;
			editingServer = { ...hasuraStore.selectedServer };
			connectionStatus = hasuraStore.connection;
		} else if (hasuraStore.serverList.length > 0) {
			// If no server is selected but we have servers, select the first one
			selectServer(hasuraStore.serverList[0]);
		}
	});

	// Computed properties with Svelte 5 $derived rune
	const connectionStatusText = $derived(
		(() => {
			switch (connectionStatus.status) {
				case 'loading':
					return 'Testing connection...';
				case 'ready':
					return 'Connected successfully';
				case 'error':
					return `Connection failed: ${connectionStatus.error?.message || 'Unknown error'}`;
				default:
					return 'Not connected';
			}
		})()
	);

	const connectionStatusClass = $derived(
		(() => {
			switch (connectionStatus.status) {
				case 'loading':
					return 'status-loading';
				case 'ready':
					return 'status-success';
				case 'error':
					return 'status-error';
				default:
					return 'status-idle';
			}
		})()
	);
</script>

<div class="server-manager">
	<div class="sidebar">
		<h3>Server List</h3>
		<div class="server-list">
			{#each hasuraStore.serverList as server (server.id)}
				<div
					class="server-item"
					class:selected={server.id === selectedServerId}
					on:click={() => selectServer(server)}
				>
					<span>{server.name || 'Unnamed Server'}</span>
					<button
						class="delete-button"
						on:click|stopPropagation={() => deleteServer(server.id)}
						aria-label="Delete server"
					>
						×
					</button>
				</div>
			{/each}
		</div>
		<button class="add-button" on:click={createNewServer}> Add Server </button>
	</div>

	<div class="content">
		{#if editingServer}
			<div class="server-form">
				<div class="form-field">
					<label for="server-name">Server Name</label>
					<input
						id="server-name"
						type="text"
						bind:value={editingServer.name}
						placeholder="My Hasura Server"
						on:input={handleInputChange}
					/>
				</div>

				<div class="form-field">
					<label for="server-url">Server URL</label>
					<input
						id="server-url"
						type="url"
						bind:value={editingServer.url}
						placeholder="https://my-hasura-instance.com"
						on:input={handleInputChange}
					/>
				</div>

				<div class="form-field">
					<label for="server-password">Admin Secret</label>
					<input
						id="server-password"
						type="password"
						bind:value={editingServer.password}
						placeholder="Admin secret/password"
						on:input={handleInputChange}
					/>
				</div>

				<div class="connection-status {connectionStatusClass}">
					{connectionStatusText}
					{#if isLoading}
						<span class="loader"></span>
					{/if}
				</div>
			</div>
		{:else}
			<div class="no-server-selected">
				<p>No server selected. Select a server from the list or add a new one.</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.server-manager {
		display: flex;
		border: 1px solid #eaeaea;
		border-radius: 8px;
		overflow: hidden;
		min-height: 400px;
		max-height: 600px;
		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			sans-serif;
	}

	.sidebar {
		width: 250px;
		background-color: #f9f9f9;
		border-right: 1px solid #eaeaea;
		display: flex;
		flex-direction: column;
	}

	.sidebar h3 {
		margin: 0;
		padding: 16px;
		font-size: 1rem;
		font-weight: 600;
		border-bottom: 1px solid #eaeaea;
	}

	.server-list {
		flex: 1;
		overflow-y: auto;
	}

	.server-item {
		padding: 12px 16px;
		border-bottom: 1px solid #eaeaea;
		cursor: pointer;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.server-item:hover {
		background-color: #f1f1f1;
	}

	.server-item.selected {
		background-color: #e6f7ff;
		border-left: 3px solid #1890ff;
	}

	.delete-button {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: none;
		background-color: #f5f5f5;
		color: #666;
		font-size: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s;
		padding: 0;
		line-height: 1;
	}

	.delete-button:hover {
		background-color: #ff4d4f;
		color: white;
	}

	.add-button {
		margin: 16px;
		padding: 8px 16px;
		background-color: #1890ff;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 500;
	}

	.add-button:hover {
		background-color: #096dd9;
	}

	.content {
		flex: 1;
		padding: 24px;
		overflow-y: auto;
	}

	.server-form {
		max-width: 500px;
	}

	.form-field {
		margin-bottom: 16px;
	}

	label {
		display: block;
		margin-bottom: 8px;
		font-weight: 500;
		color: #333;
	}

	input {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid #d9d9d9;
		border-radius: 4px;
		font-size: 14px;
	}

	input:focus {
		outline: none;
		border-color: #1890ff;
		box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
	}

	.connection-status {
		margin-top: 24px;
		padding: 12px;
		border-radius: 4px;
		font-size: 14px;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status-idle {
		background-color: #f5f5f5;
		color: #666;
	}

	.status-loading {
		background-color: #e6f7ff;
		color: #1890ff;
	}

	.status-success {
		background-color: #f6ffed;
		color: #52c41a;
	}

	.status-error {
		background-color: #fff2f0;
		color: #ff4d4f;
	}

	.loader {
		display: inline-block;
		width: 16px;
		height: 16px;
		border: 2px solid rgba(24, 144, 255, 0.2);
		border-top-color: #1890ff;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.no-server-selected {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #999;
		text-align: center;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
