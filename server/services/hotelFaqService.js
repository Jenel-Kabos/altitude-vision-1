// server/services/hotelFaqService.js — PHASE-H3
//
// FAQ rédigée par l'hôtel (mission §13), jamais du Q&A communautaire —
// aucune génération automatique, aucune réponse stockée comme fait sans
// qu'un acteur (propriétaire/staff) l'ait explicitement écrite.
const HotelFaq = require('../models/HotelFaq');

function serializePublicFaq(entry) {
  return { id: entry._id, question: entry.question, answer: entry.answer, order: entry.order };
}

async function listPublicFaq(hotelId) {
  const entries = await HotelFaq.find({ hotel: hotelId, active: true }).sort({ order: 1, createdAt: 1 });
  return entries.map(serializePublicFaq);
}

async function listForOwner(hotelId) {
  return HotelFaq.find({ hotel: hotelId }).sort({ order: 1, createdAt: 1 });
}

async function createFaqEntry({ hotelId, question, answer, order = 0, actingUser }) {
  if (!String(question || '').trim() || !String(answer || '').trim()) {
    const err = new Error('Question et réponse sont requises.'); err.statusCode = 422; throw err;
  }
  return HotelFaq.create({
    hotel: hotelId, question: String(question).trim(), answer: String(answer).trim(),
    order: Number(order) || 0, createdBy: actingUser?.id || actingUser?._id,
  });
}

async function updateFaqEntry({ hotelId, faqId, changes, actingUser }) {
  const entry = await HotelFaq.findOne({ _id: faqId, hotel: hotelId });
  if (!entry) { const err = new Error('Question introuvable.'); err.statusCode = 404; throw err; }
  if (changes.question !== undefined) entry.question = String(changes.question).trim();
  if (changes.answer !== undefined) entry.answer = String(changes.answer).trim();
  if (changes.order !== undefined) entry.order = Number(changes.order) || 0;
  if (changes.active !== undefined) entry.active = Boolean(changes.active);
  entry.updatedBy = actingUser?.id || actingUser?._id || null;
  await entry.save();
  return entry;
}

async function deleteFaqEntry({ hotelId, faqId }) {
  const result = await HotelFaq.deleteOne({ _id: faqId, hotel: hotelId });
  if (result.deletedCount === 0) { const err = new Error('Question introuvable.'); err.statusCode = 404; throw err; }
}

module.exports = { listPublicFaq, listForOwner, createFaqEntry, updateFaqEntry, deleteFaqEntry, serializePublicFaq };
