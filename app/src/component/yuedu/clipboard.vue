<template>
	<div>
		<center>
			<!-- <textarea></textarea> -->
			<i-input :value.sync="contentText" style="width: 85%" placeholder="Paste content here..."></i-input>
			<br>
			<i-button class="read-from-clipboard" type="primary" shape="circle" v-on:click="initializeReader()">Read</i-button>
		</center>
	</div>
</template>

<style scoped>
.read-from-clipboard {
    margin-top: 25px;
}
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
				self.$dispatch('readText', result);
			}).catch(function(err) {
				console.log("ERROR");
				console.log(err);
			});
		}
	}
}
</script>
