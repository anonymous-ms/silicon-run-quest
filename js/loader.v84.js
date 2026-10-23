'use strict';
const BUILD = 'v8.4-control-guard-20261023';
const SILICON_RUN_PARTS = [
  './js/base.v84.js',
  './js/parallel-wafers.v84.js',
  './js/design-workstation.v84.js',
  './js/bootstrap.v84.js'
];

async function startSiliconRun() {
  try {
    const responses = await Promise.all(SILICON_RUN_PARTS.map(path => fetch(`${path}?build=${BUILD}`, { cache: 'reload' })));
    const failed = responses.find(response => !response.ok);
    if (failed) throw new Error(`Could not load ${failed.url}: HTTP ${failed.status}`);
    const source = (await Promise.all(responses.map(response => response.text()))).join('\n\n');
    new Function(`(() => { 'use strict';\n${source}\n})();`)();
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `<div style="padding:40px;color:white;font-family:system-ui"><h1>Simulator could not initialise</h1><p>${String(error.message || error)}</p></div>`;
  }
}

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(console.error));
}

startSiliconRun();
