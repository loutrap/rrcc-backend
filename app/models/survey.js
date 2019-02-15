const db = require('../utilities/db');

function Survey(id, title, description, url, date){
  this.id = id; 
  this.title = title; 
  this.description = description; 
  this.url = url; 
  this.date = date; 
}

/**
 * Creates a new entry in the 'survey' table. 
 */
Survey.create = function(title, description, url, depts, conn){
  return new Promise((resolve, reject) => {
    var deptParams = getDeptParams(depts); 
    var createDate = new Date(Date.now()); 
    createDate = createDate.toISOString().slice(0,10); 

    conn.query('INSERT INTO survey(title, description, url, date, deptSales, deptGarage, deptAdmin, deptFoodBeverage, ' + 
    'deptProduction, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0);', [title, description, url, createDate, deptParams[0].relevant, 
    deptParams[1].relevant, deptParams[2].relevant, deptParams[3].relevant, deptParams[4].relevant], 
    function(error, results){
      if (error) {
        error.errMsg = "There was an error inserting this record into the database. Please try again."; 
        reject(error);
      }
      resolve(results); 
    });
  });
}

/**
 * Generates an array of departments with the 'id' and 'relevant' field.
 * The 'relevant' field will be assigned a 0/1 value depending on if the dept
 * is a part of the depts parameter. 
 * dept parameter. 
 * @param {[Department]} depts 
 */
function getDeptParams(depts){
  var deptParams = [];
  for(var i = 1; i < 6; i++){
    deptParams.push({id: i, relevant: 0});
  }
  
  for(dept in depts) {
    var id = depts[dept].id; 
    switch(id) {
      case 1: 
        deptParams[0].relevant = 1; 
        break; 
      case 2: 
        deptParams[1].relevant = 1; 
        break; 
      case 3: 
        deptParams[2].relevant = 1; 
        break; 
      case 4: 
        deptParams[3].relevant = 1; 
        break; 
      case 5: 
        deptParams[4].relevant = 1; 
        break; 
    }
  }

  return deptParams; 
}

/**
 * Updates an existing survey entry. 
 */
Survey.update = function(surveyId, title, description, url, depts, conn) {
  return new Promise((resolve, reject) => {
    //generate the query based on which values are not null
    var query = "UPDATE survey SET ";
    var params = []; 
    query = addToQuery(title, "title", query, params); 
    query = addToQuery(description, "description", query, params); 
    query = addToQuery(url, "url", query, params); 
    var deptParams = [];
    if(depts !== null) {
      deptParams = getDeptParams(depts); 
      query = addToQuery(deptParams[0].relevant, "deptSales", query, params); 
      query = addToQuery(deptParams[1].relevant, "deptGarage", query, params); 
      query = addToQuery(deptParams[2].relevant, "deptAdmin", query, params); 
      query = addToQuery(deptParams[3].relevant, "deptFoodBeverage", query, params); 
      query = addToQuery(deptParams[4].relevant, "deptProduction", query, params); 
    }
    query = query.slice(0, query.length-1); 
    query += " WHERE (surveyID = ?);";
    params.push(surveyId); 

    //query the database
    conn.query(query, params, function(error, results){
      if(error){
        error.errMsg = "Error updating the survey in the database."; 
        reject(error); 
      } 
      resolve(deptParams); 
    });
  }); 
}

/**
 * Helper function that adds to a query.
 * @param {*} param - param that is being added to the query
 * @param {*} strAdd - the string representation of the param
 * @param {*} query - existing query
 * @param {*} params - List of params that will be inserting into the query at runtime
 */
function addToQuery(param, strAdd, query, params){
  if(param !== null){
    query += strAdd + " = ?,"; 
    params.push(param); 
  }
  return query; 
}

Survey.delete = function(surveyId, conn){
  return new Promise((resolve, reject) => {
    conn.query("UPDATE survey SET deleted=1 WHERE (surveyID=?);", [surveyId], function(error, results){
      if(error){
        error.errMsg = "Error soft deleting this survey."; 
        reject(error); 
      } 
      resolve(results); 
    });
  });
}

/**
 * Gets a list of surveys based on the surveyIds provided. 
 */
Survey.getSurveysByIds = function(surveyIds, conn) {
  return new Promise((resolve, reject) => {
    //if there are no surveyIds return an empty array
    if(surveyIds.length == 0){
      resolve([]); 
    }

    var where = "("; 
    var params = [];
    for(i in surveyIds){
      params.push(surveyIds[i]);
      where += "?,"; 
    }
    where = where.slice(0, where.length-1) + ")"; 

    conn.query("SELECT * FROM survey WHERE (surveyID IN " + where + ") AND (deleted = 0) ORDER BY date, title;", params, function(error, results){
      if(error){
        error.errMsg = "There was an error getting this information from the database. Please try again."; 
        reject(error); 
      } 
      resolve(results); 
    });
  });
}

/**
 * Get a list of survey ids based on the department id provided
 */
Survey.getSurveyIdsByDept = function(deptId, conn){
  return new Promise((resolve, reject) => {
    //generate query condition
    var condition = ""; 
    switch(deptId){
      case 1: 
        condition = "(deptSales = 1);"
        break; 
      case 2: 
        condition = "(deptGarage = 1);"
        break; 
      case 3: 
        condition = "(deptAdmin = 1);"
        break; 
      case 4: 
        condition = "(deptFoodBeverage = 1);"
        break; 
      case 5: 
        condition = "(deptProduction = 1);"
        break; 
    }

    conn.query("SELECT surveyID FROM survey WHERE (deleted=0) AND " + condition, [], function(error, results){
      if(error){
        error.errMsg = "There was an error getting surveys based on deptId from the database. Please try again."; 
        reject(error); 
      } 
      resolve(results); 
    })
  });
}

/**
 * Gets all surveys from the 'survey' table that haven't been deleted. 
 */
Survey.getAllSurveys = function(conn){
  return new Promise((resolve, reject) => {
    conn.query("SELECT * FROM survey WHERE (deleted = 0);", [], function(error, results){
      if(error){
        error.errMsg = "There was an error getting all surveys from the database. Please try again."; 
        reject(error); 
      }
      resolve(results); 
    });
  })
}

module.exports = Survey; 