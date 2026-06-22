export type GeneratedImageResponse = {
  mimeType: string;
  data: string;
};

export async function generateAiImage(prompt: string, imageDataUrl: string): Promise<GeneratedImageResponse> {
  const response = await fetch("/api/gemini-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, imageDataUrl }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || "Nao foi possivel gerar a imagem com IA.");
  }

  if (!payload?.data) {
    throw new Error("A resposta do Gemini nao trouxe uma imagem. Tente outro filtro ou prompt.");
  }

  return {
    mimeType: payload.mimeType || "image/png",
    data: payload.data,
  };
}

