import { handleMcpOptions, handleRemoteMcpRequest } from '../../lib/remote-mcp.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  return handleRemoteMcpRequest(request);
}

export async function GET(request) {
  return handleRemoteMcpRequest(request);
}

export async function DELETE(request) {
  return handleRemoteMcpRequest(request);
}

export async function OPTIONS(request) {
  return handleMcpOptions(request);
}