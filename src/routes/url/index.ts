/*
 * @description
 * Handle adding urls (and related info to db)
 * Handle adding favorities
 * Handle deleting urls (and related info to db) from db
 */

// Dependencies
import { FastifyInstance, FastifyPluginOptions } from "fastify";
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
  //  - Body: Url, User ID
  // Response:
  //  - 201: Word counts
  fastify.post(
    "/add",
    {
      schema: {
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
      const { url, userId }: any = request.body;
      req(url, async function (error, response, body) {
        if (error) {
          return reply.code(500).send({ error });
        }

        try {
          const wc = wordCount(body);
          await fastify.db.firestore().collection("webpages").add({
            userId,
            wordCount: wc,
          });

          return reply.code(201).send({ wordCount: wc });
        } catch (error) {
          console.error(error);
          return reply.code(500).send({ error });
        }
      });
    }
  );

  // List URL's
  // Method: GET
  // Description: Authenticates a user via firebase
  // Requirements:
  //  - Query: User ID
  // Response:
  //  - 200: URL's
  fastify.get(
    "/list",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            userId: { type: "string", minLength: 1 },
          },
          required: ["userId"],
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              url: { type: "array" },
            },
          },
        },
      },
    },
    async function (request, reply) {
      const { userId }: any = request.query;
      console.log(userId);
      const url: object[] = [];

      return reply.code(200).send({ url });
    }
  );
}
