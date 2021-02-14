/*
 * @description
 * Handle login/signup
 */

// Dependencies
import { FastifyInstance, FastifyPluginOptions } from "fastify";

export default async function (
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
): Promise<void> {
  // Verify Token
  // Method: POST
  // Description: Verify if token exists and is valid
  // Requirements:
  //  - Body: Token
  // Response:
  //  - 200: Success
  fastify.post(
    "/verify",
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
            email: { type: "string", minLength: 1 },
          },
          required: ["email"],
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
      const { email }: any = request.body;

      if (
        email.match(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/) == null
      ) {
        return reply
          .code(400)
          .send({ success: false, error: "Invalid email address" });
      }

      try {
        const requestToken = await fastify.firebase.auth().verifyIdToken(token);

        const { uid }: any = requestToken;
        const userRecord = await fastify.firebase.auth().getUser(uid);
        if (userRecord.email?.toLowerCase() == email.toLowerCase()) {
          return reply.code(200).send({ success: true });
        } else {
          return reply
            .code(401)
            .send({ success: false, error: "Unauthorized" });
        }
      } catch (error) {
        reply.code(500).send({ success: false, error });
      }
    }
  );
}
