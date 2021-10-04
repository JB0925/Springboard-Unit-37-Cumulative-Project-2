"use strict";

const db = require("../db");
const bcrypt = require("bcrypt");
const { sqlForPartialUpdate } = require("../helpers/sql");
const {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
} = require("../expressError");

const { BCRYPT_WORK_FACTOR } = require("../config.js");

/** Related functions for jobs. */

class Job {
    /**
   * Helper function that is used to format the request query string used in the 
   * database query's WHERE clause in the "findAll" method. 
   * 
   * key: a key from request.query, but also the name of a column in the "jobs" table
   * idx: an index, used to prevent SQL injects with statements such as "WHERE name = $1"
   * 
   * return: No return; modifies the array member in place
   */

  static makeKeyStatementsForWhereClauses(key, idx) {
    if (key === "title") return ` ${key} ILIKE $${idx+1}`
    if (key === "minSalary") return `salary >= $${idx+1}`
    if (key === "hasEquity") return `equity = $${idx+1}`
  }

  /**
   * Checking to make sure that the route's request query is valid, 
   * and throwing errors if it isn't. 
   * 
   * query: the request.query object
   * 
   * keys: an array of the keys from the request.query object
   * 
   * return: null.
   * 
   */
  static checkForBadQueries(query, keys) {
    const validParams = ["title", "minSalary", "hasEquity"];
    const invalidKeys = keys.filter(k => validParams.indexOf(k) === -1);
    if (invalidKeys.length) throw new BadRequestError(`These parameters in your query 
                                                       string are invalid: [${invalidKeys}]`);
  };


  /** Function used to create a new job by a user.
   * 
   * Authorization Required: User must be logged in AND have admin priviledges
   * 
   * 
   * parameters: 
   *    title: the job title, a String
   *    salary: the job salary, a Number
   *    equity: the equity issued, a Number
   *    companyHandle: the company's "nickname", a String
   * 
   * Return: 
   *    the newly created job
   */

  static async create({ title, salary, equity, companyHandle }) {
    const result = await db.query(
        `INSERT INTO jobs
         (title, salary, equity, company_handle)
         VALUES
         ($1, $2, $3, $4)
         RETURNING title, salary, equity, company_handle AS companyHandle`,
         [title, salary, equity, companyHandle]
    );
    
    const newJob = result.rows[0];
    return newJob;
  };


  static async findAll(query = {}) {
    const keys = Object.keys(query);
    this.checkForBadQueries(query, keys);
    let queryKeys = keys.map((key, idx) => this.makeKeyStatementsForWhereClauses(key, idx)).join(" AND ");

    const values = Object.values(query);
    let whereClause = queryKeys.length ? `WHERE ${queryKeys}` : "";

    const results = await db.query(
      `SELECT title, salary, equity, company_handle AS companyHandle
       FROM jobs
       ${whereClause}
       ORDER BY title`,
       [...values]
    );

    return results.rows;
  };


};