(function(){
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
  loadNext(0);
})();
