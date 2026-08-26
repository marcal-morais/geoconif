import { prisma } from "../lib/prisma.ts"

export function favoritos(server) {

  // GET /favoritos -> Busca apenas os favoritos do usuário logado
  server.get('/favoritos', { onRequest: [server.authenticate] }, async (request, reply) => {
    const search = request.query?.search
    const usuarioId = request.user?.sub || request.user?.id || request.user?.usuarioId || request.user

    const favoritos = await prisma.favorito.findMany({
      where: {
        idUsuario: Number(usuarioId),
        ...(search ? {
          material: {
            titulo: { contains: String(search), mode: 'insensitive' }
          }
        } : {})
      },
      include: {
        material: {
          include: {
            disciplina: true
          }
        } 
      }
    })

    return reply.send(favoritos)
  })

  // POST /favoritos -> Salva o favorito atrelado ao usuário logado
  server.post('/favoritos', { onRequest: [server.authenticate] }, async (request, reply) => {
    const { id_material } = request.body || {}
    const usuarioId = request.user?.sub || request.user?.id || request.user?.usuarioId || request.user

    const numMaterialId = Number(id_material)
    const numUsuarioId = Number(usuarioId)

    // Evita duplicar o mesmo favorito para o mesmo usuário
    const jaExiste = await prisma.favorito.findFirst({
      where: {
        idUsuario: numUsuarioId,
        idMaterial: numMaterialId
      }
    })

    if (jaExiste) {
      return reply.status(200).send(jaExiste)
    }

    const favorito = await prisma.favorito.create({
      data: {
        idMaterial: numMaterialId,
        idUsuario: numUsuarioId
      }
    })

    return reply.status(201).send(favorito)
  })

  // GET /favoritos/:id
  server.get('/favoritos/:id', { onRequest: [server.authenticate] }, async (request, reply) => {
    const { id } = request.params
    const usuarioId = request.user?.sub || request.user?.id || request.user?.usuarioId || request.user

    const favorito = await prisma.favorito.findUnique({
      where: {
        id: Number(id)
      }
    })

    if (!favorito || favorito.idUsuario !== Number(usuarioId)) {
      return reply.status(404).send({ message: "Material favorito não encontrado" })
    }

    return reply.send(favorito)
  })

  // DELETE /favoritos/:id -> Remove o favorito filtrando por ID do favorito e do Usuário
  server.delete('/favoritos/:id', { onRequest: [server.authenticate] }, async (request, reply) => {
    const { id } = request.params
    const usuarioId = request.user?.sub || request.user?.id || request.user?.usuarioId || request.user

    await prisma.favorito.deleteMany({
      where: { 
        id: Number(id),
        idUsuario: Number(usuarioId)
      }
    })

    return reply.status(204).send()
  })

  return
}