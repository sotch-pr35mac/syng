<script>
/* Characters Prop */
export let characters = '';

/* Tones Prop */
export let tones = [];

const getClasses = index => {
    let tone = tones[index] || 5;
    return [`colored-characters--tone-${tone}`].join()
}
</script>

<style>
.colored-characters--tone-1 {
    color: #2880F2;
}
.colored-characters--tone-2 {
    color: #E48E1C;
}
.colored-characters--tone-3 {
    color: #E43978;
}
.colored-characters--tone-4 {
    color: #43B866;
}
.colored-characters--tone-5 {
    color: var(--sy-color--grey-4);
}
</style>

<span>
    {#each characters as character, index}
        <span class="{`colored-characters--tone-${tones[index] || 5}`}">{character}</span>
    {/each}
</span>
