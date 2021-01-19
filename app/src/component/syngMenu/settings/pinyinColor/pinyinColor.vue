<template>
	<div>
		<h3>Tone Mark Color Picker</h3>
		<div class="tone-mark-list" v-for="tone in tones" track-by="$index">
			<pinyin-color-selector :name="getToneName(tone)" :color="getToneColor(tone)" :tone="$index" @update="handleUpdate" pinyin-color-selector>	
		</div>
		<div class="tone-color-actions">
			<i-button class="tone-color-action-item" v-on:click="resetValues()">Reset to Default</i-button>
			<i-button type="primary" :disabled="!changed" class="tone-color-action-item" v-on:click="saveChanges()">Save</i-button>
		</div>
	</div>
</template>

<style>
.tone-mark-grid {
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;
	justify-content: space-around;
}
.tone-mark-color-selector {
	flex: 30%;
}
.tone-mark-item {
	padding: 10px 25px 10px 25px;
}
.tone-color-actions {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: flex-end;
}
.tone-color-action-item {
	margin: 0px 5px 0px 5px;
}
</style>

<script>
var pinyinColorSelector = require('./pinyinColorSelector.vue');
var colorUtilities = require('../../../../lib/pinyin-color/pinyinColorUtils.js');

module.exports = {
	data: function() {
		return {
			colorData: colorUtilities.getColors(),
			displayData: {
				0: 'No Tone',
				1: 'Frist Tone',
				2: 'Second Tone',
				3: 'Third Tone',
				4: 'Fourth Tone'
			},
			changed: false
		}
	},
	computed: {
		tones: function() {
			return Object.keys(this.colorData).sort();
		},
		toneColors: function() {
			return Object.keys(this.colorData).sort().map(t => colorData[t]);
		}
	},
	methods: {
		getToneName(tone) {
			return this.displayData[tone];
		},
		getToneColor(tone) {
			return this.colorData[tone];
		},
		handleUpdate(toneData) {
			this.changed = true;
			this.colorData[toneData.tone] = toneData.color;
		},
		resetValues() {
			this.changed = false;
			colorUtilities.resetDefaults();
			alert("Please restart Syng for your changes to take effect.");	
		},
		saveChanges() {
			this.changed = false;
			colorUtilities.writeColorData(this.colorData);
		}
	},
	components: {
		pinyinColorSelector: pinyinColorSelector
	}
}
</script>
