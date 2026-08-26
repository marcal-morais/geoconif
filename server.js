import {fastify} from 'fastify'
import fastifyJwt from '@fastify/jwt'
import { router } from './routes/router.js';
const server = fastify()

await server.register(router);

server.register(fastifyJwt, {
    secret: process.env.JWT_SECRET
})

server.decorate('authenticate', async function (request, reply){
    try{
        await request.jwtVerify()
    }
    catch (err){
        reply.status(401).send({eror: 'Token inválido ou ausente'})
    }
})

await server.register(router);

server.listen({
    port:3333,
})
