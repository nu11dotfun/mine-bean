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
    try {
        const fs = (await import('fs')).default;
        const readPromise = new Promise((resolve, reject) => {
            fs.readFile(artifactUrl.pathname, (err, data) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(data);
                }
            });
        });
        const buf = await readPromise;
        return new Uint8Array(buf);
    }
    catch (error) {
        console.error(error);
        throw new FetchArtifact(artifactUrl);
    }
}

export { fetchVersionedArtifact };
