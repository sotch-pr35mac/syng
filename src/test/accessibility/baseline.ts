/// <reference types="vite/client" />
import { mount } from 'svelte';
import '@/styles/theme.css';
import '@/styles/syui.css';

Reflect.set(window, '__TAURI_OS_PLUGIN_INTERNALS__', { platform: 'linux' });
const { default: Fixture } = await import('@test/accessibility/Baseline.svelte');
mount(Fixture, { target: document.getElementById('fixture')! });
