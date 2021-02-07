/*
 * @description
 * Handle adding urls (and related info to db)
 * Handle adding/removing favorities
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
          const snapshot = await fastify.db
            .firestore()
            .collection("webpages")
            .where("userId", "==", userId)
            .where("url", "==", url)
            .get();
          if (snapshot.empty) {
            console.log("No matching documents.");
            await fastify.db
              .firestore()
              .collection("webpages")
              .add({
                url,
                userId,
                wordCount: wc,
                favorite: false,
              })
              .then(() => reply.code(201).send({ wordCount: wc }));
          } else {
            return reply.code(400).send({ error: "Webpage already counted" });
          }
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
            limit: { type: "integer", minimum: 1 },
          },
          required: ["userId"],
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
              last: {
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
    async function (request, reply) {
      const { userId, limit = 10 }: any = request.query;

      const snapshot = await fastify.db
        .firestore()
        .collection("webpages")
        .where("userId", "==", userId)
        .orderBy("wordCount", "desc")
        .limit(limit)
        .get();
      if (snapshot.empty) {
        console.log("No matching documents.");
        return reply.code(200).send({ urls: [] });
      }

      const urls: object[] = [];

      snapshot.forEach((doc) => {
        urls.push({
          id: doc.id,
          url: doc.data().url,
          wordCount: doc.data().wordCount,
          favorite: doc.data().favorite,
        });
      });

      return reply.code(200).send({
        urls,
        last: {
          id: snapshot.docs[snapshot.docs.length - 1].id,
          ...snapshot.docs[snapshot.docs.length - 1].data(),
        },
      });
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
        body: {
          type: "object",
          properties: {
            id: { type: "string", minLength: 1 },
            isFavorite: { type: "boolean" },
          },
          required: ["id", "isFavorite"],
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
      const { id, isFavorite }: any = request.body;
      fastify.db
        .firestore()
        .collection("webpages")
        .doc(id)
        .update({ favorite: isFavorite })
        .then(() => reply.code(200).send({ success: true }))
        .catch((err) => reply.code(500).send({ error: err }));
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
      const { id }: any = request.query;
      fastify.db
        .firestore()
        .collection("webpages")
        .doc(id)
        .delete()
        .then(() => reply.code(200).send({ success: true }))
        .catch((err) => reply.code(500).send({ error: err }));
    }
  );
}
