<script lang="ts">
	import ReaderText from '@/components/Reader/ReaderText.svelte';
	import CharacterWindow from '@/CharacterWindow.svelte';
	import { layoutReaderText } from '@/utils/readerTextLayout.js';
	import type { ReaderSegment } from '@/utils/readerPagination.js';
	const parameters = new URLSearchParams(location.search);
	const characterWindow = parameters.has('characterWindow');
	const annotation = parameters.get('annotation') ?? 'xiǎng chuāng';
	const segments: ReaderSegment[] = [
		{
			type: 'token',
			text: '学习中文',
			token: { text: '学习中文', start: 0, end: 4 },
			annotation,
			annotationSource: 'generated',
			pinyin: { marks: annotation, numbers: '', tones: [3, 1] },
		},
	];
	const width = Number(parameters.get('width')) || 30;
	if (parameters.has('grouped')) {
		segments[0] = {
			type: 'text',
			text: '学习中文学习中文',
			annotation,
			annotationSource: 'imported',
			parts: ['学习', '中文', '学习', '中文'].map((text, index) => ({
				type: 'token',
				text,
				token: { text, start: index * 2, end: index * 2 + 2 },
			})),
		};
	}
	const fontSize = Number(parameters.get('size')) || 20;
	let ready = $state(false);
	const callbacks = new Map<number, (event: unknown) => void>();
	Reflect.set(window, '__TAURI_EVENT_PLUGIN_INTERNALS__', { unregisterListener() {} });
	Reflect.set(window, '__TAURI_INTERNALS__', {
		transformCallback: (callback: (event: unknown) => void) => {
			const id = callbacks.size + 1;
			callbacks.set(id, callback);
			return id;
		},
		invoke: async (command: string, args?: { event?: string; handler?: number }) => {
			if (command === 'plugin:event|listen' && args?.event === 'display-characters') {
				queueMicrotask(() =>
					callbacks.get(args.handler!)?.({
						payload: {
							simplified: '学习中文学习中文',
							traditional: '学习中文学习中文',
							pinyin: {
								marks: 'xué xí zhōng wén xué xí zhōng wén',
								numbers: '',
								tones: [2, 2, 1, 2, 2, 2, 1, 2],
							},
							displaySettings: {
								showPinyin: parameters.has('pinyinOn'),
								colorByTone: false,
							},
						},
					})
				);
			}
			return 1;
		},
	});
	// Measure with the same loaded fonts used by the rendered runs.
	void document.fonts.ready.then(() => {
		ready = true;
	});
</script>

{#if characterWindow}
	<CharacterWindow />
{:else if ready}
	<section
		style={`width:${width}px;font-size:${fontSize}px;line-height:2;font-family:sans-serif`}
	>
		<ReaderText
			{segments}
			lines={layoutReaderText(segments, {
				width,
				fontSize,
				lineHeight: fontSize * 2,
				fontFamily: 'sans-serif',
			})}
			onopen={() => {}}
		/>
	</section>
{/if}
