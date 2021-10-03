"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

/** Related functions for companies. */

class Company {
  /**
   * Helper function that is used to format the request query string used in the 
   * database query's WHERE clause in the "findAll" method. 
   * 
   * key: a key from request.query, but also the name of a column in the "companies" table
   * idx: an index, used to prevent SQL injects with statements such as "WHERE name = $1"
   * 
   * return: No return; modifies the array member in place
   */

  static makeKeyStatementsForWhereClauses(key, idx) {
    console.log("hello!")
    if (key === "name") return ` ${key} ILIKE $${idx+1}`
    if (key === "minEmployees") return `num_employees >= $${idx+1}`
    if (key === "maxEmployees") return `num_employees <= $${idx+1}`
  }

  /** Create a company (from data), update db, return new company data.
   *
   * data should be { handle, name, description, numEmployees, logoUrl }
   *
   * Returns { handle, name, description, numEmployees, logoUrl }
   *
   * Throws BadRequestError if company already in database.
   * */

  static async create({ handle, name, description, numEmployees, logoUrl }) {
    const duplicateCheck = await db.query(
          `SELECT handle
           FROM companies
           WHERE handle = $1`,
        [handle]);

    if (duplicateCheck.rows[0])
      throw new BadRequestError(`Duplicate company: ${handle}`);

    const result = await db.query(
          `INSERT INTO companies
           (handle, name, description, num_employees, logo_url)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING handle, name, description, num_employees AS "numEmployees", logo_url AS "logoUrl"`,
        [
          handle,
          name,
          description,
          numEmployees,
          logoUrl,
        ],
    );
    const company = result.rows[0];

    return company;
  }

  /** Find all companies.
   *
   * Returns [{ handle, name, description, numEmployees, logoUrl }, ...]
   * 
   * Accepts a query string: parameters are "name", "minEmployees", and "maxEmployees"
   * if any parameters are given outside of those three terms, the method will throw a
   * BadRequestError. 
   * 
   * name: the name of a company
   * minEmployees: the minimum number of employees a company will have
   * maxEmployees: the maximum number of employees a company will have
   * 
   * One query is made for instances when there is no query string, and another query is 
   * made to reflect the query string, meaning that the database query will only look for the values
   * that were present in the query string itself; not all three possible values (unless all three were given).
   * 
   * */

  static async findAll(query = null) {
    const validParams = ["name", "minEmployees", "maxEmployees"];
    const keys = Object.keys(query);
    const invalidKeys = keys.filter(k => validParams.indexOf(k) === -1);
    if (invalidKeys.length) throw new BadRequestError(`These parameters in your query 
                                                       string are invalid: [${invalidKeys}]`);
    
    if (!query) {
      const companiesRes = await db.query(
        `SELECT handle,
                name,
                description,
                num_employees AS "numEmployees",
                logo_url AS "logoUrl"
         FROM companies
         ORDER BY name`);
      return companiesRes.rows;
    } else {
      
      let queryKeys = keys.map((key, idx) => this.makeKeyStatementsForWhereClauses(key, idx)).join(" AND ");
      if (query.name) {
        query.name = `%${query.name}%`
      }
      const values = Object.values(query);
      const companiesRes = await db.query(
        `SELECT handle,
                name,
                description,
                num_employees AS "numEmployees",
                logo_url AS "logoUrl"
         FROM companies
         WHERE ${queryKeys}
         ORDER BY name`, [...values]);
      return companiesRes.rows;
    }
  }

  /** Given a company handle, return data about company.
   *
   * Returns { handle, name, description, numEmployees, logoUrl, jobs }
   *   where jobs is [{ id, title, salary, equity, companyHandle }, ...]
   *
   * Throws NotFoundError if not found.
   **/

  static async get(handle) {
    const companyRes = await db.query(
          `SELECT handle,
                  name,
                  description,
                  num_employees AS "numEmployees",
                  logo_url AS "logoUrl"
           FROM companies
           WHERE handle = $1`,
        [handle]);

    const company = companyRes.rows[0];

    if (!company) throw new NotFoundError(`No company: ${handle}`);

    return company;
  }

  /** Update company data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain all the
   * fields; this only changes provided ones.
   *
   * Data can include: {name, description, numEmployees, logoUrl}
   *
   * Returns {handle, name, description, numEmployees, logoUrl}
   *
   * Throws NotFoundError if not found.
   */

  static async update(handle, data) {
    const { setCols, values } = sqlForPartialUpdate(
        data,
        {
          numEmployees: "num_employees",
          logoUrl: "logo_url",
        });
    const handleVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE companies 
                      SET ${setCols} 
                      WHERE handle = ${handleVarIdx} 
                      RETURNING handle, 
                                name, 
                                description, 
                                num_employees AS "numEmployees", 
                                logo_url AS "logoUrl"`;
    const result = await db.query(querySql, [...values, handle]);
    const company = result.rows[0];

    if (!company) throw new NotFoundError(`No company: ${handle}`);

    return company;
  }

  /** Delete given company from database; returns undefined.
   *
   * Throws NotFoundError if company not found.
   **/

  static async remove(handle) {
    const result = await db.query(
          `DELETE
           FROM companies
           WHERE handle = $1
           RETURNING handle`,
        [handle]);
    const company = result.rows[0];

    if (!company) throw new NotFoundError(`No company: ${handle}`);
  }
}


module.exports = Company;
