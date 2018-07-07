<template>
    <div class="reader">
    	<span v-for="word in segmentedWords"><span v-if="word.isWord" class="clickableWord" v-on:click="inspectWord($index)">{{word.text}}</span><span v-if="word.isWord == false">{{word.text}}</span></span>
    </div>
</template>

<style scoped>
</style>

<script>
module.exports = {
    props: [ 'segmentedWords' ],
    data: function() {
        return {}
    },
    methods: {
    	inspectWord: function(wordIndex) {
    		var self = this;
    		console.log(self.segmentedWords[wordIndex].wordObject[0]);
    	}
    }
}
</script>