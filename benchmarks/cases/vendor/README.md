# Vendored benchmark inputs

`acorn.js` — acorn 8.18.0, `dist/acorn.mjs` from npm with the trailing
`export {…}` block stripped (the only edit — verify with a diff against the
npm tarball). MIT licensed, © Acorn contributors; see
<https://github.com/acornjs/acorn/blob/master/acorn/LICENSE>.

The **script form** is vendored rather than the UMD `dist/acorn.js` because
the UMD wrapper's IIFE turns every top-level binding into a captured frame
local — a pattern that stresses closure machinery instead of the parser, and
one that AOT compilers reject or miscompile long before parsing starts
(loopdive/js2#4139). The script form keeps the bindings top-level: the same
parser, none of the wrapper. `acorn-ns.js` rebuilds the `acorn` namespace
object the case reads.

Checked in rather than fetched at run time so a benchmark result is
reproducible from the repository alone; the `acorn-self-parse` case parses
this exact file as its input, so the checksum is pinned to these bytes.
