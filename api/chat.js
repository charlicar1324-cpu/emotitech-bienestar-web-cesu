export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en Vercel' });
  }

  try {
    const { contents, systemInstruction, generationConfig } = req.body;

    // 1. Autodescubrir modelos activos permitidos para tu clave
    const listResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResp.json();

    if (!listResp.ok) {
      return res.status(listResp.status).json({ error: listData.error?.message || 'API Key inválida' });
    }

    const validModels = (listData.models || [])
      .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name);

    validModels.sort((a, b) => {
      const score = name => name.includes('lite') ? 1 : (name.includes('flash') ? 2 : 3);
      return score(a) - score(b);
    });

    const selectedModel = validModels[0] || 'models/gemini-2.5-flash';

    // 2. Generar la respuesta desde el servidor seguro
    const genResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/${selectedModel}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig
      })
    });

    const genData = await genResp.json();
    if (!genResp.ok) {
      return res.status(genResp.status).json({ error: genData.error?.message || 'Error al generar respuesta' });
    }

    return res.status(200).json(genData);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
