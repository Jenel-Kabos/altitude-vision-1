/**
 * @typedef {'BUY'|'RENT'|'STAY'|null} Transaction
 * @typedef {'XAF'|'EUR'|'USD'|null} Currency
 * @typedef {'TOTAL'|'NIGHT'|'MONTH'|null} BudgetPeriod
 * @typedef {{code:string, field?:string, message:string}} ParserNotice
 * @typedef {{category:string,maxMeters:number}} ProximityCriterion
 * @typedef {{min:number|null,max:number|null,currency:Currency,period:BudgetPeriod}} BudgetCriteria
 * @typedef {{required:string[],preferred:string[],excluded:string[]}} WeightedAmenities
 * @typedef {{transaction:Transaction,propertyTypes:string[],accommodationTypes:string[],location:object,budget:BudgetCriteria,bedrooms:object,bathrooms:object,surface:object,floors:object,amenities:WeightedAmenities,proximity:{required:ProximityCriterion[],preferred:ProximityCriterion[]},stay:object}} RealEstateCriteria
 * @typedef {{version:string,status:'recognized'|'needs_clarification'|'unrecognized',criteria:RealEstateCriteria,alternatives:object[],missing:string[],ambiguities:ParserNotice[],contradictions:ParserNotice[],clarificationQuestions:string[],issues:ParserNotice[],unrecognizedFragments:string[]}} ParsedRealEstateRequest
 */

module.exports = {};
