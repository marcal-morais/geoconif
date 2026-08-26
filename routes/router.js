import { auth } from './auth.js' //importa a funcção que tá no arquivo auth.js(login)
import { professores } from './professores.js' //importa a função que tá no arquivo professores.js
import { disciplinas } from './disciplinas.js'//importa a função que tá no disciplinas.js
import { materiais } from './materiais.js'//importa a função que tá no arquivo materiais.js
import { favoritos } from './favoritos.js'//importa a função que tá no arquivo favoritoss.js

export async function router(server) { // vai deixar essa função seja exportável para o server e cria a função router
  server.register(auth) // registra a rota de login
  server.register(professores) // registra as rotas de professor e ativa no fastify
  server.register(disciplinas) // registra as rotas de disciplina e ativa no fastify
  server.register(materiais); //registra as rotas de materiais e ativa no fastify
  server.register(favoritos) //registra as rotas de favoritos e ativa no fastify
}