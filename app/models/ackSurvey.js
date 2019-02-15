const db = require('../utilities/db');
const User = require('./user'); 

function AckSurvey(eId, acknowledged, surveyId, deleted){
  this.eId = eId; 
  this.acknowledged = acknowledged; 
  this.surveyId = surveyId; 
  this.deleted = deleted;
}

/**
 * Creates 'ack_survey' entries for the employees that need 
 * to acknowledge a survey. 
 */
AckSurvey.newSurvey = function(surveyId, employees, conn){
  return new Promise((resolve, reject) => {
    //if there are no employees
    if(employees.length == 0){
      resolve({success: "Successfully created acknowledgements for survey for all relevant users."}); 
    }
    var count = 0; 
    for(emp in employees) {
      conn.query("INSERT INTO ack_survey(eID, ack, surveyID, deleted) " + 
      "VALUES(?, ?, ?, ?);", [employees[emp].eId, 0, surveyId, 0], function(error, results){
        count++; 
        if(error) {
          error.errMsg = "There was an error inserting this record into the database. Please try again.";
          reject(error); 
        } else{
          //reaches end of list so it resolved successfully
          if(count == employees.length){
            resolve({success: "Successfully created acknowledgements for survey for all relevant users."}); 
          }
        }
      });
    }
  });
}

/**
 * Creates surveyAcks for an employee given a list of surveyIds, and the employee's eID.
 */
AckSurvey.createForEmployee = function(surveyIds, eId, conn){
  return new Promise((resolve, reject) => {
    //if there are no surveys
    if(surveyIds.length == 0){
      resolve({success: "Successfully created acknowledgements for employee for all relevant surveys."}); 
    }
    var count = 0; 
    for(i in surveyIds) {
      conn.query("INSERT INTO ack_survey(eID, ack, surveyID, deleted) " + 
      "VALUES(?, ?, ?, ?) ON DUPLICATE KEY UPDATE deleted=0;", [eId, 0, surveyIds[i].surveyID, 0], function(error, results){
        count++; 
        if(error) {
          error.errMsg = "There was an error inserting this record into the database. Please try again.";
          reject(error); 
        } else{
          //reaches end of list so it resolved successfully
          if(count == surveyIds.length){
            resolve({success: "Successfully created acknowledgements for employee for all relevant surveys."}); 
          }
        }
      });
    }
  });
}

// AckSurvey.deleteForEmployee = function(surveyIds, eId, conn){
//   return new Promise((resolve, reject) => {
//     //if there are no surveys
//     if(surveyIds.length == 0){
//       resolve({success: "Successfully deleted acknowledgements for employee for all relevant surveys."}); 
//     }
//     var count = 0; 
//     for(i in surveyIds) {
//       conn.query("UPDATE ack_survey deleted=1 WHERE (eID = ?) AND (surveyID = ?);", [eId, surveyIds[i].surveyID], function(error, results){
//         count++; 
//         if(error) {
//           error.errMsg = "There was an error inserting this record into the database. Please try again.";
//           reject(error); 
//         } else{
//           //reaches end of list so it resolved successfully
//           if(count == surveyIds.length){
//             resolve({success: "Successfully deleted acknowledgements for employee for all relevant surveys."}); 
//           }
//         }
//       });
//     }
//   });
// }

/**
 * Deletes all surveyAcks for the given employee.
 */
AckSurvey.deleteAllForEmployee = function(eId, conn){
  return new Promise((resolve, reject) => {
    conn.query("UPDATE ack_survey SET deleted=1 WHERE (eID = ?);", [eId], function(error, results){
      if(error) {
        error.errMsg = "There was an error deleting surveys the database. Please try again.";
        reject(error); 
      } 
      resolve(results); 
    });
  });
}

/**
 * Restores all surveyAcks for the given employee. 
 */
AckSurvey.restoreAllForEmployee = function(eId, conn){
  return new Promise((resolve, reject) => {
    conn.query("UPDATE ack_survey SET deleted=0 WHERE (eID = ?);", [eId], function(error, results){
      if(error) {
        error.errMsg = "There was an error deleting surveys the database. Please try again.";
        reject(error); 
      } 
      resolve(results); 
    });
  });
}

/**
 * Unacknowledges a survey for all employees. 
 */
AckSurvey.unackSurvey = function(surveyId, conn){
  return new Promise((resolve, reject) => {
    conn.query("UPDATE ack_survey SET ack=0 WHERE (surveyID = ?);", [surveyId], function(error, results) {
      if(error) {
        error.errMsg = "There was an error unacknowledging surveys. Please try again.";
        reject(error);
      }
      resolve(results);
    });
  });
}

/**
 * Soft-deletes 'ack_survey' entries when it's corresponding survey has been deleted. 
 */
AckSurvey.deleteSurveys = function(surveyId, conn) {
  return new Promise((resolve, reject) => {
    conn.query("UPDATE ack_survey SET deleted=1 WHERE (surveyID=?);", [surveyId], function(error, results){
      if(error){
        error.errMsg = "Error soft deleting survey acknowledgements."; 
        reject(error);
      }
      resolve(results); 
    })
  });
}

/**
 * Returns a list of surveyIds for surveys that a employee needs to acknowledge/has acknowledged. 
 */
