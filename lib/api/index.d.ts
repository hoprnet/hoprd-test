import type { default as Hopr } from '@hoprnet/hopr-core';
import type { LogStream } from '../logs.js';
import type { StateOps } from '../types.js';
export default function setupAPI(node: Hopr, logs: LogStream, stateOps: StateOps, options: {
    disableApiAuthentication: boolean;
    apiHost: string;
    apiPort: number;
    apiToken?: string;
}): () => void;
//# sourceMappingURL=index.d.ts.map