export let handleError = (message, moreInfo) => {
    if (moreInfo) {
        console.error(moreInfo);
    }
    alert(message);
};
