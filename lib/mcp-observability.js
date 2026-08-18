const METHODS = new Set(['initialize', 'tools/list', 'tools/call']);
const TOOLS = new Set([
  'search_developers',
  'get_developer_profile',
  'request_introduction',
  'get_introduction_status',
]);

export function describeMcpRequest(body) {
  const method = METHODS.has(body?.method) ? body.method : 'other';
  const tool = method === 'tools/call' && TOOLS.has(body?.params?.name) ? body.params.name : null;
  return { method, tool };
}

export function recordMcpMetric(metric, logger = console.info) {
  logger(JSON.stringify({
    event: 'devglobe_mcp',
    timestamp: new Date().toISOString(),
    method: metric.method,
    ...(metric.tool ? { tool: metric.tool } : {}),
    outcome: metric.outcome,
    durationMs: metric.durationMs,
    ...(Number.isInteger(metric.resultCount) ? { resultCount: metric.resultCount } : {}),
  }));
}