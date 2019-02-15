const db = require('../utilities/db');
const bcrypt = require('bcrypt-nodejs'); 
const pwdGen = require('generate-password'); 
'use strict';
const nodemailer = require('nodemailer');
const { google } = require("googleapis");
const OAuth2 = google.auth.OAuth2;

function User(eId, fname, lname, email, phone, department, usertype, password){
  this.eId = eId; 
  this.fname = fname; 
  this.lname = lname; 
  this.email = email; 
  this.phone = phone; 
  this.department = department; 
  this.usertype = usertype; 
  this.password = password;

  //checks if the password matches the value stored in the db
  this.validPassword = function(password){
    var valid = bcrypt.compareSync(password, this.password);
    return valid; 
  }
}

/**
 * Creates a new user entry in the database.
 * @param {User} user 
 */
User.create = function(user, conn){
  return new Promise((resolve, reject) => {
    //encrypts the password
    user.password = bcrypt.hashSync(user.password, bcrypt.genSaltSync(8));

    conn.query('INSERT INTO employee(fname, lname, email, phone, departmentID, usertypeID, password, status) ' + 
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
      [user.fname, user.lname, user.email, user.phone, user.department? user.department.id : null, 3, user.password, 1], 
      function(error, results, fields){
        if(error){
          error.errMsg = "There was an error inserting this record into the database. Please try again."; 
          reject(error); 
        }
        resolve(results);
      }
    );
  });
}

/**
 * Gets a list of all active users that are in the specified departments and are active employees. 
 * @param {*} departments 
 */
User.findAllActiveInDepts = function(departments, conn){
  return new Promise((resolve, reject) => {
    //if the depts is an empty array
    if(departments.length == 0){
      resolve([]); 
    }

    //generate array of department ids
    var params = []; 
    var where = "("; 
    for(dept in departments){
      where += "?,"; 
      params.push(departments[dept].id); 
    }
    where = where.slice(0, where.length-1) + ")"; 

    //status value
    params.push(1); 
    conn.query("SELECT emp.eID, emp.fname, emp.lname, emp.email, emp.phone, dept.departmentID, dept.department, " +  
      "role.usertypeID, role.usertype, emp.status FROM employee AS emp JOIN " + 
      "department AS dept ON (emp.departmentID = dept.departmentID) JOIN " + 
      "usertype AS role ON (emp.usertypeID = role.usertypeID) WHERE " + 
      "(dept.departmentID IN " + where + ") " +
      "AND (emp.status = ?);", params, function(error, results, fields){
      if(error){
        error.errMsg = "Can't get list of users in this department"; 
        reject(error); 
      }
      var users = []; 
      for(r in results){
        var temp = results[r]; 
        users.push({eId: temp.eID, fname: temp.fname, lname: temp.lname, email: temp.email, phone: temp.phone, 
          department: {id: temp.departmentID, name: temp.department}, 
          usertype: {id: temp.usertypeID, name: temp.usertype}}); 
      }
      resolve(users); 
    });
  });
}

/**
 * Gets a list of all users that are in the specified departments and are active employees. 
 * @param {*} departments 
 */
User.findAllInDepts = function(departments, conn){
  return new Promise((resolve, reject) => {
    //if the depts is an empty array
    if(departments.length == 0){
      resolve([]); 
    }

    //generate array of department ids
    var params = []; 
    var where = "("; 
    for(dept in departments){
      where += "?,"; 
      params.push(departments[dept].id); 
    }
    where = where.slice(0, where.length-1) + ")"; 

    //status value
    params.push(1); 
    conn.query("SELECT emp.eID, emp.fname, emp.lname, emp.email, emp.phone, dept.departmentID, dept.department, " +  
      "role.usertypeID, role.usertype, emp.status FROM employee AS emp JOIN " + 
      "department AS dept ON (emp.departmentID = dept.departmentID) JOIN " + 
      "usertype AS role ON (emp.usertypeID = role.usertypeID) WHERE " + 
      "(dept.departmentID IN " + where + ");", params, function(error, results, fields){
      if(error){
        error.errMsg = "Can't get list of users in this department"; 
        reject(error); 
      }
      var users = []; 
      for(r in results){
        var temp = results[r]; 
        users.push({eId: temp.eID, fname: temp.fname, lname: temp.lname, email: temp.email, phone: temp.phone, 
          department: {id: temp.departmentID, name: temp.department}, 
          usertype: {id: temp.usertypeID, name: temp.usertype}}); 
      }
      resolve(users); 
    });
  });
}

/**
 * Gets a list of the phone numbers of all the users that are in the specified departments 
 * and are active employees. 
 * @param {*} departments 
 */
User.findPhonesInDepts = function(departments){
  //generate array of department ids
  var params = []; 
  var where = "("; 
  for(dept in departments){
    where += "?,"; 
    params.push(departments[dept].id); 
  }
  where = where.slice(0, where.length-1) + ")"; 
  
  //status value
  params.push(1); 

  return new Promise((resolve, reject) => {
    db.query("SELECT phone FROM employee WHERE " + 
      "(departmentID IN " + where + ") " +
      "AND (status = ?);", params, function(error, results, fields){
      if(error){
        error.errMsg = "Can't get list of users in this department"; 
        reject(error); 
      }
      var phoneArray = []; 
      for(r in results){
        phoneArray.push(results[r].phone);
      }
      resolve(phoneArray);
    });
  });
}

