const express = require('express');
const router = express.Router();
var User = require('../models/user');

//test account
// const accountSid = 'AC54371bd8095f177b5524f49ef0a7f4f1';
// const authToken = '80740e1b96cc744294de85cff8882ecd';

//LIVE
const accountSid = 'AC99f5a1cf95c40049f94f58d9b12856a5';
const authToken = '5320f6abff74555ebdb46f3f09964e45';
const client = require('twilio')(accountSid, authToken);

router.post('/sms', function(req, res) {
	var smsMessage = req.body.message;
	var departments = req.body.departments;
	//pass in department array array to user->findPhones
	//returns list of numbers
	var failedNumbers = []; 
	var phoneNumbers = User.findPhonesInDepts(departments);
	phoneNumbers.then(function(numbers){
		numbers.forEach(function(number){
			var message = client.messages.create({
				body: smsMessage,
				from: '+15853022896',
				to: number
			})
			.then(message => console.log(message.status), error => failedNumbers.push(error? error.to : null))
			.done();
		});
		//returns list of numbers that twilio wasn't able to send the alert to
		return res.status(200).send(failedNumbers);         
	}, function(error){
		return res.status(400).send(error); 
	});  
});

module.exports = router; 
