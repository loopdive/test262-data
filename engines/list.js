// The engines the controller runs, in order. Shared by the test262 controller
// and the benchmark controller so the two can never drift apart.
export default [
  'jsc',
  'jsc_exp',
  'v8',
  'v8_exp',
  'sm',
  'sm_exp',
  'qjs',
  'qjs_ng',
  'hermes',
  'porffor',
  'porffor_prealpha',
  'boa',
  'libjs',
  // 'engine262',
  'xs',
  'njs',
  'kiesel',
  'nova',
  'js2wasm'
];
