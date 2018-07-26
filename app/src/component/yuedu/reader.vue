<template>
    <div class="reader">
        <i-col span="26">
            <Row>
               <div class="text-section">
                    <span v-for="word in segmentedWords"><span v-if="word.isWord" class="clickableWord" v-on:click="inspectWord($index)">{{word.text}}</span><span v-if="word.isWord == false">{{word.text}}</span></span>
              </div>
            </Row>
            <Row>
                <div class="inspection-section">
                    {{ inspectionInformation }}
                </div>
            </Row>
        </i-col>
    </div>
</template>

<style scoped>
.text-section {
    height: 60vh;
    background: red;
}
.inspection-section {
    height: 32vh;
    background: blue;
}
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
