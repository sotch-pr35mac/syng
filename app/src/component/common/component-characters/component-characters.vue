<template>
    <div>
        <Tabs type="card" active-key="1">
            <Tab-pane v-for="word in components" track-by="$index" :key="($index + 1) + ''" :label="getTitle(word.simplified, word.traditional)">
                <h1>{{ getTitle(word.simplified, word.traditional) }}</h2>
                <h2>{{ word.pronunciation }}</h2>
                <Tabs active-key="definitions">
                    <Tab-pane label="Definitions" key="definitions">
                        <div class="definitions-list">
                            <li v-for="def in word.definitions">{{ def }}</li>
                        </div>
                    </Tab-pane>
                    <Tab-pane label="Breakdown" key="breakdown">
                        <p v-for="radical in getDecomposition(word.simplified)">
                            {{ radical }} - {{ getRadicalMeaning(radical) }}
                        </p>
                        <!-- 
                        <center>
                            <h2>
                                {{ getDecomposition(word.simplified) }}
                            </h2>
                        </center>
                        -->
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
</style>

<script>
module.exports = {
    props: [ 'components' ],
    methods: {
        getRadicalMeaning: function(radical) {
            return window.engine.radicalDefinition(radical);
        },
        getDecomposition: function(character) {
            return window.engine.decompose(character);
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
