<template>
    <div>
        <Tabs type="card" active-key="1">
            <Tab-pane v-for="word in components" track-by="$index" :key="($index + 1) + ''" :label="getTitle(word.simplified, word.traditional)">
                <div class="pull-right word-tags">
                    <Tag v-if="(word.simplified.length == 1) && getEra(word.simplified)" color="green">Era: {{ getEra(word.simplified) }}</Tag>
                </div>
                <h1>{{ getTitle(word.simplified, word.traditional) }}</h2>
                <h2>{{ word.pronunciation }}</h2>
                <Tabs active-key="definitions">
                    <Tab-pane label="Definitions" key="definitions">
                        <div class="definitions-list">
                            <li v-for="def in word.definitions">{{ def }}</li>
                        </div>
                    </Tab-pane>
                    <Tab-pane label="Breakdown" key="breakdown">
                        <center><h2>BREAKDOWN</h2></center>
                    </Tab-pane>
                </Tabs>
            </Tab-pane>
        </Tabs>
    </div>
</template>

<style scoped>
.definitions-list {
    list-style: circle;
    font-size: 12pt;
    color: black;
}
.word-tags {
    margin-top: 10px;
}
</style>

<script>
module.exports = {
    props: [ 'components' ],
    methods: {
        getEra: function(simplified) {
            return window.engine.tagEra(simplified);
        },
        getTitle: function(simplified, traditional) {
            var title;
            if(simplified == traditional) {
                title = simplified;
            } else {
                title = simplified + ' (' + traditional + ')';
            }

            return title;
        }
    }
}
</script>
