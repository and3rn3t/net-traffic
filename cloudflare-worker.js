/**
 * Cloudflare Worker for API proxying
 * Optional: Use this to proxy API requests to your Raspberry Pi backend
 * This helps with CORS and can add authentication/rate limiting
 * 
 * To use this:
 * 1. Deploy this worker to Cloudflare
 * 2. Update VITE_API_BASE_URL to point to your worker URL
 * 3. Set BACKEND_URL in worker environment variables
 */

export default {
  async fetch(request, env) {
    // Get backend URL from environment variable
    const BACKEND_URL = env.BACKEND_URL || 'http://your-raspberry-pi-ip:8000';
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Get the path from the request
    const url = new URL(request.url);
    const path = url.pathname;
    const search = url.search;

    // Proxy WebSocket upgrade requests
    if (request.headers.get('Upgrade') === 'websocket') {
      // For WebSocket, we need to use Durable Objects or pass through
      // For now, redirect to backend directly
      // Note: This requires the backend to be accessible from the internet
      const backendWsUrl = BACKEND_URL.replace('http://', 'ws://').replace('https://', 'wss://');
      return fetch(`${backendWsUrl}${path}${search}`, {
        method: request.method,
        headers: request.headers,
      });
    }

    // Proxy API requests
    try {
      const backendUrl = `${BACKEND_URL}${path}${search}`;
      const backendRequest = new Request(backendUrl, {
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers),
          'Host': new URL(BACKEND_URL).host,
        },
        body: request.body,
      });

      const response = await fetch(backendRequest);
      
      // Clone response to add CORS headers
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers),
          ...corsHeaders,
        },
      });

      return newResponse;
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Backend connection failed',
        message: error.message 
      }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
  },
};

