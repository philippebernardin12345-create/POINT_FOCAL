const jwt = require("jsonwebtoken");

function adminMiddleware(
    req,
    res,
    next
) {
    try {
        const authHeader =
            req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                message:
                    "Token administrateur manquant."
            });
        }

        if (
            !authHeader.startsWith(
                "Bearer "
            )
        ) {
            return res.status(401).json({
                message:
                    "Format du token invalide."
            });
        }

        const token =
            authHeader
                .slice(7)
                .trim();

        if (!token) {
            return res.status(401).json({
                message:
                    "Token administrateur vide."
            });
        }

        const payload =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );

        const isAdmin =
            payload.role === "admin" ||
            payload.isAdmin === true;

        if (!isAdmin) {
            return res.status(403).json({
                message:
                    "Accès administrateur interdit."
            });
        }

        req.admin =
            payload;

        next();

    } catch (error) {
        console.error(
            "Erreur middleware admin :",
            error.message
        );

        if (
            error.name ===
            "TokenExpiredError"
        ) {
            return res.status(401).json({
                message:
                    "Session administrateur expirée."
            });
        }

        return res.status(401).json({
            message:
                "Session administrateur invalide."
        });
    }
}

module.exports =
    adminMiddleware;