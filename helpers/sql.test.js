const db = require("../db");
const { sqlForPartialUpdate } = require("./sql");
const bcrypt = require("bcrypt");
const { BCRYPT_WORK_FACTOR } = require("../config");
const { BadRequestError } = require("../expressError");

let user;

beforeEach(async() => {
    const result = await db.query(
        `INSERT INTO users
         (username, password, first_name, last_name, email)
         VALUES
         ('joe', $1, 'joe', 'smith', 'joe@gmail.com')
         RETURNING username, first_name, last_name, email`,
         [await bcrypt.hash("password1", BCRYPT_WORK_FACTOR)]
    );
    user = result.rows[0];
});

afterEach(async() => {
    await db.query("DELETE FROM users");
});

afterAll(async() => {
    await db.end();
});

describe("Test sqlForPartialUpdate", () => {
    test("Does the sqlForPartialUpdate function work as intended if all fields except username are updated?", async() => {
        const data = {
            password: "cookie",
            firstName: "john",
            lastName: "thomas",
            email: "johnt@gmail.com",
            isAdmin: false
        };
        const jsToSql = {
            firstName: "first_name",
            lastName: "last_name",
            isAdmin: "is_admin"
        };
        const { setCols, values } = sqlForPartialUpdate(data, jsToSql);
        const userNameIdx = values.length + 1;
        const updateQuery = await db.query(
            `UPDATE users
             SET ${setCols}
             WHERE username = $${userNameIdx}`,
             [...values, "joe"]
        )
        const newQuery = await db.query(
            `SELECT * FROM users
             WHERE username = $1`,
             ['joe']
        )
        expect(newQuery.rows[0].first_name).toEqual('john');
        expect(newQuery.rows[0].email).toEqual("johnt@gmail.com");
    });
    test("Does the sqlForPartialUpdate function work as intended if we only update two columns?", async() => {
        const data = {
            lastName: "thomas",
            email: "johnt@gmail.com",
        };
        const jsToSql = {
            firstName: "first_name",
            lastName: "last_name",
            isAdmin: "is_admin"
        };
        const { setCols, values } = sqlForPartialUpdate(data, jsToSql);
        const userNameIdx = values.length + 1;
        const updateQuery = await db.query(
            `UPDATE users
             SET ${setCols}
             WHERE username = $${userNameIdx}`,
             [...values, "joe"]
        )
        const newQuery = await db.query(
            `SELECT * FROM users
             WHERE username = $1`,
             ['joe']
        )
        expect(newQuery.rows[0].last_name).toEqual('thomas');
        expect(newQuery.rows[0].email).toEqual("johnt@gmail.com");
        expect(newQuery.rows[0].first_name).toEqual("joe"); //same as the original value that was in the column
    });
    test("Does the sqlForPartialUpdate function throw an error as intended if no fields are updated?", async() => {
        const data = {};
        const jsToSql = {
            firstName: "first_name",
            lastName: "last_name",
            isAdmin: "is_admin"
        };
        
        expect(() => {
            const { setCols , values} = sqlForPartialUpdate(data, jsToSql);
        }).toThrow(new BadRequestError("No data"));
    });
});

  


