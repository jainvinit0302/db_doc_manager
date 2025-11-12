export async function introspectDatabase(params: any) {
  const res = await fetch("http://localhost:5000/api/introspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) throw new Error(`Introspection failed: ${res.statusText}`);
  return res.json();
}
