'use strict';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const GITHUB_TOKEN = GITHUB_TOKEN; // Ensure you have your GitHub token set in environment variables

  // Create a new request to the GitHub API
  const apiRequest = new Request(`https://api.github.com${url.pathname}`, {
    method: request.method,
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      ...request.headers,
    },
    body: request.method === 'GET' ? null : request.body,
  });

  // Fetch the response from GitHub API
  const response = await fetch(apiRequest);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}