import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(req.url);
  const match = url.pathname.match(/^\/r\/([^/]+)(\/.*)?$/);
  if (!match) {
    return Response.json({ error: "Invalid path" }, { status: 400, headers: CORS });
  }
  const endpointId = match[1];
  const subPath = match[2] || "/";

  const endpointStore = getStore("webhook_endpoints");
  const endpoint = await endpointStore.get(endpointId, { type: "json" });
  if (!endpoint) {
    return Response.json({ error: "Endpoint not found" }, { status: 404, headers: CORS });
  }

  // Capture headers
  const headers = {};
  req.headers.forEach((v, k) => { headers[k] = v; });

  // Capture body
  const contentType = req.headers.get("content-type") || "";
  let body = "";
  if (isBinary(contentType)) {
    const bytes = await req.arrayBuffer();
    body = `[Binary content: ${bytes.byteLength} bytes]`;
  } else {
    const text = await req.text();
    body = text.length > 100_000 ? text.slice(0, 100_000) + "\n... [truncated]" : text;
  }

  // Query params
  const queryParams = {};
  url.searchParams.forEach((v, k) => { queryParams[k] = v; });

  const newRequest = {
    id: randomUUID(),
    endpointId,
    method: req.method,
    path: subPath,
    headers,
    body,
    queryParams: Object.keys(queryParams).length ? queryParams : null,
    remoteAddr: context.ip || req.headers.get("x-forwarded-for") || "",
    contentType,
    userAgent: req.headers.get("user-agent") || "",
    createdAt: new Date().toISOString(),
  };

  const requestsStore = getStore("webhook_requests");
  let requests = (await requestsStore.get(endpointId, { type: "json" })) || [];
  requests.unshift(newRequest);
  if (requests.length > 100) requests = requests.slice(0, 100);
  await requestsStore.setJSON(endpointId, requests);

  endpoint.requestCount = (endpoint.requestCount || 0) + 1;
  await endpointStore.setJSON(endpointId, endpoint);

  return Response.json({ status: "received", id: newRequest.id }, { headers: CORS });
};

export const config = { path: "/r/*" };

function isBinary(contentType) {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  return (
    ct.startsWith("image/") || ct.startsWith("video/") || ct.startsWith("audio/") ||
    ct.includes("octet-stream") || ct.includes("pdf") || ct.includes("zip")
  );
}
