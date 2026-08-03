# Vendored benchmark inputs

`acorn.js` — acorn 8.18.0, `dist/acorn.js` (the UMD build) verbatim from npm.
MIT licensed, © Acorn contributors; see
<https://github.com/acornjs/acorn/blob/master/acorn/LICENSE>.

It is checked in rather than fetched at run time so a benchmark result is
reproducible from the repository alone: an engine's number would otherwise
depend on whichever acorn version npm happened to serve that day, and the
`acorn-self-parse` case parses this exact file as its input.
