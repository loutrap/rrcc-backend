const express = require('express');
const router = express.Router();
const db = require('../utilities/db'); 
var Survey = require('../models/survey');
var User = require('../models/user'); 
var AckSurvey = require('../models/ackSurvey');

/**
 * Allows an admin to create a new survey. 
 * Entry is made in the 'survey' table. 
 * Corresponding entries are made in the 'ack_survey' table for all employees in 
 * the departments that the survey is relevant to. 
 */
router.post('/create', function(req, res){
  var title = req.body.title; 
  var description = req.body.description; 
  var url = req.body.url; 
  var depts = req.body.depts; 

  // validate the request params
  db.getConnection((err, conn) => {
    if(err){
      return res.status(503).send({errMsg: "Unable to establish connection to the database"});
    }
    conn.beginTransaction(); 

    var surveyId;
    var employees; 
    var promise = Survey.create(title, description, url, depts, conn).then(success => {
      surveyId = success.insertId; 
      return User.findAllInDepts(depts, conn); 
    });
    
    // get all employees in the given depts
    promise = promise.then(success => {
      employees = success; 
      return AckSurvey.newSurvey(surveyId, employees, conn);
    });

    // create a survey acknowledgement for each employee
    promise.then(success => {
      conn.commit(); 
      conn.release(); 
      return res.send(success); 
    });

    // error handling
    promise.catch(error => {
      conn.rollback(); 
      conn.release(); 
      return res.status(500).send(error); 
    }); 
  });
});

/**
 * Returns a list of surveys that a user has yet to acknowledge. 
 */
router.get('/getUnacknowledged/:eId', function(req, res){
  var eId = req.params.eId; 

  db.getConnection((err, conn) => {
    if(err){
      return res.status(503).send({errMsg: "Unable to establish connection to the database"});
    }
    conn.beginTransaction(); 
    //get surveyIds for all the unacknowledged surveys
    var promise = AckSurvey.getSurveyIds(eId, 0, conn).then(success => {
      return Survey.getSurveysByIds(success, conn); 
    });
    
    //get the surveys
    promise.then(success => {
      conn.commit(); 
      conn.release(); 
      return res.send(success);
    });

    // error handling
    promise.catch(error => {
      conn.rollback(); 
      conn.release(); 
      return res.status(500).send(error); 
    }); 
  });
});

/**
 * Returns a list of surveys that a user has already acknowledged. 
 */
router.get('/getAcknowledged/:eId', function(req, res){
  var eId = req.params.eId; 

  db.getConnection((err, conn) => {
    if(err){
      return res.status(503).send({errMsg: "Unable to establish connection to the database"});
    }
    conn.beginTransaction(); 
    //get surveyIds for all the acknowledged surveys
    var promise = AckSurvey.getSurveyIds(eId, 1, conn).then(success => {
      return Survey.getSurveysByIds(success, conn); 
    });
    
    //get the surveys
    promise.then(success => {
      conn.commit(); 
      conn.release(); 
      return res.send(success);
    });

    // error handling
    promise.catch(error => {
      conn.rollback(); 
      conn.release(); 
      return res.status(500).send(error); 
    }); 
  });
});

/**
 * Allows the admin to update any survey.
 * The survey's title, description, url, and depts can be updated. 
 * These changes will be made in the 'survey' table, and if any changes
 * have been made to the depts, then changes will be made in the 
 * 'ack_survey' table as well. 
 */
router.post('/update', function(req, res) {
  var surveyId = req.body.surveyId; 
  var title = req.body.title ? req.body.title : null; 
  var description = req.body.description ? req.body.description : null; 
  var url = req.body.url ? req.body.url : null; 
  var depts = req.body.depts ? req.body.depts : null; 
  if(depts){
    if(depts.length == 0){
      depts = null; 
    }
  }

  if(title === null && description === null && url === null && depts === null){
    return res.send({msg: "Nothing needs to be updated"}); 
  }

  db.getConnection((err, conn) => {
    if(err){
      return res.status(503).send({errMsg: "Unable to establish connection to the database"});
    }
    conn.beginTransaction(); 

    var relevantDepts = []; 
    var irrelevantDepts = []; 

    var promise = Survey.update(surveyId, title, description, url, depts, conn).then(success => {
      //otherwise perform the process to insert/update ack_survey entries based on dept changes
      for(i in success){
        if(success[i].relevant == 1){
          relevantDepts.push(success[i]); 
        } else{
          irrelevantDepts.push(success[i]); 
        }
      }
      
      //unack all entries that are related to this survey so users have to ack it again
      return AckSurvey.unackSurvey(surveyId, conn);
    });

    promise = promise.then(success => {
      //if there are no dept changes
      if(depts === null){
        return Promise.resolve(success); 
      } 
      
      // makes changes to the ack_survey table based on which depts are still relevant
      return Promise.all([AckSurvey.makeDeptsRelevant(relevantDepts, surveyId, conn), 
        AckSurvey.makeDeptsIrrelevant(irrelevantDepts, surveyId, conn)]);
    });
    
    promise.then(success => {
      conn.commit(); 
      conn.release(); 
      return res.send(success); 
    });

    // error handling
    promise.catch(error => {
      conn.rollback(); 
      conn.release(); 
      return res.status(400).send(error); 
    });
  }); 
});

