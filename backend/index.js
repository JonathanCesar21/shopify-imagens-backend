const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 Variáveis de ambiente
const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION;
const PORT = process.env.PORT || 4000;

// 🔄 ROTA: Listar produtos com imagens
app.get("/api/produtos", async (req, res) => {
  try {
    const response = await axios.get(
      `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/products.json`,
      {
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const produtos = response.data.products
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map((produto) => ({
        id: produto.id,
        title: produto.title,
        tags: produto.tags,
        images: produto.images || [],
        created_at: produto.created_at,
      }));

    res.json(produtos);
  } catch (error) {
    console.error("❌ Erro ao buscar produtos:", error.response?.data || error.message);
    res.status(500).json({ erro: "Erro ao buscar produtos." });
  }
});

// 📤 Enviar imagem base64 para produto
app.post("/api/upload/:productId", async (req, res) => {
  const { productId } = req.params;
  const { imageBase64 } = req.body;

  try {
    const response = await axios.post(
      `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/products/${productId}/images.json`,
      {
        image: {
          attachment: imageBase64,
        },
      },
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

// 🔃 Reordenar imagens do produto
app.put("/api/imagem/:productId/:imageId", async (req, res) => {
  const { imageId, productId } = req.params;
  const { position } = req.body;

  console.log("➡️ Reordenando imagem ID:", imageId, "para posição:", position);

  try {
    const response = await axios.put(
      `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/products/${productId}/images/${imageId}.json`,
      {
        image: {
          id: parseInt(imageId),
          position: Math.max(1, parseInt(position)),
        },
      },
      {
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Imagem reordenada:", response.data);
    res.json(response.data);
  } catch (error) {
    console.error("❌ ERRO ao reordenar imagem:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Headers:", error.response.headers);
      console.error("Data:", error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error("Erro desconhecido:", error.message);
      res.status(500).json({ erro: "Erro desconhecido ao reordenar imagem." });
    }
  }
});

// 🚀 Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Backend rodando em http://localhost:${PORT}`);
});