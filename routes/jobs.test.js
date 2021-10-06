"use strict";

const jwt = require("jsonwebtoken");
const { SECRET_KEY } = require("../config");
const request = require("supertest");

const db = require("../db");
const app = require("../app");

const {
  u1Token,
} = require("./_testCommon");

let adminToken;
beforeEach(async() => {
  const createAdmin = await db.query(
    `INSERT INTO users
     (username, password, first_name, last_name, email, is_admin)
     VALUES
     ($1, $2, $3, $4, $5, $6)
     RETURNING username, password, first_name AS firstName, last_name AS lastName, email, is_admin AS isAdmin`,
     ['newAdmin', 'cookies', 'new', 'Admin', 'newAdmin@gmail.com', true]
  );
  
  await db.query(`
    INSERT INTO companies(handle, name, num_employees, description, logo_url)
    VALUES ('c1', 'C1', 1, 'Desc1', 'http://c1.img'),
           ('c2', 'C2', 2, 'Desc2', 'http://c2.img'),
           ('c3', 'C3', 3, 'Desc3', 'http://c3.img')`);

    await db.query(
        `INSERT INTO jobs
         (title, salary, equity, company_handle)
         VALUES
         ('manager', 75000, 0.10, 'c1'),
         ('cook', 90000, 0.0, 'c2'),
         ('teacher', 50000, 0.15, 'c3')`
    );

  adminToken = jwt.sign({username: "newAdmin", isAdmin: true}, SECRET_KEY);
});

afterEach(async() => {
    await db.query("DELETE FROM companies");
    await db.query("DELETE FROM jobs");
    await db.query("DELETE FROM users");
});

afterAll(async() => {
    await db.end();
});

/************************************** POST /jobs */

describe("POST /jobs", function () {
//   const newCompany = {
//     title: "new",
//     salary: 76000,
//     equity: 0.05,
//     companyHandle: "c1"
//   };

  test("fails for non-admin users", async function () {
    const newCompany = {
        title: "new",
        salary: 76000,
        equity: 0.05,
        companyHandle: "c1"
    };

    const resp = await request(app)
        .post("/jobs")
        .send(newCompany)
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(401);
    expect(resp.body.error.message).toEqual("Unauthorized");
  });

  test("works for admin users", async function () {
    const newCompany = {
        title: "new1",
        salary: 76000,
        equity: 0.05,
        companyHandle: "c1"
    };

    const resp = await request(app)
        .post("/jobs")
        .send(newCompany)
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(201);
    expect(resp.body).toEqual({
      job: {
          title: "new1",
          salary: 76000,
          equity: "0.05",
          companyhandle: "c1"
      },
    });
  });

  test("bad request with missing data", async function () {
    const resp = await request(app)
        .post("/jobs")
        .send({
          title: "new",
          salary: 76000,
        })
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(400);
  });

  test("bad request with invalid data", async function () {
    const resp = await request(app)
        .post("/companies")
        .send({
          title: "new",
          salary: 76000,
          equity: 0.05,
          cake: "yum"
        })
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(400);
  });
});

// /************************************** GET /jobs */

