class ExpressError extends Error{
    constructor(statuscode, message){
        super();
        this.statusCode = statusCode;
        this.message = message;
    }
}

module.exports = ExpressError;