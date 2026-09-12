export function createFakeJenkinsFixture(routes = {}) {
  const calls = [];
  const fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = (
      init.method ||
      (typeof input === 'string' ? 'GET' : input.method) ||
      'GET'
    ).toUpperCase();
    calls.push({ method, url: url.href, body: init.body });
    const route = routes[`${method} ${url.pathname}`];
    if (!route) return new Response('Not Found', { status: 404 });
    const response = typeof route === 'function' ? await route({ url, init }) : route;
    return response instanceof Response
      ? response
      : new Response(JSON.stringify(response.body ?? response), {
          status: response.status ?? 200,
          headers: { 'Content-Type': 'application/json', ...(response.headers ?? {}) },
        });
  };
  return { calls, fetch };
}
