import { prisma } from "../lib/prisma.ts";
import { OAuth2Client } from "google-auth-library";
import bcrypt from "bcrypt";
import crypto from "crypto";

import { enviarEmailRecuperacao } from "../lib/email.js";

console.log(">>> AUTH.JS FOI CARREGADO");

// =====================================================
// CONFIGURAÇÃO DO GOOGLE
// =====================================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export function auth(server) {
  // =========================
  // Cadastro
  // =========================
  server.post("/cadastro", async (request, reply) => {
    try {
      const { nome, email, senha } = request.body || {};

      if (!nome || !email || !senha) {
        return reply
          .status(400)
          .send({ error: "Nome, email e senha dão obrigatórios." });
      }

      const usuarioExistente = await prisma.professor.findUnique({
        where: {
          email,
        },
      });

      if (usuarioExistente) {
        return reply
          .status(409)
          .send({ error: "este e-mail já está cadastrado no sistema" });
      }

      const senhaHash = await bcrypt.hash(senha, 10);

      const novoProfessor = await prisma.professor.create({
        data: {
          nome,
          email,
          senha: senhaHash,
          tipo: "comum",
        },
        select: {
          id: true,
          nome: true,
          email: true,
        },
      });

      return reply.status(201).send({
        message: "Cadastro realizado com sucesso!",
        user: novoProfessor,
      });
    } catch (error) {
      console.error("ERRO NO CADASTRO", error);
      return reply.status(500).send({
        error: "erro interno no servidor ao realizar cadastro",
      });
    }
  });
  // =========================
  // LOGIN
  // =========================

  // =================================================
  // LOGIN NORMAL - E-MAIL E SENHA
  // =================================================

  server.post("/login", async (request, reply) => {
    try {
      console.log("====================================");
      console.log(">>> ROTA /login");
      console.log("====================================");

      const { email, senha } = request.body || {};

      if (!email || !senha) {
        return reply.status(400).send({
          error: "E-mail e senha são obrigatórios",
        });
      }

      const professor = await prisma.professor.findUnique({
        where: {
          email: email,
        },
      });

      if (!professor) {
        return reply.status(401).send({
          error: "E-mail ou senha incorretos",
        });
      }

      if (!professor.senha) {
        return reply.status(401).send({
          error: "Esta conta não possui senha cadastrada. Entre com Google.",
        });
      }

      console.log(">>> Senha existe:", !!professor.senha);
      console.log(">>> Tamanho do hash:", professor.senha?.length);
      console.log(">>> Tamanho da senha recebida:", senha?.length);

      const senhaCorreta = await bcrypt.compare(senha, professor.senha);

      console.log(">>> Senha confere:", senhaCorreta);

      if (!senhaCorreta) {
        return reply.status(401).send({
          error: "E-mail ou senha incorretos",
        });
      }

      const token = server.jwt.sign(
        {
          id: professor.id,
          email: professor.email,
          tipo: professor.tipo,
        },
        {
          expiresIn: "7d",
        },
      );

      return reply.send({
        token,
        professor: {
          id: professor.id,
          nome: professor.nome,
          email: professor.email,
          tipo: professor.tipo,
        },
      });
    } catch (error) {
      console.error(">>> ❌ ERRO NO LOGIN NORMAL:", error);

      return reply.status(500).send({
        error: "Erro interno ao realizar login.",
      });
    }
  });

  // =================================================
  // LOGIN / CADASTRO COM GOOGLE
  // =================================================

  server.post("/login/google", async (request, reply) => {
    try {
      console.log("====================================");
      console.log(">>> ROTA /login/google");
      console.log("====================================");

      const { credential } = request.body || {};

      if (!credential) {
        return reply.status(400).send({
          error: "Credential do Google não foi informado",
        });
      }

      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        return reply.status(401).send({
          error: "Token do Google inválido",
        });
      }

      const { email, name, email_verified } = payload;

      if (!email) {
        return reply.status(401).send({
          error: "O Google não informou o e-mail do usuário",
        });
      }

      if (!email_verified) {
        return reply.status(401).send({
          error: "O e-mail do Google não foi verificado",
        });
      }

      let professor = await prisma.professor.findUnique({
        where: {
          email: email,
        },
      });

      if (!professor) {
        professor = await prisma.professor.create({
          data: {
            nome: name || "Usuário Google",
            email: email,
            tipo: "comum",
            senha: null,
          },
        });
      }

      const token = server.jwt.sign(
        {
          id: professor.id,
          email: professor.email,
          tipo: professor.tipo,
        },
        {
          expiresIn: "7d",
        },
      );

      return reply.send({
        token,
        professor: {
          id: professor.id,
          nome: professor.nome,
          email: professor.email,
          tipo: professor.tipo,
        },
      });
    } catch (error) {
      console.error(">>> ❌ ERRO NO LOGIN GOOGLE:", error);

      return reply.status(401).send({
        error: "Não foi possível autenticar com o Google.",
      });
    }
  });

  // =================================================
  // ESQUECI A SENHA
  // =================================================

  server.post("/esqueci-senha", async (request, reply) => {
    try {
      console.log("====================================");
      console.log(">>> ROTA /esqueci-senha");
      console.log("====================================");

      const { email } = request.body || {};

      if (!email) {
        return reply.status(400).send({
          error: "Digite um e-mail.",
        });
      }

      const professor = await prisma.professor.findUnique({
        where: {
          email: email,
        },
      });

      if (!professor) {
        return reply.send({
          message:
            "Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.",
        });
      }

      // -----------------------------------------
      // GERA TOKEN
      // -----------------------------------------

      const resetToken = crypto.randomBytes(32).toString("hex");

      // -----------------------------------------
      // TOKEN VÁLIDO POR 1 HORA
      // -----------------------------------------

      const resetTokenExpira = new Date(Date.now() + 60 * 60 * 1000);

      // -----------------------------------------
      // SALVA TOKEN
      // -----------------------------------------

      await prisma.professor.update({
        where: {
          id: professor.id,
        },
        data: {
          resetToken: resetToken,
          resetTokenExpira: resetTokenExpira,
        },
      });

      // -----------------------------------------
      // LINK
      // -----------------------------------------

      const link = `${process.env.BASE_URL_FRONTEND}/login/redefinir_senha.html?token=${resetToken}`;

      console.log(">>> Link de recuperação:", link);

      // -----------------------------------------
      // ENVIA E-MAIL
      // -----------------------------------------

      enviarEmailRecuperacao(professor.email, link);

      console.log(">>> ✅ E-mail de recuperação enviado");

      return reply.send({
        message:
          "Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.",
      });
    } catch (error) {
      console.error("====================================");
      console.error(">>> ❌ ERRO NA RECUPERAÇÃO DE SENHA");
      console.error(error);
      console.error("====================================");

      return reply.status(500).send({
        error: "Não foi possível enviar o e-mail de recuperação.",
      });
    }
  });

  // =================================================
  // REDEFINIR SENHA
  // =================================================

  server.post("/redefinir-senha", async (request, reply) => {
    try {
      console.log("====================================");
      console.log(">>> ROTA /redefinir-senha");
      console.log("====================================");

      const { token, novaSenha } = request.body || {};

      console.log(">>> Token recebido:", !!token);
      console.log(">>> Tamanho da nova senha:", novaSenha?.length);

      // -----------------------------------------
      // VALIDA CAMPOS
      // -----------------------------------------

      if (!token || !novaSenha) {
        return reply.status(400).send({
          error: "Token e nova senha são obrigatórios.",
        });
      }

      // -----------------------------------------
      // VALIDA TAMANHO
      // -----------------------------------------

      if (novaSenha.length < 6) {
        return reply.status(400).send({
          error: "A senha deve ter pelo menos 6 caracteres.",
        });
      }

      // -----------------------------------------
      // PROCURA TOKEN
      // -----------------------------------------

      const professor = await prisma.professor.findFirst({
        where: {
          resetToken: token,
        },
      });

      if (!professor) {
        return reply.status(400).send({
          error: "Link de recuperação inválido ou expirado.",
        });
      }

      // -----------------------------------------
      // VERIFICA EXPIRAÇÃO
      // -----------------------------------------

      if (
        !professor.resetTokenExpira ||
        professor.resetTokenExpira < new Date()
      ) {
        return reply.status(400).send({
          error: "Link de recuperação inválido ou expirado.",
        });
      }

      // -----------------------------------------
      // CRIPTOGRAFA A NOVA SENHA
      // -----------------------------------------

      const senhaHash = await bcrypt.hash(novaSenha, 10);

      // -----------------------------------------
      // TESTE DO BCRYPT
      // -----------------------------------------

      const testeSenha = await bcrypt.compare(novaSenha, senhaHash);

      console.log(">>> TESTE IMEDIATO DO BCRYPT:", testeSenha);

      // -----------------------------------------
      // ATUALIZA A SENHA
      // -----------------------------------------

      await prisma.professor.update({
        where: {
          id: professor.id,
        },
        data: {
          senha: senhaHash,
          resetToken: null,
          resetTokenExpira: null,
        },
      });

      console.log(">>> ✅ SENHA ATUALIZADA NO BANCO");

      // -----------------------------------------
      // CONFIRMA O HASH LIDO DO BANCO
      // -----------------------------------------

      const professorAtualizado = await prisma.professor.findUnique({
        where: {
          id: professor.id,
        },
      });

      const senhaConfereNoBanco = await bcrypt.compare(
        novaSenha,
        professorAtualizado.senha,
      );

      console.log(">>> TESTE DO HASH LIDO DO BANCO:", senhaConfereNoBanco);
      console.log(">>> ID DO PROFESSOR:", professorAtualizado.id);
      console.log(">>> ✅ Senha redefinida:", professor.id);

      return reply.send({
        message: "Senha redefinida com sucesso!",
      });
    } catch (error) {
      console.error("====================================");
      console.error(">>> ❌ ERRO AO REDEFINIR SENHA");
      console.error(error);
      console.error("====================================");

      return reply.status(500).send({
        error: "Não foi possível redefinir a senha.",
      });
    }
  });

  // =================================================
  // USUÁRIO LOGADO
  // =================================================

  server.get(
    "/me",
    {
      onRequest: [server.authenticate],
    },
    async (request, reply) => {
      try {
        const professorId = request.user.id;

        const professor = await prisma.professor.findUnique({
          where: {
            id: professorId,
          },
          select: {
            id: true,
            nome: true,
            email: true,
            tipo: true,
          },
        });

        if (!professor) {
          return reply.status(404).send({
            message: "Professor não encontrado",
          });
        }

        return reply.send(professor);
      } catch (error) {
        console.error(">>> ❌ ERRO /me:", error);

        return reply.status(500).send({
          error: "Erro ao buscar usuário.",
        });
      }
    },
  );
}