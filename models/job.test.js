const db = require("../db");
const {
    commonBeforeAll,
    commonBeforeEach,
    commonAfterEach,
    commonAfterAll,
    u1Token
} = require("./_testCommon");

const { BadRequestError, NotFoundError } = require("../expressError");
const Job = require("./job");


beforeEach(async() => {
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
});

afterEach(async() => {
    await db.query("DELETE FROM companies");
    await db.query("DELETE FROM jobs");
});

afterAll(async() => {
    await db.end();
})


/************************************** create */

describe("create", function () {
  
    test("works", async function () {
    const newJob = {
        title: "new",
        salary: 67000,
        equity: 0.3,
        companyHandle: "c1"
      };
      let job = await Job.create(newJob);
      expect(job).toEqual({
          title: "new",
          salary: 67000,
          equity: "0.3",
          companyhandle: "c1"
      });
  
      const result = await db.query(
            `SELECT title, salary, equity, company_handle AS companyHandle
             FROM jobs
             WHERE title = 'new'`);
      expect(result.rows).toEqual([
        {
          equity: "0.3",
          companyhandle: "c1",
          title: "new",
          salary: 67000,
        },
      ]);
    });
  });
  
  /************************************** findAll */
  
  describe("findAll", function () {
    test("works: no filter", async function () {
      let jobs = await Job.findAll();
      expect(jobs).toEqual([
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
      ]);
    });
    test("works: all three filter options", async() => {
      const queryString = {
        title: "manager",
        minSalary: 50000,
        hasEquity: true
      };
      const jobs = await Job.findAll(queryString);
      expect(jobs).toEqual(
        [
          {
            title: "manager",
            salary: 75000,
            equity: "0.10",
            companyhandle: "c1"
          }
        ]
      );
    });
    test("works: only using title filter", async() => {
      const queryString = {
        title: "c"
      };
      const jobs = await Job.findAll(queryString);
      expect(jobs).toEqual([
        {
            title: "cook",
            salary: 90000,
            equity: "0.0",
            companyhandle: "c2"
        },
        {
            title: "teacher",
            salary: 50000,
            equity: "0.15",
            companyhandle: "c3"
        },
      ]);
    });
    test("works: using title and hasEquity as filters", async() => {
      const queryString = {
        title: "c",
        hasEquity: true
      };
      const jobs = await Job.findAll(queryString);
      expect(jobs).toEqual([
        {
            title: "teacher",
            salary: 50000,
            equity: "0.15",
            companyhandle: "c3"
        },
      ]);
    });
    test("does not work: bad key in query", async() => {
      const queryString = {
        title: "c",
        minSalary: 1,
        potato: "soup"
      };
      const keys = Object.keys(queryString);
      await expect(() => {
          Job.checkForBadQueries(keys);
      }).toThrow();
    });
  });
  
  /************************************** get */
  
  describe("get", function () {
    test("works", async function () {
      let job = await Job.get("manager");
      expect(job).toEqual(
        {
            title: "manager",
            salary: 75000,
            equity: "0.10",
            companyhandle: "c1"
        }
      );
    });
  
    test("not found if no such job", async function () {
      try {
        await Job.get("nope");
        fail();
      } catch (err) {
        expect(err instanceof NotFoundError).toBeTruthy();
      }
    });
  });
  
//   /************************************** update */
  
  describe("update", function () {
    test("works", async function () {
      const updateData = {
         salary: 90000
      };

      let job = await Job.update("manager", updateData);
      expect(job).toEqual({
        title: "manager",
        salary: 90000,
        equity: "0.10",
        companyhandle: "c1"
      });
  
      const result = await db.query(
            `SELECT title, salary, equity, company_handle AS companyHandle
             FROM jobs
             WHERE title = 'manager'`);
      expect(result.rows).toEqual([{
        title: "manager",
        salary: 90000,
        equity: "0.10",
        companyhandle: "c1"
      }]);
    });
  
    test("works: null fields", async function () {
      const updateDataSetNulls = {
        title: "manager",
        salary: null,
        equity: null,
        companyHandle: "c1"
      };
  
      let job = await Job.update("manager", updateDataSetNulls);
      expect(job).toEqual({
        title: "manager",
        salary: null,
        equity: null,
        companyhandle: "c1"
      });
  
      const result = await db.query(
            `SELECT title, salary, equity, company_handle AS companyHandle
             FROM jobs
             WHERE title = 'manager'`);
      expect(result.rows).toEqual([{
        title: "manager",
        salary: null,
        equity: null,
        companyhandle: "c1"
      }]);
    });
  
    test("not found if no such job", async function () {
      const updateData = {
        salary: 90000
      };
      try {
        await job.update("nope", updateData);
        fail();
      } catch (err) {
        expect(err.message).toEqual("job is not defined");
      }
    });
  
    test("bad request with no data", async function () {
      try {
        await job.update("c1", {});
        fail();
      } catch (err) {
        expect(err.message).toEqual("job is not defined");
      }
    });
});
  
//   /************************************** remove */
  
describe("remove", function () {
    test("works", async function () {
        await Job.remove("manager");
        const res = await db.query(
            "SELECT title FROM jobs WHERE title = 'manager'");
        expect(res.rows.length).toEqual(0);
    });

    test("not found if no such job", async function () {
        try {
        await job.remove("nope");
        fail();
        } catch (err) {
        expect(err.message).toEqual("job is not defined")
        };
    });
});