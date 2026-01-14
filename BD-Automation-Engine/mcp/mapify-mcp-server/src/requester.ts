const MAPIFY_API = "https://mapify.so/api/v1/preview-mind-maps";

export async function makeMapifyRequest(
  prompt: string,
  mode: string,
  language: string
) {
  const response = await fetch(MAPIFY_API, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.MAPIFY_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      mode: mode,
      language: language,
      from: "mcp",
    }),
  });

  return await response.json();
}
