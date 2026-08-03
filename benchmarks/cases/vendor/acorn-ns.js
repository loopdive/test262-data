// Rebuilds the `acorn` namespace object the case reads. The vendored file is
// acorn's ESM dist with the `export {…}` block stripped — its API surface is
// plain top-level functions, so the namespace is assembled here instead of by
// a module loader.
var acorn = { parse: parse, version: version };
