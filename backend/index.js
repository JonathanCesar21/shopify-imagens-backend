const express = require("express");
const axios = require("axios");
const cors = require("cors");
const sharp = require("sharp");
const fs = require("fs");
const os = require("os");
const path = require("path");
const FormData = require("form-data");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
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

// 🚀 ROTA: Remover BG e gerar novo background via OpenAI Images Edit
app.post("/api/remove-bg/:productId/:imageId", async (req, res) => {
  const { productId, imageId } = req.params;
  try {
    // 1) Buscar imagem no Shopify
    const prodRes = await axios.get(
      `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/products/${productId}.json?fields=images`,
      { headers: { "X-Shopify-Access-Token": ACCESS_TOKEN } }
    );
    const imgObj = prodRes.data.product.images.find(i => i.id === parseInt(imageId, 10));
    if (!imgObj) {
      return res.status(404).json({ erro: "Imagem não encontrada." });
    }

    // 2) Baixar buffer da imagem original
    const imgBuffer = await axios
      .get(imgObj.src, { responseType: "arraybuffer" })
      .then(r => Buffer.from(r.data, "binary"));

    // 3) Converter para PNG com alpha e redimensionar (<4MB)
    const pngBuffer = await sharp(imgBuffer)
      .ensureAlpha()
      .resize({ width: 2048 })
      .png({ quality: 90 })
      .toBuffer();

    // 4) Salvar temporariamente
    const tmpPath = path.join(os.tmpdir(), `shopify-${imageId}.png`);
    fs.writeFileSync(tmpPath, pngBuffer);

    // 5) Preparar FormData
    const prompt =
      "Remova o background do calçado e gere um fundo branco sólido na cor e8ecea, iluminação suave de estúdio, sem objetos, sem sombras, clean, estilo e-commerce.";
    const form = new FormData();
    form.append("image", fs.createReadStream(tmpPath), { filename: "image.png", contentType: "image/png" });
    form.append("mask", fs.createReadStream(tmpPath), { filename: "mask.png", contentType: "image/png" });
    form.append("prompt", prompt);
    form.append("n", 1);
    form.append("size", "1024x1024");

    // 6) Chamada ao endpoint de edits
    const openaiRes = await axios.post(
      "https://api.openai.com/v1/images/edits",
      form,
      { headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, ...form.getHeaders() } }
    );
    const newImageUrl = openaiRes.data.data[0].url;

    // 7) Limpar temporário e responder
    fs.unlinkSync(tmpPath);
    return res.json({ newImageUrl });
  } catch (err) {
    console.error("❌ Erro ao gerar novo background:", err.response?.data || err);
    return res
      .status(500)
      .json({ erro: err.response?.data?.error?.message || err.message });
  }
});

// 📤 ROTA: Enviar imagem base64 para Shopify
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
    return res
      .status(err.response?.status || 500)
      .json({ erro: "Erro ao reordenar imagem." });
  }
});

// Inicia servidor
app.listen(PORT, () => console.log(`🚀 Backend rodando em http://localhost:${PORT}`));
