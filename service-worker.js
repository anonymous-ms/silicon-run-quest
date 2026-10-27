(() => { 'use strict';
  const doc = document;
  const body = doc.body;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function renderFatal(title, message, detail = '') {
    if (!body) return;
    body.innerHTML = `
      <div style="padding:40px;color:white;font-family:system-ui;max-width:960px;line-height:1.5;">
        <h1 style="font-size:clamp(2.2rem,4vw,5rem);margin:0 0 1.5rem;">${escapeHtml(title)}</h1>
        <p style="font-size:clamp(1.25rem,2vw,2.4rem);margin:0 0 1rem;">${escapeHtml(message)}</p>
        ${detail ? `<p style="font-size:clamp(1rem,1.5vw,1.8rem);margin:0;">${escapeHtml(detail)}</p>` : ''}
      </div>
    `;
  }

  if (!window.WebGLRenderingContext) {
    renderFatal('Simulator could not initialise', 'WebGL is not available in this browser session.', 'This usually means the browser is blocking the required 3D graphics capability, such as in a restrictive private/incognito mode.');
    return;
  }

  if (!window.THREE) {
    renderFatal(
      'Simulator could not initialise',
      'Three.js could not be loaded in this browser session.',
      'This can happen in private/incognito browsing or when a required script is blocked. Please retry in a normal browser window or allow the required graphics script.'
    );
    return;
  }

  const requiredIds = ['game', 'intro', 'designCanvas', 'gainSlider', 'interceptSlider', 'designExit', 'designNext'];
  const missingIds = requiredIds.filter(id => !doc.getElementById(id));
  if (missingIds.length) {
    renderFatal('Simulator could not initialise', 'The app shell did not finish loading correctly.', `Missing required DOM nodes: ${missingIds.join(', ')}`);
    return;
  }

  try {
    buildEnvironment();
    bind();
    updateBenchmark();
    stations.forEach((_, i) => updateControlMeshes(i));
    renderer.setAnimationLoop(loop);
  } catch (err) {
    console.error(err);
    renderFatal(
      'Simulator could not initialise',
      'The app failed to start in this environment.',
      err && err.message ? err.message : 'A runtime error occurred while booting the simulator.'
    );
  }
})();
//# sourceURL=silicon-run.js
