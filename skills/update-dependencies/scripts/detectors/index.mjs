/* Detector registry. A new ecosystem is a module with { id, reference, detect, outdated } plus a
   references/detectors/<id>.md the agent reads only when that ecosystem is present. */
import * as npm from './npm.mjs';
import * as nodeRuntime from './node-runtime.mjs';
import * as docker from './docker.mjs';
import * as githubActions from './github-actions.mjs';
import * as python from './python.mjs';
import * as apple from './apple.mjs';

export const detectors = [npm, nodeRuntime, docker, githubActions, python, apple];
export const byId = Object.fromEntries(detectors.map((d) => [d.id, d]));
