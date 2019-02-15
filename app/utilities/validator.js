/**
 * Validate Name
 * Returns true if the name contains only letters, spaces, and characters ' and -
 * @param name - user's name
 */
function validateName(name){
	var regex = '^[A-Za-z][A-Za-z\\\'\\-]+([\\ A-Za-z][A-Za-z\\\'\\-]+)*';
	return validateField(name, regex);
}

/**
 * Validate Email
 * Returns true if the email address is valid.
 * Regex value is from here: http://emailregex.com/
 * @param email - user's email address
 */
function validateEmail(email){
    var regex = '^(([^<>()\\[\\]\\\\.,;:\\s@"]+(\\.[^<>()\\[\\]\\\\.,;:\\s@"]+)*)|(".+"))@((\\[[0-9]' +
        '{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}])|(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))$';
    return validateField(email, regex);
}

/**
 * Validate Phone Number
 * Returns true if the phone number is 10 digits, regardless of how it is formatted
 * Regex value is from here: https://stackoverflow.com/questions/16699007/regular-expression-to-match-standard-10-digit-phone-number
 * @param phone - user's phone number
 */
function validatePhoneNumber(phone){
    var regex = '^(\\+\\d{1,2})?\\d{10}$';
    return validateField(phone, regex);
}

/**
 * Validate Department
 * Returns true if the department isn't null, and it's name and id aren't null
 * @param password - user's password
 */
function validateDepartment(department){
	//obj is not null
	//proprties not null
    if (department) {
    	if (department.name && department.id) {
    		return true;
		}
	}
	return false;
}

/**
 * Validate Password
 * Returns true if the password meets the criteria mentioned on the registration page
 * @param password - user's password
 */
function validatePassword(password){
    var regex = '((?=.*\\d)(?=.*[A-Z])(?=.*\\W).{8,})';
    return validateField(password, regex);
}

/**
 * Validate Field Helper Function
 * Returns true if the value isn't null, is a string, and meets the regex criteria.
 * @param value - field's string value
 * @param regex - regular expression that determines validity
 */
function validateField(value, regex = null) {
	if (value) {
        if (typeof value === 'string') {
			if (regex) {
				expression = new RegExp(regex);
				return expression.test(value);
			}
        }
	}
	return false;
}

/**
 * Validate Registrant
 * Returns true if all fields validate
 * @param fname - user's first name
 * @param lname - user's last name
 * @param email - user's email address
 * @param phone - user's phone number
 * @param department - user's department
 * @param password - user's password
 */
function validateRegistrant(fname, lname, email, phone, department, password){
	return new Promise((resolve, reject) => {
		var validName = (validateName(fname) && validateName(lname)); 
		var validEmail = validateEmail(email); 
		var validPhone = validatePhoneNumber(phone); 
		var validDepartment = validateDepartment(department);
		var validPassword = validatePassword(password);

        // Execute validation on all fields. Reject if any fail.
		if(validName && validEmail && validPhone && validDepartment && validPassword){
				resolve();
		} else{
				reject(); 
		}
	}); 
}

/**
 * Exports the validateRegistrant function for use in the user routes
 */
module.exports = {
	validateRegistrant
}