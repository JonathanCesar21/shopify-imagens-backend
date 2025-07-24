const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { Configuration, OpenAIApi } = require("openai");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 4000;

// Configuração OpenAI
const configuration = new Configuration({ apiKey: OPENAI_API_KEY });
const openai = new OpenAIApi(configuration);

// 🔄 ROTA: Listar produtos com handle
app.get("/api/produtos", async (req, res) => {
  try {
    const response = await axios.get(
      `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/products.json?fields=id,title,handle,tags,images,created_at`,
      {
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const produtos = response.data.products
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map((p) => ({
        id: p.id,
        title: p.title,
        handle: p.handle,
        tags: p.tags,
        images: p.images || [],
        created_at: p.created_at,
      }));

    res.json(produtos);
  } catch (error) {
    console.error("❌ Erro ao buscar produtos:", error.response?.data || error.message);
    res.status(500).json({ erro: "Erro ao buscar produtos." });
  }
});

// 🚀 ROTA: Remover BG e gerar novo background via OpenAI
app.post("/api/remove-bg/:productId/:imageId", async (req, res) => {
  const { productId, imageId } = req.params;

  try {
    // 1) Buscar imagem original no Shopify
    const prodRes = await axios.get(
      `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/products/${productId}.json?fields=images`,
      { headers: { "X-Shopify-Access-Token": ACCESS_TOKEN } }
    );
    const images = prodRes.data.product.images || [];
    const imgObj = images.find((i) => i.id === parseInt(imageId, 10));
    if (!imgObj) return res.status(404).json({ erro: "Imagem não encontrada." });

    const imageUrl = imgObj.src;

    // 2) Baixar a imagem para buffer
    const imgResponse = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const imageBuffer = Buffer.from(imgResponse.data, "binary");

    // 3) Chamada OpenAI Image Edit
    const prompt =
      "Remova o background do calçado e gere um fundo branco sólido na cor e8ecea, iluminação suave de estúdio, sem objetos, sem sombras, clean, estilo e-commerce.";
    const editRes = await openai.createImageEdit(
      imageBuffer,    // imagem original
      imageBuffer,    // máscara (usar a própria imagem para selecionar tudo)
      prompt,
      1,
      "1024x1024"
    );

    const newImageUrl = editRes.data.data[0].url;
    res.json({ newImageUrl });
  } catch (error) {
    console.error("❌ Erro ao gerar novo background:", error);
    res.status(500).json({ erro: "Erro ao gerar novo background." });
  }
});

// 📤 ROTA: Enviar imagem base64 para produto
app.post("/api/upload/:productId", async (req, res) => {
  const { productId } = req.params;
  const { imageBase64 } = req.body;

  try {
    const response = await axios.post(
      `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/products/${productId}/images.json`,
      { image: { attachment: imageBase64 } },
      {
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error("❌ Erro ao enviar imagem:", error.response?.data || error.message);
    res.status(500).json({ erro: "Erro ao enviar imagem." });
  }
});

// 🔃 ROTA: Reordenar imagens do produto
app.put("/api/imagem/:productId/:imageId", async (req, res) => {
  const { productId, imageId } = req.params;
  const { position } = req.body;

  try {
    const response = await axios.put(
      `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/products/${productId}/images/${imageId}.json`,
      { image: { id: parseInt(imageId, 10), position: Math.max(1, parseInt(position, 10)) } },
      {
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error("❌ Erro ao reordenar imagem:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ erro: "Erro ao reordenar imagem." });
  }
});

// 🚀 Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Backend rodando em http://localhost:${PORT}`);
});