/**
 * Takes in a user object and searches the employee table for a match. Used specifically for login auth.
 * @param {User} user 
 * @param {*} callback 
 */
User.findOneForLogin = function(user, callback){
  var userData; 
  new Promise((resolve, reject) => {
    db.query(`SELECT emp.eID, emp.fname, emp.lname, emp.email, emp.phone, dept.departmentID, dept.department, 
      role.usertypeID, role.usertype, emp.password FROM employee AS emp JOIN 
      department AS dept ON (emp.departmentID = dept.departmentID) JOIN 
      usertype AS role ON (emp.usertypeID = role.usertypeID)
      WHERE (email = ?) AND (status= ?);`, [user.email, 1], function(error, results, fields){
      if(error){
        reject(error); 
      }
      if(results == undefined || results == null || results.length == 0){
        resolve(false);
      } else{
        userData = results[0];
        resolve(true); 
      }
    })
  }).then(success => {
    if(success){
      callback(null, new User(userData.eID, userData.fname, userData.lname, userData.email, userData.phone,
        {id: userData.departmentID, name: userData.department}, 
        {id: userData.usertypeID, name: userData.usertype}, userData.password));
    }
    else {
      callback(null, false); 
    }
  }, err => {
    callback(err, null);
  });
}

/**
 * Finds one employee based on their eID.
 */
User.findOne = function(id, conn){
  return new Promise((resolve, reject) => {
    conn.query(`SELECT emp.eID, emp.fname, emp.lname, emp.email, emp.phone, dept.departmentID, dept.department, 
    role.usertypeID, role.usertype, emp.status FROM employee AS emp JOIN 
    department AS dept ON (emp.departmentID = dept.departmentID) JOIN 
    usertype AS role ON (emp.usertypeID = role.usertypeID)
    WHERE (eID = ?);`, [id], function(error, results){
      if(error){
        reject(error); 
      }
      resolve(results); 
    });
  });
}

/**
 * Finds all the users listed in the csv file that aren't in the database. If the user is in the database, then 
 * their status is set to active automatically. 
 */
User.findAllNotInDb = function(csvData, conn) {
  return new Promise((resolve, reject) => {
    if(csvData.length == 0){
      resolve([]); 
    }
    var count = 0; 
    var notInDb = [];
    csvData.forEach(function(csvRow){
      var email = csvRow['Personal eMail'];
      var phone = csvRow['Home Cell'];
      conn.query("SELECT * from employee WHERE (email=?) AND (phone=?);", 
      [email, phone], function(error, results) {
        if(error){
          error.errMsg = "Error occurred in User.findAllNotInDb"; 
          reject(error); 
        } 
        else{
          //user was found in db
          if(results.length !== 0){
            var iEmail = results[0].email; 
            var iPhone = results[0].phone; 
            conn.query("UPDATE employee SET status=1 WHERE (email=?) AND (phone=?);", [iEmail, iPhone], function(error, results){
              if(error) {
                error.errMsg = "Error occurred in User.findAllInDb";
                reject(error); 
              }
              count++;
              if(count == csvData.length) {
                resolve(notInDb); 
              }
            });
          } 
          //user wasn't found in db
          else{
            notInDb.push(csvRow);
            count++; 
            if(count == csvData.length){
              resolve(notInDb); 
            }
          }
        }
      });
    }); 
  }); 
}

/**
 * Finds all users that are in our database that weren't listed in the csv file. 
 */
User.findAllNotInCsv = function(emails, phones, conn) {
  return new Promise((resolve, reject) => {
    if(emails.length == 0 || phones.length == 0){
      resolve([]); 
    }
    conn.query("SELECT emp.eID, emp.fname, emp.lname, emp.email, emp.phone, dept.departmentID, dept.department, " +  
    "role.usertypeID, role.usertype FROM employee AS emp JOIN " + 
    "department AS dept ON (emp.departmentID = dept.departmentID) JOIN " + 
    "usertype AS role ON (emp.usertypeID = role.usertypeID) WHERE (emp.email NOT IN (?)) AND (emp.phone NOT IN (?));", 
    [emails, phones], function(error, results) {
      if(error){
        error.errMsg = "Error occurred in User.findAllNotInCsv"; 
        reject(error); 
      }
      resolve(results); 
    })
  });
}

/**
 * Gets employees given a list of eIDs.
 */
User.getEmployeesByIds = function(eIds, conn){
  return new Promise((resolve, reject) => {
    //if there are no policyIds return an empty array
    if(eIds.length == 0){
      resolve([]); 
    }

    var where = "("; 
    var params = [];
    for(i in eIds){
      params.push(eIds[i]);
      where += "?,"; 
    }
    where = where.slice(0, where.length-1) + ")"; 
    conn.query("SELECT emp.eID, emp.fname, emp.lname, emp.email, emp.phone, dept.departmentID, dept.department, " +  
      "role.usertypeID, role.usertype FROM employee AS emp JOIN " + 
      "department AS dept ON (emp.departmentID = dept.departmentID) JOIN " + 
      "usertype AS role ON (emp.usertypeID = role.usertypeID) WHERE (eID IN " + where + ") AND (status=1);", params, 
      function(error, results){
      if(error){
        error.errMsg = "Error occurred in User.getEmployeesByIds"; 
        reject(error); 
      }
      resolve(results); 
    });
  });
}

