import { runSecretsTest } from "./tests/utilTest.js";
import buildApp from "./buildApp.js";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

runSecretsTest();

const fastify = buildApp(true);

await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        "script-src": [
            "'self'",
            "https://cdn.jsdelivr.net/npm/dompurify@3.2.6/dist/purify.min.js",
            "https://cdn.babylonjs.com"
        ],
        "img-src": [
            "'self'",
            "blob:",
            "https://http.cat",
            "https://img.icons8.com/material-outlined/24/visible--v1.png",
            "https://img.icons8.com/material-outlined/24/hide.png",
            "data:"
        ],
        "connect-src": [
            "'self'",
            "https://cdn.jsdelivr.net",
            "https://cdn.babylonjs.com"
        ],
      },
    },
    referrerPolicy: {
        policy: "same-origin"
    }
});
await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
});

fastify.listen({ port: process.env.PORT || 3000 }, (err, address) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    fastify.log.info(`ft_transcendence running at ${address}`)
});