describe("GET /jobs", function () {
  test("ok for anon", async function () {
    const resp = await request(app).get("/jobs");
    expect(resp.body).toEqual({
      jobs:
          [
            {
                title: "cook",
                salary: 90000,
                equity: "0.0",
                companyhandle: "c2"
            },
            {
                title: "manager",
                salary: 75000,
                equity: "0.10",
                companyhandle: "c1"
            },
            {
                title: "teacher",
                salary: 50000,
                equity: "0.15",
                companyhandle: "c3"
            },
          ],
    });
  });

  test("works: good query string with all three parameters", async() => {
    const queryString = {
      title: "c",
      minSalary: 50000,
      hasEquity: true
    };
    const resp = await request(app).get("/jobs").query(queryString);
    expect(resp.statusCode).toBe(200);
    expect(resp.body.jobs[0].title).toEqual("teacher");
  });

  test("works: good query string with only minSalary", async() => {
    const queryString = {
      minSalary: 70000
    };
    const resp = await request(app).get("/jobs").query(queryString);
    expect(resp.statusCode).toBe(200);
    expect(resp.body.jobs[1].title).toEqual("manager");
  });

  test("works: good query string with only title and hasEquity", async() => {
    const queryString = {
      title: "c",
      hasEquity: true
    };
    const resp = await request(app).get("/jobs").query(queryString);
    expect(resp.statusCode).toBe(200);
    expect(resp.body.jobs[0].title).toEqual("teacher");
    expect(resp.body.jobs.length).toBe(1);
  });

  test("fails: query string has invalid key", async() => {
    const queryString = {
      title: "c",
      minSalary: 40000,
      potato: "soup"
    };
    const resp = await request(app).get("/jobs").query(queryString);
    expect(resp.statusCode).toBe(400);
    expect(resp.body.error.message).toContain("These parameters in your query");
  });
});

/************************************** GET /companies/:title */

describe("GET /companies/:title", function () {
  test("works for anon", async function () {
    const resp = await request(app).get(`/jobs/manager`);
    expect(resp.body).toEqual({
      job: {
        title: "manager",
        salary: 75000,
        equity: "0.10",
        companyhandle: "c1"
      },
    });
  });

  test("not found for no such company", async function () {
    const resp = await request(app).get(`/jobs/nope`);
    expect(resp.statusCode).toEqual(404);
  });

  test("throw error on bad endpoint", async() => {
      const resp = await request(app).get(`/jobz/manager`);
      expect(resp.statusCode).toBe(404);
  });
});

// /************************************** PATCH /companies/:title */

describe("PATCH /companies/:title", function () {
  test("fails for non-admin users", async function () {
    const resp = await request(app)
        .patch(`/jobs/manager`)
        .send({
          title: "C1-new",
        })
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toBe(401);
    expect(resp.body.error.message).toBe("Unauthorized");
  });

  test("works for admin", async function () {
    const resp = await request(app)
        .patch(`/jobs/manager`)
        .send({
          title: "C1-new",
        })
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.body).toEqual({
      job: {
        title: "C1-new",
        salary: 75000,
        equity: "0.10",
        companyhandle: "c1"
      },
    });
  });

  test("unauth for anon", async function () {
    const resp = await request(app)
        .patch(`/jobs/manager`)
        .send({
          title: "C1-new",
        });
    expect(resp.statusCode).toEqual(401);
  });

  test("not found on no such job", async function () {
    const resp = await request(app)
        .patch(`/jobs/nope`)
        .send({
          title: "new nope",
        })
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(404);
  });

  test("bad request on title change attempt", async function () {
    const resp = await request(app)
        .patch(`/jobs/manager`)
        .send({
          title: 76,
        })
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(400);
  });

  test("bad request on invalid data", async function () {
    const resp = await request(app)
        .patch(`/jobs/manager`)
        .send({
          title: 75,
        })
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(400);
  });
});

// /************************************** DELETE /companies/:title */

describe("DELETE /jobs/:title", function () {
  test("works for admin users", async function () {
    const resp = await request(app)
        .delete(`/jobs/manager`)
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.body).toEqual({ deleted: "manager" });
  });

  test("fails for non-admin users", async function () {
    const resp = await request(app)
        .delete(`/jobs/manager`)
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.body.error.message).toEqual("Unauthorized");
    expect(resp.statusCode).toBe(401);
  });

  test("unauth for anon", async function () {
    const resp = await request(app)
        .delete(`/jobs/manager`);
    expect(resp.statusCode).toEqual(401);
  });

  test("not found for no such company", async function () {
    const resp = await request(app)
        .delete(`/jobs/nope`)
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(404);
  });
});