/**
 * Sets an employee's status to either active(1) or inactive(0).
 */
User.setStatus = function(eId, status, conn){
  return new Promise((resolve, reject) => {
    conn.query("UPDATE employee SET status=? WHERE (eID = ?);", [status, eId], function(error, results) {
      if(error){
        error.errMsg = "Error occurred in User.setStatus"; 
        reject(error); 
      }
      resolve(results); 
    })
  });
}

/**
 * Sets the employees departmentID to the given deptId. 
 */
User.setDept = function(eId, deptId, conn){
  return new Promise((resolve, reject) => {
    conn.query("UPDATE employee SET departmentID=? WHERE (eID = ?);", [deptId, eId], function(error, results) {
      if(error){
        error.errMsg = "Error occurred in User.setDept"; 
        reject(error); 
      }
      resolve(results); 
    })
  });
}

/**
 * Updates non-critical employee information such as their name, email, or phone.
 */
User.updateNonCrit = function(eId, fName, lName, email, phoneNum){
  return new Promise((resolve, reject) => {
    //generate the query based on which values are not null
    var query = "UPDATE employee SET ";
    var params = []; 
    query = addToQuery(fName, "fname", query, params); 
    query = addToQuery(lName, "lname", query, params); 
    query = addToQuery(email, "email", query, params); 
    query = addToQuery(phoneNum, "phone", query, params); 
    query = query.slice(0, query.length-1); 
    query += " WHERE (eID = ?);";
    params.push(eId); 

    db.query(query, params, function(error, results){
      if(error){
        error.errMsg = "Error occurred in User.updateNonCrit"; 
        reject(error); 
      }
      resolve(results); 
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

/**
 * Resets the employee's password to the new one that they provided. 
 */
User.resetPassword = function(eId, password){
  return new Promise((resolve, reject) => {
    var hash = bcrypt.hashSync(password, bcrypt.genSaltSync(8));
    db.query('UPDATE employee SET password=? WHERE (eID=?);', [hash, eId], function(error, results){
      if(error){
        error.errMsg = "Error occurred in User.resetPassword";
        reject(error); 
      }
      resolve(results); 
    });
  });
}

/**
 * Resets the employees password to a randomly generated password given an email. Then it will 
 * send an email to the employee with their new password. 
 */
User.resetPasswordWithEmail = function(email, conn){
  return new Promise((resolve, reject) => {
    var password = pwdGen.generate({
      length: 16, 
      numbers: true, 
      symbols: true, 
      strict: true
    });
    var hash = bcrypt.hashSync(password, bcrypt.genSaltSync(8)); 
    db.query('UPDATE employee SET password=? WHERE (email=?);', [hash, email], function(error, results){
      if(error){
        error.errMsg = "Error occurred in User.resetPassword";
        reject(error); 
      }
      //send the email
      const oauth2Client = new OAuth2(
        "130825136877-4liulsnpqe55ku7jqldcmvhf8fhjtj64.apps.googleusercontent.com", // ClientID
        "nORPDE6M-D0SvqZAScZtOm_A", // Client Secret
        "https://developers.google.com/oauthplayground" // Redirect URL
      );
        
      oauth2Client.setCredentials({
        refresh_token: "1/LPNp0BaoRiGksk7v8r84Ne7b0AK1iDfRYkPMw2U83-Y"
      });
    
      const smtpTransport = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: "teamgarnetgroup@gmail.com", 
          clientId: "130825136877-4liulsnpqe55ku7jqldcmvhf8fhjtj64.apps.googleusercontent.com",
          clientSecret: "nORPDE6M-D0SvqZAScZtOm_A",
          refreshToken: "1/LPNp0BaoRiGksk7v8r84Ne7b0AK1iDfRYkPMw2U83-Y"    
        }
      });
    
      const mailOptions = {
        from: "teamgarnetgroup@gmail.com",
        to: email,
        subject: "HR Portal: Password Reset",
        generateTextFromHTML: true,
        text: "New Password: " + password + "\n\nDO NOT REPLY TO THIS EMAIL"
      };
    
      smtpTransport.sendMail(mailOptions, (error, response) => {
        smtpTransport.close(); 
        if(error){
          error.errMsg = "Error occurred sending an email to HR"; 
          reject(error);
        }
        resolve(results); 
      });
    });
  });
}

/**
 * Returns an object that contains all of the information in a User object sans password.
 * @param {User} user 
 */
User.userWithoutPwd = function(user){
  return {
    eId: user.eId, 
    fname: user.fname, 
    lname: user.lname, 
    email: user.email, 
    phone: user.phone,
    department: user.department, 
    usertype: user.usertype
  };
}

module.exports = User; 