// server/utils/apiFeatures.js
const logger = require('./logger');

class APIFeatures {
    constructor(query, queryString) {
        this.query = query; // La requête Mongoose (ex: Property.find())
        this.queryString = queryString; // L'objet req.query
    }

    /**
     * 1. Filtrage (Filtering)
     * Exclut les champs spéciaux (sort, limit, page, fields) et applique
     * les filtres avancés (gt, gte, lt, lte) et la recherche par texte.
     */
    filter() {
        // 1A. Créer une copie du query string et exclure les champs à ignorer
        const queryObj = { ...this.queryString };
        
        // 🚨 IMPORTANT : Ajout de 'search' pour l'exclure du filtrage classique
        const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
        excludedFields.forEach(el => delete queryObj[el]);

        // 1B. Appliquer les opérateurs avancés de filtrage (gt, gte, etc.)
        let queryStr = JSON.stringify(queryObj);
        queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

        // 1C. Appliquer les filtres restants (y compris les nouveaux : livingRooms, kitchens, etc.)
        // Ces champs sont gérés ici car ils utilisent la recherche exacte ou les opérateurs gt/lt
        const filters = JSON.parse(queryStr);
        
        // ⭐ ÉTAPE 1 : GESTION DE LA RECHERCHE TEXTUELLE GLOBALE
        if (this.queryString.search) {
            const regex = new RegExp(this.queryString.search, 'i'); // 'i' pour insensible à la casse
            logger.info(`🔎 [APIFeatures] Recherche texte: /${this.queryString.search}/`);
            
            // Recherche dans le titre, la description, l'arrondissement et le type
            filters.$or = [
                { title: { $regex: regex } },
                { description: { $regex: regex } },
                { 'address.arrondissement': { $regex: regex } },
                { type: { $regex: regex } },
            ];
        }
        
        // ⭐ ÉTAPE 2 : FILTRE EXCLUSIF POUR LE NOUVEAU CHAMP constructionType
        // On le gère séparément s'il est destiné à être un filtre exact/enum
        if (filters.constructionType) {
            // Si la constructionType est passée comme filtre, elle est déjà dans 'filters'
            // On peut la laisser se faire traiter par la méthode find
            // NOTE : Si vous vouliez une recherche partielle (regex), décommentez ceci :
            /*
            filters.constructionType = {
                $regex: new RegExp(filters.constructionType, 'i')
            };
            */
            logger.info(`🧱 [APIFeatures] Filtre constructionType: ${filters.constructionType}`);
        }
        
        logger.info("🔍 [APIFeatures] Filtres finaux appliqués:", filters);

        this.query = this.query.find(filters);

        return this; // Permet l'enchaînement des méthodes
    }

    /**
     * 2. Tri (Sorting)
     * Applique le tri à la requête. Le tri par défaut est la date de création.
     */
    sort() {
        if (this.queryString.sort) {
            const sortBy = this.queryString.sort.split(',').join(' ');
            logger.info("📊 [APIFeatures] Tri appliqué:", sortBy);
            this.query = this.query.sort(sortBy);
        } else {
            this.query = this.query.sort('-createdAt'); 
        }

        return this;
    }

    /**
     * 3. Sélection de champs (Limiting Fields)
     * Permet de ne retourner que les champs spécifiés (projection).
     */
    limitFields() {
        if (this.queryString.fields) {
            const fields = this.queryString.fields.split(',').join(' ');
            logger.info("📋 [APIFeatures] Champs limités:", fields);
            this.query = this.query.select(fields);
        } else {
            this.query = this.query.select('-__v');
        }

        return this;
    }

    /**
     * 4. Pagination
     * Ajoute les options skip (sauter) et limit (limiter) pour la pagination.
     */
    paginate() {
        const page = this.queryString.page * 1 || 1; 
        const limit = this.queryString.limit * 1 || 10; 
        const skip = (page - 1) * limit;

        logger.info("📄 [APIFeatures] Pagination:", { page, limit, skip });

        this.query = this.query.skip(skip).limit(limit);

        return this;
    }
}

module.exports = APIFeatures;