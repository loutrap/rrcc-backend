const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport'); 
const cookieParser = require('cookie-parser');
const session = require('express-session'); 
const cors = require('cors'); 

//Custom Routes
const usersRoute = require('./app/routes/users');
const authRoute = require('./app/routes/auth');
const alertsRoute = require('./app/routes/alerts');
const policiesRoute = require('./app/routes/policies'); 
const surveysRoute = require('./app/routes/surveys'); 
const emailRoute = require('./app/routes/email');

const app = express();

//Configure Passport
require('./app/utilities/passport-config')(passport);


//Cookie and session
app.use(session({
  secret: 'this is the secret', 
  resave: false, 
  saveUninitialized: true
}));
app.use(cookieParser());
app.use(passport.initialize());
app.use(passport.session());

//Body Parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Allows for Cross-Origin Resource Sharing
app.use(cors({
  origin: ['http://localhost:4200', 'http://localhost'], 
  credentials: true})); 

//Check that the user is authenticated
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.status(401).send({errMsg: "Please login first"});
}
app.all('*', function(req,res,next){
  if (req.path === '/users/register' || req.path === '/auth/login' || req.path === '/users/resetPassword' || req.path === '/users/testPopulation')
    next();
  else
    ensureAuthenticated(req,res,next);  
});

// Routes
app.use('/users', usersRoute);
app.use('/auth', authRoute); 
app.use('/alerts', alertsRoute); 
app.use('/policies', policiesRoute); 
app.use('/surveys', surveysRoute); 
app.use('/email', emailRoute); 

app.listen(3000, () => console.log('Running on port 3000'));