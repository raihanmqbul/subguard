export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Serve the index.html for all requests
    const asset = await env.ASSETS.fetch(url);
    
    // If asset not found, return index.html (for SPA routing)
    if (asset.status === 404) {
      return env.ASSETS.fetch(new URL('/index.html', url.origin));
    }
    
    return asset;
  }
}
