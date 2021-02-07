/*
 * @description
 * Handle login/signup
 */

// Dependencies
import { PoolClient } from "pg";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import SQL from "sql-template-strings";
import * as bcrypt from "bcrypt";
import { sign } from "jsonwebtoken";

// Constants
const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
let client: PoolClient;

export default async function (
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
): Promise<void> {
  // Login
  // Method: POST
  // Description: Log in and get a token
  // Requirements:
  //  - Body: Email, Password
  // Response:
  //  - 200: Success, token, User details
  fastify.post(
    "/login",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            email: { type: "string", minLength: 1 },
            password: { type: "string", minLength: 8 },
          },
          required: ["email", "password"],
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              token: { type: "string" },
              user: {
                type: "object",
                properties: {
                  email: { type: "string" },
                  displayName: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async function (request, reply) {
      const { email, password }: any = request.body;
      if (email.match(emailRegex) == null) {
        reply
          .code(400)
          .send({ success: false, error: "Invalid email address" });
      }

      try {
        client = await fastify.pg.connect();
        const { rowCount, rows } = await client.query(
          SQL`SELECT displayName, email, password FROM users WHERE email = ${email}`
        );
        client.release();

        if (rowCount === 0) {
          return reply.code(401).send({
            success: false,
            error: "You don't have an account here",
          });
        } else {
          bcrypt.compare(
            password,
            rows[0].password,
            async function (err, isPasswordMatching) {
              if (err) {
                console.log(err);
                return reply.code(500).send({ success: false, error: err });
              }

              if (isPasswordMatching) {
                const token = sign(
                  {
                    id: rows[0].id,
                  },
                  process.env.TOKEN_SECRET as string,
                  {
                    expiresIn: "1d",
                    audience: rows[0].id,
                    issuer: "api.globex",
                  }
                );

                const user = {
                  email,
                  displayName: rows[0].displayName,
                };

                return reply
                  .code(200)
                  .setCookie("token", token, {
                    expires: (60 * 60 * 24) as any,
                    path: "/",
                  })
                  .send({
                    success: true,
                    user,
                    token,
                  });
              } else {
                return reply.code(401).send({
                  success: false,
                  error: "Password is incorrect",
                });
              }
            }
          );
        }
      } catch (error) {
        client.release();
        return reply.code(500).send({ success: false, error });
      }
    }
  );

  // Signup
  // Method: POST
  // Description: Sign up and get a token
  // Requirements:
  //  - Body: Display name, Email, Password
  // Response:
  //  - 201: Success, token, User details
  fastify.post(
    "/signup",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            displayName: { type: "string", minLength: 1 },
            email: { type: "string", minLength: 1 },
            password: { type: "string", minLength: 8 },
          },
          required: ["displayName", "email", "password"],
          additionalProperties: false,
        },
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              token: { type: "string" },
              user: {
                type: "object",
                properties: {
                  email: { type: "string" },
                  displayName: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async function (request, reply) {
      const { displayName, email, password }: any = request.body;
      if (email.match(emailRegex) == null) {
        reply
          .code(400)
          .send({ success: false, error: "Invalid email address" });
      }

      try {
        client = await fastify.pg.connect();
        const { rowCount } = await client.query(
          SQL`SELECT email FROM users WHERE email = ${email}`
        );

        if (rowCount == 1) {
          client.release();
          return reply.code(401).send({
            success: false,
            error: "Account already exists",
          });
        } else {
          bcrypt.genSalt(10, function (err, salt) {
            bcrypt.hash(password, salt, async function (err, hash) {
              if (err) {
                client.release();
                return reply.code(500).send({ success: false, error: err });
              }

              const { rows } = await client.query(
                SQL`INSERT INTO users(displayName, email, password) VALUES (${displayName}, ${email}, ${hash}) RETURNING id`
              );
              client.release();

              const token = sign(
                {
                  id: rows[0].id,
                },
                process.env.TOKEN_SECRET as string,
                {
                  expiresIn: "1d",
                  audience: rows[0].id,
                  issuer: "api.globex",
                }
              );

              const user = {
                email,
                displayName,
              };

              return reply
                .code(201)
                .setCookie("token", token, {
                  expires: (60 * 60 * 24) as any,
                  path: "/",
                })
                .send({
                  success: true,
                  user,
                  token,
                });
            });
          });
        }
      } catch (error) {
        console.log(error);
        client.release();
        return reply.code(500).send({ success: false, error });
      }
    }
  );
}
