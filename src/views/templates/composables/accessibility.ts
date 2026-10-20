/** Shared input-modality and tooltip behavior, installed once per application window. */
export function initializeAccessibility(): () => void {
	const root = document.documentElement;
	const supportsFocusVisible = globalThis.CSS?.supports?.('selector(:focus-visible)') ?? false;
	root.dataset.inputModality = 'keyboard';
	const positionFixedTooltip = (target: EventTarget | null) => {
		if (!(target instanceof Element)) {
			return;
		}
		const container = target.closest<HTMLElement>('[data-sy-fixed-tooltip]');
		const tooltip = container?.querySelector<HTMLElement>('.sy-tooltip--body');
		if (!container || !tooltip) {
			return;
		}
		const bounds = container.getBoundingClientRect();
		tooltip.style.position = 'fixed';
		tooltip.style.left = `${bounds.right}px`;
		tooltip.style.top = `${bounds.top + bounds.height / 2}px`;
	};
	const isTextEntry = (element: Element | null): boolean =>
		element instanceof HTMLElement &&
		(element.isContentEditable ||
			element.matches(
				'textarea, input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range]):not([type=color])'
			));
	const updateTooltipFocus = () => {
		for (const tooltip of document.querySelectorAll('.sy-tooltip--container')) {
			const focused = document.activeElement;
			tooltip.classList.toggle(
				'sy-tooltip--keyboard-focus',
				Boolean(
					focused &&
					tooltip.contains(focused) &&
					root.dataset.inputModality === 'keyboard'
				)
			);
		}
	};
	const handleKeyDown = (event: KeyboardEvent) => {
		if (
			!event.metaKey &&
			(!event.altKey || event.key === 'Tab') &&
			!event.ctrlKey &&
			!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)
		) {
			root.dataset.inputModality = 'keyboard';
			if (!supportsFocusVisible) {
				document.activeElement?.classList.add('sy-focus-visible');
			}
			updateTooltipFocus();
		}
		if (event.key === 'Escape') {
			for (const tooltip of document.querySelectorAll('.sy-tooltip--container')) {
				if (tooltip.matches(':hover') || tooltip.contains(document.activeElement)) {
					tooltip.classList.add('sy-tooltip--dismissed');
				}
			}
		}
	};
	const handlePointerDown = () => {
		root.dataset.inputModality = 'pointer';
		if (!supportsFocusVisible && !isTextEntry(document.activeElement)) {
			document.activeElement?.classList.remove('sy-focus-visible');
		}
		updateTooltipFocus();
	};
	const handleFocusIn = (event: FocusEvent) => {
		if (!(event.target instanceof HTMLElement)) {
			return;
		}
		if (
			!supportsFocusVisible &&
			(root.dataset.inputModality === 'keyboard' || isTextEntry(event.target))
		) {
			event.target.classList.add('sy-focus-visible');
		}
		event.target.closest('.sy-tooltip--container')?.classList.remove('sy-tooltip--dismissed');
		positionFixedTooltip(event.target);
		updateTooltipFocus();
	};
	const handlePointerOver = (event: PointerEvent) => positionFixedTooltip(event.target);
	const handleScroll = () => {
		for (const container of document.querySelectorAll('[data-sy-fixed-tooltip]')) {
			if (container.matches(':hover') || container.contains(document.activeElement)) {
				positionFixedTooltip(container);
			}
		}
	};
	const handleFocusOut = (event: FocusEvent) => {
		if (event.target instanceof HTMLElement) {
			event.target.classList.remove('sy-focus-visible');
		}
		queueMicrotask(updateTooltipFocus);
	};
	const handlePointerOut = (event: PointerEvent) => {
		if (!(event.target instanceof Element)) {
			return;
		}
		const tooltip = event.target.closest('.sy-tooltip--container');
		if (
			tooltip &&
			!(event.relatedTarget instanceof Node && tooltip.contains(event.relatedTarget))
		) {
			tooltip.classList.remove('sy-tooltip--dismissed');
		}
	};
	document.addEventListener('keydown', handleKeyDown, true);
	document.addEventListener('pointerdown', handlePointerDown, true);
	document.addEventListener('focusin', handleFocusIn, true);
	document.addEventListener('focusout', handleFocusOut, true);
	document.addEventListener('pointerout', handlePointerOut, true);
	document.addEventListener('pointerover', handlePointerOver, true);
	document.addEventListener('scroll', handleScroll, true);
	window.addEventListener('resize', handleScroll);
	return () => {
		document.removeEventListener('keydown', handleKeyDown, true);
		document.removeEventListener('pointerdown', handlePointerDown, true);
		document.removeEventListener('focusin', handleFocusIn, true);
		document.removeEventListener('focusout', handleFocusOut, true);
		document.removeEventListener('pointerout', handlePointerOut, true);
		document.removeEventListener('pointerover', handlePointerOver, true);
		document.removeEventListener('scroll', handleScroll, true);
		window.removeEventListener('resize', handleScroll);
		delete root.dataset.inputModality;
	};
}
