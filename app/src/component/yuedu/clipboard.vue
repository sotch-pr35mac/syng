<template>
	<div>
		<center>
			<!-- <textarea></textarea> -->
			<i-input :value.sync="contentText" style="width: 85%"></i-input>
			<br>
			<i-button type="primary" shape="circle" v-on:click="initializeReader()">Read</i-button>
		</center>
	</div>
</template>

<style scoped>
</style>

<script>
module.exports = {
	data: function() {
		return {
			contentText: ''
		}
	},
	methods: {
		initializeReader: function() {
			var self = this;
			window.engine.segment(self.contentText).then(function(result) {
				console.log(result);
			}).catch(function(err) {
				console.log("ERROR");
				console.log(err);
			});
		}
	}
}
</script>