import { F as FetchArtifact } from './index-DkNRxKxP.js';
import 'viem/accounts';
import 'buffer';
import 'assert';
import 'viem';
import 'viem/chains';

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
//# sourceMappingURL=fetchArtifacts.node-D-fJGtzV.js.map
