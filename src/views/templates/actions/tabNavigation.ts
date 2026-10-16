import type { Action } from 'svelte/action';

/** Keyboard navigation for the existing, immediately rendered Settings and Tools panels. */
export const tabNavigation: Action<HTMLElement> = (tablist) => {
	const getEnabledTabs = (): HTMLElement[] => {
		return Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]')).filter((tab) => {
			return (
				tab.closest('[role="tablist"]') === tablist &&
				!tab.hasAttribute('disabled') &&
				tab.getAttribute('aria-disabled') !== 'true' &&
				!tab.closest('[hidden], [inert], [aria-hidden="true"]') &&
				getComputedStyle(tab).display !== 'none' &&
				getComputedStyle(tab).visibility !== 'hidden'
			);
		});
	};

	const synchronizeTabStops = (): void => {
		const enabledTabs = getEnabledTabs();
		const selectedTab = enabledTabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
		const tabStop = selectedTab ?? enabledTabs[0];
		for (const tab of tablist.querySelectorAll<HTMLElement>('[role="tab"]')) {
			if (tab.closest('[role="tablist"]') === tablist) {
				tab.tabIndex = tab === tabStop ? 0 : -1;
			}
		}
	};

	const handleKeydown = (event: KeyboardEvent): void => {
		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			return;
		}
		const currentTab = target.closest<HTMLElement>('[role="tab"]');
		const enabledTabs = getEnabledTabs();
		const currentIndex = currentTab ? enabledTabs.indexOf(currentTab) : -1;
		if (currentIndex < 0) {
			return;
		}

		const vertical = tablist.getAttribute('aria-orientation') === 'vertical';
		const rightToLeft = !vertical && getComputedStyle(tablist).direction === 'rtl';
		const forwardKey = vertical ? 'ArrowDown' : rightToLeft ? 'ArrowLeft' : 'ArrowRight';
		const backwardKey = vertical ? 'ArrowUp' : rightToLeft ? 'ArrowRight' : 'ArrowLeft';
		let nextIndex: number;
		switch (event.key) {
			case forwardKey:
				nextIndex = (currentIndex + 1) % enabledTabs.length;
				break;
			case backwardKey:
				nextIndex = (currentIndex + enabledTabs.length - 1) % enabledTabs.length;
				break;
			case 'Home':
				nextIndex = 0;
				break;
			case 'End':
				nextIndex = enabledTabs.length - 1;
				break;
			default:
				return;
		}

		event.preventDefault();
		const nextTab = enabledTabs[nextIndex];
		nextTab.focus();
		nextTab.click();
		synchronizeTabStops();
	};

	synchronizeTabStops();
	tablist.addEventListener('keydown', handleKeydown);
	const observer = new MutationObserver(synchronizeTabStops);
	observer.observe(tablist, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['aria-selected', 'aria-disabled', 'disabled', 'hidden'],
	});

	return {
		destroy() {
			observer.disconnect();
			tablist.removeEventListener('keydown', handleKeydown);
		},
	};
};
