import { error } from "console";
import { prisma } from "../lib/prisma.ts"
export function materiais(server){
    //cadastrar
    server.post('/materiais', { onRequest: [server.authenticate] }, async (request, reply) => {
        let titulo = '';
        let descricao = '';
        let palavrasChave = '';
        let disciplinaId = '';
        let professorId = '';
        let caminhoDestino = '';

        const fs = await import('fs');
        const { pipeline } = await import('stream/promises');

        fs.mkdirSync('uploads', { recursive: true });

        const partes = request.parts();

        for await (const parte of partes) {

            if (parte.type === 'file') {
                const nomeArquivo = `${Date.now()}-${parte.filename}`;
                caminhoDestino = `uploads/${nomeArquivo}`;

                await pipeline(
                parte.file,
                fs.createWriteStream(caminhoDestino)
            );

            } else {
                if (parte.fieldname === 'titulo') {
                    titulo = parte.value;
                }

                if (parte.fieldname === 'descricao') {
                    descricao = parte.value;
                }

                if (parte.fieldname === 'palavrasChave') {
                    palavrasChave = parte.value;
                }
                if (parte.fieldname === 'disciplinaId') {
                    disciplinaId = parte.value;
                }

                if (parte.fieldname === 'professorId') {
                    professorId = parte.value;
                }
            }
    }

    if (!titulo || !descricao || !disciplinaId || !professorId) {
        return reply.status(400).send({
            error: 'Campos obrigatórios faltando'
        });
    }

    if (!caminhoDestino) {
        return reply.status(400).send({
            error: 'Nenhum arquivo enviado'
        });
    }

    const material = await prisma.material.create({
        data: {
            titulo,
            descricao,
            palavrasChave,
            url: caminhoDestino,
            status: 'pendente',
            professorId: Number(professorId),
            disciplinaId: Number(disciplinaId)
        }
    });

    return reply.status(201).send(material);
});    

//exibe materiais
   server.get('/materiais', async (request, reply) => {

    const { disciplinaId } = request.query;

    const materiais = await prisma.material.findMany({
        where: {
            status: 'aprovado',

            ...(disciplinaId
                ? {
                    disciplinaId: Number(disciplinaId)
                }
                : {})
        },

        include: {
            disciplina: true,
            professor: true
        },

        orderBy: {
            createdAt: 'desc'
        }
    });

    return reply.status(200).send(materiais);
});
    server.get('/materiais/todos', async (request, reply) => {
        const materiais = await prisma.material.findMany({
            include: { 
                disciplina: true,
                professor: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return reply.status(200).send(materiais);
    })
    //usada em materiais em avaliação
    server.get('/materiais/pendentes', async(request,reply) => {
        const materiais = await prisma.material.findMany({
            where:{
                status: 'pendente'
            },
            include:{
                disciplina: true
            },
            orderBy:{
                createdAt: 'desc'
            }
        });

        return reply.status(200).send(materiais);
    })

    server.get('/materiais/meus/:professorId', async (request, reply) =>{
        const {professorId} = request.params

        const materiais = await prisma.material.findMany({
            where: {
                professorId: Number(professorId),
                status: 'aprovado'
            },
            include: {
                disciplina: true,
                professor: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        return reply.status(200).send(materiais)
    })

    server.get('/materiais/:id', async(request, reply) =>{
        const {id} = request.params;

        const material = await prisma.material.findUnique({
            where: {id:Number(id)}
        })

        if(!material){
            return reply.status(404).send({mensagem: 'Material não encontrado'})
        }

        return reply.status(200).send(material);
    } )

    server.put('/materiais/:id', { onRequest: [server.authenticate] }, async(request, reply) =>{
        const {id} = request.params;

        const {titulo, descricao, disciplinaId, palavrasChave} = request.body;

        const material = await prisma.material.update({
            where:{
                id:Number(id)
            },
            data: {
                titulo,
                descricao,
                palavrasChave,
                disciplinaId: Number(disciplinaId)
                
            }
        });

        return reply.status(200).send(material);
    })

    server.put('/materiais/:id/aprovar', { onRequest: [server.authenticate] }, async(request, reply)=>{
        const { id } = request.params;

        if(request.user?.tipo !== 'adm'){
            return reply.status(403).send({ error: 'Acesso negado. Apenas administradosres podem aprovar'})
        }

        const material = await prisma.material.update({
            where:{
                id: Number(id)
            },
            data: {
                status: 'aprovado',
                motivoRejeicao: null
            }
        });

        return reply.status(200).send(material);
    })

    server.put('/materiais/:id/rejeitar', { onRequest: [server.authenticate] }, async(request, reply)=>{
        const { id }  = request.params;

        if(request.user?.tipo !== 'adm'){
            return reply.status(403).send({ error: 'Acesso negado. Apenas administradosres podem aprovar'})
        }

        const { motivoRejeicao } = request.body;

        const material = await prisma.material.update({
            where: {
                id: Number(id)
            },
            data:{
                status: 'rejeitado',
                motivoRejeicao: motivoRejeicao || null
            }
        });

        return reply.status(200).send(material);    
    })

    server.delete('/materiais/:id', { onRequest: [server.authenticate] }, async(request, reply)=>{
        const {id} = request.params

        await prisma.material.delete({
            where: {id: Number(id)}
        })

        return reply.status(204).send()
    })
}