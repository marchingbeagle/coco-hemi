import { AI_PROMPT_GUARDRAILS } from "../config/constants";

export function dataUrlToInlineData(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Nao foi possivel preparar a imagem para a IA.");
  }
  return { mimeType: match[1], data: match[2] };
}

export function findGeminiGeneratedImage(response) {
  const parts = response?.candidates?.flatMap((candidate) => candidate?.content?.parts || []) || [];
  return parts.find((part) => part?.inlineData?.data || part?.inline_data?.data);
}

export function isInvalidGeminiAuthMessage(message) {
  return ["INVALID_ARGUMENT", "invalid authentication credentials", "Expected OAuth 2 access token"].some((item) =>
    message.includes(item),
  );
}

export function getQuotaGeminiErrorMessage(message, retrySeconds) {
  if (message.includes("limit: 0")) {
    return "A cota deste modelo de imagem esta indisponivel para esta chave/projeto. Confirme billing ativo e acesso ao modelo no Google AI Studio.";
  }
  if (retrySeconds) {
    return `A cota do Gemini foi temporariamente excedida. Tente novamente em cerca de ${retrySeconds}s.`;
  }
  return "A cota do Gemini foi excedida para este projeto. Aguarde ou revise limites e billing da chave.";
}

export function getGeminiErrorMessage(error) {
  const message = String(error?.message || "");
  const retryMatch = message.match(/Please retry in\s+([\d.]+)s/i);
  const retrySeconds = retryMatch ? Math.max(1, Math.ceil(Number(retryMatch[1]))) : null;
  const checks = [
    {
      test: isInvalidGeminiAuthMessage,
      message:
        "A chave Gemini foi rejeitada. Gere uma API key no Google AI Studio, confirme que ela pertence ao projeto certo e use essa chave em GEMINI_API_KEY.",
    },
    {
      test: (value) => value.includes("PERMISSION_DENIED"),
      message:
        "A chave Gemini nao tem permissao para esta chamada. Verifique se a key foi criada no AI Studio e se o projeto tem billing/acesso ao Gemini API.",
    },
    {
      test: (value) => value.includes("API key not valid") || value.includes("API_KEY_INVALID"),
      message: "A chave Gemini informada esta invalida.",
    },
  ];

  const matched = checks.find((item) => item.test(message));
  if (matched) return matched.message;
  if (message.includes("RESOURCE_EXHAUSTED") || message.toLowerCase().includes("quota")) {
    return getQuotaGeminiErrorMessage(message, retrySeconds);
  }
  return message || "Falha ao aplicar o filtro IA.";
}

export function appendPromptGuardrails(prompt) {
  const cleanPrompt = prompt.trim();
  if (cleanPrompt.includes("Quality & Realism:")) return cleanPrompt;
  return `${cleanPrompt}\n\n${AI_PROMPT_GUARDRAILS}`;
}

export function buildAiPrompt(preset, options) {
  const basePrompt = options.prompt.trim() || preset.prompt;
  if (preset.id !== "polaroid-instant") return appendPromptGuardrails(basePrompt);

  const caption = options.caption.trim();
  const date = options.date.trim();
  const details = [];

  if (caption) {
    details.push(`Add this handwritten-style caption on the bottom white margin: "${caption}".`);
  }
  if (date) {
    details.push(`Add this small date on the Polaroid border: "${date}".`);
  }
  if (!details.length) {
    details.push("Leave the Polaroid border clean without added caption or date text.");
  }

  return appendPromptGuardrails(
    `${basePrompt} ${details.join(" ")} Keep any added text legible, minimal and only on the white border.`,
  );
}

