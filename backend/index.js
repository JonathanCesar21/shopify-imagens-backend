const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION;
const PORT = process.env.PORT || 4000;

// 🔄 ROTA: Listar produtos com campos essenciais
app.get("/api/produtos", async (req, res) => {
  try {
    const response = await axios.get(
      `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/products.json?fields=id,title,handle,tags,images,created_at`,
      { headers: { "X-Shopify-Access-Token": ACCESS_TOKEN } }
    );
    const produtos = response.data.products
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(p => ({
        id: p.id,
        title: p.title,
        handle: p.handle,
        tags: p.tags,
        images: p.images || [],
        created_at: p.created_at
      }));
    return res.json(produtos);
  } catch (err) {
    console.error("❌ Erro ao buscar produtos:", err.response?.data || err);
    return res.status(500).json({ erro: "Erro ao buscar produtos." });
  }
});

// 📤 ROTA: Upload de imagem base64 para produto
app.post("/api/upload/:productId", async (req, res) => {
  const { productId } = req.params;
  const { imageBase64 } = req.body;
  try {
    const response = await axios.post(
      `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/products/${productId}/images.json`,
      { image: { attachment: imageBase64 } },
      { headers: { "X-Shopify-Access-Token": ACCESS_TOKEN } }
    );
    return res.json(response.data);
  } catch (err) {
    console.error("❌ Erro ao enviar imagem:", err.response?.data || err);
    return res.status(500).json({ erro: "Erro ao enviar imagem." });
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
      { headers: { "X-Shopify-Access-Token": ACCESS_TOKEN } }
    );
    return res.json(response.data);
  } catch (err) {
    console.error("❌ Erro ao reordenar imagem:", err.response?.data || err);
    return res.status(err.response?.status || 500).json({ erro: "Erro ao reordenar imagem." });
  }
});

// Inicia servidor
app.listen(PORT, () => console.log(`🚀 Backend rodando em http://localhost:${PORT}`));
