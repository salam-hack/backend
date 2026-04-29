'use strict';

const successResponse = (res, data, statusCode = 200) => {
  res.status(statusCode).json({ success: true, data });
};

const createdResponse = (res, data) => {
  successResponse(res, data, 201);
};

const paginatedResponse = (res, data, meta) => {
  res.status(200).json({ success: true, data, meta });
};

module.exports = { successResponse, createdResponse, paginatedResponse };
