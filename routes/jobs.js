"use strict";

const jsonschema = require("jsonschema");
const express = require("express");
const router = new express.Router();

const { BadRequestError } = require("../expressError");
const { ensureLoggedInAndIsAdmin } = require("../middleware/auth");

const Job = require("../models/job");

const jobNewSchema = require("../schemas/jobNew.json");
const jobUpdateSchema = require("../schemas/jobUpdate.json");


/** POST / { job } =>  { job }
 *
 * job should be { title, salary, equity, companyHandle }
 *
 * Returns { title, salary, equity, companyHandle }
 *
 * Authorization required: login AND admin priviledges
 */

 router.post("/", ensureLoggedInAndIsAdmin, async function (req, res, next) {
    try {
      const validator = jsonschema.validate(req.body, jobNewSchema);
      if (!validator.valid) {
        const errs = validator.errors.map(e => e.stack);
        throw new BadRequestError(errs);
      }
  
      const job = await Job.create(req.body);
      console.log(job)
      return res.status(201).json({ job });
    } catch (err) {
      return next(err);
    }
  });
  
  /** GET /  =>
   *   { jobs: [ { title, salary, equity, companyHandle }, ...] }
   *
   * Can filter on provided search filters as a query string:
   * - title: a String (can be a partial job title)
   * - minSalary: a Number
   * - hasEquity: bool
   *
   * Authorization required: none
   */
  
  router.get("/", async function (req, res, next) {
    try {
      const jobs = await Job.findAll(req.query);
      return res.json({ jobs });
    } catch (err) {
      return next(err);
    }
  });
  
  /** GET /[title]  =>  { job }
   *
   *  Job is is { title, salary, equity, company_handle }
   *
   * Authorization required: none
   */
  
  router.get("/:title", async function (req, res, next) {
    try {
      const job = await Job.get(req.params.title);
      return res.json({ job });
    } catch (err) {
      return next(err);
    }
  });
  
  /** PATCH /[title] { title, salary, equity, company_handle } => { job }
   * 
   * ALL fields are optional.
   *
   * Patches company data.
   *
   * fields can be: { title, salary, equity, company_handle }
   *
   * Returns { title, salary, equity, company_handle }
   *
   * Authorization required: login AND admin priviledges
   */
  
  router.patch("/:title", ensureLoggedInAndIsAdmin, async function (req, res, next) {
    try {
      const validator = jsonschema.validate(req.body, jobUpdateSchema);
      if (!validator.valid) {
        const errs = validator.errors.map(e => e.stack);
        throw new BadRequestError(errs);
      }
  
      const job = await Job.update(req.params.title, req.body);
      return res.json({ job });
    } catch (err) {
      return next(err);
    }
  });
  
  /** DELETE /[title]  =>  { deleted: title }
   *
   * Authorization: login AND admin priviledges
   */
  
  router.delete("/:handle", ensureLoggedInAndIsAdmin, async function (req, res, next) {
    try {
      await Job.remove(req.params.title);
      return res.json({ deleted: req.params.title });
    } catch (err) {
      return next(err);
    }
  });
  
  
  module.exports = router;