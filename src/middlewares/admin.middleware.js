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
                    "Accès refusé."
            });
        }

        const token =
            authHeader.replace(
                "Bearer ",
                ""
            );

        const payload =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );

        if (
            !payload.isAdmin
        ) {
            return res.status(403).json({
                message:
                    "Accès interdit."
            });
        }

        req.admin =
            payload;

        next();

    } catch (error) {

        return res.status(401).json({
            message:
                "Session administrateur invalide."
        });

    }
}

module.exports =
    adminMiddleware;