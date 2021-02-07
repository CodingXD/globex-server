import fp from "fastify-plugin";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import fastifyCors from "fastify-cors";
import * as admin from "firebase-admin";
import fastifyCookie from "fastify-cookie";
import { Pool } from "pg";
import * as Pg from "pg";

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
    allowedHeaders: ["token", "Content-Type", "Authorization"],
  });

  // Initialize Cookies
  fastify.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET,
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

  fastify.decorate(
    "pg",
    new Pool({
      user: process.env.POSTGRES_USER,
      host: process.env.POSTGRES_HOST,
      database: process.env.POSTGRES_DATABASE,
      password: process.env.POSTGRES_PASSWORD,
      port: process.env.POSTGRES_PORT as any,
    })
  );
});

declare function transact<TResult>(
  fn: (client: Pg.PoolClient) => Promise<TResult>
): Promise<TResult>;

declare function transact<TResult>(
  fn: (client: Pg.PoolClient) => Promise<TResult>,
  cb: (error: Error | null, result?: TResult) => void
): void;

type PostgresDb = {
  pool: Pg.Pool;
  Client: Pg.Client;
  query: Pg.Pool["query"];
  connect: Pg.Pool["connect"];
  transact: typeof transact;
};

declare module "fastify" {
  export interface FastifyInstance {
    db: typeof admin;
    pg: PostgresDb & Record<string, PostgresDb>;
  }
}
