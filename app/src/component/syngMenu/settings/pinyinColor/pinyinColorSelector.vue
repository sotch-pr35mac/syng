<template>
	<div class="pinyin-color-selector-group">
		<label class="color-label">
			{{ name }}
		</label>
		<i-input :value.sync="colorMod" class="color-input" placeholder="#FFFFFF" @change="handleUpdate"></i-input>
	</div>
</template>

<style scoped>
.pinyin-color-selector-group {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.color-input {
	margin: 15px 5px 15px 5px;
	max-width: 150px;
}
</style>

<script>
function validateSelection(color) {
	var valid = false;
	
	if(color[0] == '#' && color.length == 7) {
		valid = true;
	}

	return valid;
}

module.exports = {
	props: ['name', 'color', 'tone'],
	data: function() {
		return {
			colorMod: this.color
		}
	},
	methods: {
		handleUpdate() {
			if(validateSelection(this.colorMod)) {
				this.$emit("update", {
					tone: this.tone,
					color: this.colorMod
				});
			}
		}
	},
	attached: function() {
		var self = this;
		$(document).ready(function() {
			$('.ivu-icon-load-c').hide();
		});
	}	
};
</script>
