<template>
	<div>
		<center>
            <i-input :value.sync="destinationSite" style="width: 85%" placeholder="Paste a URL here..."></i-input>
            <br>
            <i-button class="web-actions" type="primary" shape="circle" v-on:click="parseSite()">Read from Web</i-button>
		</center>
	</div>
</template>

<style scoped>
.web-actions {
    margin-top: 25px;
}
</style>

<script>
module.exports = {
	data: function() {
		return {
            destinationSite: '',
            contentText: ''
		}
	},
    methods: {
        parseSite: function() {
            var self = this;
            $.ajax({
                type: 'GET',
                url: this.destinationSite,
                success: function(result) {
                    self.contentText = $(result).text();
                    self.initializeReader();
                },
                error: function(err) {
                    self.$Message.error('There was an error trying to get that webpage.');
                    console.error(err);
                }
            });
        },
        initializeReader: function() {
            if(this.contentText.length < 1) {
                this.$Message.warning('The page you entered does not have any readable text. Please try a different page');
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
