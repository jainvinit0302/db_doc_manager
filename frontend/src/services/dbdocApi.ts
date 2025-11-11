// frontend/src/services/dbdocApi.ts
const API_BASE = import.meta.env.VITE_DBDOC_API_BASE || 'http://localhost:4000';

export async function validateYaml(yamlText: string) {
  const res = await fetch(`${API_BASE}/api/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: yamlText,
  });
  const json = await res.json();
  return json;
}

export async function generateArtifacts(yamlText: string) {
  const res = await fetch(`${API_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: yamlText,
  });
  if (!res.ok) {
    // try parse json error body
    try {
      const err = await res.json();
      throw err;
    } catch (e) {
      throw new Error('Server error during generation');
    }
  }
  return res.json();
}
