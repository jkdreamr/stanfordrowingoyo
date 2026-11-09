declare const __OYO_DIVE_TEST__: boolean;

export const DIVE_ENABLED = false;
export const DIVE_AVAILABLE =
  DIVE_ENABLED || (typeof __OYO_DIVE_TEST__ !== 'undefined' && __OYO_DIVE_TEST__);
