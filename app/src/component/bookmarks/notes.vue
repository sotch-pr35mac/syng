<template>
    <div>
        <div v-if="notes.length == 0 && !editing">
            <center>
                <p>No Notes</p>
            </center>
        </div>
        <div v-if="notes.length > 0 && !editing">
            <pre>{{ notes }}</pre>
        </div>
        <div v-if="editing">
                 <i-input :value.sync="notes" type="textarea" :autosize="true"></i-input>
            </div>
        <br>
        <Row>
            <div v-if="editing">
                <i-button v-on:click="save()" class="pull-right">Save</i-button>
            </div>
            <div v-if="!editing">
                <i-button v-on:click="edit()" type="primary" class="pull-right" v-if="notes.length > 0">Edit</i-button>
                <i-button v-on:click="edit()" type="primary" class="pull-right" v-if="notes.length == 0">Add Notes</i-button>
            </div>
        </Row>
    </div>
</template>

<style scoped>
    .pull-right {
        float: right;
    }
    p {
        font-size: 3vh;
    }
    pre {
        font-size: 3vh;
        line-height: 1.6;
        font-family: system, -apple-system, ".SFNSDisplay-Regular", "Helvetica Neue", Helvetica, "Segoe UI", sans-serif;
    }
</style>

<script>
module.exports = {
    props: [ 'notes' ],
    data: function() {
        return {
            editing: false
        }
    },
    methods: {
        edit: function() {
            var self = this;

            self.editing = true;
        },
        save: function() {
            var self = this;

            self.$dispatch("saveNotes", self.notes);
            self.editing = false;
        }
    }
}
</script>