(() => {
  if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return;

  let previousSource = null;
  let isRefreshing = false;

  const refreshMap = async () => {
    if (isRefreshing) return;
    isRefreshing = true;
    try {
      const response = await fetch(`/js/aviation/rix-surface-map.js?t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`Map request failed (${response.status})`);

      const source = await response.text();
      if (source === previousSource) return;

      const updatedMap = new Function(`${source}\nreturn RIX_SURFACE_MAP;`)();
      if (!updatedMap || !Array.isArray(updatedMap.taxiways)) {
        throw new Error('The edited map did not define a valid RIX_SURFACE_MAP.');
      }

      previousSource = source;
      window.RIX_SURFACE_MAP = updatedMap;
      console.info('[live map] Applied surface map update without resetting the session.');
    } catch (error) {
      console.error('[live map] Could not check/apply surface map update:', error);
    } finally {
      isRefreshing = false;
    }
  };

  refreshMap();
  window.setInterval(refreshMap, 700);
  console.info('[live map] Polling rix-surface-map.js for saved changes.');
})();
