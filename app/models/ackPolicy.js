const db = require('../utilities/db');
const User = require('./user'); 

function AckPolicy(eId, acknowledged, policyId, deleted){
  this.eId = eId; 
  this.acknowledged = acknowledged; 
  this.policyId = policyId; 
  this.deleted = deleted;
}

/**
 * Creates 'ack_policy' entries for the employees that need 
 * to acknowledge a policy. 
 */
AckPolicy.newPolicy = function(policyId, employees, conn){
  return new Promise((resolve, reject) => {
    //if there are no employees
    if(employees.length == 0){
      resolve({success: "Successfully created acknowledgements for policy for all relevant users."}); 
    }
    var count = 0; 
    for(emp in employees) {
      conn.query("INSERT INTO ack_policy(eID, ack, policyID, deleted) " + 
      "VALUES(?, ?, ?, ?);", [employees[emp].eId, 0, policyId, 0], function(error, results){
        count++; 
        if(error) {
          error.errMsg = "There was an error inserting this record into the database. Please try again.";
          reject(error); 
        } else{
          //reaches end of list so it resolved successfully
          if(count == employees.length){
            resolve({success: "Successfully created acknowledgements for policy for all relevant users."}); 
          }
        }
      });
    }
  });
}

/**
 * Creates policyAcks for an employee given a list of policyIds, and the employee's eID.
 */
AckPolicy.createForEmployee = function(policyIds, eId, conn){
  return new Promise((resolve, reject) => {
    //if there are no policies
    if(policyIds.length == 0){
      resolve({success: "Successfully created acknowledgements for employee for all relevant policies."}); 
    }
    var count = 0; 
    for(i in policyIds) {
      conn.query("INSERT INTO ack_policy(eID, ack, policyID, deleted) " + 
      "VALUES(?, ?, ?, ?) ON DUPLICATE KEY UPDATE deleted=0;", [eId, 0, policyIds[i].policyID, 0], function(error, results){
        count++; 
        if(error) {
          error.errMsg = "There was an error inserting this record into the database. Please try again.";
          reject(error); 
        } else{
          //reaches end of list so it resolved successfully
          if(count == policyIds.length){
            resolve({success: "Successfully created acknowledgements for employee for all relevant policies."}); 
          }
        }
      });
    }
  });
}

// AckPolicy.deleteForEmployee = function(policyIds, eId, conn){
//   return new Promise((resolve, reject) => {
//     //if there are no policies
//     if(policyIds.length == 0){
//       resolve({success: "Successfully deleted acknowledgements for employee for all relevant policies."}); 
//     }
//     var count = 0; 
//     for(i in policyIds) {
//       conn.query("UPDATE ack_policy deleted=1 WHERE (eID = ?) AND (policyID = ?);", [eId, policyIds[i].policyID], function(error, results){
//         count++; 
//         if(error) {
//           error.errMsg = "There was an error inserting this record into the database. Please try again.";
//           reject(error); 
//         } else{
//           //reaches end of list so it resolved successfully
//           if(count == policyIds.length){
//             resolve({success: "Successfully deleted acknowledgements for employee for all relevant policies."}); 
//           }
//         }
//       });
//     }
//   });
// }

/**
 * Deletes all policyAcks for the given employee.
 */
AckPolicy.deleteAllForEmployee = function(eId, conn){
  return new Promise((resolve, reject) => {
    conn.query("UPDATE ack_policy SET deleted=1 WHERE (eID = ?);", [eId], function(error, results){
      if(error) {
        error.errMsg = "There was an error deleting policies the database. Please try again.";
        reject(error); 
      } 
      resolve(results); 
    });
  });
}

/**
 * Restores all policyAcks for the given employee. 
 */
AckPolicy.restoreAllForEmployee = function(eId, conn){
  return new Promise((resolve, reject) => {
    conn.query("UPDATE ack_policy SET deleted=0 WHERE (eID = ?);", [eId], function(error, results){
      if(error) {
        error.errMsg = "There was an error restoring policies the database. Please try again.";
        reject(error); 
      } 
      resolve(results); 
    });
  });
}

/**
 * Unacknowledges a policy for all employees. 
 */
AckPolicy.unackPolicy = function(policyId, conn){
  return new Promise((resolve, reject) => {
    conn.query("UPDATE ack_policy SET ack=0 WHERE (policyID = ?);", [policyId], function(error, results) {
      if(error) {
        error.errMsg = "There was an error unacknowledging policies. Please try again.";
        reject(error);
      }
      resolve(results);
    });
  });
}

/**
 * Soft-deletes 'ack_policy' entries when it's corresponding policy has been deleted. 
 */
AckPolicy.deletePolicies = function(policyId, conn) {
  return new Promise((resolve, reject) => {
    conn.query("UPDATE ack_policy SET deleted=1 WHERE (policyID=?);", [policyId], function(error, results){
      if(error){
        error.errMsg = "Error soft deleting policy acknowledgements."; 
        reject(error);
      }
      resolve(results); 
    })
  });
}

/**
 * Returns a list of policyIds for policies that a employee needs to acknowledge/has acknowledged. 
 */
