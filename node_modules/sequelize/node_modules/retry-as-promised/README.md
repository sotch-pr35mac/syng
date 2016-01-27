# retry-as-promised

```sh
$ npm install --save retry-as-promised
```

Retry a failed promise

```js
var retry = require('retry-as-promised');

// Will call the until max retries or the promise is resolved.
return retry(function () {
  return promise;
}, {
  max: 3, // maximum amount of tries, default: 1
  timeout: 10000 // throw if no response or error within milisecnd timeout, default: undefined
});
```

## Tested with

- Bluebird