import fastify from "fastify";
import fastifyMultipart from "@fastify/multipart";
import fastifyJwt from "@fastify/jwt";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import path from "path";
import { router } from "../routes/router";

const port = 3000;
const host = "RENDER" in process.env ? `0.0.0.0` : `localhost`;

const app = fastify();

// CORS
app.register(fastifyCors, {
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});

// JWT
app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || "chave_de_emergencia_caso_env_falhe",
});

await app.register(fastifyMultipart);

app.register(fastifyStatic, {
  root: path.join(__dirname, "../uploads"),
  prefix: "/uploads/",
});

// AUTENTICAÇÃO
app.decorate("authenticate", async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (erro) {
    return reply.status(401).send({
      error: "Token inválido ou ausente",
    });
  }
});

// ROTAS
app.register(router);

// SERVIDOR

app.listen({ host: host, port: port }, (err, address) => {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  console.log(`Servidor rodando em ${address}`);
});
