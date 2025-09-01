import { runSecretsTest } from "./tests/utilTest.js";
import buildApp from "./buildApp.js";

runSecretsTest();

const fastify = buildApp(true);

fastify.listen({ port: process.env.PORT || 3000 }, (err, address) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    fastify.log.info(`ft_transcendence running at ${address}`)
});
