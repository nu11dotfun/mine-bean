import { F as FetchArtifact } from './index-DkNRxKxP.js';
import 'viem/accounts';
import 'buffer';
import 'assert';
import 'viem';
import 'viem/chains';

async function fetchVersionedArtifact(artifactUrl) {
    const res = await fetch(artifactUrl);
    if (res.status !== 200) {
        throw new FetchArtifact(artifactUrl);
    }
    const aBuf = await res.arrayBuffer();
    return new Uint8Array(aBuf);
}

export { fetchVersionedArtifact };
//# sourceMappingURL=fetchArtifacts.esm-DbVRphob.js.map
