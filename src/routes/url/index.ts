/*
 * @description
 * Handle adding urls (and related info to db)
 * Handle adding/removing favorities
 * Handle deleting urls (and related info to db) from db
 */

// Dependencies
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  JsonWebTokenError,
  NotBeforeError,
  TokenExpiredError,
  verify,
} from "jsonwebtoken";
const req = require("request");
const wordCount = require("html-word-count");

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
          },
          required: ["url"],
          additionalProperties: false,
        },
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              url: {
                type: "object",
                properties: {
                  domain: { type: "string" },
                  url: { type: "string" },
                  wordcount: { type: "integer" },
                  favorite: { type: "boolean" },
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

      try {
        const { uid } = await fastify.firebase.auth().verifyIdToken(token);
        await fastify.firebase.auth().getUser(uid);
        const { url }: any = request.body;
        const snapshot = await fastify.firebase
          .firestore()
          .collection("webpages")
          .where("user_id", "==", uid)
          .where("url", "==", url)
          .get();
        if (snapshot.empty) {
          req(url, async function (error, response, body) {
            if (error) {
              return reply.code(500).send({ success: false, error });
            }

            const URLParser = require("url");
            const domain = URLParser.parse(url).hostname;
            const wc = wordCount(body);
            await fastify.firebase.firestore().collection("webpages").add({
              user_id: uid,
              domain,
              url,
              wordcount: wc,
              favorite: false,
            });

            return reply.code(201).send({
              success: true,
              url: {
                domain,
                url,
                wordcount: wc,
                favorite: false,
              },
            });
          });
        } else {
          return reply
            .code(400)
            .send({ success: false, error: "Webpage already counted" });
        }
      } catch (error) {
        console.log(error);
        return reply.code(500).send({ success: false, error });
      }
    }
  );

  // List URL's
  // Method: GET
  // Description: Returns the url history
  // Requirements:
  //  - Headers: Authorization
  // Response:
  //  - 200: Success, URL's
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
            domain: { type: "string" },
            limit: { type: "integer", minimum: 1 },
          },
          required: ["domain"],
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
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

      try {
        const { uid } = await fastify.firebase.auth().verifyIdToken(token);
        await fastify.firebase.auth().getUser(uid);
        const { domain = "", limit = 10 }: any = request.query;
        const snapshot = await fastify.firebase
          .firestore()
          .collection("webpages")
          .where("user_id", "==", uid)
          .where("domain", "==", domain)
          .orderBy("url")
          .limit(limit)
          .get();
        if (snapshot.empty) {
          return reply.code(200).send({ success: true, urls: [] });
        } else {
          const urls: any = [];
          snapshot.forEach((doc) => {
            urls.push({ id: doc.id, ...doc.data() });
          });
          return reply.code(200).send({ success: true, urls });
        }
      } catch (error) {
        if (error.code == "auth/user-not-found") {
          return reply
            .code(401)
            .send({ success: false, error: "Unauthorized" });
        } else {
          console.error(error);
          return reply.code(500).send({ success: false, error });
        }
      }
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

          return reply.code(200).send({
            success: true,
          });

          // try {
          //   client = await fastify.pg.connect();
          //   const { rowCount } = await client.query(
          //     SQL`SELECT id FROM users WHERE id = ${decoded.id}`
          //   );

          //   if (rowCount == 0) {
          //     client.release();
          //     return reply
          //       .code(401)
          //       .send({ success: false, error: "Unauthorized" });
          //   } else {
          //     const { isFavorite, url_id }: any = request.body;
          //     await client.query(
          //       SQL`UPDATE TABLE webpages SET favorite = ${isFavorite} WHERE user_id = ${decoded.id} AND id = ${url_id}`
          //     );
          //     client.release();
          //     return reply.code(200).send({ success: true });
          //   }
          // } catch (error) {
          //   client.release();
          //   return reply.code(500).send({ success: false, error: err });
          // }
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

          return reply.code(200).send({
            success: true,
          });

          // try {
          //   client = await fastify.pg.connect();
          //   const { rowCount } = await client.query(
          //     SQL`SELECT id FROM users WHERE id = ${decoded.id}`
          //   );

          //   if (rowCount == 0) {
          //     client.release();
          //     return reply
          //       .code(401)
          //       .send({ success: false, error: "Unauthorized" });
          //   } else {
          //     const { id }: any = request.query;
          //     await client.query(
          //       SQL`DELETE FROM webpages WHERE user_id = ${decoded.id} AND id = ${id}`
          //     );
          //     client.release();
          //     return reply.code(200).send({ success: true });
          //   }
          // } catch (error) {
          //   client.release();
          //   return reply.code(500).send({ success: false, error: err });
          // }
        }
      );
    }
  );
}
