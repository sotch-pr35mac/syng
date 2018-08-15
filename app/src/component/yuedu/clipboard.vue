<template>
	<div>
		<center>
			<i-input :value.sync="contentText" style="width: 85%" placeholder="Paste content here..."></i-input>
			<br>
    		<i-button class="clipboard-actions" shape="circle" type="primary" v-on:click="initializeReader()">Read from Clipboard</i-button>
		</center>
	</div>
</template>

<style scoped>
.clipboard-actions {
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
    attached: function() {
        var self = this;

        $(document).ready(function() {
            // Hacky workaround to fix the loading animations inside the textbox
            $('.ivu-icon-load-c').hide();
        });
    },
	methods: {
		initializeReader: function() {
            if(this.contentText.length < 1) {
                this.$Message.info('Please paste content into the paste bar before continuing.');
            } else {
                window.engine.segment(this.contentText).then(result => {
    		    	this.$dispatch('readText', result);
                }).catch(err => {
                    this.$Message.error('There was an error while trying to parse that text. Please try again later.');
                    console.error(err);
        		});
            }
		}
	}
}
</script>
