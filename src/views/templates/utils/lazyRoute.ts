import type { Component } from 'svelte';
import { wrap } from 'svelte-spa-router/wrap';
import RouteLoading from '@/components/RouteLoading/RouteLoading.svelte';
import RouteLoadError from '@/components/RouteLoading/RouteLoadError.svelte';
import { handleError } from '@/utils/error.js';

type RouteModule = { default: Component };

export function lazyRoute(loader: () => Promise<RouteModule>) {
	return wrap({
		loadingComponent: RouteLoading,
		asyncComponent: async () => {
			try {
				return await loader();
			} catch (error) {
				handleError('Failed to load a screen.', error, { silent: true });
				return { default: RouteLoadError };
			}
		},
	});
}
