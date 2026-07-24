import api from './api';

export const getAccessibleHotels = async () => {
  const res = await api.get('/hotels/accessible');
  return res.data.data;
};

export const listHotelStaffAssignments = async (hotelId, params = {}) => {
  const res = await api.get(`/hotels/${hotelId}/staff-assignments`, { params });
  return res.data.data;
};
export const getHotelStaffAssignment = async (hotelId, assignmentId) => {
  const res = await api.get(`/hotels/${hotelId}/staff-assignments/${assignmentId}`);
  return res.data.data.assignment;
};
export const createHotelStaffAssignment = async (hotelId, data) => {
  const res = await api.post(`/hotels/${hotelId}/staff-assignments`, data);
  return res.data.data.assignment;
};
export const updateHotelStaffAssignment = async (hotelId, assignmentId, data) => {
  const res = await api.patch(`/hotels/${hotelId}/staff-assignments/${assignmentId}`, data);
  return res.data.data.assignment;
};
export const suspendHotelStaffAssignment = async (hotelId, assignmentId, reason) => {
  const res = await api.post(`/hotels/${hotelId}/staff-assignments/${assignmentId}/suspend`, { reason });
  return res.data.data.assignment;
};
export const reactivateHotelStaffAssignment = async (hotelId, assignmentId) => {
  const res = await api.post(`/hotels/${hotelId}/staff-assignments/${assignmentId}/reactivate`);
  return res.data.data.assignment;
};
export const revokeHotelStaffAssignment = async (hotelId, assignmentId, reason) => {
  const res = await api.post(`/hotels/${hotelId}/staff-assignments/${assignmentId}/revoke`, { reason });
  return res.data.data.assignment;
};
