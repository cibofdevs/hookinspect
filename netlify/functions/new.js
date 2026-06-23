import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const id = randomUUID();
  const endpoint = { id, createdAt: new Date().toISOString(), requestCount: 0 };

  const store = getStore("webhook_endpoints");
  await store.setJSON(id, endpoint);

  return Response.json({ id, createdAt: endpoint.createdAt });
};

export const config = { path: "/api/new" };
