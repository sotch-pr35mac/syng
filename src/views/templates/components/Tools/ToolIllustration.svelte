<script lang="ts">
	import type { ToolName } from '@/types/tools.js';
	const { tool }: { tool: ToolName } = $props();
</script>

<span class="tool-artwork" aria-hidden="true">
	<svg class="tool-artwork__image" viewBox="0 0 256 256" focusable="false">
		<g
			stroke="var(--sy-tool-art--outline)"
			stroke-width="2.8"
			stroke-linecap="round"
			stroke-linejoin="round"
			font-family="'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif"
		>
			{#if tool === 'pinyinify'}
				<rect
					x="35"
					y="34"
					width="186"
					height="188"
					rx="14"
					fill="var(--sy-tool-art--surface)"
				/>
				<text
					x="128"
					y="106"
					text-anchor="middle"
					font-size="54"
					font-weight="500"
					fill="var(--sy-tool-art--ink)"
					stroke="none">你好</text
				>
				<path
					d="M128 121V146M120 138L128 146L136 138"
					stroke="var(--sy-tool-art--accent)"
					stroke-width="4"
					fill="none"
				/>
				<rect
					x="49"
					y="159"
					width="158"
					height="46"
					rx="8"
					fill="var(--sy-tool-art--tint)"
					stroke="none"
				/>
				<text
					x="128"
					y="191"
					text-anchor="middle"
					font-family="Arial,sans-serif"
					font-size="32"
					font-weight="500"
					fill="var(--sy-tool-art--accent)"
					stroke="none">nǐ hǎo</text
				>
			{:else if tool === 'converter'}
				<path
					d="M65 45Q125 12 183 43"
					fill="none"
					stroke="var(--sy-tool-art--accent)"
					stroke-width="9"
				/>
				<path
					d="M173 25L194 48L161 46Z"
					fill="var(--sy-tool-art--accent)"
					stroke="var(--sy-tool-art--accent)"
					stroke-width="4"
				/>
				<g transform="rotate(-9 83 129)"
					><rect
						x="29"
						y="66"
						width="108"
						height="132"
						rx="13"
						fill="var(--sy-tool-art--surface)"
					/><text
						x="83"
						y="158"
						text-anchor="middle"
						font-size="68"
						font-weight="500"
						fill="var(--sy-tool-art--ink)"
						stroke="none">繁</text
					></g
				>
				<g transform="rotate(9 174 138)"
					><rect
						x="120"
						y="75"
						width="108"
						height="132"
						rx="13"
						fill="var(--sy-tool-art--tint)"
					/><text
						x="174"
						y="167"
						text-anchor="middle"
						font-size="68"
						font-weight="500"
						fill="var(--sy-tool-art--ink)"
						stroke="none">简</text
					></g
				>
				<path
					d="M190 220Q135 249 77 222"
					fill="none"
					stroke="var(--sy-tool-art--accent)"
					stroke-width="9"
				/>
				<path
					d="M87 240L66 217L99 219Z"
					fill="var(--sy-tool-art--accent)"
					stroke="var(--sy-tool-art--accent)"
					stroke-width="4"
				/>
			{:else if tool === 'colorize'}
				<rect
					x="56"
					y="24"
					width="119"
					height="127"
					rx="12"
					fill="var(--sy-tool-art--surface)"
				/>
				<text
					x="112"
					y="100"
					text-anchor="middle"
					font-size="65"
					font-weight="500"
					fill="var(--sy-color--green-3)"
					stroke="none">字</text
				>
				<path
					d="M114 111C67 112 28 145 30 184C32 218 64 238 105 235C126 234 137 224 151 222C166 220 183 228 199 216C224 196 207 154 187 133C167 114 140 109 114 111ZM154 180C141 178 133 185 134 194C135 204 150 209 160 202C170 194 165 182 154 180Z"
					fill="var(--sy-tool-art--surface)"
					fill-rule="evenodd"
				/>
				<g stroke="none"
					><circle cx="75" cy="155" r="13" fill="var(--sy-color--blue-3)" /><circle
						cx="113"
						cy="138"
						r="13"
						fill="var(--sy-color--yellow-1)"
					/><circle cx="152" cy="145" r="13" fill="var(--sy-color--red-1)" /><circle
						cx="64"
						cy="195"
						r="13"
						fill="var(--sy-color--green-3)"
					/><circle cx="105" cy="212" r="13" fill="var(--sy-color--grey-4)" /></g
				>
				<g transform="rotate(29 193 154)"
					><path
						d="M186 110H200L198 232Q193 241 188 232Z"
						fill="var(--sy-tool-art--accent)"
					/><path d="M186 97H200V115H186Z" fill="var(--sy-tool-art--metal)" /><path
						d="M186 97C173 80 182 63 195 46C191 66 211 78 200 97Z"
						fill="var(--sy-color--green-3)"
					/></g
				>
			{:else if tool === 'prettify'}
				<g transform="rotate(-7 116 139)">
					<rect
						x="37"
						y="56"
						width="161"
						height="155"
						rx="11"
						fill="var(--sy-tool-art--surface)"
					/>
					<path d="M52 57V210" stroke="var(--sy-tool-art--accent)" stroke-width="3" />
					<g fill="var(--sy-tool-art--accent)"
						><rect x="64" y="43" width="11" height="28" rx="5.5" /><rect
							x="111"
							y="43"
							width="11"
							height="28"
							rx="5.5"
						/><rect x="158" y="43" width="11" height="28" rx="5.5" /></g
					>
					<text
						x="88"
						y="139"
						text-anchor="middle"
						font-family="Arial,sans-serif"
						font-size="28"
						font-weight="500"
						fill="var(--sy-tool-art--ink)"
						stroke="none">ni3</text
					>
					<path
						d="M117 130H138M132 124L139 130L132 136"
						fill="none"
						stroke="var(--sy-tool-art--accent)"
						stroke-width="3"
					/>
					<text
						x="166"
						y="139"
						text-anchor="middle"
						font-family="Arial,sans-serif"
						font-size="30"
						font-weight="500"
						fill="var(--sy-tool-art--accent)"
						stroke="none">nǐ</text
					>
				</g>
				<g transform="rotate(29 202 143)"
					><rect
						x="195"
						y="60"
						width="15"
						height="123"
						rx="7.5"
						fill="var(--sy-tool-art--accent)"
					/><path d="M195 169H210V182H195Z" fill="var(--sy-tool-art--metal)" /><path
						d="M195 182L192 197L202.5 224L213 197L210 182Z"
						fill="var(--sy-tool-art--metal)"
					/><path d="M202.5 204V222" fill="none" /><circle
						cx="202.5"
						cy="201"
						r="2.4"
						fill="var(--sy-tool-art--ink)"
						stroke="none"
					/></g
				>
			{:else if tool === 'frequency'}
				<g transform="rotate(6 126 143)"
					><rect
						x="45"
						y="57"
						width="163"
						height="157"
						rx="6"
						fill="var(--sy-tool-art--backing)"
					/></g
				>
				<g transform="rotate(-6 119 131)"
					><rect
						x="31"
						y="44"
						width="169"
						height="159"
						rx="6"
						fill="var(--sy-tool-art--surface)"
					/>
					<text
						x="127"
						y="78"
						text-anchor="middle"
						font-size="24"
						font-weight="500"
						fill="var(--sy-tool-art--accent)"
						stroke="none">中文</text
					>
					<text
						x="121"
						y="128"
						text-anchor="middle"
						font-size="48"
						font-weight="600"
						fill="var(--sy-color--red-1)"
						stroke="none">学习</text
					>
					<text
						x="77"
						y="165"
						text-anchor="middle"
						font-size="28"
						font-weight="500"
						fill="var(--sy-tool-art--accent)"
						stroke="none">你好</text
					>
					<text
						x="111"
						y="188"
						text-anchor="middle"
						font-size="23"
						font-weight="500"
						fill="var(--sy-tool-art--muted)"
						stroke="none">朋友</text
					>
				</g>
				<path d="M204 196L232 223" stroke="var(--sy-tool-art--outline)" stroke-width="17" />
				<path d="M204 196L232 223" stroke="var(--sy-tool-art--accent)" stroke-width="11" />
				<circle cx="185" cy="176" r="34" fill="var(--sy-tool-art--accent)" />
				<circle cx="185" cy="176" r="26" fill="var(--sy-tool-art--surface)" />
				<text
					x="185"
					y="188"
					text-anchor="middle"
					font-size="32"
					font-weight="500"
					fill="var(--sy-tool-art--accent)"
					stroke="none">词</text
				>
			{/if}
		</g>
	</svg>
</span>

<style>
	.tool-artwork {
		display: block;
		width: 100%;
		height: 100%;
	}
	svg {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
