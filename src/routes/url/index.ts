/*
 * @description
 * Handle adding urls (and related info to db)
 * Handle adding/removing favorities
 * Handle deleting urls (and related info to db) from db
 */

// Dependencies
import { PoolClient } from "pg";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  JsonWebTokenError,
  NotBeforeError,
  TokenExpiredError,
  verify,
} from "jsonwebtoken";
import SQL from "sql-template-strings";
const req = require("request");
const wordCount = require("html-word-count");

// Constants
let client: PoolClient;

export default async function (
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
): Promise<void> {
  // Add Url
  // Method: POST
  // Description: Add a new url to database and return the wordcount
  // Requirements:
  //  - Headers: Authorization
  //  - Body: Url
  // Response:
  //  - 201: Success, Word counts
  fastify.post(
    "/add",
    {
      schema: {
        headers: {
          type: "object",
          properties: {
            Authorization: { type: "string", minLength: 8 },
          },
          required: ["Authorization"],
          additionalProperties: false,
        },
        body: {
          type: "object",
          properties: {
            url: { type: "string", minLength: 1 },
            userId: { type: "string", minLength: 1 },
          },
          required: ["url", "userId"],
          additionalProperties: false,
        },
        response: {
          201: {
            type: "object",
            properties: {
              wordCount: { type: "integer" },
            },
          },
        },
      },
    },
    async function (request, reply) {
      const { authorization }: any = request.headers;
      const token = authorization.slice(7);

      verify(
        token,
        process.env.TOKEN_SECRET as string,
        async function (
          err: JsonWebTokenError | NotBeforeError | TokenExpiredError | null,
          decoded: any
        ) {
          if (err) {
            return reply.code(401).send({
              success: false,
              error: err,
            });
          }

          try {
            const { url }: any = request.body;
            client = await fastify.pg.connect();
            const { rowCount } = await client.query(
              SQL`SELECT id FROM webpages WHERE user_id = ${decoded.id} AND url = ${url}`
            );

            if (rowCount == 0) {
              req(url, async function (error, response, body) {
                if (error) {
                  client.release();
                  return reply.code(500).send({ success: false, error });
                }
                const wc = wordCount(body);
                await client.query(
                  SQL`INSERT INTO webpages (url, wordcount, user_id) VALUES (${url}, ${wc}, ${decoded.id}})`
                );
                client.release();
                return reply.code(201).send({ success: true, wordCount: wc });
              });
            } else {
              client.release();
              return reply
                .code(400)
                .send({ success: false, error: "Webpage already counted" });
            }
          } catch (error) {
            client.release();
            return reply.code(500).send({ success: false, error });
          }
        }
      );
    }
  );

  // List URL's
  // Method: GET
  // Description: Returns the url history
  // Requirements:
  //  - Headers: Authorization
  // Response:
  //  - 200: URL's
  fastify.get(
    "/list",
    {
      schema: {
        headers: {
          type: "object",
          properties: {
            Authorization: { type: "string", minLength: 8 },
          },
          required: ["Authorization"],
          additionalProperties: false,
        },
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1 },
            offset: { type: "integer", minimum: 1 },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              urls: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    url: { type: "string" },
                    wordCount: { type: "integer" },
                    id: { type: "string" },
                    favorite: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async function (request, reply) {
      const { authorization }: any = request.headers;
      const token = authorization.slice(7);

      verify(
        token,
        process.env.TOKEN_SECRET as string,
        async function (
          err: JsonWebTokenError | NotBeforeError | TokenExpiredError | null,
          decoded: any
        ) {
          if (err) {
            return reply.code(401).send({
              success: false,
              error: err,
            });
          }

          try {
            client = await fastify.pg.connect();
            const { rowCount } = await client.query(
              SQL`SELECT id FROM users WHERE id = ${decoded.id}`
            );
            if (rowCount == 0) {
              client.release();
              return reply
                .code(401)
                .send({ success: false, error: "Unauthorized" });
            } else {
              const { limit = 10 }: any = request.query;
              const { rows } = await client.query(
                SQL`SELECT id, url, wordCount, favorite FROM webpages WHERE user_id = ${decoded.id} ORDER BY id DESC LIMIT ${limit}`
              );
              client.release();
              return reply.code(200).send({ success: true, urls: rows });
            }
          } catch (error) {
            client.release();
            return reply.code(500).send({ success: false, error });
          }
        }
      );
    }
  );

  // Update Favorite
  // Method: PUT
  // Description: Changes a URL's Favorite status
  // Requirements:
  //  - Body: Url ID, Favorite or not
  // Response:
  //  - 200: Success
  fastify.put(
    "/favorite/change",
    {
      schema: {
        headers: {
          type: "object",
          properties: {
            Authorization: { type: "string", minLength: 8 },
          },
          required: ["Authorization"],
          additionalProperties: false,
        },
        body: {
          type: "object",
          properties: {
            url_id: { type: "string", minLength: 1 },
            isFavorite: { type: "boolean" },
          },
          required: ["url_id", "isFavorite"],
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
            },
          },
        },
      },
    },
    async function (request, reply) {
      const { authorization }: any = request.headers;
      const token = authorization.slice(7);

      verify(
        token,
        process.env.TOKEN_SECRET as string,
        async function (
          err: JsonWebTokenError | NotBeforeError | TokenExpiredError | null,
          decoded: any
        ) {
          if (err) {
            return reply.code(401).send({
              success: false,
              error: err,
            });
          }

          try {
            client = await fastify.pg.connect();
            const { rowCount } = await client.query(
              SQL`SELECT id FROM users WHERE id = ${decoded.id}`
            );

            if (rowCount == 0) {
              client.release();
              return reply
                .code(401)
                .send({ success: false, error: "Unauthorized" });
            } else {
              const { isFavorite, url_id }: any = request.body;
              await client.query(
                SQL`UPDATE TABLE webpages SET favorite = ${isFavorite} WHERE user_id = ${decoded.id} AND id = ${url_id}`
              );
              client.release();
              return reply.code(200).send({ success: true });
            }
          } catch (error) {
            client.release();
            return reply.code(500).send({ success: false, error: err });
          }
        }
      );
    }
  );

  // Delete URL
  // Method: DELETE
  // Description: Delete a url
  // Requirements:
  //  - Query: Url ID
  // Response:
  //  - 200: Success
  fastify.delete(
    "/delete",
    {
      schema: {
        headers: {
          type: "object",
          properties: {
            Authorization: { type: "string", minLength: 8 },
          },
          required: ["Authorization"],
          additionalProperties: false,
        },
        querystring: {
          type: "object",
          properties: {
            id: { type: "string", minLength: 1 },
          },
          required: ["id"],
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
            },
          },
        },
      },
    },
    async function (request, reply) {
      const { authorization }: any = request.headers;
      const token = authorization.slice(7);

      verify(
        token,
        process.env.TOKEN_SECRET as string,
        async function (
          err: JsonWebTokenError | NotBeforeError | TokenExpiredError | null,
          decoded: any
        ) {
          if (err) {
            return reply.code(401).send({
              success: false,
              error: err,
            });
          }

          try {
            client = await fastify.pg.connect();
            const { rowCount } = await client.query(
              SQL`SELECT id FROM users WHERE id = ${decoded.id}`
            );

            if (rowCount == 0) {
              client.release();
              return reply
                .code(401)
                .send({ success: false, error: "Unauthorized" });
            } else {
              const { id }: any = request.query;
              await client.query(
                SQL`DELETE FROM webpages WHERE user_id = ${decoded.id} AND id = ${id}`
              );
              client.release();
              return reply.code(200).send({ success: true });
            }
          } catch (error) {
            client.release();
            return reply.code(500).send({ success: false, error: err });
          }
        }
      );
    }
  );
}
