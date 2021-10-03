const { BadRequestError } = require("../expressError");

/** 
 * dataToUpdate: an object containing the data that a user wishes to update,
 *                Ex: { "email": "me@gmail.com", "password": "cookie" }
 *  
 * jsToSql: an object that contains the SQL column names that align with the JS
 *          request body that gets passed in the request. Ex: in the request body
 *          and on the User class, we are looking for "firstName", but in the "users"
 *          SQL table, the data is stored in a column called "first_name". 
 * 
 * returns: an object with two attributes:
 *            setCols: a string along the lines of "first_name = $1, last_name = $2",
 *                     that is used to protect against SQL injections
 *            
 *            values: All of the values that were supplied in the request body that the 
 *                    user wishes to be updated.
 * 
 * usage: used in the "User" and "Company" models to update values in the database. The "update"
 *        methods are then called in PATCH routes that are used to update user or company data.
*/


function sqlForPartialUpdate(dataToUpdate, jsToSql) {
  const keys = Object.keys(dataToUpdate);
  if (keys.length === 0) throw new BadRequestError("No data");

  // {firstName: 'Aliya', age: 32} => ['"first_name"=$1', '"age"=$2']
  const cols = keys.map((colName, idx) =>
      // if the column name is in the "jsToSql" object (first_name, last_name, is_admin),
      // use that. Otherwise, use the next column name in "keys".
      `"${jsToSql[colName] || colName}"=$${idx + 1}`,
  );

  return {
    setCols: cols.join(", "),
    values: Object.values(dataToUpdate),
  };
}

module.exports = { sqlForPartialUpdate };
