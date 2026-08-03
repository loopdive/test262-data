// Minimal CommonJS shim so a vendored UMD bundle takes its `exports` branch in
// every engine. Without it the bundle falls through to the globalThis branch,
// which is not reachable on shells that predate globalThis — and under Node it
// would bind to the real module exports instead of a global the case can see.
var __exports = {};
var exports = __exports;
var module = { exports: __exports };
