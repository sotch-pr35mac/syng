<template>
    <div class="reader">
        <i-col span="26">
            <Row>
               <div class="text-section">
                   <span v-for="word in segmentedWords"><span v-if="word.isWord" class="clickableWord" v-bind:class="{'word-clicked': activeIndex == $index}" v-on:click="inspectWord($index)">{{word.text}}</span><span v-if="word.isWord == false">{{word.text}}</span></span>
              </div>
            </Row>
            <Row>
                <div class="inspection-section">
                    <span>
                        <h4>Traditional: {{ inspectionInformation.traditional }}</h4>
                        <h4>Simplified: {{ inspectionInformation.simplified }}</h4>
                        <h4>Pinyin: {{ inspectionInformation.pronunciation }}</h4>
                        <p>Definitions: {{ inspectionInformation.definitions }}</p>
                    </span>
                </div>
            </Row>
        </i-col>
    </div>
</template>

<style scoped>
.word-clicked {
    background-color: blue;
}
.text-section {
    height: 60vh;
    font-size: 1.1em;
    padding: 10px;
}
.inspection-section {
    height: 32vh;
    padding: 5px;
}
</style>

<script>
module.exports = {
    props: [ 'segmentedWords' ],
    data: function() {
        return {
            inspectionInformation: {},
            activeIndex: -1
        }
    },
    methods: {
    	inspectWord: function(wordIndex) {
    		var self = this;
            self.inspectionInformation = self.segmentedWords[wordIndex].wordObject[0];
            self.activeIndex = wordIndex;
    	}
    }
}
</script>
