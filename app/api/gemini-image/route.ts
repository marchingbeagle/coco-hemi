import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { GEMINI_IMAGE_MODEL } from "../../../src/config/constants";
import { dataUrlToInlineData, findGeminiGeneratedImage, getGeminiErrorMessage } from "../../../src/lib/gemini";

function getPartInlineData(part: unknown) {
  const candidate = part as { inlineData?: unknown; inline_data?: unknown } | null;
  return candidate?.inlineData || candidate?.inline_data || null;
}

function getGeminiImageData(response: unknown) {
  const generatedPart = findGeminiGeneratedImage(response);
  const inlineData = getPartInlineData(generatedPart) as
    | { data?: string; mimeType?: string; mime_type?: string }
    | null;
  const generatedData = inlineData?.data;
  const mimeType = inlineData?.mimeType || inlineData?.mime_type || "image/png";

  if (!generatedData) {
    throw new Error("A resposta do Gemini nao trouxe uma imagem. Tente outro filtro ou prompt.");
  }

  return { data: generatedData, mimeType };
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(
      { error: "Configure GEMINI_API_KEY no arquivo .env do projeto para usar os filtros IA." },
      { status: 400 },
    );
  }

  try {
    const body = (await request.json()) as { prompt?: string; imageDataUrl?: string };
    if (!body.prompt || !body.imageDataUrl) {
      return NextResponse.json({ error: "Envie prompt e imagem para gerar o filtro IA." }, { status: 400 });
    }

    const inlineData = dataUrlToInlineData(body.imageDataUrl);
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [
        { text: body.prompt },
        {
          inlineData: {
            mimeType: inlineData.mimeType,
            data: inlineData.data,
          },
        },
      ],
    });

    return NextResponse.json(getGeminiImageData(response));
  } catch (error) {
    return NextResponse.json({ error: getGeminiErrorMessage(error) }, { status: 500 });
  }
}

