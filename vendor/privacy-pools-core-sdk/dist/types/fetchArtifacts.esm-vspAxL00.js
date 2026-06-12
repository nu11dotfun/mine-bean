import { F as FetchArtifact } from './index-Dyr-NSuQ.js';
import 'viem/accounts';
import 'buffer';
import 'http';
import 'https';
import 'zlib';
import 'crypto';
import 'node:crypto';
import 'events';
import 'net';
import 'tls';
import 'stream';
import 'url';
import 'fs';
import 'path';
import 'os';
import 'assert';
import 'viem';
import 'viem/chains';
import 'vm';
import 'worker_threads';
import 'constants';
import 'readline';

async function fetchVersionedArtifact(artifactUrl) {
    const res = await fetch(artifactUrl);
    if (res.status !== 200) {
        throw new FetchArtifact(artifactUrl);
    }
    const aBuf = await res.arrayBuffer();
    return new Uint8Array(aBuf);
}

export { fetchVersionedArtifact };
