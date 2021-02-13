import fp from "fastify-plugin";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import fastifyCors from "fastify-cors";
import fastifyCookie from "fastify-cookie";
import * as firebaseAdmin from "firebase-admin";

// The plugins here are loaded first before
// the routes are initialized
export default fp(async function (
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
) {
  // CORS
  fastify.register(fastifyCors, {
    origin: process.env.ORIGIN,
    methods: ["GET", "POST", "DELETE", "PUT"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Initialize Cookies
  fastify.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET,
  });

  // Connect to firebase
  if (!firebaseAdmin.apps.length) {
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(
        require("../../globex-f789c-firebase-adminsdk-64fhr-33eda730ef.json")
      ),
    });
  }

  fastify.decorate("firebase", firebaseAdmin);
});

declare module "fastify" {
  export interface FastifyInstance {
    firebase: typeof firebaseAdmin;
  }
}
