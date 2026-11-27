(function(){
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .catch(error => console.error('Service worker registration failed.', error));
  }
  const showError = message => {
    document.body.innerHTML = '<div style="padding:40px;color:white;font-family:system-ui"><h1>Simulator could not initialise</h1><p>' + message + '</p></div>';
  };
  if (!window.THREE) {
    showError('Three.js did not load. An internet connection is required for the rendering library.');
    return;
  }
  const files = [
    'silicon-run-core.js',
    'parallel-wafer-runtime.js',
    'design-workstation-runtime.js',
    'design-world-runtime.js',
    'cleanroom-lod.js',
    'cleanroom-debug.js',
    'cleanroom-realism.js',
    'cleanroom-pedagogy.js',
    'cleanroom-audio.js',
    'silicon-run-startup.js'
  ];
  const loadNext = index => {
    if (index >= files.length) return;
    const script = document.createElement('script');
    script.src = './js/' + files[index];
    script.onload = () => loadNext(index + 1);
    script.onerror = () => showError('A simulator component could not be loaded: ' + files[index]);
    document.head.appendChild(script);
  };
  const loadModel = asset => fetch(asset).then(response => {
    if (!response.ok) throw new Error(asset + ': HTTP ' + response.status);
    return response.json();
  });
  Promise.all([
    loadModel('./assets/photolithography-wafer-machine.json'),
    loadModel('./assets/oxidation-furnace-sliding-tray-v2.json')
  ])
    .then(([photoresistModel, oxidationModel]) => {
      window.PhotolithographyMachineModel = photoresistModel;
      window.OxidationFurnaceModel = oxidationModel;
      loadNext(0);
    })
    .catch(error => {
      console.error('Could not load the imported machine models.', error);
      showError('An imported machine model could not be loaded.');
    });
})();