AckSurvey.getSurveyIds = function(eId, ack, conn) {
  return new Promise((resolve, reject) => {
    conn.query("SELECT surveyID FROM ack_survey WHERE (eID = ?) AND (ack = ?) AND (deleted = 0);", 
    [eId, ack], function(error, results){
      if(error){
        error.errMsg = "There was an error getting this information from the database. Please try again."; 
        reject(error); 
      } else{
        var surveyIds = []; 
        for(r in results){
          surveyIds.push(results[r].surveyID);
        }
        resolve(surveyIds); 
      }
    })
  }); 
}

/**
 * Sets the 'ack' field to 1, denoting that the user has acknowledged a survey.
 */
AckSurvey.acknowledgeSurvey = function(eId, surveyId){
  return new Promise((resolve, reject) => {
    db.query("UPDATE ack_survey SET ack=1 WHERE (eID = ?) AND (surveyID = ?);", [eId, surveyId], function(error, results){
      if(error){
        error.errMsg = "Error acknowledging the survey in the database."; 
        reject(error); 
      }
      resolve(results); 
    });
  });
}

/**
 * Given a list of departments that are relevant to a survey, and the surveyId, this 
 * function generates/updates entries in the ack_survey table for every employee in 
 * the departments. 
 */
AckSurvey.makeDeptsRelevant = function(relevantDepts, surveyId, conn) {
  return new Promise((resolve, reject) => {
    //get list of users from these depts
    var employees = []; 
    User.findAllInDepts(relevantDepts, conn).then(success => {
      employees = success; 
      var count = 0; 
      //perform an insertion/update for each employee
      for(e in employees){
        conn.query("INSERT INTO ack_survey (eID, ack, surveyID, deleted) VALUES (?, ?, ?, ?) ON DUPLICATE KEY " + 
          "UPDATE deleted = 0;", [employees[e].eId, 0, surveyId, 0, 
          employees[e].eId, surveyId], function(error, results){
            if(error){
              error.errMsg = "Error performing insertion/update in makeDeptsRelevant()"; 
              reject(error); 
            }
            count++; 
            if(count == employees.length){
              resolve("Successfully inserted/updated ack_survey entries to make depts relevant.");
            }
          });
      }
    }, error => {
      reject(error); 
    });
  });
}

/**
 * Given a list of departments that are no longer relevant to a survey, and the surveyID, 
 * this function updates existing 'ack_survey' entries for employees in the departments to 
 * be soft-deleted. 
 */
AckSurvey.makeDeptsIrrelevant = function(irrelevantDepts, surveyId, conn) {
  return new Promise((resolve, reject) => {
    //get list of users from these depts
    var employees = []; 
    User.findAllInDepts(irrelevantDepts, conn).then(success => {
      employees = success; 
      if(employees.length == 0){
        resolve("Successfully updated ack_survey entries to make depts irrelevant.");
      }
      var count = 0; 
      //perform an update for each employee that sets 'deleted' to 1
      for(e in employees){
        conn.query("UPDATE ack_survey SET deleted=1 WHERE (eID = ?) AND (surveyID = ?);", [employees[e].eId, surveyId], 
          function(error, results){
            if(error){
              error.errMsg = "Error performing update in makeDeptsIrrelevant()"; 
              reject(error); 
            }
            count++; 
            if(count == employees.length){
              resolve("Successfully updated ack_survey entries to make depts irrelevant.");
            }
          }); 
      }
    }, error => {
      error.errMsg = "Error"; 
      reject(error); 
    });
  });
}

/**
 * Gets the number of acknowledgements that are still needed for each survey.
 */
AckSurvey.getAckNeeded = function(surveys, conn){
  return new Promise((resolve, reject) => {
    if(surveys.length == 0){
      resolve([]); 
    }
    var count = 0; 
    surveys.forEach(function(survey){
      conn.query("SELECT COUNT(eID) AS emps FROM ack_survey WHERE (surveyID=?) AND (deleted=0);", [survey.surveyID], function(error, results){
        if(error){
          error.errMsg = "Failed to set total acknowlegements needed for " + survey.surveyId; 
          reject(error); 
        }
        survey.total = results[0].emps; 
        count++; 
        if(count == surveys.length){
          resolve(surveys); 
        }
      });
    }); 
  });
}

/**
 * Gets the number of employees that have acknowledged the surveys. 
 */
AckSurvey.getAckCompleted = function(surveys, conn){
  return new Promise((resolve, reject) => {
    if(surveys.length == 0){
      resolve([]); 
    }
    var count = 0; 
    surveys.forEach(function(survey){
      conn.query("SELECT COUNT(eID) AS acks FROM ack_survey WHERE (surveyID=?) AND (ack=1) AND (deleted=0);", [survey.surveyID], function(error, results){
        if(error){
          error.errMsg = "Failed to set total acknowlegements needed for " + survey.surveyId; 
          reject(error); 
        }
        survey.acks = results[0].acks; 
        count++; 
        if(count == surveys.length){
          resolve(surveys); 
        }
      });
    }); 
  });
}

/**
 * Get the list of employees that still need to acknowledge a survey. 
 */
AckSurvey.getUnackEmployees = function(surveyId, conn) {
  return new Promise((resolve, reject) => {
    conn.query("SELECT eID from ack_survey WHERE (surveyID = ?) AND (deleted=0) AND (ack=0);", [surveyId], function(error, results){
      if(error){
        error.errMsg = "Failed to get eIds for survey #" + survey.surveyId; 
        reject(error); 
      }
      var eIds = [];
      results.forEach(function(eId){
        eIds.push(eId.eID); 
      })
      resolve(eIds); 
    });
  }); 
}

module.exports = AckSurvey; 