/**
 * Allows an admin to delete a survey. The survey and it's related 
 * ack_survey entries will be soft-deleted in the database. 
 */
router.post('/delete', function(req, res) {
  var surveyId = req.body.surveyId; 

  db.getConnection((err, conn) => {
    if(err){
      return res.status(503).send({errMsg: "Unable to establish connection to the database"});
    }
    conn.beginTransaction(); 

    //delete the survey
    var promise = Survey.delete(surveyId, conn).then(success => {
      return AckSurvey.deleteSurveys(surveyId, conn);
    });
    
    //delete all related entries in the ack_survey table
    promise.then(success => {
      conn.commit(); 
      conn.release(); 
      return res.send(success); 
    });

    // error handling
    promise.catch(error => {
      conn.rollback(); 
      conn.release(); 
      return res.status(500).send(error); 
    }); 
  });
});

/**
 * Allows a user to acknowledge a survey.
 */
router.post('/acknowledge', function(req, res) {
  var surveyId = req.body.surveyId; 
  var eId = req.body.eId; 

  AckSurvey.acknowledgeSurvey(eId, surveyId).then(success => {
    return res.send(success); 
  }, error => {
    return res.status(500).send(error); 
  }); 
});

/**
 * Allows admin to get all surveys for all departments. Attaches a list of 
 * employees that haven't acknowledged the survey to each survey object.
 */
router.get('/getAll', function(req, res) {
  db.getConnection((err, conn) => {
    if(err){
      return res.status(503).send({errMsg: "Unable to establish connection to the database"});
    }
    conn.beginTransaction(); 

    var promise = Survey.getAllSurveys(conn).then(success => {
      return AckSurvey.getAckNeeded(success, conn);
    });

    promise = promise.then(success=> {
      return AckSurvey.getAckCompleted(success, conn); 
    });

    promise = promise.then(success => {
      conn.commit(); 
      conn.release(); 
      return res.send(success); 
    });

    promise.catch(error => {
      conn.rollback(); 
      conn.release(); 
      return res.status(500).send(error); 
    });
  }); 
});

/**
 * Allows a dept head to get all surveys pertaining to their department. 
 * Attaches a list of employees that haven't acknowledged the survey to each survey object.
 */
router.get('/getAllForDept/:deptId', function(req, res) {
  var deptId = Number.parseInt(req.params.deptId);

  db.getConnection((err, conn) => {
    if(err){
      return res.status(503).send({errMsg: "Unable to establish connection to the database"});
    }
    conn.beginTransaction(); 

    var promise = Survey.getSurveyIdsByDept(deptId, conn).then(success => {
      var surveyIds = [];
      success.forEach(function(survey) {
        surveyIds.push(survey.surveyID); 
      })
      return Survey.getSurveysByIds(surveyIds, conn); 
    });

    promise = promise.then(success=> {
      return AckSurvey.getAckNeeded(success, conn);
    })

    promise = promise.then(success=> {
      return AckSurvey.getAckCompleted(success, conn); 
    });

    promise = promise.then(success => {
      conn.commit(); 
      conn.release(); 
      return res.send(success); 
    });

    promise.catch(error => {
      conn.rollback(); 
      conn.release(); 
      return res.status(500).send(error); 
    });
  }); 
});

/**
 * Returns a list of all employees that haven't acknowledged a survey.
 */
router.get('/getUnackEmployees/:surveyId', function(req, res) {
  var surveyId = req.params.surveyId; 

  db.getConnection((err, conn) => {
    if(err){
      return res.status(503).send({errMsg: "Unable to establish connection to the database"});
    }
    conn.beginTransaction(); 

    var promise = AckSurvey.getUnackEmployees(surveyId, conn).then(success => {
      return User.getEmployeesByIds(success, conn); 
    });

    promise = promise.then(success=> {
      conn.commit(); 
      conn.release(); 
      return res.send(success); 
    });

    promise.catch(error => {
      conn.rollback(); 
      conn.release(); 
      return res.send(error); 
    });
  })
});

module.exports = router; 