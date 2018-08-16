<template>
    <div>
        <Tabs type="card" active-key="1">
            <Tab-pane v-for="word in components" track-by="$index" :key="($index + 1) + ''" :label="getTitle(word.simplified, word.traditional)">
                <h1>{{ getTitle(word.simplified, word.traditional) }}</h2>
                <h2>{{ word.pronunciation }}</h2>
            </Tab-pane>
        </Tabs>
    </div>
</template>

<style scoped>
</style>

<script>
module.exports = {
    props: [ 'components' ],
    methods: {
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
