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
                  id: { type: "string" },
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
            const res = await fastify.firebase
              .firestore()
              .collection("webpages")
              .add({
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
                id: res.id,
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
  //  - Query: Previous Url
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
            domain: { type: "string", minLength: 1 },
            limit: { type: "integer", minimum: 1 },
            url: { type: "string", minLength: 1 },
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
                    wordcount: { type: "integer" },
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
        const { domain = "", limit = 10, url }: any = request.query;
        const snapshot = url
          ? await fastify.firebase
              .firestore()
              .collection("webpages")
              .where("user_id", "==", uid)
              .where("domain", "==", domain)
              .orderBy("url")
              .startAfter(url)
              .limit(limit)
              .get()
          : await fastify.firebase
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

  // List Domain's
  // Method: GET
  // Description: Return list of domains
  // Requirements:
  //  - Headers: Authorization
  // Response:
  //  - 200: Success, Domain's
  fastify.get(
    "/list/domains",
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
          },
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              domains: {
                type: "array",
                items: {
                  type: "string",
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
        const { limit = 10 }: any = request.query;
        const snapshot = await fastify.firebase
          .firestore()
          .collection("webpages")
          .where("user_id", "==", uid)
          .orderBy("url")
          .limit(limit)
          .get();
        if (snapshot.empty) {
          return reply.code(200).send({ success: true, domains: [] });
        } else {
          const domains: any = [];
          snapshot.forEach((doc) => domains.push(doc.data().domain));
          return reply.code(200).send({
            success: true,
            domains: domains.filter(
              (domain: string, index: number) =>
                domains.indexOf(domain) == index
            ),
          });
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
  //  - Header: Authorization
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

      try {
        const { uid } = await fastify.firebase.auth().verifyIdToken(token);
        await fastify.firebase.auth().getUser(uid);

        const { url_id, isFavorite }: any = request.body;
        await fastify.firebase
          .firestore()
          .collection("webpages")
          .doc(url_id)
          .update({ favorite: isFavorite });
        return reply.code(200).send({ success: true });
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

      try {
        const { uid } = await fastify.firebase.auth().verifyIdToken(token);
        await fastify.firebase.auth().getUser(uid);

        const { id }: any = request.query;
        await fastify.firebase
          .firestore()
          .collection("webpages")
          .doc(id)
          .delete();
        return reply.code(200).send({ success: true });
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

  // Document Count and Total Wordcount
  // Method: GET
  // Description: Returns the number of document url
  // Requirements:
  //  - Header: Authorization
  //  - Body: Domain
  // Response:
  //  - 200: Success, Document Count, Total Wordcount
  fastify.get(
    "/count",
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
            domain: { type: "string", minLength: 1 },
          },
          required: ["domain"],
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              dcount: { type: "integer" },
              wcount: { type: "integer" },
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
        const { domain }: any = request.query;
        fastify.firebase
          .firestore()
          .collection("webpages")
          .where("user_id", "==", uid)
          .where("domain", "==", domain)
          .get()
          .then((snapshot) => {
            if (snapshot.empty) {
              return reply
                .code(200)
                .send({ success: true, dcount: 0, wcount: 0 });
            } else {
              let wordcount = 0;
              snapshot.forEach((doc) => {
                wordcount += parseInt(doc.data().wordcount) + 1;
              });
              return reply.code(200).send({
                success: true,
                dcount: snapshot.size,
                wcount: wordcount,
              });
            }
          });
      } catch (error) {
        return reply.code(500).send({ success: false, error });
      }
    }
  );
}
