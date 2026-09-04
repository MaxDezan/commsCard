// Carrega variáveis de ambiente do arquivo .env
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de middlewares
app.use(cors());
app.use(express.json());

// Estrutura de dados das comissões (armazenamento em memória)
const comissoes = {
  bases: [
    // arte padrão
    { id: 1,  categoria: 'arte padrão',          tipo: '1/2 corpo', estilo: 'sketch',   preco: 15 },
    { id: 2,  categoria: 'arte padrão',          tipo: '1/2 corpo', estilo: 'p&b',      preco: 25 },
    { id: 3,  categoria: 'arte padrão',          tipo: '1/2 corpo', estilo: 'colorido', preco: 45 },
    { id: 4,  categoria: 'arte padrão',          tipo: 'full body', estilo: 'sketch',   preco: 20 },
    { id: 5,  categoria: 'arte padrão',          tipo: 'full body', estilo: 'p&b',      preco: 35 },
    { id: 6,  categoria: 'arte padrão',          tipo: 'full body', estilo: 'colorido', preco: 55 },
    // design de personagem
    { id: 7,  categoria: 'icon', tipo: '',          estilo: 'sketch',   preco: 10 },
    { id: 8,  categoria: 'icon', tipo: '',          estilo: 'p&b',      preco: 15 },
    { id: 9,  categoria: 'icon', tipo: '',          estilo: 'colorido', preco: 25 },
    // tipo 3
    { id: 10, categoria: 'design de personagem',               tipo: 'icon',      estilo: 'sketch',   preco: 6  },
    { id: 11, categoria: 'design de personagem',               tipo: 'icon',      estilo: 'p&b',      preco: 8  },
    { id: 12, categoria: 'design de personagem',               tipo: 'icon',      estilo: 'colorido', preco: 15 },
    { id: 13, categoria: 'design de personagem',               tipo: '1/2 corpo', estilo: 'sketch',   preco: 8  },
    { id: 14, categoria: 'design de personagem',               tipo: '1/2 corpo', estilo: 'p&b',      preco: 15 },
    { id: 15, categoria: 'design de personagem',               tipo: '1/2 corpo', estilo: 'colorido', preco: 20 },
    { id: 16, categoria: 'design de personagem',               tipo: 'full body', estilo: 'sketch',   preco: 10 },
    { id: 17, categoria: 'design de personagem',               tipo: 'full body', estilo: 'p&b',      preco: 20 },
    { id: 18, categoria: 'design de personagem',               tipo: 'full body', estilo: 'colorido', preco: 30 },
    // tipo 4
    { id: 19, categoria: 'chibi',               tipo: '1/2 corpo', estilo: 'sketch',   preco: 10 },
    { id: 20, categoria: 'chibi',               tipo: '1/2 corpo', estilo: 'p&b',      preco: 15 },
    { id: 21, categoria: 'chibi',               tipo: '1/2 corpo', estilo: 'colorido', preco: 25 },
    { id: 22, categoria: 'chibi',               tipo: 'full body', estilo: 'sketch',   preco: 12 },
    { id: 23, categoria: 'chibi',               tipo: 'full body', estilo: 'p&b',      preco: 25 },
    { id: 24, categoria: 'chibi',               tipo: 'full body', estilo: 'colorido', preco: 35 }
  ],
  adicionais: [
    { id: 25, nome: 'Render detalhada',    descricao: 'Acabamento com mais detalhes', preco: 15 },
    { id: 26, nome: 'NSFW/gore complexo',       descricao: 'NSFW/gore complexos na arte',  preco: 25 },
    { id: 27, nome: 'Fundo complexo',     descricao: 'Fundo com composição detalhada',  preco: 20 },
    { id: 28, nome: 'Personagem adicional',descricao: '+1 personagem na arte (50% do valor base)', preco: 0, dinamico: true }
  ]
};

// Configuração do transporter do Nodemailer usando variáveis de ambiente
const criarTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// 1. Endpoint GET /api/comissoes - Retorna todas as opções de comissões
app.get('/api/comissoes', (req, res) => {
  res.json(comissoes);
});

