import fp from "fastify-plugin";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import fastifyCors from "fastify-cors";
import * as admin from "firebase-admin";

// The plugins here are loaded first before
// the routes are initialized
export default fp(async function (
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
) {
  // CORS
  fastify.register(fastifyCors, {
    origin: process.env.ORIGIN,
    methods: ["GET", "POST"],
    allowedHeaders: ["token", "Content-Type", "Authorization"],
  });

  // Firebase
  admin.initializeApp({
    credential: admin.credential.cert(
      require("../../globex-f789c-firebase-adminsdk-64fhr-96a8c7a99e.json")
    ),
  });

  if (!fastify.db) {
    fastify.decorate("db", admin);
  }
});

declare module "fastify" {
  export interface FastifyInstance {
    db: typeof admin;
  }
}
