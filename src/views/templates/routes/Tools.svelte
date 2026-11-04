<script lang="ts">
	import { platform } from '@tauri-apps/plugin-os';
	import ToolsWorkspace from '@/components/Tools/ToolsWorkspace.svelte';
	const isMacos = platform() === 'macos';
</script>

<ToolsWorkspace draggableTitle={isMacos} />