// 2. Endpoint POST /api/pedidos - Processa novo pedido e envia e-mail de notificação
app.post('/api/pedidos', async (req, res) => {
  try {
    const { cliente, base, bases, categoria, adicionais = [], personagensAdicionais = [], observacoes = '' } = req.body;
    const isMulti = Array.isArray(bases) && bases.length > 0;

    // Validação dos dados do cliente
    if (!cliente || !cliente.nome || !cliente.email) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Nome e e-mail do cliente são obrigatórios.'
      });
    }

    // Validação e resolução da(s) base(s)
    let baseSelecionada = null;
    let basesSelecionadas = [];  // [{ ...item, quantidade }]
    let precoBase = 0;

    if (isMulti) {
      for (const { id, quantidade } of bases) {
        const item = comissoes.bases.find(b => b.id === Number(id));
        if (!item) continue;
        basesSelecionadas.push({ ...item, quantidade: Number(quantidade) || 1 });
        precoBase += item.preco * (Number(quantidade) || 1);
      }
      if (basesSelecionadas.length === 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'Itens selecionados inválidos.' });
      }
    } else {
      if (!base || !base.id) {
        return res.status(400).json({ sucesso: false, mensagem: 'A base da comissão é obrigatória.' });
      }
      baseSelecionada = comissoes.bases.find(b => b.id === Number(base.id));
      if (!baseSelecionada) {
        return res.status(400).json({ sucesso: false, mensagem: 'Base selecionada inválida.' });
      }
      precoBase = baseSelecionada.preco;
    }

    // Localização e mapeamento dos adicionais selecionados
    const adicionaisSelecionados = [];
    if (Array.isArray(adicionais)) {
      for (const idAdicional of adicionais) {
        const item = comissoes.adicionais.find(a => a.id === Number(idAdicional));
        if (item) adicionaisSelecionados.push(item);
      }
    }

    // Processamento dos personagens adicionais (50% do valor base)
    const extrasResolvidos = [];
    let precoPersonagensAdicionais = 0;
    if (Array.isArray(personagensAdicionais)) {
      for (const extra of personagensAdicionais) {
        const baseItem = comissoes.bases.find(b => b.id === Number(extra.baseId));
        if (baseItem) {
          const precoExtra = baseItem.preco / 2;
          extrasResolvidos.push({ ...baseItem, precoOriginal: baseItem.preco, precoExtra });
          precoPersonagensAdicionais += precoExtra;
        }
      }
    }

    // Cálculo do valor total
    const totalAdicionais = adicionaisSelecionados.filter(a => !a.dinamico).reduce((acc, curr) => acc + (curr.preco || 0), 0);
    const precoTotal = precoBase + totalAdicionais + precoPersonagensAdicionais;

    // Montagem das linhas dos adicionais na tabela HTML
    const adicionaisHtmlRows = adicionaisSelecionados.filter(a => !a.dinamico).length > 0
      ? adicionaisSelecionados.filter(a => !a.dinamico)
          .map(
            ad => `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Adicional: ${ad.nome}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">R$ ${ad.preco.toFixed(2)}</td>
            </tr>`
          )
          .join('')
      : `
        <tr>
          <td colspan="2" style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-style: italic;">
            Nenhum adicional selecionado
          </td>
        </tr>`;

    // Montagem das linhas dos personagens adicionais no e-mail
    const personagensAdicionaisHtmlRows = extrasResolvidos.length > 0
      ? extrasResolvidos
          .map(
            p => `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
                Personagem extra: ${p.categoria}${p.tipo ? ' — ' + p.tipo : ''} (${p.estilo}) <span style="color: #6366f1; font-weight: bold;">50%</span>
              </td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">R$ ${p.precoExtra.toFixed(2)}</td>
            </tr>`
          )
          .join('')
      : '';

    // Template HTML formatado do e-mail
    const emailHtml = `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #6366f1; padding: 20px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 22px;">Novo Pedido de Comissão</h1>
        </div>
        
        <div style="padding: 24px;">
          <h2 style="font-size: 16px; color: #334155; margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">
            Informações do Cliente
          </h2>
          <p style="margin: 6px 0; color: #475569;"><strong>Nome:</strong> ${cliente.nome}</p>
          <p style="margin: 6px 0; color: #475569;"><strong>E-mail:</strong> ${cliente.email}</p>

          <h2 style="font-size: 16px; color: #334155; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">
            Resumo do Pedido
          </h2>
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
            <thead>
              <tr style="background-color: #f8fafc; color: #475569;">
                <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Item</th>
                <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: right;">Preço</th>
              </tr>
            </thead>
            <tbody>
              ${isMulti
                ? basesSelecionadas.map(b => `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
                  ${b.quantidade}× ${b.categoria}${b.tipo ? ' — ' + b.tipo : ''} (${b.estilo})
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">
                  R$ ${(b.preco * b.quantidade).toFixed(2)}
                </td>
              </tr>`).join('')
                : `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
                  Base: ${baseSelecionada.categoria}${baseSelecionada.tipo ? ' — ' + baseSelecionada.tipo : ''} (${baseSelecionada.estilo})
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">
                  R$ ${baseSelecionada.preco.toFixed(2)}
                </td>
              </tr>`
              }
              ${adicionaisHtmlRows}
              ${personagensAdicionaisHtmlRows}
              <tr style="font-weight: bold; background-color: #f1f5f9;">
                <td style="padding: 12px 10px; border-top: 2px solid #94a3b8; color: #0f172a;">Total</td>
                <td style="padding: 12px 10px; border-top: 2px solid #94a3b8; text-align: right; color: #16a34a; font-size: 16px;">
                  R$ ${precoTotal.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          ${
            observacoes
              ? `
          <h2 style="font-size: 16px; color: #334155; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">
            Observações
          </h2>
          <div style="background-color: #f8fafc; padding: 12px; border-left: 4px solid #6366f1; color: #334155; white-space: pre-wrap; font-size: 14px;">${observacoes}</div>`
              : ''
          }
        </div>

        <div style="background-color: #f8fafc; padding: 12px; text-align: center; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px;">
          Notificação gerada automaticamente pela plataforma de Comissões.
        </div>
      </div>
    `;

    // Configuração dos parâmetros do e-mail
    const mailOptions = {
      from: process.env.SMTP_USER || 'no-reply@example.com',
      to: process.env.EMAIL_DESTINO || process.env.SMTP_USER,
      subject: `Novo Pedido de Comissão - ${cliente.nome}`,
      html: emailHtml
    };

    // Envio do e-mail
    const transporter = criarTransporter();
    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Pedido enviado com sucesso!'
    });
  } catch (error) {
    console.error('Erro ao processar pedido:', error);
    return res.status(500).json({
      sucesso: false,
      mensagem: `Erro ao enviar pedido: ${error.message}`
    });
  }
});

// Inicialização do servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
