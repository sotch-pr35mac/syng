<template>
    <div class="reader">
    	<div class="text-section">
    		<span v-for="word in segmentedWords"><span v-if="word.isWord" class="clickableWord" v-on:click="inspectWord($index)">{{word.text}}</span><span v-if="word.isWord == false">{{word.text}}</span></span>
    	</div>
    	<div class="inspection-section">
    		{{ inspectionInformation }}
    	</div>
    </div>
</template>

<style scoped>
</style>

<script>
module.exports = {
    props: [ 'segmentedWords' ],
    data: function() {
        return {
        	inspectionInformation: ''
        }
    },
    methods: {
    	inspectWord: function(wordIndex) {
    		var self = this;
    		self.inspectionInformation = JSON.stringify(self.segmentedWords[wordIndex].wordObject[0]);
    		console.log(self.segmentedWords[wordIndex].wordObject[0]);
    	}
    }
}
</script>