AckPolicy.getPolicyIds = function(eId, ack, conn) {
  return new Promise((resolve, reject) => {
    conn.query("SELECT policyID FROM ack_policy WHERE (eID = ?) AND (ack = ?) AND (deleted = 0);", 
    [eId, ack], function(error, results){
      if(error){
        error.errMsg = "There was an error getting this information from the database. Please try again."; 
        reject(error); 
      } else{
        var policyIds = []; 
        for(r in results){
          policyIds.push(results[r].policyID);
        }
        resolve(policyIds); 
      }
    })
  }); 
}

/**
 * Sets the 'ack' field to 1, denoting that the user has acknowledged a policy.
 */
AckPolicy.acknowledgePolicy = function(eId, policyId){
  return new Promise((resolve, reject) => {
    db.query("UPDATE ack_policy SET ack=1 WHERE (eID = ?) AND (policyID = ?);", [eId, policyId], function(error, results){
      if(error){
        error.errMsg = "Error acknowledging the policy in the database."; 
        reject(error); 
      }
      resolve(results); 
    });
  });
}

/**
 * Given a list of departments that are relevant to a policy, and the policyId, this 
 * function generates/updates entries in the ack_policy table for every employee in 
 * the departments. 
 */
AckPolicy.makeDeptsRelevant = function(relevantDepts, policyId, conn) {
  return new Promise((resolve, reject) => {
    //get list of users from these depts
    var employees = []; 
    User.findAllInDepts(relevantDepts, conn).then(success => {
      employees = success; 
      var count = 0; 
      //perform an insertion/update for each employee
      for(e in employees){
        conn.query("INSERT INTO ack_policy (eID, ack, policyID, deleted) VALUES (?, ?, ?, ?) ON DUPLICATE KEY " + 
          "UPDATE deleted = 0;", [employees[e].eId, 0, policyId, 0, 
          employees[e].eId, policyId], function(error, results){
            if(error){
              error.errMsg = "Error performing insertion/update in makeDeptsRelevant()"; 
              reject(error); 
            }
            count++; 
            if(count == employees.length){
              resolve("Successfully inserted/updated ack_policy entries to make depts relevant.");
            }
          });
      }
    }, error => {
      reject(error); 
    });
  });
}

/**
 * Given a list of departments that are no longer relevant to a policy, and the policyID, 
 * this function updates existing 'ack_policy' entries for employees in the departments to 
 * be soft-deleted. 
 */
AckPolicy.makeDeptsIrrelevant = function(irrelevantDepts, policyId, conn) {
  return new Promise((resolve, reject) => {
    //get list of users from these depts
    var employees = []; 
    User.findAllInDepts(irrelevantDepts, conn).then(success => {
      employees = success; 
      if(employees.length == 0){
        resolve("Successfully updated ack_policy entries to make depts irrelevant.");
      }
      var count = 0; 
      //perform an update for each employee that sets 'deleted' to 1
      for(e in employees){
        conn.query("UPDATE ack_policy SET deleted=1 WHERE (eID = ?) AND (policyID = ?);", [employees[e].eId, policyId], 
          function(error, results){
            if(error){
              error.errMsg = "Error performing update in makeDeptsIrrelevant()"; 
              reject(error); 
            }
            count++; 
            if(count == employees.length){
              resolve("Successfully updated ack_policy entries to make depts irrelevant.");
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
AckPolicy.getAckNeeded = function(policies, conn){
  return new Promise((resolve, reject) => {
    if(policies.length == 0){
      resolve([]); 
    }
    var count = 0; 
    policies.forEach(function(policy){
      conn.query("SELECT COUNT(eID) AS emps FROM ack_policy WHERE (policyID=?) AND (deleted=0);", [policy.policyID], function(error, results){
        if(error){
          error.errMsg = "Failed to set total acknowlegements needed for " + policy.policyId; 
          reject(error); 
        }
        policy.total = results[0].emps; 
        count++; 
        if(count == policies.length){
          resolve(policies); 
        }
      });
    }); 
  });
}

/**
 * Gets the number of employees that have acknowledged the policies. 
 */
AckPolicy.getAckCompleted = function(policies, conn){
  return new Promise((resolve, reject) => {
    if(policies.length == 0){
      resolve([]); 
    }
    var count = 0; 
    policies.forEach(function(policy){
      conn.query("SELECT COUNT(eID) AS acks FROM ack_policy WHERE (policyID=?) AND (ack=1) AND (deleted=0);", [policy.policyID], function(error, results){
        if(error){
          error.errMsg = "Failed to set total acknowlegements needed for " + policy.policyId; 
          reject(error); 
        }
        policy.acks = results[0].acks; 
        count++; 
        if(count == policies.length){
          resolve(policies); 
        }
      });
    }); 
  });
}

/**
 * Get the list of employees that still need to acknowledge a policy. 
 */
AckPolicy.getUnackEmployees = function(policyId, conn) {
  return new Promise((resolve, reject) => {
    conn.query("SELECT eID from ack_policy WHERE (policyID = ?) AND (deleted=0) AND (ack=0);", [policyId], function(error, results){
      if(error){
        error.errMsg = "Failed to get eIds for policy #" + policy.policyId; 
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

module.exports = AckPolicy; 