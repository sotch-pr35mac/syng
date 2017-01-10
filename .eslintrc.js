/*
  Commented out certain lines so I can commit while working with legacy code.
*/

module.exports = {
    "env": {
        "es6": true,
        "node": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "sourceType": "module"
    },
    "rules": {
        "indent": [
            "warn",
            "tab"
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "warn",
            "single"
        ],
        "semi": [
            "error",
            "always"
        ],
        "no-undef": [
          "off"
        ],
        "no-console": [
          "off"
        ],
        "no-mixed-spaces-and-tabs": [
          "warn"
        ],
        "no-redeclare": [
          "warn"
        ]
    }
};
