import { NetworkManagerClass } from './NetworkManagerClass';
import * as NetworkTypes from './types';

export function createNetworkManager(
  options: NetworkTypes.Options = {},
): NetworkManagerClass {
  return new NetworkManagerClass(options);
}

export { NetworkTypes };
