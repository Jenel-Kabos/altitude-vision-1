class HotelAccessError extends Error {
  constructor(code, message, statusCode = 403) {
    super(message);
    this.name = 'HotelAccessError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const fail = (code, message, statusCode = 403) => { throw new HotelAccessError(code, message, statusCode); };

module.exports = { HotelAccessError, fail };
