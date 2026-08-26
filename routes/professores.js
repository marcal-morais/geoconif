import {prisma} from "../lib/prisma.ts"
import bcrypt from 'bcrypt'

export function professores(server) {
  server.get('/professores', async (request, reply) => {
    const search = request.query.search
    const professores = await prisma.professor.findMany({
    where: search ? {
      nome: { contains: search, mode: 'insensitive' }
    } : undefined
  })

  return reply.send(professores)
})
   

  server.post('/professores',{ onRequest: [server.authenticate] }, async (request, reply) => {
    const {nome, email, senha, tipo} = request.body

    const professorExistente = await prisma.professor.findUnique({
      where:{
        email
      }
    })

    if (professorExistente) {
    return reply.status(409).send({ message: "E-mail já cadastrado!" })
  }

    // Criptografa a senha antes de salvar
    const senhaCriptografada = await bcrypt.hash(senha, 10)

    const professor = await prisma.professor.create({
      data:{
        nome,
        email,
        senha: senhaCriptografada,
        tipo
      }
    })
    return reply.status(201).send(professor)
})

  server.get('/professores/:id', async (request, reply) => {
    const{id} = request.params

    const professor = await prisma.professor.findUnique({
      where:{
        id: Number(id)
      }
    })

    if(!professor){
      return reply.status(404).send({message: "professor não encontrado"})
    }

    return reply.send(professor)
  })

  server.put('/professores/:id', { onRequest: [server.authenticate] }, async (request, reply)=>{
    const { id } = request.params
    const { nome, email,senha, tipo } = request.body

 const dadosParaAtualizar = {
      nome,
      email,
      tipo
    }

    // Se enviou senha no body, criptografa e adiciona aos dados
    if (senha) {
      dadosParaAtualizar.senha = await bcrypt.hash(senha, 10)
    }

    const professorAtualizado = await prisma.professor.update({
      where: { id: Number(id) },
      data: dadosParaAtualizar
    })

    return reply.send(professorAtualizado)
  })

  server.delete('/professores/:id', { onRequest: [server.authenticate] }, async (request, reply) =>{
    const {id} = request.params

    await prisma.professor.delete({
      where: {id: Number(id)}
    })

    return reply.status(204).send()

})
}