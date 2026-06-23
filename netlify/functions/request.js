import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  if (req.method !== "DELETE") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { endpointId, requestId } = context.params;

  const endpointStore = getStore("webhook_endpoints");
  const endpoint = await endpointStore.get(endpointId, { type: "json" });
  if (!endpoint) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const requestsStore = getStore("webhook_requests");
  const requests = (await requestsStore.get(endpointId, { type: "json" })) || [];

  const filtered = requests.filter((r) => r.id !== requestId);
  if (filtered.length === requests.length) {
    return Response.json({ error: "Request not found" }, { status: 404 });
  }

  await requestsStore.setJSON(endpointId, filtered);
  endpoint.requestCount = filtered.length;
  await endpointStore.setJSON(endpointId, endpoint);

  return new Response(null, { status: 204 });
};

export const config = { path: "/api/requests/:endpointId/:requestId" };
