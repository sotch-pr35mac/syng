<template>
    <center>
        <div class="selector-menu">
            <h2>Enter the path to a Syng Document Reader File (<code>.sdrf</code>).</h2>
            <br>
            <i-input id="document-path" :value.sync="documentPath"></i-input>
            <br>
            <i-button type="primary" shape="circle" v-on:click="select()" class="select-button">Select</i-button>
        </div>
    </center>
</template>

<style scoped>
    .selector-menu {
        position: absolute;
        top: 40vh;
        left: 60vh;
    }
    .select-button {
        margin-top: 20px;
    }
</style>

<script>
var fs = require('fs');

module.exports = {
    props: [],
    data: function() {
        return {
            documentPath: ''
        }
    },
    methods: {
        select() {
            var self = this;

            alert('open a file');
        }
    }
}
</script>