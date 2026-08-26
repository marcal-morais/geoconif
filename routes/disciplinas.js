import { prisma } from "../lib/prisma.ts"
export function disciplinas(server){

    server.post('/disciplinas', { onRequest: [server.authenticate] }, async(request, reply) => {
        const {nome, professorId} = request.body

        if (!professorId) {
            return reply.status(400).send({ mensagem: 'ID do professor é obrigatório.' });
        }

        if (!nome || typeof nome !== 'string' || !nome.trim()) {
            return reply.status(400).send({ mensagem: 'O nome da disciplina é obrigatório.' });
        }

        const professor = await prisma.professor.findUnique({
            where: {
                id: Number(professorId)
            }
        })

        if(!professor){
            return reply.status(404).send({
                mensagem: "professor não encontrado"
            })
        }

        if(professor.tipo !== 'adm'){
            return reply.status(403).send({
                mensagem: "apenas professores administrativos podem cadastrar disciplinas"
            })
        }

        const nomeFormatado = nome.trim(); // limpa o texto

       const todasDisciplinas = await prisma.disciplina.findMany();

        // Compara em minúsculas (ignora "Pedra", "pedra", "PEDRA")
        const disciplinaExistente = todasDisciplinas.find(
            d => d.nome.trim().toLowerCase() === nomeFormatado.toLowerCase()
        )
       
        if (disciplinaExistente) { // verifica se a disciplina existe
         
            return reply.status(400).send({ 
                mensagem: 'Já existe uma disciplina cadastrada com esse nome.' 
            })
        }


        const disciplina = await prisma.disciplina.create({
            data: { nome: nomeFormatado }
        })

        return disciplina
    })

    server.get('/disciplinas', async (request, reply) => {
        const search = request.query.search

        const disciplinas = await prisma.disciplina.findMany({
            where: search ? {
                nome: { contains: search, mode: 'insensitive' }
            } : undefined,

            include: {
                materiais: {
                    select: {
                     professorId: true
                    }
            },

            _count: {
                select: {
                    materiais: {
                        where: {
                            status: 'aprovado'
                        }
                    }
                }
            }
        }
    })

    const resultado = disciplinas.map(d => {
        const professoresUnicos = new Set(
            d.materiais.map(m => m.professorId)
        )

        return {
            id: d.id,
            nome: d.nome,
            materiais: d._count.materiais,
            questoes: 0,
            acessos: 0,
            professores: professoresUnicos.size
        }
    })

    return resultado
})

    server.get('/disciplinas/:id', async (request, reply) => {
        const {id} = request.params;

        const disciplina = await prisma.disciplina.findUnique({
            where: {id: Number(id)},
            include: {
                materiais: {
                    select: { professorId: true }
                },
                _count: {
                    select: { materiais: true }
                }
            }
        })

        if(!disciplina){
            return reply.status(404).send({mensagem: 'Disciplina não encontrada'})
        }

        const professoresUnicos = new Set(disciplina.materiais.map(m => m.professorId))

        return reply.status(200).send({
            id: disciplina.id,
            nome: disciplina.nome,
            materiais: disciplina._count.materiais,
            questoes: 0,
            acessos: 0,
            professores: professoresUnicos.size
        });
    })

    server.put('/disciplinas/:id', { onRequest: [server.authenticate] }, async(request, reply)=>{
        const {id} = request.params
        const {nome, professorId} = request.body

        const professor = await prisma.professor.findUnique({
            where: {
                id: Number(professorId)
            }
        })

        if(!professor){
            return reply.status(404).send({
                mensagem: "professor não encontrado"
            })
        }

        if(professor.tipo !== 'adm'){
            return reply.status(403).send({
                mensagem: "apenas professores administrativos podem cadastrar disciplinas"
            })
        }

        try{

            const disciplina = await prisma.disciplina.update({
                where: {id: Number(id)},
                data: {nome}
        })

        return disciplina

        } catch(error){
            return reply.status(404).send({
            mensagem: "Disciplina não encontrada"
            })
        }

    })


    server.delete('/disciplinas/:id', { onRequest: [server.authenticate] }, async(request, reply) =>{
    const { id } = request.params
    const professorId = request.body?.professorId || request.query?.professorId

    const professor = await prisma.professor.findUnique({
        where: {
            id: Number(professorId)
        }
    })

    if (!professor) {
        return reply.status(404).send({
            mensagem: 'Professor não encontrado.'
        })
    }

    if (professor.tipo !== 'adm') {
        return reply.status(403).send({
            mensagem: 'Apenas professores administradores podem excluir disciplinas.'
        })
    }

    try {
        await prisma.disciplina.delete({
            where: { id: Number(id) }
        });

        return reply.status(204).send()
    } catch (error) {
        return reply.status(404).send({ mensagem: 'Disciplina não encontrada.' })
    }
    })

}