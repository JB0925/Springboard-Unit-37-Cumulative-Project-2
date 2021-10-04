"use strict";

const request = require("supertest");
const jwt = require("jsonwebtoken");
const { SECRET_KEY } = require("../config");

const db = require("../db.js");
const app = require("../app");
const User = require("../models/user");

const {
  commonBeforeAll,
  commonBeforeEach,
  commonAfterEach,
  commonAfterAll,
  u1Token,
} = require("./_testCommon");

beforeAll(commonBeforeAll);
beforeEach(commonBeforeEach);
afterEach(commonAfterEach);
afterAll(commonAfterAll);

let admin;
let adminToken;
let userToken2;
beforeEach(async() => {
  const createAdmin = await db.query(
    `INSERT INTO users
     (username, password, first_name, last_name, email, is_admin)
     VALUES
     ($1, $2, $3, $4, $5, $6)
     RETURNING username, password, first_name AS firstName, last_name AS lastName, email, is_admin AS isAdmin`,
     ['newAdmin', 'cookies', 'new', 'Admin', 'newAdmin@gmail.com', true]
  );
  
  admin = createAdmin.rows[0];
  adminToken = jwt.sign({username: "newAdmin", isAdmin: true}, SECRET_KEY);
});

/************************************** POST /users */

describe("POST /users", function () {
  test("fails for users: create non-admin", async function () {
    const resp = await request(app)
        .post("/users")
        .send({
          username: "u-new",
          firstName: "First-new",
          lastName: "Last-newL",
          password: "password-new",
          email: "new@email.com",
          isAdmin: false,
        })
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(401);
    expect(resp.body.error.message).toEqual("Unauthorized");
  });

  test("fails for users: create admin", async function () {
    const resp = await request(app)
        .post("/users")
        .send({
          username: "u-new",
          firstName: "First-new",
          lastName: "Last-newL",
          password: "password-new",
          email: "new@email.com",
          isAdmin: true,
        })
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(401);
    expect(resp.body.error.message).toEqual("Unauthorized");
  });

  test("unauth for anon", async function () {
    const resp = await request(app)
        .post("/users")
        .send({
          username: "u-new",
          firstName: "First-new",
          lastName: "Last-newL",
          password: "password-new",
          email: "new@email.com",
          isAdmin: true,
        });
    expect(resp.statusCode).toEqual(401);
  });

  test("works for admin: create non-admin", async function () {
    const resp = await request(app)
        .post("/users")
        .send({
          username: "u-new",
          firstName: "First-new",
          lastName: "Last-newL",
          password: "password-new",
          email: "new@email.com",
          isAdmin: false,
        })
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(201);
    expect(resp.body).toEqual({
      user: {
        username: "u-new",
        firstName: "First-new",
        lastName: "Last-newL",
        email: "new@email.com",
        isAdmin: false,
      }, token: expect.any(String),
    });
  });

  test("works for admin: create new admin", async function () {
    const resp = await request(app)
        .post("/users")
        .send({
          username: "u-new",
          firstName: "First-new",
          lastName: "Last-newL",
          password: "password-new",
          email: "new@email.com",
          isAdmin: true,
        })
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(201);
    expect(resp.body).toEqual({
      user: {
        username: "u-new",
        firstName: "First-new",
        lastName: "Last-newL",
        email: "new@email.com",
        isAdmin: true,
      }, token: expect.any(String),
    });
  });

  test("bad request if missing data: from Admin", async function () {
    const resp = await request(app)
        .post("/users")
        .send({
          username: "u-new",
        })
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(400);
  });

  test("bad request if invalid data: from Admin", async function () {
    const resp = await request(app)
        .post("/users")
        .send({
          username: "u-new",
          firstName: "First-new",
          lastName: "Last-newL",
          password: "password-new",
          email: "not-an-email",
          isAdmin: true,
          banana: "yes"
        })
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(400);
  });
});

/************************************** GET /users */

describe("GET /users", function () {
  test("fails for non-admin users", async function () {
    const resp = await request(app)
        .get("/users")
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toBe(401);
    expect(resp.body.error.message).toEqual("Unauthorized");
  });

  test("works for admin", async() => {
    const resp = await request(app)
        .get("/users")
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toBe(200);
    expect(resp.body).toEqual({
      users: [
        {
          username: "newAdmin",
          firstName: "new",
          lastName: "Admin",
          email: "newAdmin@gmail.com",
          isAdmin: true
        },
        {
          username: "u1",
          firstName: "U1F",
          lastName: "U1L",
          email: "user1@user.com",
          isAdmin: false,
        },
        {
          username: "u2",
          firstName: "U2F",
          lastName: "U2L",
          email: "user2@user.com",
          isAdmin: false,
        },
        {
          username: "u3",
          firstName: "U3F",
          lastName: "U3L",
          email: "user3@user.com",
          isAdmin: false,
        },
      ],
    });
  });

  test("unauth for anon", async function () {
    const resp = await request(app)
        .get("/users");
    expect(resp.statusCode).toEqual(401);
  });

  test("fails: test next() handler", async function () {
    // there's no normal failure event which will cause this route to fail ---
    // thus making it hard to test that the error-handler works with it. This
    // should cause an error, all right :)
    await db.query("DROP TABLE users CASCADE");
    const resp = await request(app)
        .get("/users")
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(500);
  });
});

/************************************** GET /users/:username */

