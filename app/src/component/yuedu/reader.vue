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
                    <div v-if="activeIndex == -1">
                        <center>
                            <h3>No Word Selected</h3>
                            <h4>Click on a word to inspect it.</h4>
                        </center>
                    </div>
                    <div v-if="activeIndex != -1">
                        <Row>
                            <i-col span="5">
                                <div class="word-listing">
                                    <li class="word-listing-item" v-for="word in inspectionInformation" track-by="$index">
                                        <div class="word-listing-content" v-on:click="switchWord($index)">
                                            Stuff....
                                        </div>
                                    </li>
                                </div>
                            </i-col>
                            <i-col span="19">
                                <span>
                                    <h4>Traditional: {{ inspectionInformation[0].traditional }}</h4>
                                    <h4>Simplified: {{ inspectionInformation[0].simplified }}</h4>
                                    <h4>Pinyin: {{ inspectionInformation[0].pronunciation }}</h4>
                                    <p>Definitions: {{ inspectionInformation[0].definitions }}</p>
                                </span>
                            </i-col>
                        </Row>
                    </div>
                </div>
            </Row>
        </i-col>
    </div>
</template>

<style scoped>
.word-content {
    height: 32vh;
    overflow: auto;
}
.word-listing {
    height: 32vh;
    overflow-y: scroll;
    background-color: #f5f5f4;
    text-overflow: ellipsis;
    list-style: none;
}
.word-listing-item {
    padding: 10px;
    font-size: 12px;
    color: #414142;
    border-top: 1px solid #ddd;
}
.word-listing-item:first-child {
    border-top: 0px;
}
.word-listing-item.active, .list-group-item.selected {
    color: #fff;
    background-color: #11cd6;
}
.word-listing-content {
    overflow: hidden;
    cursor: pointer;
    text-size: 14pt;
}
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
}
</style>

<script>
module.exports = {
    props: [ 'segmentedWords' ],
    data: function() {
        return {
            inspectionInformation: [],
            activeIndex: -1
        }
    },
    methods: {
    	inspectWord: function(wordIndex) {
    		var self = this;
            self.inspectionInformation = self.segmentedWords[wordIndex].wordObject;
            self.switchWord(1);
            self.activeIndex = wordIndex;
    	},
        switchWord: function(entryIndex) {
            // TODO: Write this
        }
    }
}
</script>
