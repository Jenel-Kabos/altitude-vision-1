const Hotel = require('../../models/Hotel');
const { normalizeHotelName } = require('../../utils/normalizeHotelName');

const HOTEL_NAME_CONFLICT_CODE = 'HOTEL_NAME_ALREADY_EXISTS';
const HOTEL_NAME_UNIQUE_INDEX = 'tenant_normalized_hotel_name_unique';
const HOTEL_NAME_CONFLICT_MESSAGE = 'Un établissement portant ce nom existe déjà dans ce contexte.';

class HotelNameConflictError extends Error {
  constructor() {
    super(HOTEL_NAME_CONFLICT_MESSAGE);
    this.name = 'HotelNameConflictError';
    this.code = HOTEL_NAME_CONFLICT_CODE;
    this.statusCode = 409;
  }
}

function resolveHotelNameScope({ tenantId, managerId }) {
  if (tenantId) return { tenant: tenantId };
  return { tenant: null, manager: managerId };
}

async function assertHotelNameAvailable({ name, tenantId, managerId, excludeHotelId = null, session = null }) {
  const normalizedName = normalizeHotelName(name);
  if (!normalizedName) return { normalizedName };
  const query = {
    ...resolveHotelNameScope({ tenantId, managerId }),
    ...(excludeHotelId ? { _id: { $ne: excludeHotelId } } : {}),
    $or: [
      { normalizedName },
      { normalizedName: { $exists: false } },
      { normalizedName: null },
    ],
  };
  let lookup = Hotel.find(query).select('name normalizedName').lean();
  if (session) lookup = lookup.session(session);
  const candidates = await lookup;
  if (candidates.some((hotel) => (hotel.normalizedName || normalizeHotelName(hotel.name)) === normalizedName)) {
    throw new HotelNameConflictError();
  }
  return { normalizedName };
}

function isHotelNameDuplicateKey(error) {
  if (error?.code !== 11000) return false;
  return error?.keyPattern?.normalizedName === 1
    || error?.constraint === HOTEL_NAME_UNIQUE_INDEX
    || String(error?.message || '').includes(HOTEL_NAME_UNIQUE_INDEX);
}

function translateHotelNameDuplicate(error) {
  if (error instanceof HotelNameConflictError) return error;
  return isHotelNameDuplicateKey(error) ? new HotelNameConflictError() : error;
}

module.exports = {
  HOTEL_NAME_CONFLICT_CODE,
  HOTEL_NAME_CONFLICT_MESSAGE,
  HOTEL_NAME_UNIQUE_INDEX,
  HotelNameConflictError,
  assertHotelNameAvailable,
  isHotelNameDuplicateKey,
  normalizeHotelName,
  resolveHotelNameScope,
  translateHotelNameDuplicate,
};