describe("GET /users/:username", function () {
  test("works for users who are logged in AND are requesting their own data", async function () {
    const resp = await request(app)
        .get(`/users/u1`)
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.body).toEqual({
      user: {
        username: "u1",
        firstName: "U1F",
        lastName: "U1L",
        email: "user1@user.com",
        isAdmin: false,
      },
    });
  });

  test("works for admin", async function () {
    const resp = await request(app)
        .get(`/users/u1`)
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.body).toEqual({
      user: {
        username: "u1",
        firstName: "U1F",
        lastName: "U1L",
        email: "user1@user.com",
        isAdmin: false,
      },
    });
  });

  test("fails for logged in user who is NOT the user in request.params", async() => {
    const createOtherUser = await db.query(
      `INSERT INTO users
       (username, password, first_name, last_name, email, is_admin)
       VALUES
       ($1, $2, $3, $4, $5, $6)
       RETURNING username, password, first_name AS firstName, last_name AS lastName, email, is_admin AS isAdmin`,
       ['otherUser', 'cookies', 'other', 'User', 'otherUser@gmail.com', false]
    );

    userToken2 = jwt.sign({username: "otherUser", isAdmin: false}, SECRET_KEY);
    const resp = await request(app).get("/users/u1")
                                   .set("authorization", `Bearer ${userToken2}`);
    expect(resp.statusCode).toBe(401);
    expect(resp.body.error.message).toEqual("Unauthorized");
  });

  

  test("unauth for anon", async function () {
    const resp = await request(app)
        .get(`/users/u1`);
    expect(resp.statusCode).toEqual(401);
  });

  test("not found if user not found", async function () {
    const resp = await request(app)
        .get(`/users/nope`)
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(404);
  });
});

/************************************** PATCH /users/:username */

describe("PATCH /users/:username", () => {
  test("works for logged in users when requesting their own data", async function () {
    const resp = await request(app)
        .patch(`/users/u1`)
        .send({
          firstName: "New",
        })
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.body).toEqual({
      user: {
        username: "u1",
        firstName: "New",
        lastName: "U1L",
        email: "user1@user.com",
        isAdmin: false,
      },
    });
  });

  test("fails for logged in user who is NOT the user in request.params", async() => {
    const createOtherUser = await db.query(
      `INSERT INTO users
       (username, password, first_name, last_name, email, is_admin)
       VALUES
       ($1, $2, $3, $4, $5, $6)
       RETURNING username, password, first_name AS firstName, last_name AS lastName, email, is_admin AS isAdmin`,
       ['otherUser', 'cookies', 'other', 'User', 'otherUser@gmail.com', false]
    );
    
    userToken2 = jwt.sign({username: "otherUser", isAdmin: false}, SECRET_KEY);
    const resp = await request(app).patch("/users/u1")
                                   .send({firstName: "New"})
                                   .set("authorization", `Bearer ${userToken2}`);
    expect(resp.statusCode).toBe(401);
    expect(resp.body.error.message).toEqual("Unauthorized");
  });

  test("works for admin", async() => {
    const resp = await request(app).patch("/users/u1")
                                   .send({firstName: "New"})
                                   .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toBe(200);
    expect(resp.body).toEqual({
      user: {
        username: "u1",
        firstName: "New",
        lastName: "U1L",
        email: "user1@user.com",
        isAdmin: false,
      },
    });
  });

  test("unauth for anon", async function () {
    const resp = await request(app)
        .patch(`/users/u1`)
        .send({
          firstName: "New",
        });
    expect(resp.statusCode).toEqual(401);
  });

  test("not found if no such user", async function () {
    const resp = await request(app)
        .patch(`/users/nope`)
        .send({
          firstName: "Nope",
        })
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(404);
  });

  test("bad request if invalid data", async function () {
    const resp = await request(app)
        .patch(`/users/u1`)
        .send({
          firstName: 42,
        })
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(400);
  });

  test("works: set new password", async function () {
    const resp = await request(app)
        .patch(`/users/u1`)
        .send({
          password: "new-password",
        })
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.body).toEqual({
      user: {
        username: "u1",
        firstName: "U1F",
        lastName: "U1L",
        email: "user1@user.com",
        isAdmin: false,
      },
    });
    const isSuccessful = await User.authenticate("u1", "new-password");
    expect(isSuccessful).toBeTruthy();
  });
});

/************************************** DELETE /users/:username */

describe("DELETE /users/:username", function () {
  test("works for users", async function () {
    const resp = await request(app)
        .delete(`/users/u1`)
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.body).toEqual({ deleted: "u1" });
  });

  test("fails for logged in user who is NOT the user in request.params", async() => {
    const createOtherUser = await db.query(
      `INSERT INTO users
       (username, password, first_name, last_name, email, is_admin)
       VALUES
       ($1, $2, $3, $4, $5, $6)
       RETURNING username, password, first_name AS firstName, last_name AS lastName, email, is_admin AS isAdmin`,
       ['otherUser', 'cookies', 'other', 'User', 'otherUser@gmail.com', false]
    );
    
    userToken2 = jwt.sign({username: "otherUser", isAdmin: false}, SECRET_KEY);
    const resp = await request(app).delete("/users/u1")
                                   .set("authorization", `Bearer ${userToken2}`);
    expect(resp.statusCode).toBe(401);
    expect(resp.body.error.message).toEqual("Unauthorized");
  });

  test("works for admin", async() => {
    const resp = await request(app).delete("/users/u1")
                                   .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toBe(200);
    expect(resp.body.deleted).toEqual("u1");
  });

  test("unauth for anon", async function () {
    const resp = await request(app)
        .delete(`/users/u1`);
    expect(resp.statusCode).toEqual(401);
  });

  test("not found if user missing", async function () {
    const resp = await request(app)
        .delete(`/users/nope`)
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(404);
  });
});
