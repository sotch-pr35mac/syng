<template>
	<div>
        <center>
            <div class="network-alert">
                <Alert show-icon>Network Connection Required</Alert>
            </div>
            <i-input :value.sync="destinationSite" style="width: 85%; margin-bottom: 15px;" placeholder="Paste a URL here..."></i-input>
            <br>
            <i-button type="primary" shape="circle" v-on:click="parseSite()">Read from Web</i-button>
        </center>
	</div>
</template>

<style scoped>
.network-alert {
    width: 85%;
    margin-top: 15px;
    margin-bottom: 25px;
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
    attached: function() {
        var self = this;

        $(document).ready(function() {
            // Hacky workaround to fix the loading animations inside the textbox
            $('.ivu-icon-load-c').hide();
        });
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
