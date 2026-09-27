import { mokaAdapter } from "./moka.js";
import { genericAdapter } from "./generic.js";

/**
 * 平台适配器注册表，按顺序检测，genericAdapter 放最后作为兜底。
 * @type {import('./adapter-interface.js').PlatformAdapter[]}
 */
export const ADAPTERS = [mokaAdapter, genericAdapter];

/** @returns {import('./adapter-interface.js').PlatformAdapter} */
export function detectAdapter() {
  return ADAPTERS.find((adapter) => adapter.detect()) ?? genericAdapter;
}
