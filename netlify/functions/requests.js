import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const { endpointId } = context.params;

  const endpointStore = getStore("webhook_endpoints");
  const endpoint = await endpointStore.get(endpointId, { type: "json" });
  if (!endpoint) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const requestsStore = getStore("webhook_requests");

  if (req.method === "GET") {
    const requests = (await requestsStore.get(endpointId, { type: "json" })) || [];
    return Response.json(requests);
  }

  if (req.method === "DELETE") {
    await requestsStore.delete(endpointId);
    endpoint.requestCount = 0;
    await endpointStore.setJSON(endpointId, endpoint);
    return new Response(null, { status: 204 });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
};

export const config = { path: "/api/requests/:endpointId" };
