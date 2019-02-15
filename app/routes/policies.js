const express = require('express');
const router = express.Router();
const db = require('../utilities/db'); 
var Policy = require('../models/policy');
var User = require('../models/user'); 
var AckPolicy = require('../models/ackPolicy');

/**
 * Allows an admin to create a new policy. 
 * Entry is made in the 'policy' table. 
 * Corresponding entries are made in the 'ack_policy' table for all employees in 
 * the departments that the policy is relevant to. 
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

    var policyId;
    var employees; 
    var promise = Policy.create(title, description, url, depts, conn).then(success => {
      policyId = success.insertId; 
      return User.findAllInDepts(depts, conn); 
    });
    
    // get all employees in the given depts
    promise = promise.then(success => {
      employees = success; 
      return AckPolicy.newPolicy(policyId, employees, conn);
    });

    // create a policy acknowledgement for each employee
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
 * Returns a list of policies that a user has yet to acknowledge. 
 */
router.get('/getUnacknowledged/:eId', function(req, res){
  var eId = req.params.eId; 

  db.getConnection((err, conn) => {
    if(err){
      return res.status(503).send({errMsg: "Unable to establish connection to the database"});
    }
    conn.beginTransaction(); 
    //get policyIds for all the unacknowledged policies
    var promise = AckPolicy.getPolicyIds(eId, 0, conn).then(success => {
      return Policy.getPoliciesByIds(success, conn); 
    });
    
    //get the policies
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
 * Returns a list of policies that a user has already acknowledged. 
 */
router.get('/getAcknowledged/:eId', function(req, res){
  var eId = req.params.eId; 

  db.getConnection((err, conn) => {
    if(err){
      return res.status(503).send({errMsg: "Unable to establish connection to the database"});
    }
    conn.beginTransaction(); 
    //get policyIds for all the acknowledged policies
    var promise = AckPolicy.getPolicyIds(eId, 1, conn).then(success => {
      return Policy.getPoliciesByIds(success, conn); 
    });
    
    //get the policies
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
 * Allows the admin to update any policy.
 * The policy's title, description, url, and depts can be updated. 
 * These changes will be made in the 'policy' table, and if any changes
 * have been made to the depts, then changes will be made in the 
 * 'ack_policy' table as well. 
 */
router.post('/update', function(req, res) {
  var policyId = req.body.policyId; 
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

    var promise = Policy.update(policyId, title, description, url, depts, conn).then(success => {
      //otherwise perform the process to insert/update ack_policy entries based on dept changes
      for(i in success){
        if(success[i].relevant == 1){
          relevantDepts.push(success[i]); 
        } else{
          irrelevantDepts.push(success[i]); 
        }
      }
      
      //unack all entries that are related to this policy so users have to ack it again
      return AckPolicy.unackPolicy(policyId, conn);
    });

    promise = promise.then(success => {
      //if there are no dept changes
      if(depts === null){
        return Promise.resolve(success); 
      } 
      
      // makes changes to the ack_policy table based on which depts are still relevant
      return Promise.all([AckPolicy.makeDeptsRelevant(relevantDepts, policyId, conn), 
        AckPolicy.makeDeptsIrrelevant(irrelevantDepts, policyId, conn)]);
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
 * Allows an admin to delete a policy. The policy and it's related 
 * ack_policy entries will be soft-deleted in the database. 
 */
router.post('/delete', function(req, res) {
  var policyId = req.body.policyId; 

  db.getConnection((err, conn) => {
    if(err){
      return res.status(503).send({errMsg: "Unable to establish connection to the database"});
    }
    conn.beginTransaction(); 

    //delete the policy
    var promise = Policy.delete(policyId, conn).then(success => {
      return AckPolicy.deletePolicies(policyId, conn);
    });
    
    //delete all related entries in the ack_policy table
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
 * Allows a user to acknowledge a policy.
 */
router.post('/acknowledge', function(req, res) {
  var policyId = req.body.policyId; 
  var eId = req.body.eId; 

  AckPolicy.acknowledgePolicy(eId, policyId).then(success => {
    return res.send(success); 
  }, error => {
    return res.status(500).send(error); 
  }); 
});

/**
 * Allows admin to get all policies for all departments. Attaches a list of 
 * employees that haven't acknowledged the policy to each policy object.
 */
router.get('/getAll', function(req, res) {
  db.getConnection((err, conn) => {
    if(err){
      return res.status(503).send({errMsg: "Unable to establish connection to the database"});
    }
    conn.beginTransaction(); 

    var promise = Policy.getAllPolicies(conn).then(success => {
      return AckPolicy.getAckNeeded(success, conn);
    });

    promise = promise.then(success=> {
      return AckPolicy.getAckCompleted(success, conn); 
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
 * Allows a dept head to get all policies pertaining to their department. 
 * Attaches a list of employees that haven't acknowledged the policy to each policy object.
 */
router.get('/getAllForDept/:deptId', function(req, res) {
  var deptId = Number.parseInt(req.params.deptId);

  db.getConnection((err, conn) => {
    if(err){
      return res.status(503).send({errMsg: "Unable to establish connection to the database"});
    }
    conn.beginTransaction(); 

    var promise = Policy.getPolicyIdsByDept(deptId, conn).then(success => {
      var policyIds = [];
      success.forEach(function(policy) {
        policyIds.push(policy.policyID); 
      })
      return Policy.getPoliciesByIds(policyIds, conn); 
    });

    promise = promise.then(success=> {
      return AckPolicy.getAckNeeded(success, conn);
    })

    promise = promise.then(success=> {
      return AckPolicy.getAckCompleted(success, conn); 
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
 * Returns a list of all employees that haven't acknowledged a policy.
 */
router.get('/getUnackEmployees/:policyId', function(req, res) {
  var policyId = req.params.policyId; 

  db.getConnection((err, conn) => {
    if(err){
      return res.status(503).send({errMsg: "Unable to establish connection to the database"});
    }
    conn.beginTransaction(); 

    var promise = AckPolicy.getUnackEmployees(policyId, conn).then(success => {
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