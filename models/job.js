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

  static makeKeyStatementsForWhereClauses(query, key, idx) {
    const equityAmt = query.hasEquity === 'false' || !query.hasEquity ? '=' : '>';

    if (key === "title") return ` ${key} ILIKE $${idx+1}`
    if (key === "minSalary") return `salary >= $${idx+1}`
    if (key === "hasEquity") return `equity ${equityAmt} $${idx+1}`
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
  static checkForBadQueries(keys) {
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


  /** Method used to get all job data.
   * 
   * parameters:
   *    query: the request.query object, or an empty object if there
   *           is no request query
   * 
   * return: an array of all job listings
   */

  static async findAll(query = {}) {
    const keys = Object.keys(query);
    this.checkForBadQueries(keys);

    let queryKeys = keys.map((key, idx) => this.makeKeyStatementsForWhereClauses(query, key, idx)).join(" AND ");
    let whereClause = queryKeys.length ? `WHERE ${queryKeys}` : "";

    if (query.title) query.title = `%${query.title}%`;

    const values = Object.values(query).filter(v => [true, false, 'true', 'false'].indexOf(v) === -1);
    if (query.hasEquity !== undefined) values.push('0');
    
    const results = await db.query(
      `SELECT title, salary, equity, company_handle AS companyHandle
       FROM jobs
       ${whereClause}
       ORDER BY title`,
       [...values]
    );

    return results.rows;
  };


  /** Method used to get a job with a specific title.
   * 
   * Parameters:
   *    title: the title of the job to search for: a String
   * 
   * Return:
   *    - if no job is found, raises NotFoundError
   *    - otherwise, returns the data about the job
   */

  static async get(title) {
    const result = await db.query(
      `SELECT title, salary, equity, company_handle AS companyHandle
       FROM jobs
       WHERE title = $1`,
       [title]
    );

    const job = result.rows[0];
    if (!job) throw new NotFoundError(`No job with the following title: ${title}`);
    return job;
  };


  /** Method used to update an existing job.
   * 
   * parameters:
   *    title: the title of the job to uppdate: a String
   *    data: all of the new data to update in the database: an Object
   *      - data can include, but does not have to include, all of the following:
   *          { title, salary, equity, companyHandle }
   * 
   * return:
   *    raises NotFoundError if no job with that title is found
   *    otherwise returns the job with updated data
   */

  static async update(title, data) {
    const { setCols, values } = sqlForPartialUpdate(
      data,
      {
        companyHandle: "company_handle",
      });
    const handleVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE jobs 
                      SET ${setCols} 
                      WHERE title = ${handleVarIdx} 
                      RETURNING title, 
                                salary, 
                                equity, 
                                company_handle AS companyHandle`;
    const result = await db.query(querySql, [...values, title]);
    const job = result.rows[0];

    if (!job) throw new NotFoundError(`No company: ${title}`);

    return job;
  }


  /** Method used to delete jobs from the database.
   * 
   * Parameters:
   *    -title: the title of the job to delete: a String
   * 
   * Return:
   *    - raises NotFoundError if the job does not exists
   *    - returns null otherwise
   */

  static async remove(title) {
    const result = await db.query(
          `DELETE
           FROM jobs
           WHERE title = $1
           RETURNING title`,
        [title]);
    const job = result.rows[0];

    if (!job) throw new NotFoundError(`No company: ${title}`);
  };
};

module.exports = Job;